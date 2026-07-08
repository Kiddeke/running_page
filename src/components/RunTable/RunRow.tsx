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
  const elev = run.elevation_gain ? (run.elevation_gain * M_TO_ELEV).toFixed(0) : null;
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
      className={`cursor-pointer rounded-xl border px-4 py-3 transition-colors ${
        isSelected
          ? 'border-[var(--color-brand)] bg-neutral-900'
          : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700 hover:bg-neutral-900'
      }`}
    >
      {/* Title + date */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={`font-semibold text-sm leading-snug ${isSelected ? 'text-[var(--color-brand)]' : ''}`}>
          {titleForRun(run)}
        </p>
        <p className="shrink-0 text-xs opacity-40">{formatDate(run.start_date_local)}</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs">
        <div>
          <span className="font-bold">{distance}</span>
          <span className="ml-0.5 opacity-40">{DIST_UNIT}</span>
        </div>
        {pace && (
          <div>
            <span className="font-bold">{pace}</span>
            <span className="ml-0.5 opacity-40">/mi</span>
          </div>
        )}
        <div>
          <span className="font-bold">{time}</span>
          <span className="ml-0.5 opacity-40">time</span>
        </div>
        {SHOW_ELEVATION_GAIN && elev && (
          <div>
            <span className="font-bold">{elev}</span>
            <span className="ml-0.5 opacity-40">{ELEV_UNIT}</span>
          </div>
        )}
        {run.average_heartrate && (
          <div>
            <span className="font-bold">{run.average_heartrate.toFixed(0)}</span>
            <span className="ml-0.5 opacity-40">bpm</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RunRow;
