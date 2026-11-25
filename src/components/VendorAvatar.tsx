import React, { useState } from 'react';
import { getDiceBearAvatarUrl } from '../utils/avatars';

interface VendorAvatarProps {
  seed: string;
  alt: string;
  initials: string;
  src?: string;
  className?: string;
  size?: number;
  showInitialsBadge?: boolean;
  badgeSize?: 'sm' | 'md' | 'lg';
}

const BADGE_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: '-right-1 -bottom-1 h-4 min-w-4 px-1 text-[8px]',
  md: '-right-1 -bottom-1 h-5 min-w-5 px-1 text-[9px]',
  lg: '-right-1 -bottom-1 h-6 min-w-6 px-1.5 text-[10px]',
};

/**
 * Renders a DiceBear adventurer-neutral SVG avatar with an optional crisp initials badge
 * and an automatic full-initials fallback if offline or blocked.
 */
export function VendorAvatar({
  seed,
  alt,
  initials,
  src,
  className = 'h-9 w-9 rounded-full',
  size = 40,
  showInitialsBadge = false,
  badgeSize = 'sm',
}: VendorAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const avatarSrc = src ?? getDiceBearAvatarUrl(seed);
  const failed = failedSrc === avatarSrc;

  const core = failed ? (
    <span
      aria-label={alt}
      className={`inline-flex shrink-0 items-center justify-center bg-slate-900 font-display text-xs font-semibold tracking-wide text-emerald-300 dark:bg-emerald-600 dark:text-white ${className}`}
    >
      {initials}
    </span>
  ) : (
    <img
      src={avatarSrc}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(avatarSrc)}
      className={`shrink-0 object-cover select-none ${className}`}
    />
  );

  if (!showInitialsBadge) {
    return core;
  }

  return (
    <span className="relative inline-flex shrink-0">
      {core}
      <span
        aria-hidden="true"
        className={`absolute flex items-center justify-center rounded-md bg-slate-900 font-mono font-bold tracking-tight text-emerald-400 ring-2 ring-white shadow-xs dark:bg-emerald-600 dark:text-white dark:ring-slate-900 ${BADGE_SIZE_CLASSES[badgeSize]}`}
      >
        {initials}
      </span>
    </span>
  );
}
