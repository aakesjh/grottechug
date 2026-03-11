import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!url) {
  console.error("TURSO_DATABASE_URL is required");
  process.exit(1);
}

const client = createClient({ url, authToken: authToken || undefined });

const statements = [
  // -- CreateTable
  `CREATE TABLE IF NOT EXISTS "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameLower" TEXT NOT NULL,
    "isRegular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageUrl" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "participantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "AuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "AuthVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "semester" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seconds" REAL NOT NULL,
    "note" TEXT,
    CONSTRAINT "Attempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "crosses" REAL NOT NULL,
    "details" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "Violation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "reason" TEXT,
    "crosses" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Violation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Violation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ParticipantSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameLower" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "editedName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "approvedParticipantId" TEXT
  )`,

  // -- CreateIndex (using IF NOT EXISTS)
  `CREATE UNIQUE INDEX IF NOT EXISTS "Participant_name_key" ON "Participant"("name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Participant_nameLower_key" ON "Participant"("nameLower")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_participantId_key" ON "User"("participantId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AuthSession_token_key" ON "AuthSession"("token")`,
  `CREATE INDEX IF NOT EXISTS "AuthSession_userId_idx" ON "AuthSession"("userId")`,
  `CREATE INDEX IF NOT EXISTS "AuthAccount_userId_idx" ON "AuthAccount"("userId")`,
  `CREATE INDEX IF NOT EXISTS "AuthAccount_providerId_accountId_idx" ON "AuthAccount"("providerId", "accountId")`,
  `CREATE INDEX IF NOT EXISTS "AuthVerification_identifier_idx" ON "AuthVerification"("identifier")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Session_date_key" ON "Session"("date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Attempt_participantId_sessionId_key" ON "Attempt"("participantId", "sessionId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Rule_code_key" ON "Rule"("code")`,
  `CREATE INDEX IF NOT EXISTS "Violation_participantId_sessionId_idx" ON "Violation"("participantId", "sessionId")`,
  `CREATE INDEX IF NOT EXISTS "ParticipantSubmission_status_createdAt_idx" ON "ParticipantSubmission"("status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ParticipantSubmission_nameLower_idx" ON "ParticipantSubmission"("nameLower")`,
];

async function main() {
  console.log(`Connecting to Turso: ${url}`);

  for (const sql of statements) {
    const label = sql.trim().split("\n")[0].trim().slice(0, 80);
    try {
      await client.execute(sql);
      console.log(`  OK: ${label}`);
    } catch (err) {
      console.error(`  FAIL: ${label}`);
      console.error(`  ${err}`);
    }
  }

  console.log("\nDone! Schema applied to Turso.");
  client.close();
}

main();
