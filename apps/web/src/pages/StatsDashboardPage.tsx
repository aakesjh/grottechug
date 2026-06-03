import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, Cell, Legend
} from "recharts";
import { apiFetch } from "../lib/api";
import { LoadingCard } from "../components/LoadingCard";

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
  sessionId: string;
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
  const navigate = useNavigate();
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<AnalyticsResp | null>(null);
  const [tableData, setTableData] = useState<TableResponse | null>(null);

  const [includeGuests, setIncludeGuests] = useState(false);
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
        sessionId: col?.sessionId ?? null,
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

  const validParticipants = participantStats.filter(
    p => p.attempts > 0 && p.avg !== null && (includeGuests || p.isRegular)
  );
  const hasParticipantStats = validParticipants.length > 0;

  const overallAverageTime = useMemo(() => {
    const totals = validParticipants.reduce(
      (acc, participant) => ({
        attempts: acc.attempts + participant.attempts,
        seconds: acc.seconds + (participant.avg ?? 0) * participant.attempts,
      }),
      { attempts: 0, seconds: 0 }
    );

    return totals.attempts > 0 ? totals.seconds / totals.attempts : null;
  }, [validParticipants]);
  
  const qualifiedForAwards = validParticipants.filter(p => p.attempts >= 6);
  
  const slowestPerson = qualifiedForAwards.length > 0 
    ? qualifiedForAwards.reduce((prev, current) => ((current.avg || 0) > (prev.avg || 0) ? current : prev))
    : null;

  const scatterData = validParticipants
    .filter(p => p.isRegular || p.attempts >= 3)
    .map(p => ({
      participantId: p.participantId,
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
      return { participantId: p.participantId, name: p.name, notePct: (vCount / p.attempts) * 100 };
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
        return { participantId: p.participantId, name: p.name, wetPct: (wetCount / p.attempts) * 100 };
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
        participantId: r.participantId,
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
        <div className="chart-tooltip stats__chart-tooltip">
          <strong className="chart-tooltip__title">{label}</strong>
          <div className="chart-tooltip__row">
            <span className="u-text-muted">Gjennomsnitt:</span>
            <strong className="u-text-accent">{data.avg?.toFixed(2)}s</strong>
          </div>
          {data.fastestPerson && (
             <div className="chart-tooltip__row">
               <span className="u-text-muted">Raskest:</span>
               <span className="u-text-right">
                 <strong className="stats__tooltip-person">{data.fastestPerson}</strong> ({data.fastestTime?.toFixed(2)}s)
               </span>
             </div>
          )}
          {data.slowestPerson && (
             <div className="chart-tooltip__row">
               <span className="u-text-muted">Tregest:</span>
               <span className="u-text-right">
                 <strong className="stats__tooltip-person">{data.slowestPerson}</strong> ({data.slowestTime?.toFixed(2)}s)
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
      const improvementClass = data.improvementPct > 0
        ? "stats__improvement-value--positive"
        : "stats__improvement-value--negative";
      return (
        <div className="chart-tooltip">
          <div className="stats__improvement-name">{label}</div>
          <div className="u-text-bold stats__improvement-row">
            Forbedring: <span className={improvementClass}>{data.improvementPct > 0 ? "+" : ""}{data.improvementPct.toFixed(1)}%</span>
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

  // --- Nye avledede innsikter ---
  const SEMESTER_LABEL: Record<Semester, string> = {
    "2025H": "2025 Høst",
    "2026V": "2026 Vår",
    all: "Total",
  };

  const sessionAverages = useMemo(() => {
    if (!tableData) return [];
    return tableData.columns
      .map((col) => {
        const times: number[] = [];
        tableData.rows.forEach((r) => {
          const cell = tableData.cells[r.participantId]?.[col.sessionId];
          if (cell?.seconds != null) times.push(cell.seconds);
        });
        if (!times.length) return null;
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        return {
          sessionId: col.sessionId,
          dateISO: col.dateISO,
          dateFormatted: fmtDate(col.dateISO),
          attempts: times.length,
          avg,
          min: Math.min(...times),
          max: Math.max(...times),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [tableData]);

  const bestSession = sessionAverages.length
    ? [...sessionAverages].sort((a, b) => a.avg - b.avg)[0]
    : null;
  const worstSession = sessionAverages.length
    ? [...sessionAverages].sort((a, b) => b.avg - a.avg)[0]
    : null;
  const biggestSession = sessionAverages.length
    ? [...sessionAverages].sort((a, b) => b.attempts - a.attempts)[0]
    : null;

  const totalChugSeconds = validParticipants.reduce(
    (s, p) => s + (p.avg ?? 0) * p.attempts,
    0
  );
  const fmtTotalSeconds = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.round(s % 60);
    if (h > 0) return `${h}t ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  const topViolation = noteBars[0] ?? null;

  // Topp 3 i utvalgte kategorier (podiums)
  const topByAttempts = [...validParticipants]
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 3);

  const topByViolations = useMemo(() => {
    const counts: Record<string, { id: string; name: string; count: number }> = {};
    validParticipants.forEach((p) => {
      counts[p.participantId] = { id: p.participantId, name: p.name, count: 0 };
    });
    violations.forEach((v) => {
      if (v.ruleCode === "ABSENCE") return;
      if (counts[v.participantId]) counts[v.participantId].count++;
    });
    return Object.values(counts)
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [validParticipants, violations]);

  // Codes per (participant, session). "Ren" (tellende) = ingen kode eller bare MM.
  // "Med anmerkning" = minst én ikke-MM-kode (W/VW/P/DNF/…).
  const cellCodes = useMemo(() => {
    const map = new Map<string, string[]>();
    violations.forEach((v) => {
      const key = `${v.participantId}:${v.sessionId}`;
      const arr = map.get(key) ?? [];
      arr.push(v.ruleCode.toUpperCase());
      map.set(key, arr);
    });
    return map;
  }, [violations]);

  const isCleanCell = useCallback(
    (pid: string, sid: string) => {
      const codes = cellCodes.get(`${pid}:${sid}`);
      return !codes || codes.length === 0 || codes.every((c) => c === "MM");
    },
    [cellCodes]
  );

  // --- Raskeste enkelt-chugs (rene/tellende — uten anmerkning, MM ok) ---
  const fastestSingleChugs = useMemo(() => {
    if (!tableData) return [];
    const allowed = new Set(validParticipants.map((p) => p.participantId));
    type Entry = {
      participantId: string;
      name: string;
      seconds: number;
      sessionId: string;
      dateISO: string;
      dateFormatted: string;
    };
    const out: Entry[] = [];
    tableData.rows.forEach((r) => {
      if (!allowed.has(r.participantId)) return;
      tableData.columns.forEach((col) => {
        const cell = tableData.cells[r.participantId]?.[col.sessionId];
        if (cell?.seconds != null && isCleanCell(r.participantId, col.sessionId)) {
          out.push({
            participantId: r.participantId,
            name: r.name,
            seconds: cell.seconds,
            sessionId: col.sessionId,
            dateISO: col.dateISO,
            dateFormatted: fmtDate(col.dateISO),
          });
        }
      });
    });
    return out.sort((a, b) => a.seconds - b.seconds).slice(0, 10);
  }, [tableData, validParticipants, isCleanCell]);

  // --- Raskeste enkelt-chugs MED anmerkning (egen statistikk) ---
  const fastestWithAnmerkning = useMemo(() => {
    if (!tableData) return [];
    const allowed = new Set(validParticipants.map((p) => p.participantId));
    const out: { participantId: string; name: string; seconds: number; codes: string; dateFormatted: string }[] = [];
    tableData.rows.forEach((r) => {
      if (!allowed.has(r.participantId)) return;
      tableData.columns.forEach((col) => {
        const cell = tableData.cells[r.participantId]?.[col.sessionId];
        if (cell?.seconds == null) return;
        const codes = (cellCodes.get(`${r.participantId}:${col.sessionId}`) ?? []).filter((c) => c !== "MM");
        if (codes.length === 0) return;
        out.push({
          participantId: r.participantId,
          name: r.name,
          seconds: cell.seconds,
          codes: codes.join("/"),
          dateFormatted: fmtDate(col.dateISO),
        });
      });
    });
    return out.sort((a, b) => a.seconds - b.seconds).slice(0, 10);
  }, [tableData, validParticipants, cellCodes]);

  // --- Personlige rekorder (raskeste chug pr. person) ---
  const personalBests = useMemo(() => {
    if (!tableData) return [];
    const allowed = new Set(validParticipants.map((p) => p.participantId));
    const map: Record<
      string,
      { participantId: string; name: string; seconds: number; sessionId: string; dateFormatted: string }
    > = {};
    tableData.rows.forEach((r) => {
      if (!allowed.has(r.participantId)) return;
      tableData.columns.forEach((col) => {
        const cell = tableData.cells[r.participantId]?.[col.sessionId];
        if (cell?.seconds != null && isCleanCell(r.participantId, col.sessionId)) {
          const existing = map[r.participantId];
          if (!existing || cell.seconds < existing.seconds) {
            map[r.participantId] = {
              participantId: r.participantId,
              name: r.name,
              seconds: cell.seconds,
              sessionId: col.sessionId,
              dateFormatted: fmtDate(col.dateISO),
            };
          }
        }
      });
    });
    return Object.values(map).sort((a, b) => a.seconds - b.seconds);
  }, [tableData, validParticipants, isCleanCell]);

  // --- Histogram: fordeling av alle chug-tider ---
  const histogramData = useMemo(() => {
    if (!tableData) return [];
    const allowed = new Set(validParticipants.map((p) => p.participantId));
    const times: number[] = [];
    tableData.rows.forEach((r) => {
      if (!allowed.has(r.participantId)) return;
      tableData.columns.forEach((col) => {
        const cell = tableData.cells[r.participantId]?.[col.sessionId];
        if (cell?.seconds != null) times.push(cell.seconds);
      });
    });
    if (times.length === 0) return [];
    const min = Math.floor(Math.min(...times));
    const max = Math.ceil(Math.max(...times));
    const bucketSize = max - min <= 10 ? 0.5 : max - min <= 30 ? 1 : 2;
    const buckets: Record<string, number> = {};
    const order: string[] = [];
    for (let b = min; b < max + bucketSize; b += bucketSize) {
      const key =
        bucketSize < 1
          ? `${b.toFixed(1)}s`
          : `${Math.round(b)}-${Math.round(b + bucketSize)}s`;
      buckets[key] = 0;
      order.push(key);
    }
    times.forEach((t) => {
      const idx = Math.floor((t - min) / bucketSize);
      const key = order[Math.min(idx, order.length - 1)];
      if (key) buckets[key]++;
    });
    return order.map((k) => ({ bucket: k, count: buckets[k] })).filter((x) => x.count > 0);
  }, [tableData, validParticipants]);

  // --- Snitt-tid pr. person (sortert) ---
  const avgPerPerson = useMemo(() => {
    return [...validParticipants]
      .filter((p) => p.attempts >= 3 && p.avg != null)
      .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
      .map((p) => ({
        participantId: p.participantId,
        name: p.name,
        avg: Number((p.avg ?? 0).toFixed(2)),
        attempts: p.attempts,
      }));
  }, [validParticipants]);

  // --- Kumulative chugs over tid ---
  const cumulativeChugs = useMemo(() => {
    if (!tableData) return [];
    const allowed = new Set(validParticipants.map((p) => p.participantId));
    const cols = [...tableData.columns].sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );
    let acc = 0;
    return cols.map((col) => {
      let day = 0;
      tableData.rows.forEach((r) => {
        if (!allowed.has(r.participantId)) return;
        const cell = tableData.cells[r.participantId]?.[col.sessionId];
        if (cell?.seconds != null) day++;
      });
      acc += day;
      return {
        sessionId: col.sessionId,
        dateFormatted: fmtDate(col.dateISO),
        day,
        cumulative: acc,
      };
    });
  }, [tableData, validParticipants]);

  // --- Snitt-tid pr. ukedag ---
  const weekdayAverages = useMemo(() => {
    if (!sessionAverages.length) return [];
    const days = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
    const buckets: Record<number, { sum: number; n: number }> = {};
    sessionAverages.forEach((s) => {
      const d = new Date(s.dateISO).getDay();
      const totalSec = s.avg * s.attempts;
      if (!buckets[d]) buckets[d] = { sum: 0, n: 0 };
      buckets[d].sum += totalSec;
      buckets[d].n += s.attempts;
    });
    // Order Mon..Sun
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order
      .map((d) => ({
        day: days[d],
        avg:
          buckets[d] && buckets[d].n > 0
            ? Number((buckets[d].sum / buckets[d].n).toFixed(2))
            : 0,
        attempts: buckets[d]?.n ?? 0,
      }))
      .filter((x) => x.attempts > 0);
  }, [sessionAverages]);

  return (
    <div className="stats">
      {/* ── HERO ── */}
      <section className="stats-hero card">
        <div className="stats-hero__bg" aria-hidden="true" />
        <div className="stats-hero__icon" aria-hidden="true">📊</div>
        <div className="stats-hero__info">
          <div className="stats-hero__pill">{SEMESTER_LABEL[semester]}</div>
          <h1 className="stats-hero__title">Dashbord & Statistikk</h1>
          <p className="stats-hero__subtitle">
            Tall, trender og rangeringer fra alle chuggene.
          </p>
          {data && (
            <div className="stats-hero__quick">
              <div className="stats-hero__stat">
                <div className="stats-hero__stat-num">{data.overview.attempts}</div>
                <div className="stats-hero__stat-lbl">Chugs totalt</div>
              </div>
              <div className="stats-hero__stat">
                <div className="stats-hero__stat-num">{data.overview.sessions}</div>
                <div className="stats-hero__stat-lbl">Chuggedager</div>
              </div>
              <div className="stats-hero__stat">
                <div className="stats-hero__stat-num">
                  {overallAverageTime != null ? `${overallAverageTime.toFixed(2)}s` : "—"}
                </div>
                <div className="stats-hero__stat-lbl">Snittid</div>
              </div>
              <div className="stats-hero__stat">
                <div className="stats-hero__stat-num">
                  {totalChugSeconds > 0 ? fmtTotalSeconds(totalChugSeconds) : "—"}
                </div>
                <div className="stats-hero__stat-lbl">Total chug-tid</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── TOOLBAR ── */}
      <div className="stats-toolbar card">
        <div className="stats-toolbar__group">
          <span className="stats-toolbar__group-label">Sesong</span>
          <div className="stats-toolbar__segment">
            <button
              className={`stats-toolbar__seg-btn ${semester === "2025H" ? "is-active" : ""}`}
              onClick={() => setSemester("2025H")}
            >
              2025 Høst
            </button>
            <button
              className={`stats-toolbar__seg-btn ${semester === "2026V" ? "is-active" : ""}`}
              onClick={() => setSemester("2026V")}
            >
              2026 Vår
            </button>
            <button
              className={`stats-toolbar__seg-btn ${semester === "all" ? "is-active" : ""}`}
              onClick={() => setSemester("all")}
            >
              Total
            </button>
          </div>
        </div>

        <div className="stats-toolbar__divider" aria-hidden="true" />

        <div className="stats-toolbar__group">
          <span className="stats-toolbar__group-label">Deltakere</span>
          <button
            type="button"
            className={`stats-toolbar__toggle ${includeGuests ? "is-active" : ""}`}
            onClick={() => setIncludeGuests(v => !v)}
            aria-pressed={includeGuests}
            title="Vis gjester (deltakere som ikke er faste)"
          >
            <span className="stats-toolbar__toggle-dot" aria-hidden="true" />
            {includeGuests ? "Med gjester" : "Bare faste"}
          </button>
        </div>
      </div>

      {!data || !tableData ? (
        <LoadingCard
          className="stats__loading"
          title="Laster statistikk..."
          subtitle="Henter dashboard, grafer og tabell"
        />
      ) : (
        <>
          {/* ── KPI HIGHLIGHTS ── */}
          <section className="stats-kpis">
            {fastestSingleChugs[0] && (
              <article
                className="card stats-kpi stats-kpi--gold"
                onClick={() => navigate(`/person/${fastestSingleChugs[0].participantId}`)}
                role="button"
                tabIndex={0}
              >
                <div className="stats-kpi__icon" aria-hidden>⚡</div>
                <div className="stats-kpi__body">
                  <div className="stats-kpi__label">Raskeste chug noensinne</div>
                  <div className="stats-kpi__value">
                    {fastestSingleChugs[0].seconds.toFixed(2)}s
                  </div>
                  <div className="stats-kpi__sub">
                    {fastestSingleChugs[0].name} · {fastestSingleChugs[0].dateFormatted}
                  </div>
                </div>
              </article>
            )}

            {slowestPerson && (
              <article
                className="card stats-kpi stats-kpi--red"
                onClick={() => navigate(`/person/${slowestPerson.participantId}`)}
                role="button"
                tabIndex={0}
              >
                <div className="stats-kpi__icon" aria-hidden>🐢</div>
                <div className="stats-kpi__body">
                  <div className="stats-kpi__label">Tregest i snitt</div>
                  <div className="stats-kpi__value">{slowestPerson.name}</div>
                  <div className="stats-kpi__sub">
                    {slowestPerson.avg?.toFixed(2)}s · {slowestPerson.attempts} chugs
                  </div>
                </div>
              </article>
            )}

            {bestSession && (
              <article
                className="card stats-kpi stats-kpi--accent"
                onClick={() => navigate(`/session/${bestSession.sessionId}`)}
                role="button"
                tabIndex={0}
              >
                <div className="stats-kpi__icon" aria-hidden>🔥</div>
                <div className="stats-kpi__body">
                  <div className="stats-kpi__label">Beste økt</div>
                  <div className="stats-kpi__value">{bestSession.avg.toFixed(2)}s</div>
                  <div className="stats-kpi__sub">
                    {bestSession.dateFormatted} · {bestSession.attempts} forsøk
                  </div>
                </div>
              </article>
            )}

            {worstSession && (
              <article
                className="card stats-kpi stats-kpi--muted"
                onClick={() => navigate(`/session/${worstSession.sessionId}`)}
                role="button"
                tabIndex={0}
              >
                <div className="stats-kpi__icon" aria-hidden>🥱</div>
                <div className="stats-kpi__body">
                  <div className="stats-kpi__label">Tregeste økt</div>
                  <div className="stats-kpi__value">{worstSession.avg.toFixed(2)}s</div>
                  <div className="stats-kpi__sub">
                    {worstSession.dateFormatted} · {worstSession.attempts} forsøk
                  </div>
                </div>
              </article>
            )}

            {biggestSession && (
              <article
                className="card stats-kpi stats-kpi--accent2"
                onClick={() => navigate(`/session/${biggestSession.sessionId}`)}
                role="button"
                tabIndex={0}
              >
                <div className="stats-kpi__icon" aria-hidden>👥</div>
                <div className="stats-kpi__body">
                  <div className="stats-kpi__label">Best oppmøte</div>
                  <div className="stats-kpi__value">{biggestSession.attempts} stk</div>
                  <div className="stats-kpi__sub">
                    {biggestSession.dateFormatted}
                  </div>
                </div>
              </article>
            )}

            {topViolation && (
              <article className="card stats-kpi stats-kpi--warn">
                <div className="stats-kpi__icon" aria-hidden>⚠️</div>
                <div className="stats-kpi__body">
                  <div className="stats-kpi__label">Hyppigste anmerkning</div>
                  <div className="stats-kpi__value">{topViolation.label}</div>
                  <div className="stats-kpi__sub">
                    {topViolation.count} totalt
                  </div>
                </div>
              </article>
            )}
          </section>

          {/* ── PODIUMS ── */}
          <section className="stats-podiums">
            <PodiumCard
              title="🎯 Flest chugs"
              subtitle="Mest aktive deltakere"
              entries={topByAttempts.map((p) => ({
                id: p.participantId,
                name: p.name,
                value: `${p.attempts}`,
                sub: "forsøk",
              }))}
              onClickEntry={(id) => navigate(`/person/${id}`)}
            />
            <PodiumCard
              title="⚡ Raskeste enkelt-chugs"
              subtitle="Beste enkelttider gjennom sesongen"
              entries={personalBests.slice(0, 3).map((c) => ({
                id: c.participantId,
                name: c.name,
                value: `${c.seconds.toFixed(2)}s`,
                sub: c.dateFormatted,
              }))}
              onClickEntry={(id) => navigate(`/person/${id}`)}
            />
            <PodiumCard
              title="❌ Flest kryss"
              subtitle="Anmerkninger totalt"
              entries={topByViolations.map((p) => ({
                id: p.id,
                name: p.name,
                value: `${p.count}`,
                sub: "kryss",
              }))}
              onClickEntry={(id) => navigate(`/person/${id}`)}
              tone="warn"
            />
            {fastestWithAnmerkning.length > 0 && (
              <PodiumCard
                title="💧 Raskeste med anmerkning"
                subtitle="Beste tider som ikke teller (W/VW/P/…)"
                entries={fastestWithAnmerkning.slice(0, 3).map((c) => ({
                  id: c.participantId,
                  name: c.name,
                  value: `${c.seconds.toFixed(2)}s`,
                  sub: `${c.codes} · ${c.dateFormatted}`,
                }))}
                onClickEntry={(id) => navigate(`/person/${id}`)}
                tone="warn"
              />
            )}
          </section>

          {/* ── CHART GRID ── */}
          <section className="stats-grid">
            <article className="card stats-card stats-card--wide">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Diverse tider per dag</h2>
                <span className="stats-card__sub">
                  Raskest, snitt og tregest pr. økt
                </span>
              </header>
              <div className="stats-card__chart">
                <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={300}>
                  <LineChart data={timeSeriesData} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="dateFormatted"
                      stroke="var(--text)"
                      tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                      tickMargin={8}
                      minTickGap={16}
                    />
                    <YAxis
                      stroke="var(--text)"
                      tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                      width={48}
                      tickFormatter={(tick) => `${tick}s`}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<CustomTimeSeriesTooltip />} />
                    <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="fastestTime" name="Raskest" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} connectNulls />
                    <Line type="monotone" dataKey="avg" name="Snitt" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                    <Line type="monotone" dataKey="slowestTime" name="Tregest" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} activeDot={{ r: 5 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>

            <div className="stats-grid__pair">
              <article className="card stats-card">
                <header className="stats-card__head">
                  <h2 className="u-mb-0">⚡ Topp 10 raskeste chugs</h2>
                <span className="stats-card__sub">
                  Beste enkelttider gjennom hele sesongen
                </span>
              </header>
              <div className="stats-card__list">
                {fastestSingleChugs.length > 0 ? (
                  <ol className="stats-fastest">
                    {fastestSingleChugs.map((c, i) => (
                      <li
                        key={`${c.participantId}-${c.sessionId}-${i}`}
                        className={`stats-fastest__row stats-fastest__row--${i < 3 ? "podium" : "rest"}`}
                        onClick={() => navigate(`/person/${c.participantId}`)}
                      >
                        <span className="stats-fastest__rank">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                        <span
                          className="stats-fastest__name"
                          style={{ ["--row-color" as string]: getColor(c.name) }}
                        >
                          {c.name}
                        </span>
                        <span className="stats-fastest__date">{c.dateFormatted}</span>
                        <span className="stats-fastest__time">{c.seconds.toFixed(2)}s</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="stats__no-data">Ingen data tilgjengelig</div>
                )}
              </div>
            </article>

            <article className="card stats-card stats-card--med">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Personlige rekorder</h2>
                <span className="stats-card__sub">
                  Hver persons raskeste chug
                </span>
              </header>
              <div className="stats-card__chart">
                {personalBests.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(260, personalBests.length * 26)}
                    minWidth={1}
                  >
                    <BarChart
                      data={personalBests}
                      layout="vertical"
                      margin={{ top: 6, right: 28, bottom: 0, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        tickFormatter={(t) => `${t}s`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        width={92}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(99, 102, 241, 0.12)" }}
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="chart-tooltip">
                                <strong className="stats__tooltip-person">{p.name}</strong>
                                <div>PR: {p.seconds.toFixed(2)}s</div>
                                <div className="u-text-muted u-text-sm">{p.dateFormatted}</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="seconds"
                        radius={[0, 6, 6, 0]}
                        style={{ cursor: "pointer" }}
                        onClick={(d: any) => { if (d?.participantId) navigate(`/person/${d.participantId}`); }}
                      >
                        {personalBests.map((entry, index) => (
                          <Cell key={`pb-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">Ingen data tilgjengelig</div>
                )}
              </div>
            </article>
            </div>

            <article className="card stats-card">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Kvantitet vs kvalitet</h2>
                <span className="stats-card__sub">
                  Nederst-høyre = mange og raske
                </span>
              </header>
              <div className="stats-card__chart">
                {hasParticipantStats ? (
                  <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={300}>
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        type="number"
                        dataKey="attempts"
                        name="Forsøk"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        tickMargin={8}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="number"
                        dataKey="avg"
                        name="Snitt"
                        unit="s"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        width={48}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="chart-tooltip">
                                <strong className="stats__scatter-person">
                                  {p.name} {!p.isRegular && <span className="stats__scatter-person-tag">(gjest)</span>}
                                </strong>
                                <div>Antall chugs: {p.attempts}</div>
                                <div>Snitt-tid: {p.avg}s</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter data={scatterData} style={{ cursor: "pointer" }} onClick={(d: any) => { if (d?.participantId) navigate(`/person/${d.participantId}`); }}>
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
            </article>

            <article className="card stats-card stats-card--med">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Wet-rate per dag</h2>
                <span className="stats-card__sub">
                  MM, W, VW, P og T
                </span>
              </header>
              <div className="stats-card__chart">
                <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={280}>
                  <AreaChart data={timeSeriesData} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="dateFormatted"
                      stroke="var(--text)"
                      tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                      tickMargin={8}
                      minTickGap={16}
                    />
                    <YAxis
                      stroke="var(--text)"
                      tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                      width={42}
                      tickFormatter={(tick) => `${tick}%`}
                    />
                    <Tooltip 
                      labelFormatter={(label) => String(label)}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, "Wet-rate"]}
                      wrapperClassName="stats__recharts-tooltip"
                    />
                    <Area type="monotone" dataKey="wetPct" stroke="#0ea5e9" fill="rgba(14, 165, 233, 0.25)" strokeWidth={3} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="card stats-card">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Anmerkningstyper</h2>
                <span className="stats-card__sub">
                  Fordeling av alle registrerte kryss
                </span>
              </header>
              <div className="stats-card__chart">
                <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={280}>
                  <BarChart data={noteBars} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="type"
                      stroke="var(--text)"
                      tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                      tickMargin={8}
                    />
                    <YAxis
                      stroke="var(--text)"
                      tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                      width={36}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomNoteTypesTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {noteBars.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="card stats-card stats-card--med">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Største forbedring</h2>
                <span className="stats-card__sub">
                  Snitt av to første vs to siste (≥ 4 chugs)
                </span>
              </header>
              <div className="stats-card__chart">
                {improvementData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={280}>
                    <BarChart data={improvementData} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        tickMargin={8}
                        minTickGap={12}
                      />
                      <YAxis
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        width={42}
                        tickFormatter={(tick) => `${tick}%`}
                      />
                      <Tooltip content={<CustomImprovementTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                      <Bar dataKey="improvementPct" radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }} onClick={(d: any) => { if (d?.participantId) navigate(`/person/${d.participantId}`); }}>
                        {improvementData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">
                    Ikke nok data — krever ≥ 4 chugs
                  </div>
                )}
              </div>
            </article>

            <article className="card stats-card stats-card--med">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Aktivitet per dag</h2>
                <span className="stats-card__sub">
                  Antall registrerte chugs pr. dato
                </span>
              </header>
              <div className="stats-card__chart">
                <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={280}>
                  <BarChart data={timeSeriesData} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis
                      dataKey="dateFormatted"
                      stroke="var(--text)"
                      tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                      tickMargin={8}
                      minTickGap={16}
                    />
                    <YAxis
                      stroke="var(--text)"
                      tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                      tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                      width={36}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomActivityTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                    <Bar dataKey="attempts" fill="var(--accent)" radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }} onClick={(d: any) => { if (d?.sessionId) navigate(`/session/${d.sessionId}`); }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="card stats-card">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Lavest wet-rate</h2>
                <span className="stats-card__sub">
                  Mest kontroll — krever ≥ 5 chugs
                </span>
              </header>
              <div className="stats-card__chart">
                {lowestWetRateData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={280}>
                    <BarChart data={lowestWetRateData} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        tickMargin={8}
                        minTickGap={12}
                      />
                      <YAxis
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        width={42}
                        tickFormatter={(tick) => `${tick}%`}
                      />
                      <Tooltip content={<CustomWetRateTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                      <Bar dataKey="wetPct" radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }} onClick={(d: any) => { if (d?.participantId) navigate(`/person/${d.participantId}`); }}>
                        {lowestWetRateData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">
                    Ikke nok data — krever ≥ 5 chugs
                  </div>
                )}
              </div>
            </article>

            <article className="card stats-card">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Syndebukkene</h2>
                <span className="stats-card__sub">
                  Høyest andel runder med kryss (≥ 3 forsøk)
                </span>
              </header>
              <div className="stats-card__chart">
                {hasParticipantStats ? (
                  <ResponsiveContainer width="100%" height={280} minWidth={1} minHeight={280}>
                    <BarChart data={noteRateData} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        tickMargin={8}
                        minTickGap={12}
                      />
                      <YAxis
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        width={42}
                        tickFormatter={(tick) => `${tick}%`}
                      />
                      <Tooltip content={<CustomPunishmentTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                      <Bar dataKey="notePct" radius={[6, 6, 0, 0]} style={{ cursor: "pointer" }} onClick={(d: any) => { if (d?.participantId) navigate(`/person/${d.participantId}`); }}>
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
            </article>

            <article className="card stats-card stats-card--med">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Tidsfordeling</h2>
                <span className="stats-card__sub">
                  Hvor mange chugs faller i hvert tidsintervall
                </span>
              </header>
              <div className="stats-card__chart">
                {histogramData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260} minWidth={1} minHeight={260}>
                    <BarChart data={histogramData} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis
                        dataKey="bucket"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        tickMargin={8}
                        minTickGap={4}
                      />
                      <YAxis
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        width={36}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(99, 102, 241, 0.12)" }}
                        content={({ active, payload, label }: any) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="chart-tooltip">
                                <div className="u-text-muted u-mb-xs">{label}</div>
                                <div className="u-text-bold">{payload[0].value} chugs</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">Ingen data tilgjengelig</div>
                )}
              </div>
            </article>

            <article className="card stats-card stats-card--med">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Snitt-tid pr. person</h2>
                <span className="stats-card__sub">
                  Sortert fra raskest til tregest (≥ 3 chugs)
                </span>
              </header>
              <div className="stats-card__chart">
                {avgPerPerson.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(260, avgPerPerson.length * 26)}
                    minWidth={1}
                  >
                    <BarChart
                      data={avgPerPerson}
                      layout="vertical"
                      margin={{ top: 6, right: 24, bottom: 0, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        tickFormatter={(t) => `${t}s`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        width={88}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(99, 102, 241, 0.12)" }}
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="chart-tooltip">
                                <strong className="stats__tooltip-person">{p.name}</strong>
                                <div>Snitt: {p.avg}s</div>
                                <div>Forsøk: {p.attempts}</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="avg" radius={[0, 6, 6, 0]} style={{ cursor: "pointer" }} onClick={(d: any) => { if (d?.participantId) navigate(`/person/${d.participantId}`); }}>
                        {avgPerPerson.map((entry, index) => (
                          <Cell key={`avg-${index}`} fill={getColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">Ingen data tilgjengelig</div>
                )}
              </div>
            </article>

            <article className="card stats-card">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Snitt-tid pr. ukedag</h2>
                <span className="stats-card__sub">
                  Hvilken dag er folk på sitt beste?
                </span>
              </header>
              <div className="stats-card__chart">
                {weekdayAverages.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260} minWidth={1} minHeight={260}>
                    <BarChart data={weekdayAverages} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis
                        dataKey="day"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        tickMargin={8}
                      />
                      <YAxis
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        width={42}
                        tickFormatter={(t) => `${t}s`}
                        domain={[0, 'auto']}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(99, 102, 241, 0.12)" }}
                        content={({ active, payload, label }: any) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="chart-tooltip">
                                <div className="u-text-muted u-mb-xs">{label}</div>
                                <div className="u-text-bold">Snitt: {p.avg}s</div>
                                <div className="u-text-muted u-text-sm">{p.attempts} chugs</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="avg" fill="var(--accent2, #06b6d4)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">Ingen data tilgjengelig</div>
                )}
              </div>
            </article>

            <article className="card stats-card stats-card--wide">
              <header className="stats-card__head">
                <h2 className="u-mb-0">Kumulative chugs over sesongen</h2>
                <span className="stats-card__sub">
                  Total mengde chugs som har bygget seg opp
                </span>
              </header>
              <div className="stats-card__chart">
                {cumulativeChugs.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260} minWidth={1} minHeight={260}>
                    <AreaChart data={cumulativeChugs} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                      <defs>
                        <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="dateFormatted"
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        tickMargin={8}
                        minTickGap={16}
                      />
                      <YAxis
                        stroke="var(--text)"
                        tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                        tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                        width={42}
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={({ active, payload, label }: any) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="chart-tooltip">
                                <div className="u-text-muted u-mb-xs">{label}</div>
                                <div className="u-text-bold">Totalt: {p.cumulative} chugs</div>
                                <div className="u-text-muted u-text-sm">+{p.day} denne dagen</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulative"
                        stroke="var(--accent)"
                        strokeWidth={3}
                        fill="url(#cumGrad)"
                        activeDot={{ r: 6, style: { cursor: "pointer" }, onClick: (_: any, p: any) => { if (p?.payload?.sessionId) navigate(`/session/${p.payload.sessionId}`); } }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="stats__no-data">Ingen data tilgjengelig</div>
                )}
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}

// --- Podium-komponent ---
type PodiumEntry = { id: string; name: string; value: string; sub: string };
function PodiumCard(props: {
  title: string;
  subtitle: string;
  entries: PodiumEntry[];
  onClickEntry: (id: string) => void;
  tone?: "default" | "warn";
}) {
  const { title, subtitle, entries, onClickEntry, tone = "default" } = props;
  if (entries.length === 0) return null;
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <article className={`card stats-podium stats-podium--${tone}`}>
      <header className="stats-podium__head">
        <h3 className="stats-podium__title">{title}</h3>
        <span className="stats-podium__sub">{subtitle}</span>
      </header>
      <ol className="stats-podium__list">
        {entries.map((e, i) => (
          <li
            key={e.id}
            className={`stats-podium__row stats-podium__row--${i + 1}`}
            onClick={() => onClickEntry(e.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onClickEntry(e.id);
              }
            }}
            style={{ ["--podium-color" as any]: getColor(e.name) }}
          >
            <span className="stats-podium__medal" aria-hidden>{medals[i]}</span>
            <span className="stats-podium__name">{e.name}</span>
            <span className="stats-podium__value">{e.value}</span>
            <span className="stats-podium__sub-text">{e.sub}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}
