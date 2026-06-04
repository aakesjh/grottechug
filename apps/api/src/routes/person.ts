import { Router } from "express";
import { prisma } from "../prisma.js";

export const personRouter = Router();

function hasNoViolations(codes: string[]) {
  return codes.length === 0;
}

function isMmOnlyViolation(codes: string[]) {
  return codes.length > 0 && codes.every((code) => code === "MM");
}

function isPbEligible(codes: string[]) {
  return hasNoViolations(codes) || isMmOnlyViolation(codes);
}

function isSpillViolation(codes: string[]) {
  return codes.some((code) => code === "MM" || code === "W" || code === "VW");
}

type ProfileRanking = {
  bestCleanRank: number | null;
  violationCount: number;
  violationRank: number | null;
};

// GET /api/person/:id?semester=2026V|2025H|all
personRouter.get("/:id", async (req, res) => {
  const id = req.params.id;
  const semester = String(req.query.semester ?? "all");

  const p = await prisma.participant.findUnique({ where: { id } });
  if (!p) return res.status(404).json({ error: "Not found" });

  const sessions = await prisma.session.findMany({
    where: semester === "all" ? {} : { semester },
    orderBy: { date: "asc" }
  });
  const sessionIds = sessions.map(s => s.id);

  const attempts = await prisma.attempt.findMany({
    where: { participantId: id, sessionId: { in: sessionIds } },
    include: { session: true },
    orderBy: { session: { date: "asc" } }
  });

  const violations = await prisma.violation.findMany({
    where: { participantId: id, sessionId: { in: sessionIds } },
    select: { sessionId: true, ruleCode: true, reason: true, crosses: true },
  });

  // Group violations by sessionId
  const violationsBySession = new Map<string, typeof violations>();
  for (const v of violations) {
    const list = violationsBySession.get(v.sessionId) ?? [];
    list.push(v);
    violationsBySession.set(v.sessionId, list);
  }

  const points = attempts.map(a => {
    const sessionViolations = violationsBySession.get(a.sessionId) ?? [];
    const violationNote = sessionViolations.map(v => v.ruleCode).join(", ") || null;
    return {
      sessionId: a.sessionId,
      dateISO: a.session.date.toISOString(),
      seconds: a.seconds,
      note: violationNote,
    };
  });

  const times = points.map(x => x.seconds);
  const best = times.length ? Math.min(...times) : null;
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;

  // bestClean: attempts with no violations, or only MM violations
  const cleanTimes = points
    .filter((point) => {
      if (!point.note) return true;
      const codes = point.note.split(", ").map((code) => code.toUpperCase());
      return isMmOnlyViolation(codes);
    })
    .map((point) => point.seconds);
  const bestClean = cleanTimes.length ? Math.min(...cleanTimes) : null;

  const includeGuestsInRankings = !p.isRegular;
  const profileRanking: ProfileRanking = {
    bestCleanRank: null,
    violationCount: violations.length,
    violationRank: null,
  };

  if (sessionIds.length > 0) {
    const [rankingAttempts, rankingViolations] = await Promise.all([
      prisma.attempt.findMany({
        where: { sessionId: { in: sessionIds }, seconds: { gt: 0 } },
        select: {
          participantId: true,
          sessionId: true,
          seconds: true,
          participant: { select: { isRegular: true } },
        },
      }),
      prisma.violation.findMany({
        where: { sessionId: { in: sessionIds } },
        select: {
          participantId: true,
          sessionId: true,
          ruleCode: true,
          crosses: true,
          participant: { select: { isRegular: true } },
        },
      }),
    ]);

    // "Tellende" = ingen anmerkning eller bare MM (basert på Violation-tabellen).
    const dirtyKeys = new Set<string>();
    for (const v of rankingViolations) {
      if (v.ruleCode.toUpperCase() !== "MM") dirtyKeys.add(`${v.participantId}:${v.sessionId}`);
    }

    const bestByParticipant = new Map<string, number>();
    for (const attempt of rankingAttempts) {
      if (!includeGuestsInRankings && !attempt.participant.isRegular) continue;
      if (dirtyKeys.has(`${attempt.participantId}:${attempt.sessionId}`)) continue; // ikke tellende
      const previousBest = bestByParticipant.get(attempt.participantId);
      if (previousBest == null || attempt.seconds < previousBest) {
        bestByParticipant.set(attempt.participantId, attempt.seconds);
      }
    }

    const leaderboardRows = Array.from(bestByParticipant.entries()).sort((left, right) => left[1] - right[1]);
    const bestCleanRankIndex = leaderboardRows.findIndex(([participantId]) => participantId === id);
    profileRanking.bestCleanRank = bestCleanRankIndex >= 0 ? bestCleanRankIndex + 1 : null;

    const violationsByParticipant = new Map<string, { count: number; weightedTotal: number; isRegular: boolean }>();
    for (const violation of rankingViolations) {
      const current = violationsByParticipant.get(violation.participantId) ?? {
        count: 0,
        weightedTotal: 0,
        isRegular: violation.participant.isRegular,
      };
      current.count += 1;
      current.weightedTotal += violation.crosses;
      violationsByParticipant.set(violation.participantId, current);
    }

    const violationRows = Array.from(violationsByParticipant.entries())
      .filter(([, entry]) => includeGuestsInRankings || entry.isRegular)
      .sort((left, right) => {
        const countDiff = right[1].count - left[1].count;
        if (countDiff !== 0) return countDiff;
        return right[1].weightedTotal - left[1].weightedTotal;
      });

    const violationRankIndex = violationRows.findIndex(([participantId]) => participantId === id);
    profileRanking.violationRank = violationRankIndex >= 0 ? violationRankIndex + 1 : null;
  }

  // --- Badge computation (always all-time) ---
  let badgeAttemptList: { sessionId: string; seconds: number }[];
  let badgeViolationCodes: Map<string, string[]>;

  if (semester === "all") {
    badgeAttemptList = attempts.map(a => ({ sessionId: a.sessionId, seconds: a.seconds }));
    badgeViolationCodes = new Map();
    for (const [sid, vs] of violationsBySession) {
      badgeViolationCodes.set(sid, vs.map((v) => v.ruleCode.toUpperCase()));
    }
  } else {
    const allAttempts = await prisma.attempt.findMany({
      where: { participantId: id },
      orderBy: { session: { date: "asc" } },
      select: { sessionId: true, seconds: true },
    });
    const allViolations = await prisma.violation.findMany({
      where: { participantId: id },
      select: { sessionId: true, ruleCode: true },
    });
    badgeAttemptList = allAttempts;
    badgeViolationCodes = new Map();
    for (const v of allViolations) {
      const list = badgeViolationCodes.get(v.sessionId) ?? [];
      list.push(v.ruleCode.toUpperCase());
      badgeViolationCodes.set(v.sessionId, list);
    }
  }

  const numAttempts = badgeAttemptList.length;

  const badgePoints = badgeAttemptList.map(a => {
    const codes = badgeViolationCodes.get(a.sessionId) ?? [];
    return { sessionId: a.sessionId, seconds: a.seconds, codes };
  });

  const badgeCleanTimes = badgePoints
    .filter((point) => isPbEligible(point.codes))
    .map((point) => point.seconds);
  const badgeBestClean = badgeCleanTimes.length ? Math.min(...badgeCleanTimes) : null;

  // Clean streak: 3 consecutive clean attempts
  let hasCleanStreak = false;
  let streak = 0;
  for (const pt of badgePoints) {
    const isClean = hasNoViolations(pt.codes);
    if (isClean) {
      streak++;
      if (streak >= 3) { hasCleanStreak = true; break; }
    } else {
      streak = 0;
    }
  }

  // Improvement: improved by 20%+ from first attempt to best clean
  const hasImproved = badgePoints.length >= 2 && badgeBestClean != null &&
    ((badgePoints[0].seconds - badgeBestClean) / badgePoints[0].seconds >= 0.20);

  // Consistency: stddev < 2s with at least 5 attempts
  let isConsistent = false;
  const allBadgeTimes = badgeAttemptList.map(a => a.seconds);
  if (allBadgeTimes.length >= 5) {
    const mean = allBadgeTimes.reduce((a, b) => a + b, 0) / allBadgeTimes.length;
    const variance = allBadgeTimes.reduce((a, t) => a + (t - mean) ** 2, 0) / allBadgeTimes.length;
    isConsistent = Math.sqrt(variance) < 2;
  }

  // Session winner: fastest time in any session
  let isSessionWinner = false;
  // Session loser: slowest time in any session
  let isSessionLoser = false;

  const badgeSessionIds = badgeAttemptList.map(a => a.sessionId);
  if (badgeSessionIds.length > 0) {
    const minTimesBySession = await prisma.attempt.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: badgeSessionIds } },
      _min: { seconds: true },
    });
    isSessionWinner = minTimesBySession.some(group => {
      const myAttempt = badgeAttemptList.find(a => a.sessionId === group.sessionId);
      return myAttempt && group._min.seconds === myAttempt.seconds;
    });

    const maxTimesBySession = await prisma.attempt.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: badgeSessionIds } },
      _max: { seconds: true },
    });
    // Only count sessions with 2+ participants
    const sessionCounts = await prisma.attempt.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: badgeSessionIds } },
      _count: true,
    });
    const multiSessions = new Set(sessionCounts.filter(s => s._count >= 2).map(s => s.sessionId));
    const sessionMinMap = new Map(
      minTimesBySession
        .filter(group => multiSessions.has(group.sessionId) && group._min.seconds != null)
        .map(group => [group.sessionId, group._min.seconds as number])
    );

    const attemptsInMultiSessions = await prisma.attempt.findMany({
      where: { sessionId: { in: Array.from(multiSessions) } },
      select: { sessionId: true, participantId: true, seconds: true },
    });

    const maxPercentBehindBySession = new Map<string, number>();
    for (const attempt of attemptsInMultiSessions) {
      const fastest = sessionMinMap.get(attempt.sessionId);
      if (fastest == null || fastest <= 0) continue;
      const percentBehind = ((attempt.seconds - fastest) / fastest) * 100;
      const currentMax = maxPercentBehindBySession.get(attempt.sessionId);
      if (currentMax == null || percentBehind > currentMax) {
        maxPercentBehindBySession.set(attempt.sessionId, percentBehind);
      }
    }

    isSessionLoser = badgeAttemptList.some((myAttempt) => {
      if (!multiSessions.has(myAttempt.sessionId)) return false;
      const fastest = sessionMinMap.get(myAttempt.sessionId);
      const maxPercent = maxPercentBehindBySession.get(myAttempt.sessionId);
      if (fastest == null || fastest <= 0 || maxPercent == null) return false;

      const myPercentBehind = ((myAttempt.seconds - fastest) / fastest) * 100;
      return myPercentBehind > 0 && Math.abs(myPercentBehind - maxPercent) < 1e-9;
    });
  }

  // Collect all violation codes across all sessions for this participant
  const allViolationCodes: string[] = [];
  for (const codes of badgeViolationCodes.values()) {
    allViolationCodes.push(...codes);
  }

  const hasVomit = allViolationCodes.includes("VOMIT");
  const hasSpill = isSpillViolation(allViolationCodes);
  const totalViolationCount = allViolationCodes.length;
  const totalChugTime = allBadgeTimes.reduce((a, b) => a + b, 0);

  const badges = [
    // Row 1: Jomfruchug + 4 fun/negative badges
    { id: "first-chug", title: "Jomfruchug", description: "Deltok på første grottechug", icon: "🍺", category: "milestone", earned: numAttempts >= 1 },
    { id: "session-loser", title: "Skuffet mest", description: "Størst prosentvis avvik bak raskeste tid i en chug", icon: "🐌", category: "negative", earned: isSessionLoser },
    { id: "puker", title: "Brekker'n", description: "Har fått VOMIT-anmerkning", icon: "🤮", category: "negative", earned: hasVomit },
    { id: "spiller", title: "Søl!", description: "Har sølt (MM/W/VW-anmerkning)", icon: "💧", category: "negative", earned: hasSpill },
    { id: "sinner", title: "Syndaren", description: "Samlet 5+ anmerkninger totalt", icon: "😈", category: "negative", earned: totalViolationCount >= 5 },
    // Row 2: Tiered chug count
    { id: "five-chugs", title: "Femmer'n", description: "Gjennomført 5 chugs", icon: "🖐️", category: "milestone", earned: numAttempts >= 5 },
    { id: "ten-chugs", title: "Tier'n", description: "Gjennomført 10 chugs", icon: "🔟", category: "milestone", earned: numAttempts >= 10 },
    { id: "fifteen-chugs", title: "Femten", description: "Gjennomført 15 chugs", icon: "💪", category: "milestone", earned: numAttempts >= 15 },
    { id: "twenty-chugs", title: "Tjue stykk", description: "Gjennomført 20 chugs", icon: "🏆", category: "milestone", earned: numAttempts >= 20 },
    { id: "twentyfive-chugs", title: "Kvart hundre", description: "Gjennomført 25 chugs", icon: "👑", category: "milestone", earned: numAttempts >= 25 },
    // Row 3: Speed badges
    { id: "sub-20", title: "Under 20", description: "Raskere enn 20 sekunder", icon: "⏱️", category: "speed", earned: badgeBestClean != null && badgeBestClean < 20 },
    { id: "sub-15", title: "Under 15", description: "Raskere enn 15 sekunder", icon: "🏃", category: "speed", earned: badgeBestClean != null && badgeBestClean < 15 },
    { id: "sub-10", title: "Under 10", description: "Raskere enn 10 sekunder", icon: "💨", category: "speed", earned: badgeBestClean != null && badgeBestClean < 10 },
    { id: "sub-5", title: "Rakett", description: "Raskere enn 5 sekunder", icon: "🚀", category: "speed", earned: badgeBestClean != null && badgeBestClean < 5 },
    { id: "sub-3", title: "Lynet", description: "Raskere enn 3 sekunder", icon: "⚡", category: "speed", earned: badgeBestClean != null && badgeBestClean < 3 },
    // Row 4: Special achievements
    { id: "clean-streak", title: "Ren rekke", description: "3 chugs på rad uten anmerkninger", icon: "✨", category: "special", earned: hasCleanStreak },
    { id: "improver", title: "Forbedring", description: "Forbedret tiden med over 20%", icon: "📈", category: "special", earned: hasImproved },
    { id: "consistent", title: "Konsansen", description: "Standardavvik under 2s (minst 5 forsøk)", icon: "🎯", category: "special", earned: isConsistent },
    { id: "session-winner", title: "Vinneren", description: "Raskest på en chug", icon: "🥇", category: "special", earned: isSessionWinner },
    { id: "admin", title: "Admin", description: "Grunnlegger og administrator av grottechug.no", icon: "🛡️", category: "special", earned: ["morten", "åke"].includes(p.nameLower) },
  ];

  res.json({
    participant: { id: p.id, name: p.name, isRegular: p.isRegular, imageUrl: p.imageUrl },
    semester,
    points,
    stats: {
      attempts: times.length,
      best,
      avg,
      bestClean
    },
    profileRanking,
    badges
  });
});
