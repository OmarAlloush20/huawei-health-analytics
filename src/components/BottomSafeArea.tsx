import type { ComponentProps } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Additive native insets, measured live by the nearest window provider.
 * Own the bottom once: tabbed screens exclude it; hidden-tab screens include it.
 * Style padding is visual spacing, never an assumed Android navigation height.
 */
export function BottomSafeArea(props: Omit<ComponentProps<typeof SafeAreaView>, 'edges'>) {
  return <SafeAreaView {...props} edges={['bottom', 'left', 'right']} />;
}
