export interface ThemeSuggestion {
  id: string;
  name: string;
  isDark: boolean;
}

export const THEME_SUGGESTIONS: ThemeSuggestion[] = [
  // BMS3 Standard Themes
  { id: 'bms3-a', name: 'BMS3 A (Modern Green)', isDark: false },
  { id: 'bms3', name: 'BMS3 (Official Deep Green)', isDark: false },
  
  // Classic Institutional Themes
  { id: 'light', name: 'Indian Green (Default)', isDark: false },
  { id: 'bmss-brand-warm', name: 'Warm Orange Tone', isDark: false },
  
  // Extended Palette
  { id: 'ocean-blue', name: 'Ocean Blue', isDark: false },
  { id: 'sunset-orange', name: 'Sunset Orange', isDark: false },
  
  // Dark Modes
  { id: 'dark', name: 'Midnight (Dark)', isDark: true },
  { id: 'midnight-ramadan', name: 'Midnight Ramadan', isDark: true },
  { id: 'github-dark', name: 'GitHub Dark', isDark: true },
];