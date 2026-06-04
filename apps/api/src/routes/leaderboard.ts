import { Router } from "express";
import { prisma } from "../prisma.js";

export const leaderboardRouter = Router();

// GET /api/leaderboard?semester=2026V|2025H|all
leaderboardRouter.get("/", async (req, res) => {
  const semester = String(req.query.semester ?? "all");

  const sessions = await prisma.session.findMany({
    where: semester === "all" ? {} : { semester },
    select: { id: true }
  });
  const sessionIds = sessions.map(s => s.id);

  if (!sessionIds.length) {
    return res.json({ semester, rows: [] });
  }

  // "Tellende" tid = ingen anmerkning, eller bare MM. Kilde er Violation-tabellen
  // (IKKE Attempt.note, som kan være tom selv om det finnes en W/VW/P-anmerkning).
  const [attempts, violations] = await Promise.all([
    prisma.attempt.findMany({
      where: { sessionId: { in: sessionIds }, seconds: { gt: 0 } },
      include: {
        participant: { select: { id: true, name: true, isRegular: true, imageUrl: true } },
        session: { select: { date: true } }
      }
    }),
    prisma.violation.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { participantId: true, sessionId: true, ruleCode: true }
    })
  ]);

  // (deltaker:session) med en diskvalifiserende (ikke-MM) anmerkning.
  const dirty = new Set<string>();
  for (const v of violations) {
    if (v.ruleCode.toUpperCase() !== "MM") dirty.add(`${v.participantId}:${v.sessionId}`);
  }

  const bestBy: Record<
    string,
    {
      participantId: string;
      name: string;
      isRegular: boolean;
      imageUrl: string | null;
      bestClean: number;
      dateISO: string;
      sessionId: string;
    }
  > = {};

  for (const a of attempts) {
    if (dirty.has(`${a.participantId}:${a.sessionId}`)) continue; // ikke tellende
    const pid = a.participant.id;
    const entry = bestBy[pid];

    if (!entry || a.seconds < entry.bestClean) {
      bestBy[pid] = {
        participantId: pid,
        name: a.participant.name,
        isRegular: a.participant.isRegular,
        imageUrl: a.participant.imageUrl ?? null,
        bestClean: a.seconds,
        dateISO: a.session.date.toISOString(),
        sessionId: a.sessionId
      };
    }
  }

  const rows = Object.values(bestBy).sort((x, y) => x.bestClean - y.bestClean);
  res.json({ semester, rows });
});
