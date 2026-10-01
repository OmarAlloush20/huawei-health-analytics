import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import type { DailyReminderTime, NotificationPermissionState, NotificationSettingsSnapshot } from '../../models/notifications';
import { formatReminderTime } from '../../services/notificationPolicy';
import { createTheme, type AppTheme } from '../../theme/theme';

export function NotificationSettingsScreen() {
  const scheme = useColorScheme();
  const theme = useMemo(() => createTheme(scheme !== 'light'), [scheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [snapshot, setSnapshot] = useState<NotificationSettingsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [draftTime, setDraftTime] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const { notificationSettingsService } = await appDependencies.getPersistence();
      setSnapshot(await notificationSettingsService.getSettings());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Notification settings could not be loaded.');
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
  }, [load]);

  const run = useCallback(async (task: () => Promise<NotificationSettingsSnapshot>) => {
    setBusy(true);
    setError('');
    try {
      setSnapshot(await task());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The notification setting could not be saved.');
      await load();
    } finally {
      setBusy(false);
    }
  }, [load]);

  const updateTime = useCallback(async (time: DailyReminderTime) => {
    const { notificationSettingsService } = await appDependencies.getPersistence();
    return notificationSettingsService.setReminderTime(time);
  }, []);

  const openTimePicker = useCallback(() => {
    if (!snapshot) return;
    const value = dateForTime(snapshot.preferences.reminderTime);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: true,
        onValueChange: (_event, selected) => void run(() => updateTime({ hour: selected.getHours(), minute: selected.getMinutes() })),
      });
      return;
    }
    setDraftTime(value);
    setShowIosPicker(true);
  }, [run, snapshot, updateTime]);

  const permission = snapshot?.permission ?? 'error';
  const preferences = snapshot?.preferences;
  const controlsDisabled = busy || !preferences?.enabled || permission !== 'granted';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>LOCAL & PRIVATE</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Choose whether this device gives you one calm reminder to review your health summary.</Text>

        {!snapshot && !error ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /><Text style={styles.secondary}>Loading settings…</Text></View> : null}
        {error ? <View accessibilityLiveRegion="polite" style={styles.errorCard}><Text style={styles.errorTitle}>Setting not saved</Text><Text style={styles.errorText}>{error}</Text></View> : null}

        {snapshot ? (
          <>
            <View style={styles.card}>
              <SettingRow
                label="Notifications"
                description="Allow reminders from Health Analytics on this device."
                theme={theme}
                control={<Switch accessibilityLabel="Notifications enabled" disabled={busy} onValueChange={(enabled) => void run(async () => {
                  const { notificationSettingsService } = await appDependencies.getPersistence();
                  return notificationSettingsService.setEnabled(enabled);
                })} trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentStrong }} thumbColor={theme.colors.surface} value={preferences?.enabled ?? false} />}
              />
              <View style={styles.divider} />
              <SettingRow
                label="Daily reminder"
                description="Review today’s health summary. No health data is included in the notification."
                theme={theme}
                muted={controlsDisabled}
                control={<Switch accessibilityLabel="Daily reminder enabled" disabled={controlsDisabled} onValueChange={(enabled) => void run(async () => {
                  const { notificationSettingsService } = await appDependencies.getPersistence();
                  return notificationSettingsService.setDailyReminderEnabled(enabled);
                })} trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentStrong }} thumbColor={theme.colors.surface} value={preferences?.dailyReminderEnabled ?? false} />}
              />
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Daily reminder time, ${preferences ? formatReminderTime(preferences.reminderTime) : ''}`}
                disabled={controlsDisabled || !preferences?.dailyReminderEnabled}
                onPress={openTimePicker}
                style={({ pressed }) => [styles.timeRow, (controlsDisabled || !preferences?.dailyReminderEnabled) && styles.muted, pressed && styles.pressed]}
              >
                <View style={styles.rowCopy}><Text style={styles.rowLabel}>Reminder time</Text><Text style={styles.rowDescription}>Uses this device’s local time, including time-zone changes.</Text></View>
                <Text style={styles.time}>{preferences ? formatReminderTime(preferences.reminderTime) : '—'}</Text>
              </Pressable>
            </View>

            <View style={styles.permissionCard}>
              <View style={styles.permissionTop}><Text style={styles.cardTitle}>System permission</Text><PermissionPill permission={permission} theme={theme} /></View>
              <Text style={styles.permissionCopy}>{permissionCopy(permission)}</Text>
              {permission === 'denied' ? (
                <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
                  <Text style={styles.settingsButtonText}>Open {Platform.OS === 'android' ? 'Android' : 'system'} settings</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.footer}>Reminders are scheduled entirely on this device. They do not sync Huawei data in the background and are not medical alerts.</Text>
          </>
        ) : null}
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setShowIosPicker(false)} transparent visible={showIosPicker}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Daily reminder time</Text>
            {draftTime ? <DateTimePicker accentColor={theme.colors.accent} mode="time" onValueChange={(_event, date) => setDraftTime(date)} themeVariant={theme.dark ? 'dark' : 'light'} value={draftTime} /> : null}
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setShowIosPicker(false)} style={styles.modalButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => {
                if (draftTime) void run(() => updateTime({ hour: draftTime.getHours(), minute: draftTime.getMinutes() }));
                setShowIosPicker(false);
              }} style={[styles.modalButton, styles.primaryButton]}><Text style={styles.primaryButtonText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingRow({ label, description, control, theme, muted = false }: { label: string; description: string; control: React.ReactNode; theme: AppTheme; muted?: boolean }) {
  const styles = createStyles(theme);
  return <View style={[styles.settingRow, muted && styles.muted]}><View style={styles.rowCopy}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowDescription}>{description}</Text></View>{control}</View>;
}

function PermissionPill({ permission, theme }: { permission: NotificationPermissionState; theme: AppTheme }) {
  const styles = createStyles(theme);
  return <View style={[styles.pill, permission === 'granted' && styles.pillGranted, permission === 'denied' && styles.pillDenied]}><Text style={[styles.pillText, permission === 'granted' && styles.pillTextGranted, permission === 'denied' && styles.pillTextDenied]}>{permission.replace('-', ' ')}</Text></View>;
}

function permissionCopy(permission: NotificationPermissionState): string {
  if (permission === 'granted') return 'This device can show the daily reminder at the selected local time.';
  if (permission === 'not-determined') return 'Nothing has been requested yet. Turning on Notifications will ask for permission.';
  if (permission === 'denied') return `Permission is off. The app still works normally; ${Platform.OS === 'android' ? 'Android' : 'system'} settings can enable reminders later.`;
  if (permission === 'unavailable') return 'Notifications are not available in this environment. The rest of the app still works normally.';
  return 'The system permission could not be read. Try returning to this screen.';
}

function dateForTime(time: DailyReminderTime): Date {
  const value = new Date();
  value.setHours(time.hour, time.minute, 0, 0);
  return value;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: { backgroundColor: theme.colors.background, flex: 1 },
    content: { paddingBottom: theme.spacing.xxxl, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl },
    eyebrow: { color: theme.colors.accent, fontSize: theme.typography.eyebrow, fontWeight: '800', letterSpacing: 1.7 },
    title: { color: theme.colors.text, fontSize: theme.typography.hero, fontWeight: '700', letterSpacing: -1.1, marginTop: theme.spacing.xs },
    subtitle: { color: theme.colors.textSecondary, fontSize: theme.typography.body, lineHeight: 22, marginTop: theme.spacing.sm, maxWidth: 390 },
    loading: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xxl },
    secondary: { color: theme.colors.textSecondary, fontSize: theme.typography.body },
    card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, marginTop: theme.spacing.xxl, overflow: 'hidden' },
    settingRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.lg, minHeight: 90, padding: theme.spacing.lg },
    timeRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.lg, minHeight: 90, padding: theme.spacing.lg },
    rowCopy: { flex: 1, minWidth: 0 },
    rowLabel: { color: theme.colors.text, fontSize: theme.typography.cardTitle, fontWeight: '700' },
    rowDescription: { color: theme.colors.textSecondary, fontSize: theme.typography.caption, lineHeight: 19, marginTop: theme.spacing.xs },
    time: { color: theme.colors.accent, fontSize: 20, fontVariant: ['tabular-nums'], fontWeight: '800' },
    divider: { backgroundColor: theme.colors.border, height: StyleSheet.hairlineWidth, marginHorizontal: theme.spacing.lg },
    muted: { opacity: 0.48 },
    pressed: { opacity: 0.7 },
    permissionCard: { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, marginTop: theme.spacing.lg, padding: theme.spacing.xl },
    permissionTop: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, justifyContent: 'space-between' },
    cardTitle: { color: theme.colors.text, fontSize: theme.typography.cardTitle, fontWeight: '700' },
    permissionCopy: { color: theme.colors.textSecondary, fontSize: theme.typography.caption, lineHeight: 20, marginTop: theme.spacing.md },
    pill: { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing.md, paddingVertical: 6 },
    pillGranted: { backgroundColor: theme.colors.accentSoft },
    pillDenied: { backgroundColor: theme.dark ? '#3B2525' : '#F8E2E2' },
    pillText: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    pillTextGranted: { color: theme.colors.accent },
    pillTextDenied: { color: theme.colors.danger },
    settingsButton: { alignItems: 'center', alignSelf: 'flex-start', borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1, justifyContent: 'center', marginTop: theme.spacing.lg, minHeight: 48, paddingHorizontal: theme.spacing.lg },
    settingsButtonText: { color: theme.colors.text, fontSize: theme.typography.body, fontWeight: '700' },
    footer: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 18, marginHorizontal: theme.spacing.md, marginTop: theme.spacing.xxl, textAlign: 'center' },
    errorCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.danger, borderRadius: theme.radii.md, borderWidth: 1, marginTop: theme.spacing.xl, padding: theme.spacing.lg },
    errorTitle: { color: theme.colors.danger, fontSize: theme.typography.cardTitle, fontWeight: '700' },
    errorText: { color: theme.colors.textSecondary, fontSize: theme.typography.caption, lineHeight: 19, marginTop: theme.spacing.xs },
    modalBackdrop: { alignItems: 'center', backgroundColor: theme.colors.overlay, flex: 1, justifyContent: 'center', padding: theme.spacing.xl },
    modalCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, maxWidth: 420, padding: theme.spacing.xl, width: '100%' },
    modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
    modalActions: { flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'flex-end', marginTop: theme.spacing.lg },
    modalButton: { alignItems: 'center', borderRadius: theme.radii.pill, justifyContent: 'center', minHeight: 48, paddingHorizontal: theme.spacing.xl },
    primaryButton: { backgroundColor: theme.colors.accent },
    primaryButtonText: { color: theme.dark ? '#092116' : '#FFFFFF', fontSize: theme.typography.body, fontWeight: '700' },
    secondaryButtonText: { color: theme.colors.textSecondary, fontSize: theme.typography.body, fontWeight: '700' },
  });
}
