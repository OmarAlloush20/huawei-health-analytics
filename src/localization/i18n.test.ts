import { ar, en, messages } from './resources';
import { directionForLanguage, getLocale, localizeDigits, localizeText, normalizeLanguage, publishLanguage, tr } from './i18n';
import { formatSelectedDate, contributionWeight } from '../features/dashboard/todayPresentation';
import { formatNumber, formatSleepDuration } from '../shared/formatters/healthFormatters';
import { createMockHealthData, MOCK_ANCHOR_DATE, MOCK_TIME_ZONE, MOCK_HEALTH_SCENARIOS } from '../providers/mock/mockHealthData';
import { calculateDailyBaselines } from '../services/baselineEngine';
import { calculateRecovery } from '../services/recoveryEngine';
import { generateInsights } from '../services/insightsEngine';
import { buildTrendReport } from '../services/trendEngine';
import { buildTrendsViewModel } from '../features/trends/trendViewModel';

afterEach(() => publishLanguage('en'));
test('all local resources have nonempty English/Arabic and matching interpolation names', () => {
  expect(Object.keys(ar)).toEqual(Object.keys(en));
  expect(Object.keys(messages).length).toBeGreaterThan(350);
  for (const pair of Object.values(messages)) {
    expect(pair.every((value) => value.trim().length > 0)).toBe(true);
    expect(pair[0].match(/\{\w+\}/g)?.sort() ?? []).toEqual(pair[1].match(/\{\w+\}/g)?.sort() ?? []);
  }
});
test('explicit preference drives dates, numbers, units and layout without changing stored dates', () => {
  expect(normalizeLanguage('fr')).toBe('en');
  expect(directionForLanguage('en')).toBe('ltr');
  expect(directionForLanguage('ar')).toBe('rtl');
  expect(formatSleepDuration(435)).toBe('7h 15m');
  publishLanguage('ar');
  expect(getLocale()).toBe('ar-u-nu-latn');
  expect(formatNumber(1234.5)).toBe('1,234.5');
  expect(formatSleepDuration(435)).toBe('7 س 15 د');
  for (const width of [360, 390, 412, 768]) {
    expect(formatSelectedDate('2026-09-30', width, 1)).toMatch(/[\u0600-\u06ff]/);
    expect(formatSelectedDate('2026-09-30', width, 2)).toMatch(/[\u0600-\u06ff]/);
  }
  expect(tr('format.recoveryInputs', { count: 100, signals: 3 })).toBe('100% من المدخلات · 3 مؤشرات');
  expect(localizeText('View details ›')).toBe('عرض التفاصيل ‹');
  expect(localizeText(`${new Intl.NumberFormat('ar').format(-3.3)} pts`, 'ar')).toContain('نقطة');
});

test.each(['en', 'ar'] as const)('%s keeps health values and technical units Western and unambiguous', (target) => {
  publishLanguage(target);
  for (const value of ['71.6 / 100', '64 bpm', '46 ms', '96.9%', '9,754 steps', 'HRV', 'RHR', 'SpO₂', 'kcal']) {
    const rendered = localizeText(value);
    expect(rendered).not.toMatch(/[٠-٩۰-۹٬٫]/);
    if (!value.endsWith('steps')) expect(rendered).toBe(value);
  }
  expect(localizeDigits('٧١٫٦ / ١٠٠ · ۹٬۷۵۴')).toBe('71.6 / 100 · 9,754');
});

test('joined engine reasons keep each signal, relation and sentence order intact', () => {
  const first = 'Resting heart rate was above your recent range.';
  const second = 'HRV was below your recent range.';
  expect(localizeText(`${first} ${second}`, 'ar')).toBe(`${localizeText(first, 'ar')} ${localizeText(second, 'ar')}`);
});

function expectArabicCopy(copy: string) {
  if (!/^(HRV|RHR|SpO₂)$/.test(copy)) expect(copy).toMatch(/[\u0600-\u06ff]/);
  expect(copy.replace(/HRV|RHR|RMSSD|bpm|ms|kcal|SpO₂/g, '')).not.toMatch(/[A-Za-z]/);
}
test.each(MOCK_HEALTH_SCENARIOS.map((scenario) => scenario.id))('%s deterministic recovery/insight/trend copy is locally translatable without mutating results', (scenario) => {
  const data = createMockHealthData(scenario, { start: '2026-07-03', end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  if (data.dailySummaries.status !== 'available') throw new Error('Expected fixture');
  const summaries = data.dailySummaries.value;
  const last = summaries.at(-1)!;
  const recovery = calculateRecovery(calculateDailyBaselines(summaries.slice(0, -1), last, last.date, MOCK_TIME_ZONE));
  const before = JSON.stringify(recovery);
  publishLanguage('ar');
  expectArabicCopy(localizeText(recovery.explanation));
  for (const contribution of recovery.contributions) {
    expectArabicCopy(localizeText(contribution.reason));
    expectArabicCopy(contributionWeight(contribution));
  }
  expect(JSON.stringify(recovery)).toBe(before);
  for (const range of ['7d', '30d', '90d'] as const) {
    const report = buildTrendReport(range, last.date, MOCK_TIME_ZONE, summaries);
    const original = JSON.stringify(report);
    for (const insight of generateInsights(report).insights) {
      expectArabicCopy(localizeText(insight.title));
      expectArabicCopy(localizeText(insight.explanation));
    }
    const view = buildTrendsViewModel(report);
    expectArabicCopy(view.consistency);
    for (const card of view.cards) { expectArabicCopy(card.label); expectArabicCopy(card.comparison); expectArabicCopy(card.coverage); }
    expect(JSON.stringify(report)).toBe(original);
  }
});
