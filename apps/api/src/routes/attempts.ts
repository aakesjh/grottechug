import { Router } from "express";
import { requireAdmin } from "../auth-middleware.js";
import { prisma } from "../prisma.js";

export const attemptsRouter = Router();

const VALID_CODES = new Set(["MM", "W", "VW", "P", "DNS", "DNF", "ABSENCE", "VOMIT", "KPR"]);

function parseRuleCodes(note: string | null | undefined): string[] {
  if (!note) return [];
  const codes: string[] = [];
  if (/\bmm\b/i.test(note)) codes.push("MM");
  if (/\bvw\b/i.test(note)) codes.push("VW");
  if (/\bw\b/i.test(note)) codes.push("W");   // \bw\b won't match "w" inside "vw"
  if (/\bp\b/i.test(note)) codes.push("P");
  if (/\bdns\b/i.test(note)) codes.push("DNS");
  if (/\b(dnf|tobias)\b/i.test(note)) codes.push("DNF");
  if (/frav[æe]r|\babsence\b/i.test(note)) codes.push("ABSENCE");
  if (/\b(vomit|oppkast)\b/i.test(note)) codes.push("VOMIT");
  if (/\bkpr\b/i.test(note)) codes.push("KPR");
  return codes;
}

// POST /api/attempts/upsert
// body: { participantId, sessionId, seconds, note, violations? }
// seconds may be null for violation-only records (e.g. ABSENCE)
attemptsRouter.post("/upsert", requireAdmin, async (req, res) => {
  const { participantId, sessionId, seconds, note, violations: violationCodes } = req.body as {
    participantId: string;
    sessionId: string;
    seconds: number | null;
    note?: string | null;
    violations?: string[];
  };

  if (!participantId || !sessionId) {
    return res.status(400).json({ error: "Bad input" });
  }

  const hasTime = typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0;

  const cleanNote = note?.trim() ? note.trim() : null;

  // Explicit violations array takes precedence; otherwise parse from note text
  const parsedCodes = Array.isArray(violationCodes)
    ? violationCodes.map(c => c.toUpperCase()).filter(c => VALID_CODES.has(c))
    : parseRuleCodes(cleanNote);
  const codes = Array.from(new Set(parsedCodes));

  const saved = await prisma.$transaction(async (tx) => {
    let attempt: any = null;

    if (hasTime) {
      attempt = await tx.attempt.upsert({
        where: { participantId_sessionId: { participantId, sessionId } },
        update: { seconds: seconds!, note: cleanNote },
        create: { participantId, sessionId, seconds: seconds!, note: cleanNote }
      });
    }

    // Keep violation sync atomic with the attempt update to avoid duplicate rows on rapid saves.
    await tx.violation.deleteMany({ where: { participantId, sessionId } });

    if (codes.length > 0) {
      const rules = await tx.rule.findMany({ where: { code: { in: codes } } });
      const ruleMap = Object.fromEntries(rules.map(r => [r.code, r]));

      for (const code of codes) {
        const rule = ruleMap[code];
        if (!rule) continue;

        await tx.violation.create({
          data: {
            participantId,
            sessionId,
            ruleCode: rule.code,
            crosses: rule.crosses,
            reason: cleanNote,
          }
        });
      }
    }

    return attempt;
  });

  res.json(saved ?? { participantId, sessionId, seconds: null });
});
