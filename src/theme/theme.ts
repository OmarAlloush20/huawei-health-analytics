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
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

export const typography = {
  eyebrow: 12,
  caption: 13,
  body: 15,
  cardTitle: 16,
  metric: 30,
  hero: 30,
  display: 64,
  pageTitle: 30,
  section: 20,
} as const;

export const layout = {
  contentMaxWidth: 720,
  minimumTouchTarget: 48,
} as const;

export type AppTheme = ReturnType<typeof createTheme>;

export function createTheme(dark: boolean) {
  return {
    dark,
    colors: dark ? {
      background: '#070A16',
      surface: '#10162A',
      surfaceRaised: '#182039',
      surfaceMuted: '#1D2743',
      text: '#F6F4FF',
      textSecondary: '#B9B8CE',
      textMuted: '#9A9BB3',
      border: '#2C3552',
      accent: '#AE94FF',
      accentStrong: '#7455FF',
      accentSoft: '#262044',
      accentMuted: '#6D5BD0',
      heroStart: '#5B3FD6',
      heroEnd: '#241A63',
      onAccent: '#FFFFFF',
      onAccentMuted: '#DDD6FE',
      success: '#63D7A3',
      warning: '#F2B866',
      danger: '#FF8A9A',
      sleep: '#A4AAFF',
      activity: '#6DCEC6',
      chartSecondary: '#F0B883',
      overlay: 'rgba(3,4,12,0.72)',
    } : {
      background: '#ECECF5',
      surface: '#E6E7F2',
      surfaceRaised: '#F4F2FA',
      surfaceMuted: '#DFE2EF',
      text: '#111427',
      textSecondary: '#59586E',
      textMuted: '#625F73',
      border: '#C6C6DE',
      accent: '#6443D0',
      accentStrong: '#6746DF',
      accentSoft: '#E2DBFA',
      accentMuted: '#8B73DE',
      heroStart: '#7254E8',
      heroEnd: '#3E2A8F',
      onAccent: '#FFFFFF',
      onAccentMuted: '#E9E3FF',
      success: '#176F4D',
      warning: '#945410',
      danger: '#AB3951',
      sleep: '#525BAB',
      activity: '#1C6F6A',
      chartSecondary: '#8E551E',
      overlay: 'rgba(17,13,38,0.30)',
    },
    spacing,
    radii,
    typography,
    layout,
  };
}
