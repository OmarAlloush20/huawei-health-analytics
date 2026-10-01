import type { DailyHealthSummary, DataProvenance, DateRange, HeartRateSample, HrvObservation, LocalDate, NormalizedHealthData, OxygenSaturationSample, SleepSession, SleepStage, WorkoutSession } from '../../models/health';
import { availableMetric, failedMetric, missingMetric, unsupportedMetric, withCompleteness } from '../../models/healthMetrics';
import { addLocalDays, enumerateLocalDates, localDateTimeToIso, toLocalDate } from '../../shared/dates/healthDates';

export const MOCK_ANCHOR_DATE: LocalDate = '2026-09-30';
export const MOCK_TIME_ZONE = 'Europe/Istanbul';
export const MOCK_HISTORY_DAYS = 90;

export type MockHealthScenarioId = 'balanced' | 'poor-sleep' | 'low-hrv-elevated-rhr' | 'high-activity' | 'insufficient-history' | 'missing-data';

export interface MockHealthScenario { id: MockHealthScenarioId; label: string; description: string; historyDays: number }

export const MOCK_HEALTH_SCENARIOS: readonly MockHealthScenario[] = [
  { id: 'balanced', label: 'Balanced', description: 'Stable sleep, recovery signals, and moderate activity.', historyDays: 90 },
  { id: 'poor-sleep', label: 'Poor Sleep', description: 'Several recent short and interrupted nights.', historyDays: 90 },
  { id: 'low-hrv-elevated-rhr', label: 'Low HRV + High RHR', description: 'Recent depressed HRV with elevated resting heart rate.', historyDays: 90 },
  { id: 'high-activity', label: 'High Activity', description: 'A recent block of workouts and high step volume.', historyDays: 90 },
  { id: 'insufficient-history', label: 'Insufficient History', description: 'Only seven days are available for baseline testing.', historyDays: 7 },
  { id: 'missing-data', label: 'Missing Data', description: 'Intentional gaps, unsupported data, and one query failure.', historyDays: 90 },
] as const;

interface GeneratedMockData { summaries: DailyHealthSummary[]; sleepSessions: SleepSession[]; heartRateSamples: HeartRateSample[]; hrvObservations: HrvObservation[]; oxygenSaturationSamples: OxygenSaturationSample[]; workouts: WorkoutSession[] }

const round = (value: number, decimals = 0) => Math.round(value * 10 ** decimals) / 10 ** decimals;

function provenance(aggregation: DataProvenance['aggregation'], sourceId?: string): DataProvenance {
  return { provider: 'mock', recordedBy: 'synthetic', aggregation, syncedAt: `${MOCK_ANCHOR_DATE}T12:00:00.000Z`, sourceId };
}

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(new Date(timestamp).getTime() + minutes * 60_000).toISOString();
}

function createStages(startTime: string, sleepMinutes: number, awakeMinutes: number): SleepStage[] {
  const durations: { stage: SleepStage['stage']; durationMinutes: number }[] = [
    { stage: 'awake', durationMinutes: awakeMinutes },
    { stage: 'light', durationMinutes: Math.round(sleepMinutes * 0.51) },
    { stage: 'deep', durationMinutes: Math.round(sleepMinutes * 0.22) },
  ];
  const assigned = durations.reduce((total, item) => total + item.durationMinutes, 0);
  durations.push({ stage: 'rem', durationMinutes: sleepMinutes + awakeMinutes - assigned });
  let cursor = startTime;
  return durations.map(({ stage, durationMinutes }) => {
    const endTime = addMinutes(cursor, durationMinutes);
    const result = { stage, startTime: cursor, endTime, durationMinutes };
    cursor = endTime;
    return result;
  });
}

function generateScenario(scenario: MockHealthScenario): GeneratedMockData {
  const dates = enumerateLocalDates({ start: addLocalDays(MOCK_ANCHOR_DATE, -(scenario.historyDays - 1)), end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE });
  const generated: GeneratedMockData = { summaries: [], sleepSessions: [], heartRateSamples: [], hrvObservations: [], oxygenSaturationSamples: [], workouts: [] };

  dates.forEach((date, index) => {
    const daysAgo = dates.length - 1 - index;
    const recent = daysAgo <= 6;
    const wave = Math.sin(index * 0.73);
    const weekly = index % 7;
    let steps = Math.round(7_300 + wave * 1_250 + (weekly >= 5 ? 1_400 : 0));
    let activeMinutes = Math.round(43 + wave * 8);
    let energyKcal = Math.round(390 + steps * 0.025);
    let sleepMinutes = Math.round(445 + Math.cos(index * 0.61) * 32);
    let restingBpm = Math.round(61 + Math.sin(index * 0.37) * 3);
    let averageBpm = Math.round(73 + Math.sin(index * 0.42) * 4);
    let hrvMs = Math.round(46 + Math.cos(index * 0.31) * 7);
    let stressIndex = Math.round(32 + Math.sin(index * 0.41) * 8);
    const spo2 = round(97.2 + Math.sin(index * 0.49) * 0.8, 1);

    if (scenario.id === 'poor-sleep' && recent) { sleepMinutes -= 105 + (daysAgo % 3) * 12; stressIndex += 14; }
    if (scenario.id === 'low-hrv-elevated-rhr' && recent) { hrvMs -= 19; restingBpm += 9; averageBpm += 6; stressIndex += 24; }
    if (scenario.id === 'high-activity' && recent) { steps += 5_800 + (daysAgo % 3) * 700; activeMinutes += 52; energyKcal += 430; stressIndex += 8; }
    stressIndex = Math.max(0, Math.min(100, stressIndex));

    const dailyProvenance = provenance('daily', `mock-${scenario.id}-${date}`);
    const rawProvenance = provenance('raw', `mock-${scenario.id}`);
    const shouldMissHrv = index % 23 === 4 || (scenario.id === 'missing-data' && daysAgo <= 8 && daysAgo % 2 === 0);
    const shouldMissSpo2 = index % 17 === 6 || (scenario.id === 'missing-data' && daysAgo <= 10);
    const shouldMissSleep = scenario.id === 'missing-data' && (daysAgo === 2 || daysAgo === 5);
    const shouldMissStress = scenario.id === 'missing-data' && daysAgo === 2;
    const heartQueryFailed = scenario.id === 'missing-data' && daysAgo === 1;
    const awakeMinutes = scenario.id === 'poor-sleep' && recent ? 48 : 18 + (index % 4) * 4;
    const bedtimeHour = scenario.id === 'poor-sleep' && recent ? 1 : 23;
    const bedtimeDate = bedtimeHour < 12 ? date : addLocalDays(date, -1);
    const bedtimeMinute = (17 + index * 7) % 40;
    const startTime = localDateTimeToIso(bedtimeDate, MOCK_TIME_ZONE, bedtimeHour, bedtimeMinute);
    const endTime = addMinutes(startTime, sleepMinutes + awakeMinutes);
    const stages = createStages(startTime, sleepMinutes, awakeMinutes);
    const lightMinutes = stages.find((item) => item.stage === 'light')!.durationMinutes;
    const deepMinutes = stages.find((item) => item.stage === 'deep')!.durationMinutes;
    const remMinutes = stages.find((item) => item.stage === 'rem')!.durationMinutes;
    const sleepScore = Math.max(45, Math.min(94, Math.round(78 + (sleepMinutes - 420) / 8 - awakeMinutes / 8)));

    if (!shouldMissSleep) generated.sleepSessions.push({ id: `sleep-${scenario.id}-${date}`, date, startTime, endTime, durationMinutes: sleepMinutes, timeInBedMinutes: sleepMinutes + awakeMinutes, stages, score: sleepScore, interruptions: Math.max(1, Math.round(awakeMinutes / 8)), averageBreathingRatePerMinute: round(14.2 + Math.sin(index) * 0.7, 1), provenance: rawProvenance });

    const hrValues = [restingBpm, averageBpm - 3, averageBpm + 9, restingBpm + 4];
    if (!heartQueryFailed) [7, 12, 18, 22].forEach((hour, sampleIndex) => generated.heartRateSamples.push({ timestamp: localDateTimeToIso(date, MOCK_TIME_ZONE, hour, sampleIndex * 7), beatsPerMinute: hrValues[sampleIndex], context: sampleIndex === 0 ? 'resting' : sampleIndex === 2 ? 'active' : 'unknown', provenance: rawProvenance }));
    if (!shouldMissHrv) generated.hrvObservations.push({ timestamp: localDateTimeToIso(date, MOCK_TIME_ZONE, 6, 45), rmssdMs: hrvMs, context: 'resting', provenance: rawProvenance });
    if (!shouldMissSpo2) [2, 6, 21].forEach((hour, sampleIndex) => generated.oxygenSaturationSamples.push({ timestamp: localDateTimeToIso(date, MOCK_TIME_ZONE, hour, sampleIndex * 9), percentage: round(spo2 + (sampleIndex - 1) * 0.3, 1), context: hour < 7 ? 'sleep' : 'resting', provenance: rawProvenance }));

    const workoutDay = (scenario.id === 'high-activity' && recent) || index % 6 === 2;
    if (workoutDay) {
      const durationMinutes = scenario.id === 'high-activity' && recent ? 58 + (index % 3) * 8 : 35 + (index % 3) * 5;
      const workoutStart = localDateTimeToIso(date, MOCK_TIME_ZONE, 18, 10);
      generated.workouts.push({ id: `workout-${scenario.id}-${date}`, date, type: index % 2 === 0 ? 'running' : 'strength', startTime: workoutStart, endTime: addMinutes(workoutStart, durationMinutes), durationMinutes, activeEnergyKcal: Math.round(durationMinutes * 7.2), distanceMeters: index % 2 === 0 ? Math.round(durationMinutes * 115) : undefined, averageHeartRateBpm: 132 + (index % 6), provenance: rawProvenance });
    }

    const partial: Omit<DailyHealthSummary, 'completeness'> = {
      date,
      timeZone: MOCK_TIME_ZONE,
      source: 'mock' as const,
      activity: availableMetric({ steps, activeEnergyKcal: energyKcal, activeDurationMinutes: activeMinutes, distanceMeters: Math.round(steps * 0.74), workoutCount: workoutDay ? 1 : 0 }, dailyProvenance),
      sleep: shouldMissSleep ? missingMetric('No sleep session was recorded for this local day.', dailyProvenance) : availableMetric({ totalSleepMinutes: sleepMinutes, timeInBedMinutes: sleepMinutes + awakeMinutes, awakeMinutes, lightMinutes, deepMinutes, remMinutes, score: sleepScore, bedtime: startTime, wakeTime: endTime }, dailyProvenance),
      heartRate: heartQueryFailed ? failedMetric('The simulated heart-rate query failed.', dailyProvenance, 'MOCK_QUERY_FAILURE') : availableMetric({ minimumBpm: Math.min(...hrValues), maximumBpm: Math.max(...hrValues), averageBpm, restingBpm }, dailyProvenance),
      hrv: shouldMissHrv ? missingMetric('No valid overnight HRV observation was recorded.', dailyProvenance) : availableMetric({ averageRmssdMs: hrvMs, minimumRmssdMs: hrvMs, maximumRmssdMs: hrvMs, observationCount: 1 }, dailyProvenance),
      oxygenSaturation: shouldMissSpo2 ? missingMetric('No oxygen-saturation samples were recorded.', dailyProvenance) : availableMetric({ averagePercent: spo2, minimumPercent: round(spo2 - 0.3, 1), maximumPercent: round(spo2 + 0.3, 1), observationCount: 3 }, dailyProvenance),
      stress: shouldMissStress ? missingMetric('No stress observations were recorded.', dailyProvenance) : availableMetric({ averageIndex: stressIndex, minimumIndex: Math.max(0, stressIndex - 8), maximumIndex: Math.min(100, stressIndex + 9), observationCount: 8 }, dailyProvenance),
      activityLoad: unsupportedMetric('Activity load calculation is deferred to a later milestone.', dailyProvenance),
    };
    generated.summaries.push(withCompleteness(partial));
  });
  return generated;
}

export function getMockScenario(id: MockHealthScenarioId): MockHealthScenario {
  const scenario = MOCK_HEALTH_SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new Error(`Unknown mock health scenario: ${id}`);
  return scenario;
}

export function getMockScenarioRange(id: MockHealthScenarioId): DateRange {
  const scenario = getMockScenario(id);
  return { start: addLocalDays(MOCK_ANCHOR_DATE, -(scenario.historyDays - 1)), end: MOCK_ANCHOR_DATE, timeZone: MOCK_TIME_ZONE };
}

export function createMockHealthData(id: MockHealthScenarioId, range: DateRange): NormalizedHealthData {
  const generated = generateScenario(getMockScenario(id));
  const requested = new Set(enumerateLocalDates(range));
  const raw = provenance('raw', `mock-${id}`);
  return {
    range,
    dailySummaries: availableMetric(generated.summaries.filter((item) => requested.has(item.date)), provenance('daily', `mock-${id}`)),
    sleepSessions: availableMetric(generated.sleepSessions.filter((item) => requested.has(item.date)), raw),
    heartRateSamples: availableMetric(generated.heartRateSamples.filter((item) => requested.has(toLocalDate(new Date(item.timestamp), range.timeZone))), raw),
    hrvObservations: availableMetric(generated.hrvObservations.filter((item) => requested.has(toLocalDate(new Date(item.timestamp), range.timeZone))), raw),
    oxygenSaturationSamples: availableMetric(generated.oxygenSaturationSamples.filter((item) => requested.has(toLocalDate(new Date(item.timestamp), range.timeZone))), raw),
    workouts: availableMetric(generated.workouts.filter((item) => requested.has(item.date)), raw),
  };
}
