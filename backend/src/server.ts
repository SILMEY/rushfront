import dotenv from "dotenv";
import { loadEnv } from "./config/env.js";

dotenv.config();
loadEnv();

import { buildApp } from "./app.js";
import { GameManager } from "./game/GameManager.js";
import { registerSockets } from "./sockets/index.js";

const app = buildApp();
const gameManager = new GameManager();

await registerSockets(app, gameManager);
await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
