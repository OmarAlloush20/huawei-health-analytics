import type { LocalDate } from './health';
import type { TrendMetricId, TrendRangeId } from './trends';

export type InsightType = 'persistent-deviation' | 'period-comparison' | 'sleep-consistency' | 'data-coverage';
export type InsightImportance = 'notable' | 'informational';

export interface InsightEvidence {
  currentValue?: number;
  previousValue?: number;
  absoluteChange?: number;
  relativeChangePercent?: number;
  consecutiveDays?: number;
  availableDays: number;
  expectedDays: number;
  unit?: string;
}

export interface DeterministicInsight {
  version: number;
  ruleId: string;
  type: InsightType;
  metric?: TrendMetricId;
  importance: InsightImportance;
  title: string;
  explanation: string;
  range: TrendRangeId;
  startDate: LocalDate;
  endDate: LocalDate;
  priority: number;
  evidence: InsightEvidence;
}

export interface InsightsResult {
  version: number;
  range: TrendRangeId;
  generatedForDate: LocalDate;
  insights: DeterministicInsight[];
}
