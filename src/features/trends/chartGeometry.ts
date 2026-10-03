import type { TrendPoint } from '../../models/trends';

export interface DrawableTrendPoint { index: number; point: TrendPoint; x: number; y: number }
export const isDrawablePoint = (point: TrendPoint) => point.status === 'available' && point.value !== undefined && Number.isFinite(point.value);
const day = (date: string) => Date.parse(`${date}T12:00:00Z`);

export function buildChartGeometry(points: readonly TrendPoint[], width: number, height: number) {
  const values = points.filter(isDrawablePoint).flatMap((point) => [point.value!, ...(point.lowerBound !== undefined && Number.isFinite(point.lowerBound) ? [point.lowerBound] : []), ...(point.upperBound !== undefined && Number.isFinite(point.upperBound) ? [point.upperBound] : [])]);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const padding = Math.max(high - low, Math.abs(high) * 0.08, 1) * 0.12;
  const minimum = low >= 0 ? Math.max(0, low - padding) : low - padding;
  const maximum = Math.max(minimum + 1, high + padding);
  const y = (value: number) => height - (value - minimum) / (maximum - minimum) * height;
  const start = day(points[0]?.date ?? '2000-01-01');
  const end = day(points.at(-1)?.date ?? '2000-01-01');
  const x = (point: TrendPoint) => start === end ? width / 2 : (day(point.date) - start) / (end - start) * width;
  const segments: DrawableTrendPoint[][] = [];
  const dots: DrawableTrendPoint[] = [];
  let segment: DrawableTrendPoint[] = [];
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    if (!isDrawablePoint(point)) { if (segment.length) segments.push(segment); segment = []; continue; }
    if (segment.length && day(point.date) - day(segment.at(-1)!.point.date) > 86400000) { segments.push(segment); segment = []; }
    const dot = { index, point, x: x(point), y: y(point.value!) };
    dots.push(dot); segment.push(dot);
  }
  if (segment.length) segments.push(segment);
  const path = (dots: DrawableTrendPoint[]) => dots.map((dot, index) => `${index ? 'L' : 'M'} ${dot.x} ${dot.y}`).join(' ');
  const paths = segments.map(path);
  const areas = segments.filter((segment) => segment.length > 1).map((segment) => `${path(segment)} L ${segment.at(-1)!.x} ${height} L ${segment[0].x} ${height} Z`);
  const bands: string[] = [];
  for (const segment of segments) {
    let range: DrawableTrendPoint[] = [];
    const flush = () => {
      if (range.length > 1) bands.push(`${range.map((dot, index) => `${index ? 'L' : 'M'} ${dot.x} ${y(dot.point.upperBound!)}`).join(' ')} ${[...range].reverse().map((dot) => `L ${dot.x} ${y(dot.point.lowerBound!)}`).join(' ')} Z`);
      else if (range.length === 1) {
        const dot = range[0]; const left = Math.max(0, dot.x - 2); const right = Math.min(width, dot.x + 2);
        bands.push(`M ${left} ${y(dot.point.upperBound!)} L ${right} ${y(dot.point.upperBound!)} L ${right} ${y(dot.point.lowerBound!)} L ${left} ${y(dot.point.lowerBound!)} Z`);
      }
      range = [];
    };
    for (const dot of segment) {
      if (dot.point.lowerBound === undefined || dot.point.upperBound === undefined || !Number.isFinite(dot.point.lowerBound) || !Number.isFinite(dot.point.upperBound)) flush(); else range.push(dot);
    }
    flush();
  }
  return { paths, dots, areas, bands, minimum, maximum, ticks: [maximum, (maximum + minimum) / 2, minimum], y };
}

export function buildTrendChartSegments(points: readonly TrendPoint[], width: number, height: number): { paths: string[]; dots: DrawableTrendPoint[] } {
  const { paths, dots } = buildChartGeometry(points, width, height); return { paths, dots };
}
export function selectNearestAvailablePoint(points: readonly TrendPoint[], width: number, locationX: number): number | null {
  if (!points.length || width <= 0) return null;
  const { dots } = buildChartGeometry(points, width, 1);
  const target = Math.max(0, Math.min(width, locationX));
  return dots.reduce<DrawableTrendPoint | null>((nearest, dot) => !nearest || Math.abs(dot.x - target) < Math.abs(nearest.x - target) ? dot : nearest, null)?.index ?? null;
}
export function clampTooltipLeft(chartWidth: number, pointX: number, tooltipWidth = 130, margin = 4): number {
  return Math.max(margin, Math.min(Math.max(margin, chartWidth - tooltipWidth - margin), pointX - tooltipWidth / 2));
}
export function comparisonPointForDate(points: readonly TrendPoint[], date: string): TrendPoint | null {
  return points.find((point) => point.date === date && isDrawablePoint(point)) ?? null;
}
export function stepAvailablePoint(points: readonly TrendPoint[], index: number | null, direction: 1 | -1): number | null {
  const available = points.flatMap((point, index) => isDrawablePoint(point) ? [index] : []);
  if (!available.length) return null;
  if (index === null) return direction === 1 ? available[0] : available.at(-1)!;
  return (direction === 1 ? available.find((candidate) => candidate > index) : [...available].reverse().find((candidate) => candidate < index)) ?? index;
}
