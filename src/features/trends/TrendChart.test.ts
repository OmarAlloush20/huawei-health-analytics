import type { TrendPoint } from '../../models/trends';
import { buildChartGeometry, buildTrendChartSegments, clampTooltipLeft, comparisonPointForDate, selectNearestAvailablePoint, stepAvailablePoint } from './chartGeometry';

describe('Trend chart model', () => {
  test('creates separate paths around missing values rather than connecting through gaps', () => {
    const points: TrendPoint[] = [
      { date: '2026-09-26', status: 'available', value: 10 },
      { date: '2026-09-27', status: 'available', value: 12 },
      { date: '2026-09-28', status: 'missing' },
      { date: '2026-09-29', status: 'available', value: 11 },
      { date: '2026-09-30', status: 'available', value: 13 },
    ];
    const model = buildTrendChartSegments(points, 300, 100);
    expect(model.paths).toHaveLength(2);
    expect(model.dots).toHaveLength(4);
  });

  test('returns an empty drawable model when no measurements exist', () => {
    expect(buildTrendChartSegments([{ date: '2026-09-30', status: 'not-recorded' }], 300, 100)).toEqual({ paths: [], dots: [] });
  });

  test('selects the nearest available observation and skips a gap', () => {
    const points: TrendPoint[] = [
      { date: '2026-09-26', status: 'available', value: 10 },
      { date: '2026-09-27', status: 'missing' },
      { date: '2026-09-28', status: 'available', value: 12 },
    ];
    expect(selectNearestAvailablePoint(points, 200, 95)).toBe(0);
    expect(selectNearestAvailablePoint(points, 200, 115)).toBe(2);
  });

  test('clamps inspection beyond chart bounds', () => {
    const points: TrendPoint[] = [
      { date: '2026-09-26', status: 'available', value: 10 },
      { date: '2026-09-27', status: 'missing' },
      { date: '2026-09-28', status: 'available', value: 12 },
    ];
    expect(selectNearestAvailablePoint(points, 200, -20)).toBe(0);
    expect(selectNearestAvailablePoint(points, 200, 250)).toBe(2);
    expect(selectNearestAvailablePoint([{ date: '2026-09-26', status: 'missing' }], 200, 50)).toBeNull();
  });

  test('keeps the exact-value tooltip inside both chart edges', () => {
    expect(clampTooltipLeft(320, 0)).toBe(4);
    expect(clampTooltipLeft(320, 320)).toBe(186);
    expect(clampTooltipLeft(120, 60)).toBe(4);
  });

  test('keeps personal range inside the adaptive scale and breaks fill at a gap', () => {
    const points: TrendPoint[] = [
      { date: '2026-09-26', status: 'available', value: 10, lowerBound: 5, upperBound: 20 },
      { date: '2026-09-27', status: 'available', value: 12, lowerBound: 6, upperBound: 21 },
      { date: '2026-09-28', status: 'missing' },
      { date: '2026-09-29', status: 'available', value: 11, lowerBound: 7, upperBound: 22 },
      { date: '2026-09-30', status: 'available', value: 13, lowerBound: 8, upperBound: 23 },
    ];
    const model = buildChartGeometry(points, 300, 180);
    expect(model.minimum).toBeLessThan(5);
    expect(model.maximum).toBeGreaterThan(23);
    expect(model.areas).toHaveLength(2);
    expect(model.bands).toHaveLength(2);
    for (const dot of model.dots) { expect(dot.y).toBeGreaterThan(0); expect(dot.y).toBeLessThan(180); }
  });

  test('calendar spacing preserves omitted dates without drawing an invented segment', () => {
    const model = buildChartGeometry([
      { date: '2026-09-26', status: 'available', value: 5 },
      { date: '2026-09-27', status: 'available', value: 6 },
      { date: '2026-09-30', status: 'available', value: 8 },
    ], 400, 100);
    expect(model.paths).toHaveLength(2);
    expect(model.dots.map((dot) => dot.x)).toEqual([0, 100, 400]);
    expect(model.areas).toHaveLength(1);
  });

  test('constant and single observations stay centered vertically in a usable scale', () => {
    const model = buildChartGeometry([{ date: '2026-09-26', status: 'available', value: 42 }], 300, 180);
    expect(model.dots[0].x).toBe(150);
    expect(model.dots[0].y).toBeGreaterThan(0);
    expect(model.dots[0].y).toBeLessThan(180);
    expect(model.areas).toEqual([]);
    expect(model.maximum).toBeGreaterThan(model.minimum);
  });

  test('secondary lookup never substitutes a neighboring day or missing reading', () => {
    const points: TrendPoint[] = [
      { date: '2026-09-26', status: 'available', value: 42 },
      { date: '2026-09-27', status: 'missing' },
      { date: '2026-09-28', status: 'available', value: 45 },
    ];
    expect(comparisonPointForDate(points, '2026-09-26')).toBe(points[0]);
    expect(comparisonPointForDate(points, '2026-09-27')).toBeNull();
    expect(comparisonPointForDate(points, '2026-09-29')).toBeNull();
  });

  test('screen reader actions skip missing days and stop at chart boundaries', () => {
    const points: TrendPoint[] = [
      { date: '2026-09-26', status: 'available', value: 42 },
      { date: '2026-09-27', status: 'missing' },
      { date: '2026-09-28', status: 'available', value: 45 },
    ];
    expect(stepAvailablePoint(points, null, 1)).toBe(0);
    expect(stepAvailablePoint(points, 0, 1)).toBe(2);
    expect(stepAvailablePoint(points, 2, 1)).toBe(2);
    expect(stepAvailablePoint(points, 2, -1)).toBe(0);
    expect(stepAvailablePoint([], null, 1)).toBeNull();
  });

  test.each([328, 358, 380, 600])('measured enlarged-text tooltips fit a %i-wide chart', (width) => {
    const tooltipWidth = Math.min(width - 8, 284);
    for (const pointX of [0, width / 2, width]) {
      const left = clampTooltipLeft(width, pointX, tooltipWidth);
      expect(left).toBeGreaterThanOrEqual(4);
      expect(left + tooltipWidth).toBeLessThanOrEqual(width - 4);
    }
  });
});
