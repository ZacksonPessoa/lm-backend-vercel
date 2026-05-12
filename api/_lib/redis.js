import Redis from "ioredis";

// Cliente Redis local (Docker). Reutiliza a mesma instância entre chamadas no
// servidor Express. Em produção/dev local, REDIS_URL vem do docker-compose
// (ex.: redis://redis:6379 no Docker, redis://localhost:6379 fora).
const url = process.env.REDIS_URL || "redis://localhost:6379";

let _client = globalThis.__redisClient;
if (!_client) {
  _client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  _client.on("error", (err) => {
    console.error("❌ Redis error:", err.message);
  });
  _client.on("connect", () => {
    console.log(`✅ Redis conectado (${url})`);
  });

  globalThis.__redisClient = _client;
}

export const redis = _client;
