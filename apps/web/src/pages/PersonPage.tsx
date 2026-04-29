import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from "recharts";
import { apiFetch } from "../lib/api";
import { BadgeMedal } from "../components/BadgeMedal";
import { LoadingCard } from "../components/LoadingCard";

type Semester = "2026V" | "2025H" | "all";

// NYTT: Inkludert sessionId i typen
type Point = { sessionId: string; dateISO: string; seconds: number; note: string | null };
type Badge = { id: string; title: string; description: string; icon: string; category: string; earned: boolean };
type ProfileRanking = {
  bestCleanRank: number | null;
  violationCount: number;
  violationRank: number | null;
};
type BottomStat = {
  label: string;
  value: string;
  tone?: "better" | "worse" | "accent";
};
type Resp = {
  participant: { id: string; name: string; isRegular: boolean; imageUrl?: string | null };
  semester: string;
  points: Point[];
  stats: { attempts: number; best: number | null; avg: number | null; bestClean: number | null };
  profileRanking: ProfileRanking;
  badges: Badge[];
};

function fmtDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function ruleCodeClass(code: string) {
  return `person__note-code--${code.trim().toLowerCase()}`;
}

export function PersonPage() {
  const { id } = useParams();
  const nav = useNavigate(); // NYTT: For navigering
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<Resp | null>(null);
  
  const [participants, setParticipants] = useState<{id: string, name: string}[]>([]);
  const [compareId, setCompareId] = useState<string>("");
  const [compareData, setCompareData] = useState<Resp | null>(null);
  const chartAreaRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 240 });

  useEffect(() => {
    const element = chartAreaRef.current;
    if (!element) return;

    const updateSize = () => {
      const containerWidth = Math.floor(element.getBoundingClientRect().width);
      const viewportWidth = Math.max(0, Math.floor(window.innerWidth - 24));
      const width = Math.min(containerWidth, viewportWidth);
      if (width > 1) {
        const targetByWidth = Math.round(width * 0.52);
        const maxByViewport = Math.round(window.innerHeight * 0.46);
        const height = Math.max(240, Math.min(targetByWidth, maxByViewport, 420));
        setChartSize({ width, height });
      }
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);

    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [data]);

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
    const addData = (points: Point[], key: string, sessionKey: string) => {
      points.forEach(p => {
        const d = fmtDDMMYYYY(p.dateISO);
        if (!dateMap.has(d)) {
          dateMap.set(d, { dateISO: p.dateISO, date: d });
        }
        dateMap.get(d)[key] = p.seconds;
        dateMap.get(d)[sessionKey] = p.sessionId;
      });
    };
    addData(data.points, "mainSeconds", "mainSessionId");
    addData(compareData.points, "compSeconds", "compSessionId");

    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );
  }, [data, compareData]);

  if (!data) {
    return (
      <LoadingCard
        className="person__loading"
        title="Laster profil..."
        subtitle="Henter statistikk og historikk"
      />
    );
  }

  const p = data.participant;
  const bestClean = data.stats.bestClean;
  const profileRanking = data.profileRanking;
  const rankingQuery = new URLSearchParams({ semester });
  if (!p.isRegular) {
    rankingQuery.set("includeGuests", "1");
  }
  const leaderboardHref = `/leaderboard?${rankingQuery.toString()}`;
  const violationsHref = `/violations?${rankingQuery.toString()}`;

  let changeSinceStart = null;
  let last3Avg = null;
  let projectedNext = null;
  let trendPerAttempt = null;
  let medianTime = null;
  let timeSpread = null;
  let standardDeviation = null;
  let recentVsAverage = null;

  if (data.points.length > 0) {
    const pts = data.points;
    const sortedTimes = pts.map((pt) => pt.seconds).sort((left, right) => left - right);
    const medianIndex = Math.floor(sortedTimes.length / 2);

    medianTime = sortedTimes.length % 2 === 0
      ? (sortedTimes[medianIndex - 1] + sortedTimes[medianIndex]) / 2
      : sortedTimes[medianIndex];

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
      const mean = sumY / n;

      trendPerAttempt = m;
      timeSpread = sortedTimes[sortedTimes.length - 1] - sortedTimes[0];
      standardDeviation = Math.sqrt(
        pts.reduce((sum, pt) => sum + (pt.seconds - mean) ** 2, 0) / n
      );
      projectedNext = Math.max(0, m * n + b); 
    }
    const last3 = pts.slice(-3);
    last3Avg = last3.reduce((sum, pt) => sum + pt.seconds, 0) / last3.length;
    recentVsAverage = data.stats.avg == null ? null : data.stats.avg - last3Avg;
  }

  let headToHeadAvg = "Uavgjort / Mangler data";
  let headToHeadBest = "Uavgjort / Mangler data";
  let headToHeadConsistency = "Uavgjort / Mangler data";
  let headToHeadRecentForm = "Uavgjort / Mangler data";
  let headToHeadVolume = "Like mange";

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

    const compareLast3 = compareData.points.slice(-3);
    const compareLast3Avg = compareLast3.length
      ? compareLast3.reduce((sum, pt) => sum + pt.seconds, 0) / compareLast3.length
      : null;

    if (last3Avg != null && compareLast3Avg != null) {
      const diff = last3Avg - compareLast3Avg;
      if (diff < 0) headToHeadRecentForm = `${p.name} (-${Math.abs(diff).toFixed(2)}s)`;
      else if (diff > 0) headToHeadRecentForm = `${compareData.participant.name} (-${diff.toFixed(2)}s)`;
      else headToHeadRecentForm = "Lik form";
    }

    if (data.points.length !== compareData.points.length) {
      headToHeadVolume = data.points.length > compareData.points.length ? p.name : compareData.participant.name;
    } else if (!data.points.length && !compareData.points.length) {
      headToHeadVolume = "Mangler data";
    }
  }

    const performanceStats: BottomStat[] = [
      {
        label: "Endring siden start",
        value:
          changeSinceStart == null
            ? "—"
            : changeSinceStart > 0
              ? `Bedre (${changeSinceStart.toFixed(2)}s)`
              : changeSinceStart < 0
                ? `Tregere (${Math.abs(changeSinceStart).toFixed(2)}s)`
                : "Uendret",
        tone:
          changeSinceStart == null
            ? undefined
            : changeSinceStart > 0
              ? "better"
              : changeSinceStart < 0
                ? "worse"
                : undefined,
      },
      {
        label: "Snitt siste 3 forsøk",
        value: last3Avg == null ? "—" : `${last3Avg.toFixed(2)}s`,
      },
      {
        label: "Siste 3 mot snitt",
        value:
          recentVsAverage == null
            ? "—"
            : recentVsAverage > 0
              ? `${recentVsAverage.toFixed(2)}s raskere`
              : recentVsAverage < 0
                ? `${Math.abs(recentVsAverage).toFixed(2)}s tregere`
                : "Lik snittfart",
        tone:
          recentVsAverage == null
            ? undefined
            : recentVsAverage > 0
              ? "better"
              : recentVsAverage < 0
                ? "worse"
                : undefined,
      },
      {
        label: "Trend per forsøk",
        value:
          trendPerAttempt == null
            ? "—"
            : trendPerAttempt < 0
              ? `${Math.abs(trendPerAttempt).toFixed(2)}s raskere`
              : trendPerAttempt > 0
                ? `${trendPerAttempt.toFixed(2)}s tregere`
                : "Flat trend",
        tone:
          trendPerAttempt == null
            ? undefined
            : trendPerAttempt < 0
              ? "better"
              : trendPerAttempt > 0
                ? "worse"
                : undefined,
      },
      {
        label: "Median tid",
        value: medianTime == null ? "—" : `${medianTime.toFixed(2)}s`,
      },
      {
        label: "Standardavvik",
        value: standardDeviation == null ? "—" : `${standardDeviation.toFixed(2)}s`,
      },
      {
        label: "Spenn",
        value: timeSpread == null ? "—" : `${timeSpread.toFixed(2)}s`,
      },
      {
        label: "Projisert neste tid",
        value: projectedNext == null ? "—" : `${projectedNext.toFixed(2)}s`,
        tone: projectedNext == null ? undefined : "accent",
      },
    ];

    const comparisonStats: BottomStat[] = [
      {
        label: "Raskest i snitt (totalt)",
        value: headToHeadAvg,
      },
      {
        label: "Beste clean tid",
        value: headToHeadBest,
      },
      {
        label: "Form siste 3",
        value: headToHeadRecentForm,
      },
      {
        label: "Mest konsekvent",
        value: headToHeadConsistency,
      },
      {
        label: "Flest forsøk",
        value: headToHeadVolume,
      },
    ];

  return (
    <div>
      <div className="row person__top-row">
        
        <div className="col card person__profile-col">
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

          <div className="hr person__divider person__divider--tight" />

          <div className="person__stats-list">
            <h2 className="u-mb-0">Statistikk</h2>
            <div className="person__stats-panel">
              <div className="person__stat-row">
                <span className="u-text-muted person__stat-label">Antall forsøk</span>
                <div className="person__stat-content">
                  <b className="person__stat-value">{data.stats.attempts}</b>
                </div>
              </div>
              <div className="person__stat-row">
                <span className="u-text-muted person__stat-label">Beste tid</span>
                <div className="person__stat-content">
                  <b className="person__stat-value">
                    {data.stats.best == null ? "-" : `${data.stats.best.toFixed(2)}s`}
                  </b>
                  {profileRanking.bestCleanRank != null && (
                    <Link className="person__stat-link" to={leaderboardHref}>
                      #{profileRanking.bestCleanRank} raskest på topplista
                    </Link>
                  )}
                </div>
              </div>
              <div className="person__stat-row">
                <span className="u-text-muted person__stat-label">Gjennomsnitt</span>
                <div className="person__stat-content">
                  <b className="person__stat-value">
                    {data.stats.avg == null ? "-" : `${data.stats.avg.toFixed(2)}s`}
                  </b>
                </div>
              </div>
              <div className="person__stat-row">
                <span className="u-text-muted person__stat-label">Kryss</span>
                <div className="person__stat-content">
                  <b className="person__stat-value">{profileRanking.violationCount}</b>
                  {profileRanking.violationRank != null && (
                    <Link className="person__stat-link" to={violationsHref}>
                      #{profileRanking.violationRank} flest på krysslista
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col card person__chart-col">
          <div className="person__chart-header">
            <h2 className="u-mb-0">Utvikling</h2>
            
            <div className="person__chart-controls">
              <select 
                className="input person__compare-select"
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
              >
                <option value="">Sammenlign med...</option>
                {participants.map(pt => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>

              <div className="tabs">
                <button className={`tab ${semester === "2025H" ? "tabActive" : ""}`} onClick={() => setSemester("2025H")}>2025 Høst</button>
                <button className={`tab ${semester === "2026V" ? "tabActive" : ""}`} onClick={() => setSemester("2026V")}>2026 Vår</button>
                <button className={`tab ${semester === "all" ? "tabActive" : ""}`} onClick={() => setSemester("all")}>Total</button>
              </div>
            </div>
          </div>

          <div className="person__chart-area" ref={chartAreaRef}>
            {chartSize.width > 1 && (
              <LineChart
                width={chartSize.width}
                height={chartSize.height}
                data={chartData}
                margin={{ top: 16, right: 20, bottom: 26, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--text)"
                  tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                  tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                  minTickGap={16}
                  tickMargin={8}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  stroke="var(--text)"
                  tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                  tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                  width={56}
                  tickFormatter={(tick: any) => `${tick}s`}
                />
                <Tooltip
                  wrapperClassName="person__chart-tooltip"
                  formatter={(v: any, name: any) => {
                    if (name === "trend") return [`${Number(v).toFixed(2)}s`, "Trend"];
                    if (name === "seconds" || name === "mainSeconds") return [`${Number(v).toFixed(2)}s`, p.name];
                    if (name === "compSeconds" && compareData) return [`${Number(v).toFixed(2)}s`, compareData.participant.name];
                    return [String(v), String(name)];
                  }}
                  labelFormatter={(label: any) => `${label}`}
                />
                
                {compareData && <Legend verticalAlign="top" height={36} />}

                <Line
                  name={p.name}
                  type="monotone"
                  dataKey={compareData ? "mainSeconds" : "seconds"}
                  stroke="var(--accent)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "var(--accent)", cursor: "pointer" }}
                  activeDot={{ r: 6, cursor: "pointer", onClick: (_: any, payload: any) => { const sid = payload?.payload?.sessionId || payload?.payload?.mainSessionId; if (sid) nav(`/session/${sid}`); } }}
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
                    dot={{ r: 4, fill: "#f59e0b", cursor: "pointer" }}
                    activeDot={{ r: 6, cursor: "pointer", onClick: (_: any, payload: any) => { const sid = payload?.payload?.compSessionId; if (sid) nav(`/session/${sid}`); } }}
                    connectNulls
                  />
                )}
              </LineChart>
            )}
          </div>

          <div className="hr person__divider" />
          <div className="person__bottom-stats">
            {(compareData ? comparisonStats : performanceStats).map((stat) => {
              const toneClass =
                stat.tone === "better"
                  ? "person__bottom-stat-value--better"
                  : stat.tone === "worse"
                    ? "person__bottom-stat-value--worse"
                    : stat.tone === "accent"
                      ? "person__bottom-stat-value--accent"
                      : "";

              return (
                <article key={stat.label} className="person__bottom-stat-card">
                  <div className="person__bottom-stat-label">{stat.label}</div>
                  <div className={`person__bottom-stat-value ${toneClass}`}>{stat.value}</div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className="person__lower-row">
        <div className="card person__lower-col--badges">
          <h2>Badges</h2>
          <p className="u-text-muted person__badge-summary">
            {(data.badges ?? []).filter(b => b.earned).length} / {(data.badges ?? []).length} oppnådd
          </p>
          <div className="person__badges-grid">
            {(data.badges ?? []).map(badge => (
              <div
                key={badge.id}
                className={`person__badge ${badge.earned ? 'person__badge--earned' : 'person__badge--locked'}`}
                data-category={badge.category}
                data-tooltip={badge.description}
              >
                <BadgeMedal badgeId={badge.id} category={badge.category} icon={badge.icon} />
                <div className="person__badge-title">{badge.title}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card person__lower-col--history">
          <h2>Historikk</h2>
        <div className="tableWrap">
          <table className="person__history-table">
            <thead>
              <tr>
                <th className="person__history-th person__history-th--date">Dato</th>
                <th className="person__history-th person__history-th--time">Tid</th>
                <th className="person__history-th">Anmerkning</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map((pt, i) => {
                const isPB = bestClean !== null && pt.seconds === bestClean;
                return (
                  <tr key={`${pt.dateISO}-${i}`}>
                    <td className="person__history-cell">
                      <button 
                        className="btnGhost person__history-date-btn" 
                        onClick={() => nav(`/session/${pt.sessionId}`)}
                        title="Se detaljer for denne dagen"
                      >
                        {fmtDDMMYYYY(pt.dateISO)}
                      </button>
                    </td>
                    <td className={`person__history-cell ${isPB ? "person__pb-cell" : ""}`}>
                      {pt.seconds.toFixed(2)}s {isPB && "🌟"}
                    </td>
                    <td className="person__history-cell">
                      {pt.note ? (
                        <div className="person__history-note-list">
                          {pt.note.split(", ").map((code, idx) => (
                            <span
                              key={idx}
                              className={`badge person__note-code ${ruleCodeClass(code)}`}
                            >
                              {code.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="u-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.points.length && (
                <tr><td colSpan={3} className="u-text-muted u-text-center person__history-empty">Ingen data</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}
