export interface ThemeSuggestion {
  id: string;
  name: string;
  isDark: boolean;
}

export const THEME_SUGGESTIONS: ThemeSuggestion[] = [
  { id: 'light', name: 'BMSS Brand (Default)', isDark: false },
  { id: 'bmss-brand-warm', name: 'BMSS Brand (Warm)', isDark: false },
  { id: 'bmss-brand-1', name: 'BMSS Brand 1', isDark: false },
  { id: 'bmss-brand-2', name: 'BMSS Brand 2', isDark: false },
  { id: 'ocean-blue', name: 'Ocean Blue', isDark: false },
  { id: 'sunset-orange', name: 'Sunset Orange', isDark: false },
  { id: 'royal-purple', name: 'Royal Purple', isDark: false },
  { id: 'forest-amber', name: 'Forest & Amber', isDark: false },
  { id: 'ocean-breeze', name: 'Ocean Breeze', isDark: false },
  { id: 'lavender-mint', name: 'Lavender & Mint', isDark: false },
  { id: 'sunrise-peach', name: 'Sunrise Peach', isDark: false },
  { id: 'classic-crimson', name: 'Classic Crimson', isDark: false },
  { id: 'professional-slate', name: 'Professional Slate', isDark: false },
  { id: 'earthy-tones', name: 'Earthy Tones', isDark: false },
  { id: 'midnight-ramadan', name: 'Midnight Ramadan (Dark)', isDark: true },
  { id: 'slate-lime', name: 'Slate & Lime (Dark)', isDark: true },
  { id: 'midnight-emerald', name: 'Midnight Emerald (Dark)', isDark: true },
  { id: 'cyberpunk-neon', name: 'Cyberpunk Neon (Dark)', isDark: true },
  { id: 'dracula-orchid', name: 'Dracula Orchid (Dark)', isDark: true },
  { id: 'github-dark', name: 'GitHub Dark', isDark: true },
  { id: 'solarized-dark', name: 'Solarized Dark', isDark: true },
  { id: 'forest-night', name: 'Forest Night (Dark)', isDark: true },
  { id: 'rose-pine', name: 'Rose Pine (Dark)', isDark: true },
  { id: 'tokyo-night', name: 'Tokyo Night (Dark)', isDark: true },
  { id: 'nord', name: 'Nord (Dark)', isDark: true },
  { id: 'monokai', name: 'Monokai (Dark)', isDark: true },
];