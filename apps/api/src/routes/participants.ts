import { Router } from "express";
import multer from "multer";
import { put } from "@vercel/blob";
import { requireAdmin } from "../auth-middleware.js";
import { appEnv } from "../env.js";
import { prisma } from "../prisma.js";

export const participantsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

/**
 * SEARCH (må ligge før /:id routes)
 * GET /api/participants/search?query=Maria
 */
participantsRouter.get("/search", async (req, res) => {
  const query = String(req.query.query ?? "").trim();
  if (!query) return res.json([]);

  const q = query.toLowerCase();

  const people = await prisma.participant.findMany({
    where: { nameLower: { contains: q } },
    orderBy: [{ isRegular: "desc" }, { name: "asc" }],
    take: 12,
    select: { id: true, name: true, isRegular: true, imageUrl: true }
  });

  res.json(people);
});

/**
 * GET /api/participants?includeGuests=true|false
 */
// participantsRouter.ts

participantsRouter.get("/", async (req, res) => {
  const includeGuests = req.query.includeGuests === "true";
  const where = includeGuests ? {} : { isRegular: true };

  const people = await prisma.participant.findMany({
    where,
    orderBy: [{ isRegular: "desc" }, { name: "asc" }],
    select: { 
      id: true, 
      name: true, 
      isRegular: true, 
      imageUrl: true,
      // Legg til denne for å telle antall forsøk
      _count: {
        select: { attempts: true }
      }
    }
  });

  // Mapper om resultatet slik at frontend får "attempts" som et flatt felt
  const formattedPeople = people.map(p => ({
    id: p.id,
    name: p.name,
    isRegular: p.isRegular,
    imageUrl: p.imageUrl,
    attempts: p._count.attempts
  }));

  res.json(formattedPeople);
});

participantsRouter.get("/:id", async (req, res) => {
  const participant = await prisma.participant.findUnique({
    where: { id: String(req.params.id) },
    select: {
      id: true,
      name: true,
      isRegular: true,
      imageUrl: true,
    },
  });

  if (!participant) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(participant);
});

/**
 * POST /api/participants/guest-upsert
 * body: { name: "Maria" }
 */
participantsRouter.post("/guest-upsert", requireAdmin, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Missing name" });

  const nameLower = name.toLowerCase();

  const p = await prisma.participant.upsert({
    where: { nameLower },
    update: {}, // behold som den er hvis finnes
    create: { name, nameLower, isRegular: false },
    select: { id: true, name: true, isRegular: true, imageUrl: true }
  });

  res.json(p);
});

/**
 * POST /api/participants/:id/image
 * multipart/form-data: image
 */
participantsRouter.post("/:id/image", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const file = req.file;

    if (!file || !file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Missing or invalid image" });
    }

    const participant = await prisma.participant.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const safeName = participant.name.toLowerCase().replace(/\s+/g, "-");
    const blob = await put(`people/${safeName}.jpeg`, file.buffer, {
      access: "public",
      contentType: file.mimetype,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: appEnv.blobReadWriteToken,
    });

    const updated = await prisma.participant.update({
      where: { id },
      data: { imageUrl: blob.url },
      select: { id: true, name: true, isRegular: true, imageUrl: true },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("Image upload failed:", err);
    const message = err instanceof Error ? err.message : "Could not update image";
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/participants/:id
 * body: { name: string }
 */
participantsRouter.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Missing name" });

    const nameLower = name.toLowerCase();

    const existing = await prisma.participant.findFirst({
      where: { nameLower, NOT: { id } },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ error: "En deltaker med dette navnet finnes allerede" });
    }

    const updated = await prisma.participant.update({
      where: { id },
      data: { name, nameLower },
      select: { id: true, name: true, isRegular: true, imageUrl: true },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update participant" });
  }
});

/**
 * DELETE /api/participants/:id/hard
 * (må ligge før /:id)
 */
participantsRouter.delete("/:id/hard", requireAdmin, async (req, res) => {
  const id = String(req.params.id);

  await prisma.$transaction([
    prisma.attempt.deleteMany({ where: { participantId: id } }),
    prisma.violation.deleteMany({ where: { participantId: id } }),
    prisma.participant.delete({ where: { id } })
  ]);

  res.json({ ok: true });
});

/**
 * DELETE /api/participants/:id
 */
participantsRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.participant.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
