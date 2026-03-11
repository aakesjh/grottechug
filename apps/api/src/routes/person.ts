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

  res.json({
    participant: { id: p.id, name: p.name, isRegular: p.isRegular, imageUrl: p.imageUrl },
    semester,
    points,
    stats: {
      attempts: times.length,
      best,
      avg,
      bestClean
    }
  });
});
