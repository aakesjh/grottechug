import { Router } from "express";
import { prisma } from "../prisma.js";

export const personRouter = Router();

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
    .filter(x => {
      if (!x.note) return true;
      const codes = x.note.split(", ").map(c => c.toUpperCase());
      return codes.every(c => c === "MM");
    })
    .map(x => x.seconds);
    
  const bestClean = cleanTimes.length ? Math.min(...cleanTimes) : null;

  // --- Badge computation (always all-time) ---
  let badgeAttemptList: { sessionId: string; seconds: number }[];
  let badgeViolationCodes: Map<string, string[]>;

  if (semester === "all") {
    badgeAttemptList = attempts.map(a => ({ sessionId: a.sessionId, seconds: a.seconds }));
    badgeViolationCodes = new Map();
    for (const [sid, vs] of violationsBySession) {
      badgeViolationCodes.set(sid, vs.map(v => v.ruleCode));
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
      list.push(v.ruleCode);
      badgeViolationCodes.set(v.sessionId, list);
    }
  }

  const numAttempts = badgeAttemptList.length;

  const badgePoints = badgeAttemptList.map(a => {
    const codes = badgeViolationCodes.get(a.sessionId) ?? [];
    return { sessionId: a.sessionId, seconds: a.seconds, codes };
  });

  const badgeCleanTimes = badgePoints
    .filter(p => p.codes.length === 0 || p.codes.every(c => c === "MM"))
    .map(p => p.seconds);
  const badgeBestClean = badgeCleanTimes.length ? Math.min(...badgeCleanTimes) : null;

  // Clean streak: 3 consecutive clean attempts
  let hasCleanStreak = false;
  let streak = 0;
  for (const pt of badgePoints) {
    const isClean = pt.codes.length === 0 || pt.codes.every(c => c === "MM");
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
    isSessionLoser = maxTimesBySession.some(group => {
      if (!multiSessions.has(group.sessionId)) return false;
      const myAttempt = badgeAttemptList.find(a => a.sessionId === group.sessionId);
      return myAttempt && group._max.seconds === myAttempt.seconds;
    });
  }

  // Collect all violation codes across all sessions for this participant
  const allViolationCodes: string[] = [];
  for (const codes of badgeViolationCodes.values()) {
    allViolationCodes.push(...codes);
  }

  const hasVomit = allViolationCodes.includes("VOMIT");
  const hasSpill = allViolationCodes.includes("W") || allViolationCodes.includes("VW");
  const totalViolationCount = allViolationCodes.length;
  const totalChugTime = allBadgeTimes.reduce((a, b) => a + b, 0);

  const badges = [
    // Row 1: Jomfruchug + 4 fun/negative badges
    { id: "first-chug", title: "Jomfruchug", description: "Deltok på første grottechug", icon: "🍺", category: "milestone", earned: numAttempts >= 1 },
    { id: "session-loser", title: "Taperen", description: "Tregest på en chug", icon: "🐌", category: "negative", earned: isSessionLoser },
    { id: "puker", title: "Brekker'n", description: "Har fått VOMIT-anmerkning", icon: "🤮", category: "negative", earned: hasVomit },
    { id: "spiller", title: "Søl!", description: "Har sølt (W/VW-anmerkning)", icon: "💧", category: "negative", earned: hasSpill },
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
    badges
  });
});
