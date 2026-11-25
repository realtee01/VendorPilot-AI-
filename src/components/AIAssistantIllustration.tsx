import React from 'react';
import { VendorPilotLogoMark } from './LandingHero';

/**
 * An engaging cartoon-style SVG illustration featuring a friendly AI Advisor bot
 * with glowing growth charts, sparklines, and verified ledger symbols.
 */
export function AIAssistantIllustration({ className = 'w-full h-36' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 p-4 shadow-inner ${className}`}
    >
      {/* Background glowing particles & grid lines */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_65%)]" />
      <svg
        className="absolute inset-0 h-full w-full opacity-20"
        viewBox="0 0 320 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 70 Q 80 30, 160 70 T 320 70"
          stroke="#ffffff"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d="M0 100 Q 90 60, 180 100 T 320 100"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      </svg>

      <div className="relative z-10 flex items-center justify-between">
        {/* Friendly Cartoon Robot / AI Advisor Character */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-emerald-400 shadow-xl ring-4 ring-white/20">
            {/* Glowing antenna dot */}
            <span className="absolute -top-1.5 right-3 h-3 w-3 animate-ping rounded-full bg-emerald-400" />
            <span className="absolute -top-1.5 right-3 h-3 w-3 rounded-full bg-emerald-300 ring-2 ring-slate-950" />
            <VendorPilotLogoMark className="h-8 w-8 text-emerald-400" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span>AI Advisor Live</span>
            </div>
            <p className="mt-1 font-editorial text-lg font-bold tracking-tight text-white">
              Smart Ledger Insights
            </p>
            <p className="font-hand text-xs text-emerald-100/90">
              Deterministic answers from your cloud records
            </p>
          </div>
        </div>

        {/* Mini Cartoon Sparkline Badge */}
        <div className="hidden rounded-xl bg-white/15 p-2.5 backdrop-blur-md ring-1 ring-white/25 sm:block">
          <svg viewBox="0 0 72 32" className="h-7 w-16" fill="none">
            <path
              d="M4 26 L18 18 L32 22 L48 10 L68 6"
              stroke="#6ee7b7"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="68" cy="6" r="3.5" fill="#ffffff" />
          </svg>
          <span className="mt-1 block text-center font-mono text-[9px] font-bold text-white tracking-widest">
            +34.4% ₦
          </span>
        </div>
      </div>
    </div>
  );
}
