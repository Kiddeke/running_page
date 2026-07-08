import { useState, useMemo, useCallback } from 'react';
import {
  sortDateFunc,
  sortDateFuncReverse,
  convertMovingTime2Sec,
  Activity,
  RunIds,
  DIST_UNIT,
} from '@/utils/utils';
import { SHOW_ELEVATION_GAIN } from '@/utils/const';

import RunRow from './RunRow';

interface IRunTableProperties {
  runs: Activity[];
  locateActivity: (_runIds: RunIds) => void;
  runIndex: number;
  setRunIndex: (_index: number) => void;
}

type SortFunc = (_a: Activity, _b: Activity) => number;
type SortDirection = 'ascending' | 'descending';

interface SortState {
  direction: SortDirection;
  key: string;
}

const RunTable = ({
  runs,
  locateActivity,
  runIndex,
  setRunIndex,
}: IRunTableProperties) => {
  const [sortState, setSortState] = useState<SortState | null>(null);

  const sortKeys = useMemo(() => {
    const keys = [DIST_UNIT, 'Elev', 'Pace', 'BPM', 'Time', 'Date'];
    return SHOW_ELEVATION_GAIN ? keys : keys.filter((key) => key !== 'Elev');
  }, []);

  const getSortFunction = useCallback(
    (key: string, direction: SortDirection): SortFunc | undefined => {
      const multiplier = direction === 'ascending' ? 1 : -1;
      if (key === DIST_UNIT) return (a, b) => (a.distance - b.distance) * multiplier;
      if (key === 'Elev') return (a, b) => ((a.elevation_gain ?? 0) - (b.elevation_gain ?? 0)) * multiplier;
      if (key === 'Pace') return (a, b) => (a.average_speed - b.average_speed) * multiplier;
      if (key === 'BPM') return (a, b) => ((a.average_heartrate ?? 0) - (b.average_heartrate ?? 0)) * multiplier;
      if (key === 'Time') return (a, b) => (convertMovingTime2Sec(a.moving_time) - convertMovingTime2Sec(b.moving_time)) * multiplier;
      if (key === 'Date') return direction === 'ascending' ? sortDateFuncReverse : sortDateFunc;
      return undefined;
    },
    []
  );

  const displayedRuns = useMemo(() => {
    if (!sortState) return runs;
    const sortFunction = getSortFunction(sortState.key, sortState.direction);
    return sortFunction ? runs.slice().sort(sortFunction) : runs;
  }, [getSortFunction, runs, sortState]);

  const runIndexById = useMemo(
    () => new Map(runs.map((run, index) => [run.run_id, index])),
    [runs]
  );

  const handleSort = useCallback(
    (key: string) => {
      setRunIndex(-1);
      setSortState((currentState) => {
        const initialDirection = key === 'Date' ? 'ascending' : 'descending';
        const nextDirection =
          currentState?.key === key && currentState.direction === 'descending'
            ? 'ascending'
            : initialDirection;
        return { key, direction: nextDirection };
      });
    },
    [setRunIndex]
  );

  return (
    <div className="mt-4 space-y-2">
      {/* Sort controls */}
      <div className="flex flex-wrap gap-1.5 pb-2">
        {sortKeys.map((k) => (
          <button
            key={k}
            onClick={() => handleSort(k)}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
            style={
              sortState?.key === k
                ? { backgroundColor: 'var(--color-brand)', color: 'var(--color-background)' }
                : { backgroundColor: 'var(--color-card-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
            }
          >
            {k}
            {sortState?.key === k && (
              <span className="ml-1">{sortState.direction === 'descending' ? '↓' : '↑'}</span>
            )}
          </button>
        ))}
      </div>

      {/* Activity cards */}
      <div className="space-y-2 pb-8">
        {displayedRuns.map((run) => {
          const sourceIndex = runIndexById.get(run.run_id) ?? -1;
          return (
            <RunRow
              key={run.run_id}
              elementIndex={sourceIndex}
              locateActivity={locateActivity}
              run={run}
              runIndex={runIndex}
              setRunIndex={setRunIndex}
            />
          );
        })}
      </div>
    </div>
  );
};

export default RunTable;
