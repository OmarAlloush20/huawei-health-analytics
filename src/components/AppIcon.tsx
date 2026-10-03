import type { ReactNode } from 'react';
import { View, type ColorValue } from 'react-native';
import { Circle, Ellipse, Line, Path, Polyline, Svg } from 'react-native-svg';
import { useLocale } from '../localization/useLocale';

export type AppIconName =
  | 'arrow-right'
  | 'arrow-left'
  | 'calendar'
  | 'check'
  | 'activity'
  | 'alert'
  | 'bell'
  | 'clock'
  | 'external'
  | 'heart'
  | 'home'
  | 'hrv'
  | 'insights'
  | 'legal'
  | 'oxygen'
  | 'recovery'
  | 'settings'
  | 'sleep'
  | 'stress'
  | 'language'
  | 'palette'
  | 'database'
  | 'code'
  | 'trends';

export function AppIcon({ name, color, size = 22, strokeWidth = 1.8 }: { name: AppIconName; color: ColorValue; size?: number; strokeWidth?: number }) {
  const { isRTL } = useLocale();
  const mirror = isRTL && (name === 'arrow-left' || name === 'arrow-right' || name === 'external');
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth };
  return (
    <Svg accessibilityElementsHidden focusable={false} height={size} importantForAccessibility="no" viewBox="0 0 24 24" width={size} style={{ transform: [{ scaleX: mirror ? -1 : 1 }] }}>
      {name === 'arrow-right' ? <Path d="m9 5 7 7-7 7" {...common} /> : null}
      {name === 'arrow-left' ? <Path d="m15 5-7 7 7 7" {...common} /> : null}
      {name === 'check' ? <Path d="m5 12 4 4 10-10" {...common} /> : null}
      {name === 'calendar' ? <><Path d="M5 5h14v15H5ZM8 3v4M16 3v4M5 10h14" {...common} /><Circle cx="9" cy="14" r="1" fill={color} /><Circle cx="15" cy="14" r="1" fill={color} /></> : null}
      {name === 'home' ? <><Path d="M3.5 10.5 12 3.7l8.5 6.8" {...common} /><Path d="M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6" {...common} /></> : null}
      {name === 'trends' ? <><Path d="M4 19V5" {...common} /><Path d="M4 19h16" {...common} /><Polyline points="6.5,15 10,11.5 13,13 19,6.5" {...common} /></> : null}
      {name === 'insights' ? <><Path d="M8.5 15.5h7M9.5 19h5" {...common} /><Path d="M8.1 13.2a6 6 0 1 1 7.8 0c-1 .8-1.4 1.4-1.5 2.3H9.6c-.1-.9-.5-1.5-1.5-2.3Z" {...common} /></> : null}
      {name === 'settings' ? <><Circle cx="12" cy="12" r="3" {...common} /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" {...common} /></> : null}
      {name === 'recovery' ? <><Circle cx="12" cy="12" r="8.5" {...common} /><Path d="M7 13h3l1.3-4 2.2 7 1.5-3h2" {...common} /></> : null}
      {name === 'sleep' ? <Path d="M18.8 15.2A7.5 7.5 0 0 1 8.8 5.1 7.5 7.5 0 1 0 18.8 15.2Z" {...common} /> : null}
      {name === 'hrv' ? <><Path d="M3 12h3l2-5 3.2 10 2.5-7 1.8 4H21" {...common} /></> : null}
      {name === 'heart' ? <Path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 1 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1Z" {...common} /> : null}
      {name === 'oxygen' ? <><Circle cx="10" cy="12" r="6.5" {...common} /><Circle cx="10" cy="12" r="2.5" {...common} /><Line x1="17" x2="21" y1="8" y2="8" {...common} /><Line x1="19" x2="19" y1="6" y2="10" {...common} /></> : null}
      {name === 'stress' ? <><Path d="M5 15c1.4-5.4 3.2-8 5.2-8 2.4 0 2.8 10 5.2 10 1.4 0 2.6-1.4 3.6-4" {...common} /><Line x1="4" x2="20" y1="20" y2="20" {...common} /></> : null}
      {name === 'activity' ? <><Circle cx="12" cy="4.5" r="1.7" {...common} /><Path d="m9 9 3-1.5 2.5 2.5 3 .8M12 8l-1 5-3 2.5M11 13l3 2 1.5 4" {...common} /></> : null}
      {name === 'bell' ? <><Path d="M6 17h12l-1.2-1.8V10a4.8 4.8 0 0 0-9.6 0v5.2L6 17Z" {...common} /><Path d="M10 20h4" {...common} /></> : null}
      {name === 'clock' ? <><Circle cx="12" cy="12" r="8.5" {...common} /><Path d="M12 7v5l3 2" {...common} /></> : null}
      {name === 'legal' ? <><Path d="M6 3.5h9l3 3v14H6Z" {...common} /><Path d="M15 3.5v3h3M9 11h6M9 15h6" {...common} /></> : null}
      {name === 'external' ? <><Path d="M14 5h5v5M19 5l-8 8" {...common} /><Path d="M17 13v6H5V7h6" {...common} /></> : null}
      {name === 'alert' ? <><Path d="m12 3 9 17H3Z" {...common} /><Line x1="12" x2="12" y1="9" y2="14" {...common} /><Circle cx="12" cy="17" fill={color} r=".8" /></> : null}
      {name === 'language' ? <><Circle cx="12" cy="12" r="8.5" {...common} /><Ellipse cx="12" cy="12" rx="3.5" ry="8.5" {...common} /><Path d="M4 9h16M4 15h16" {...common} /></> : null}
      {name === 'palette' ? <><Path d="M12 3.5a8.5 8.5 0 1 0 0 17h1a2.5 2.5 0 0 0 2.1-3.8 1.8 1.8 0 0 1 1.5-2.7H18A3.5 3.5 0 0 0 21.5 10c0-3.6-4.3-6.5-9.5-6.5Z" {...common} /><Circle cx="8" cy="9" r="1" fill={color} /><Circle cx="12" cy="7" r="1" fill={color} /><Circle cx="16" cy="9" r="1" fill={color} /></> : null}
      {name === 'database' ? <><Ellipse cx="12" cy="5.5" rx="7.5" ry="3" {...common} /><Path d="M4.5 5.5v13c0 4 15 4 15 0v-13M4.5 12c0 4 15 4 15 0" {...common} /></> : null}
      {name === 'code' ? <><Path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" {...common} /></> : null}
    </Svg>
  );
}

export function BrandMark({ size = 36, color = '#A78BFA', secondary = '#7C5CFC' }: { size?: number; color?: string; secondary?: string }) {
  return (
    <Svg accessibilityElementsHidden focusable={false} height={size} importantForAccessibility="no" viewBox="0 0 48 48" width={size}>
      <Ellipse cx="24" cy="24" fill="none" rx="18" ry="9" stroke={secondary} strokeWidth="4" transform="rotate(35 24 24)" />
      <Ellipse cx="24" cy="24" fill="none" rx="18" ry="9" stroke={color} strokeWidth="4" transform="rotate(-35 24 24)" />
      <Circle cx="24" cy="24" fill={color} r="4.5" />
    </Svg>
  );
}

export function IconBadge({ name, color, background, size = 38 }: { name: AppIconName; color: ColorValue; background: string; size?: number }) {
  return <RectIconShell background={background} size={size}><AppIcon color={color} name={name} size={Math.round(size * 0.52)} /></RectIconShell>;
}

function RectIconShell({ background, children, size }: { background: string; children: ReactNode; size: number }) {
  return <RectIconShellView background={background} size={size}>{children}</RectIconShellView>;
}

function RectIconShellView({ background, children, size }: { background: string; children: ReactNode; size: number }) {
  return <View style={{ alignItems: 'center', backgroundColor: background, borderRadius: Math.round(size * 0.34), height: size, justifyContent: 'center', width: size }}>{children}</View>;
}
