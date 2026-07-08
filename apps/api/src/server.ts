import { join } from "path";
import { fileURLToPath } from "url";

// Load root .env variables for development
try {
  process.loadEnvFile(join(fileURLToPath(new URL(".", import.meta.url)), "../../../.env"));
} catch (err) {
  // Gracefully skip if file is missing or loaded via process host config
}

import { buildApp } from "./app.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 DuoQuest API running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  }
}

start();
