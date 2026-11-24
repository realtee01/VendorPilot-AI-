export interface SignInFormInput {
  email: string;
  password: string;
}

export interface SignUpFormInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HAS_LETTER_RE = /[A-Za-z]/;
const HAS_DIGIT_RE = /\d/;

export function isValidEmailFormat(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length >= 3 && trimmed.length <= 160 && EMAIL_RE.test(trimmed);
}

export function validateSignInForm(input: SignInFormInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!isValidEmailFormat(input.email)) {
    errors.email = 'Enter a valid email address (for example, name@gmail.com).';
  }

  if (!input.password) {
    errors.password = 'Enter your password to sign in.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateSignUpForm(input: SignUpFormInput): ValidationResult {
  const errors: Record<string, string> = {};
  const trimmedName = input.fullName.trim();

  if (trimmedName.length < 2) {
    errors.fullName = 'Enter your full name (at least 2 characters).';
  } else if (trimmedName.length > 120) {
    errors.fullName = 'Full name must be 120 characters or fewer.';
  }

  if (!isValidEmailFormat(input.email)) {
    errors.email = 'Enter a valid email address (for example, name@gmail.com).';
  }

  if (input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  } else if (input.password.length > 128) {
    errors.password = 'Password must be 128 characters or fewer.';
  } else if (!HAS_LETTER_RE.test(input.password) || !HAS_DIGIT_RE.test(input.password)) {
    errors.password = 'Include at least one letter and one number in your password.';
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateResetEmail(email: string): ValidationResult {
  const errors: Record<string, string> = {};
  if (!isValidEmailFormat(email)) {
    errors.email = 'Enter the email address for your account to receive a reset link.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Maps Firebase Auth error codes to clear, non-enumerating user messages.
 */
export function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled before completing. Click below to try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google Sign-In popup. Please allow popups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Authentication settings yet.';
    case 'auth/operation-not-allowed':
      return 'Email & Password sign-in is not enabled in your Firebase project yet. Enable Email/Password under Authentication > Sign-in method in the Firebase Console.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Please check your details and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in or continue with Google.';
    case 'auth/weak-password':
      return 'Please choose a stronger password (at least 8 characters with letters and numbers).';
    case 'auth/too-many-requests':
      return 'Too many attempts in a short time. Please wait a minute and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your administrator for assistance.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Authentication. Check your connection and try again.';
    default:
      return err instanceof Error && err.message
        ? 'Unable to complete authentication right now. Please check your details and try again.'
        : 'Unable to complete authentication right now. Please try again.';
  }
}
