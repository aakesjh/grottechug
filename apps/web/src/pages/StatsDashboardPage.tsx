import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, Cell
} from "recharts";

type Semester = "all" | "2026V" | "2025H";

// Typer for Analytics-API
type AnalyticsResp = {
  semester: string;
  overview: { sessions: number; attempts: number };
  timeSeries: Array<{ dateISO: string; avg: number | null; attempts: number; wetRate: number }>;
  noteBreakdown: Record<string, number | undefined>;
};

// Typer for Table-API
type SessionCol = { sessionId: string; dateISO: string };
type TableCell = { seconds: number | null; note: string | null };
type Row = {
  participantId: string;
  name: string;
  isRegular: boolean;
  bestOverall: number | null;
  avgOverall: number | null;
};
type TableResponse = {
  semester: string;
  columns: SessionCol[];
  rows: Row[];
  cells: Record<string, Record<string, TableCell>>;
};

type ParticipantStat = {
  participantId: string;
  name: string;
  isRegular: boolean;
  attempts: number;
  avg: number | null;
  noteCount: number;
};

function fmtDate(isoOrDate: string) {
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return isoOrDate;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

// --- FARGE-GENERATOR FOR NAVN ---
// Gir hver person en fast farge basert på navnet deres
const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899"
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function StatsDashboardPage() {
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [tableData, setTableData] = useState<TableResponse | null>(null);

  useEffect(() => {
    (async () => {
      const [resA, resT] = await Promise.all([
        fetch(`/api/analytics?semester=${semester}`),
        fetch(`/api/stats/table?semester=${semester}`)
      ]);
      setData(await resA.json());
      setTableData(await resT.json());
    })();
  }, [semester]);

  // --- FRONTEND-BEREGNINGER BASERT PÅ TABELL-DATA ---
  const participantStats: ParticipantStat[] = useMemo(() => {
    if (!tableData) return [];
    
    return tableData.rows.map(r => {
      let attempts = 0;
      let noteCount = 0;
      
      const pCells = tableData.cells[r.participantId] || {};
      
      Object.values(pCells).forEach(c => {
        if (c.seconds != null) attempts++;
        if (c.note) noteCount++;
      });

      return {
        participantId: r.participantId,
        name: r.name,
        isRegular: r.isRegular,
        attempts,
        avg: r.avgOverall,
        noteCount
      };
    });
  }, [tableData]);

  // Formater timeSeries
  const timeSeriesData = data?.timeSeries.map(x => ({
    ...x,
    dateFormatted: fmtDate(x.dateISO),
    wetPct: x.wetRate * 100
  })) || [];

  // --- Håndter case-insensitive anmerkninger ---
  const normNotes: Record<string, number> = {};
  if (data?.noteBreakdown) {
    Object.entries(data.noteBreakdown).forEach(([k, v]) => {
      if (v) {
        const lowerKey = k.toLowerCase();
        normNotes[lowerKey] = (normNotes[lowerKey] || 0) + v;
      }
    });
  }

  // Definer farger og hent verdier med nye navn
  const noteBars = [
    { type: "mm", label: "Mildly Moist (mm)", count: normNotes["mm"] || 0, color: "#10b981" },
    { type: "p-chug", label: "P-Chug", count: normNotes["p-chug"] || 0, color: "#f59e0b" },
    { type: "w", label: "Wet (w)", count: normNotes["w"] || 0, color: "#3b82f6" },
    { type: "vw", label: "Very Wet (vw)", count: normNotes["vw"] || 0, color: "#6366f1" },
    { type: "ww", label: "Wasted (ww)", count: normNotes["ww"] || 0, color: "#8b5cf6" },
    { type: "tobias-chug", label: "Tobias-Chug", count: normNotes["tobias-chug"] || 0, color: "#ec4899" },
    { type: "p", label: "Pause (p)", count: normNotes["p"] || 0, color: "#ef4444" }
  ].filter(n => n.count > 0);

  // --- Kalkuleringer for dashbord-bokser ---
  const overallWetRate = useMemo(() => {
    if (!data?.timeSeries?.length) return 0;
    const totalAttempts = data.timeSeries.reduce((s, d) => s + (d.attempts || 0), 0);
    const wetAttempts = data.timeSeries.reduce((s, d) => s + (d.wetRate || 0) * (d.attempts || 0), 0);
    return totalAttempts ? (wetAttempts / totalAttempts) * 100 : 0;
  }, [data]);
  const chugsPerSession = data?.overview.sessions ? (data.overview.attempts / data.overview.sessions) : 0;

  // Analyser personstatistikk for beste/dårligste snitt
  const validParticipants = participantStats.filter(p => p.attempts > 0 && p.avg !== null);
  const hasParticipantStats = validParticipants.length > 0;
  
  const qualifiedForAwards = validParticipants.filter(p => p.attempts >= 3);
  
  // Finner dårligste (tregest)
  const slowestPerson = qualifiedForAwards.length > 0 
    ? qualifiedForAwards.reduce((prev, current) => ((current.avg || 0) > (prev.avg || 0) ? current : prev))
    : null;

  // Finner raskeste i snitt
  const fastestPerson = qualifiedForAwards.length > 0
    ? qualifiedForAwards.reduce((prev, current) => ((current.avg || Infinity) < (prev.avg || Infinity) ? current : prev))
    : null;

  // ScatterData: Kun faste deltakere!
  const scatterData = validParticipants
    .filter(p => p.isRegular)
    .map(p => ({
      name: p.name,
      attempts: p.attempts,
      avg: Number(p.avg?.toFixed(2))
    }));

  const noteRateData = validParticipants
    .filter(p => p.attempts >= 3)
    .map(p => ({
      name: p.name,
      notePct: (p.noteCount / p.attempts) * 100
    }))
    .sort((a, b) => b.notePct - a.notePct)
    .slice(0, 5);

  return (
    <div>
      <h1>Dashbord & Statistikk</h1>
      <p>Dypdykk i tallene bak prestasjonene.</p>

      <div className="tabs" style={{ marginTop: 10, marginBottom: 20 }}>
        <button className={`tab ${semester === "2025H" ? "tabActive" : ""}`} onClick={() => setSemester("2025H")}>2025 Høst</button>
        <button className={`tab ${semester === "2026V" ? "tabActive" : ""}`} onClick={() => setSemester("2026V")}>2026 Vår</button>
        <button className={`tab ${semester === "all" ? "tabActive" : ""}`} onClick={() => setSemester("all")}>Total</button>
      </div>

      {!data || !tableData ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>Laster statistikk...</div>
      ) : (
        <>
          {/* DE STATS-BOKSENE ØVERST */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
            gap: 14, 
            marginBottom: 20 
          }}>
            <div className="card" style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>Totale Chugs</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>{data.overview.attempts}</div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>Aktive Dager</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>{data.overview.sessions}</div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>Snitt per dag</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>{chugsPerSession.toFixed(1)}</div>
            </div>
            <div className="card" style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }}>Total Wet-Rate</div>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: overallWetRate > 20 ? "var(--danger)" : "var(--accent2)", lineHeight: 1 }}>
                {overallWetRate.toFixed(1)}%
              </div>
            </div>
            
            {/* Raskeste person (Lynet) */}
            {fastestPerson && (
              <div className="card" style={{ textAlign: "center", padding: "20px 10px", border: "1px solid color-mix(in srgb, #10b981 40%, transparent)" }}>
                <div style={{ fontSize: "0.85rem", color: "#10b981", marginBottom: 6 }}>⚡ Raskest i snitt</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fastestPerson.name}
                </div>
                <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{fastestPerson.avg?.toFixed(2)}s</div>
              </div>
            )}

            {/* Skilpadden (Dårligst snitt) */}
            {slowestPerson && (
              <div className="card" style={{ textAlign: "center", padding: "20px 10px", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)" }}>
                <div style={{ fontSize: "0.85rem", color: "var(--danger)", marginBottom: 6 }}>🐢 Tregest i snitt</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {slowestPerson.name}
                </div>
                <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{slowestPerson.avg?.toFixed(2)}s</div>
              </div>
            )}
          </div>

          {/* RAD 1: Tid og Aktivitet */}
          <div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Gjennomsnittstid per dag</h2>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="dateFormatted" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}s`} domain={['auto', 'auto']} />
                    <Tooltip 
                      labelFormatter={(label) => `Dato: ${label}`}
                      formatter={(v: number) => [`${v.toFixed(2)}s`, "Snitt-tid"]}
                      contentStyle={{ backgroundColor: "rgba(18,26,51,0.95)", borderColor: "var(--border)", borderRadius: 8 }}
                    />
                    <Line type="monotone" dataKey="avg" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Kvantitet vs Kvalitet</h2>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>Kun faste. Nederst til høyre = Mange forsøk og veldig rask.</div>
              <div style={{ width: "100%", height: 280 }}>
                {hasParticipantStats ? (
                  <ResponsiveContainer>
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis type="number" dataKey="attempts" name="Forsøk" stroke="var(--muted)" allowDecimals={false} />
                      <YAxis type="number" dataKey="avg" name="Snitt-tid" unit="s" stroke="var(--muted)" domain={['auto', 'auto']} />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div style={{ background: "rgba(18,26,51,0.95)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)", color: "white" }}>
                                <strong style={{ display: "block", marginBottom: 4, color: getColor(p.name) }}>{p.name}</strong>
                                <div>Antall chugs: {p.attempts}</div>
                                <div>Snitt-tid: {p.avg}s</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {/* Endring: Scatter har nå Cell-komponenter for individuelle farger */}
                      <Scatter data={scatterData}>
                        {scatterData.map((entry, index) => (
                          <Cell key={`scatter-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)" }}>Ingen data tilgjengelig</div>
                )}
              </div>
            </div>
          </div>

          {/* RAD 2: Wet-rate og Anmerkninger */}
          <div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Søle-prosent (Wet-rate) per dag</h2>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>Inkluderer kun w, vw og ww.</div>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="dateFormatted" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}%`} />
                    <Tooltip 
                      labelFormatter={(label) => `Dato: ${label}`}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, "Wet-rate"]}
                      contentStyle={{ backgroundColor: "rgba(18,26,51,0.95)", borderColor: "var(--border)", borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="wetPct" stroke="#0ea5e9" fill="rgba(14, 165, 233, 0.3)" strokeWidth={3} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Anmerkningstyper Totalt</h2>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>Fordeling av alle registrerte anmerkninger.</div>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={noteBars} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="type" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" allowDecimals={false} />
                    <Tooltip 
                      labelFormatter={(label) => {
                        const fullLabel = noteBars.find(n => n.type === label)?.label;
                        return fullLabel || label;
                      }}
                      formatter={(v: number) => [v, "Antall"]}
                      contentStyle={{ backgroundColor: "rgba(18,26,51,0.95)", borderColor: "var(--border)", borderRadius: 8 }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {noteBars.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* RAD 3: Straffeprosent og Aktivitet */}
          <div className="row" style={{ marginTop: 14, flexWrap: "wrap", marginBottom: 40 }}>
             <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Syndebukkene (Høyest straffe-%)</h2>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>Andel runder som får en anmerkning (min. 3 forsøk).</div>
              <div style={{ width: "100%", height: 280 }}>
                {hasParticipantStats ? (
                  <ResponsiveContainer>
                    <BarChart data={noteRateData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" stroke="var(--muted)" />
                      <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}%`} />
                      <Tooltip 
                        formatter={(v: number) => [`${v.toFixed(1)}%`, "Straffeprosent"]}
                        contentStyle={{ backgroundColor: "rgba(18,26,51,0.95)", borderColor: "var(--border)", borderRadius: 8 }}
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      />
                      {/* Endring: Bar har nå Cell-komponenter for individuelle farger */}
                      <Bar dataKey="notePct" radius={[4, 4, 0, 0]}>
                        {noteRateData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--muted)" }}>Ingen data tilgjengelig</div>
                )}
              </div>
            </div>

            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Aktivitet per dag</h2>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 10 }}>Totalt antall chugs registrert hver dato.</div>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="dateFormatted" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" allowDecimals={false} />
                    <Tooltip 
                      labelFormatter={(label) => `Dato: ${label}`}
                      formatter={(v: number) => [v, "Antall chugs"]}
                      contentStyle={{ backgroundColor: "rgba(18,26,51,0.95)", borderColor: "var(--border)", borderRadius: 8 }}
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    />
                    <Bar dataKey="attempts" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}