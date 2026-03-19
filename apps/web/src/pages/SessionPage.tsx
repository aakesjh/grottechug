import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  PieChart,
  Pie,
} from "recharts";
import { apiFetch } from "../lib/api";

type SessionCol = { sessionId: string; dateISO: string; note?: string | null; id?: string };
type CellData = { seconds: number | null; note: string | null };
type Row = { participantId: string; name: string; isRegular: boolean };

type TableResponse = {
  semester: string;
  columns: SessionCol[];
  rows: Row[];
  cells: Record<string, Record<string, CellData>>;
};

type ViolationEntry = {
  id: string;
  participantId: string;
  participantName: string;
  sessionId: string;
  ruleCode: string;
  reason?: string | null;
  crosses: number;
};

type AttemptStat = {
  participantId: string;
  name: string;
  isRegular: boolean;
  seconds: number;
  note: string | null;
  violations: string[];
  pbBefore: number | null;
  projected: number | null;
  diffPb: number | null;
  diffProjected: number | null;
  diffProjectedPct: number | null;
  lastTime: number | null;
};

const AVATAR_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
];

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
};

const WET_CODES = new Set(["W", "VW", "MM", "P", "T"]);

const FALLBACK_PIE_COLOR = "#a8a29e";

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function fmtSeconds(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(2)}s`;
}

function fmtAwardTime(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(2)}s`;
}

function getRuleLabel(code: string) {
  const labels: Record<string, string> = {
    DNS: "Did not start",
    DNF: "Did not finish",
    MM: "Mildly moist",
    W: "Wet",
    VW: "Very wet",
    P: "Puke",
    ABSENCE: "Fravær",
    VOMIT: "Oppkast",
    KPR: "Klage på regel",
  };
  return labels[code] || code;
}

function ruleCodeClass(code: string) {
  return `session__rule-code--${code.trim().toLowerCase()}`;
}

const CustomBarLabel = (props: any) => {
  const { x, y, width, violations, note } = props;
  const hasViolations = Array.isArray(violations) && violations.length > 0;
  const hasNote = !!note;

  if (!hasViolations && !hasNote) return null;
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number") return null;

  const dotY = y - 8;
  const centerX = x + width / 2;

  return (
    <g>
      {hasViolations && (
        <circle
          cx={hasNote ? centerX - 6 : centerX}
          cy={dotY}
          r={4.5}
          fill="var(--danger)"
        />
      )}
      {hasNote && (
        <circle
          cx={hasViolations ? centerX + 6 : centerX}
          cy={dotY}
          r={4.5}
          fill="#facc15"
        />
      )}
    </g>
  );
};

type AwardTimeCompareProps = {
  current: number | null | undefined;
  reference: number | null | undefined;
  referenceLabel: string;
  referenceTone?: "accent" | "danger" | "muted";
  compactReference?: boolean;
};

function AwardTimeCompare({
  current,
  reference,
  referenceLabel,
  referenceTone = "muted",
  compactReference = false,
}: AwardTimeCompareProps) {
  return (
    <div
      className="session__award-time-compare"
      title={`Faktisk tid / ${referenceLabel}`}
    >
      <span className="session__award-time-current">{fmtAwardTime(current)}</span>
      <span className="session__award-time-sep">/</span>
      <span
        className={`session__award-time-reference session__award-time-reference--${referenceTone} ${compactReference ? "session__award-time-reference--compact" : ""}`}
      >
        {fmtAwardTime(reference)}
      </span>
      <span className="session__award-time-hint">Faktisk tid / {referenceLabel}</span>
    </div>
  );
}

export function SessionPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [tableData, setTableData] = useState<TableResponse | null>(null);
  const [sessions, setSessions] = useState<SessionCol[]>([]);
  const [violations, setViolations] = useState<ViolationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    Promise.all([
      apiFetch(`/api/stats/table?semester=all`).then((r) => r.json()),
      apiFetch(`/api/sessions`).then((r) => r.json()),
      apiFetch(`/api/violations?semester=all`).then((r) => r.json()),
    ])
      .then(([tData, sData, vData]) => {
        setTableData(tData);
        setSessions(sData);
        setViolations(vData);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, [id]);

  const currentSessionViolations = useMemo(
    () => violations.filter((v) => v.sessionId === id),
    [violations, id]
  );

  const sessionStats = useMemo(() => {
    if (!tableData || !sessions.length || !id) return null;

    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );

    const currentIndex = sortedSessions.findIndex((s) => (s.id || s.sessionId) === id);
    if (currentIndex === -1) return null;

    const currentSession = sortedSessions[currentIndex];
    const prevSessionId =
      currentIndex > 0
        ? sortedSessions[currentIndex - 1].id || sortedSessions[currentIndex - 1].sessionId
        : null;
    const nextSessionId =
      currentIndex < sortedSessions.length - 1
        ? sortedSessions[currentIndex + 1].id || sortedSessions[currentIndex + 1].sessionId
        : null;

    const historySessions = sortedSessions.slice(0, currentIndex);

    const allSessionsStats = sortedSessions
      .map((s) => {
        const sid = s.id || s.sessionId;
        let count = 0;
        let totalSec = 0;

        tableData.rows.forEach((r) => {
          const cell = tableData.cells[r.participantId]?.[sid];
          if (cell && typeof cell.seconds === "number" && cell.seconds > 0) {
            count++;
            totalSec += cell.seconds;
          }
        });

        return { sid, count, avg: count > 0 ? totalSec / count : null };
      })
      .filter((s) => s.count > 0);

    const sortedByAvg = [...allSessionsStats].sort((a, b) => a.avg! - b.avg!);
    const avgRank = sortedByAvg.findIndex((s) => s.sid === id) + 1;

    const sortedByCount = [...allSessionsStats].sort((a, b) => b.count - a.count);
    const countRank = sortedByCount.findIndex((s) => s.sid === id) + 1;

    const allSessionsGuestStats = sortedSessions.map((s) => {
      const sid = s.id || s.sessionId;
      let guestCount = 0;

      tableData.rows.forEach((r) => {
        if (r.isRegular) return;
        const cell = tableData.cells[r.participantId]?.[sid];
        if (cell && typeof cell.seconds === "number" && cell.seconds > 0) {
          guestCount++;
        }
      });

      return { sid, guestCount };
    });
    const sortedByGuests = [...allSessionsGuestStats].sort((a, b) => b.guestCount - a.guestCount);
    const guestCountRank = sortedByGuests.findIndex((s) => s.sid === id) + 1;

    const wetViolationKeys = new Set(
      violations
        .filter((v) => WET_CODES.has(v.ruleCode))
        .map((v) => `${v.sessionId}:${v.participantId}`)
    );

    const allSessionsWetStats = sortedSessions.map((s) => {
      const sid = s.id || s.sessionId;
      let sessionAttempts = 0;
      let sessionWet = 0;

      tableData.rows.forEach((r) => {
        const cell = tableData.cells[r.participantId]?.[sid];
        if (!cell || typeof cell.seconds !== "number" || cell.seconds <= 0) return;
        sessionAttempts++;
        if (wetViolationKeys.has(`${sid}:${r.participantId}`)) {
          sessionWet++;
        }
      });

      return {
        sid,
        wetRate: sessionAttempts > 0 ? (sessionWet / sessionAttempts) * 100 : null,
      };
    });

    const sortedByWetRate = allSessionsWetStats
      .filter((s): s is { sid: string; wetRate: number } => s.wetRate !== null)
      .sort((a, b) => b.wetRate - a.wetRate);
    const wetRateRank = sortedByWetRate.findIndex((s) => s.sid === id) + 1;

    const attempts: AttemptStat[] = [];
    let totalSeconds = 0;
    let wetCount = 0;

    tableData.rows.forEach((row) => {
      const cell = tableData.cells[row.participantId]?.[id];
      if (!cell || cell.seconds == null) return;

      const participantViolations = currentSessionViolations
        .filter((v) => v.participantId === row.participantId)
        .map((v) => v.ruleCode);

      if (participantViolations.some((v) => ["W", "VW", "MM", "P", "T"].includes(v))) {
        wetCount++;
      }

      const historyTimes = historySessions
        .map((s) => tableData.cells[row.participantId]?.[s.id || s.sessionId]?.seconds)
        .filter((sec): sec is number => sec != null);

      const pbBefore = historyTimes.length > 0 ? Math.min(...historyTimes) : null;
      const lastTime = historyTimes.length > 0 ? historyTimes[historyTimes.length - 1] : null;

      let projected = null;
      if (historyTimes.length >= 2) {
        const n = historyTimes.length;
        const sumX = historyTimes.map((_, i) => i).reduce((a, b) => a + b, 0);
        const sumY = historyTimes.reduce((a, b) => a + b, 0);
        const sumXY = historyTimes.map((pt, i) => i * pt).reduce((a, b) => a + b, 0);
        const sumXX = historyTimes.map((_, i) => i * i).reduce((a, b) => a + b, 0);
        const denom = n * sumXX - sumX * sumX;
        const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
        const b = (sumY - m * sumX) / n;
        projected = Math.max(0, m * n + b);
      }

      attempts.push({
        participantId: row.participantId,
        name: row.name,
        isRegular: row.isRegular,
        seconds: cell.seconds,
        note: cell.note,
        violations: participantViolations,
        pbBefore,
        projected,
        diffPb: pbBefore !== null ? cell.seconds - pbBefore : null,
        diffProjected: projected !== null ? cell.seconds - projected : null,
        diffProjectedPct:
          projected !== null && projected > 0
            ? ((cell.seconds - projected) / projected) * 100
            : null,
        lastTime,
      });

      totalSeconds += cell.seconds;
    });

    attempts.sort((a, b) => a.seconds - b.seconds);

    const allHistoricalTimes = Object.values(tableData.cells)
      .flatMap((participantCells) => Object.values(participantCells))
      .map((cell) => cell.seconds)
      .filter((sec): sec is number => typeof sec === "number" && sec > 0)
      .sort((a, b) => a - b);

    const fastest = attempts[0] || null;
    const slowest = attempts[attempts.length - 1] || null;
    const guestCount = attempts.filter((a) => !a.isRegular).length;

    const fastestGlobalRank =
      fastest != null ? allHistoricalTimes.findIndex((t) => t === fastest.seconds) + 1 : null;

    const slowestGlobalRank =
      slowest != null
        ? allHistoricalTimes.lastIndexOf(slowest.seconds) + 1
        : null;

    return {
      dateISO: currentSession.dateISO,
      note: currentSession.note,
      participantCount: attempts.length,
      avgTime: attempts.length > 0 ? totalSeconds / attempts.length : null,
      fastest,
      slowest,
      fastestGlobalRank,
      slowestGlobalRank,
      totalHistoricalAttempts: allHistoricalTimes.length,
      wetRate: attempts.length > 0 ? (wetCount / attempts.length) * 100 : 0,
      wetRateRank,
      totalSessionsWithWetRate: sortedByWetRate.length,
      guestCount,
      guestCountRank,
      totalSessionsWithGuestCount: sortedByGuests.length,
      attempts,
      avgRank,
      totalSessionsWithAvg: sortedByAvg.length,
      countRank,
      totalSessionsWithCount: sortedByCount.length,
      prevSessionId,
      nextSessionId,
    };
  }, [tableData, sessions, violations, currentSessionViolations, id]);

  const groupedViolations = useMemo(() => {
    const map = new Map<
      string,
      { name: string; codes: string[]; totalCrosses: number; notes: string[] }
    >();

    currentSessionViolations.forEach((v) => {
      const existing = map.get(v.participantId);
      if (existing) {
        existing.codes.push(v.ruleCode);
        existing.totalCrosses += v.crosses;
        if (v.reason) existing.notes.push(v.reason);
      } else {
        map.set(v.participantId, {
          name: v.participantName,
          codes: [v.ruleCode],
          totalCrosses: v.crosses,
          notes: v.reason ? [v.reason] : [],
        });
      }
    });

    return Array.from(map.entries()).map(([participantId, data]) => ({
      participantId,
      ...data,
    }));
  }, [currentSessionViolations]);

  const pieData = useMemo(() => {
    const counts = currentSessionViolations.reduce((acc, v) => {
      acc[v.ruleCode] = (acc[v.ruleCode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).map(([name, value]) => ({
      name,
      label: getRuleLabel(name),
      value,
    }));
  }, [currentSessionViolations]);

  const pbData = useMemo(
    () =>
      sessionStats?.attempts
        .filter((a) => a.diffPb !== null)
        .map((a) => ({
          ...a,
          pbDelta: a.diffPb!,
        })) ?? [],
    [sessionStats]
  );

  const wetBreakdownData = useMemo(() => {
    if (!sessionStats) return [];

    const wetCount = sessionStats.attempts.filter((a) =>
      a.violations.some((code) => WET_CODES.has(code))
    ).length;
    const cleanCount = Math.max(sessionStats.attempts.length - wetCount, 0);

    return [
      { name: "Wet", count: wetCount, pct: sessionStats.wetRate },
      {
        name: "Clean",
        count: cleanCount,
        pct: sessionStats.attempts.length > 0 ? (cleanCount / sessionStats.attempts.length) * 100 : 0,
      },
    ];
  }, [sessionStats]);

  if (loading) {
    return (
      <div className="container u-text-center session__loading">
        Laster dagens resultater...
      </div>
    );
  }

  if (!sessionStats) {
    return (
      <div className="container u-text-center session__loading">
        Fant ikke denne chugge-dagen.
      </div>
    );
  }

  const validProjected = sessionStats.attempts.filter((a) => a.diffProjected !== null);

  const bestProjected =
    validProjected.length > 0
      ? validProjected.reduce((prev, curr) =>
          curr.diffProjected! < prev.diffProjected! ? curr : prev
        )
      : null;

  const validProjectedPct = sessionStats.attempts.filter((a) => a.diffProjectedPct !== null);

  const worstProjected =
    validProjectedPct.length > 0
      ? validProjectedPct.reduce((prev, curr) =>
          curr.diffProjectedPct! > prev.diffProjectedPct! ? curr : prev
        )
      : null;

  const bestPbSmasher = sessionStats.attempts
    .filter((a) => a.diffPb !== null && a.diffPb < 0)
    .reduce(
      (prev, curr) => (prev === null || curr.diffPb! < prev.diffPb! ? curr : prev),
      null as AttemptStat | null
    );

  const steadyHand =
    validProjected.length > 0
      ? validProjected.reduce((prev, curr) =>
          Math.abs(curr.diffProjected!) < Math.abs(prev.diffProjected!) ? curr : prev
        )
      : null;

  const closeCalls = sessionStats.attempts.filter(
    (a) => a.diffPb !== null && a.diffPb > 0 && a.diffPb <= 0.3
  );

  const closestCall =
    closeCalls.length > 0
      ? closeCalls.reduce((prev, curr) => (curr.diffPb! < prev.diffPb! ? curr : prev))
      : null;

  const comebacks = sessionStats.attempts.filter(
    (a) => a.lastTime !== null && a.lastTime - a.seconds > 0
  );

  const biggestComeback =
    comebacks.length > 0
      ? comebacks.reduce((prev, curr) =>
          curr.lastTime! - curr.seconds > prev.lastTime! - prev.seconds ? curr : prev
        )
      : null;

  const isAllTimeFastest = sessionStats.fastestGlobalRank === 1;
  const isAllTimeSlowest = sessionStats.slowestGlobalRank === 1;

  const PersonName = ({
    personId,
    name,
  }: {
    personId: string;
    name: string;
  }) => (
    <button
      type="button"
      onClick={() => nav(`/person/${personId}`)}
      className="session__person-link"
    >
      {name}
    </button>
  );

  return (
    <div className="container session">
      <div className="session__nav">
        <button className="btn" onClick={() => nav("/chug")}>
          ← Tilbake til oversikt
        </button>

        <div className="session__nav-group">
          {sessionStats.prevSessionId && (
            <button
              className="btn session__nav-btn"
              onClick={() => nav(`/session/${sessionStats.prevSessionId}`)}
            >
              « Forrige dag
            </button>
          )}

          {sessionStats.nextSessionId && (
            <button
              className="btn session__nav-btn"
              onClick={() => nav(`/session/${sessionStats.nextSessionId}`)}
            >
              Neste dag »
            </button>
          )}
        </div>
      </div>

      <div className="card session__header">
        <h1 className="session__title">
          Resultater: {fmtDate(sessionStats.dateISO)}
        </h1>
        {sessionStats.note && (
          <div className="session__note">
            "{sessionStats.note}"
          </div>
        )}
      </div>

      <div className="session__stat-grid session__stat-grid--top">
        <div className={`card session__stat-card ${sessionStats.avgRank === 1 ? "session__stat-card--record" : ""}`}>
          <div className={`session__stat-label ${sessionStats.avgRank === 1 ? "session__stat-label--record" : ""}`}>
            {sessionStats.avgRank === 1 && "🏆 "}Gjennomsnitt
          </div>
          <div className={`session__stat-value session__stat-value--accent ${sessionStats.avgRank === 1 ? "session__stat-value--record" : ""}`}>
            {sessionStats.avgTime?.toFixed(2)}s
          </div>
          <div className="session__stat-meta">
            #{sessionStats.avgRank}/{sessionStats.totalSessionsWithAvg} raskeste snitt
          </div>
        </div>

        <div className={`card session__stat-card ${sessionStats.countRank === 1 ? "session__stat-card--record" : ""}`}>
          <div className={`session__stat-label ${sessionStats.countRank === 1 ? "session__stat-label--record" : ""}`}>
            {sessionStats.countRank === 1 && "🔥 "}Antall Chuggere
          </div>
          <div className={`session__stat-value ${sessionStats.countRank === 1 ? "session__stat-value--record" : ""}`}>
            {sessionStats.participantCount}
          </div>
          <div className="session__stat-meta">
            #{sessionStats.countRank}/{sessionStats.totalSessionsWithCount} beste oppmøte
          </div>
        </div>

        <div className={`card session__stat-card session__stat-card--wet ${sessionStats.wetRateRank === 1 ? "session__stat-card--record" : ""}`}>
          <div className={`session__stat-label ${sessionStats.wetRateRank === 1 ? "session__stat-label--record" : "session__stat-label--wet"}`}>
            {sessionStats.wetRateRank === 1 && "💧 "}Wet-Rate i dag
          </div>
          <div className={`session__stat-value session__stat-value--wet ${sessionStats.wetRateRank === 1 ? "session__stat-value--record" : ""}`}>
            {sessionStats.wetRate.toFixed(1)}%
          </div>
          <div className="session__stat-meta session__stat-meta--strong">
            {sessionStats.wetRateRank > 0
              ? `#${sessionStats.wetRateRank}/${sessionStats.totalSessionsWithWetRate} høyest wet-rate`
              : `${wetBreakdownData[0]?.count ?? 0} av ${sessionStats.participantCount} hadde wet-anmerkning`}
          </div>
        </div>

        <div className={`card session__stat-card session__stat-card--guest ${sessionStats.guestCountRank === 1 ? "session__stat-card--record" : ""}`}>
          <div className={`session__stat-label ${sessionStats.guestCountRank === 1 ? "session__stat-label--record" : "session__stat-label--guest"}`}>
            {sessionStats.guestCountRank === 1 && "🎉 "}Antall gjester
          </div>
          <div className={`session__stat-value session__stat-value--guest ${sessionStats.guestCountRank === 1 ? "session__stat-value--record" : ""}`}>
            {sessionStats.guestCount}
          </div>
          <div className="session__stat-meta session__stat-meta--strong">
            #{sessionStats.guestCountRank}/{sessionStats.totalSessionsWithGuestCount} flest gjester
          </div>
        </div>

      </div>

      <div className="session__stat-grid session__stat-grid--secondary">

        {sessionStats.fastest && (
          <div
            className={`card session__highlight-card ${isAllTimeFastest ? "session__highlight-card--alltime-fast" : ""}`}
          >
            <div
              className={`session__highlight-label ${isAllTimeFastest ? "session__highlight-label--alltime-fast" : "session__highlight-label--fast"}`}
            >
              {isAllTimeFastest ? "🏆 Raskest i dag • All-time rekord" : "⚡ Raskest i dag"}
            </div>

            <div
              className={`session__highlight-name ${isAllTimeFastest ? "session__highlight-name--alltime-fast" : ""}`}
            >
              <PersonName
                personId={sessionStats.fastest.participantId}
                name={sessionStats.fastest.name}
              />
            </div>

            <div
              className={`session__highlight-time ${isAllTimeFastest ? "session__highlight-time--alltime-fast" : ""}`}
            >
              {sessionStats.fastest.seconds.toFixed(2)}s
            </div>

            <div className="session__highlight-meta">
              #{sessionStats.fastestGlobalRank}/{sessionStats.totalHistoricalAttempts} raskeste tid noensinne
            </div>
          </div>
        )}

        {sessionStats.slowest && (
          <div
            className={`card session__highlight-card ${isAllTimeSlowest ? "session__highlight-card--alltime-slow" : ""}`}
          >
            <div
              className={`session__highlight-label ${isAllTimeSlowest ? "session__highlight-label--alltime-slow" : "session__highlight-label--slow"}`}
            >
              {isAllTimeSlowest ? "💀 Tregest i dag • All-time bunnrekord" : "🐢 Tregest i dag"}
            </div>

            <div
              className={`session__highlight-name ${isAllTimeSlowest ? "session__highlight-name--alltime-slow" : ""}`}
            >
              <PersonName
                personId={sessionStats.slowest.participantId}
                name={sessionStats.slowest.name}
              />
            </div>

            <div
              className={`session__highlight-time ${isAllTimeSlowest ? "session__highlight-time--alltime-slow" : ""}`}
            >
              {sessionStats.slowest.seconds.toFixed(2)}s
            </div>

            <div className="session__highlight-meta">
              #{sessionStats.slowestGlobalRank}/{sessionStats.totalHistoricalAttempts} tregeste tid noensinne
            </div>
          </div>
        )}
      </div>

      <div className="session__award-grid">
        {bestProjected && bestProjected.diffProjected! < 0 && (
          <div className="card session__award-card session__award-card--over">
            <div className="session__award-title session__award-title--over">
              📈 Overgikk Forventningene
            </div>
            <div className="session__award-name">
              <PersonName personId={bestProjected.participantId} name={bestProjected.name} />
            </div>
            <AwardTimeCompare
              current={bestProjected.seconds}
              reference={bestProjected.projected}
              referenceLabel="Projisert"
              referenceTone="accent"
              compactReference
            />
            <div className="session__award-result session__award-result--positive">
              {Math.abs(bestProjected.diffProjected!).toFixed(2)}s raskere enn projisert.
            </div>
          </div>
        )}

        {worstProjected && worstProjected.diffProjectedPct! > 0 && (
          <div className="card session__award-card session__award-card--under">
            <div className="session__award-title session__award-title--under">
              📉 Skuffet Mest
            </div>
            <div className="session__award-name">
              <PersonName personId={worstProjected.participantId} name={worstProjected.name} />
            </div>
            <AwardTimeCompare
              current={worstProjected.seconds}
              reference={worstProjected.projected}
              referenceLabel="Projisert"
              referenceTone="danger"
              compactReference
            />
            <div className="session__award-result session__award-result--danger">
              {worstProjected.diffProjectedPct!.toFixed(1)}% tregere enn projisert.
            </div>
          </div>
        )}

        {bestPbSmasher && (
          <div className="card session__award-card session__award-card--pb">
            <div className="session__award-title session__award-title--pb">
              🔥 Knuste Egen Rekord
            </div>
            <div className="session__award-name">
              <PersonName personId={bestPbSmasher.participantId} name={bestPbSmasher.name} />
            </div>
            <AwardTimeCompare
              current={bestPbSmasher.seconds}
              reference={bestPbSmasher.pbBefore}
              referenceLabel="PB før"
              referenceTone="accent"
              compactReference
            />
            <div className="session__award-result session__award-result--positive">
              Forbedret PB med {Math.abs(bestPbSmasher.diffPb!).toFixed(2)}s!
            </div>
          </div>
        )}

        {biggestComeback && (
          <div className="card session__award-card session__award-card--comeback">
            <div className="session__award-title session__award-title--comeback">
              🚀 Dagens Comeback
            </div>
            <div className="session__award-name">
              <PersonName personId={biggestComeback.participantId} name={biggestComeback.name} />
            </div>
            <AwardTimeCompare
              current={biggestComeback.seconds}
              reference={biggestComeback.lastTime}
              referenceLabel="Sist"
              referenceTone="accent"
            />
            <div className="session__award-result session__award-result--positive">
              {(biggestComeback.lastTime! - biggestComeback.seconds).toFixed(2)}s raskere enn
              sist!
            </div>
          </div>
        )}

        {steadyHand && (
          <div className="card session__award-card session__award-card--steady">
            <div className="session__award-title session__award-title--steady">
              🎯 Stabilitets-prisen
            </div>
            <div className="session__award-name">
              <PersonName personId={steadyHand.participantId} name={steadyHand.name} />
            </div>
            <AwardTimeCompare
              current={steadyHand.seconds}
              reference={steadyHand.projected}
              referenceLabel="Projisert"
            />
            <div className="session__award-result session__award-result--muted">
              Kun {Math.abs(steadyHand.diffProjected!).toFixed(2)}s avvik fra trend.
            </div>
          </div>
        )}

        {closestCall && (
          <div className="card session__award-card session__award-card--closecall">
            <div className="session__award-title session__award-title--closecall">
              🤏 Nesten-rekord
            </div>
            <div className="session__award-name">
              <PersonName personId={closestCall.participantId} name={closestCall.name} />
            </div>
            <AwardTimeCompare
              current={closestCall.seconds}
              reference={closestCall.pbBefore}
              referenceLabel="PB"
              compactReference
            />
            <div className="session__award-result session__award-result--muted">
              Var kun {closestCall.diffPb!.toFixed(2)}s unna ny PB.
            </div>
          </div>
        )}
      </div>

      <div className="session__chart-grid">
        <div className="card session__chart-card">
          <h2 className="session__chart-title">Forventning vs. realitet</h2>
          <div className="session__chart-desc">
            Negativ verdi betyr raskere enn forventet.
          </div>
          <div className="session__chart-area">
            <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={300}>
              <BarChart data={validProjected} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="name"
                  stroke="var(--text)"
                  tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                  tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                  tickMargin={8}
                  minTickGap={12}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis
                  stroke="var(--text)"
                  tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                  tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                  width={56}
                  tickFormatter={(v: any) => `${v}s`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  wrapperClassName="session__recharts-tooltip"
                  formatter={(value: any) => {
                    const numericValue = Number(value ?? 0);
                    return [
                      `${numericValue > 0 ? "+" : ""}${numericValue.toFixed(2)}s`,
                      "Avvik fra projisert tid",
                    ];
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
                <Bar dataKey="diffProjected" radius={[8, 8, 0, 0]}>
                  {validProjected.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.diffProjected! < 0 ? "#10b981" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {pbData.length > 0 && (
          <div className="card session__chart-card">
            <h2 className="session__chart-title">Avvik fra personlig rekord</h2>
            <div className="session__chart-desc">
              Negativ verdi betyr ny personlig rekord.
            </div>
            <div className="session__chart-area">
              <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={300}>
                <BarChart data={pbData} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text)"
                    tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                    tickMargin={8}
                    minTickGap={12}
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    stroke="var(--text)"
                    tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                    width={56}
                    tickFormatter={(v: any) => `${v}s`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    wrapperClassName="session__recharts-tooltip"
                    formatter={(value: any) => {
                      const numericValue = Number(value ?? 0);
                      return [
                        `${numericValue > 0 ? "+" : ""}${numericValue.toFixed(2)}s`,
                        "Avvik fra PB",
                      ];
                    }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
                  <Bar dataKey="pbDelta" radius={[8, 8, 0, 0]}>
                    {pbData.map((entry, i) => (
                      <Cell key={i} fill={entry.pbDelta < 0 ? "#facc15" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="session__chart-grid">
        <div className="card session__chart-card">
          <h2 className="session__chart-title">Type kryss i dag</h2>
          {pieData.length === 0 ? (
            <div className="u-text-center u-text-muted session__chart-empty">
              Ingen kryss i dag! 🎉
            </div>
          ) : (
            <div className="session__chart-area">
              <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    innerRadius={42}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="label"
                    label={({ name, value }: any) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={RULE_COLORS[entry.name as keyof typeof RULE_COLORS] || FALLBACK_PIE_COLOR}
                        stroke="rgba(15, 23, 42, 0.98)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperClassName="session__recharts-tooltip"
                    formatter={(value: any, _name: any, props: any) => [
                      `${Number(value ?? 0)} stk`,
                      props?.payload?.label || props?.payload?.name || "Kryss",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card session__chart-card">
          <h2 className="session__chart-title">Wet vs. clean</h2>
          <div className="session__chart-desc">
            Fordeling av dagens forsok med og uten wet-anmerkning.
          </div>
          <div className="session__chart-area">
            <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={300}>
              <BarChart data={wetBreakdownData} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="name"
                  stroke="var(--text)"
                  tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                  tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                  tickMargin={8}
                />
                <YAxis
                  stroke="var(--text)"
                  tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                  tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                  width={56}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  wrapperClassName="session__recharts-tooltip"
                  formatter={(value: any, name: any, props: any) => {
                    const numericValue = Number(value ?? 0);
                    if (name === "count") {
                      return [
                        `${numericValue} stk (${Number(props?.payload?.pct ?? 0).toFixed(1)}%)`,
                        props?.payload?.name === "Wet" ? "Wet" : "Clean",
                      ];
                    }
                    return [String(value), String(name)];
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeWidth={2} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {wetBreakdownData.map((entry, i) => (
                    <Cell key={i} fill={entry.name === "Wet" ? "#38bdf8" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card u-mb-md session__chart-card">
        <h2 className="session__chart-title">Tidsfordeling</h2>
        <div className="session__chart-desc">
          Røde og gule prikker markerer henholdsvis kryss og notat.
        </div>
        <div className="session__chart-area--lg">
          <ResponsiveContainer width="100%" height={420} minWidth={1} minHeight={420}>
            <BarChart data={sessionStats.attempts} margin={{ top: 20, right: 10, bottom: 20, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="name"
                stroke="var(--text)"
                tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                tickMargin={8}
                minTickGap={12}
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis
                stroke="var(--text)"
                tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                width={56}
                tickFormatter={(v: any) => `${v}s`}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                wrapperClassName="session__recharts-tooltip"
                formatter={(value: any, name: any) => {
                  if (name === "seconds") return [fmtSeconds(Number(value ?? 0)), "Tid"];
                  return [String(value), String(name ?? "")];
                }}
              />
              {sessionStats.avgTime !== null && (
                <ReferenceLine
                  y={sessionStats.avgTime}
                  stroke="rgba(250,204,21,0.85)"
                  strokeDasharray="6 6"
                  label={{
                    value: `Snitt ${sessionStats.avgTime.toFixed(2)}s`,
                    position: "insideTopRight",
                    fill: "#facc15",
                    fontSize: 12,
                  }}
                />
              )}
              <Bar dataKey="seconds" fill="var(--accent)" radius={[8, 8, 0, 0]}>
                {sessionStats.attempts.map((entry, i) => (
                  <Cell key={i} fill={getColor(entry.name)} />
                ))}
                <LabelList dataKey="name" content={<CustomBarLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Kryss og anmerkninger</h2>
        {groupedViolations.length === 0 ? (
          <p className="u-text-center u-text-muted session__violations-empty">
            En helt ren dag! 🎉
          </p>
        ) : (
          <div className="tableWrap session__violations-wrap">
            <table className="session__violations-table">
              <thead>
                <tr>
                  <th className="session__violations-th">Navn</th>
                  <th className="session__violations-th">Koder</th>
                  <th className="session__violations-th">Totalt kryss</th>
                  <th className="session__violations-th">Notater</th>
                </tr>
              </thead>
              <tbody>
                {groupedViolations.map((v) => (
                  <tr key={v.participantId} className="session__violations-row">
                    <td className="session__violations-td">
                      <button
                        type="button"
                        className="session__table-person-link"
                        onClick={() => nav(`/person/${v.participantId}`)}
                      >
                        {v.name}
                      </button>
                    </td>
                    <td className="session__violations-td">
                      <div className="u-flex u-flex-wrap session__violations-code-list">
                        {v.codes.map((code, idx) => (
                          <span
                            key={idx}
                            className={`badge session__rule-code ${ruleCodeClass(code)}`}
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="session__violations-td session__violations-crosses">
                      {v.totalCrosses}
                    </td>
                    <td className="session__violations-td session__violations-notes">
                      {v.notes.join(" | ") || "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
