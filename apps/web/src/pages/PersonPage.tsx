import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
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

const EMPTY_PROFILE_RANKING: ProfileRanking = {
  bestCleanRank: null,
  violationCount: 0,
  violationRank: null,
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
  profileRanking?: ProfileRanking;
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

function countViolationsFromPoints(points: Point[]) {
  return points.reduce((total, point) => {
    if (!point.note) return total;

    const count = point.note
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean).length;

    return total + count;
  }, 0);
}

const PERSON_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
];

function personColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PERSON_PALETTE[Math.abs(hash) % PERSON_PALETTE.length];
}

function personInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

const SEMESTER_LABEL: Record<Semester, string> = {
  "2025H": "2025 Høst",
  "2026V": "2026 Vår",
  all: "Total",
};

const COMPARE_COLORS = [
  "#f59e0b", "#06b6d4", "#a855f7", "#10b981", "#ec4899", "#f87171", "#84cc16",
];

export function PersonPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<Resp | null>(null);

  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareDataMap, setCompareDataMap] = useState<Record<string, Resp>>({});

  type Peer = {
    id: string; name: string; isRegular: boolean;
    attempts: number; avg: number; best: number; bestClean: number | null; stddev: number;
  };
  const [peers, setPeers] = useState<Peer[]>([]);


  // 0. Nullstill data ved bytte av aktiv person, og fjern aktiv fra sammenligningslista
  useEffect(() => {
    setData(null);
    setCompareDataMap({});
    setCompareIds((prev) => prev.filter((cid) => String(cid) !== String(id)));
  }, [id]);

  // Når semester endres: invalidér cache for sammenligninger så de re-hentes
  useEffect(() => {
    setCompareDataMap({});
  }, [semester]);

  // 1. Hent alle deltakere for sammenligning
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/participants?includeGuests=true`);
        const json = await res.json();
        if (cancelled) return;

        const list = json
          .filter((r: any) => {
            if (String(r.id) === String(id)) return false;
            return r.isRegular || (r.attempts >= 4);
          })
          .map((r: any) => ({
            id: String(r.id),
            name: r.isRegular ? r.name : `${r.name} (Gjest)`,
          }));

        const uniqueList = Array.from(new Map(list.map((item: any) => [item.id, item])).values())
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        setParticipants(uniqueList as { id: string; name: string }[]);
      } catch (e) {
        console.error("Kunne ikke hente deltakere", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 2. Hent hovedpersonens data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch(`/api/person/${id}?semester=${semester}`);
      const json: Resp = await res.json();
      if (cancelled) return;
      setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, semester]);

  // 2b. Hent peer-aggregater for percentile & konsistens-score
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          `/api/stats/peers?semester=${semester}&includeGuests=true`
        );
        const json = await res.json();
        if (cancelled) return;
        setPeers(Array.isArray(json.peers) ? json.peers : []);
      } catch (e) {
        console.error("Kunne ikke hente peer-stats", e);
        if (!cancelled) setPeers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [semester]);

  // 3. Hent data for alle sammenligningspersoner
  useEffect(() => {
    const wanted = compareIds.filter((cid) => String(cid) !== String(id));
    if (wanted.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        wanted.map(async (cid) => {
          const res = await apiFetch(`/api/person/${cid}?semester=${semester}`);
          const json: Resp = await res.json();
          return [cid, json] as const;
        })
      );
      if (cancelled) return;
      setCompareDataMap((prev) => {
        const next: Record<string, Resp> = {};
        for (const cid of wanted) {
          if (prev[cid]) next[cid] = prev[cid];
        }
        for (const [cid, json] of results) next[cid] = json;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [compareIds, semester, id]);

  const compares: Resp[] = useMemo(
    () =>
      compareIds
        .map((cid) => compareDataMap[cid])
        .filter((c): c is Resp => Boolean(c)),
    [compareIds, compareDataMap]
  );

  const chartData = useMemo(() => {
    if (!data) return [];

    if (compares.length === 0) {
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
    const addData = (points: Point[], pid: string) => {
      points.forEach(p => {
        const d = fmtDDMMYYYY(p.dateISO);
        if (!dateMap.has(d)) {
          dateMap.set(d, { dateISO: p.dateISO, date: d });
        }
        dateMap.get(d)[`s_${pid}`] = p.seconds;
        dateMap.get(d)[`sid_${pid}`] = p.sessionId;
      });
    };
    addData(data.points, data.participant.id);
    compares.forEach((c) => addData(c.points, c.participant.id));

    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );
  }, [data, compares]);

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
  const profileRanking = data.profileRanking ?? {
    ...EMPTY_PROFILE_RANKING,
    violationCount: countViolationsFromPoints(data.points),
  };
  const rankingQuery = new URLSearchParams({ semester });
  if (!p.isRegular) {
    rankingQuery.set("includeGuests", "1");
  }
  const violationsHref = `/violations?${rankingQuery.toString()}`;
  const leaderboardHref = `/leaderboard?${rankingQuery.toString()}`;

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

  let headToHeadVolume = "";
  headToHeadVolume;

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

  // --- Multi-person scoreboard ---
  type BoardPerson = {
    id: string;
    name: string;
    imageUrl: string | null;
    color: string;
    isMain: boolean;
    points: Point[];
    stats: Resp["stats"];
    violationCount: number;
  };
  type BoardMetric = {
    key: string;
    label: string;
    icon: string;
    lowerBetter: boolean;
    compute: (p: BoardPerson) => number | null;
    format: (v: number | null) => string;
  };

  const stdDev = (pts: Point[]) => {
    if (pts.length < 2) return null;
    const mean = pts.reduce((s, pt) => s + pt.seconds, 0) / pts.length;
    return Math.sqrt(pts.reduce((s, pt) => s + (pt.seconds - mean) ** 2, 0) / pts.length);
  };
  const computeMedian = (pts: Point[]) => {
    if (!pts.length) return null;
    const sorted = pts.map((pt) => pt.seconds).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };
  const computeLast3Avg = (pts: Point[]) => {
    if (!pts.length) return null;
    const last3 = pts.slice(-3);
    return last3.reduce((s, pt) => s + pt.seconds, 0) / last3.length;
  };
  const computeSlope = (pts: Point[]) => {
    if (pts.length < 2) return null;
    const n = pts.length;
    const sumX = pts.map((_, i) => i).reduce((a, b) => a + b, 0);
    const sumY = pts.reduce((a, pt) => a + pt.seconds, 0);
    const sumXY = pts.map((pt, i) => i * pt.seconds).reduce((a, b) => a + b, 0);
    const sumXX = pts.map((_, i) => i * i).reduce((a, b) => a + b, 0);
    const denom = n * sumXX - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  };
  const computeSpread = (pts: Point[]) => {
    if (pts.length < 2) return null;
    const xs = pts.map((pt) => pt.seconds);
    return Math.max(...xs) - Math.min(...xs);
  };

  const personsBoard: BoardPerson[] = data
    ? [
        {
          id: String(data.participant.id),
          name: data.participant.name,
          imageUrl: data.participant.imageUrl ?? null,
          color: personColor(data.participant.name),
          isMain: true,
          points: data.points,
          stats: data.stats,
          violationCount:
            (data.profileRanking?.violationCount ??
              countViolationsFromPoints(data.points)) ?? 0,
        },
        ...compares.map((c, i) => ({
          id: String(c.participant.id),
          name: c.participant.name,
          imageUrl: c.participant.imageUrl ?? null,
          color: COMPARE_COLORS[i % COMPARE_COLORS.length],
          isMain: false,
          points: c.points,
          stats: c.stats,
          violationCount:
            (c.profileRanking?.violationCount ??
              countViolationsFromPoints(c.points)) ?? 0,
        })),
      ]
    : [];

  const fmtSecOrDash = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}s`);
  const fmtIntOrDash = (v: number | null) => (v == null ? "—" : String(v));
  const fmtSignedSec = (v: number | null) => {
    if (v == null) return "—";
    if (v === 0) return "0.00s";
    return `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(2)}s`;
  };

  const boardMetrics: BoardMetric[] = [
    { key: "avg", label: "Snitt", icon: "⚖️", lowerBetter: true,
      compute: (p) => p.stats.avg ?? null, format: fmtSecOrDash },
    { key: "bestClean", label: "Beste rene tid", icon: "🏆", lowerBetter: true,
      compute: (p) => p.stats.bestClean ?? null, format: fmtSecOrDash },
    { key: "best", label: "Raskeste forsøk", icon: "⚡", lowerBetter: true,
      compute: (p) => p.stats.best ?? null, format: fmtSecOrDash },
    { key: "slowest", label: "Tregeste forsøk", icon: "🐌", lowerBetter: true,
      compute: (p) => p.points.length ? Math.max(...p.points.map((pt) => pt.seconds)) : null,
      format: fmtSecOrDash },
    { key: "median", label: "Median", icon: "📐", lowerBetter: true,
      compute: (p) => computeMedian(p.points), format: fmtSecOrDash },
    { key: "form", label: "Form siste 3", icon: "🔥", lowerBetter: true,
      compute: (p) => computeLast3Avg(p.points), format: fmtSecOrDash },
    { key: "stddev", label: "Konsistens (±)", icon: "📊", lowerBetter: true,
      compute: (p) => stdDev(p.points), format: fmtSecOrDash },
    { key: "spread", label: "Spenn", icon: "↔️", lowerBetter: true,
      compute: (p) => computeSpread(p.points), format: fmtSecOrDash },
    { key: "slope", label: "Trend per forsøk", icon: "📈", lowerBetter: true,
      compute: (p) => computeSlope(p.points), format: fmtSignedSec },
    { key: "attempts", label: "Antall forsøk", icon: "🎯", lowerBetter: false,
      compute: (p) => p.points.length, format: fmtIntOrDash },
    { key: "violations", label: "Antall kryss", icon: "❌", lowerBetter: true,
      compute: (p) => p.violationCount, format: fmtIntOrDash },
  ];

  const boardRows = boardMetrics.map((m) => {
    const values = personsBoard.map((per) => m.compute(per));
    const nonNull = values.filter((v): v is number => v != null);
    let bestVal: number | null = null;
    if (nonNull.length) {
      bestVal = m.lowerBetter ? Math.min(...nonNull) : Math.max(...nonNull);
    }
    const winners = bestVal == null ? new Set<number>() :
      new Set(values.map((v, i) => (v === bestVal ? i : -1)).filter((i) => i >= 0));
    return { metric: m, values, bestVal, winners };
  });

  const winTally: Record<string, number> = {};
  personsBoard.forEach((per) => { winTally[per.id] = 0; });
  boardRows.forEach((row) => {
    // Only count when there's a unique winner
    if (row.winners.size === 1) {
      const idx = Array.from(row.winners)[0];
      const winner = personsBoard[idx];
      if (winner) winTally[winner.id] = (winTally[winner.id] ?? 0) + 1;
    }
  });

  const leaderEntry = personsBoard.length
    ? [...personsBoard].sort((a, b) => (winTally[b.id] ?? 0) - (winTally[a.id] ?? 0))[0]
    : null;

  // --- Head-to-head (per sammenligning, basert på felles sesjoner) ---
  type H2HMatch = {
    sessionId: string;
    dateISO: string;
    meSec: number;
    themSec: number;
    winner: "me" | "them" | "tie";
  };
  type H2H = {
    id: string;
    name: string;
    color: string;
    imageUrl: string | null;
    meetings: number;
    meWins: number;
    themWins: number;
    ties: number;
    meAvg: number | null;
    themAvg: number | null;
    matches: H2HMatch[];
  };
  const headToHead: H2H[] = compares.map((c, i) => {
    const mineBySession = new Map<string, { sec: number; dateISO: string }>();
    data.points.forEach((pt) =>
      mineBySession.set(pt.sessionId, { sec: pt.seconds, dateISO: pt.dateISO })
    );
    let meetings = 0, meWins = 0, themWins = 0, ties = 0;
    let meSum = 0, themSum = 0;
    const matches: H2HMatch[] = [];
    c.points.forEach((pt) => {
      const my = mineBySession.get(pt.sessionId);
      if (!my) return;
      meetings++;
      meSum += my.sec;
      themSum += pt.seconds;
      const winner: "me" | "them" | "tie" =
        my.sec < pt.seconds ? "me" : my.sec > pt.seconds ? "them" : "tie";
      if (winner === "me") meWins++;
      else if (winner === "them") themWins++;
      else ties++;
      matches.push({
        sessionId: pt.sessionId,
        dateISO: my.dateISO,
        meSec: my.sec,
        themSec: pt.seconds,
        winner,
      });
    });
    matches.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
    return {
      id: String(c.participant.id),
      name: c.participant.name,
      color: COMPARE_COLORS[i % COMPARE_COLORS.length],
      imageUrl: c.participant.imageUrl ?? null,
      meetings,
      meWins,
      themWins,
      ties,
      meAvg: meetings ? meSum / meetings : null,
      themAvg: meetings ? themSum / meetings : null,
      matches,
    };
  });

  // --- Insights & distribution (solo storyline) ---
  type Insight = {
    key: string;
    icon: string;
    label: string;
    value: string;
    sub?: string;
    tone?: "accent" | "better" | "worse" | "neutral" | "fun";
  };
  const insights: Insight[] = [];
  const distBins: { label: string; count: number; mid: number }[] = [];
  let pbCount = 0;
  let longestImproveStreak = 0;
  let cleanRate: number | null = null;
  let totalChugSeconds = 0;
  let mostCommonRule: { code: string; count: number } | null = null;
  let daysActive: number | null = null;
  let typicalRange: number | null = null;

  if (data.points.length > 0) {
    // Total chug time
    totalChugSeconds = data.points.reduce((s, pt) => s + pt.seconds, 0);

    // PB count (running clean PB)
    let runningPb = Infinity;
    data.points.forEach((pt) => {
      const isClean = !pt.note || !pt.note.trim();
      if (isClean && pt.seconds < runningPb) {
        runningPb = pt.seconds;
        pbCount++;
      }
    });
    // First clean attempt shouldn't count as "knust" — subtract 1 if we counted it
    if (pbCount > 0) pbCount = pbCount - 1;

    // Longest improvement streak (consecutive attempts where each is faster than previous)
    let cur = 0;
    for (let i = 1; i < data.points.length; i++) {
      if (data.points[i].seconds < data.points[i - 1].seconds) {
        cur++;
        if (cur > longestImproveStreak) longestImproveStreak = cur;
      } else {
        cur = 0;
      }
    }

    // Best weekday
    // (Removed: alle chugs er fredager.)

    // Clean rate
    const cleanCount = data.points.filter((pt) => !pt.note || !pt.note.trim()).length;
    cleanRate = (cleanCount / data.points.length) * 100;

    // Most common rule
    const ruleCounts: Record<string, number> = {};
    data.points.forEach((pt) => {
      if (!pt.note) return;
      pt.note.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean).forEach((code) => {
        ruleCounts[code] = (ruleCounts[code] ?? 0) + 1;
      });
    });
    const ruleEntries = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]);
    if (ruleEntries.length) mostCommonRule = { code: ruleEntries[0][0], count: ruleEntries[0][1] };

    // Days active (calendar span)
    if (data.points.length >= 2) {
      const first = new Date(data.points[0].dateISO).getTime();
      const last = new Date(data.points[data.points.length - 1].dateISO).getTime();
      daysActive = Math.max(1, Math.round((last - first) / (1000 * 60 * 60 * 24)));
    }

    // Typical range = std dev shorthand
    typicalRange = standardDeviation;

    // Distribution histogram (8 bins from min..max)
    if (data.points.length >= 3) {
      const times = data.points.map((pt) => pt.seconds);
      const lo = Math.min(...times);
      const hi = Math.max(...times);
      const span = hi - lo;
      const binCount = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(times.length))));
      if (span > 0) {
        const step = span / binCount;
        for (let i = 0; i < binCount; i++) {
          const a = lo + step * i;
          const b = lo + step * (i + 1);
          const isLast = i === binCount - 1;
          const count = times.filter((t) => t >= a && (isLast ? t <= b : t < b)).length;
          distBins.push({
            label: `${a.toFixed(1)}–${b.toFixed(1)}s`,
            count,
            mid: (a + b) / 2,
          });
        }
      }
    }

    // Build insight cards
    if (pbCount > 0) {
      insights.push({
        key: "pb",
        icon: "🔥",
        label: "PB knust",
        value: String(pbCount),
        sub: pbCount === 1 ? "gang i perioden" : "ganger i perioden",
        tone: "better",
      });
    }
    if (data.points.length >= 2) {
      const first = data.points[0].seconds;
      const last = data.points[data.points.length - 1].seconds;
      const pct = ((first - last) / first) * 100;
      insights.push({
        key: "improve",
        icon: pct > 0 ? "📈" : pct < 0 ? "📉" : "➖",
        label: "Endring siden start",
        value: `${pct > 0 ? "−" : pct < 0 ? "+" : ""}${Math.abs(pct).toFixed(1)}%`,
        sub: `${first.toFixed(2)}s → ${last.toFixed(2)}s`,
        tone: pct > 1 ? "better" : pct < -1 ? "worse" : "neutral",
      });
    }
    if (longestImproveStreak >= 2) {
      insights.push({
        key: "streak",
        icon: "🚀",
        label: "Lengste forbedring",
        value: `${longestImproveStreak + 1}`,
        sub: "forsøk på rad raskere",
        tone: "accent",
      });
    }
    if (cleanRate != null) {
      const dirtyCount = data.points.length - data.points.filter((pt) => !pt.note || !pt.note.trim()).length;
      insights.push({
        key: "clean",
        icon: cleanRate >= 80 ? "🎯" : cleanRate >= 50 ? "😅" : "💧",
        label: "Rene forsøk",
        value: `${cleanRate.toFixed(0)}%`,
        sub: dirtyCount === 0 ? "ingen anmerkninger" : `${dirtyCount} med anmerkning`,
        tone: cleanRate >= 80 ? "better" : cleanRate < 50 ? "worse" : "neutral",
      });
    }
    if (mostCommonRule) {
      insights.push({
        key: "rule",
        icon: "⚠️",
        label: "Hyppigste anmerkning",
        value: mostCommonRule.code,
        sub: `${mostCommonRule.count} gang${mostCommonRule.count === 1 ? "" : "er"}`,
        tone: "worse",
      });
    }
    if (totalChugSeconds > 0) {
      const mins = Math.floor(totalChugSeconds / 60);
      const secs = Math.round(totalChugSeconds - mins * 60);
      insights.push({
        key: "total",
        icon: "⏱️",
        label: "Total tid chugget",
        value: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
        sub: `${data.points.length} forsøk totalt`,
        tone: "neutral",
      });
    }
    if (daysActive != null) {
      insights.push({
        key: "active",
        icon: "📅",
        label: "Aktiv periode",
        value: `${daysActive} dager`,
        sub: `${(data.points.length / Math.max(1, daysActive / 30)).toFixed(1)} forsøk/mnd`,
        tone: "fun",
      });
    }
    if (typicalRange != null) {
      insights.push({
        key: "spread",
        icon: "📊",
        label: "Typisk variasjon",
        value: `±${typicalRange.toFixed(2)}s`,
        sub: "fra ditt snitt",
        tone: "neutral",
      });
    }

    // Percentile rank (basert på beste rene tid, fallback til snitt)
    if (peers.length >= 3) {
      const meId = String(p.id);
      const me = peers.find((pr) => String(pr.id) === meId);
      const usingBestClean = me?.bestClean != null;
      const metricKey: "bestClean" | "avg" = usingBestClean ? "bestClean" : "avg";
      const myVal = usingBestClean ? me!.bestClean! : me?.avg;
      if (myVal != null) {
        const others = peers
          .filter((pr) => String(pr.id) !== meId)
          .map((pr) => (metricKey === "bestClean" ? pr.bestClean : pr.avg))
          .filter((v): v is number => v != null);
        if (others.length >= 2) {
          const slower = others.filter((v) => v > myVal).length;
          const pct = Math.round((slower / others.length) * 100);
          insights.push({
            key: "percentile",
            icon: pct >= 75 ? "🥇" : pct >= 50 ? "🥈" : pct >= 25 ? "🥉" : "📍",
            label: usingBestClean ? "Prosentil (PB)" : "Prosentil (snitt)",
            value: `${pct}%`,
            sub: `slår ${slower} av ${others.length} chuggere`,
            tone: pct >= 75 ? "better" : pct >= 25 ? "neutral" : "worse",
          });
        }

        // Konsistens-score (0-100, basert på stddev relativt til peer-gruppa)
        const myStd = me?.stddev;
        const otherStds = peers
          .filter((pr) => String(pr.id) !== meId)
          .map((pr) => pr.stddev)
          .filter((v): v is number => Number.isFinite(v) && v > 0);
        if (myStd != null && Number.isFinite(myStd) && otherStds.length >= 2) {
          const all = [...otherStds, myStd];
          const lo = Math.min(...all);
          const hi = Math.max(...all);
          const span = hi - lo || 1;
          // Lavere stddev = høyere score
          const score = Math.round((1 - (myStd - lo) / span) * 100);
          insights.push({
            key: "consistency-score",
            icon: score >= 75 ? "🎯" : score >= 50 ? "🧘" : "🌪️",
            label: "Konsistens-score",
            value: `${score}/100`,
            sub: `±${myStd.toFixed(2)}s vs gruppa`,
            tone: score >= 75 ? "better" : score >= 40 ? "neutral" : "worse",
          });
        }
      }
    }
  }

  // --- Derived UI values ---
  const accent = personColor(p.name);
  const initials = personInitials(p.name);
  const semesterLabel = SEMESTER_LABEL[semester];
  const earnedBadges = (data.badges ?? []).filter((b) => b.earned).length;
  const totalBadges = (data.badges ?? []).length;

  const pbPoint =
    bestClean != null ? data.points.find((pt) => pt.seconds === bestClean) ?? null : null;

  const trendChip =
    trendPerAttempt == null
      ? null
      : trendPerAttempt < -0.005
        ? {
            icon: "📈",
            text: `${Math.abs(trendPerAttempt).toFixed(2)}s raskere per forsøk`,
            tone: "better" as const,
          }
        : trendPerAttempt > 0.005
          ? {
              icon: "📉",
              text: `${trendPerAttempt.toFixed(2)}s tregere per forsøk`,
              tone: "worse" as const,
            }
          : { icon: "➡️", text: "Stabil utvikling", tone: "neutral" as const };

  const highlights = [
    {
      key: "pb",
      icon: "🏆",
      label: "Personlig rekord",
      value: bestClean == null ? "—" : `${bestClean.toFixed(2)}s`,
      sub: pbPoint
        ? `${fmtDDMMYYYY(pbPoint.dateISO)}${
            profileRanking.bestCleanRank != null ? ` · #${profileRanking.bestCleanRank} totalt` : ""
          }`
        : "Ingen ren tid registrert",
      onClick: pbPoint ? () => nav(`/session/${pbPoint.sessionId}`) : undefined,
      tone: "gold" as const,
    },
    {
      key: "form",
      icon: "🔥",
      label: "Form siste 3",
      value: last3Avg == null ? "—" : `${last3Avg.toFixed(2)}s`,
      sub:
        recentVsAverage == null
          ? "—"
          : recentVsAverage > 0
            ? `${recentVsAverage.toFixed(2)}s raskere enn snitt`
            : recentVsAverage < 0
              ? `${Math.abs(recentVsAverage).toFixed(2)}s tregere enn snitt`
              : "Lik snittfart",
      tone:
        recentVsAverage == null
          ? ("neutral" as const)
          : recentVsAverage > 0
            ? ("better" as const)
            : recentVsAverage < 0
              ? ("worse" as const)
              : ("neutral" as const),
    },
    {
      key: "consistency",
      icon: "📊",
      label: "Konsistens",
      value: standardDeviation == null ? "—" : `±${standardDeviation.toFixed(2)}s`,
      sub: timeSpread == null ? "—" : `Spenn ${timeSpread.toFixed(2)}s`,
      tone: "neutral" as const,
    },
    {
      key: "projected",
      icon: "🎯",
      label: "Projisert neste",
      value: projectedNext == null ? "—" : `${projectedNext.toFixed(2)}s`,
      sub: trendChip ? trendChip.text : "—",
      tone: "accent" as const,
    },
  ];

  const detailStats = personsBoard.length > 1 ? performanceStats : performanceStats;
  detailStats;
  const isComparing = compares.length > 0;
  const availableForCompare = participants.filter(
    (pt) => String(pt.id) !== String(id) && !compareIds.includes(String(pt.id))
  );

  return (
    <div className="person" style={{ ["--person-accent" as any]: accent }}>
      {/* ── HERO ── */}
      <section className="person-hero card">
        <div className="person-hero__bg" aria-hidden="true" />
        <div className="person-hero__photo">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} />
          ) : (
            <span className="person-hero__initials">{initials || "?"}</span>
          )}
        </div>
        <div className="person-hero__info">
          <div className="person-hero__pills">
            <span className="person-hero__pill person-hero__pill--role">
              {p.isRegular ? "👑 Fast" : "🎉 Gjest"}
            </span>
            <span className="person-hero__pill">{semesterLabel}</span>
          </div>
          <h1 className="person-hero__name">{p.name}</h1>

          <div className="person-hero__quick">
            <div className="person-hero__stat">
              <div className="person-hero__stat-num">{data.stats.attempts}</div>
              <div className="person-hero__stat-lbl">Forsøk</div>
            </div>
            <div className="person-hero__stat">
              <div className="person-hero__stat-num">
                {data.stats.bestClean == null ? "—" : `${data.stats.bestClean.toFixed(2)}s`}
              </div>
              <div className="person-hero__stat-lbl">
                {profileRanking.bestCleanRank != null ? (
                  <Link to={leaderboardHref} className="person-hero__stat-link">
                    Beste · #{profileRanking.bestCleanRank}
                  </Link>
                ) : (
                  "Beste"
                )}
              </div>
            </div>
            <div className="person-hero__stat">
              <div className="person-hero__stat-num">
                {data.stats.avg == null ? "—" : `${data.stats.avg.toFixed(2)}s`}
              </div>
              <div className="person-hero__stat-lbl">Snitt</div>
            </div>
            <div className="person-hero__stat">
              <div className="person-hero__stat-num">{profileRanking.violationCount}</div>
              <div className="person-hero__stat-lbl">
                {profileRanking.violationRank != null ? (
                  <Link to={violationsHref} className="person-hero__stat-link">
                    Kryss · #{profileRanking.violationRank}
                  </Link>
                ) : (
                  "Kryss"
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TOOLBAR ── */}
      <div className="person-toolbar card">
        <div className="person-toolbar__group">
          <span className="person-toolbar__group-label">Sesong</span>
          <div className="person-toolbar__segment">
            <button
              className={`person-toolbar__seg-btn ${semester === "2025H" ? "is-active" : ""}`}
              onClick={() => setSemester("2025H")}
            >
              2025 Høst
            </button>
            <button
              className={`person-toolbar__seg-btn ${semester === "2026V" ? "is-active" : ""}`}
              onClick={() => setSemester("2026V")}
            >
              2026 Vår
            </button>
            <button
              className={`person-toolbar__seg-btn ${semester === "all" ? "is-active" : ""}`}
              onClick={() => setSemester("all")}
            >
              Total
            </button>
          </div>
        </div>

        <div className="person-toolbar__divider" aria-hidden="true" />

        <div className="person-toolbar__group person-toolbar__group--compare">
          <span className="person-toolbar__group-label">
            ⚔️ Sammenlign
          </span>

          <div className="person-toolbar__chips">
            {compareIds.length === 0 && (
              <span className="person-toolbar__empty">Ingen valgt</span>
            )}
            {compareIds.map((cid, i) => {
              const part = participants.find((pt) => String(pt.id) === String(cid));
              const name = part?.name ?? compareDataMap[cid]?.participant.name ?? "…";
              const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
              return (
                <span
                  key={cid}
                  className="person-toolbar__chip"
                  style={{ ["--chip-color" as any]: color }}
                >
                  <span className="person-toolbar__chip-dot" aria-hidden="true" />
                  <span className="person-toolbar__chip-name">{name}</span>
                  <button
                    type="button"
                    className="person-toolbar__chip-remove"
                    onClick={() => {
                      setCompareIds((prev) => prev.filter((x) => x !== cid));
                      setCompareDataMap((prev) => {
                        const next = { ...prev };
                        delete next[cid];
                        return next;
                      });
                    }}
                    aria-label={`Fjern ${name}`}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>

          <div className="person-toolbar__actions">
            {availableForCompare.length > 0 && (
              <select
                className="person-toolbar__add"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setCompareIds((prev) => [...prev, v]);
                }}
              >
                <option value="">+ Legg til</option>
                {availableForCompare.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                  </option>
                ))}
              </select>
            )}

            {compareIds.length > 0 && (
              <button
                type="button"
                className="person-toolbar__clear-icon"
                onClick={() => {
                  setCompareIds([]);
                  setCompareDataMap({});
                }}
                aria-label="Nullstill alle sammenligninger"
                title="Nullstill alle"
              >
                ↻
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── HIGHLIGHTS (solo only) ── */}
      {!isComparing && (
        <section className="person-highlights">
          {highlights.map((h) => (
            <article
              key={h.key}
              className={`card person-highlight person-highlight--${h.tone} ${
                h.onClick ? "person-highlight--clickable" : ""
              }`}
              onClick={h.onClick}
              role={h.onClick ? "button" : undefined}
              tabIndex={h.onClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (h.onClick && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  h.onClick();
                }
              }}
            >
              <div className="person-highlight__icon" aria-hidden="true">
                {h.icon}
              </div>
              <div className="person-highlight__body">
                <div className="person-highlight__label">{h.label}</div>
                <div className="person-highlight__value">{h.value}</div>
                <div className="person-highlight__sub">{h.sub}</div>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* ── SCOREBOARD ── */}
      {isComparing && (
        <section className="card person-board">
          <div className="person-board__head">
            <h2 className="u-mb-0">Sammenligning</h2>
            {leaderEntry && (winTally[leaderEntry.id] ?? 0) > 0 && (
              <span className="person-board__leader">
                👑 {leaderEntry.name} leder ({winTally[leaderEntry.id]} kategori
                {winTally[leaderEntry.id] === 1 ? "" : "er"})
              </span>
            )}
          </div>

          <div className="person-board__scroll">
            <table className="person-board__table">
              <thead>
                <tr>
                  <th className="person-board__metric-col">Metrikk</th>
                  {personsBoard.map((per) => (
                    <th
                      key={per.id}
                      className={`person-board__person-col ${
                        per.isMain ? "person-board__person-col--main" : ""
                      }`}
                      style={{ ["--col-color" as any]: per.color }}
                    >
                      <div className="person-board__person">
                        <button
                          type="button"
                          className="person-board__avatar"
                          onClick={() => !per.isMain && nav(`/person/${per.id}`)}
                          aria-label={per.isMain ? per.name : `Gå til ${per.name}`}
                          disabled={per.isMain}
                          style={{ borderColor: per.color }}
                        >
                          {per.imageUrl ? (
                            <img src={per.imageUrl} alt={per.name} />
                          ) : (
                            <span style={{ color: per.color }}>
                              {personInitials(per.name) || "?"}
                            </span>
                          )}
                        </button>
                        <div className="person-board__person-name">{per.name}</div>
                        <div className="person-board__person-wins">
                          {winTally[per.id] ?? 0} 👑
                        </div>
                        {!per.isMain && (
                          <button
                            type="button"
                            className="person-board__remove"
                            onClick={() => {
                              const pid = String(per.id);
                              setCompareIds((prev) =>
                                prev.filter((x) => String(x) !== pid)
                              );
                              setCompareDataMap((prev) => {
                                const next = { ...prev };
                                delete next[pid];
                                return next;
                              });
                            }}
                            aria-label={`Fjern ${per.name}`}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boardRows.map((row) => (
                  <tr key={row.metric.key}>
                    <th scope="row" className="person-board__metric">
                      <span className="person-board__metric-icon" aria-hidden>
                        {row.metric.icon}
                      </span>
                      <span>{row.metric.label}</span>
                    </th>
                    {row.values.map((v, i) => {
                      const isWinner =
                        row.winners.has(i) && row.winners.size < personsBoard.length;
                      return (
                        <td
                          key={personsBoard[i].id}
                          className={`person-board__cell ${
                            isWinner ? "person-board__cell--win" : ""
                          }`}
                          style={
                            isWinner
                              ? { ["--col-color" as any]: personsBoard[i].color }
                              : undefined
                          }
                        >
                          {row.metric.format(v)}
                          {isWinner && (
                            <span className="person-board__crown" aria-hidden>
                              👑
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── HEAD-TO-HEAD (compare only) ── */}
      {isComparing && headToHead.some((h) => h.meetings > 0) && (
        <section className="card person-h2h">
          <div className="person-h2h__head">
            <h2 className="u-mb-0">⚔️ Head-to-head</h2>
            <span className="person-h2h__sub">
              Kun sesjoner hvor dere begge var med
            </span>
          </div>
          <div className="person-h2h__grid">
            {headToHead
              .filter((h) => h.meetings > 0)
              .map((h) => {
                const winPct = h.meetings ? (h.meWins / h.meetings) * 100 : 0;
                const themPct = h.meetings ? (h.themWins / h.meetings) * 100 : 0;
                const tiePct = 100 - winPct - themPct;
                const leading =
                  h.meWins > h.themWins
                    ? "me"
                    : h.meWins < h.themWins
                      ? "them"
                      : "tie";
                return (
                  <article
                    key={h.id}
                    className={`person-h2h__card person-h2h__card--${leading}`}
                    style={{ ["--h2h-color" as any]: h.color }}
                  >
                    <header className="person-h2h__head-row">
                      <button
                        type="button"
                        className="person-h2h__avatar"
                        onClick={() => nav(`/person/${h.id}`)}
                        aria-label={`Gå til ${h.name}`}
                        style={{ borderColor: h.color }}
                      >
                        {h.imageUrl ? (
                          <img src={h.imageUrl} alt={h.name} />
                        ) : (
                          <span style={{ color: h.color }}>
                            {personInitials(h.name) || "?"}
                          </span>
                        )}
                      </button>
                      <div className="person-h2h__title">
                        <div className="person-h2h__vs">
                          <span>{p.name.split(/\s+/)[0]}</span>
                          <span className="person-h2h__vs-x">vs</span>
                          <span style={{ color: h.color }}>{h.name}</span>
                        </div>
                        <div className="person-h2h__meet">
                          {h.meetings} møte{h.meetings === 1 ? "" : "r"}
                        </div>
                      </div>
                    </header>

                    <div className="person-h2h__score">
                      <div className="person-h2h__score-side person-h2h__score-side--me">
                        <div className="person-h2h__num">{h.meWins}</div>
                        <div className="person-h2h__lbl">{p.name.split(/\s+/)[0]}</div>
                      </div>
                      {h.ties > 0 && (
                        <div className="person-h2h__score-side person-h2h__score-side--tie">
                          <div className="person-h2h__num">{h.ties}</div>
                          <div className="person-h2h__lbl">uavgjort</div>
                        </div>
                      )}
                      <div className="person-h2h__score-side person-h2h__score-side--them">
                        <div className="person-h2h__num">{h.themWins}</div>
                        <div className="person-h2h__lbl">{h.name.split(/\s+/)[0]}</div>
                      </div>
                    </div>

                    <div
                      className="person-h2h__bar"
                      role="img"
                      aria-label={`${h.meWins} mot ${h.themWins}`}
                    >
                      <span
                        className="person-h2h__bar-seg person-h2h__bar-seg--me"
                        style={{ width: `${winPct}%` }}
                      />
                      {tiePct > 0 && (
                        <span
                          className="person-h2h__bar-seg person-h2h__bar-seg--tie"
                          style={{ width: `${tiePct}%` }}
                        />
                      )}
                      <span
                        className="person-h2h__bar-seg person-h2h__bar-seg--them"
                        style={{ width: `${themPct}%` }}
                      />
                    </div>

                    <div className="person-h2h__avg">
                      <span>
                        Snitt {p.name.split(/\s+/)[0]}:{" "}
                        <strong>
                          {h.meAvg == null ? "—" : `${h.meAvg.toFixed(2)}s`}
                        </strong>
                      </span>
                      <span>
                        Snitt {h.name.split(/\s+/)[0]}:{" "}
                        <strong style={{ color: h.color }}>
                          {h.themAvg == null ? "—" : `${h.themAvg.toFixed(2)}s`}
                        </strong>
                      </span>
                    </div>

                    {h.matches.length > 0 && (
                      <ul className="person-h2h__matches">
                        {h.matches.map((m) => {
                          const diff = Math.abs(m.meSec - m.themSec);
                          return (
                            <li
                              key={m.sessionId}
                              className={`person-h2h__match person-h2h__match--${m.winner}`}
                              onClick={() => nav(`/session/${m.sessionId}`)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  nav(`/session/${m.sessionId}`);
                                }
                              }}
                              title={`Gå til økt ${fmtDDMMYYYY(m.dateISO)}`}
                            >
                              <span className="person-h2h__match-date">
                                {fmtDDMMYYYY(m.dateISO)}
                              </span>
                              <span className="person-h2h__match-times">
                                <span
                                  className={`person-h2h__match-sec ${
                                    m.winner === "me"
                                      ? "person-h2h__match-sec--win"
                                      : ""
                                  }`}
                                >
                                  {m.meSec.toFixed(2)}s
                                </span>
                                <span className="person-h2h__match-vs">vs</span>
                                <span
                                  className={`person-h2h__match-sec ${
                                    m.winner === "them"
                                      ? "person-h2h__match-sec--win"
                                      : ""
                                  }`}
                                  style={
                                    m.winner === "them"
                                      ? { color: h.color }
                                      : undefined
                                  }
                                >
                                  {m.themSec.toFixed(2)}s
                                </span>
                              </span>
                              <span className="person-h2h__match-diff">
                                {m.winner === "tie"
                                  ? "="
                                  : `${m.winner === "me" ? "−" : "+"}${diff.toFixed(2)}s`}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <div className="person-h2h__verdict">
                      {leading === "me" &&
                        `${p.name.split(/\s+/)[0]} leder ${h.meWins}–${h.themWins}`}
                      {leading === "them" &&
                        `${h.name.split(/\s+/)[0]} leder ${h.themWins}–${h.meWins}`}
                      {leading === "tie" && `Helt likt ${h.meWins}–${h.themWins}`}
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      )}

      {/* ── CHART ── */}
      <section className="card person-chart-card">
        <div className="person-chart-card__head">
          <h2 className="u-mb-0">Utvikling</h2>
          {trendChip && (
            <span className={`person-chart-card__chip person-chart-card__chip--${trendChip.tone}`}>
              <span aria-hidden="true">{trendChip.icon}</span> {trendChip.text}
            </span>
          )}
        </div>
        <div className="person-chart-card__area">
          <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={300}>
            <LineChart data={chartData} margin={{ top: 16, right: 20, bottom: 26, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
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
                  if (name === "seconds") return [`${Number(v).toFixed(2)}s`, p.name];
                  return [`${Number(v).toFixed(2)}s`, String(name)];
                }}
                labelFormatter={(label: any) => `${label}`}
              />

              {isComparing && <Legend verticalAlign="top" height={36} />}

              <Line
                name={p.name}
                type="monotone"
                dataKey={isComparing ? `s_${p.id}` : "seconds"}
                stroke={accent}
                strokeWidth={3}
                dot={{ r: 4, fill: accent, cursor: "pointer" }}
                activeDot={{
                  r: 6,
                  cursor: "pointer",
                  onClick: (_: any, payload: any) => {
                    const sid =
                      payload?.payload?.sessionId ||
                      payload?.payload?.[`sid_${p.id}`];
                    if (sid) nav(`/session/${sid}`);
                  },
                }}
                connectNulls
              />

              {!isComparing && (
                <Line
                  type="monotone"
                  dataKey="trend"
                  dot={false}
                  stroke="var(--accent2)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}

              {compares.map((c, i) => {
                const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
                return (
                  <Line
                    key={c.participant.id}
                    name={c.participant.name}
                    type="monotone"
                    dataKey={`s_${c.participant.id}`}
                    stroke={color}
                    strokeWidth={3}
                    dot={{ r: 4, fill: color, cursor: "pointer" }}
                    activeDot={{
                      r: 6,
                      cursor: "pointer",
                      onClick: (_: any, payload: any) => {
                        const sid = payload?.payload?.[`sid_${c.participant.id}`];
                        if (sid) nav(`/session/${sid}`);
                      },
                    }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── INSIGHTS ── */}
      {insights.length > 0 && (
        <section className="card person-insights">
          <div className="person-insights__head">
            <h2 className="u-mb-0">Innsikter</h2>
            {isComparing && (
              <span className="person-insights__sub">For {p.name}</span>
            )}
          </div>
          <div className="person-insights__grid">
            {insights.map((ins) => (
              <article
                key={ins.key}
                className={`person-insight person-insight--${ins.tone ?? "neutral"}`}
              >
                <div className="person-insight__icon" aria-hidden>{ins.icon}</div>
                <div className="person-insight__body">
                  <div className="person-insight__label">{ins.label}</div>
                  <div className="person-insight__value">{ins.value}</div>
                  {ins.sub && <div className="person-insight__sub">{ins.sub}</div>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── DISTRIBUTION (solo only) ── */}
      {!isComparing && distBins.length > 0 && data.stats.avg != null && (
        <section className="card person-dist">
          <div className="person-dist__head">
            <h2 className="u-mb-0">Tidsfordeling</h2>
            <span className="person-dist__sub">
              Hvor ofte du lander i hvert tidsintervall
            </span>
          </div>
          <div className="person-dist__chart">
            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={240}>
              <BarChart data={distBins} margin={{ top: 28, right: 16, bottom: 28, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--text)"
                  tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--text)"
                  tick={{ fill: "var(--text)", fontSize: 11, fontWeight: 600 }}
                  width={28}
                />
                <Tooltip
                  wrapperClassName="person__chart-tooltip"
                  cursor={{ fill: "rgba(99, 102, 241, 0.12)" }}
                  formatter={(v: any) => [`${v} forsøk`, "Antall"]}
                  labelFormatter={(label: any) => `Intervall: ${label}`}
                />
                <ReferenceLine
                  x={
                    distBins.reduce((closest, bin) =>
                      Math.abs(bin.mid - (data.stats.avg as number)) <
                      Math.abs(closest.mid - (data.stats.avg as number))
                        ? bin
                        : closest
                    ).label
                  }
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: `↓ Snitt ${(data.stats.avg as number).toFixed(2)}s`,
                    position: "insideTop",
                    fill: "#fbbf24",
                    fontSize: 12,
                    fontWeight: 800,
                    offset: 4,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {distBins.map((bin, i) => {
                    const isPbBucket = bestClean != null && bin.mid <= bestClean + (distBins[1]?.mid ?? bin.mid) - (distBins[0]?.mid ?? bin.mid);
                    return (
                      <Cell
                        key={i}
                        fill={isPbBucket ? accent : "rgba(99, 102, 241, 0.65)"}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── DETAIL STATS (solo only — scoreboard replaces this when comparing) ── */}
      {!isComparing && (
        <section className="card person-detail">
          <h2 className="u-mb-0 person-detail__title">Detaljert statistikk</h2>
          <div className="person-detail__grid">
            {detailStats.map((stat) => {
              const toneClass =
                stat.tone === "better"
                  ? "person-detail__card--better"
                  : stat.tone === "worse"
                    ? "person-detail__card--worse"
                    : stat.tone === "accent"
                      ? "person-detail__card--accent"
                      : "";
              return (
                <article key={stat.label} className={`person-detail__card ${toneClass}`}>
                  <div className="person-detail__label">{stat.label}</div>
                  <div className="person-detail__value">{stat.value}</div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── BADGES ── */}
      <section className="card person-badges-card">
        <div className="person-badges-card__head">
          <h2 className="u-mb-0">Badges</h2>
          <span className="person-badges-card__count">
            {earnedBadges} / {totalBadges} oppnådd
          </span>
        </div>
        <div className="person__badges-grid">
          {(data.badges ?? []).map((badge) => (
            <div
              key={badge.id}
              className={`person__badge ${
                badge.earned ? "person__badge--earned" : "person__badge--locked"
              }`}
              data-category={badge.category}
              data-tooltip={badge.description}
            >
              <BadgeMedal badgeId={badge.id} category={badge.category} icon={badge.icon} />
              <div className="person__badge-title">{badge.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HISTORY ── */}
      <section className="card">
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
                  <tr key={`${pt.dateISO}-${i}`} className={isPB ? "person__history-row--pb" : ""}>
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
                <tr>
                  <td colSpan={3} className="u-text-muted u-text-center person__history-empty">
                    Ingen data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
