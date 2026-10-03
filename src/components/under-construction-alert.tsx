'use client';

import { useState, useEffect } from 'react';
import { useBranding } from '@/hooks/use-branding';
import { HardHat, X, ShieldCheck, Globe, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * UnderConstructionAlert - Global Domain & Construction Announcement Banner.
 * Dynamic color themes: Amber, Blue, Emerald, Rose.
 * Configurable from System Settings (Branding / Site Banner Controls).
 * Appears on every refresh / reload without persisting dismissal in sessionStorage.
 */
export function UnderConstructionAlert() {
  const { brandingSettings, isLoading } = useBranding();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || isLoading || isDismissed) {
    return null;
  }

  // Visible by default unless explicitly turned off by Admin in System Settings
  const isVisible = brandingSettings?.isUnderConstructionAlertVisible !== false;
  if (!isVisible) {
    return null;
  }

  const style = brandingSettings?.underConstructionAlertStyle || 'amber';

  const styleConfigs = {
    amber: {
      banner: 'bg-amber-500/10 border-b border-amber-500/20 text-amber-950 dark:text-amber-200',
      ping: 'bg-amber-400',
      dot: 'bg-amber-500',
      iconBg: 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
      badge: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/20',
      button: 'text-amber-900 dark:text-amber-200 hover:bg-amber-500/20',
      toggleBtn: 'text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 hover:bg-amber-500/20',
      Icon: HardHat,
    },
    blue: {
      banner: 'bg-blue-500/10 border-b border-blue-500/20 text-blue-950 dark:text-blue-200',
      ping: 'bg-blue-400',
      dot: 'bg-blue-500',
      iconBg: 'bg-blue-500/20 text-blue-800 dark:text-blue-300',
      badge: 'bg-blue-500/15 text-blue-900 dark:text-blue-200 border-blue-500/20',
      button: 'text-blue-900 dark:text-blue-200 hover:bg-blue-500/20',
      toggleBtn: 'text-blue-800 dark:text-blue-300 hover:text-blue-950 dark:hover:text-blue-100 hover:bg-blue-500/20',
      Icon: Globe,
    },
    emerald: {
      banner: 'bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-950 dark:text-emerald-200',
      ping: 'bg-emerald-400',
      dot: 'bg-emerald-500',
      iconBg: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300',
      badge: 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/20',
      button: 'text-emerald-900 dark:text-emerald-200 hover:bg-emerald-500/20',
      toggleBtn: 'text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 hover:bg-emerald-500/20',
      Icon: CheckCircle2,
    },
    rose: {
      banner: 'bg-rose-500/10 border-b border-rose-500/20 text-rose-950 dark:text-rose-200',
      ping: 'bg-rose-400',
      dot: 'bg-rose-500',
      iconBg: 'bg-rose-500/20 text-rose-800 dark:text-rose-300',
      badge: 'bg-rose-500/15 text-rose-900 dark:text-rose-200 border-rose-500/20',
      button: 'text-rose-900 dark:text-rose-200 hover:bg-rose-500/20',
      toggleBtn: 'text-rose-800 dark:text-rose-300 hover:text-rose-950 dark:hover:text-rose-100 hover:bg-rose-500/20',
      Icon: AlertTriangle,
    },
  };

  const currentTheme = styleConfigs[style] || styleConfigs.amber;
  const ThemeIcon = currentTheme.Icon;

  const defaultText = "Notice: Official web domain registration & custom URL setup is in progress. All online donation channels, QR payments, and community portals are fully active and operational.";
  const alertText = brandingSettings?.underConstructionAlertText?.trim() || defaultText;
  const isLongText = alertText.length > 70;

  // Temporarily dismisses for current view only; returns on next page refresh / load
  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div className={cn("py-2.5 backdrop-blur-md transition-all duration-300 relative z-50 animate-fade-in-down", currentTheme.banner)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-start sm:items-center justify-between gap-3 text-xs md:text-sm font-medium">
        <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
          <span className="flex h-2 w-2 relative shrink-0 mt-1 sm:mt-0">
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", currentTheme.ping)}></span>
            <span className={cn("relative inline-flex rounded-full h-2 w-2", currentTheme.dot)}></span>
          </span>
          <div className={cn("p-1 rounded-md shrink-0 mt-0.5 sm:mt-0", currentTheme.iconBg)}>
            <ThemeIcon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("font-semibold tracking-tight text-xs sm:text-sm leading-relaxed transition-all duration-200", isExpanded ? "whitespace-normal break-words" : "truncate")}>
              {alertText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
          {isLongText && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn("text-[11px] font-bold px-2 py-0.5 rounded transition-colors underline-offset-2 hover:underline flex items-center gap-1 shrink-0", currentTheme.toggleBtn)}
              title={isExpanded ? "Collapse full message" : "Expand full message"}
            >
              {isExpanded ? "Show Less" : "Read Full Alert"}
            </button>
          )}
          <span className={cn("hidden md:inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold border uppercase tracking-wider", currentTheme.badge)}>
            <ShieldCheck className="h-3 w-3" /> Active & Secure
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            title="Close for now (will return on refresh)"
            aria-label="Close Alert"
            className={cn("h-6 w-6 rounded-full transition-colors", currentTheme.button)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
