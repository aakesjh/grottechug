import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";

export const participantSubmissionsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

// Bytt denne med faktisk blob-upload
async function uploadImageToStorage(file: Express.Multer.File): Promise<string> {
  // TODO: Vercel Blob / R2 / Supabase Storage
  // return uploadedUrl;
  throw new Error("uploadImageToStorage is not implemented");
}

/**
 * POST /api/participant-submissions
 * multipart/form-data:
 * - name
 * - image
 */
participantSubmissionsRouter.post("/", upload.single("image"), async (req, res) => {
  try {
    const rawName = String(req.body?.name ?? "");
    const name = normalizeName(rawName);
    const nameLower = name.toLowerCase();
    const file = req.file;

    if (!name) {
      return res.status(400).json({ error: "Missing name" });
    }

    if (!file) {
      return res.status(400).json({ error: "Missing image" });
    }

    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const existingParticipant = await prisma.participant.findUnique({
      where: { nameLower },
      select: { id: true, name: true },
    });

    if (existingParticipant) {
      return res.status(409).json({ error: "Participant with this name already exists" });
    }

    const imageUrl = await uploadImageToStorage(file);

    const submission = await prisma.participantSubmission.create({
      data: {
        name,
        nameLower,
        imageUrl,
        status: "pending",
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        status: true,
        createdAt: true,
      },
    });

    res.json(submission);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create submission" });
  }
});

/**
 * GET /api/participant-submissions?status=pending
 */
participantSubmissionsRouter.get("/", async (req, res) => {
  const status = String(req.query.status ?? "pending");

  const submissions = await prisma.participantSubmission.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
  });

  res.json(submissions);
});

/**
 * POST /api/participant-submissions/:id/approve
 * body: { editedName?: string, isRegular?: boolean }
 */
participantSubmissionsRouter.post("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const editedNameRaw = String(req.body?.editedName ?? "").trim();
    const isRegular = Boolean(req.body?.isRegular ?? false);

    const submission = await prisma.participantSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (submission.status !== "pending") {
      return res.status(400).json({ error: "Submission is not pending" });
    }

    const finalName = normalizeName(editedNameRaw || submission.name);
    const finalNameLower = finalName.toLowerCase();

    const existingParticipant = await prisma.participant.findUnique({
      where: { nameLower: finalNameLower },
      select: { id: true },
    });

    if (existingParticipant) {
      return res.status(409).json({ error: "Participant with this name already exists" });
    }

    const participant = await prisma.participant.create({
      data: {
        name: finalName,
        nameLower: finalNameLower,
        isRegular,
        imageUrl: submission.imageUrl,
      },
      select: {
        id: true,
        name: true,
        isRegular: true,
        imageUrl: true,
      },
    });

    await prisma.participantSubmission.update({
      where: { id },
      data: {
        status: "approved",
        editedName: finalName,
        reviewedAt: new Date(),
        approvedParticipantId: participant.id,
      },
    });

    res.json({ ok: true, participant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not approve submission" });
  }
});

/**
 * POST /api/participant-submissions/:id/reject
 * body: { adminNote?: string }
 */
participantSubmissionsRouter.post("/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const adminNote = String(req.body?.adminNote ?? "").trim() || null;

    const submission = await prisma.participantSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    await prisma.participantSubmission.update({
      where: { id },
      data: {
        status: "rejected",
        adminNote,
        reviewedAt: new Date(),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reject submission" });
  }
});