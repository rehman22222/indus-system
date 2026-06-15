// INDUS Hospital & Health Network brand tokens (red + navy), light + dark.

export const lightColors = {
  // Brand — INDUS red
  primary: '#BE1E2D',
  primaryDark: '#8E1620',
  primarySoft: '#FBEAEC', // active/selected tint
  primaryTint: '#F6D7DA',

  // Brand — INDUS navy
  navy: '#1B365D',
  navyDark: '#122643',
  navySoft: '#E8EDF5',
  accent: '#1B365D',

  // Ink / neutrals
  ink: '#0F1E33',
  text: '#1B2A3D',
  muted: '#64748B',
  subtle: '#94A3B8',
  border: '#E6E9EF',
  divider: '#EEF1F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F9FC',
  background: '#F1F4F8',

  // Status
  success: '#15814A',
  successSoft: '#E7F4EC',
  warning: '#B45309',
  warningSoft: '#FBEEDC',
  danger: '#BE1E2D',

  // Legacy aliases (kept so existing screens keep compiling)
  red: '#BE1E2D',
  redDark: '#8E1620',
  green: '#15814A',
  blue: '#1B365D',
  yellow: '#B45309',
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  primary: '#F2616D',
  primaryDark: '#BE1E2D',
  primarySoft: '#3A1E22',
  primaryTint: '#4A2630',

  navy: '#3E5C8A',
  navyDark: '#122643',
  navySoft: '#1E2C44',
  accent: '#3E5C8A',

  ink: '#F1F5F9',
  text: '#DCE5F0',
  muted: '#9AA8BD',
  subtle: '#6B7A92',
  border: '#27344C',
  divider: '#1E2940',
  surface: '#141E30',
  surfaceAlt: '#1C2840',
  background: '#0B1220',

  success: '#3FCB84',
  successSoft: '#16291F',
  warning: '#E5A046',
  warningSoft: '#2A2113',
  danger: '#F2616D',

  red: '#F2616D',
  redDark: '#BE1E2D',
  green: '#3FCB84',
  blue: '#3E5C8A',
  yellow: '#E5A046',
};

// Default static export (light). Screens that consume `useTheme()` get the
// active palette; anything still importing `colors` directly renders light.
export const colors = lightColors;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const spacing = { xs: 6, sm: 10, md: 16, lg: 20, xl: 28 };

export const shadow = {
  soft: {
    shadowColor: '#0F1E33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  card: {
    shadowColor: '#0F1E33',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  brand: {
    shadowColor: '#BE1E2D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 7,
  },
};

export function initials(name?: string): string {
  if (!name) return 'IH';
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'IH';
}
