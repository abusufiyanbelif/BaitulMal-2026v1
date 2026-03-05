export interface ThemeSuggestion {
  id: string;
  name: string;
  isDark: boolean;
}

export const THEME_SUGGESTIONS: ThemeSuggestion[] = [
  // BMS3 Standard Theme
  { id: 'bms3', name: 'BMS3 (Deep Green)', isDark: false },
  
  // Classic Indian Green
  { id: 'light', name: 'Indian Green (Default)', isDark: false },
  { id: 'bmss-brand-warm', name: 'Warm Orange Tone', isDark: false },
  
  // High Contrast Themes
  { id: 'ocean-blue', name: 'Ocean Blue', isDark: false },
  { id: 'sunset-orange', name: 'Sunset Orange', isDark: false },
  
  // Dark Institutional Themes
  { id: 'dark', name: 'Midnight (Dark)', isDark: true },
  { id: 'midnight-ramadan', name: 'Midnight Ramadan', isDark: true },
  { id: 'github-dark', name: 'GitHub Dark', isDark: true },
];