import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import { auth, getRequestSession, isTrustedOrigin } from "./auth.js";
import { appEnv, assertProductionEnv, usesCrossOriginCookies } from "./env.js";
import { participantsRouter } from "./routes/participants.js";
import { wheelRouter } from "./routes/wheel.js";
import { rulesRouter } from "./routes/rules.js";
import { statsRouter } from "./routes/stats.js";
import { importRouter } from "./routes/import.js";
import { sessionsRouter } from "./routes/sessions.js";
import { attemptsRouter } from "./routes/attempts.js";
import { personRouter } from "./routes/person.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { analyticsRouter } from "./routes/analytics.js";
import { crossesRouter } from "./routes/crosses.js";
import { violationsRouter } from "./routes/violations.js";
import { participantSubmissionsRouter } from "./routes/participantSubmissionRouter.js";

assertProductionEnv();

export const app = express();
const authHandler = toNodeHandler(auth);

function clearAuthCookies(res: express.Response) {
  const sameSite: "lax" | "none" = appEnv.isProduction && usesCrossOriginCookies() ? "none" : "lax";
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    sameSite,
    secure: appEnv.isProduction,
  };

  res.clearCookie("better-auth.session_token", cookieOptions);
  res.clearCookie("better-auth.session_data", cookieOptions);
  res.clearCookie("better-auth.dont_remember", cookieOptions);
}

app.set("trust proxy", 1);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || isTrustedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
}));

app.get("/api/auth/get-session", async (req, res) => {
  try {
    const session = await getRequestSession(req.headers);

    if (!session) {
      clearAuthCookies(res);
      return res.json(null);
    }

    return res.json(session);
  } catch (error) {
    clearAuthCookies(res);
    console.error("Failed to get auth session", error);
    return res.json(null);
  }
});

app.all("/api/auth", authHandler);
app.all("/api/auth/*splat", authHandler);

app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/participants", participantsRouter);
app.use("/api/wheel", wheelRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/stats", statsRouter);
app.use("/api/import", importRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/attempts", attemptsRouter);
app.use("/api/person", personRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/crosses", crossesRouter);
app.use("/api/violations", violationsRouter);
app.use("/api/participant-submissions", participantSubmissionsRouter);
