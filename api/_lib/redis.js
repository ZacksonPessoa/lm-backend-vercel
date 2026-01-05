import { Redis } from "@upstash/redis";

const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.STORAGE_REST_API_URL;

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.STORAGE_REST_API_TOKEN;

if (!url || !token) {
  throw new Error(
    "Redis env vars missing. Expected KV_REST_API_URL/KV_REST_API_TOKEN (or UPSTASH_/STORAGE_ equivalents)."
  );
}

export const redis = new Redis({ url, token });
