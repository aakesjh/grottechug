import { Router } from "express";
import { prisma } from "../prisma.js";

export const statsRouter = Router();

statsRouter.get("/table", async (req, res) => {
  const semester = String(req.query.semester ?? "2026V");
  const sessionWhere = semester === "all" ? {} : { semester };

  const sessions = await prisma.session.findMany({
    where: sessionWhere,
    orderBy: { date: "asc" }
  });

  const people = await prisma.participant.findMany({
    orderBy: [{ isRegular: "desc" }, { name: "asc" }]
  });

  const sessionIds = sessions.map((s) => s.id);

  const attempts = await prisma.attempt.findMany({
    where: { sessionId: { in: sessionIds } }
  });

  const cells: Record<string, Record<string, { seconds: number | null; note: string | null }>> = {};
  const nums: Record<string, number[]> = {};

  for (const p of people) {
    cells[p.id] = {};
    nums[p.id] = [];
    for (const s of sessions) cells[p.id][s.id] = { seconds: null, note: null };
  }

  for (const a of attempts) {
    nums[a.participantId].push(a.seconds);
    const cell = cells[a.participantId]?.[a.sessionId];
    if (!cell) continue;
    cell.seconds = a.seconds;
    cell.note = a.note ?? null;
  }

  const rows = people.map(p => {
    const arr = nums[p.id];
    const best = arr.length ? Math.min(...arr) : null;
    const avg = arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null;
    return {
      participantId: p.id,
      name: p.name,
      isRegular: p.isRegular,
      bestOverall: best,
      avgOverall: avg
    };
  });

  res.json({
    semester,
    columns: sessions.map((s) => ({ sessionId: s.id, dateISO: s.date.toISOString() })),
    rows,
    cells
  });
});

/**
 * GET /api/stats/peers?semester=2026V|2025H|all&includeGuests=true|false
 * Returns per-person aggregate stats for the whole peer group, suitable for
 * percentile rank and consistency-score comparisons on the client.
 */
statsRouter.get("/peers", async (req, res) => {
  const semester = String(req.query.semester ?? "all");
  const includeGuests = req.query.includeGuests === "true";

  const sessions = await prisma.session.findMany({
    where: semester === "all" ? {} : { semester },
    select: { id: true }
  });
  const sessionIds = sessions.map((s) => s.id);

  if (!sessionIds.length) {
    return res.json({ semester, peers: [] });
  }

  const people = await prisma.participant.findMany({
    where: includeGuests ? {} : { isRegular: true },
    select: { id: true, name: true, isRegular: true }
  });

  const [attempts, violations] = await Promise.all([
    prisma.attempt.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { participantId: true, sessionId: true, seconds: true }
    }),
    prisma.violation.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { participantId: true, sessionId: true, ruleCode: true }
    })
  ]);

  // "Tellende" (clean) = ingen anmerkning eller bare MM — fra Violation-tabellen.
  const dirty = new Set<string>();
  for (const v of violations) {
    if (v.ruleCode.toUpperCase() !== "MM") dirty.add(`${v.participantId}:${v.sessionId}`);
  }

  const byPerson: Record<string, { all: number[]; clean: number[] }> = {};
  for (const a of attempts) {
    const bucket = (byPerson[a.participantId] ||= { all: [], clean: [] });
    bucket.all.push(a.seconds);
    if (!dirty.has(`${a.participantId}:${a.sessionId}`)) bucket.clean.push(a.seconds);
  }

  const peers = people
    .map((p) => {
      const b = byPerson[p.id] ?? { all: [], clean: [] };
      const n = b.all.length;
      if (!n) return null;
      const sum = b.all.reduce((x, y) => x + y, 0);
      const avg = sum / n;
      const variance = b.all.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
      const stddev = Math.sqrt(variance);
      const bestClean = b.clean.length ? Math.min(...b.clean) : null;
      const best = Math.min(...b.all);
      return {
        id: p.id,
        name: p.name,
        isRegular: p.isRegular,
        attempts: n,
        avg,
        best,
        bestClean,
        stddev,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  res.json({ semester, peers });
});
