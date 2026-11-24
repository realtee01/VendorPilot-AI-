import test from 'node:test';
import assert from 'node:assert/strict';
import { PerUserRateLimiter } from './rateLimiter';

test('PerUserRateLimiter enforces per-minute limit and resets after 60s', () => {
  const limiter = new PerUserRateLimiter({ maxPerMinute: 2, maxPerDay: 10 });
  const t0 = Date.UTC(2026, 10, 24, 12, 0, 0);

  const r1 = limiter.consume('user_a', t0);
  assert.equal(r1.allowed, true);
  assert.equal(r1.remainingMinute, 1);
  assert.equal(r1.remainingDaily, 9);

  const r2 = limiter.consume('user_a', t0 + 10_000);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remainingMinute, 0);

  const r3 = limiter.consume('user_a', t0 + 20_000);
  assert.equal(r3.allowed, false);
  assert.equal(r3.reason, 'minute_limit');
  assert.equal(r3.retryAfterSeconds, 40);

  // Isolated per user: user_b is unaffected
  const otherUser = limiter.consume('user_b', t0 + 20_000);
  assert.equal(otherUser.allowed, true);

  // After 61 seconds from first request, user_a can make another request
  const r4 = limiter.consume('user_a', t0 + 61_000);
  assert.equal(r4.allowed, true);
});

test('PerUserRateLimiter enforces daily limit and resets on next UTC day', () => {
  const limiter = new PerUserRateLimiter({ maxPerMinute: 10, maxPerDay: 2 });
  const day1 = Date.UTC(2026, 10, 24, 23, 50, 0);

  assert.equal(limiter.consume('user_a', day1).allowed, true);
  assert.equal(limiter.consume('user_a', day1 + 1000).allowed, true);

  const blocked = limiter.consume('user_a', day1 + 2000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'daily_limit');
  assert.equal(blocked.remainingDaily, 0);

  // Next UTC day resets daily counter
  const day2 = Date.UTC(2026, 10, 25, 0, 1, 0);
  const reset = limiter.consume('user_a', day2);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remainingDaily, 1);
});
