'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, Hourglass } from 'lucide-react';

interface CauseProgressBarProps {
  targetAmount: number;
  collectedAmount: number; // Verified amount
  pendingAmount?: number;  // Pending/Unverified amount linked to this cause
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function CauseProgressBar({
  targetAmount,
  collectedAmount,
  pendingAmount = 0,
  className,
  showDetails = true,
  compact = false,
  size = 'md',
}: CauseProgressBarProps) {
  const target = targetAmount > 0 ? targetAmount : 0;
  const verified = collectedAmount > 0 ? collectedAmount : 0;
  const pending = pendingAmount > 0 ? pendingAmount : 0;

  const verifiedPercent = target > 0 ? Math.min(100, (verified / target) * 100) : 0;
  const pendingPercent = target > 0 ? Math.min(100 - verifiedPercent, (pending / target) * 100) : 0;

  const heightClass = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-2.5';

  return (
    <div className={cn("space-y-2 w-full", className)}>
      {/* Top Header Labels */}
      {showDetails && !compact && (
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 tracking-tight">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Verified: ₹{verified.toLocaleString('en-IN')}
            </span>
            {pending > 0 && (
              <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-bold">
                <Hourglass className="h-3 w-3 text-amber-600 animate-pulse" />
                +₹{pending.toLocaleString('en-IN')} Pending Audit
              </span>
            )}
          </div>
          <span className="text-slate-500 font-extrabold">
            Goal: ₹{target.toLocaleString('en-IN')}
          </span>
        </div>
      )}

      {/* Layered Progress Bar Track */}
      <div 
        title={`Verified: ₹${verified.toLocaleString('en-IN')} (${Math.round(verifiedPercent)}%) ${pending > 0 ? `| Pending Audit: ₹${pending.toLocaleString('en-IN')} (${Math.round(pendingPercent)}%)` : ''} | Goal: ₹${target.toLocaleString('en-IN')}`}
        className={cn("relative w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200/60 cursor-pointer group", heightClass)}
      >
        {/* Verified Segment */}
        <div
          style={{ width: `${verifiedPercent}%` }}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full transition-all duration-500"
        />
        {/* Pending Segment */}
        {pendingPercent > 0 && (
          <div
            style={{ width: `${pendingPercent}%` }}
            className="h-full bg-amber-400 opacity-90 transition-all duration-500 border-l border-white/40 relative overflow-hidden bg-[linear-gradient(45deg,rgba(255,255,255,0.3)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.3)_75%,transparent_75%,transparent)] bg-[length:10px_10px]"
          />
        )}
      </div>

      {/* Bottom Footer Details */}
      {showDetails && (
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
          <span>{Math.round(verifiedPercent)}% Verified Funded</span>
          {pending > 0 && (
            <span className="text-amber-600 font-extrabold">
              +{Math.round(pendingPercent)}% Pending Verification
            </span>
          )}
        </div>
      )}
    </div>
  );
}
