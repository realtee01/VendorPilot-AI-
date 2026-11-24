export interface RateLimitConfig {
  maxPerMinute: number;
  maxPerDay: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds: number;
  reason?: 'minute_limit' | 'daily_limit';
  remainingMinute: number;
  remainingDaily: number;
  minuteLimit: number;
  dailyLimit: number;
}

interface UserBucket {
  minuteTimestamps: number[];
  dayKey: string;
  dayCount: number;
}

const ONE_MINUTE_MS = 60_000;

function getUtcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function secondsUntilNextUtcDay(nowMs: number): number {
  const now = new Date(nowMs);
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((nextMidnight - nowMs) / 1000));
}

export class PerUserRateLimiter {
  private readonly buckets = new Map<string, UserBucket>();
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxPerMinute: 10, maxPerDay: 60 }) {
    this.config = config;
  }

  private getOrCleanBucket(userId: string, nowMs: number): UserBucket {
    const dayKey = getUtcDayKey(nowMs);
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = { minuteTimestamps: [], dayKey, dayCount: 0 };
      this.buckets.set(userId, bucket);
    }

    if (bucket.dayKey !== dayKey) {
      bucket.dayKey = dayKey;
      bucket.dayCount = 0;
    }

    const cutoff = nowMs - ONE_MINUTE_MS;
    bucket.minuteTimestamps = bucket.minuteTimestamps.filter((ts) => ts > cutoff);

    // Prevent unbounded memory growth across long-lived server processes
    if (this.buckets.size > 5000) {
      for (const [key, b] of this.buckets.entries()) {
        if (b.dayKey !== dayKey && b.minuteTimestamps.length === 0) {
          this.buckets.delete(key);
        }
      }
    }

    return bucket;
  }

  peek(userId: string, nowMs = Date.now()): RateLimitCheckResult {
    const bucket = this.getOrCleanBucket(userId, nowMs);
    const remainingMinute = Math.max(0, this.config.maxPerMinute - bucket.minuteTimestamps.length);
    const remainingDaily = Math.max(0, this.config.maxPerDay - bucket.dayCount);

    if (bucket.dayCount >= this.config.maxPerDay) {
      return {
        allowed: false,
        retryAfterSeconds: secondsUntilNextUtcDay(nowMs),
        reason: 'daily_limit',
        remainingMinute,
        remainingDaily: 0,
        minuteLimit: this.config.maxPerMinute,
        dailyLimit: this.config.maxPerDay,
      };
    }

    if (bucket.minuteTimestamps.length >= this.config.maxPerMinute) {
      const oldest = bucket.minuteTimestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + ONE_MINUTE_MS - nowMs) / 1000));
      return {
        allowed: false,
        retryAfterSeconds,
        reason: 'minute_limit',
        remainingMinute: 0,
        remainingDaily,
        minuteLimit: this.config.maxPerMinute,
        dailyLimit: this.config.maxPerDay,
      };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingMinute,
      remainingDaily,
      minuteLimit: this.config.maxPerMinute,
      dailyLimit: this.config.maxPerDay,
    };
  }

  consume(userId: string, nowMs = Date.now()): RateLimitCheckResult {
    const status = this.peek(userId, nowMs);
    if (!status.allowed) {
      return status;
    }

    const bucket = this.getOrCleanBucket(userId, nowMs);
    bucket.minuteTimestamps.push(nowMs);
    bucket.dayCount += 1;

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingMinute: Math.max(0, this.config.maxPerMinute - bucket.minuteTimestamps.length),
      remainingDaily: Math.max(0, this.config.maxPerDay - bucket.dayCount),
      minuteLimit: this.config.maxPerMinute,
      dailyLimit: this.config.maxPerDay,
    };
  }
}
