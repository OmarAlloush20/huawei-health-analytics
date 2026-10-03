import { getTrendsPresentationLayout } from './trendsPresentationLayout';

describe('premium Trends composition', () => {
  test.each([360, 390, 412, 600])('keeps a roomy analytics plot and cohesive normal-size controls at %idp', (width) => {
    const layout = getTrendsPresentationLayout(width, 1);
    expect(layout.stackToolbar).toBe(false);
    expect(layout.stackReading).toBe(false);
    expect(layout.stackStats).toBe(false);
    expect(layout.chartHeight).toBeGreaterThanOrEqual(336);
  });
  test.each([360, 390, 412, 600])('stacks controls, reading and stats instead of truncating enlarged text at %idp', (width) => {
    const layout = getTrendsPresentationLayout(width, 2);
    expect(layout.stackToolbar).toBe(true);
    expect(layout.stackReading).toBe(true);
    expect(layout.stackStats).toBe(true);
    expect(layout.chartHeight).toBeGreaterThanOrEqual(376);
  });
});
