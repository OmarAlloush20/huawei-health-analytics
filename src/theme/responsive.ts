export interface ResponsiveLayout {
  compact: boolean;
  enlargedText: boolean;
  singleColumn: boolean;
  stackRecovery: boolean;
}

export function getResponsiveLayout(width: number, fontScale: number): ResponsiveLayout {
  const enlargedText = fontScale > 1.15;
  return {
    compact: width < 390 || enlargedText,
    enlargedText,
    singleColumn: fontScale > 1.35,
    stackRecovery: width < 440 || fontScale > 1.15,
  };
}
