import { createMiddleware } from "hono/factory";
import { getClientIp } from "../services/logger.js";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter by IP address.
 * @param max - Max requests per window
 * @param windowMs - Window size in milliseconds
 */
export function rateLimit(max: number, windowMs: number) {
  const buckets = new Map<string, RateLimitBucket>();

  // Sweep expired entries every 60s to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000).unref();

  return createMiddleware(async (c, next) => {
    const ip = getClientIp(c);
    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count++;

    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await next();
  });
}
