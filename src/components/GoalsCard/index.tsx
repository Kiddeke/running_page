import { useEffect, useMemo, useState } from 'react';
import useActivities from '@/hooks/useActivities';
import { M_TO_DIST, DIST_UNIT } from '@/utils/utils';

const pad = (n: number) => String(n).padStart(2, '0');

const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getWeekKey = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  const daysToMonday = (d.getDay() + 6) % 7;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - daysToMonday
  );
  return toDateStr(monday);
};

type GoalMode = 'same' | 'percent' | 'custom';

interface GoalSettings {
  mode: GoalMode;
  percent: number;
  customDistance: number;
}

const STORAGE_KEY = 'weekly_goal_v1';

const DEFAULT_SETTINGS: GoalSettings = {
  mode: 'percent',
  percent: 10,
  customDistance: 20,
};

const loadSettings = (): GoalSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const PERCENT_OPTIONS = [5, 10, 15, 20, 25];

const GoalsCard = () => {
  const { activities } = useActivities();
  const [settings, setSettings] = useState<GoalSettings>(loadSettings);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const thisWeekKey = useMemo(() => getWeekKey(toDateStr(new Date())), []);
  const lastWeekKey = useMemo(() => {
    const start = parseLocalDate(thisWeekKey);
    return toDateStr(
      new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7)
    );
  }, [thisWeekKey]);

  const { thisWeekDist, lastWeekDist } = useMemo(() => {
    let thisWeekDist = 0;
    let lastWeekDist = 0;
    activities.forEach((a) => {
      const wk = getWeekKey(a.start_date_local);
      if (wk === thisWeekKey) thisWeekDist += a.distance / M_TO_DIST;
      else if (wk === lastWeekKey) lastWeekDist += a.distance / M_TO_DIST;
    });
    return { thisWeekDist, lastWeekDist };
  }, [activities, thisWeekKey, lastWeekKey]);

  const target =
    settings.mode === 'same'
      ? lastWeekDist
      : settings.mode === 'percent'
        ? lastWeekDist * (1 + settings.percent / 100)
        : settings.customDistance;

  const progress = target > 0 ? Math.min(1, thisWeekDist / target) : 0;
  const remaining = Math.max(0, target - thisWeekDist);
  const hit = target > 0 && thisWeekDist >= target;

  const pillStyle = (active: boolean) => ({
    backgroundColor: active ? 'var(--color-brand)' : 'var(--color-card-2)',
    color: active ? 'var(--color-background)' : 'var(--color-text-muted)',
    border: active ? 'none' : '1px solid var(--color-border)',
  });

  return (
    <div
      className="mt-6 rounded-xl p-4"
      style={{
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Goal
        </p>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold"
          style={{ color: 'var(--color-brand)' }}
        >
          {expanded ? 'Done' : 'Edit'}
        </button>
      </div>

      {!expanded ? (
        <>
          <div className="mb-2 flex items-baseline gap-2">
            <span
              className="text-2xl font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              {thisWeekDist.toFixed(1)}
            </span>
            <span
              className="text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              / {target.toFixed(1)} {DIST_UNIT}
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--color-card-2)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: hit ? '#00c853' : 'var(--color-brand)',
              }}
            />
          </div>
          <p
            className="mt-2 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {target <= 0
              ? 'Set a goal to track this week'
              : hit
                ? 'Goal hit — nice work! 🎉'
                : `${remaining.toFixed(1)} ${DIST_UNIT} to go`}
          </p>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSettings((s) => ({ ...s, mode: 'same' }))}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={pillStyle(settings.mode === 'same')}
            >
              Same as last week
            </button>
            <button
              onClick={() => setSettings((s) => ({ ...s, mode: 'percent' }))}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={pillStyle(settings.mode === 'percent')}
            >
              % higher than last week
            </button>
            <button
              onClick={() => setSettings((s) => ({ ...s, mode: 'custom' }))}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={pillStyle(settings.mode === 'custom')}
            >
              Custom
            </button>
          </div>

          {settings.mode === 'percent' && (
            <div className="flex flex-wrap items-center gap-2">
              {PERCENT_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setSettings((s) => ({ ...s, percent: p }))}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={pillStyle(settings.percent === p)}
                >
                  +{p}%
                </button>
              ))}
              <p
                className="w-full text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {lastWeekDist > 0
                  ? `Last week: ${lastWeekDist.toFixed(1)} ${DIST_UNIT} → goal ${(lastWeekDist * (1 + settings.percent / 100)).toFixed(1)} ${DIST_UNIT}`
                  : 'No runs logged last week yet — goal will be 0 until then'}
              </p>
            </div>
          )}

          {settings.mode === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.5}
                value={settings.customDistance}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    customDistance: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-24 rounded-lg px-3 py-1.5 text-sm"
                style={{
                  backgroundColor: 'var(--color-card-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
              <span
                className="text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {DIST_UNIT} this week
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GoalsCard;
