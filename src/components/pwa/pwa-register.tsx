'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.debug('[PWA] Service worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.debug('[PWA] Service worker registration error:', err);
        });
    }
  }, []);

  return null;
}
