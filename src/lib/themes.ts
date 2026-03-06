export interface ThemeSuggestion {
  id: string;
  name: string;
  isDark: boolean;
}

export const THEME_SUGGESTIONS: ThemeSuggestion[] = [
  // Institutional Branding
  { id: 'bms3-a', name: 'BMS3 A (Modern Green)', isDark: false },
  { id: 'bms3', name: 'BMS3 (Official Deep Green)', isDark: false },
  { id: 'green-warm', name: 'Green Warm (Earthy Tint)', isDark: false },
  
  // Suggested Palettes
  { id: 'bmss-brand-warm', name: 'Warm Orange Tone', isDark: false },
  { id: 'ocean-blue', name: 'Ocean Blue (Professional)', isDark: false },
  { id: 'sky-blue', name: 'Sky Blue (Bright)', isDark: false },
  { id: 'sunset-orange', name: 'Sunset (Energy)', isDark: false },
  { id: 'lavender-mint', name: 'Peaceful Lavender', isDark: false },
  
  // Technical Styles
  { id: 'light', name: 'Classic Light', isDark: false },
  { id: 'github-light', name: 'GitHub Light', isDark: false },
  
  // Dark Modes
  { id: 'dark', name: 'Midnight (Dark)', isDark: true },
  { id: 'midnight-ramadan', name: 'Midnight Ramadan (Gold)', isDark: true },
  { id: 'midnight-emerald', name: 'Midnight Emerald', isDark: true },
  { id: 'github-dark', name: 'GitHub Dark', isDark: true },
];
