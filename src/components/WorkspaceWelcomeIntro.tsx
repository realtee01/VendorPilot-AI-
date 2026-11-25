import React, { useEffect, useState } from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import {
  extractFirstName,
  formatDisplayName,
  getUserAvatarSeed,
  getUserAvatarUrl,
  getUserInitials,
} from '../utils/avatars';
import { VendorAvatar } from './VendorAvatar';
import { VendorPilotLogoMark } from './LandingHero';

interface WorkspaceWelcomeIntroProps {
  userId: string;
  ownerName: string;
  email?: string | null;
  businessName: string;
  businessType?: string;
  isFirstTimeSetup?: boolean;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * Personalized full-screen welcome intro displayed once per session
 * when a user creates their account or enters their VendorPilot AI business workspace.
 */
export function WorkspaceWelcomeIntro({
  userId,
  ownerName,
  email,
  businessName,
  businessType,
  isFirstTimeSetup = false,
}: WorkspaceWelcomeIntroProps) {
  const storageKey = `vp_workspace_welcome_${userId}`;
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return false;
      }
      return sessionStorage.getItem(storageKey) !== 'shown';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem(storageKey, 'shown');
    } catch {
      // Ignore storage failures in strict private browsing
    }

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 2350);

    return () => window.clearTimeout(timer);
  }, [visible, storageKey]);

  const firstName = extractFirstName(ownerName, email);
  const fullName = formatDisplayName(ownerName, email);
  const initials = getUserInitials(ownerName, email);
  const avatarSeed = getUserAvatarSeed(ownerName, email, userId);
  const avatarUrl = getUserAvatarUrl(ownerName, email, userId);
  const safeBusinessName = businessName.trim() || 'your business workspace';

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>
        <AnimatePresence>
          {visible && (
            <m.div
              key="vp-workspace-welcome"
              role="dialog"
              aria-modal="true"
              aria-label={`Welcome ${firstName}`}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.42, ease: 'easeOut' } }}
              className="fixed inset-0 z-[75] flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-950 px-5 text-center text-white"
            >
              {/* Soft radial luminous backdrop */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_48%_at_50%_38%,rgba(255,255,255,0.22),transparent_72%)]"
              />

              <div className="relative z-10 flex max-w-md flex-col items-center">
                {/* Brand Lockup */}
                <m.div
                  initial={{ opacity: 0, transform: 'translateY(-10px)' }}
                  animate={{ opacity: 1, transform: 'translateY(0px)' }}
                  transition={{ duration: 0.45, ease: EASE_OUT }}
                  className="mb-7 inline-flex items-center gap-2 rounded-xl bg-white/12 px-3.5 py-1.5 backdrop-blur-md ring-1 ring-white/20"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-950 text-emerald-400">
                    <VendorPilotLogoMark className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-editorial text-sm font-semibold tracking-normal text-white">
                    VendorPilot <span className="text-emerald-200">AI</span>
                  </span>
                </m.div>

                {/* Springing Personalized DiceBear Avatar + Initials Badge */}
                <m.div
                  initial={{ opacity: 0, transform: 'scale(0.66) rotate(-8deg)' }}
                  animate={{ opacity: 1, transform: 'scale(1) rotate(0deg)' }}
                  transition={{ type: 'spring', stiffness: 250, damping: 18, delay: 0.08 }}
                  className="rounded-[26px] bg-white/15 p-2 shadow-2xl shadow-emerald-950/50 ring-1 ring-white/30 backdrop-blur-md"
                >
                  <VendorAvatar
                    seed={avatarSeed}
                    src={avatarUrl}
                    alt={`${fullName} (${initials})`}
                    initials={initials}
                    size={84}
                    showInitialsBadge
                    badgeSize="lg"
                    className="h-20 w-20 rounded-[20px] ring-2 ring-white/90"
                  />
                </m.div>

                {/* Personalized Greeting Headline */}
                <m.h1
                  initial={{ opacity: 0, transform: 'translateY(14px)' }}
                  animate={{ opacity: 1, transform: 'translateY(0px)' }}
                  transition={{ duration: 0.55, delay: 0.22, ease: EASE_OUT }}
                  className="mt-6 font-editorial text-4xl leading-none font-bold tracking-normal text-white sm:text-5xl"
                >
                  Hi {firstName}!
                </m.h1>

                <m.p
                  initial={{ opacity: 0, transform: 'translateY(10px)' }}
                  animate={{ opacity: 1, transform: 'translateY(0px)' }}
                  transition={{ duration: 0.55, delay: 0.34, ease: EASE_OUT }}
                  className="mt-3 font-hand text-xl leading-snug text-emerald-50 sm:text-2xl"
                >
                  {isFirstTimeSetup
                    ? `Welcome to ${safeBusinessName} — your private ledger is ready.`
                    : `Welcome back to ${safeBusinessName}.`}
                </m.p>

                <m.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.88 }}
                  transition={{ duration: 0.5, delay: 0.45 }}
                  className="mt-2 text-xs font-medium text-emerald-100/90"
                >
                  {fullName} ({initials})
                  {businessType ? ` · ${businessType}` : ''}
                </m.p>

                {/* Gliding Emerald Progress Track */}
                <div className="vp-splash-road relative mt-8 h-0 w-48">
                  <span className="vp-splash-glider absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-emerald-700 shadow-md">
                      <VendorPilotLogoMark className="h-3 w-3" />
                    </span>
                  </span>
                </div>

                <m.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.55 }}
                  onClick={() => setVisible(false)}
                  className="mt-8 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span>Enter Dashboard</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </m.button>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>
    </MotionConfig>
  );
}
