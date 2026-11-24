import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEmailFormat,
  mapFirebaseAuthError,
  validateResetEmail,
  validateSignInForm,
  validateSignUpForm,
} from './authValidation';

test('isValidEmailFormat accepts standard gmail/business emails and rejects malformed input', () => {
  assert.equal(isValidEmailFormat('owner@gmail.com'), true);
  assert.equal(isValidEmailFormat('sales.team@adebayostores.ng'), true);
  assert.equal(isValidEmailFormat('not-an-email'), false);
  assert.equal(isValidEmailFormat('missing@domain'), false);
  assert.equal(isValidEmailFormat(''), false);
});

test('validateSignInForm validates email and required password', () => {
  const invalid = validateSignInForm({ email: 'bad', password: '' });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.password);

  const valid = validateSignInForm({ email: 'chinedu@gmail.com', password: 'Password123' });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('validateSignUpForm enforces name, email, strong password, and matching confirmation', () => {
  const weak = validateSignUpForm({
    fullName: 'A',
    email: 'invalid',
    password: 'short',
    confirmPassword: 'other',
  });
  assert.equal(weak.valid, false);
  assert.ok(weak.errors.fullName);
  assert.ok(weak.errors.email);
  assert.ok(weak.errors.password);
  assert.ok(weak.errors.confirmPassword);

  const lettersOnly = validateSignUpForm({
    fullName: 'Chinedu Okafor',
    email: 'chinedu@gmail.com',
    password: 'onlyletters',
    confirmPassword: 'onlyletters',
  });
  assert.equal(lettersOnly.valid, false);
  assert.ok(lettersOnly.errors.password);

  const valid = validateSignUpForm({
    fullName: 'Chinedu Okafor',
    email: 'chinedu@gmail.com',
    password: 'Password2026',
    confirmPassword: 'Password2026',
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('validateResetEmail checks email format', () => {
  assert.equal(validateResetEmail('owner@gmail.com').valid, true);
  assert.equal(validateResetEmail('').valid, false);
});

test('mapFirebaseAuthError avoids account enumeration and surfaces setup guidance cleanly', () => {
  const wrongPw = mapFirebaseAuthError({ code: 'auth/wrong-password' });
  const notFound = mapFirebaseAuthError({ code: 'auth/user-not-found' });
  const invalidCred = mapFirebaseAuthError({ code: 'auth/invalid-credential' });
  assert.equal(wrongPw, notFound);
  assert.equal(wrongPw, invalidCred);

  const notEnabled = mapFirebaseAuthError({ code: 'auth/operation-not-allowed' });
  assert.ok(notEnabled.includes('Firebase Console'));

  const alreadyInUse = mapFirebaseAuthError({ code: 'auth/email-already-in-use' });
  assert.ok(alreadyInUse.includes('already exists'));
});
