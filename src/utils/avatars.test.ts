import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractFirstName,
  formatDisplayName,
  getUserAvatarUrl,
  getUserInitials,
} from './avatars';

test('extractFirstName capitalizes first name from full name or falls back cleanly to email', () => {
  assert.equal(extractFirstName('tobi akala', 'tobilobakala@gmail.com'), 'Tobi');
  assert.equal(extractFirstName('  Adewale Ogunleye  ', 'adewale@shop.ng'), 'Adewale');
  assert.equal(extractFirstName('', 'tobilobakala@gmail.com'), 'Tobilobakala');
  assert.equal(extractFirstName(undefined, 'tobiloba.akala@gmail.com'), 'Tobiloba');
  assert.equal(extractFirstName('', ''), 'there');
});

test('formatDisplayName title-cases multi-word owner names cleanly', () => {
  assert.equal(formatDisplayName('tobi akala', 'tobilobakala@gmail.com'), 'Tobi Akala');
  assert.equal(formatDisplayName('', 'tobilobakala@gmail.com'), 'Tobilobakala');
});

test('getUserInitials computes crisp 2-letter uppercase initials from name or email', () => {
  assert.equal(getUserInitials('tobi akala', 'tobilobakala@gmail.com'), 'TA');
  assert.equal(getUserInitials('Tobiloba', 'tobilobakala@gmail.com'), 'TO');
  assert.equal(getUserInitials('', 'tobilobakala@gmail.com'), 'TO');
  assert.equal(getUserInitials('', ''), 'VP');
});

test('getUserAvatarUrl uses the configured DiceBear v10 adventurer-neutral endpoint with seed', () => {
  const url = getUserAvatarUrl('tobi akala', 'tobilobakala@gmail.com', 'uid-123');
  assert.ok(
    url.startsWith(
      'https://api.dicebear.com/10.x/adventurer-neutral/svg?backgroundColor=ffe3ea,e3edff,e2f5e9,fdf1d4,efe6ff&seed='
    )
  );
  assert.ok(url.includes('tobi%20akala'));
});
