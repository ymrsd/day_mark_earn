import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | undefined;
let limiter: Ratelimit | undefined;
const localRateLimits = new Map<string, { count: number; expiresAt: number }>();
const localAdLocks = new Map<string, { sessionId: string; expiresAt: number }>();

function hasRedisConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function enforceLocalRateLimit(key: string, limit: number) {
  const now = Date.now();
  const current = localRateLimits.get(key);
  if (!current || current.expiresAt <= now) {
    localRateLimits.set(key, { count: 1, expiresAt: now + 60_000 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Rate limiting is not configured.");
  redis ??= new Redis({ url, token });
  return redis;
}

export async function enforceRateLimit(key: string, limit = 12) {
  if (!hasRedisConfig() && process.env.NODE_ENV === "development") {
    return enforceLocalRateLimit(key, limit);
  }

  limiter ??= new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(limit, "1 m"),
    analytics: false,
    prefix: "watch-earn:ratelimit",
  });

  const result = await limiter.limit(key);
  return result.success;
}

export async function acquireAdLock(userId: string, sessionId: string, ttlSeconds: number) {
  if (!hasRedisConfig() && process.env.NODE_ENV === "development") {
    const current = localAdLocks.get(userId);
    if (current && current.expiresAt > Date.now()) return false;
    localAdLocks.set(userId, { sessionId, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  const key = `watch-earn:ad-lock:${userId}`;
  return (await getRedis().set(key, sessionId, { nx: true, ex: ttlSeconds })) === "OK";
}

export async function releaseAdLock(userId: string, sessionId: string) {
  if (!hasRedisConfig() && process.env.NODE_ENV === "development") {
    if (localAdLocks.get(userId)?.sessionId === sessionId) localAdLocks.delete(userId);
    return;
  }

  const key = `watch-earn:ad-lock:${userId}`;
  await getRedis().eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    [key],
    [sessionId],
  );
}