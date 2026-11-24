import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesSource = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
) as { firestore: Record<string, unknown> };

test('Firestore rules enforce global default-deny and cover all 6 blueprint collections', () => {
  assert.match(rulesSource, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  const expectedCollections = [
    '/users/{userId}',
    '/businesses/{businessId}',
    '/sales/{saleId}',
    '/expenses/{expenseId}',
    '/products/{productId}',
    '/customers/{customerId}',
  ];
  for (const col of expectedCollections) {
    assert.ok(col in blueprint.firestore, `Blueprint missing ${col}`);
    assert.ok(rulesSource.includes(`match ${col}`), `firestore.rules missing match ${col}`);
  }
});

test('Dirty Dozen 1-4: Unauthenticated block, PII isolation, no list on users/businesses, shadow-key rejection', () => {
  assert.match(rulesSource, /match \/users\/\{userId\}[\s\S]*?allow get: if isValidId\(userId\) && isOwner\(userId\);/);
  assert.match(rulesSource, /match \/users\/\{userId\}[\s\S]*?allow list: if false;/);
  assert.match(rulesSource, /match \/businesses\/\{businessId\}[\s\S]*?allow get: if isValidId\(businessId\) && isOwner\(businessId\);/);
  assert.match(rulesSource, /match \/businesses\/\{businessId\}[\s\S]*?allow list: if false;/);
  assert.match(rulesSource, /isValidUserProfile[\s\S]*?data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesSource, /isValidBusinessProfile[\s\S]*?data\.keys\(\)\.hasOnly\(/);
});

test('Dirty Dozen 5-8: Server timestamps, cross-tenant spoofing, payment invariants, stockDeductedQty bounds', () => {
  assert.match(rulesSource, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesSource, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesSource, /isValidSale[\s\S]*?data\.userId == request\.auth\.uid/);
  assert.match(
    rulesSource,
    /\(data\.paymentStatus == 'Paid' && data\.amountPaid == data\.totalAmount\)/
  );
  assert.match(
    rulesSource,
    /data\.stockDeductedQty is number && data\.stockDeductedQty >= 0 && data\.stockDeductedQty <= data\.quantity/
  );
});

test('Dirty Dozen 9-12: ID poisoning guard, ownership immutability on updates, customer bounds, verified email writes', () => {
  assert.match(rulesSource, /function isValidId\(id\)[\s\S]*?id\.size\(\) <= 128 && id\.matches/);
  assert.match(rulesSource, /match \/expenses\/\{expenseId\}[\s\S]*?incoming\(\)\.userId == existing\(\)\.userId/);
  assert.match(rulesSource, /match \/products\/\{productId\}[\s\S]*?incoming\(\)\.userId == existing\(\)\.userId/);
  assert.match(rulesSource, /match \/customers\/\{customerId\}[\s\S]*?isValidCustomer\(incoming\(\)\)/);
  assert.match(rulesSource, /isValidCustomer[\s\S]*?data\.name\.size\(\) <= 140[\s\S]*?data\.totalSpent >= 0/);
  assert.match(rulesSource, /function isVerifiedUser\(\)[\s\S]*?request\.auth\.token\.email_verified == true/);
  // Ensure list rules explicitly check resource.data.userId == request.auth.uid
  const listMatches = rulesSource.match(/allow list: if isSignedIn\(\) && resource\.data\.userId == request\.auth\.uid;/g) ?? [];
  assert.equal(listMatches.length, 4, 'All 4 tenant collections must enforce resource.data.userId on list');
});
