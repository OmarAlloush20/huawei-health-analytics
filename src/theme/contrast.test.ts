import { createTheme } from './theme';

function luminance(hex: string): number {
  const linear = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

describe.each([true, false])('small-text contrast, dark=%s', (dark) => {
  const colors = createTheme(dark).colors;
  test.each(['background', 'surface', 'surfaceRaised', 'surfaceMuted'] as const)('text roles meet 4.5:1 on %s', (surface) => {
    for (const role of ['text', 'textSecondary', 'textMuted', 'accent', 'sleep', 'activity', 'warning', 'success', 'danger', 'chartSecondary'] as const) {
      expect(contrast(colors[role], colors[surface])).toBeGreaterThanOrEqual(4.5);
    }
  });
  test('selected actions retain readable small text', () => {
    expect(contrast(colors.onAccent, colors.accentStrong)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.accent, colors.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });
});
