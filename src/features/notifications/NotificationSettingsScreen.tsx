import { getLocale, tr } from '../../localization/i18n';
import { Text, View, Pressable } from '../../localization/LocalizedNative';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, ScrollView, StyleSheet, Switch, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appDependencies } from '../../appDependencies';
import { AppIcon, type AppIconName } from '../../components/AppIcon';
import { CompactState, ProductSheet, SectionLabel } from '../../components/ProductUI';
import type { StoredHealthStats } from '../../database/types';
import type { DailyReminderTime, NotificationPermissionState, NotificationSettingsSnapshot } from '../../models/notifications';
import type { ThemeMode } from '../../repositories/AppearancePreferencesRepository';
import { formatReminderTime } from '../../services/notificationPolicy';
import { getResponsiveLayout } from '../../theme/responsive';
import { createTheme, type AppTheme } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLocale } from '../../localization/LanguageContext';

const PRIVACY_POLICY_URL = 'https://omaralloush20.github.io/huawei-health-analytics/privacy.html';
const USER_AGREEMENT_URL = 'https://omaralloush20.github.io/huawei-health-analytics/terms.html';
function getThemeOptions(): readonly { id: ThemeMode; label: string; detail: string }[] { return [
  { id: 'system', label: tr('settings.system'), detail: tr('settings.systemHelp') },
  { id: 'dark', label: tr('settings.dark'), detail: tr('settings.darkHelp') },
  { id: 'light', label: tr('settings.light'), detail: tr('settings.lightHelp') },
]; }

export function NotificationSettingsScreen() {
  const { language, setLanguage } = useLocale();
  const { theme, mode, setMode } = useAppTheme();
  const { width, fontScale } = useWindowDimensions();
  const { compact, enlargedText } = getResponsiveLayout(width, fontScale);
  const styles = useMemo(() => createStyles(theme, compact), [compact, theme]);
  const [snapshot, setSnapshot] = useState<NotificationSettingsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [languageBusy, setLanguageBusy] = useState(false);
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [draftTime, setDraftTime] = useState<Date | null>(null);
  const [stats, setStats] = useState<StoredHealthStats | null>(null);
  const [developerToolsAvailable, setDeveloperToolsAvailable] = useState(false);
  const settingsRequest = useRef(0);
  const mutationActive = useRef(false);

  const load = useCallback(async (duringMutation = false) => {
    if (mutationActive.current && !duringMutation) return;
    const request = ++settingsRequest.current;
    try {
      const { notificationSettingsService, dashboardService } = await appDependencies.getPersistence();
      const [nextSnapshot, nextStats] = await Promise.all([notificationSettingsService.getSettings(), dashboardService.getStats()]);
      if (request !== settingsRequest.current) return;
      setSnapshot(nextSnapshot);
      setStats(nextStats);
      setDeveloperToolsAvailable(dashboardService.getDevelopmentScenarios() !== null);
      setError('');
    } catch {
      if (request === settingsRequest.current) setError(tr('error.settings'));
    }
  }, []);

  useFocusEffect(useCallback(() => { void Promise.resolve().then(() => load()); }, [load]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void load(); });
    return () => subscription.remove();
  }, [load]);

  const run = useCallback(async (task: () => Promise<NotificationSettingsSnapshot>) => {
    if (mutationActive.current) return;
    mutationActive.current = true;
    const request = ++settingsRequest.current;
    setBusy(true);
    setError('');
    try {
      const nextSnapshot = await task();
      if (request === settingsRequest.current) setSnapshot(nextSnapshot);
    }
    catch {
      if (request === settingsRequest.current) {
        const reloadRequest = settingsRequest.current + 1;
        await load(true);
        if (reloadRequest === settingsRequest.current) setError(tr('error.notification'));
      }
    } finally { mutationActive.current = false; setBusy(false); }
  }, [load]);

  const updateTime = useCallback(async (time: DailyReminderTime) => {
    const { notificationSettingsService } = await appDependencies.getPersistence();
    return notificationSettingsService.setReminderTime(time);
  }, []);

  const openExternalLink = useCallback(async (url: string) => {
    try { await Linking.openURL(url); }
    catch { setError(tr('error.page')); }
  }, []);

  const openTimePicker = useCallback(() => {
    if (!snapshot) return;
    const value = dateForTime(snapshot.preferences.reminderTime);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value, mode: 'time', is24Hour: true, onValueChange: (_event, selected) => void run(() => updateTime({ hour: selected.getHours(), minute: selected.getMinutes() })) });
      return;
    }
    setDraftTime(value);
    setShowIosPicker(true);
  }, [run, snapshot, updateTime]);

  const permission = snapshot?.permission ?? 'error';
  const preferences = snapshot?.preferences;
  const controlsDisabled = busy || !preferences?.enabled || permission !== 'granted';

  const confirmDelete = useCallback(() => {
    Alert.alert(tr('settings.deleteTitle'), tr('settings.deleteHelp'), [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('common.delete'), style: 'destructive', onPress: () => {
        void appDependencies.getPersistence().then(async ({ repository, dashboardService }) => {
          await repository.deleteAllLocalHealthData();
          setStats(await dashboardService.getStats());
        }).catch(() => setError(tr('error.delete')));
      } },
    ]);
  }, []);

  const rowProps = { theme, styles, compact, enlargedText };
  // The normal-flow tab bar reserves the bottom system navigation area.
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.pageHeading}><View style={styles.pageCopy}><Text style={styles.eyebrow}>{tr('settings.eyebrow')}</Text><Text accessibilityRole="header" style={styles.title}>{tr('nav.settings')}</Text></View><View style={styles.headerSymbol}><AppIcon name="settings" color={theme.colors.accent} size={23} /></View></View>

      <View style={styles.group}>
        <SectionLabel compact title={tr('settings.appearance')} theme={theme} />
        <SettingsRow {...rowProps} icon="palette" label={tr('settings.theme')} subtitle={getThemeOptions().find((option) => option.id === mode)?.detail} value={getThemeOptions().find((option) => option.id === mode)?.label} onPress={() => setShowThemePicker(true)} />
        <SettingsRow {...rowProps} icon="language" label={tr('settings.language')} value={language === 'ar' ? tr('settings.arabic') : tr('settings.english')} onPress={() => setShowLanguagePicker(true)} />
      </View>

      {!snapshot && !error ? <CompactState loading title={tr('settings.loading')} message={tr('settings.readingPrefs')} theme={theme} /> : null}
      {error ? <CompactState icon="alert" title={snapshot ? tr('settings.failed') : tr('settings.unavailable')} message={error} action={tr('common.retry')} onAction={() => void load()} theme={theme} /> : null}

      {snapshot ? <>
        <View style={styles.group}>
          <SectionLabel compact title={tr('settings.notificationsHeading')} theme={theme} />
          <SettingsRow {...rowProps} icon="bell" label={tr('settings.notifications')} control={<Switch accessibilityLabel={tr('settings.masterA11y')} disabled={busy} style={styles.switchControl} onValueChange={(enabled) => void run(async () => {
            const { notificationSettingsService } = await appDependencies.getPersistence();
            return notificationSettingsService.setEnabled(enabled);
          })} trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentStrong }} thumbColor={theme.colors.surface} value={preferences?.enabled ?? false} />} />
          <SettingsRow {...rowProps} icon="insights" label={tr('settings.daily')} muted={controlsDisabled} control={<Switch accessibilityLabel={tr('settings.dailyA11y')} disabled={controlsDisabled} style={styles.switchControl} onValueChange={(enabled) => void run(async () => {
            const { notificationSettingsService } = await appDependencies.getPersistence();
            return notificationSettingsService.setDailyReminderEnabled(enabled);
          })} trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accentStrong }} thumbColor={theme.colors.surface} value={preferences?.dailyReminderEnabled ?? false} />} />
          <SettingsRow {...rowProps} icon="clock" label={tr('settings.time')} subtitle={tr('settings.localTime')} emphasizeValue value={preferences ? formatReminderTime(preferences.reminderTime) : '—'} muted={controlsDisabled || !preferences?.dailyReminderEnabled} onPress={openTimePicker} />
          {permission === 'granted' ? <Text style={styles.groupNote}>{tr('settings.permissionAllowed')}</Text> : <View style={styles.permission}>
            <View style={styles.permissionHeading}><AppIcon name="bell" color={theme.colors.accent} size={18} /><Text style={styles.permissionTitle}>{permission === 'denied' ? tr('settings.permissionOff') : permission === 'not-determined' ? tr('settings.ready') : tr('settings.remindersUnavailable')}</Text></View>
            <Text style={styles.permissionCopy}>{permissionCopy(permission)}</Text>
            {permission === 'denied' ? <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings().catch(() => setError(tr('error.systemSettings')))} style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}><Text style={styles.actionText}>{tr('settings.systemSettings')}</Text></Pressable> : null}
          </View>}
        </View>

        <View style={styles.group}>
          <SectionLabel compact title={tr('settings.sourceHeading')} theme={theme} />
          <View testID="settings-source-status" style={styles.sourceSurface}>
            <View style={styles.sourceHeading}><View style={styles.sourceIcon}><AppIcon name="activity" color={theme.colors.accent} size={24} /></View><View style={styles.sourceCopy}><Text style={styles.sourceName}>{appDependencies.healthProvider.id === 'huawei' ? 'Huawei Health' : tr('state.mock')}</Text><Text style={styles.sourceHelp}>{appDependencies.healthProvider.id === 'huawei' ? tr('settings.huaweiSourceHelp') : tr('settings.mockSourceHelp')}</Text></View></View>
          </View>
          <SettingsRow {...rowProps} icon="legal" label={tr('settings.authorization')} value={providerAuthorizationLabel()} />
          <SettingsRow {...rowProps} icon="clock" label={tr('settings.sync')} subtitle={syncStatusLabel(stats)} value={formatLastSync(stats)} />
        </View>

        <View style={styles.group}>
          <SectionLabel compact title={tr('settings.deviceHeading')} theme={theme} />
          <SettingsRow {...rowProps} icon="database" label={tr('common.recordedDays')} value={String(stats?.storedDays ?? 0)} />
          <SettingsRow {...rowProps} icon="alert" label={tr('settings.delete')} danger onPress={confirmDelete} />
          <Text style={styles.groupNote}>{tr('settings.local')}</Text>
        </View>

        {developerToolsAvailable ? <View style={styles.developmentGroup}><SectionLabel compact title={tr('settings.development')} theme={theme} /><SettingsRow {...rowProps} icon="code" label={tr('dev.tools')} subtitle={tr('dev.buildLabel')} onPress={() => router.push('/developer-tools')} /></View> : null}

        <View style={styles.group}>
          <SectionLabel compact title={tr('settings.about')} theme={theme} />
          <SettingsRow {...rowProps} icon="legal" label={tr('settings.privacy')} external onPress={() => void openExternalLink(PRIVACY_POLICY_URL)} />
          <SettingsRow {...rowProps} icon="legal" label={tr('settings.terms')} external onPress={() => void openExternalLink(USER_AGREEMENT_URL)} />
          <SettingsRow {...rowProps} icon="insights" label={tr('settings.version')} value={Constants.expoConfig?.version ?? '1.0.0'} />
          <Text style={styles.aboutName}>{tr('brand.full')}</Text>
          <Text style={styles.groupNote}>{tr('settings.aboutHelp')}</Text>
        </View>
      </> : null}
    </ScrollView>

    <ProductSheet visible={showThemePicker} title={tr('settings.appearanceTitle')} onClose={() => setShowThemePicker(false)} theme={theme}>
      <View accessibilityRole="radiogroup">{getThemeOptions().map((option) => <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: mode === option.id }} onPress={() => void setMode(option.id).then(() => setShowThemePicker(false)).catch(() => setError(tr('error.theme')))} style={({ pressed }) => [styles.themeOption, mode === option.id && styles.selectedOption, pressed && styles.pressed]}>
        <ThemePreview mode={option.id} theme={theme} /><View style={styles.themeCopy}><Text style={styles.rowLabel}>{option.label}</Text><Text style={styles.optionDetail}>{option.detail}</Text></View><View style={[styles.radioMark, mode === option.id && styles.radioSelected]}>{mode === option.id ? <AppIcon name="check" color={theme.colors.onAccent} size={14} /> : null}</View>
      </Pressable>)}</View>
    </ProductSheet>
    <ProductSheet visible={showLanguagePicker} title={tr('settings.language')} onClose={() => setShowLanguagePicker(false)} theme={theme}>
      <View accessibilityRole="radiogroup">{(['en', 'ar'] as const).map((option) => <Pressable key={option} accessibilityLabel={option === 'en' ? tr('settings.english') : tr('settings.arabic')} accessibilityRole="radio" accessibilityState={{ checked: language === option, disabled: languageBusy }} disabled={languageBusy} onPress={() => {
        if (languageBusy) return;
        setLanguageBusy(true);
        void setLanguage(option).then(() => setShowLanguagePicker(false)).catch(() => setError(tr('error.language'))).finally(() => setLanguageBusy(false));
      }} style={({ pressed }) => [styles.themeOption, language === option && styles.selectedOption, pressed && styles.pressed]}><View style={styles.languageMark}><Text style={styles.languageMarkText}>{option === 'en' ? 'Aa' : 'ع'}</Text></View><Text style={[styles.rowLabel, styles.languageLabel]}>{option === 'en' ? tr('settings.english') : tr('settings.arabic')}</Text><View style={[styles.radioMark, language === option && styles.radioSelected]}>{language === option ? <AppIcon name="check" color={theme.colors.onAccent} size={14} /> : null}</View></Pressable>)}</View>
    </ProductSheet>
    <ProductSheet visible={showIosPicker} title={tr('settings.time')} subtitle={tr('settings.localTime')} onClose={() => setShowIosPicker(false)} theme={theme}>
      {draftTime ? <DateTimePicker accentColor={theme.colors.accent} mode="time" onValueChange={(_event, date) => setDraftTime(date)} themeVariant={theme.dark ? 'dark' : 'light'} value={draftTime} /> : null}
      <View style={styles.pickerActions}><Pressable accessibilityRole="button" onPress={() => setShowIosPicker(false)} style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}><Text style={styles.actionText}>{tr('common.cancel')}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => {
        if (draftTime) void run(() => updateTime({ hour: draftTime.getHours(), minute: draftTime.getMinutes() }));
        setShowIosPicker(false);
      }} style={({ pressed }) => [styles.pickerButton, styles.saveButton, pressed && styles.pressed]}><Text style={styles.saveText}>{tr('common.save')}</Text></Pressable></View>
    </ProductSheet>
  </SafeAreaView>;
}

function SettingsRow({ label, subtitle, value, control, icon, theme, styles, compact, enlargedText, emphasizeValue = false, muted = false, danger = false, external = false, onPress }: {
  label: string; subtitle?: string; value?: string; control?: ReactNode; icon?: AppIconName; theme: AppTheme; styles: ReturnType<typeof createStyles>; compact: boolean; enlargedText: boolean; emphasizeValue?: boolean; muted?: boolean; danger?: boolean; external?: boolean; onPress?: () => void;
}) {
  // Long provider/status values get their own line on narrow screens; switches
  // stay beside their labels and keep a full, non-shrinking touch area.
  const stackValue = !control && !!value && (enlargedText || (compact && !onPress));
  const content = <>
    <View style={styles.rowIdentity}>{icon ? <View style={styles.rowIcon}><AppIcon name={icon} color={danger ? theme.colors.danger : theme.colors.textSecondary} size={18} /></View> : null}<View style={styles.rowCopy}><Text style={[styles.rowLabel, danger && { color: theme.colors.danger }]}>{label}</Text>{subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}</View></View>
    <View style={[styles.rowValueGroup, control ? styles.controlGroup : null, stackValue && styles.rowValueStack]}>{value ? <Text style={[styles.rowValue, emphasizeValue && styles.timeValue]}>{value}</Text> : null}{control}{onPress ? <AppIcon name={external ? 'external' : 'arrow-right'} color={theme.colors.textMuted} size={15} /> : null}</View>
  </>;
  const rowStyle = [styles.row, stackValue && styles.stackedRow, muted && styles.muted];
  return onPress ? <Pressable accessibilityLabel={`${label}${value ? `, ${value}` : ''}`} accessibilityRole={external ? 'link' : 'button'} accessibilityHint={external ? tr('common.browser') : undefined} accessibilityState={{ disabled: muted }} disabled={muted} onPress={onPress} style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}>{content}</Pressable> : <View style={rowStyle}>{content}</View>;
}

function ThemePreview({ mode, theme }: { mode: ThemeMode; theme: AppTheme }) {
  const styles = createStyles(theme);
  const colors = createTheme(mode === 'dark' || (mode === 'system' && theme.dark)).colors;
  return <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.themePreview, { backgroundColor: colors.background }]}><View style={[styles.previewAccent, { backgroundColor: colors.accent }]} /><View style={[styles.previewLine, { backgroundColor: colors.textMuted }]} /><View style={[styles.previewSurface, { backgroundColor: colors.surfaceRaised }]} /></View>;
}

function formatLastSync(stats: StoredHealthStats | null): string {
  const timestamp = stats?.sync?.lastSuccessfulAt;
  if (!timestamp || !Number.isFinite(new Date(timestamp).getTime())) return tr('settings.notSynced');
  return new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function syncStatusLabel(stats: StoredHealthStats | null): string | undefined {
  const status = stats?.sync?.status;
  return status === 'succeeded' ? tr('sync.succeeded') : status === 'failed' ? tr('state.refreshFailed') : status === 'running' ? tr('state.refreshing') : undefined;
}

function permissionCopy(permission: NotificationPermissionState): string {
  if (permission === 'not-determined') return tr('permission.notDetermined');
  if (permission === 'denied') return tr('permission.denied');
  if (permission === 'unavailable') return tr('permission.unavailable');
  return tr('permission.error');
}

function dateForTime(time: DailyReminderTime): Date {
  const value = new Date();
  value.setHours(time.hour, time.minute, 0, 0);
  return value;
}

function providerAuthorizationLabel(): string {
  if (appDependencies.healthProvider.id !== 'huawei') return tr('authorization.notRequired');
  const provider = appDependencies.healthProvider as typeof appDependencies.healthProvider & { getIntegrationState?: () => { userAuthorization: 'not-performed' | 'authorized' | 'denied' } };
  const authorization = provider.getIntegrationState?.().userAuthorization;
  if (authorization === 'authorized') return tr('authorization.authorized');
  if (authorization === 'denied') return tr('authorization.denied');
  return tr('authorization.notRequested');
}

function createStyles(theme: AppTheme, compact = false) {
  return StyleSheet.create({
    safeArea: { backgroundColor: theme.colors.background, flex: 1 },
    content: { alignSelf: 'center', maxWidth: theme.layout.contentMaxWidth, paddingBottom: 32, paddingHorizontal: compact ? 16 : 24, paddingTop: 20, width: '100%' },
    pageHeading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
    pageCopy: { flex: 1, minWidth: 0 },
    headerSymbol: { alignItems: 'center', backgroundColor: theme.colors.surfaceRaised, borderRadius: 16, flexShrink: 0, height: 44, justifyContent: 'center', width: 44 },
    eyebrow: { color: theme.colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
    title: { color: theme.colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1, marginTop: 5 },
    group: { marginTop: 26 },
    developmentGroup: { borderColor: theme.colors.border, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, marginTop: 26, paddingHorizontal: 12, paddingTop: 12 },
    row: { alignItems: 'center', borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 60, paddingVertical: 10 },
    rowIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 0 },
    rowIcon: { alignItems: 'center', backgroundColor: theme.colors.surfaceMuted, borderRadius: 10, flexShrink: 0, height: 30, justifyContent: 'center', width: 30 },
    rowCopy: { flex: 1, minWidth: 0 },
    rowLabel: { color: theme.colors.text, flexShrink: 1, fontSize: 15, fontWeight: '500' },
    rowSubtitle: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
    rowValueGroup: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 10, maxWidth: '49%' },
    controlGroup: { flexShrink: 0, justifyContent: 'flex-end', minHeight: 48, minWidth: 52 },
    switchControl: { minHeight: 48, minWidth: 52 },
    rowValue: { color: theme.colors.textSecondary, flexShrink: 1, fontSize: 13, fontVariant: ['tabular-nums'], textTransform: 'capitalize' },
    timeValue: { color: theme.colors.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.5 },
    stackedRow: { alignItems: 'stretch', flexDirection: 'column', gap: 6 },
    rowValueStack: { alignSelf: 'stretch', justifyContent: 'space-between', marginStart: 40, maxWidth: '100%' },
    groupNote: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 10 },
    sourceSurface: { backgroundColor: theme.colors.surface, borderRadius: 18, marginBottom: 4, padding: 14 },
    sourceHeading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
    sourceIcon: { alignItems: 'center', backgroundColor: theme.colors.surfaceRaised, borderRadius: 13, flexShrink: 0, height: 42, justifyContent: 'center', width: 42 },
    sourceCopy: { flex: 1, minWidth: 0 },
    sourceName: { color: theme.colors.text, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
    sourceHelp: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 18, marginTop: 5 },
    aboutName: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 18 },
    permission: { borderStartColor: theme.colors.accentMuted, borderStartWidth: 2, marginTop: 12, paddingStart: 12 },
    permissionHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    permissionTitle: { color: theme.colors.text, flex: 1, fontSize: 14, fontWeight: '600' },
    permissionCopy: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8 },
    permissionButton: { justifyContent: 'center', minHeight: 48 },
    actionText: { color: theme.colors.accent, fontSize: 14, fontWeight: '600' },
    muted: { opacity: 0.72 },
    pressed: { opacity: 0.6 },
    themeOption: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, marginBottom: 6, minHeight: 72, paddingHorizontal: 10, paddingVertical: 12 },
    selectedOption: { backgroundColor: theme.colors.surface },
    themeCopy: { flex: 1, minWidth: 0 },
    optionDetail: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
    themePreview: { borderColor: theme.colors.border, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, flexShrink: 0, height: 48, padding: 7, width: 38 },
    previewAccent: { borderRadius: 2, height: 3, width: 12 },
    previewLine: { borderRadius: 2, height: 2, marginTop: 5, width: 20 },
    previewSurface: { borderRadius: 4, height: 15, marginTop: 5, width: '100%' },
    radioMark: { alignItems: 'center', borderColor: theme.colors.border, borderRadius: 10, borderWidth: 1.5, flexShrink: 0, height: 20, justifyContent: 'center', width: 20 },
    radioSelected: { backgroundColor: theme.colors.accentStrong, borderColor: theme.colors.accentStrong },
    languageMark: { alignItems: 'center', backgroundColor: theme.colors.surfaceMuted, borderRadius: 12, flexShrink: 0, height: 40, justifyContent: 'center', width: 40 },
    languageMarkText: { color: theme.colors.accent, fontSize: 17, fontWeight: '600' },
    languageLabel: { flex: 1 },
    pickerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-end', marginTop: 16 },
    pickerButton: { alignItems: 'center', borderRadius: 16, justifyContent: 'center', minHeight: 48, paddingHorizontal: 24 },
    saveButton: { backgroundColor: theme.colors.accentStrong },
    saveText: { color: theme.colors.onAccent, fontSize: 14, fontWeight: '700' },
  });
}
