import dotenv from "dotenv";
import { loadEnv } from "./config/env.js";

dotenv.config();
loadEnv();

// Empêche le crash du process sur erreurs non gérées
process.on("uncaughtException",  (err)    => console.error("[uncaughtException]",  err));
process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));

import { buildApp } from "./app.js";
import { GameManager } from "./game/GameManager.js";
import { QuickMatchmaker } from "./game/QuickMatchmaker.js";
import { registerSockets } from "./sockets/index.js";

const app = buildApp();
const gameManager = new GameManager();
const quickMatchmaker = new QuickMatchmaker();

await registerSockets(app, gameManager, quickMatchmaker);
await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
