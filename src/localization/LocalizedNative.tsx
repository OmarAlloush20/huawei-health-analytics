import { Children, forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable as NativePressable, Text as NativeText, View as NativeView, type PressableProps, type TextProps, type ViewProps } from 'react-native';

import { isNumericLabel, localizeText } from './i18n';
import { useLocale } from './useLocale';

type AccessibleProps = Pick<ViewProps, 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityValue' | 'accessibilityActions'>;
function accessibleProps<T extends AccessibleProps>(props: T, language: 'en' | 'ar') {
  return { ...props,
    accessibilityLabel: props.accessibilityLabel ? localizeText(props.accessibilityLabel, language) : undefined,
    accessibilityHint: props.accessibilityHint ? localizeText(props.accessibilityHint, language) : undefined,
    accessibilityValue: props.accessibilityValue ? { ...props.accessibilityValue, text: props.accessibilityValue.text ? localizeText(props.accessibilityValue.text, language) : undefined } : undefined,
    accessibilityActions: props.accessibilityActions?.map((action) => ({ ...action, label: action.label ? localizeText(action.label, language) : undefined })),
  };
}
export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(function LocalizedText({ children, style, ...props }, ref) {
  const { language, isRTL } = useLocale();
  // JSX interpolations are separate children. Translate a complete sentence, not its fragments.
  const runs: ReactNode[] = [];
  Children.toArray(children).forEach((child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      if (typeof runs.at(-1) === 'string') runs[runs.length - 1] = `${runs.at(-1)}${child}`;
      else runs.push(String(child));
    } else runs.push(child);
  });
  const localized = runs.map((child) => typeof child === 'string' ? localizeText(child, language) : child);
  const plain = Children.toArray(localized).filter((child) => typeof child === 'string').join('');
  const numeric = isNumericLabel(plain);
  return <NativeText {...accessibleProps(props, language)} ref={ref} style={[{ writingDirection: numeric ? 'ltr' : isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left' }, style, isRTL && { letterSpacing: 0 }]}>{localized.length === 1 ? localized[0] : localized}</NativeText>;
});
export const View = forwardRef<ComponentRef<typeof NativeView>, ViewProps>(function LocalizedView({ style, ...props }, ref) {
  const { language, direction } = useLocale();
  return <NativeView {...accessibleProps(props, language)} ref={ref} style={[{ direction }, style]} />;
});
export const Pressable = forwardRef<ComponentRef<typeof NativePressable>, PressableProps>(function LocalizedPressable({ style, ...props }, ref) {
  const { language, direction } = useLocale();
  return <NativePressable {...accessibleProps(props, language)} ref={ref} style={(state) => [{ direction }, typeof style === 'function' ? style(state) : style]} />;
});
