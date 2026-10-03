import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, ViewProps } from 'react-native';

import { View } from '../../localization/LocalizedNative';
import type { TrendPoint } from '../../models/trends';
import { isDrawablePoint } from './chartGeometry';

/** Inspection is transient. Its identity is a date, never a cached health value. */
export function useChartInspection(resetKey: string, points: readonly TrendPoint[] = []) {
  const [inspection, setInspection] = useState<{ key: string; date: string | null; scrubbing: boolean } | null>(null);
  // Forget a different workspace synchronously; an effect would expose its stale
  // selection for one render and could resurrect it when returning to the key.
  if (inspection && inspection.key !== resetKey) setInspection(null);
  const active = inspection?.key === resetKey ? inspection : null;
  const selectedDate = active?.date ?? null;
  const scrubbing = active?.scrubbing ?? false;
  const resetSelection = useCallback(() => { setInspection(null); }, []);
  const onSelectionChange = useCallback((point: TrendPoint | null) => {
    setInspection((current) => ({ key: resetKey, date: point && isDrawablePoint(point) ? point.date : null, scrubbing: current?.key === resetKey ? current.scrubbing : false }));
  }, [resetKey]);
  const onScrubChange = useCallback((scrubbing: boolean) => {
    setInspection((current) => ({ key: resetKey, date: current?.key === resetKey ? current.date : null, scrubbing }));
  }, [resetKey]);
  const selectedPoint = points.find((point) => point.date === selectedDate && isDrawablePoint(point)) ?? null;
  return { selectedDate, selectedPoint, scrubbing, resetSelection, onSelectionChange, onScrubChange };
}

interface InspectionTouches {
  protect: (event: GestureResponderEvent) => void;
  consume: (event: GestureResponderEvent) => boolean;
}
const InspectionTouchContext = createContext<InspectionTouches | null>(null);

/**
 * Observes bubbling; it never claims the responder or prevents a press.
 * The inner workspace marks a touch before the boundary sees the same bubble.
 * Thus controls/scrolls outside dismiss inspection, while scrub touches remain intact.
 */
export function InspectionBoundary({ onDismiss, onTouchStart, children, ...props }: ViewProps & { onDismiss: () => void }) {
  const protectedEvents = useRef(new WeakSet<object>());
  const touches = useMemo<InspectionTouches>(() => ({
    protect: (event) => { protectedEvents.current.add(event.nativeEvent); },
    consume: (event) => {
      const inside = protectedEvents.current.has(event.nativeEvent);
      protectedEvents.current.delete(event.nativeEvent);
      return inside;
    },
  }), []);
  return <InspectionTouchContext.Provider value={touches}>
    <View {...props} onTouchStart={(event) => { if (!touches.consume(event)) onDismiss(); onTouchStart?.(event); }}>{children}</View>
  </InspectionTouchContext.Provider>;
}

export function ChartInspectionWorkspace({ onTouchStart, ...props }: ViewProps) {
  const touches = useContext(InspectionTouchContext);
  return <View {...props} onTouchStart={(event) => { touches?.protect(event); onTouchStart?.(event); }} />;
}
