# Milestone 9 — Full product UI rebuild

Updated: October 3, 2026

Status: accepted product structure and palette direction preserved; comprehensive final premium presentation implemented. Final native visual approval and the HARD Android navigation-mode gate remain pending. Health engines remain unchanged; Milestone 10 has not started.

## Final premium presentation pass — 2026-10-03

This comprehensive pass supersedes the earlier presentation/density, palette values, layout rules and test totals below. It preserves the accepted product structure and navy/indigo/violet identity while replacing the presentation patterns authorized by this request. Implementation and source/renderer self-audit are complete; final native visual approval is **not claimed**. No M10.

### Whole-product changes

- Today now has one compact identity/freshness/week/customize row, symmetric date controls and a single daily Recovery canvas. Normal-text narrow screens use a smaller score gauge plus a real copy allowance; actual scaled gauge diameter and scaled copy width determine when to stack. Three compact signal contributors show readings and impact; explanations, configured/applied weights and personal ranges expand on demand. Shortcut readings share a quiet rail instead of repeating metric cards.
- Sleep keeps its own composition: dominant duration, timing, separate source score, separated proportional stages and a compact two-column legend that becomes full-width for enlarged text. The unreported remainder is explicit; this is not a fabricated overnight timeline.
- Signals share one compact HRV/RHR/SpO₂/Stress surface with aligned value/unit islands, real sparklines, personal context and quieter missing rows. Full accessible names include units. Stress stays a neutral source index outside Recovery V1.
- Movement has a larger real seven-day plot, a selected-day bar and non-color-only underline, a distinct weekday rail and steps/minutes/kcal/workout facts. Missing or invalid observations use neutral gap marks; real zero remains an actual reading. No goals are invented.
- All seven details put their own day context before History: Recovery has compact expandable contributors; Sleep has timing/stages/consistency; HRV and RHR have personal-range rails and distinct observation facts; SpO₂ and Stress show recorded min–max rails with an average marker; Activity has a larger movement plot. Enlarged values/range bounds reflow. An outside-touch reset retains exact-date cached context without remounting a pressed contributor.
- Trends has a paired measurement/Compare toolbar, segmented periods, a larger open chart, compact Latest/personal-range facts and a recorded-days rail instead of repeated summary cells. Tooltips are width-bounded before native measurement, then reserve their measured height. Empty series no longer show fictional axes or a giant blank plot. Tapping the already-selected Trends tab also clears inspection and scrubbing; all existing outside/transition/refocus resets, Details routing, gaps and independent scales remain.
- Insights has one two-tier recap (Recovery/Sleep above compact signals), a stronger leading editorial observation, quieter evidence/metadata and a weekly launch strip. Missing readings have neither invented zeros nor numeric units. Existing observation/snapshot/weekly links retain their metric/date.
- Settings uses grouped icon/title/subtitle/value rows, a compact truthful source/readiness strip, actual last-successful sync, separate local-data controls, theme previews and clear language checkmarks. Legal/destructive rows avoid orphan arrows when text grows. Notification operations and native confirmations are unchanged.
- Developer Tools is explicitly a development build, with six compact scenario radios. Only the selected scenario shows its explanation visually; every option keeps its full accessible description. IDs, fixtures and reset/reseed behavior are unchanged.
- Calendar day/month choices have pressed feedback and visible selected checks. Shared sheets have a refined raised heading/close treatment and a bounded scroll body. Loading/error/unavailable states use compact, meaningful icon/copy/action layouts, not empty oversized cards.
- The normal-flow tab bar has refined icon/label spacing, pressed feedback and a visible selection marker. Existing live bottom/side additive safe areas, screen edge ownership and modal-local inset measurement remain intact. No hardcoded OS height or bottom margin.
- Subtle feedback uses pressed states, visible selector checks, contributor expansion and a short 150ms native-driver fade. Reduced motion remains motion-free. No dependencies, raster assets, blur, perpetual animation, new persistence or random features were added.

### Current surface hierarchy

| Role | Dark | Light |
| --- | --- | --- |
| Base | `#070A16` | `#ECECF5` |
| Primary | `#10162A` | `#E6E7F2` |
| Raised / interactive | `#182039` | `#F4F2FA` |
| Muted / nested | `#1D2743` | `#DFE2EF` |

Existing text/accent/semantic colors are preserved. Purple is an accent, not every surface. Light uses cool lavender/lilac rather than white regions. All tested small-text roles retain at least 4.5:1 contrast.

### Final self-critique and boundaries

Final validation: TypeScript and ESLint pass (zero warnings); **31 focused suites / 533 tests pass** across responsive, interaction, localization, presentation, persistence-preference and protected engine/notification checks. Full suite not run. Exact commands and whitespace results are in the latest private TESTING entry.

Source and renderer/event audits covered Today, each of the seven details, Trends, Insights, Settings, Developer Tools, calendar and shared navigation/sheets/states in both themes/languages and compact/enlarged composition. They caught and fixed the intermediate-font gauge squeeze, omitted accessible units, missing-data unit suffixes, editable focus choices during save, a contributor press/remount issue, first-frame tooltip overflow, empty-series chart chrome, duplicate labels and selected-tab inspection dismissal.

These are **not** measured native screenshots, a claim of premium visual approval, or proof of Android system-inset behavior. adb inventory again found no connected device. Native glyph shaping, first-viewport balance, chart touch dispatch/real performance, tooltip measurement, TalkBack and gesture↔3-button switching require the single manual review below.

Protected source/configuration hashes match the beginning of this pass: health models/engines, baseline/history no-future-leakage, trend/insight semantics, health SQLite/retention/deletion, all repositories, notification scheduling/adapter, provider/fixtures, app dependencies, packages, config plugin and application configuration. Recovery remains HRV 40% / RHR 35% / Sleep 25%, minimum two usable signals; Huawei remains step-only, package `com.omar.huaweihealthanalytics`. No Prebuild, Doctor, emulator launch, Android build, screenshots or commit.

### Exact files changed in this final premium pass

This inventory is relative to the working tree at the start of this request, not the whole pre-existing dirty M9 tree.

- Shared visual system: `src/components/AppIcon.tsx`, `src/components/ProductTabBar.tsx`, `src/components/ProductUI.tsx`, `src/components/SignalVisuals.test.js`, `src/components/SignalVisuals.tsx`.
- Today and calendar: `src/features/dashboard/DateHistoryPicker.tsx`, `src/features/dashboard/DateNavigator.tsx`, `src/features/dashboard/HomeDashboard.interaction.test.js`, `src/features/dashboard/HomeDashboard.tsx`, `src/features/dashboard/todayPresentation.test.ts`, `src/features/dashboard/todayPresentation.ts`, `src/features/dashboard/TodayRecovery.test.js`, `src/features/dashboard/TodayRecovery.tsx`.
- Metric details: `src/features/metrics/MetricDayContext.test.js`, `src/features/metrics/MetricDayContext.tsx`, `src/features/metrics/metricDetailPresentation.ts`, `src/features/metrics/MetricDetailScreen.test.js`, `src/features/metrics/MetricDetailScreen.tsx`.
- Trends: `src/features/trends/MetricPicker.tsx`, `src/features/trends/RangeSelector.tsx`, `src/features/trends/TrendChart.interaction.test.tsx`, `src/features/trends/TrendChart.tsx`, `src/features/trends/trendsPresentationLayout.test.ts`, `src/features/trends/trendsPresentationLayout.ts`, `src/features/trends/TrendsScreen.interaction.test.js`, `src/features/trends/TrendsScreen.tsx`.
- Insights, Settings, Developer Tools: `src/features/development/DeveloperToolsScreen.tsx`, `src/features/insights/InsightsScreen.tsx`, `src/features/insights/productScreens.test.js`, `src/features/notifications/NotificationSettingsScreen.tsx`.
- Theme and local copy: `src/localization/resources.ts`, `src/theme/theme.ts`.
- Documentation: `docs/MILESTONE_9.md`, `docs/USER_GUIDE.md`, `docs/internal/PROJECT_STATE.md`, `ROADMAP.md`, `DECISIONS.md`, `TESTING.md`, `KNOWN_ISSUES.md`, `NEXT_SESSION.md`.

### One complete final manual review

Run **every screen/state below** across the complete combination of:

| Appearance / language | Widths | Text sizes | Android navigation |
| --- | --- | --- | --- |
| Dark / English | 360, 390, 412 dp + wider phone | normal + enlarged (~2×); intermediate enlargement on 360 | gesture + classic 3-button |
| Dark / العربية | 360, 390, 412 dp + wider phone | normal + enlarged (~2×); intermediate enlargement on 360 | gesture + classic 3-button |
| Light / English | 360, 390, 412 dp + wider phone | normal + enlarged (~2×); intermediate enlargement on 360 | gesture + classic 3-button |
| Light / العربية | 360, 390, 412 dp + wider phone | normal + enlarged (~2×); intermediate enlargement on 360 | gesture + classic 3-button |

For each run, record theme/language, width, font setting and navigation mode; mark the matching screen items in the detailed checklist at the end of this document. Do not treat one theme, one Arabic screen or the default navigation mode as representative of the matrix.

- Today: compact header/date, first-viewport score/state/why/sleep/personal signal understanding, contributor collapsed/expanded and partial weights; all six scenarios; shortcut choices/save failures/busy state; week/freshness sheets and historical drilldowns.
- Every detail: Recovery, Sleep, HRV, RHR, SpO₂, Stress, Activity; current/historical/missing/learning/partial data, all three periods, each distinct day-context panel, all values/units/dates/legends, outside reset and contributor press completion.
- Trends: all metrics/periods/Compare choices; exact real observation/date/value, gaps, first/last/one point, drag/release/outside/tab/refocus reset, inspected-date Details, bounded measured tooltip including first display, independent scales, empty history and remembered workspace after relaunch.
- Insights: recap and lead/secondary observations, all periods, weekly summary, every deep link, no-observation/partial/loading/cached-error states.
- Settings: appearance/language sheets, immediate/persisted choices and save error; all notification permission/time states without an unsolicited prompt; local deletion confirmation, source/readiness/successful-sync, legal/version and large-text switches/actions.
- Developer Tools: all six options, selected explanation/check, busy/error, scenario return/refocus and surviving product preferences; development-only distinction.
- Calendar: months/year boundary, bound arrows, recorded/current/selected days, empty Today, direct month choices, jump/close/backdrop/Android back and full day targets.
- Every app sheet/modal: calendar/month, Customize Today, Today week/freshness, measurement/Compare, Insights week, theme/language/time; plus system permission/time/deletion dialogs. Close/save/cancel/refresh, last list item and scroll-to-end must be reachable.
- Hard inset gate: inspect tabs, details, Developer Tools, Settings and every sheet/action in both Android modes. Switch gesture→3-button→gesture **live**, also with sheets open. Check side/landscape insets where supported. Any overlap/hidden/difficult-to-press bottom action fails acceptance.
- Accessibility/copy/performance: TalkBack full names/units/selected/expanded/busy states and chart increment/decrement; actual 48dp targets where applicable, no clipped/ellipsized health values/dates, no one-word-per-line prose/off-screen controls, intentional Arabic RTL with chronological LTR charts and Western digits, reduced motion, smooth scroll/scrub.

The UI must not be marked native-complete until this matrix and the hard Android navigation-mode gate pass. Stop for the user's review; no further milestone or automatic UI iteration is authorized.

## Earlier focused finish — 2026-10-03 (historical)

This follow-up preserves the accepted product and both palettes. It addresses the reported date/RTL and stale chart inspection failures and adds small productivity improvements. Final checks pass: TypeScript, ESLint (no warnings), whitespace and **27 focused Jest suites / 303 tests**. The full test suite was not run. See the latest private TESTING entry for the exact command.

- Date/month navigation now shares symmetric controls: 48dp non-shrinking targets, safe screen-side padding plus an inner 8dp visual gap, a stable centered date/month, and explicit earlier/later glyphs/placement. Earlier is on the left in EN and on the right in AR. Today’s week action no longer shifts the center.
- `useChartInspection` owns transient selection/scrubbing and one reset function. Outside workspace touches dismiss without taking the responder, preventing scroll/press interference. Metric/range/Compare/picker transitions and screen focus/blur reset inspection. Explicit controlled `null` clears the chart’s internal fallback; old values cannot leave a tooltip behind. The workspace includes plot, legend, reading header and contextual Details so Details retains the inspected day.
- The crosshair is quieter, the selected ring has a subtle halo, comparison values/labels remain distinct, and tooltip height/edge placement remain measured. Touches inspect only stored drawable observations; missing days remain gaps and same-day secondary absence remains absent. Geometry/calculations are unchanged.
- EN and AR now use Western digits, comma grouping and decimal dots. Arabic labels/date wording remain localized. HR/HRV/RHR/SpO₂ and bpm/ms/kcal remain familiar technical terms; dates, chart endpoints and numeric-coordinate islands stay chronological LTR. This supersedes earlier Arabic-digit formatting.
- Today focus readings have explicit shortcut chevrons and accessible hints, using the selected historical day. Known-metric insight/snapshot/weekly shortcuts open the correct detail/date; weekly sheets close on navigation.
- Trends restores a validated measurement/range from `trends_workspace` in the existing keyed v4 product preference table. Hydration does not overwrite defaults, rapid writes are serialized, and read/write errors never block chart use. Selected observations and Compare are NEVER persisted. Workspace survives existing health deletion/scenario reseeding without changing health deletion semantics or database migrations.
- Freshness opens a functional sheet: active provider, last successful sync even after a failed attempt, saved-day count, mock/development disclosure or Huawei step-only limitation, availability/busy text and a guarded refresh action. No raw native/provider errors appear.
- Narrow/enlarged Settings rows reflow, switches retain 48dp targets, compact/enlarged Insight copy does not compete with a decorative sparkline, and sheet actions have pressed feedback. Both existing palettes, reduced-motion behavior and Today’s Recovery/Sleep/Signals/Movement structure are retained. Renderer checks cover EN/AR and both themes at 360/390/412/wider, including 2× text; actual glyph bounds remain a native check.
- Journal recommendation: defer, decision only. Optional local tags/a short day-linked note could add context without affecting health scoring, but persistence/migration, provider/date ownership, privacy/deletion and trend context integration are moderate scope, not a risk-free UI change. No implementation or next-task activation.

### HARD Android navigation-mode acceptance — still open

Reusable `BottomSafeArea` uses native additive bottom/left/right insets. The normal-flow tab bar has no fixed height or OS-margin estimate, so its actual safe-area height is reserved by layout. Main tab screens own top/left/right; hidden-tab details and Developer Tools own all four edges. Native sheets set both Android translucency props and measure their own window with a fresh SafeAreaProvider (no frozen initial metrics). Sheet content is bounded and scrollable; confirmation/actions inherit the sheet inset. Settings deletion remains an OS-managed native Alert. There are no other absolute/fixed bottom product actions.

Tests simulate bottom insets changing 0→gesture→3-button→gesture in EN/AR and check modal/screen ownership. They do NOT prove actual Android window behavior. `adb devices` returned no connected devices. No emulator was launched, no screenshots/native visual QA were performed, and no Prebuild/Doctor/Android build/dependency/native configuration change/commit occurred.

Before calling the native UI complete, on a real device or existing development client:

1. Verify gesture and classic 3-button modes independently, then switch live in both directions (also with a sheet open). Do not assume the default navigation mode.
2. In EN/AR, both themes, 360/390/412/wider and enlarged text, verify all four tab targets/labels are fully above the OS controls and scroll-to-end content is reachable. No hidden/overlapping/difficult-to-press action is acceptable.
3. Check calendar, measurement/Compare, focus, week, freshness, language/theme/time sheets, native deletion confirmation, detail charts and Developer Tools. Check landscape/side insets where supported. Sheet close/save/cancel/refresh and final list items must remain reachable above system controls.
4. Validate chart native bubbling, continuous drag/release/vertical scroll recovery, outside dismissal, exact inspected-day Details, transition/refocus resets and measured Arabic/enlarged tooltip bounds. Verify workspace persistence after actual process relaunch, without inspection or Compare restoration.

This is a hard unverified acceptance gate, not visual approval. Huawei remains step-only pending broader approval, package `com.omar.huaweihealthanalytics`; all protected math, health storage/retention/deletion, notification behavior and Huawei integration/configuration remain unchanged by this follow-up. No M10.

### Files changed in this focused follow-up

Earlier dirty files/assets/native config are not part of this inventory and were preserved.

- Root/shared: `src/app/_layout.tsx`, `src/components/BottomSafeArea.tsx` (new), `BottomSafeArea.test.js` (new), `ProductTabBar.tsx` (new), `ProductUI.tsx`.
- Today/calendar: `src/features/dashboard/HomeDashboard.tsx`, `HomeDashboard.interaction.test.js`, `DateNavigator.tsx` (new), `DateHistoryPicker.tsx`, `dateHistory.ts`, `dateHistory.test.ts`.
- Locale: `src/localization/i18n.ts`, `i18n.test.ts`, `LanguageContext.test.tsx`, `resources.ts`.
- Details: `src/features/metrics/MetricDetailScreen.tsx`, `MetricDetailScreen.test.js`.
- Trends: `src/features/trends/chartInspection.tsx` (new), `chartInspection.test.tsx` (new), `TrendsScreen.tsx`, `TrendsScreen.interaction.test.js`, `TrendChart.tsx`, `TrendChart.interaction.test.tsx`, `RangeSelector.tsx`, `MetricPicker.tsx`.
- Preferences: `src/repositories/ProductPreferencesRepository.ts`, `src/database/database.integration.test.ts`.
- Insights/Settings/Developer: `src/features/insights/InsightsScreen.tsx`, `productScreens.test.js`, `src/features/notifications/NotificationSettingsScreen.tsx`, `src/features/development/DeveloperToolsScreen.tsx`.
- Docs: this file, `docs/USER_GUIDE.md`; private `docs/internal/PROJECT_STATE.md`, `ROADMAP.md`, `DECISIONS.md`, `TESTING.md`, `KNOWN_ISSUES.md`, `NEXT_SESSION.md`.

The sections below retain the earlier implementation history; this latest section supersedes earlier digit formatting and test totals.

## Rebuilt experience

- Four primary destinations: Today, Trends, Insights, Settings. The labeled navigation occupies normal layout space and respects the bottom safe area. Detail and Developer Tools routes hide the tab bar.
- Today uses a compact identity/freshness header, one complete abbreviated date, a radial Recovery display, responsive contributor rows, a distinctive sleep-composition module, dense signal rows with real seven-day sparklines, movement bars, and one editorial pattern. No generic stack of identical metric cards.
- Calendar shows saved dates and supports direct month selection, bounded previous/next months, and Jump to Today. Today may be selected without a reading; the empty state is intentional. Day arrows step between saved dates.
- Recovery keeps the existing score/state/completeness, personal baseline context, configured versus applied weights, and impact. Missing readings never imply an above/below-range direction. The explanation expands on demand.
- Sleep shows duration, timing, score, personal context, and proportional reported stages. An unreported remainder is labeled when stage totals do not cover in-bed time. It is not an invented overnight timeline.
- Vitals are compact HRV, RHR, SpO₂, and Stress rows, not oversized tiles. Missing readings use less visual space. Activity uses actual daily steps bars, active minutes, energy, and workouts without invented goals.
- Customize Today locally emphasizes up to three secondary readings. Recovery cannot be hidden. Theme and focus preferences survive health-data deletion and development scenario reseeding.
- This week opens an actual rolling seven-day snapshot anchored to the selected date, with dates, aggregates, coverage, existing comparisons, and the strongest existing deterministic observation.
- Trends is an open large-chart workspace with 7D/30D/90D, a full-label measurement sheet, press/drag crosshair, exact observation tooltip, preserved gaps, adaptive scales, subtle fill, and personal-range bands where supplied. Screen-reader increment/decrement actions inspect recorded days.
- Optional Compare mode gives two existing trend metrics independent, explicitly labeled scales. The secondary tooltip always uses the same selected date; absence stays absent. No causation or equivalence of chart heights is implied.
- Insights uses an open period snapshot and evidence-led, drillable observations. A separate weekly digest always uses seven days, even when the main view is on 30D/90D.
- Seven differentiated details: Recovery contributors; Sleep stages/timing/consistency; HRV range/observation facts; RHR range/all-heart-rate facts; SpO₂ recent readings; Stress neutral index/context; Activity movement/history. Every detail has 7/30/90 history and selected-day context. Period anchors do not shift during scrubbing.
- Settings uses compact grouped rows, persisted System/Dark/Light appearance and a real English/العربية language sheet, unchanged notification operations, data/provider state, legal links, and version. Both preferences survive health deletion and scenario reseeding.
- Developer Tools uses six concise checkmarked scenario rows with unchanged scenario IDs and data generation.
- Shared sheets, compact states, pressed feedback, short fades, and reduced-motion handling replace inconsistent modal/error treatments. Cached readings remain usable after refresh failure. Refocus reloads and request guards prevent stale selections/saved preferences from being overwritten.

## Themes, accessibility, and boundaries

Dark retains near-black navy, indigo, violet, and lavender. Light is independently composed from lavender-gray foundations, blue-lilac surfaces, dark indigo text, and rich violet accents. Small-text contrast is tested against all four surface roles in both themes, including selected actions.

360/390/412/wider widths use adaptive complete dates, wrapping controls/values, bounded content, and single-column layouts for large text. Important values are not ellipsized. Icons share a stroke system. Full accessible metric names accompany abbreviations; chart actions do not require dragging. The orbital identity stays independent of Huawei branding.

Recovery V1 remains HRV 40%, resting heart rate 35%, sleep duration 25%, with at least two usable signals. Baseline/historical Recovery/trend/insight math, retention, health deletion, notification semantics, Huawei provider/scopes/AGConnect, and `com.omar.huaweihealthanalytics` are unchanged. Stress is displayed as a neutral wellness metric and remains outside Recovery V1 and primary Trends/Insights. Huawei remains step-only pending scope approval. No M10.

Arabic is now implemented, including local resources, accessibility copy, dates/numbers, and explicit RTL. Journal and new native haptics remain deferred. Existing launcher/splash assets, dependencies, and native configuration were preserved in this polish pass.

## Earlier polish engineering notes (historical)

- Recovery stacks score and context below 440 dp or above 1.15 font scale, on Today and the Recovery detail. 360/390/412 dp therefore never squeeze the full state beside the gauge. Wider normal-text screens retain the accepted side-by-side composition.
- Narrow Insights snapshots also stack identity/context; enlarged metric values, control rows, dates, contributor facts, and sleep copy can wrap/reflow. Important shared headings/readings are not ellipsized or font-shrunk. Existing bounded safe-area sheets and normal-layout bottom navigation remain.
- Light surfaces are background `#E9EBF5`, primary `#E3E5F0`, raised `#F0EFF8`, and muted `#DDE0EE`, with cool indigo text and purple accents. Five light semantic colors were slightly deepened to retain 4.5:1 small-text contrast. The approved dark palette is unchanged.
- `src/localization/resources.ts` holds typed local English/Modern Standard Arabic resources. `tr` formats stable-key product copy; `localizeText` adapts existing deterministic engine explanations only at the presentation boundary. Engine outputs and meanings are not rewritten. Resource/interpolation parity and all six scenarios are tested.
- A small external locale store and React subscription update visible copy immediately. `LanguageProvider` hydrates before presenting screens. SQLite stores `app_language` in the existing keyed v4 product preference table; no migration or health-schema change was required. Save failure leaves the prior language active.
- Explicit app selection drives `Intl` dates/numbers and native Yoga `direction`, text alignment, logical spacing, and appropriate directional icon mirroring. Charts, movement/stage bars, range/impact scales, numeric units, and chart date endpoints remain explicit LTR coordinate islands. Logical start/end anchors preserve coordinates without global left/right swapping.
- No OS auto-language feature was requested, so no new `expo-localization` dependency or config plugin is needed. No production `forceRTL`, app restart, native package/configuration change, or new build was introduced. SDK 57 docs and RN 0.86 direction guidance were checked. Native permission/time dialogs may follow OS language; Arabic glyph shaping, font scaling, system RTL behavior, TalkBack and real tooltip bounds remain manual-device gates.
- Only reminder/channel copy is localized at the adapter boundary. Language selection never requests permission, schedules, cancels, or reconciles notifications. Existing scheduled content keeps its language until a normal scheduling operation replaces it. Policy, timing, ownership, routing, and no-health-data semantics are unchanged.

### Files touched by this polish pass

Prior working-tree changes were preserved; the list below is this pass, not a claim that every dirty file was newly changed.

- Localization: `src/localization/resources.ts`, `i18n.ts`, `useLocale.ts`, `LanguageContext.tsx`, `LocalizedNative.tsx`, `i18n.test.ts`, `LanguageContext.test.tsx`.
- Root/shared: `src/app/_layout.tsx`; `src/components/AppIcon.tsx`, `ProductUI.tsx`, `SignalVisuals.tsx`, `ScreenPrimitives.tsx`; `src/theme/theme.ts`, `responsive.ts`, `responsive.test.ts`, `ThemeContext.tsx`; `src/shared/formatters/healthFormatters.ts`; `src/repositories/ProductPreferencesRepository.ts`.
- Today/calendar: `src/features/dashboard/HomeDashboard.tsx`, `HomeDashboard.interaction.test.js`, `DateHistoryPicker.tsx`, `DashboardComponents.tsx`, `todayPresentation.ts`, `dashboardViewModel.ts`.
- Details: `src/features/metrics/MetricDetailScreen.tsx`, `MetricDetailScreen.test.js`, `metricDetailPresentation.ts`.
- Trends: `src/features/trends/TrendsScreen.tsx`, `TrendsScreen.interaction.test.js`, `TrendChart.tsx`, `TrendChart.interaction.test.tsx`, `MetricPicker.tsx`, `RangeSelector.tsx`, `trendViewModel.ts`.
- Insights/settings/development: `src/features/insights/InsightsScreen.tsx`, `productScreens.test.js`; `src/features/notifications/NotificationSettingsScreen.tsx`; `src/features/development/DeveloperToolsScreen.tsx`.
- Persistence/reminder tests: `src/database/database.integration.test.ts`; `src/notifications/ExpoNotificationAdapter.ts`, `ExpoNotificationAdapter.localization.test.ts`.
- Public docs: `README.md`, `docs/USER_GUIDE.md`, this report. Private handoff/architecture/database/dashboard/decision/testing/notification/roadmap/known-issue docs record the new language boundary and open manual gate.

Usage is explained in [USER_GUIDE.md](USER_GUIDE.md), including the step-only Huawei limitation and the distinction between synthetic development data and real wearable readings.

### Automated validation

TypeScript, ESLint and `git diff --check` pass. Final polish validation passes **25 scoped suites, 231 tests**, including local resources, language save/hydration/failure, SQLite preference survival, responsive composition, Arabic screens, chart interaction, contrast, and protected engine/notification regressions. The full suite was not run. Exact commands are in the private testing log. Tests/source review are not visual approval or native layout validation.

No Expo Prebuild, emulator, Expo Doctor, Android clean/debug/release build, screenshots, or commit was performed for this rebuild.

## Manual visual and interaction approval gate

On a development build, repeat **every item below in English and Arabic, Dark and Light**, at **360, 390, 412 dp and a wider phone**, including **360 dp with enlarged text (about 2×)**. Also confirm System follows OS appearance and appearance/language survive relaunch, deletion, and scenario changes. A pass requires no clipping, important-value ellipsis, off-screen controls/tooltips, crushed contributors, one-word-per-line layouts, modal overflow, or hidden bottom content. Check an English-language OS with Arabic app language and an Arabic-language OS with English app language; system-owned dialogs may follow the OS.

1. Today: brand/freshness, complete selected date, both saved-day arrows, radial Recovery/state/completeness/context, collapsed and expanded contributors, partial applied weights, missing contributors, sleep timing/score/stages/legend, four signal rows/sparklines, missing signal density, movement bars/facts, and editorial pattern. Check six scenarios, loading, no saved data, missing selected day, failed sync, and cached data.
2. Customize Today: select/deselect up to three, disabled fourth choice, save/close/reopen/relaunch, empty focus choice, and unchanged visible Recovery. Open This week from multiple historical dates and verify its exact seven-day bounds/coverage/drilldowns.
3. Calendar: recorded dots, selected and Today states, direct month choice, first/last month bounds, year boundary, saved-day selection, Today without readings, close/backdrop/Android back, and enlarged-text day targets.
4. Recovery detail: selected score, contributor values/baselines/ranges/directions/model/applied weights/impact/completeness; exact historical selection; 7D/30D/90D; learning and partial data.
5. Sleep detail: duration, bedtime/wake time, stage composition/legend, unreported stages if present, score, personal range, period timing consistency, historical selection, and missing sleep.
6. HRV detail: personal range/current marker, daily low/high/count, all periods, exact historical selection, learning and missing data.
7. RHR detail: resting value/range, distinct all-heart-rate low/average/high, all periods, exact historical selection, missing resting value and failed query.
8. SpO₂ detail: min/average/max/count, recent reading selection, all periods and gaps. Stress detail: neutral source index/min/max/count, selected history, missing data, no medical categories or Recovery contribution.
9. Activity detail: steps, seven-day movement, active minutes/energy/workouts/distance when reported, all periods and historical days, unavailable optional fields.
10. Trends: every metric and 7D/30D/90D, measurement sheet, first/last/single/sparse point, continuous drag, missing gap, crosshair/date/value/unit, long decimal tooltip wrapping, measured tooltip at both edges, vertical-scroll lock/release, range band and axes. Compare each sensible pair; confirm units/independent scales and a missing same-day secondary reading.
11. Insights: 7D/30D/90D snapshot, prioritized evidence/coverage/period, observation and snapshot drilldowns, no-observation/sparse states, weekly summary from each main period, cached refresh failure, and fast period switching.
12. Settings: theme and language sheets, immediate language changes and save-failure handling, notifications off/on/daily/time and granted/denied/unavailable states, OS-return refresh, data count/deletion confirmation, provider/freshness, legal links/version, and no unsolicited permission prompt. Confirm theme/language persistence after process relaunch.
13. Developer Tools: six compact descriptions, current checkmark, busy/failed selection, recorded count, and return to Today/Trends/Insights/detail with fresh scenario data. Preferences must remain chosen.
14. Shared UI: all sheets fit/scroll above safe areas; reduced motion; pressed states; TalkBack full names/selected states/chart increment/decrement; large text; bottom navigation labels and scroll-to-end visibility. On real hardware inspect drag responsiveness and screen-opening latency.

Only the user can accept the product visually. This checklist is open until that review.
