import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import MassCalendar from '@/components/MassCalendar';

// ── Types ────────────────────────────────────────────────────────────────────

export type FaithType =
  'mass' | 'confession' | 'prayer' | 'almsgiving' | 'fasting';

export interface FaithActivity {
  id: string;
  type: FaithType;
  date: string; // YYYY-MM-DD
  notes?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FAITH_TYPES: { key: FaithType; label: string; emoji: string }[] = [
  { key: 'mass', label: 'Mass', emoji: '✝️' },
  { key: 'confession', label: 'Confession', emoji: '🙏' },
  { key: 'prayer', label: 'Prayer', emoji: '📿' },
  { key: 'almsgiving', label: 'Almsgiving', emoji: '🤲' },
  { key: 'fasting', label: 'Fasting', emoji: '🌿' },
];

const TYPE_COLORS: Record<FaithType, string> = {
  mass: '#f5a623',
  confession: '#7b61ff',
  prayer: '#00d4ff',
  almsgiving: '#00c853',
  fasting: '#ff6b6b',
};

const STORAGE_KEY = 'faith_activities_v1';

// ── Storage helpers ───────────────────────────────────────────────────────────

const loadActivities = (): FaithActivity[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const saveActivities = (acts: FaithActivity[]) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(acts));

// ── Date helpers ──────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getWeekKey = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  const daysToMonday = (d.getDay() + 6) % 7;
  const mon = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - daysToMonday
  );
  return `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
};

const formatWeekLabel = (key: string): string => {
  const d = parseLocalDate(key);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDisplayDate = (dateStr: string): string =>
  parseLocalDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

// ── Log modal ─────────────────────────────────────────────────────────────────

interface LogModalProps {
  onSave: (act: Omit<FaithActivity, 'id'>) => void;
  onClose: () => void;
}

const LogModal = ({ onSave, onClose }: LogModalProps) => {
  const [type, setType] = useState<FaithType>('mass');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    onSave({ type, date, notes: notes.trim() || undefined });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 pb-8"
        style={{
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2
            className="text-base font-bold"
            style={{ color: 'var(--color-text)' }}
          >
            Log Activity
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Type picker */}
        <div className="mb-5 flex flex-wrap gap-2">
          {FAITH_TYPES.map(({ key, label, emoji }) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className="rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
              style={
                type === key
                  ? { backgroundColor: TYPE_COLORS[key], color: '#000' }
                  : {
                      backgroundColor: 'var(--color-card-2)',
                      color: 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)',
                    }
              }
            >
              {emoji} {label}
            </button>
          ))}
        </div>

        {/* Date picker */}
        <label
          className="mb-1 block text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-4 w-full rounded-xl px-4 py-2.5 text-sm"
          style={{
            backgroundColor: 'var(--color-card-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            colorScheme: 'dark',
          }}
        />

        {/* Notes */}
        <label
          className="mb-1 block text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className="mb-5 w-full resize-none rounded-xl px-4 py-2.5 text-sm"
          style={{
            backgroundColor: 'var(--color-card-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />

        <button
          onClick={handleSave}
          className="w-full rounded-full py-3 text-sm font-bold"
          style={{
            backgroundColor: 'var(--color-brand)',
            color: 'var(--color-background)',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
};

// ── Activity card ─────────────────────────────────────────────────────────────

interface CardProps {
  act: FaithActivity;
  onDelete: (id: string) => void;
}

const FaithCard = ({ act, onDelete }: CardProps) => {
  const info = FAITH_TYPES.find((t) => t.key === act.type)!;
  const color = TYPE_COLORS[act.type];
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{
          backgroundColor: color + '22',
          border: `1px solid ${color}44`,
        }}
      >
        {info.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          {info.label}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {formatDisplayDate(act.date)}
        </p>
        {act.notes && (
          <p
            className="mt-0.5 truncate text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {act.notes}
          </p>
        )}
      </div>
      <div
        className="h-6 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <button
        onClick={() => onDelete(act.id)}
        className="ml-1 shrink-0 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        ✕
      </button>
    </div>
  );
};

// ── Chart tooltip ─────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }}>
          {FAITH_TYPES.find((t) => t.key === p.dataKey)?.label ?? p.dataKey}:{' '}
          {p.value}
        </p>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const FaithTab = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<FaithActivity[]>(loadActivities);
  const [filter, setFilter] = useState<FaithType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  useEffect(() => {
    saveActivities(activities);
  }, [activities]);

  const addActivity = useCallback((act: Omit<FaithActivity, 'id'>) => {
    const newAct: FaithActivity = {
      ...act,
      id: `${Date.now()}-${Math.random()}`,
    };
    setActivities((prev) =>
      [newAct, ...prev].sort((a, b) => b.date.localeCompare(a.date))
    );
  }, []);

  const deleteActivity = useCallback((id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Build 12-week chart data
  const chartData = useMemo(() => {
    const today = new Date();
    const weeks: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - today.getDay() + 1 - i * 7
      );
      weeks.push(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      );
    }
    return weeks.map((wk) => {
      const row: Record<string, any> = { week: wk, label: formatWeekLabel(wk) };
      FAITH_TYPES.forEach(({ key }) => {
        row[key] = 0;
      });
      activities.forEach((a) => {
        if (getWeekKey(a.date) === wk) row[a.type] = (row[a.type] ?? 0) + 1;
      });
      return row;
    });
  }, [activities]);

  // Filtered + week-scoped activity list
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      const typeOk = filter === 'all' || a.type === filter;
      const weekOk = !selectedWeek || getWeekKey(a.date) === selectedWeek;
      return typeOk && weekOk;
    });
  }, [activities, filter, selectedWeek]);

  // Summary counts for selected week (or all time if none)
  const summary = useMemo(() => {
    const src = selectedWeek
      ? activities.filter((a) => getWeekKey(a.date) === selectedWeek)
      : activities;
    return Object.fromEntries(
      FAITH_TYPES.map(({ key }) => [
        key,
        src.filter((a) => a.type === key).length,
      ])
    ) as Record<FaithType, number>;
  }, [activities, selectedWeek]);

  const visibleTypes =
    filter === 'all' ? FAITH_TYPES.map((t) => t.key) : [filter];

  const handleBarClick = (data: any) => {
    if (!data?.activePayload) return;
    const wk = data.activePayload[0]?.payload?.week;
    if (!wk) return;
    navigator.vibrate?.(8);
    setSelectedWeek((prev) => (prev === wk ? null : wk));
  };

  return (
    <div className="w-full pb-12">
      {/* Mass calendar */}
      <div className="mb-5">
        <MassCalendar />
      </div>

      {/* Summary stat strip */}
      <div
        className="mb-5 rounded-2xl p-4"
        style={{
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p
          className="mb-3 text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {selectedWeek
            ? `Week of ${formatWeekLabel(selectedWeek)}`
            : 'All Time'}
        </p>
        <div className="flex flex-wrap gap-3">
          {FAITH_TYPES.map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[key] }}
              />
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--color-text)' }}
              >
                {summary[key]}
              </span>
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        className="mb-5 rounded-2xl p-4"
        style={{
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p
          className="mb-4 text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          12-Week Activity
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart
            data={chartData}
            onClick={handleBarClick}
            style={{ cursor: 'pointer' }}
          >
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} />
            {selectedWeek && (
              <ReferenceLine
                x={formatWeekLabel(selectedWeek)}
                stroke="rgba(255,255,255,0.6)"
                strokeWidth={2}
              />
            )}
            {FAITH_TYPES.filter((t) => visibleTypes.includes(t.key)).map(
              ({ key }) => (
                <Area
                  key={key}
                  type="linear"
                  dataKey={key}
                  stroke={TYPE_COLORS[key]}
                  strokeWidth={2}
                  fill={TYPE_COLORS[key]}
                  fillOpacity={0.2}
                  stackId="a"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Filter pills + Log button */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={
            filter === 'all'
              ? {
                  backgroundColor: 'var(--color-brand)',
                  color: 'var(--color-background)',
                }
              : {
                  backgroundColor: 'var(--color-card-2)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }
          }
        >
          All
        </button>
        {FAITH_TYPES.map(({ key, label, emoji }) => (
          <button
            key={key}
            onClick={() => setFilter((prev) => (prev === key ? 'all' : key))}
            className="rounded-full px-3 py-1.5 text-xs font-semibold"
            style={
              filter === key
                ? { backgroundColor: TYPE_COLORS[key], color: '#000' }
                : {
                    backgroundColor: 'var(--color-card-2)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                  }
            }
          >
            {emoji} {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 rounded-full px-4 py-1.5 text-xs font-bold"
          style={{
            backgroundColor: 'var(--color-brand)',
            color: 'var(--color-background)',
          }}
        >
          + Log
        </button>
      </div>

      {selectedWeek && (
        <button
          onClick={() => setSelectedWeek(null)}
          className="mb-3 text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Clear week filter
        </button>
      )}

      {/* Activity list */}
      <div className="space-y-2">
        {filteredActivities.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No activities logged yet.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-sm font-semibold"
              style={{ color: 'var(--color-brand)' }}
            >
              Log your first one →
            </button>
          </div>
        ) : (
          filteredActivities.map((a) => (
            <FaithCard key={a.id} act={a} onDelete={deleteActivity} />
          ))
        )}
      </div>

      {showModal && (
        <LogModal onSave={addActivity} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

export default FaithTab;
