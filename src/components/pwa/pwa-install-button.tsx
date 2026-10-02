'use client';

import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/use-pwa-install';

export function PWAInstallButton({ className }: { className?: string }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running as an installed PWA, hide or show installed status
  if (isInstalled) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500 ${className || ''}`}>
        <CheckCircle2 className="size-4 shrink-0" />
        <span>App Installed</span>
      </div>
    );
  }

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleInstall}
        disabled={installing}
        className={`flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 ${className || ''}`}
      >
        <Download className="size-4 shrink-0" />
        <span>Install App</span>
      </Button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 ${className || ''}`}
        >
          <Smartphone className="size-4 shrink-0" />
          <span>Install on iOS</span>
        </Button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Install on iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                1. Tap the <strong>Share</strong> button in the Safari toolbar.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.<br />
                3. Tap <strong>Add</strong> in the top-right corner.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full"
              >
                Got it
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
