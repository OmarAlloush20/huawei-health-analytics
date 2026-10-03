# Huawei Health Analytics — User Guide

Huawei Health Analytics helps you explore your recorded health data, compare it with your own recent history, and notice personal patterns. It stores imported readings locally on your device. It is a personal wellness tool, not medical advice or a diagnosis.

## First, understand the data source

The Huawei provider currently supports authorized step retrieval only. Broader Huawei Health Service Kit access remains pending approval and integration. Sleep, HRV, resting heart rate, oxygen saturation, Stress, and complete analytics shown in a mock/development build are synthetic examples, **not live Huawei wearable measurements**. Missing or unsupported readings stay unavailable rather than becoming zero.

Use Settings → Data to check the data source, authorization state, recorded-day count, and sync status. A successful sync does not mean every metric is supported or that every day has a reading. No new physical-device Huawei validation was performed during this polish pass.

## Today: explore one day

Today brings together Recovery, Sleep, Signals, Movement, and a personal pattern. Pull down to refresh; the app then displays locally saved readings. Tap the freshness indicator to see the active source, last successful sync, saved-day count, and whether refresh is available. You can refresh the selected day from that sheet. It explicitly identifies synthetic development data or Huawei’s current step-only access; failed refreshes keep saved readings available.

Tap the centered date to open the calendar. Dots mark saved days. Choose a month directly, use month arrows, or select Jump to Today. The day arrows beside the date move between recorded days, not empty calendar dates. In English, earlier is on the left; in Arabic, earlier is on the right. Month arrows follow the same reading-direction convention. Today can have no data, even when earlier dates do.

Tap This week in the header for a rolling seven-day recap ending on the selected date, with averages or medians, coverage, and comparisons. The settings icon beside it opens Customize Today: choose up to three secondary readings for Your shortcuts. Tap one to open its detail page for the selected day. Recovery always stays visible; choices are locked while they save.

### Recovery and contributors

The radial score compares that day's HRV, resting heart rate, and sleep duration with your own earlier history. The configured weights are HRV 40%, resting heart rate 35%, and sleep 25%. At least two usable signals and sufficient personal baseline history are needed. Applied weights adjust when a signal is unavailable.

The compact contributor strip shows each reading and its impact. Tap a contributor for that metric's details, or expand “What shaped your score” for the explanation, configured/applied weights and personal ranges. Recovery details also let you expand each contributor. A learning or unavailable state is intentional; the app does not invent a score. Stress and Activity do not affect Recovery V1. The score does not prescribe training or rest.

### Sleep, Signals, and Movement

- Sleep shows reported duration, bedtime/wake time, score when supplied, and stage proportions. These proportions are not an invented overnight timeline.
- Signals includes HRV (RMSSD in milliseconds), resting heart rate, SpO₂, and Stress. Stress is a source-provided wellness index, separate from Recovery, with no population thresholds or diagnostic categories.
- Movement shows recorded steps and recent daily bars; the selected day has a brighter bar and an underline. Neutral gap marks are missing readings, not zero steps. Active minutes, energy, workouts, and distance appear only when supplied by the source. There is no invented step goal.

Tap any module or signal to open its detail page. Day context appears before 7/30/90-day History, recorded-day selection, period coverage, and a short expandable explanation. Sleep includes timing and consistency; HRV and resting heart rate include personal ranges; SpO₂ and Stress have rails spanning the day's recorded minimum–maximum with an average marker, not population thresholds or invented goals; Activity includes movement history.

## Trends: explore changes over time

Choose 7D, 30D, or 90D, then open the measurement picker to select Recovery, sleep duration, HRV, resting heart rate, or steps. The main value is a period average or median until you inspect a day.

Press and drag on the chart to inspect a recorded observation. Its tooltip and header show the selected date/value. Releasing keeps that observation visible so you can read it. Tap outside the chart workspace (the plot, legend, reading header, and Details action) to exit inspection and return to the period summary. Changing the metric/range, changing Compare, or leaving and returning also clears inspection. Missing days remain gaps; selecting a nearby recorded day does not fill or interpolate the missing data. Details opens that metric and inspected date. Screen-reader users can move between recorded days with the chart's increment/decrement actions.

Compare adds a second measurement; use its picker to change it, or End compare to remove it. Each series has its own labeled scale. Equal line height does not mean equal magnitude, and comparison does not establish causation. A missing secondary reading remains missing.

Trends remembers your last measurement and 7/30/90-day range on this device. After relaunch it opens without a selected observation or Compare mode. Returning to the tab also clears inspection; an open Compare workspace can remain during that session until you end it. These viewing preferences remain when you delete health history or change development scenarios; chart readings never become preferences.

Below the chart, compact facts show the latest reading, personal range where available, and recorded-day coverage. The uninspected headline is the period average/median. The previous-period summary compares equal-length periods only when enough data exists. A fixed 90-day mock history cannot supply a fully covered preceding 90-day period. Tapping the already-selected Trends tab also exits inspection without changing your measurement or range.

## Insights: notice patterns

Select 7, 30, or 90 days for a scan-friendly snapshot and up to three deterministic observations. These describe recorded changes and persistent differences from your personal range; they are not AI-generated diagnoses or medical warnings. Tap an observation or snapshot measurement for its detail page.

Your weekly summary always uses seven calendar days, even when the main Insights view uses 30 or 90. It shows coverage, aggregates, and the strongest available observation. No clear change is a valid result.

## Settings: make the app yours

- Appearance: choose System, Dark, or Light. System follows the device's appearance. Your selection persists locally.
- Language: choose English or العربية. The app updates immediately and remembers the selection after relaunch. Arabic uses right-to-left product layouts and Arabic date/label wording, while health values keep Western digits, decimal points, and thousands separators: `71.6 / 100`, `64 bpm`, `46 ms`, `96.9%`, `9,754` steps. HR, HRV, RHR, SpO₂, bpm, ms, and kcal remain recognizable technical labels/units. Charts always run from earlier to later left-to-right; Arabic does not reverse the timeline. System-owned dialogs and permission/time controls can follow the device language.
- Notifications: enable the optional daily local reminder and choose its local time. System permission is required; opening Settings does not request it. Reminders contain no health readings and do not sync data in the background. OS battery/channel settings may affect delivery. Changing language does not reschedule a reminder; new schedules use the selected language, while an existing schedule retains its previous copy until a normal reminder-setting change replaces it.
- Data: inspect the source, authorization and sync status, or confirm deletion of local health history. Theme, language, Today focus, and Trends viewing preferences remain. There is no export/restore feature; uninstalling or clearing app data removes local history. The database is not encrypted at rest.
- About: open the Privacy Policy and User Agreement and check the version.

## Developer Tools are development-only

In a development build using the mock provider, Settings → Developer Tools can replace local mock records with one of six deterministic scenarios: Balanced, Poor Sleep, Low HRV + High RHR, High Activity, Insufficient History, and Missing Data. These are useful for exploring complete, learning, and missing-reading states. They are not live data sources and are not normal personal-build controls. Mock fixtures have a fixed historical anchor rather than today's live measurements.

The app uses system safe areas for gesture navigation and Android’s classic 3-button navigation. No device-specific bottom-margin setting is needed. Physical-device review of both modes (including switching while sheets are open), Arabic, and enlarged text remains pending; automated checks do not establish visual approval.
