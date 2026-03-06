import { Router } from "express";
import { prisma } from "../prisma";

export const sessionsRouter = Router();

// GET /api/sessions?semester=...
sessionsRouter.get("/", async (req, res) => {
  const semester = String(req.query.semester ?? "all");
  const where = semester === "all" ? {} : { semester };
  const sessions = await prisma.session.findMany({
    where,
    orderBy: { date: "asc" },
    select: { id: true, date: true, semester: true, note: true }
  });
  res.json(
    sessions.map(s => ({ ...s, dateISO: s.date.toISOString() }))
  );
});

// PATCH /api/sessions/:id  body: { note?: string|null }
sessionsRouter.patch("/:id", async (req, res) => {
  const id = String(req.params.id);
  const noteRaw = req.body?.note;
  const note = noteRaw === undefined ? undefined : String(noteRaw).trim();

  const updated = await prisma.session.update({
    where: { id },
    data: { ...(note !== undefined ? { note: note || null } : {}) },
    select: { id: true, date: true, semester: true, note: true }
  });

  res.json({ ...updated, dateISO: updated.date.toISOString() });
});

sessionsRouter.post("/", async (req, res) => {
  try {
    const { dateISO, semester } = req.body as { dateISO: string; semester: string };
    const date = new Date(dateISO);
    if (!semester || Number.isNaN(date.getTime())) return res.status(400).send("Bad input: dateISO/semester");

    const created = await prisma.session.upsert({
      where: { date },
      update: { semester },
      create: { date, semester },
      select: { id: true, date: true, semester: true, note: true }
    });

    res.json({ ...created, dateISO: created.date.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).send(String(err));
  }
});

// NY: DELETE for å slette en hel dag
sessionsRouter.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);

    // Husk at du MÅ ha onDelete: Cascade på relationen fra Attempt til Session i schema.prisma 
    // for at dette skal fungere hvis det finnes chugs registrert denne dagen!
    await prisma.session.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Kunne ikke slette session. Har du onDelete: Cascade i schema.prisma?");
  }
});