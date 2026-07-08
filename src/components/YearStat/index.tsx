import useActivities from '@/hooks/useActivities';
import type { Activity } from '@/utils/utils';
import { formatPace } from '@/utils/utils';
import { SHOW_ELEVATION_GAIN } from '@/utils/const';
import { DIST_UNIT, M_TO_DIST, M_TO_ELEV } from '@/utils/utils';

interface YearStatAccumulator {
  averageHeartRateTotal: number;
  heartRateNullCount: number;
  runCount: number;
  streak: number;
  totalDistance: number;
  totalElevationGain: number;
  totalMetersForPace: number;
  totalSecondsForPace: number;
}

interface YearStatSummary {
  averageHeartRate: string;
  averagePace: string;
  hasHeartRate: boolean;
  runCount: number;
  streak: number;
  totalDistance: number;
  totalElevationGain: string;
}

const createAccumulator = (): YearStatAccumulator => ({
  averageHeartRateTotal: 0,
  heartRateNullCount: 0,
  runCount: 0,
  streak: 0,
  totalDistance: 0,
  totalElevationGain: 0,
  totalMetersForPace: 0,
  totalSecondsForPace: 0,
});

const addRunToAccumulator = (accumulator: YearStatAccumulator, run: Activity) => {
  accumulator.runCount += 1;
  accumulator.totalDistance += run.distance || 0;
  accumulator.totalElevationGain += run.elevation_gain || 0;

  if (run.average_speed) {
    accumulator.totalMetersForPace += run.distance || 0;
    accumulator.totalSecondsForPace += (run.distance || 0) / run.average_speed;
  }

  if (run.average_heartrate) {
    accumulator.averageHeartRateTotal += run.average_heartrate;
  } else {
    accumulator.heartRateNullCount += 1;
  }

  if (run.streak) {
    accumulator.streak = Math.max(accumulator.streak, run.streak);
  }
};

const finalizeYearStat = (accumulator: YearStatAccumulator): YearStatSummary => {
  const heartRateCount = accumulator.runCount - accumulator.heartRateNullCount;
  return {
    averageHeartRate: (accumulator.averageHeartRateTotal / heartRateCount).toFixed(0),
    averagePace: formatPace(accumulator.totalMetersForPace / accumulator.totalSecondsForPace),
    hasHeartRate: accumulator.averageHeartRateTotal !== 0,
    runCount: accumulator.runCount,
    streak: accumulator.streak,
    totalDistance: parseFloat((accumulator.totalDistance / M_TO_DIST).toFixed(1)),
    totalElevationGain: (accumulator.totalElevationGain * M_TO_ELEV).toFixed(0),
  };
};

const yearStatCache = new WeakMap<Activity[], Map<string, YearStatSummary>>();

const getYearStatSummaries = (activityData: Activity[]) => {
  const cachedSummaries = yearStatCache.get(activityData);
  if (cachedSummaries) return cachedSummaries;

  const accumulators = new Map<string, YearStatAccumulator>();
  accumulators.set('Total', createAccumulator());

  activityData.forEach((run) => {
    const year = run.start_date_local.slice(0, 4);
    if (!accumulators.has(year)) accumulators.set(year, createAccumulator());
    addRunToAccumulator(accumulators.get('Total')!, run);
    addRunToAccumulator(accumulators.get(year)!, run);
  });

  const summaries = new Map(
    Array.from(accumulators, ([year, accumulator]) => [year, finalizeYearStat(accumulator)])
  );
  yearStatCache.set(activityData, summaries);
  return summaries;
};

export { getYearStatSummaries };

interface StatCardProps {
  value: string | number;
  label: string;
}

const StatCard = ({ value, label }: StatCardProps) => (
  <div className="rounded-xl bg-neutral-900 px-3 py-3">
    <p className="text-lg font-bold leading-none text-[var(--color-brand)]">{value}</p>
    <p className="mt-1 text-xs opacity-50">{label}</p>
  </div>
);

const YearStat = ({
  year,
  onClick,
}: {
  year: string;
  onClick: (_year: string) => void;
}) => {
  const { activities } = useActivities();
  const summary = getYearStatSummaries(activities).get(year);

  if (!summary) return null;

  const stats = [
    { value: summary.runCount, label: 'Runs' },
    { value: `${summary.totalDistance} ${DIST_UNIT}`, label: 'Distance' },
    ...(SHOW_ELEVATION_GAIN ? [{ value: `${summary.totalElevationGain} ft`, label: 'Elev Gain' }] : []),
    { value: summary.averagePace, label: 'Avg Pace' },
    { value: `${summary.streak}d`, label: 'Streak' },
    ...(summary.hasHeartRate ? [{ value: summary.averageHeartRate, label: 'Avg BPM' }] : []),
  ];

  return (
    <div className="cursor-pointer" onClick={() => onClick(year)}>
      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold italic text-[var(--color-brand)]">{year}</span>
        <span className="text-xs opacity-40">Season</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {stats.map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} />
        ))}
      </div>
      <hr className="border-neutral-800 mb-4" />
    </div>
  );
};

export default YearStat;
