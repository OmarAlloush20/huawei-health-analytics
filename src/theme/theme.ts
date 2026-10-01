export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 44,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  eyebrow: 12,
  caption: 13,
  body: 15,
  cardTitle: 16,
  metric: 28,
  hero: 36,
} as const;

export type AppTheme = ReturnType<typeof createTheme>;

export function createTheme(dark: boolean) {
  return {
    dark,
    colors: dark ? {
      background: '#0B100E',
      surface: '#131A17',
      surfaceRaised: '#19231F',
      surfaceMuted: '#202B26',
      text: '#F2F7F4',
      textSecondary: '#A5B2AC',
      textMuted: '#73817B',
      border: '#293630',
      accent: '#78D8A7',
      accentStrong: '#43B77D',
      accentSoft: '#17392A',
      warning: '#E9BE76',
      danger: '#EF9A9A',
      overlay: 'rgba(0,0,0,0.32)',
    } : {
      background: '#F3F7F4',
      surface: '#FFFFFF',
      surfaceRaised: '#F9FBFA',
      surfaceMuted: '#E9F0EC',
      text: '#142019',
      textSecondary: '#53635B',
      textMuted: '#7A8981',
      border: '#DCE6E0',
      accent: '#187A4E',
      accentStrong: '#0E6640',
      accentSoft: '#DDF2E6',
      warning: '#9A671C',
      danger: '#A83D3D',
      overlay: 'rgba(17,32,24,0.12)',
    },
    spacing,
    radii,
    typography,
  };
}
