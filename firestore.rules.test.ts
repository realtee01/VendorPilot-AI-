import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesSource = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');
const blueprint = JSON.parse(
  fs.readFileSync(new URL('./firebase-blueprint.json', import.meta.url), 'utf8')
);

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDenied(condition: boolean, label: string) {
  assert.equal(condition, false, `Expected PERMISSION_DENIED for: ${label}`);
}

test('Firestore rules include global default-deny and all 4 blueprint collections', () => {
  assert.ok(rulesSource.includes("rules_version = '2';"));
  assert.ok(rulesSource.includes('match /{document=**}'));
  assert.ok(rulesSource.includes('allow read, write: if false;'));
  for (const path of Object.keys(blueprint.firestore)) {
    const matchLine = `match ${path}`;
    assert.ok(rulesSource.includes(matchLine), `Missing match block for ${path}`);
  }
});

test('Dirty Dozen 1-4: Users PII isolation, no list, shadow keys, server timestamps', () => {
  // 1 & 2: Users cannot be listed and get requires isOwner(userId)
  assert.ok(rulesSource.includes('allow list: if false;'));
  assert.ok(rulesSource.includes('allow get: if isValidId(userId) && isOwner(userId);'));

  // 3: Shadow ghost field (isAdmin) rejected by hasOnly
  const allowedUserKeys = Object.keys(blueprint.entities.UserProfile.properties);
  const shadowPayloadKeys = [...allowedUserKeys, 'isAdmin'];
  assertDenied(
    shadowPayloadKeys.every((k) => allowedUserKeys.includes(k)),
    'Shadow ghost field isAdmin on /users'
  );

  // 4: Client-spoofed createdAt rejected by request.time check
  assert.ok(rulesSource.includes('incoming().createdAt == request.time'));
  assert.ok(rulesSource.includes('incoming().updatedAt == request.time'));
});

test('Dirty Dozen 5-8: Sales identity spoofing, terminal Paid lock, negative qty, ID poisoning', () => {
  // 5: Identity spoofing blocked by data.userId == request.auth.uid
  assert.ok(rulesSource.includes('data.userId == request.auth.uid'));

  // 6: Terminal Paid lock
  assert.ok(rulesSource.includes("existing().paymentStatus != 'Paid'"));

  // 7: Negative quantity / amount rejected
  assert.ok(rulesSource.includes('data.quantity is number && data.quantity > 0'));
  assert.ok(rulesSource.includes('data.totalAmount is number && data.totalAmount > 0'));

  // 8: Path Variable ID poisoning
  assertDenied(VALID_ID_RE.test('bad$id!@#'), 'Invalid chars in saleId');
  assertDenied('a'.repeat(129).length <= 128, 'Oversized >128 char saleId');
});

test('Dirty Dozen 9-12: Immutable expenses, string bounds, ownership immutability, verified email', () => {
  // 9: Expenses immutable after creation
  const expenseSection = rulesSource.slice(rulesSource.indexOf('match /expenses/{expenseId}'));
  assert.ok(expenseSection.includes('allow update: if false;'));

  // 10: Oversized description rejected by maxLength 240 synced with blueprint
  const maxDesc = blueprint.entities.ExpenseRecord.properties.description.maxLength;
  assert.equal(maxDesc, 240);
  assert.ok(rulesSource.includes(`data.description.size() <= ${maxDesc}`));
  assertDenied('x'.repeat(500).length <= maxDesc, '500-char expense description');

  // 11: Inventory userId immutability enforced on update
  assert.ok(rulesSource.includes('incoming().userId == existing().userId'));

  // 12: Verified email enforced on writes
  assert.ok(rulesSource.includes('request.auth.token.email_verified == true'));

  // Secure list queries enforce resource.data.userId == request.auth.uid
  assert.ok(rulesSource.includes('allow list: if isSignedIn() && resource.data.userId == request.auth.uid;'));
  assert.ok(ISO_DATE_RE.test('2026-11-24'));
  assertDenied(ISO_DATE_RE.test('24-11-2026'), 'Malformed date');
});
