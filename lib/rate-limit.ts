type FailureBucket = {
  count: number;
  resetAt: number;
  lockedUntil?: number;
};

type RequestBucket = {
  count: number;
  resetAt: number;
};

const failureBuckets = new Map<string, FailureBucket>();
const requestBuckets = new Map<string, RequestBucket>();

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export function isLocked(key: string, now = Date.now()) {
  const bucket = failureBuckets.get(key);
  return Boolean(bucket?.lockedUntil && bucket.lockedUntil > now);
}

export function recordFailure(
  key: string,
  options: { maxFailures: number; windowMs: number; lockMs: number },
  now = Date.now()
) {
  const bucket = failureBuckets.get(key);
  const current = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + options.windowMs };
  current.count += 1;
  if (current.count >= options.maxFailures) {
    current.lockedUntil = now + options.lockMs;
    current.count = 0;
    current.resetAt = now + options.windowMs;
  }
  failureBuckets.set(key, current);
  return current;
}

export function clearFailures(key: string) {
  failureBuckets.delete(key);
}

export function hitRateLimit(
  key: string,
  options: { maxRequests: number; windowMs: number },
  now = Date.now()
) {
  const existing = requestBuckets.get(key);
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + options.windowMs };
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  return {
    limited: bucket.count > options.maxRequests,
    remaining: Math.max(0, options.maxRequests - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export function resetRateLimitForTests() {
  failureBuckets.clear();
  requestBuckets.clear();
}
