import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { TrendPoint } from '../../models/trends';
import type { AppTheme } from '../../theme/theme';

export function buildTrendChartSegments(points: readonly TrendPoint[], width: number, height: number): { paths: string[]; dots: { x: number; y: number }[] } {
  const values = points.flatMap((point) => point.status === 'available' && point.value !== undefined ? [point.value] : []);
  if (!values.length) return { paths: [], dots: [] };
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = Math.max(maximum - minimum, Math.abs(maximum) * 0.08, 1);
  const x = (index: number) => points.length === 1 ? width / 2 : index / (points.length - 1) * width;
  const y = (value: number) => height - ((value - minimum + span * 0.08) / (span * 1.16)) * height;
  const paths: string[] = [];
  const dots: { x: number; y: number }[] = [];
  let current = '';
  points.forEach((point, index) => {
    if (point.status !== 'available' || point.value === undefined) {
      if (current) paths.push(current);
      current = '';
      return;
    }
    const pointX = x(index);
    const pointY = y(point.value);
    dots.push({ x: pointX, y: pointY });
    current += `${current ? ' L' : 'M'} ${pointX} ${pointY}`;
  });
  if (current) paths.push(current);
  return { paths, dots };
}

export function TrendChart({ points, theme, accessibilityLabel }: { points: readonly TrendPoint[]; theme: AppTheme; accessibilityLabel: string }) {
  const [width, setWidth] = useState(300);
  const height = 112;
  const model = useMemo(() => buildTrendChartSegments(points, Math.max(1, width - 4), height), [points, width]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke={theme.colors.border} strokeWidth="1" />
        {model.paths.map((path, index) => <Path key={`${path}-${index}`} d={path} fill="none" stroke={theme.colors.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
        {points.length <= 30 ? model.dots.map((dot, index) => <Circle key={`${dot.x}-${index}`} cx={dot.x} cy={dot.y} r="2.8" fill={theme.colors.accentStrong} />) : null}
      </Svg>
    </View>
  );
}
