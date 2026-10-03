import { getResponsiveLayout } from './responsive';

describe('responsive layout audit matrix', () => {
  test.each([360, 390, 412])('Recovery stacks at %idp regardless of language', (width) => {
    expect(getResponsiveLayout(width, 1).stackRecovery).toBe(true);
  });
  test('Recovery shares a row only with enough width and normal text size', () => {
    expect(getResponsiveLayout(440, 1).stackRecovery).toBe(false);
    expect(getResponsiveLayout(768, 1).stackRecovery).toBe(false);
    expect(getResponsiveLayout(768, 1.2).stackRecovery).toBe(true);
    expect(getResponsiveLayout(360, 2).singleColumn).toBe(true);
  });
  test.each([
    [360, true],
    [390, false],
    [412, false],
    [768, false],
  ])('%ip width selects the expected compact presentation', (width, compact) => {
    expect(getResponsiveLayout(width, 1).compact).toBe(compact);
  });

  test('enlarged text activates compact spacing and very large text activates single-column vitals', () => {
    expect(getResponsiveLayout(360, 1)).toMatchObject({ compact: true, singleColumn: false });
    expect(getResponsiveLayout(390, 1)).toMatchObject({ compact: false, singleColumn: false });
    expect(getResponsiveLayout(412, 1.2)).toMatchObject({ compact: true, enlargedText: true, singleColumn: false });
    expect(getResponsiveLayout(412, 1.4)).toMatchObject({ compact: true, enlargedText: true, singleColumn: true });
  });
});
