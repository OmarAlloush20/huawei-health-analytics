import React, { act } from 'react';
import { afterEach, expect, jest, test } from '@jest/globals';
import TestRenderer from 'react-test-renderer';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { publishLanguage } from '../localization/i18n';
import { createTheme } from '../theme/theme';
import { ProductTabBar } from './ProductTabBar';
import { ProductSheet } from './ProductUI';

// Simulates the native additive inset contract, not physical Android window QA.
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { StyleSheet, View } = jest.requireActual('react-native');
  const Context = React.createContext({ top: 24, left: 0, right: 0, bottom: 0 });
  return {
    SafeAreaInsetsContext: Context,
    SafeAreaProvider: ({ children }) => React.createElement(View, { testID: 'modal-inset-provider' }, children),
    SafeAreaView: ({ edges, style, ...props }) => {
      const insets = React.useContext(Context);
      const flattened = StyleSheet.flatten(style) ?? {};
      const additive = { ...flattened };
      for (const edge of edges) {
        const name = `padding${edge[0].toUpperCase()}${edge.slice(1)}`;
        const axis = edge === 'left' || edge === 'right' ? flattened.paddingHorizontal : flattened.paddingVertical;
        additive[name] = (flattened[name] ?? axis ?? flattened.padding ?? 0) + insets[edge];
      }
      return React.createElement(View, { ...props, style: additive, testInsetsEdges: edges });
    },
  };
});
jest.mock('../theme/ThemeContext', () => ({ useAppTheme: () => ({ theme: jest.requireActual('../theme/theme').createTheme(true) }) }));
jest.mock('./AppIcon', () => ({ AppIcon: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let screen;
afterEach(async () => { await act(async () => screen?.unmount()); publishLanguage('en'); });
const state = { index: 0, routes: ['index', 'trends', 'insights', 'settings', 'metric/[metric]', 'developer-tools'].map((name) => ({ key: name, name })) };
const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
const tree = (bottom, language) => {
  publishLanguage(language);
  return <SafeAreaInsetsContext.Provider value={{ top: 24, bottom, left: 4, right: 6 }}><ProductTabBar state={state} navigation={navigation} /></SafeAreaInsetsContext.Provider>;
};

test.each(['en', 'ar'])('%s tabs follow live gesture/3-button/gesture inset changes without a fixed height', async (language) => {
  await act(async () => { screen = TestRenderer.create(tree(0, language)); });
  for (const bottom of [0, 16, 48, 16, 0]) {
    await act(async () => screen.update(tree(bottom, language)));
    const shell = screen.root.findAllByType(View).find((node) => node.props.testID === 'product-tab-safe-area');
    expect(shell.props.testInsetsEdges).toEqual(['bottom', 'left', 'right']);
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({ paddingBottom: bottom + 8, paddingLeft: 16, paddingRight: 18 });
    expect(StyleSheet.flatten(shell.props.style).position).not.toBe('absolute');
    expect(StyleSheet.flatten(shell.props.style).height).toBeUndefined();
    expect(screen.root.findAllByType(Text).map((node) => node.props.children)).toContain(language === 'ar' ? 'اليوم' : 'Today');
  }
});

test.each([4, 5])('hidden-tab route %i leaves bottom ownership to its screen', async (index) => {
  await act(async () => { screen = TestRenderer.create(<ProductTabBar state={{ ...state, index }} navigation={navigation} />); });
  expect(screen.toJSON()).toBeNull();
});

test('sheets measure their own translucent native window and keep actions above live bottom/side insets', async () => {
  const close = jest.fn();
  const render = (bottom) => <SafeAreaInsetsContext.Provider value={{ top: 24, bottom, left: 2, right: 3 }}><ProductSheet visible title="Data" onClose={close} theme={createTheme(false)}><Text>Save</Text></ProductSheet></SafeAreaInsetsContext.Provider>;
  await act(async () => { screen = TestRenderer.create(render(16)); });
  expect(screen.root.findByType(Modal).props).toMatchObject({ navigationBarTranslucent: true, statusBarTranslucent: true, onRequestClose: close });
  expect(screen.root.findAllByProps({ testID: 'modal-inset-provider' }).length).toBeGreaterThan(0);
  for (const bottom of [16, 48, 0]) {
    await act(async () => screen.update(render(bottom)));
    const sheet = screen.root.findAllByType(View).find((node) => node.props.testID === 'product-sheet-safe-area');
    expect(sheet.props.testInsetsEdges).toEqual(['bottom', 'left', 'right']);
    expect(StyleSheet.flatten(sheet.props.style)).toMatchObject({ paddingBottom: bottom, paddingLeft: 26, paddingRight: 27 });
  }
});
