/** Presentation-only composition. It does not alter points or trend calculations. */
export function getTrendsPresentationLayout(width: number, fontScale: number) {
  const enlarged = fontScale > 1.2;
  return {
    stackToolbar: width < 340 || enlarged,
    stackReading: width < 350 || fontScale > 1.35,
    stackStats: width < 360 || fontScale > 1.35,
    chartHeight: (width >= 520 ? 364 : 336) + (enlarged ? 40 : 0),
  };
}
