import {
  formatPace,
  titleForRun,
  formatRunTime,
  Activity,
  RunIds,
  M_TO_DIST,
  M_TO_ELEV,
  DIST_UNIT,
  ELEV_UNIT,
} from '@/utils/utils';
import { SHOW_ELEVATION_GAIN } from '@/utils/const';

interface IRunRowProperties {
  elementIndex: number;
  locateActivity: (_runIds: RunIds) => void;
  run: Activity;
  runIndex: number;
  setRunIndex: (_ndex: number) => void;
}

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const RunRow = ({
  elementIndex,
  locateActivity,
  run,
  runIndex,
  setRunIndex,
}: IRunRowProperties) => {
  const distance = (run.distance / M_TO_DIST).toFixed(2);
  const pace = run.average_speed ? formatPace(run.average_speed) : null;
  const time = formatRunTime(run.moving_time);
  const elev = run.elevation_gain
    ? (run.elevation_gain * M_TO_ELEV).toFixed(0)
    : null;
  const isSelected = runIndex === elementIndex;

  const handleClick = () => {
    if (isSelected) {
      setRunIndex(-1);
      locateActivity([]);
      return;
    }
    setRunIndex(elementIndex);
    locateActivity([run.run_id]);
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer rounded-xl px-4 py-3 transition-colors"
      style={{
        backgroundColor: isSelected ? 'var(--color-card)' : 'var(--color-card)',
        border: isSelected
          ? '1px solid var(--color-brand)'
          : '1px solid var(--color-border)',
      }}
    >
      {/* Title + date */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <p
          className="text-sm leading-snug font-semibold"
          style={{
            color: isSelected ? 'var(--color-brand)' : 'var(--color-text)',
          }}
        >
          {titleForRun(run)}
        </p>
        <p
          className="shrink-0 text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {formatDate(run.start_date_local)}
        </p>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs">
        <div>
          <span className="font-bold" style={{ color: 'var(--color-text)' }}>
            {distance}
          </span>
          <span className="ml-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {DIST_UNIT}
          </span>
        </div>
        {pace && (
          <div>
            <span className="font-bold" style={{ color: 'var(--color-text)' }}>
              {pace}
            </span>
            <span
              className="ml-0.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              /mi
            </span>
          </div>
        )}
        <div>
          <span className="font-bold" style={{ color: 'var(--color-text)' }}>
            {time}
          </span>
          <span className="ml-0.5" style={{ color: 'var(--color-text-muted)' }}>
            time
          </span>
        </div>
        {SHOW_ELEVATION_GAIN && elev && (
          <div>
            <span className="font-bold" style={{ color: 'var(--color-text)' }}>
              {elev}
            </span>
            <span
              className="ml-0.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {ELEV_UNIT}
            </span>
          </div>
        )}
        {run.average_heartrate && (
          <div>
            <span className="font-bold" style={{ color: 'var(--color-text)' }}>
              {run.average_heartrate.toFixed(0)}
            </span>
            <span
              className="ml-0.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              bpm
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RunRow;
