export interface ThemeSuggestion {
  id: string;
  name: string;
  isDark: boolean;
}

export const THEME_SUGGESTIONS: ThemeSuggestion[] = [
  // Special Brand Theme
  { id: 'bmss-brand-warm', name: 'BMSS Brand (Warm)', isDark: false },
  
  // 5 Light Themes
  { id: 'light', name: 'BMSS Brand (Default)', isDark: false },
  { id: 'ocean-blue', name: 'Ocean Blue', isDark: false },
  { id: 'sunset-orange', name: 'Sunset Orange', isDark: false },
  { id: 'sunrise-peach', name: 'Sunrise Peach', isDark: false },
  { id: 'lavender-mint', name: 'Lavender Mint', isDark: false },
  
  // 5 Dark Themes
  { id: 'midnight-ramadan', name: 'Midnight Ramadan (Dark)', isDark: true },
  { id: 'midnight-emerald', name: 'Midnight Emerald (Dark)', isDark: true },
  { id: 'cyberpunk-neon', name: 'Cyberpunk Neon (Dark)', isDark: true },
  { id: 'dracula-orchid', name: 'Dracula Orchid (Dark)', isDark: true },
  { id: 'github-dark', name: 'GitHub Dark', isDark: true },
];
