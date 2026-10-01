import type { TrendPoint } from '../../models/trends';
import { buildTrendChartSegments } from './TrendChart';

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
});
