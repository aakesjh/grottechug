import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";
import { apiFetch } from "../lib/api";

type Semester = "2026V" | "2025H" | "all";

// NYTT: Inkludert sessionId i typen
type Point = { sessionId: string; dateISO: string; seconds: number; note: string | null };
type Resp = {
  participant: { id: string; name: string; isRegular: boolean; imageUrl?: string | null };
  semester: string;
  points: Point[];
  stats: { attempts: number; best: number | null; avg: number | null; bestClean: number | null };
};

function fmtDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

const RULE_COLORS: Record<string, string> = {
  DNS: "#ef4444",
  DNF: "#f97316",
  MM: "#86efac",
  W: "#3b82f6",
  VW: "#1e3a8a",
  P: "#ec4899",
  ABSENCE: "#94a3b8",
  VOMIT: "#84cc16",
  KPR: "#06b6d4",
  T: "#14b8a6",
};

export function PersonPage() {
  const { id } = useParams();
  const nav = useNavigate(); // NYTT: For navigering
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<Resp | null>(null);
  
  const [participants, setParticipants] = useState<{id: string, name: string}[]>([]);
  const [compareId, setCompareId] = useState<string>("");
  const [compareData, setCompareData] = useState<Resp | null>(null);

  // 1. Hent alle deltakere for sammenligning
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/participants?includeGuests=true`);
        const json = await res.json();
        
        const list = json
          .filter((r: any) => {
            if (String(r.id) === String(id)) return false;
            return r.isRegular || (r.attempts >= 4);
          })
          .map((r: any) => ({ 
            id: String(r.id), 
            name: r.isRegular ? r.name : `${r.name} (Gjest)` 
          }));
        
        const uniqueList = Array.from(new Map(list.map((item: any) => [item.id, item])).values())
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        setParticipants(uniqueList as {id: string, name: string}[]);
      } catch (e) {
        console.error("Kunne ikke hente deltakere", e);
      }
    })();
  }, [id]);

  // 2. Hent hovedpersonens data
  useEffect(() => {
    (async () => {
      const res = await apiFetch(`/api/person/${id}?semester=${semester}`);
      const json: Resp = await res.json();
      setData(json);
    })();
  }, [id, semester]);

  // 3. Hent sammenligningspersonens data
  useEffect(() => {
    if (!compareId) {
      setCompareData(null);
      return;
    }
    (async () => {
      const res = await apiFetch(`/api/person/${compareId}?semester=${semester}`);
      const json: Resp = await res.json();
      setCompareData(json);
    })();
  }, [compareId, semester]);

  const chartData = useMemo(() => {
    if (!data) return [];

    if (!compareData) {
      const pts = data.points.map((p, i) => ({
        ...p,
        idx: i,
        date: fmtDDMMYYYY(p.dateISO)
      }));

      if (pts.length < 2) return pts;

      const xs = pts.map(p => p.idx);
      const ys = pts.map(p => p.seconds);
      const n = xs.length;
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const sumXX = xs.reduce((a, x) => a + x * x, 0);
      const denom = n * sumXX - sumX * sumX;
      const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;

      return pts.map(p => ({ ...p, trend: m * p.idx + b }));
    }

    const dateMap = new Map<string, any>();
    const addData = (points: Point[], key: string) => {
      points.forEach(p => {
        const d = fmtDDMMYYYY(p.dateISO);
        if (!dateMap.has(d)) {
          dateMap.set(d, { dateISO: p.dateISO, date: d });
        }
        dateMap.get(d)[key] = p.seconds;
      });
    };
    addData(data.points, "mainSeconds");
    addData(compareData.points, "compSeconds");

    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );
  }, [data, compareData]);

  if (!data) return <div className="card u-text-center" style={{ padding: 40 }}>Laster data for profil...</div>;

  const p = data.participant;
  const bestClean = data.stats.bestClean;

  let changeSinceStart = null;
  let last3Avg = null;
  let projectedNext = null;
  let totalTime = 0;

  if (data.points.length > 0) {
    const pts = data.points;
    totalTime = pts.reduce((sum, pt) => sum + pt.seconds, 0);
    if (pts.length >= 2) {
      changeSinceStart = pts[0].seconds - pts[pts.length - 1].seconds; 
      const n = pts.length;
      const sumX = pts.map((_, i) => i).reduce((a, b) => a + b, 0);
      const sumY = pts.reduce((a, pt) => a + pt.seconds, 0);
      const sumXY = pts.map((pt, i) => i * pt.seconds).reduce((a, b) => a + b, 0);
      const sumXX = pts.map((_, i) => i * i).reduce((a, b) => a + b, 0);
      const denom = n * sumXX - sumX * sumX;
      const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;
      projectedNext = Math.max(0, m * n + b); 
    }
    const last3 = pts.slice(-3);
    last3Avg = last3.reduce((sum, pt) => sum + pt.seconds, 0) / last3.length;
  }

  let headToHeadAvg = "Uavgjort / Mangler data";
  let headToHeadBest = "Uavgjort / Mangler data";
  let headToHeadConsistency = "Uavgjort / Mangler data";

  if (compareData) {
    if (data.stats.avg && compareData.stats.avg) {
      const diff = data.stats.avg - compareData.stats.avg;
      if (diff < 0) headToHeadAvg = `${p.name} (-${Math.abs(diff).toFixed(2)}s)`;
      else if (diff > 0) headToHeadAvg = `${compareData.participant.name} (-${diff.toFixed(2)}s)`;
    }
    if (data.stats.bestClean && compareData.stats.bestClean) {
      const diff = data.stats.bestClean - compareData.stats.bestClean;
      if (diff < 0) headToHeadBest = `${p.name} (-${Math.abs(diff).toFixed(2)}s)`;
      else if (diff > 0) headToHeadBest = `${compareData.participant.name} (-${diff.toFixed(2)}s)`;
    }
    if (data.points.length >= 2 && compareData.points.length >= 2) {
      const getGap = (pts: Point[]) => Math.max(...pts.map(pt => pt.seconds)) - Math.min(...pts.map(pt => pt.seconds));
      const myGap = getGap(data.points);
      const compGap = getGap(compareData.points);
      if (myGap < compGap) headToHeadConsistency = p.name;
      else if (myGap > compGap) headToHeadConsistency = compareData.participant.name;
      else headToHeadConsistency = "Likt gap";
    }
  }

  return (
    <div>
      <div className="row" style={{ marginTop: 14, flexWrap: "wrap", alignItems: "stretch" }}>
        
        <div className="col card" style={{ flex: "1 1 250px", maxWidth: "100%", display: "flex", flexDirection: "column" }}>
          <div className="person__header">
            <h1 className="u-mb-0">{p.name}</h1>
            <span className="badge">{p.isRegular ? "fast" : "gjest"}</span>
          </div>
          
          <div className="person__photo-frame">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} className="person__photo" />
            ) : (
              <div className="person__no-photo">Ingen bilde</div>
            )}
          </div>

          <div className="hr" style={{ marginTop: 8, marginBottom: 12 }} />

          <div className="person__stats-list">
            <h2 className="u-mb-0">Statistikk</h2>
            <div className="person__stat-row">
              <span className="u-text-muted">Antall forsøk:</span> 
              <b>{data.stats.attempts}</b>
            </div>
            <div className="person__stat-row">
              <span className="u-text-muted">Beste tid:</span> 
              <b>{data.stats.best == null ? "-" : `${data.stats.best.toFixed(2)}s`}</b>
            </div>
            <div className="person__stat-row">
              <span className="u-text-muted">Gjennomsnitt:</span> 
              <b>{data.stats.avg == null ? "-" : `${data.stats.avg.toFixed(2)}s`}</b>
            </div>
            <div className="person__stat-row">
              <span className="u-text-muted">Beste (uten anm):</span> 
              <b className="u-text-accent">{bestClean == null ? "-" : `${bestClean.toFixed(2)}s`}</b>
            </div>
          </div>
        </div>

        <div className="col card" style={{ flex: "2 1 500px", display: "flex", flexDirection: "column" }}>
          <div className="person__chart-header">
            <h2 className="u-mb-0">Utvikling</h2>
            
            <div className="person__chart-controls">
              <select 
                className="input person__compare-select"
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
              >
                <option value="" style={{ background: "#121a33" }}>Sammenlign med...</option>
                {participants.map(pt => (
                  <option key={pt.id} value={pt.id} style={{ background: "#121a33" }}>{pt.name}</option>
                ))}
              </select>

              <div className="tabs">
                <button className={`tab ${semester === "2025H" ? "tabActive" : ""}`} onClick={() => setSemester("2025H")}>2025 Høst</button>
                <button className={`tab ${semester === "2026V" ? "tabActive" : ""}`} onClick={() => setSemester("2026V")}>2026 Vår</button>
                <button className={`tab ${semester === "all" ? "tabActive" : ""}`} onClick={() => setSemester("all")}>Total</button>
              </div>
            </div>
          </div>

          <div className="person__chart-area">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="var(--muted)" />
                <YAxis domain={['auto', 'auto']} stroke="var(--muted)" tickFormatter={(tick) => `${tick}s`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(18,26,51,0.95)", borderColor: "var(--border)", borderRadius: 8 }}
                  formatter={(v: unknown, name: unknown) => {
                    if (name === "trend") return [`${Number(v).toFixed(2)}s`, "Trend"];
                    if (name === "seconds" || name === "mainSeconds") return [`${Number(v).toFixed(2)}s`, p.name];
                    if (name === "compSeconds" && compareData) return [`${Number(v).toFixed(2)}s`, compareData.participant.name];
                    return [String(v), String(name)];
                  }}
                  labelFormatter={(label) => `Dato: ${label}`}
                />
                
                {compareData && <Legend verticalAlign="top" height={36} />}

                <Line 
                  name={p.name}
                  type="monotone" 
                  dataKey={compareData ? "mainSeconds" : "seconds"} 
                  stroke="var(--accent)" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "var(--accent)" }} 
                  activeDot={{ r: 6 }} 
                  connectNulls
                />
                
                {!compareData && (
                  <Line type="monotone" dataKey="trend" dot={false} stroke="var(--accent2)" strokeDasharray="5 5" strokeWidth={2} />
                )}

                {compareData && (
                  <Line 
                    name={compareData.participant.name}
                    type="monotone" 
                    dataKey="compSeconds" 
                    stroke="#f59e0b" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: "#f59e0b" }} 
                    activeDot={{ r: 6 }} 
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="hr" style={{ marginTop: 12, marginBottom: 12 }} />
          <div className="person__bottom-stats">
            {!compareData ? (
              <>
                <div>
                  <div className="person__bottom-stat-label">Endring siden start</div>
                  <div className="person__bottom-stat-value" style={{ color: changeSinceStart && changeSinceStart > 0 ? "var(--accent2)" : changeSinceStart && changeSinceStart < 0 ? "var(--danger)" : "var(--text)" }}>
                    {changeSinceStart == null ? "—" : changeSinceStart > 0 ? `Bedre (${changeSinceStart.toFixed(2)}s)` : `Tregere (${Math.abs(changeSinceStart).toFixed(2)}s)`}
                  </div>
                </div>
                <div>
                  <div className="person__bottom-stat-label">Snitt siste 3 forsøk</div>
                  <div className="person__bottom-stat-value">
                    {last3Avg == null ? "—" : `${last3Avg.toFixed(2)}s`}
                  </div>
                </div>
                <div>
                  <div className="person__bottom-stat-label">Projisert neste tid</div>
                  <div className="person__bottom-stat-value u-text-accent">
                    {projectedNext == null ? "—" : `${projectedNext.toFixed(2)}s`}
                  </div>
                </div>
                <div>
                  <div className="person__bottom-stat-label">Total chuggetid</div>
                  <div className="person__bottom-stat-value">
                    {totalTime > 0 ? `${totalTime.toFixed(1)}s` : "—"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="person__bottom-stat-label">Raskest i snitt (Totalt)</div>
                  <div className="person__bottom-stat-value">{headToHeadAvg}</div>
                </div>
                <div>
                  <div className="person__bottom-stat-label">Beste Clean Tid</div>
                  <div className="person__bottom-stat-value">{headToHeadBest}</div>
                </div>
                <div>
                  <div className="person__bottom-stat-label">Mest konsekvent</div>
                  <div className="person__bottom-stat-value">{headToHeadConsistency}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card u-mt-md">
        <h2>Historikk</h2>
        <div className="tableWrap">
          <table className="person__history-table">
            <thead>
              <tr>
                <th style={{ padding: 10, width: "120px" }}>Dato</th>
                <th style={{ padding: 10, width: "100px" }}>Tid</th>
                <th style={{ padding: 10 }}>Anmerkning</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map((pt, i) => {
                const isPB = !pt.note && bestClean !== null && pt.seconds === bestClean;
                return (
                  <tr key={`${pt.dateISO}-${i}`}>
                    <td style={{ padding: 10 }}>
                      <button 
                        className="btnGhost person__history-date-btn" 
                        onClick={() => nav(`/session/${pt.sessionId}`)}
                        title="Se detaljer for denne dagen"
                      >
                        {fmtDDMMYYYY(pt.dateISO)}
                      </button>
                    </td>
                    <td style={{ padding: 10 }} className={isPB ? "person__pb-cell" : ""}>
                      {pt.seconds.toFixed(2)}s {isPB && "🌟"}
                    </td>
                    <td style={{ padding: 10 }}>
                      {pt.note ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {pt.note.split(", ").map((code, idx) => (
                            <span
                              key={idx}
                              className="badge"
                              style={{
                                borderColor: RULE_COLORS[code.trim().toUpperCase()] || "var(--border)",
                                color: RULE_COLORS[code.trim().toUpperCase()] || "var(--danger)",
                              }}
                            >
                              {code.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.points.length && (
                <tr><td colSpan={3} className="u-text-muted u-text-center" style={{ padding: 20 }}>Ingen data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
