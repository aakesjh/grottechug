import { app } from "./app.js";
import { appEnv } from "./env.js";

const port = appEnv.port;

app.listen(port, () => {
  console.log(`API running on ${appEnv.betterAuthUrl ?? `http://localhost:${port}`}`);
});
