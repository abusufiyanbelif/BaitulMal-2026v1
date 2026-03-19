export interface ThemeSuggestion {
  id: string;
  name: string;
  isDark: boolean;
}

/**
 * Official organizational theme identifiers.
 * These IDs must match the [data-theme] attributes in globals.css.
 */
export const THEME_SUGGESTIONS: ThemeSuggestion[] = [
  { id: 'bms3-a', name: 'BMS3 A (Modern Green)', isDark: false },
  { id: 'bms3', name: 'BMS3 (Official Deep Green)', isDark: false },
  { id: 'steel-blue', name: 'Steel Blue (Institutional Reference)', isDark: false },
  { id: 'green-warm', name: 'Green Warm (Earthy Tint)', isDark: false },
  { id: 'bmss-brand-warm', name: 'Warm Orange Tone', isDark: false },
  { id: 'ocean-blue', name: 'Ocean Blue (Professional)', isDark: false },
  { id: 'sky-blue', name: 'Sky Blue (Bright)', isDark: false },
  { id: 'sunset-orange', name: 'Sunset (Energy)', isDark: false },
  { id: 'lavender-mint', name: 'Peaceful Lavender', isDark: false },
  { id: 'light', name: 'Classic Light', isDark: false },
  { id: 'midnight-dark', name: 'Midnight (Dark)', isDark: true },
  { id: 'midnight-ramadan', name: 'Midnight Ramadan (Gold)', isDark: true },
  { id: 'midnight-emerald', name: 'Midnight Emerald', isDark: true },
];