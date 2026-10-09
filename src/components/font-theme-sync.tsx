'use client';

import { useEffect } from 'react';
import { useBranding } from '@/hooks/use-branding';

export const SUPPORTED_HEADING_FONTS = [
  { id: 'Space Grotesk', name: 'Space Grotesk (Modern Tech)', googleName: 'Space+Grotesk:wght@300;400;500;600;700' },
  { id: 'Inter', name: 'Inter (Clean & Neutral)', googleName: 'Inter:wght@300;400;500;600;700' },
  { id: 'Outfit', name: 'Outfit (Modern Geometric)', googleName: 'Outfit:wght@300;400;500;600;700' },
  { id: 'Poppins', name: 'Poppins (Friendly & Rounded)', googleName: 'Poppins:wght@300;400;500;600;700' },
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans (Corporate & Crisp)', googleName: 'Plus+Jakarta+Sans:wght@300;400;500;600;700' },
  { id: 'Montserrat', name: 'Montserrat (Bold & Expressive)', googleName: 'Montserrat:wght@300;400;500;600;700' },
  { id: 'Roboto', name: 'Roboto (Classic Versatile)', googleName: 'Roboto:wght@300;400;500;700' },
  { id: 'Public Sans', name: 'Public Sans (Crisp Editorial)', googleName: 'Public+Sans:wght@300;400;500;600;700' },
  { id: 'Playfair Display', name: 'Playfair Display (Elegant Serif)', googleName: 'Playfair+Display:wght@400;600;700' },
];

export const SUPPORTED_BODY_FONTS = [
  { id: 'Inter', name: 'Inter (Default)', googleName: 'Inter:wght@300;400;500;600;700' },
  { id: 'Roboto', name: 'Roboto', googleName: 'Roboto:wght@300;400;500;700' },
  { id: 'Poppins', name: 'Poppins', googleName: 'Poppins:wght@300;400;500;600;700' },
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', googleName: 'Plus+Jakarta+Sans:wght@300;400;500;600;700' },
  { id: 'Outfit', name: 'Outfit', googleName: 'Outfit:wght@300;400;500;600;700' },
  { id: 'Open Sans', name: 'Open Sans', googleName: 'Open+Sans:wght@300;400;500;600;700' },
  { id: 'Public Sans', name: 'Public Sans', googleName: 'Public+Sans:wght@300;400;500;600;700' },
];

export const FONT_SCALE_OPTIONS = [
  { id: 'Compact', label: 'Compact (95% - High Density)' },
  { id: 'Normal', label: 'Normal (100% - Default)' },
  { id: 'Large', label: 'Large (105% - High Accessibility)' },
];

function loadGoogleFont(fontName: string) {
  if (!fontName) return;
  const headingMatch = SUPPORTED_HEADING_FONTS.find(f => f.id === fontName);
  const bodyMatch = SUPPORTED_BODY_FONTS.find(f => f.id === fontName);
  const googleName = headingMatch?.googleName || bodyMatch?.googleName;
  if (!googleName) return;

  const elementId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
  if (!document.getElementById(elementId)) {
    const link = document.createElement('link');
    link.id = elementId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${googleName}&display=swap`;
    document.head.appendChild(link);
  }
}

export function FontThemeSync() {
  const { brandingSettings } = useBranding();

  useEffect(() => {
    const headingFont = brandingSettings?.headingFont || 'Space Grotesk';
    const bodyFont = brandingSettings?.bodyFont || 'Inter';
    const fontScale = brandingSettings?.fontScale || 'Normal';

    // 1. Load Google Fonts dynamically
    loadGoogleFont(headingFont);
    loadGoogleFont(bodyFont);

    // 2. Set CSS custom properties on document root
    const root = document.documentElement;
    root.style.setProperty('--font-heading-custom', `"${headingFont}", sans-serif`);
    root.style.setProperty('--font-body-custom', `"${bodyFont}", sans-serif`);

    // 3. Set root font scale
    if (fontScale === 'Compact') {
      root.style.fontSize = '95%';
    } else if (fontScale === 'Large') {
      root.style.fontSize = '105%';
    } else {
      root.style.fontSize = '100%';
    }
  }, [brandingSettings]);

  return null;
}
