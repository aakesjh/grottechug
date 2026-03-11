import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, Cell, Legend
} from "recharts";
import { apiFetch } from "../lib/api";

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

type ViolationEntry = {
  participantId: string;
  ruleCode: string;
  dateISO: string;
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

  const [showScatterGuests, setShowScatterGuests] = useState(false);
  const [violations, setViolations] = useState<ViolationEntry[]>([]);

  useEffect(() => {
    (async () => {
      const [resA, resT, resV] = await Promise.all([
        apiFetch(`/api/analytics?semester=${semester}`),
        apiFetch(`/api/stats/table?semester=${semester}`),
        apiFetch(`/api/violations?semester=${semester}`)
      ]);
      setData(await resA.json());
      setTableData(await resT.json());
      setViolations(await resV.json());
    })();
  }, [semester]);

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

  const timeSeriesData = useMemo(() => {
    const base = data?.timeSeries.map(x => {
      // INKLUDERER P og T I WET-RATE
      const wetCount = violations.filter(
        v => v.dateISO.slice(0, 10) === x.dateISO.slice(0, 10) &&
          ["W", "VW", "MM", "P", "T"].includes(v.ruleCode)
      ).length;
      return {
        ...x,
        dateFormatted: fmtDate(x.dateISO),
        wetPct: x.attempts > 0 ? (wetCount / x.attempts) * 100 : 0,
      };
    }) || [];

    if (!tableData) return base;

    return base.map(day => {
      const col = tableData.columns.find(c => c.dateISO === day.dateISO);
      
      let fastestTime = Infinity;
      let fastestPerson = "";
      let slowestTime = -Infinity;
      let slowestPerson = "";

      if (col) {
        tableData.rows.forEach(r => {
          const cell = tableData.cells[r.participantId]?.[col.sessionId];
          if (cell && cell.seconds != null) {
            if (cell.seconds < fastestTime) {
              fastestTime = cell.seconds;
              fastestPerson = r.name;
            }
            if (cell.seconds > slowestTime) {
              slowestTime = cell.seconds;
              slowestPerson = r.name;
            }
          }
        });
      }

      return {
        ...day,
        fastestTime: fastestTime !== Infinity ? fastestTime : null,
        fastestPerson,
        slowestTime: slowestTime !== -Infinity ? slowestTime : null,
        slowestPerson
      };
    });
  }, [data, tableData, violations]);

  const VIOLATION_BAR_COLORS: Record<string, string> = {
    MM: "#10b981", W: "#3b82f6", VW: "#6366f1", P: "#ef4444", T: "#14b8a6",
    DNS: "#f59e0b", DNF: "#f97316", VOMIT: "#ec4899", KPR: "#8b5cf6",
    ABSENCE: "#94a3b8"
  };
  const VIOLATION_BAR_LABELS: Record<string, string> = {
    MM: "MM", W: "Wet (W)", VW: "Very Wet (VW)", P: "Pause (P)", T: "Tobias-chug (T)",
    DNS: "DNS", DNF: "DNF", VOMIT: "Oppkast", KPR: "KPR", ABSENCE: "Fravær"
  };
  const violationCounts: Record<string, number> = {};
  violations.forEach(v => {
    violationCounts[v.ruleCode] = (violationCounts[v.ruleCode] || 0) + 1;
  });
  const noteBars = Object.entries(violationCounts)
    .filter(([_, count]) => count > 0)
    .map(([code, count]) => ({
      type: code,
      label: VIOLATION_BAR_LABELS[code] || code,
      count,
      color: VIOLATION_BAR_COLORS[code] || "#888"
    }))
    .sort((a, b) => b.count - a.count);

  const overallWetRate = useMemo(() => {
    if (!data?.overview?.attempts) return 0;
    const wetCount = violations.filter(v => ["W", "VW", "MM", "P", "T"].includes(v.ruleCode)).length;
    return (wetCount / data.overview.attempts) * 100;
  }, [violations, data]);

  const chugsPerSession = data?.overview.sessions ? (data.overview.attempts / data.overview.sessions) : 0;

  const validParticipants = participantStats.filter(p => p.attempts > 0 && p.avg !== null);
  const hasParticipantStats = validParticipants.length > 0;
  
  const qualifiedForAwards = validParticipants.filter(p => p.attempts >= 3);
  
  const slowestPerson = qualifiedForAwards.length > 0 
    ? qualifiedForAwards.reduce((prev, current) => ((current.avg || 0) > (prev.avg || 0) ? current : prev))
    : null;

  const fastestPerson = qualifiedForAwards.length > 0
    ? qualifiedForAwards.reduce((prev, current) => ((current.avg || Infinity) < (prev.avg || Infinity) ? current : prev))
    : null;

  const scatterData = validParticipants
    .filter(p => p.isRegular || (showScatterGuests && !p.isRegular && p.attempts >= 3))
    .map(p => ({
      name: p.name,
      attempts: p.attempts,
      avg: Number(p.avg?.toFixed(2)),
      isRegular: p.isRegular
    }));

  const noteRateData = validParticipants
    .filter(p => p.attempts >= 3)
    .map(p => {
      const vCount = violations.filter(
        v => v.participantId === p.participantId && v.ruleCode !== "ABSENCE"
      ).length;
      return { name: p.name, notePct: (vCount / p.attempts) * 100 };
    })
    .sort((a, b) => b.notePct - a.notePct)
    .slice(0, 5);

  const lowestWetRateData = useMemo(() => {
    return validParticipants
      .filter(p => p.attempts >= 5)
      .map(p => {
        const wetCount = violations.filter(
          v => v.participantId === p.participantId && ["W", "VW", "MM", "P", "T"].includes(v.ruleCode)
        ).length;
        return { name: p.name, wetPct: (wetCount / p.attempts) * 100 };
      })
      .sort((a, b) => a.wetPct - b.wetPct)
      .slice(0, 5);
  }, [validParticipants, violations]);

  const improvementData = useMemo(() => {
    if (!tableData) return [];
    
    const sortedCols = [...tableData.columns].sort((a, b) => 
      new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );

    const improvements = tableData.rows.map(r => {
      const times: number[] = [];
      sortedCols.forEach(col => {
        const cell = tableData.cells[r.participantId]?.[col.sessionId];
        if (cell && cell.seconds != null) {
          times.push(cell.seconds);
        }
      });

      if (times.length < 4) return null;

      const firstTwoAvg = (times[0] + times[1]) / 2;
      const lastTwoAvg = (times[times.length - 1] + times[times.length - 2]) / 2;
      
      const improvementPct = ((firstTwoAvg - lastTwoAvg) / firstTwoAvg) * 100;

      return {
        name: r.name,
        improvementPct,
        firstAvg: firstTwoAvg,
        lastAvg: lastTwoAvg,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    return improvements.sort((a, b) => b.improvementPct - a.improvementPct).slice(0, 5);
  }, [tableData]);

  // --- TOOLTIPS ---
  const CustomTimeSeriesTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip" style={{ minWidth: 200 }}>
          <strong className="chart-tooltip__title">{label}</strong>
          <div className="chart-tooltip__row">
            <span className="u-text-muted">Gjennomsnitt:</span>
            <strong className="u-text-accent">{data.avg?.toFixed(2)}s</strong>
          </div>
          {data.fastestPerson && (
             <div className="chart-tooltip__row">
               <span className="u-text-muted">Raskest:</span>
               <span className="u-text-right">
                 <strong style={{ color: getColor(data.fastestPerson) }}>{data.fastestPerson}</strong> ({data.fastestTime?.toFixed(2)}s)
               </span>
             </div>
          )}
          {data.slowestPerson && (
             <div className="chart-tooltip__row">
               <span className="u-text-muted">Tregest:</span>
               <span className="u-text-right">
                 <strong style={{ color: getColor(data.slowestPerson) }}>{data.slowestPerson}</strong> ({data.slowestTime?.toFixed(2)}s)
               </span>
             </div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomActivityTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <div className="u-text-muted u-mb-xs">Dato: {label}</div>
          <div className="u-text-bold">Antall chugs: {payload[0].value}</div>
        </div>
      );
    }
    return null;
  };

  const CustomNoteTypesTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const fullLabel = noteBars.find((n: any) => n.type === label)?.label;
      return (
        <div className="chart-tooltip">
          <div className="u-text-muted u-mb-xs">{fullLabel || label}</div>
          <div className="u-text-bold">Antall: {payload[0].value}</div>
        </div>
      );
    }
    return null;
  };

  const CustomPunishmentTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <div className="u-text-muted u-mb-xs">{label}</div>
          <div className="u-text-bold">Straffeprosent: {payload[0].value.toFixed(1)}%</div>
        </div>
      );
    }
    return null;
  };

  const CustomWetRateTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <div className="u-text-muted u-mb-xs">{label}</div>
          <div className="u-text-bold">Wet-rate: {payload[0].value.toFixed(1)}%</div>
        </div>
      );
    }
    return null;
  };

  const CustomImprovementTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <div style={{ marginBottom: 6, color: getColor(label), fontWeight: "bold", fontSize: "1.1rem" }}>{label}</div>
          <div className="u-text-bold" style={{ marginBottom: 8 }}>
            Forbedring: <span style={{ color: data.improvementPct > 0 ? "#10b981" : "#ef4444" }}>{data.improvementPct > 0 ? "+" : ""}{data.improvementPct.toFixed(1)}%</span>
          </div>
          <div className="chart-tooltip__row u-text-muted u-text-sm">
            <span>Snitt 2 første:</span> <span>{data.firstAvg.toFixed(2)}s</span>
          </div>
          <div className="chart-tooltip__row u-text-muted u-text-sm">
            <span>Snitt 2 siste:</span> <span>{data.lastAvg.toFixed(2)}s</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <h1>Dashbord & Statistikk</h1>
      <p>Diverse nyttige og unyttige statistikker.</p>

      <div className="tabs u-mt-sm u-mb-md">
        <button className={`tab ${semester === "2025H" ? "tabActive" : ""}`} onClick={() => setSemester("2025H")}>2025 Høst</button>
        <button className={`tab ${semester === "2026V" ? "tabActive" : ""}`} onClick={() => setSemester("2026V")}>2026 Vår</button>
        <button className={`tab ${semester === "all" ? "tabActive" : ""}`} onClick={() => setSemester("all")}>Total</button>
      </div>

      {!data || !tableData ? (
        <div className="card u-text-center u-p-xl">Laster statistikk...</div>
      ) : (
        <>
          {/* DE STATS-BOKSENE ØVERST */}
          <div className="stats__stat-grid">
            <div className="card stat-box">
              <div className="stat-box__label">Totale Chugs</div>
              <div className="stat-box__value">{data.overview.attempts}</div>
            </div>
            <div className="card stat-box">
              <div className="stat-box__label">Aktive Dager</div>
              <div className="stat-box__value">{data.overview.sessions}</div>
            </div>
            <div className="card stat-box">
              <div className="stat-box__label">Snitt per dag</div>
              <div className="stat-box__value">{chugsPerSession.toFixed(1)}</div>
            </div>
            <div className="card stat-box">
              <div className="stat-box__label">Total Wet-Rate</div>
              <div className="stat-box__value" style={{ color: overallWetRate > 20 ? "var(--danger)" : "var(--accent2)" }}>
                {overallWetRate.toFixed(1)}%
              </div>
            </div>
            
            {fastestPerson && (
              <div className="card stat-box stat-box--fastest">
                <div className="stat-box__label">⚡ Raskest i snitt</div>
                <div className="stat-box__name">{fastestPerson.name}</div>
                <div className="stat-box__sub-value">{fastestPerson.avg?.toFixed(2)}s</div>
              </div>
            )}

            {slowestPerson && (
              <div className="card stat-box stat-box--slowest">
                <div className="stat-box__label">🐢 Tregest i snitt</div>
                <div className="stat-box__name">{slowestPerson.name}</div>
                <div className="stat-box__sub-value">{slowestPerson.avg?.toFixed(2)}s</div>
              </div>
            )}
          </div>

          {/* RAD 1: Tid og Kvantitet vs Kvalitet */}
          <div className="row u-mt-sm" style={{ flexWrap: "wrap" }}>
            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Raskest/snitt/treigest per dag</h2>
              <div className="stats__chart-area">
                <ResponsiveContainer>
                  <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="dateFormatted" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}s`} domain={['auto', 'auto']} />
                    
                    <Tooltip content={<CustomTimeSeriesTooltip />} />
                    <Legend verticalAlign="top" height={36} />

                    <Line type="monotone" dataKey="fastestTime" name="Raskeste tid" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} connectNulls />
                    <Line type="monotone" dataKey="avg" name="Snitt-tid" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="slowestTime" name="Tregeste tid" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Kvantitet vs Kvalitet</h2>
              
              <div className="stats__scatter-header">
                <div className="stats__chart-desc" style={{ marginBottom: 0 }}>
                  Nederst til høyre = Mange forsøk og rask.
                </div>
                
                <label className="stats__scatter-toggle">
                  <input
                    type="checkbox"
                    checked={showScatterGuests}
                    onChange={e => setShowScatterGuests(e.target.checked)}
                  />
                  Gjester (≥ 3 chugs)
                </label>
              </div>

              <div className="stats__chart-area--sm">
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
                              <div className="chart-tooltip">
                                <strong style={{ display: "block", marginBottom: 4, color: getColor(p.name) }}>
                                  {p.name} {!p.isRegular && <span style={{ opacity: 0.7, fontSize: "0.8em" }}>(gjest)</span>}
                                </strong>
                                <div>Antall chugs: {p.attempts}</div>
                                <div>Snitt-tid: {p.avg}s</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter data={scatterData}>
                        {scatterData.map((entry, index) => (
                          <Cell key={`scatter-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">Ingen data tilgjengelig</div>
                )}
              </div>
            </div>
          </div>

          {/* RAD 2: Wet-rate og Anmerkninger */}
          <div className="row u-mt-sm" style={{ flexWrap: "wrap" }}>
            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Søle-prosent (Wet-rate) per dag</h2>
              <div className="stats__chart-desc">Basert på MM, W, VW, P og T-kryss.</div>
              <div className="stats__chart-area">
                <ResponsiveContainer>
                  <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="dateFormatted" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}%`} />
                    <Tooltip 
                      labelFormatter={(label) => `Dato: ${label}`}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, "Wet-rate"]}
                      contentStyle={{ backgroundColor: "rgba(18,26,51,0.95)", borderColor: "var(--border)", borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="wetPct" stroke="#0ea5e9" fill="rgba(14, 165, 233, 0.3)" strokeWidth={3} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Anmerkningstyper Totalt</h2>
              <div className="stats__chart-desc">Fordeling av alle registrerte anmerkninger.</div>
              <div className="stats__chart-area">
                <ResponsiveContainer>
                  <BarChart data={noteBars} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="type" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" allowDecimals={false} />
                    <Tooltip content={<CustomNoteTypesTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
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

          {/* RAD 3: Forbedring og Aktivitet (Her ble Forbedring byttet inn) */}
          <div className="row u-mt-sm" style={{ flexWrap: "wrap" }}>
            
            {/* Prosentvis forbedring */}
            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Største Forbedring (%)</h2>
              <div className="stats__chart-desc">Snitt av to første chugs vs to siste (krever ≥ 4 chugs).</div>
              <div className="stats__chart-area--sm">
                {improvementData.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={improvementData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" stroke="var(--muted)" />
                      <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}%`} />
                      <Tooltip content={<CustomImprovementTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                      <Bar dataKey="improvementPct" radius={[4, 4, 0, 0]}>
                        {improvementData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">
                    Ikke nok data.<br/>(Trenger deltakere med ≥ 4 chugs)
                  </div>
                )}
              </div>
            </div>

            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Aktivitet per dag</h2>
              <div className="stats__chart-desc">Totalt antall chugs registrert hver dato.</div>
              <div className="stats__chart-area--sm">
                <ResponsiveContainer>
                  <BarChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="dateFormatted" stroke="var(--muted)" />
                    <YAxis stroke="var(--muted)" allowDecimals={false} />
                    <Tooltip content={<CustomActivityTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                    <Bar dataKey="attempts" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* RAD 4: Lavest Wet-rate og Syndebukker (Her ble Syndebukkene byttet inn) */}
          <div className="row u-mt-sm u-mb-xl" style={{ flexWrap: "wrap" }}>
            
            {/* Lavest Wet-Rate */}
            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Mest kontroll på chuggen (lavest wet-rate)</h2>
              <div className="stats__chart-desc">Krever minst 5 registrerte chugs for å kvalifisere.</div>
              <div className="stats__chart-area--sm">
                {lowestWetRateData.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={lowestWetRateData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" stroke="var(--muted)" />
                      <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}%`} />
                      <Tooltip content={<CustomWetRateTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                      <Bar dataKey="wetPct" radius={[4, 4, 0, 0]}>
                        {lowestWetRateData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">
                    Ikke nok data.<br/>(Trenger deltakere med ≥ 5 chugs)
                  </div>
                )}
              </div>
            </div>

            {/* Syndebukkene */}
            <div className="col card" style={{ flex: "1 1 400px" }}>
              <h2>Syndebukkene (høyest wet-rate)</h2>
              <div className="stats__chart-desc">Andel runder som får en anmerkning (min. 3 forsøk).</div>
              <div className="stats__chart-area--sm">
                {hasParticipantStats ? (
                  <ResponsiveContainer>
                    <BarChart data={noteRateData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" stroke="var(--muted)" />
                      <YAxis stroke="var(--muted)" tickFormatter={(tick) => `${tick}%`} />
                      <Tooltip content={<CustomPunishmentTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                      <Bar dataKey="notePct" radius={[4, 4, 0, 0]}>
                        {noteRateData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">Ingen data tilgjengelig</div>
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
