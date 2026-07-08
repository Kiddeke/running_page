import { lazy, Suspense, useMemo, useState } from 'react';
import useActivities from '@/hooks/useActivities';
import {
  Activity,
  DIST_UNIT,
  ELEV_UNIT,
  M_TO_DIST,
  M_TO_ELEV,
  formatPace,
  titleForRun,
  sortDateFunc,
  convertMovingTime2Sec,
} from '@/utils/utils';
import { SHOW_ELEVATION_GAIN } from '@/utils/const';

const RoutePreview = lazy(() => import('@/components/RoutePreview'));

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDuration = (movingTime: string): string => {
  const totalSeconds = convertMovingTime2Sec(movingTime);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p
      className="text-xs font-semibold tracking-wide uppercase"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {label}
    </p>
    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
      {value}
    </p>
  </div>
);

interface ActivityRowProps {
  activity: Activity;
  expanded: boolean;
  onToggle: () => void;
}

const ActivityRow = ({ activity, expanded, onToggle }: ActivityRowProps) => {
  const distance = (activity.distance / M_TO_DIST).toFixed(2);
  const pace = activity.average_speed
    ? formatPace(activity.average_speed)
    : null;
  const duration = formatDuration(activity.moving_time);
  const elevation = activity.elevation_gain
    ? (activity.elevation_gain * M_TO_ELEV).toFixed(0)
    : null;
  const heartRate = activity.average_heartrate
    ? activity.average_heartrate.toFixed(0)
    : null;

  return (
    <div
      className="rounded-xl transition-colors"
      style={{
        backgroundColor: 'var(--color-card)',
        border: expanded
          ? '1px solid var(--color-brand)'
          : '1px solid var(--color-border)',
      }}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            {titleForRun(activity)}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {formatDate(activity.start_date_local)}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-3 text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span>
            <span
              className="font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              {distance}
            </span>{' '}
            {DIST_UNIT}
          </span>
          <span
            className="inline-block text-base transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          >
            ▾
          </span>
        </div>
      </button>

      {expanded && (
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Distance" value={`${distance} ${DIST_UNIT}`} />
            <Stat
              label="Avg Pace"
              value={pace ? `${pace}/${DIST_UNIT}` : '—'}
            />
            <Stat label="Moving Time" value={duration} />
            {SHOW_ELEVATION_GAIN && (
              <Stat
                label="Elevation Gain"
                value={elevation ? `${elevation} ${ELEV_UNIT}` : '—'}
              />
            )}
            <Stat
              label="Avg Heart Rate"
              value={heartRate ? `${heartRate} bpm` : '—'}
            />
          </div>
          <Suspense fallback={null}>
            <RoutePreview
              activities={[activity]}
              height={340}
              className="mx-auto"
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};

const ActivitiesTab = () => {
  const { activities } = useActivities();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const sortedActivities = useMemo(
    () => activities.slice().sort(sortDateFunc),
    [activities]
  );

  const toggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(sortedActivities.map((activity) => activity.run_id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  if (sortedActivities.length === 0) {
    return (
      <div
        className="p-8 text-center"
        style={{ color: 'var(--color-text-muted)' }}
      >
        No activities yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-12">
      <div className="mb-1 flex justify-end gap-2">
        <button
          onClick={expandAll}
          className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
          style={{
            backgroundColor: 'var(--color-card-2)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
          style={{
            backgroundColor: 'var(--color-card-2)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
        >
          Collapse All
        </button>
      </div>
      {sortedActivities.map((activity) => (
        <ActivityRow
          key={activity.run_id}
          activity={activity}
          expanded={expandedIds.has(activity.run_id)}
          onToggle={() => toggle(activity.run_id)}
        />
      ))}
    </div>
  );
};

export default ActivitiesTab;
