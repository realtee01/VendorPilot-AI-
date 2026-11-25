export interface CuratedAvatar {
  id: string;
  seed: string;
  label: string;
  initials: string;
  url: string;
}

const DICEBEAR_BASE =
  'https://api.dicebear.com/10.x/adventurer-neutral/svg?backgroundColor=ffe3ea,e3edff,e2f5e9,fdf1d4,efe6ff';

export function getDiceBearAvatarUrl(seed: string): string {
  const cleanSeed = seed.trim() || 'VendorPilot';
  return `${DICEBEAR_BASE}&seed=${encodeURIComponent(cleanSeed)}`;
}

function capitalizeWord(word: string): string {
  const trimmed = word.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Extracts a clean capitalized first name from a user's full name,
 * falling back gracefully to the email prefix if no full name is set yet.
 * Example: "tobi akala" -> "Tobi", "tobiloba.akala@gmail.com" -> "Tobiloba".
 */
export function extractFirstName(
  fullName?: string | null,
  email?: string | null
): string {
  const trimmedName = (fullName ?? '').trim();
  if (trimmedName) {
    const firstWord = trimmedName.split(/\s+/).filter(Boolean)[0] ?? '';
    if (firstWord) return capitalizeWord(firstWord);
  }

  const trimmedEmail = (email ?? '').trim();
  if (trimmedEmail.includes('@')) {
    const localPart = trimmedEmail.split('@')[0] ?? '';
    const token = localPart.split(/[._\-+0-9]+/).filter(Boolean)[0] ?? localPart;
    if (token) return capitalizeWord(token);
  }

  return 'there';
}

/**
 * Title-cases a user's full name cleanly for display inside the workspace.
 * Example: "tobi akala" -> "Tobi Akala".
 */
export function formatDisplayName(
  fullName?: string | null,
  email?: string | null
): string {
  const trimmedName = (fullName ?? '').trim();
  if (trimmedName) {
    return trimmedName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => capitalizeWord(part))
      .join(' ');
  }
  const fallback = extractFirstName(undefined, email);
  return fallback === 'there' ? 'Business Owner' : fallback;
}

/**
 * Computes crisp 2-letter uppercase initials from a user's full name or email.
 * Example: "tobi akala" -> "TA", "Tobiloba" -> "TO".
 */
export function getUserInitials(
  fullName?: string | null,
  email?: string | null
): string {
  const trimmedName = (fullName ?? '').trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }

  const fallback = extractFirstName(undefined, email);
  if (fallback && fallback !== 'there') {
    return fallback.slice(0, 2).toUpperCase();
  }
  return 'VP';
}

/**
 * Deterministic avatar seed tied to the signed-in user so their DiceBear
 * adventurer-neutral portrait stays consistent across all workspace screens.
 */
export function getUserAvatarSeed(
  fullName?: string | null,
  email?: string | null,
  uid?: string | null
): string {
  const cleanName = (fullName ?? '').trim();
  if (cleanName) return cleanName;
  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (cleanEmail) return cleanEmail;
  if (uid && uid.trim()) return uid.trim();
  return 'VendorPilot';
}

export function getUserAvatarUrl(
  fullName?: string | null,
  email?: string | null,
  uid?: string | null
): string {
  return getDiceBearAvatarUrl(getUserAvatarSeed(fullName, email, uid));
}

/**
 * Five curated DiceBear adventurer-neutral avatars used consistently
 * across Hero social proof and SME preview ledgers.
 */
export const CURATED_AVATARS: CuratedAvatar[] = [
  {
    id: 'amina',
    seed: 'AmakaNwosu',
    label: 'Amaka Nwosu',
    initials: 'AN',
    url: getDiceBearAvatarUrl('AmakaNwosu'),
  },
  {
    id: 'tunde',
    seed: 'TundeBakare',
    label: 'Tunde Bakare',
    initials: 'TB',
    url: getDiceBearAvatarUrl('TundeBakare'),
  },
  {
    id: 'chinedu',
    seed: 'ChineduOkafor',
    label: 'Chinedu Okafor',
    initials: 'CO',
    url: getDiceBearAvatarUrl('ChineduOkafor'),
  },
  {
    id: 'funke',
    seed: 'FunkeAdesanya',
    label: 'Funke Adesanya',
    initials: 'FA',
    url: getDiceBearAvatarUrl('FunkeAdesanya'),
  },
  {
    id: 'adebayo',
    seed: 'AdebayoStores',
    label: 'Adebayo Stores',
    initials: 'AS',
    url: getDiceBearAvatarUrl('AdebayoStores'),
  },
];
