-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seconds" REAL NOT NULL,
    "note" TEXT,
    CONSTRAINT "Attempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attempt" ("id", "note", "participantId", "seconds", "sessionId") SELECT "id", "note", "participantId", "seconds", "sessionId" FROM "Attempt";
DROP TABLE "Attempt";
ALTER TABLE "new_Attempt" RENAME TO "Attempt";
CREATE UNIQUE INDEX "Attempt_participantId_sessionId_key" ON "Attempt"("participantId", "sessionId");
CREATE TABLE "new_Violation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "reason" TEXT,
    "crosses" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Violation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Violation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Violation" ("createdAt", "crosses", "id", "participantId", "reason", "ruleCode", "sessionId") SELECT "createdAt", "crosses", "id", "participantId", "reason", "ruleCode", "sessionId" FROM "Violation";
DROP TABLE "Violation";
ALTER TABLE "new_Violation" RENAME TO "Violation";
CREATE INDEX "Violation_participantId_sessionId_idx" ON "Violation"("participantId", "sessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
