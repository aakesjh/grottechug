import { Router } from "express";
import { prisma } from "../prisma.js";

export const wrappedRouter = Router();

/**
 * Grottechug Wrapped
 * ------------------
 * Year-scoped (a "grottekull") aggregation that powers the Spotify-Wrapped-style
 * group recap and the per-person recap.
 *
 *   GET /api/wrapped?semester=year|all|2025H|2026V
 *   GET /api/wrapped/person/:id?semester=year|all|2025H|2026V
 *
 * The "year" / kull is 2025H + 2026V. Default is "year".
 */

// The semesters that make up the current grottekull.
const YEAR_SEMESTERS = ["2025H", "2026V"];

// Codes that count as "søl"/wet (matches the rest of the app).
const WET_CODES = new Set(["W", "VW", "MM", "P", "T"]);

// One chug ≈ one half-litre beer. Surfaced in the payload so the UI can label it.
const LITRES_PER_CHUG = 0.5;

const RULE_LABELS: Record<string, string> = {
  DNS: "DNS-chug",
  DNF: "Tobias-chug",
  MM: "mm-chug",
  W: "w-chug",
  VW: "vw-chug",
  P: "p-chug",
  ABSENCE: "Fravær",
  VOMIT: "Oppkast",
  KPR: "KPR",
};

const NB_MONTHS = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];

function semesterLabel(semester: string): string {
  if (semester === "2025H") return "Høst 2025";
  if (semester === "2026V") return "Vår 2026";
  if (semester === "year") return "2025 / 2026";
  return "Tidenes";
}

function sessionWhere(semester: string) {
  if (semester === "year") return { semester: { in: YEAR_SEMESTERS } };
  if (semester === "all") return {};
  return { semester };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length);
}

function fmtDateLong(d: Date): string {
  return `${d.getDate()}. ${NB_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Per-person aggregate
// ---------------------------------------------------------------------------

type Point = {
  sessionId: string;
  dateISO: string;
  seconds: number;
  codes: string[];
  clean: boolean; // no violation, or MM-only (PB eligible)
  wet: boolean;
};

type PersonAgg = {
  id: string;
  name: string;
  isRegular: boolean;
  imageUrl: string | null;
  points: Point[]; // sorted by date asc
  n: number;
  totalSeconds: number;
  avg: number;
  best: number | null;
  bestClean: number | null;
  bestCleanDateISO: string | null;
  stddev: number;
  firstSeconds: number | null;
  improvement: number; // firstSeconds - bestClean (positive = improved)
  improvementPct: number; // relative to first
  attendance: number;
  crossesTotal: number;
  violationCount: number;
  crossByCode: Record<string, number>;
  wetCount: number;
  wetRate: number;
  bestComebackDrop: number; // biggest drop between two consecutive attempts
  bestComebackDateISO: string | null;
};

function isClean(codes: string[]) {
  return codes.length === 0 || codes.every((c) => c === "MM");
}
function isWet(codes: string[]) {
  return codes.some((c) => WET_CODES.has(c));
}

type SessionRow = { participantId: string; name: string; isRegular: boolean; seconds: number; codes: string[] };

type LoadedData = {
  semester: string;
  sessions: { id: string; dateISO: string; date: Date; semester: string; note: string | null }[];
  people: PersonAgg[];
  byId: Map<string, PersonAgg>;
  // session id -> attempts in that session
  bySession: Map<string, SessionRow[]>;
  allCleanSeconds: number[]; // for percentile calcs
  totalCrossesAll: number; // all crosses incl. fravær (independent of attempts)
  crossBreakdownAll: Record<string, number>; // code -> count, all violations
};

async function loadData(semester: string, includeGuests = true): Promise<LoadedData> {
  const sessionRows = await prisma.session.findMany({
    where: sessionWhere(semester),
    orderBy: { date: "asc" },
    select: { id: true, date: true, semester: true, note: true },
  });
  const sessionIds = sessionRows.map((s) => s.id);

  // "Bare faste" filters everything (attempts + violations) to regulars.
  const regularFilter = includeGuests ? {} : { participant: { isRegular: true } };

  const [attempts, violations] = await Promise.all([
    prisma.attempt.findMany({
      where: { sessionId: { in: sessionIds }, seconds: { gt: 0 }, ...regularFilter },
      include: {
        participant: { select: { id: true, name: true, isRegular: true, imageUrl: true } },
        session: { select: { id: true, date: true } },
      },
    }),
    prisma.violation.findMany({
      // Kryss are only counted for faste medlemmer — guests' violations are ignored.
      where: { sessionId: { in: sessionIds }, participant: { isRegular: true } },
      select: { participantId: true, sessionId: true, ruleCode: true, crosses: true },
    }),
  ]);

  // (participant, session) -> codes / crosses  (regulars only)
  const codeMap = new Map<string, { codes: string[]; crosses: number }>();
  // Cross tally per participant across ALL violations (incl. fravær on days
  // they never showed up — those have no Attempt row).
  const crossByParticipant = new Map<
    string,
    { crossesTotal: number; violationCount: number; crossByCode: Record<string, number> }
  >();
  const crossBreakdownAll: Record<string, number> = {};
  let totalCrossesAll = 0;
  for (const v of violations) {
    const code = v.ruleCode.toUpperCase();
    const key = `${v.participantId}:${v.sessionId}`;
    const entry = codeMap.get(key) ?? { codes: [], crosses: 0 };
    entry.codes.push(code);
    entry.crosses += v.crosses;
    codeMap.set(key, entry);

    const cp = crossByParticipant.get(v.participantId) ?? {
      crossesTotal: 0,
      violationCount: 0,
      crossByCode: {},
    };
    cp.crossesTotal += v.crosses;
    cp.violationCount += 1;
    cp.crossByCode[code] = (cp.crossByCode[code] ?? 0) + 1;
    crossByParticipant.set(v.participantId, cp);

    crossBreakdownAll[code] = (crossBreakdownAll[code] ?? 0) + 1;
    totalCrossesAll += v.crosses;
  }

  const byId = new Map<string, PersonAgg>();
  const bySession = new Map<string, SessionRow[]>();
  const allCleanSeconds: number[] = [];

  // attempts arrive unordered; sort by session date for per-person series
  const sortedAttempts = [...attempts].sort(
    (a, b) => a.session.date.getTime() - b.session.date.getTime(),
  );

  for (const a of sortedAttempts) {
    const key = `${a.participantId}:${a.sessionId}`;
    const meta = codeMap.get(key);
    const codes = meta?.codes ?? [];
    const clean = isClean(codes);
    const wet = isWet(codes);
    const dateISO = a.session.date.toISOString();

    if (clean) allCleanSeconds.push(a.seconds);

    let agg = byId.get(a.participantId);
    if (!agg) {
      agg = {
        id: a.participantId,
        name: a.participant.name,
        isRegular: a.participant.isRegular,
        imageUrl: a.participant.imageUrl ?? null,
        points: [],
        n: 0,
        totalSeconds: 0,
        avg: 0,
        best: null,
        bestClean: null,
        bestCleanDateISO: null,
        stddev: 0,
        firstSeconds: null,
        improvement: 0,
        improvementPct: 0,
        attendance: 0,
        crossesTotal: 0,
        violationCount: 0,
        crossByCode: {},
        wetCount: 0,
        wetRate: 0,
        bestComebackDrop: 0,
        bestComebackDateISO: null,
      };
      byId.set(a.participantId, agg);
    }

    agg.points.push({ sessionId: a.sessionId, dateISO, seconds: a.seconds, codes, clean, wet });
    agg.totalSeconds += a.seconds;
    agg.best = agg.best == null ? a.seconds : Math.min(agg.best, a.seconds);
    if (clean && (agg.bestClean == null || a.seconds < agg.bestClean)) {
      agg.bestClean = a.seconds;
      agg.bestCleanDateISO = dateISO;
    }
    if (wet) agg.wetCount += 1;
    // NB: crosses (incl. ABSENCE/fravær on days you did NOT chug) are tallied
    // separately below from the full violations list — not here.

    const sessRow = bySession.get(a.sessionId) ?? [];
    sessRow.push({
      participantId: a.participantId,
      name: a.participant.name,
      isRegular: a.participant.isRegular,
      seconds: a.seconds,
      codes,
    });
    bySession.set(a.sessionId, sessRow);
  }

  // Finalise per-person derived stats
  for (const agg of byId.values()) {
    agg.n = agg.points.length;
    agg.attendance = agg.n;
    agg.avg = agg.totalSeconds / Math.max(1, agg.n);
    agg.stddev = stddev(agg.points.map((p) => p.seconds));
    agg.firstSeconds = agg.points[0]?.seconds ?? null;
    agg.wetRate = agg.n ? (agg.wetCount / agg.n) * 100 : 0;

    const cp = crossByParticipant.get(agg.id);
    if (cp) {
      agg.crossesTotal = cp.crossesTotal;
      agg.violationCount = cp.violationCount;
      agg.crossByCode = cp.crossByCode;
    }

    if (agg.firstSeconds != null && agg.bestClean != null) {
      agg.improvement = agg.firstSeconds - agg.bestClean;
      agg.improvementPct = agg.firstSeconds > 0 ? (agg.improvement / agg.firstSeconds) * 100 : 0;
    }

    // biggest improvement between two consecutive attempts
    for (let i = 1; i < agg.points.length; i++) {
      const drop = agg.points[i - 1].seconds - agg.points[i].seconds;
      if (drop > agg.bestComebackDrop) {
        agg.bestComebackDrop = drop;
        agg.bestComebackDateISO = agg.points[i].dateISO;
      }
    }
  }

  return {
    semester,
    sessions: sessionRows.map((s) => ({
      id: s.id,
      dateISO: s.date.toISOString(),
      date: s.date,
      semester: s.semester,
      note: s.note,
    })),
    people: [...byId.values()],
    byId,
    bySession,
    allCleanSeconds: allCleanSeconds.sort((a, b) => a - b),
    totalCrossesAll,
    crossBreakdownAll,
  };
}

// ---------------------------------------------------------------------------
// Award helpers
// ---------------------------------------------------------------------------

type AwardWinner = {
  participantId: string;
  name: string;
  imageUrl: string | null;
  value: string; // formatted headline value
  detail: string; // supporting line
  coIds?: string[]; // all winners when shared (incl. primary)
  winners?: { participantId: string; name: string; imageUrl: string | null }[]; // for shared awards
} | null;

function pickMax(
  people: PersonAgg[],
  score: (p: PersonAgg) => number | null,
): { p: PersonAgg; score: number } | null {
  let best: { p: PersonAgg; score: number } | null = null;
  for (const p of people) {
    const s = score(p);
    if (s == null || !Number.isFinite(s)) continue;
    if (!best || s > best.score) best = { p, score: s };
  }
  return best;
}
function pickMin(
  people: PersonAgg[],
  score: (p: PersonAgg) => number | null,
): { p: PersonAgg; score: number } | null {
  let best: { p: PersonAgg; score: number } | null = null;
  for (const p of people) {
    const s = score(p);
    if (s == null || !Number.isFinite(s)) continue;
    if (!best || s < best.score) best = { p, score: s };
  }
  return best;
}

function fmtSec(v: number | null | undefined) {
  return v == null || Number.isNaN(v) ? "–" : `${v.toFixed(2)}s`;
}

function winner(p: PersonAgg, value: string, detail: string): AwardWinner {
  return { participantId: p.id, name: p.name, imageUrl: p.imageUrl, value, detail };
}

const firstName = (n: string) => n.split(/\s+/)[0];

/** All people tied at the max score (integer-ish awards where ties are common). */
function pickMaxTies(
  people: PersonAgg[],
  score: (p: PersonAgg) => number | null,
): { winners: PersonAgg[]; score: number } | null {
  let max = -Infinity;
  for (const p of people) {
    const s = score(p);
    if (s == null || !Number.isFinite(s)) continue;
    if (s > max) max = s;
  }
  if (!Number.isFinite(max) || max <= 0) return null;
  const winners = people.filter((p) => {
    const s = score(p);
    return s != null && Math.abs(s - max) < 1e-9;
  });
  return winners.length ? { winners, score: max } : null;
}

/** Build an award that may have several tied winners (shows "A & B", no avatar). */
function winnerTies(winners: PersonAgg[], value: string, detail: string): AwardWinner {
  const primary = winners[0];
  const shared = winners.length > 1;
  return {
    participantId: primary.id,
    name: shared ? winners.map((w) => firstName(w.name)).join(" & ") : primary.name,
    imageUrl: shared ? null : primary.imageUrl,
    value,
    detail: shared ? `Delt — ${detail}` : detail,
    coIds: winners.map((w) => w.id),
    winners: winners.map((w) => ({ participantId: w.id, name: w.name, imageUrl: w.imageUrl })),
  };
}

// ---------------------------------------------------------------------------
// Group computation
// ---------------------------------------------------------------------------

function computeGroup(data: LoadedData) {
  const { people, sessions } = data;
  const totalSessions = sessions.length;
  const allPoints = people.flatMap((p) => p.points);
  const chugs = allPoints.length;
  const totalSeconds = allPoints.reduce((s, p) => s + p.seconds, 0);
  const cleanPoints = allPoints.filter((p) => p.clean);
  const wetPoints = allPoints.filter((p) => p.wet);

  // Fastest clean ever (a real record) + slowest single time (roast)
  let fastestClean: { p: PersonAgg; pt: Point } | null = null;
  let slowest: { p: PersonAgg; pt: Point } | null = null;
  for (const p of people) {
    for (const pt of p.points) {
      if (pt.clean && (!fastestClean || pt.seconds < fastestClean.pt.seconds)) fastestClean = { p, pt };
      if (!slowest || pt.seconds > slowest.pt.seconds) slowest = { p, pt };
    }
  }

  const totalCrosses = data.totalCrossesAll;

  // Best-clean podium of the year
  const podium = people
    .filter((p) => p.bestClean != null)
    .sort((a, b) => (a.bestClean as number) - (b.bestClean as number))
    .slice(0, 3)
    .map((p) => ({
      participantId: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      seconds: p.bestClean as number,
      dateISO: p.bestCleanDateISO,
    }));

  // Eligibility helpers
  const active = (min: number) => people.filter((p) => p.n >= min);

  // ---- Celebratory awards ----
  const raskest = pickMin(people, (p) => p.bestClean);
  const mestForbedret = pickMax(active(3), (p) => (p.improvement > 0 ? p.improvement : null));
  const mestStabil = pickMin(active(4), (p) => p.stddev);
  const comeback = pickMax(active(3), (p) => (p.bestComebackDrop > 0 ? p.bestComebackDrop : null));
  const trofast = pickMaxTies(people, (p) => p.attendance);

  const awards: Record<string, AwardWinner> = {
    raskest: raskest
      ? winner(raskest.p, fmtSec(raskest.score), `Årets raskeste rene chug`)
      : null,
    mestForbedret: mestForbedret
      ? winner(
          mestForbedret.p,
          `−${mestForbedret.score.toFixed(2)}s`,
          `Fra ${fmtSec(mestForbedret.p.firstSeconds)} til ${fmtSec(mestForbedret.p.bestClean)}`,
        )
      : null,
    mestStabil: mestStabil
      ? winner(mestStabil.p, `±${mestStabil.score.toFixed(2)}s`, `Lavest standardavvik (${mestStabil.p.n} chugs)`)
      : null,
    comeback: comeback
      ? winner(comeback.p, `−${comeback.score.toFixed(2)}s`, `Største forbedring fra én gang til neste`)
      : null,
    trofast: trofast
      ? winnerTies(trofast.winners, `${trofast.score} / ${totalSessions}`, `Flest oppmøter i året`)
      : null,
  };

  // ---- Roast / shame awards ----
  const villeste = pickMaxTies(active(2), (p) => (p.wetCount > 0 ? p.wetCount : null));
  const syndaren = pickMaxTies(people, (p) => (p.crossesTotal > 0 ? p.crossesTotal : null));
  const tregest = pickMax(active(3), (p) => p.avg); // highest average = slowest overall

  // Brekker'n: most VOMIT codes
  const brekker = pickMaxTies(people, (p) => {
    const v = p.crossByCode["VOMIT"] ?? 0;
    return v > 0 ? v : null;
  });

  // Skuffet mest: single worst "% behind the day's fastest"
  let skuffet: { p: PersonAgg; pct: number; dateISO: string } | null = null;
  for (const [, rows] of data.bySession) {
    if (rows.length < 3) continue;
    const fastest = Math.min(...rows.map((r) => r.seconds));
    if (!Number.isFinite(fastest) || fastest <= 0) continue;
    for (const r of rows) {
      if (!r.isRegular) continue; // keep roasts within the kull
      const pct = ((r.seconds - fastest) / fastest) * 100;
      if (pct > 0 && (!skuffet || pct > skuffet.pct)) {
        const p = data.byId.get(r.participantId);
        const ptDate = p?.points.find((x) => x.seconds === r.seconds)?.dateISO ?? "";
        if (p) skuffet = { p, pct, dateISO: ptDate };
      }
    }
  }

  const roasts: Record<string, AwardWinner> = {
    villeste: villeste
      ? winnerTies(villeste.winners, `${villeste.score} søl`, `Flest våte chugs`)
      : null,
    syndaren: syndaren
      ? winnerTies(syndaren.winners, `${Number(syndaren.score.toFixed(1))} kryss`, `Flest kryss totalt`)
      : null,
    tregest: tregest
      ? winner(tregest.p, fmtSec(tregest.score), `Høyest gjennomsnitt (${tregest.p.n} chugs)`)
      : null,
    brekker: brekker ? winnerTies(brekker.winners, `${brekker.score}×🤮`, `Har kastet opp under chugging`) : null,
    skuffet: skuffet
      ? winner(skuffet.p, `+${skuffet.pct.toFixed(0)}%`, `Størst avstand bak dagens raskeste`)
      : null,
  };

  // ---- Charts ----
  const timeSeries = sessions
    .map((s) => {
      const rows = data.bySession.get(s.id) ?? [];
      if (!rows.length) return null;
      const times = rows.map((r) => r.seconds);
      const cleanTimes = rows.filter((r) => isClean(r.codes)).map((r) => r.seconds);
      const wetN = rows.filter((r) => isWet(r.codes)).length;
      return {
        sessionId: s.id,
        dateISO: s.dateISO,
        avg: mean(times),
        bestClean: cleanTimes.length ? Math.min(...cleanTimes) : null,
        attempts: rows.length,
        wetRate: rows.length ? (wetN / rows.length) * 100 : 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const crossBreakdown = Object.entries(data.crossBreakdownAll)
    .map(([code, count]) => ({ code, label: RULE_LABELS[code] ?? code, count }))
    .sort((a, b) => b.count - a.count);

  // ---- Rivalry: regulars who share the most sessions, with head-to-head wins ----
  const pairStats = new Map<string, { a: string; b: string; shared: number; aWins: number; bWins: number }>();
  for (const [, rows] of data.bySession) {
    const regs = rows.filter((r) => r.isRegular);
    for (let i = 0; i < regs.length; i++) {
      for (let j = i + 1; j < regs.length; j++) {
        const [x, y] = [regs[i], regs[j]].sort((m, n) => m.participantId.localeCompare(n.participantId));
        const key = `${x.participantId}|${y.participantId}`;
        const ps = pairStats.get(key) ?? { a: x.participantId, b: y.participantId, shared: 0, aWins: 0, bWins: 0 };
        ps.shared += 1;
        if (x.seconds < y.seconds) ps.aWins += 1;
        else if (y.seconds < x.seconds) ps.bWins += 1;
        pairStats.set(key, ps);
      }
    }
  }
  let rivalry: {
    a: { participantId: string; name: string; imageUrl: string | null; wins: number };
    b: { participantId: string; name: string; imageUrl: string | null; wins: number };
    shared: number;
  } | null = null;
  let bestPair: { a: string; b: string; shared: number; aWins: number; bWins: number } | null = null;
  let bestRivalryScore = -Infinity;
  for (const ps of pairStats.values()) {
    if (ps.shared < 5) continue;
    // Reward pairs that met often AND stayed neck-and-neck (small win margin).
    const decided = ps.aWins + ps.bWins;
    if (decided < 4) continue;
    const score = decided - 3 * Math.abs(ps.aWins - ps.bWins);
    if (score > bestRivalryScore) {
      bestRivalryScore = score;
      bestPair = ps;
    }
  }
  if (bestPair) {
    const pa = data.byId.get(bestPair.a);
    const pb = data.byId.get(bestPair.b);
    if (pa && pb) {
      rivalry = {
        a: { participantId: pa.id, name: pa.name, imageUrl: pa.imageUrl, wins: bestPair.aWins },
        b: { participantId: pb.id, name: pb.name, imageUrl: pb.imageUrl, wins: bestPair.bWins },
        shared: bestPair.shared,
      };
    }
  }

  // ---- Participant directory (for the "everyone" grid + personal entry) ----
  const titleByPid = buildTitleAssignments(people, totalSessions);
  const participants = [...people]
    .sort((a, b) => b.n - a.n || (a.bestClean ?? Infinity) - (b.bestClean ?? Infinity))
    .map((p) => {
      const t = titleByPid.get(p.id);
      return {
        id: p.id,
        name: p.name,
        isRegular: p.isRegular,
        imageUrl: p.imageUrl,
        n: p.n,
        bestClean: p.bestClean,
        avg: Number(p.avg.toFixed(2)),
        improvement: Number(p.improvement.toFixed(2)),
        crossesTotal: p.crossesTotal,
        titleLabel: t?.label ?? null,
        titleEmoji: t?.emoji ?? null,
      };
    });

  const firstDate = sessions[0]?.date ?? null;
  const lastDate = sessions[sessions.length - 1]?.date ?? null;

  return {
    semester: data.semester,
    semesterLabel: semesterLabel(data.semester),
    meta: {
      generatedAt: new Date().toISOString(),
      rangeFromISO: firstDate ? firstDate.toISOString() : null,
      rangeToISO: lastDate ? lastDate.toISOString() : null,
      rangeLabel:
        firstDate && lastDate
          ? `${fmtDateLong(firstDate)} – ${fmtDateLong(lastDate)}`
          : "Ingen data ennå",
    },
    totals: {
      sessions: totalSessions,
      chugs,
      participants: people.length,
      regulars: people.filter((p) => p.isRegular).length,
      guests: people.filter((p) => !p.isRegular).length,
      totalSeconds: Number(totalSeconds.toFixed(1)),
      totalMinutes: Number((totalSeconds / 60).toFixed(1)),
      totalBeers: chugs,
      totalLitres: Number((chugs * LITRES_PER_CHUG).toFixed(1)),
      litresPerChug: LITRES_PER_CHUG,
      avg: chugs ? Number((totalSeconds / chugs).toFixed(2)) : null,
      cleanRate: chugs ? Number(((cleanPoints.length / chugs) * 100).toFixed(1)) : 0,
      wetRate: chugs ? Number(((wetPoints.length / chugs) * 100).toFixed(1)) : 0,
      totalCrosses: Number(totalCrosses.toFixed(1)),
      fastestClean: fastestClean
        ? {
            participantId: fastestClean.p.id,
            name: fastestClean.p.name,
            imageUrl: fastestClean.p.imageUrl,
            seconds: fastestClean.pt.seconds,
            dateISO: fastestClean.pt.dateISO,
          }
        : null,
      slowest: slowest
        ? {
            participantId: slowest.p.id,
            name: slowest.p.name,
            imageUrl: slowest.p.imageUrl,
            seconds: slowest.pt.seconds,
            dateISO: slowest.pt.dateISO,
          }
        : null,
    },
    podium,
    awards,
    roasts,
    charts: { timeSeries, crossBreakdown },
    rivalry,
    participants,
  };
}

// ---------------------------------------------------------------------------
// Personality — archetypes first (multi-dimensional), then a distinctive
// single-axis title, then a varied neutral fallback. Plus aura + a deadpan
// season classification. Copy is kept dry on purpose.
// ---------------------------------------------------------------------------

type Title = { key: string; label: string; emoji: string; blurb: string };

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (s.charCodeAt(i) + ((h << 5) - h)) | 0;
  return Math.abs(h);
}

type Signals = {
  speedScore: number; // 0..1, 1 = fastest best-clean
  consScore: number; // 0..1, 1 = most consistent (low stddev)
  varScore: number; // 0..1, 1 = swingiest
  impScore: number; // 0..1, 1 = most improved
  wetScore: number; // 0..1, 1 = wettest
  mischiefScore: number; // 0..1, 1 = most crosses earned WHILE PRESENT (excl. fravær/DNS)
  slowScore: number; // 0..1, 1 = slowest avg
  speedRank: number | null;
  mischiefCount: number; // non-absence, non-DNS violation count
  attendRatio: number;
  absenceRatio: number;
  absenceCount: number;
  vomitCount: number;
  dnfCount: number;
  dnsCount: number;
};

const mischiefOf = (x: PersonAgg) =>
  Math.max(0, x.violationCount - (x.crossByCode["ABSENCE"] ?? 0) - (x.crossByCode["DNS"] ?? 0));

function computeSignals(p: PersonAgg, people: PersonAgg[], totalSessions: number): Signals {
  const withClean = people.filter((x) => x.bestClean != null && x.n >= 2);
  const consPop = people.filter((x) => x.n >= 4);
  const impPop = people.filter((x) => x.n >= 3 && x.improvement > 0);
  const wetPop = people.filter((x) => x.n >= 3);
  const slowPop = people.filter((x) => x.n >= 4);
  const mischiefPop = people.filter((x) => mischiefOf(x) > 0);

  const fracHigher = (pop: PersonAgg[], val: number, get: (x: PersonAgg) => number) =>
    pop.length <= 1 ? 0 : pop.filter((x) => get(x) > val).length / (pop.length - 1);
  const fracLower = (pop: PersonAgg[], val: number, get: (x: PersonAgg) => number) =>
    pop.length <= 1 ? 0 : pop.filter((x) => get(x) < val).length / (pop.length - 1);

  const absenceCount = p.crossByCode["ABSENCE"] ?? 0;
  const mischief = mischiefOf(p);

  return {
    speedScore: p.bestClean != null ? fracHigher(withClean, p.bestClean, (x) => x.bestClean as number) : 0,
    consScore: p.n >= 4 ? fracHigher(consPop, p.stddev, (x) => x.stddev) : 0,
    varScore: p.n >= 4 ? fracLower(consPop, p.stddev, (x) => x.stddev) : 0,
    impScore: p.n >= 3 && p.improvement > 0 ? fracLower(impPop, p.improvementPct, (x) => x.improvementPct) : 0,
    wetScore: p.n >= 3 ? fracLower(wetPop, p.wetRate, (x) => x.wetRate) : 0,
    mischiefScore: mischief > 0 ? fracLower(mischiefPop, mischief, mischiefOf) : 0,
    slowScore: p.n >= 4 ? fracLower(slowPop, p.avg, (x) => x.avg) : 0,
    speedRank:
      p.bestClean != null ? 1 + withClean.filter((x) => (x.bestClean as number) < (p.bestClean as number)).length : null,
    mischiefCount: mischief,
    attendRatio: totalSessions > 0 ? p.attendance / totalSessions : 0,
    absenceRatio: absenceCount + p.attendance > 0 ? absenceCount / (absenceCount + p.attendance) : 0,
    absenceCount,
    vomitCount: p.crossByCode["VOMIT"] ?? 0,
    dnfCount: p.crossByCode["DNF"] ?? 0,
    dnsCount: p.crossByCode["DNS"] ?? 0,
  };
}

// Ordered list of candidate titles for a person (most distinctive first),
// always ending with a varied neutral pool so there's something to fall back to.
function titleCandidates(p: PersonAgg, s: Signals): { score: number; title: Title }[] {
  const fast = s.speedScore >= 0.7;
  const veryFast = s.speedScore >= 0.85;
  const messy = s.wetScore >= 0.6 || s.mischiefScore >= 0.6 || s.dnfCount > 0;
  const swingy = s.varScore >= 0.65;
  const steady = s.consScore >= 0.5;
  const present = s.attendRatio >= 0.7;
  const rare = s.attendRatio <= 0.45;

  const c: { score: number; title: Title }[] = [];

  // Archetypes (multi-dimensional)
  if (rare && p.n >= 2 && s.speedScore >= 0.8)
    c.push({ score: 0.97, title: { key: "snikmorder", label: "Snikmorderen", emoji: "🥷", blurb: "Dukket opp. Knuste folk. Forsvant." } });
  if (fast && messy)
    c.push({ score: 0.9, title: { key: "fyrverkeri", label: "Fyrverkeriet", emoji: "🎆", blurb: "Lynraskt — men det smeller like ofte feil vei. Alt eller ingenting." } });
  if (s.mischiefScore >= 0.6 && swingy)
    c.push({ score: 0.88, title: { key: "kaosagent", label: "Kaosagenten", emoji: "🎲", blurb: "Ingen visste hva som kom til å skje. Heller ikke du." } });
  if (present && s.mischiefScore <= 0.4 && s.wetScore <= 0.5 && steady && !veryFast)
    c.push({ score: 0.82, title: { key: "embetsmann", label: "Embetsmannen", emoji: "🗂️", blurb: "Ikke raskest, ikke tregest. Bare alltid der." } });

  // Distinctive single axis
  if (s.speedRank === 1 && p.bestClean != null)
    c.push({ score: 1.0, title: { key: "lyn", label: "Lynet", emoji: "⚡", blurb: "Raskest i hele kullet. Ølet rakk ikke å reagere." } });
  else if (fast)
    c.push({ score: s.speedScore, title: { key: "rakett", label: "Raketten", emoji: "🚀", blurb: "Blant de aller raskeste — glasset er tomt før du ser det." } });
  if (s.consScore >= 0.7 && p.n >= 4)
    c.push({ score: s.consScore - 0.02, title: { key: "maskin", label: "Maskinen", emoji: "🤖", blurb: "Nøyaktig samme tid hver gang. Litt skummelt." } });
  if (s.impScore >= 0.7)
    c.push({ score: s.impScore - 0.01, title: { key: "stiger", label: "Stigaren", emoji: "📈", blurb: "Bare bedre og bedre gjennom året." } });
  if (s.wetScore >= 0.7 && p.wetRate >= 25)
    c.push({ score: s.wetScore - 0.01, title: { key: "sol", label: "Sølebøtta", emoji: "💧", blurb: "Mer øl på gulvet enn i magen." } });
  if (s.mischiefScore >= 0.75)
    c.push({ score: s.mischiefScore - 0.02, title: { key: "lovlos", label: "Lovløs", emoji: "😈", blurb: "Kjenner regelboka best — fordi den brytes mest." } });
  if (s.absenceRatio >= 0.4 && s.absenceCount >= 3)
    c.push({ score: 0.6 + s.absenceRatio * 0.3, title: { key: "spokelse", label: "Spøkelset", emoji: "👻", blurb: "Oftere fraværende enn til stede." } });
  if (s.slowScore >= 0.82)
    c.push({ score: s.slowScore - 0.05, title: { key: "sirup", label: "Sirupen", emoji: "🐌", blurb: "Tar seg god tid. Nyter hver eneste dråpe." } });
  if (s.attendRatio >= 0.85)
    c.push({ score: 0.55 + s.attendRatio * 0.2, title: { key: "inventar", label: "Inventaret", emoji: "🪑", blurb: "Møtte opp så å si hver gang." } });
  if (s.vomitCount > 0)
    c.push({ score: 0.86, title: { key: "vulkan", label: "Vulkanen", emoji: "🌋", blurb: "Det kom opp igjen. Minst én gang." } });

  // Varied neutral pool — but pick from the right shelf based on how often
  // they actually showed up (so a one-time guest never becomes "Stamgjesten").
  const occasionalPool: Title[] = [
    { key: "innhopper", label: "Innhopperen", emoji: "🎫", blurb: "Stakk innom, tok en chug, forsvant." },
    { key: "gjestestjerne", label: "Gjestestjernen", emoji: "🌟", blurb: "Et sjeldent gjestespill på Grotta." },
    { key: "forbifart", label: "Forbifarten", emoji: "💨", blurb: "Her et øyeblikk, så borte igjen." },
    { key: "ukjent", label: "Den ukjente", emoji: "🕶️", blurb: "Lite data, mye mystikk." },
    { key: "droppin", label: "Drop-in-gjesten", emoji: "🚪", blurb: "Dukket opp uanmeldt. Respekt for det." },
  ];
  const establishedPool: Title[] = [
    { key: "veteran", label: "Veteranen", emoji: "🎖️", blurb: "Solid og pålitelig. En ekte grottesjel." },
    { key: "kjeller", label: "Kjellermesteren", emoji: "🗝️", blurb: "Hører hjemme på Grotta." },
    { key: "filosof", label: "Ølfilosofen", emoji: "🍺", blurb: "Tar chuggen med ro og verdighet." },
    { key: "midt", label: "Midtsjiktet", emoji: "📊", blurb: "Verken først eller sist. Selve kjernen i kullet." },
    { key: "allround", label: "Allrounderen", emoji: "🎲", blurb: "Litt av alt, mester i å stille opp." },
    { key: "stamgjest", label: "Stamgjesten", emoji: "🍻", blurb: "Fast inventar ved fatet." },
    { key: "rutinier", label: "Rutiniéren", emoji: "🧭", blurb: "Har gjort dette før. Mange ganger." },
    { key: "joker", label: "Jokeren", emoji: "🃏", blurb: "Vanskelig å plassere. Det er litt av sjarmen." },
    { key: "mysterie", label: "Mysteriet", emoji: "🕵️", blurb: "Tallene gir ingen tydelig dom. Spennende." },
    { key: "tilskuer", label: "Tilskueren", emoji: "🎟️", blurb: "Mer til stede enn på resultatlista." },
  ];
  const pool = p.n <= 3 ? occasionalPool : establishedPool;
  const offset = hashString(p.id) % pool.length;
  for (let i = 0; i < pool.length; i++) {
    c.push({ score: 0.25 - i * 0.01, title: pool[(offset + i) % pool.length] });
  }

  c.sort((a, b) => b.score - a.score);
  return c;
}

function assignTitle(p: PersonAgg, s: Signals): Title {
  return titleCandidates(p, s)[0].title;
}

// Give every fast medlem a DISTINCT personality (no duplicate titles among
// regulars). Greedy: whoever fits a title most strongly claims it first.
function buildTitleAssignments(people: PersonAgg[], totalSessions: number): Map<string, Title> {
  const out = new Map<string, Title>();
  const used = new Set<string>();

  const regulars = people.filter((p) => p.isRegular && p.n >= 1);
  const entries = regulars.map((p) => {
    const cands = titleCandidates(p, computeSignals(p, people, totalSessions));
    return { p, cands, top: cands[0]?.score ?? 0 };
  });
  entries.sort((a, b) => b.top - a.top);

  for (const e of entries) {
    const chosen =
      e.cands.find((c) => !used.has(c.title.key))?.title ??
      { key: `sjel-${e.p.id.slice(-4)}`, label: "Grottesjelen", emoji: "🍺", blurb: "En av kjernen i kullet." };
    used.add(chosen.key);
    out.set(e.p.id, chosen);
  }

  // Guests: independent (no uniqueness needed)
  for (const p of people) {
    if (out.has(p.id)) continue;
    out.set(p.id, assignTitle(p, computeSignals(p, people, totalSessions)));
  }
  return out;
}

function computeAura(s: Signals): { word: string; hint: string } {
  if (s.mischiefScore >= 0.7 && s.speedScore >= 0.7) return { word: "Skremmende", hint: "Rask og lovløs på én gang." };
  if (s.mischiefScore >= 0.7) return { word: "Lovstridig", hint: "Regelboka er mest et forslag." };
  if (s.wetScore >= 0.7) return { word: "Voldsom", hint: "Det søles, det spruter." };
  if (s.absenceRatio >= 0.45) return { word: "Flyktig", hint: "Her nå, borte straks." };
  if (s.varScore >= 0.7) return { word: "Uforutsigbar", hint: "Umulig å spå fra gang til gang." };
  if (s.speedScore >= 0.8) return { word: "Heroisk", hint: "Bygd for fart." };
  if (s.consScore >= 0.7) return { word: "Klinisk", hint: "Presist, kontrollert, jevnt." };
  if (s.attendRatio >= 0.8) return { word: "Stødig", hint: "Alltid på plass." };
  return { word: "Avmålt", hint: "Tar det som det kommer." };
}

function computeClassification(
  p: PersonAgg,
  s: Signals,
  totalSessions: number,
): { label: string; lines: string[] } {
  const risk = s.mischiefScore * 0.6 + s.wetScore * 0.4;
  const riskLabel = risk >= 0.66 ? "Høy risiko" : risk >= 0.38 ? "Middels risiko" : "Lav risiko";
  const precLabel =
    p.n < 3
      ? "ukjent presisjon"
      : s.consScore >= 0.66
        ? "høy presisjon"
        : s.consScore >= 0.38
          ? "middels presisjon"
          : "lav presisjon";

  const lines: string[] = [];
  lines.push(`Du møtte opp ${p.attendance} av ${totalSessions} ganger.`);
  if (p.isRegular) {
    lines.push(p.crossesTotal > 0 ? `Du samlet ${Number(p.crossesTotal.toFixed(1))} kryss.` : "Du holdt deg unna krysslista.");
  }
  if (p.improvementPct >= 10) lines.push(`Du ble ${p.improvementPct.toFixed(0)}% bedre utover året.`);
  else if (p.improvementPct <= 3) lines.push("Du ble omtrent like god som du startet.");
  else lines.push("Du forbedret deg litt.");

  if (s.attendRatio >= 0.7 && s.mischiefScore >= 0.6 && p.improvementPct < 10) lines.push("Likevel møtte du opp hver gang. Respekt.");
  else if (s.speedScore >= 0.7 && s.mischiefScore >= 0.6) lines.push("Det oppsummerer deg overraskende godt.");
  else if (s.speedScore >= 0.8) lines.push("Du var her for å vinne.");
  else lines.push("Du levde med konsekvensene. 🍺");

  return { label: `${riskLabel}, ${precLabel}`, lines };
}

/** Your true rival: the co-attendee you're most evenly matched against
 * (closest head-to-head over enough chugs), not just who you met most. */
function computeRival(
  data: LoadedData,
  id: string,
): { participantId: string; name: string; imageUrl: string | null; meetings: number; youWon: number; theyWon: number } | null {
  const tally = new Map<string, { meetings: number; youWon: number; theyWon: number }>();
  const me = data.byId.get(id);
  if (!me) return null;
  for (const pt of me.points) {
    const rows = data.bySession.get(pt.sessionId) ?? [];
    for (const r of rows) {
      if (r.participantId === id) continue;
      const t = tally.get(r.participantId) ?? { meetings: 0, youWon: 0, theyWon: 0 };
      t.meetings += 1;
      if (pt.seconds < r.seconds) t.youWon += 1;
      else if (r.seconds < pt.seconds) t.theyWon += 1;
      tally.set(r.participantId, t);
    }
  }

  let bestId: string | null = null;
  let best = { meetings: 0, youWon: 0, theyWon: 0 };

  // Prefer the most contested AND balanced matchup.
  let bestScore = -Infinity;
  for (const [pid, t] of tally) {
    const decided = t.youWon + t.theyWon;
    if (t.meetings < 5 || decided < 4) continue;
    const score = decided - 3 * Math.abs(t.youWon - t.theyWon);
    if (score > bestScore) {
      bestScore = score;
      best = t;
      bestId = pid;
    }
  }
  // Fallback (sparse data): whoever you met most, min 3 times.
  if (!bestId) {
    for (const [pid, t] of tally) {
      if (t.meetings >= 3 && t.meetings > best.meetings) {
        best = t;
        bestId = pid;
      }
    }
  }
  if (!bestId) return null;
  const rivalPerson = data.byId.get(bestId);
  return {
    participantId: bestId,
    name: rivalPerson?.name ?? "?",
    imageUrl: rivalPerson?.imageUrl ?? null,
    meetings: best.meetings,
    youWon: best.youWon,
    theyWon: best.theyWon,
  };
}

// ---------------------------------------------------------------------------
// Person computation
// ---------------------------------------------------------------------------

function computePerson(data: LoadedData, group: ReturnType<typeof computeGroup>, id: string) {
  const p = data.byId.get(id);
  if (!p) return null;

  // Rank of best clean (vs everyone + vs regulars)
  const cleanRanking = data.people
    .filter((x) => x.bestClean != null)
    .sort((a, b) => (a.bestClean as number) - (b.bestClean as number));
  const bestCleanRank = p.bestClean != null ? cleanRanking.findIndex((x) => x.id === id) + 1 || null : null;
  const regularRanking = cleanRanking.filter((x) => x.isRegular);
  const bestCleanRankRegular =
    p.bestClean != null && p.isRegular ? regularRanking.findIndex((x) => x.id === id) + 1 || null : null;

  // Percentile: share of all clean attempts that were slower than your best clean
  let percentile: number | null = null;
  if (p.bestClean != null && data.allCleanSeconds.length > 0) {
    const slower = data.allCleanSeconds.filter((s) => s > (p.bestClean as number)).length;
    percentile = Number(((slower / data.allCleanSeconds.length) * 100).toFixed(1));
  }

  // Crosses ranking
  const crossRanking = [...data.people].sort((a, b) => b.crossesTotal - a.crossesTotal);
  const crossRank = p.crossesTotal > 0 ? crossRanking.findIndex((x) => x.id === id) + 1 || null : null;

  const fastestDay = p.points.reduce<Point | null>((best, pt) => (!best || pt.seconds < best.seconds ? pt : best), null);
  const slowestDay = p.points.reduce<Point | null>((worst, pt) => (!worst || pt.seconds > worst.seconds ? pt : worst), null);

  // session wins / losses (across all sessions in scope)
  let sessionWins = 0;
  let sessionLosses = 0;
  for (const pt of p.points) {
    const rows = data.bySession.get(pt.sessionId) ?? [];
    if (rows.length < 2) continue;
    const fastest = Math.min(...rows.map((r) => r.seconds));
    const slowest = Math.max(...rows.map((r) => r.seconds));
    if (pt.seconds === fastest) sessionWins += 1;
    if (pt.seconds === slowest) sessionLosses += 1;
  }

  // per-semester split
  const sessionSemester = new Map(data.sessions.map((s) => [s.id, s.semester]));
  const perSemester: Record<string, { n: number; bestClean: number | null; avg: number | null }> = {};
  for (const pt of p.points) {
    const sem = sessionSemester.get(pt.sessionId) ?? "?";
    const bucket = (perSemester[sem] ||= { n: 0, bestClean: null, avg: null });
    bucket.n += 1;
  }
  for (const sem of Object.keys(perSemester)) {
    const pts = p.points.filter((pt) => sessionSemester.get(pt.sessionId) === sem);
    const cleanPts = pts.filter((pt) => pt.clean).map((pt) => pt.seconds);
    perSemester[sem].bestClean = cleanPts.length ? Math.min(...cleanPts) : null;
    perSemester[sem].avg = Number(mean(pts.map((pt) => pt.seconds)).toFixed(2));
  }

  // Personality: unique title per fast medlem (no duplicates among regulars)
  const signals = computeSignals(p, data.people, group.totals.sessions);
  const titleMap = buildTitleAssignments(data.people, group.totals.sessions);
  const title = titleMap.get(p.id) ?? assignTitle(p, signals);
  const aura = computeAura(signals);
  const classification = computeClassification(p, signals, group.totals.sessions);
  const rival = computeRival(data, id);

  // which group awards did this person win?
  const awardsWon: { key: string; label: string; emoji: string; kind: "award" | "roast" }[] = [];
  const AWARD_META: Record<string, { label: string; emoji: string }> = {
    raskest: { label: "Årets raskeste", emoji: "⚡" },
    mestForbedret: { label: "Mest forbedret", emoji: "📈" },
    mestStabil: { label: "Mest stabil", emoji: "🎯" },
    comeback: { label: "Årets comeback", emoji: "🔥" },
    trofast: { label: "Mest trofast", emoji: "🗿" },
  };
  const ROAST_META: Record<string, { label: string; emoji: string }> = {
    villeste: { label: "Årets villeste", emoji: "💧" },
    syndaren: { label: "Syndaren", emoji: "😈" },
    tregest: { label: "Årets tregeste", emoji: "🐢" },
    brekker: { label: "Brekker'n", emoji: "🤮" },
    skuffet: { label: "Skuffet mest", emoji: "📉" },
  };
  const isWinner = (w: AwardWinner) => !!w && (w.participantId === id || (w.coIds?.includes(id) ?? false));
  for (const [key, w] of Object.entries(group.awards)) {
    if (isWinner(w) && AWARD_META[key]) awardsWon.push({ key, ...AWARD_META[key], kind: "award" });
  }
  for (const [key, w] of Object.entries(group.roasts)) {
    if (isWinner(w) && ROAST_META[key]) awardsWon.push({ key, ...ROAST_META[key], kind: "roast" });
  }

  return {
    participant: { id: p.id, name: p.name, isRegular: p.isRegular, imageUrl: p.imageUrl },
    semester: data.semester,
    semesterLabel: semesterLabel(data.semester),
    title,
    aura,
    classification,
    rival,
    stats: {
      chugs: p.n,
      totalBeers: p.n,
      totalLitres: Number((p.n * LITRES_PER_CHUG).toFixed(1)),
      totalSeconds: Number(p.totalSeconds.toFixed(1)),
      totalMinutes: Number((p.totalSeconds / 60).toFixed(1)),
      avg: Number(p.avg.toFixed(2)),
      best: p.best,
      bestClean: p.bestClean,
      bestCleanDateISO: p.bestCleanDateISO,
      stddev: Number(p.stddev.toFixed(2)),
      improvement: Number(p.improvement.toFixed(2)),
      improvementPct: Number(p.improvementPct.toFixed(1)),
      firstSeconds: p.firstSeconds,
      attendance: p.attendance,
      totalSessions: group.totals.sessions,
      wetCount: p.wetCount,
      wetRate: Number(p.wetRate.toFixed(1)),
      crossesTotal: Number(p.crossesTotal.toFixed(1)),
      violationCount: p.violationCount,
      sessionWins,
      sessionLosses,
    },
    rankings: {
      bestCleanRank,
      bestCleanRankRegular,
      totalRanked: cleanRanking.length,
      totalRankedRegular: regularRanking.length,
      percentile,
      crossRank,
    },
    comparison: {
      groupAvg: group.totals.avg,
      avgDelta: group.totals.avg != null ? Number((p.avg - group.totals.avg).toFixed(2)) : null,
      groupWetRate: group.totals.wetRate,
    },
    fastestDay: fastestDay ? { dateISO: fastestDay.dateISO, seconds: fastestDay.seconds, codes: fastestDay.codes } : null,
    slowestDay: slowestDay ? { dateISO: slowestDay.dateISO, seconds: slowestDay.seconds, codes: slowestDay.codes } : null,
    crossBreakdown: Object.entries(p.crossByCode)
      .map(([code, count]) => ({ code, label: RULE_LABELS[code] ?? code, count }))
      .sort((a, b) => b.count - a.count),
    perSemester,
    awardsWon,
    timeSeries: p.points.map((pt) => ({ dateISO: pt.dateISO, seconds: pt.seconds, clean: pt.clean, wet: pt.wet })),
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

wrappedRouter.get("/", async (req, res) => {
  try {
    const semester = String(req.query.semester ?? "year");
    const includeGuests = String(req.query.includeGuests ?? "true") !== "false";
    const data = await loadData(semester, includeGuests);
    res.json(computeGroup(data));
  } catch (err) {
    console.error("Failed to build group wrapped:", err);
    res.status(500).json({ error: "Kunne ikke bygge Wrapped" });
  }
});

wrappedRouter.get("/person/:id", async (req, res) => {
  try {
    const semester = String(req.query.semester ?? "year");
    const data = await loadData(semester);
    const group = computeGroup(data);
    const person = computePerson(data, group, req.params.id);
    if (!person) return res.status(404).json({ error: "Fant ingen chugs for denne personen" });
    res.json(person);
  } catch (err) {
    console.error("Failed to build person wrapped:", err);
    res.status(500).json({ error: "Kunne ikke bygge personlig Wrapped" });
  }
});
