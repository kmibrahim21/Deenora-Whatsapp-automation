import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WhatsApp CRM',
    short_name: 'WACRM',
    description: 'WhatsApp Customer Relationship Management & Automation Dashboard',
    start_url: '/inbox',
    display: 'standalone',
    background_color: '#0B141A',
    theme_color: '#10B981',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
