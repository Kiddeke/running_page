import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Dot,
} from 'recharts';
import useActivities from '@/hooks/useActivities';
import { M_TO_DIST, DIST_UNIT, Activity } from '@/utils/utils';

const pad = (n: number) => String(n).padStart(2, '0');

const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getWeekKey = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  const daysToMonday = (d.getDay() + 6) % 7;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - daysToMonday
  );
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
};

const getWeekLabel = (weekKey: string): string => {
  const d = parseLocalDate(weekKey);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const monthLabelForWeek = (weekKey: string): string => {
  const start = parseLocalDate(weekKey);
  for (let d = 0; d < 7; d++) {
    const day = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + d
    );
    if (day.getDate() === 1) {
      return day.toLocaleDateString('en-US', { month: 'short' });
    }
  }
  return '';
};

const getWeekRange = (weekKey: string): string => {
  const start = parseLocalDate(weekKey);
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6
  );
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
};

interface WeekStats {
  distance: number;
  seconds: number;
  elevationGain: number;
  runCount: number;
}

const computeWeekStats = (activities: Activity[], weekKey: string): WeekStats =>
  activities
    .filter((a) => getWeekKey(a.start_date_local) === weekKey)
    .reduce(
      (acc, a) => {
        const parts = a.moving_time
          .split(', ')
          .splice(-1)[0]
          .split(':')
          .map(Number);
        const secs = (parts[0] * 60 + parts[1]) * 60 + parts[2];
        return {
          distance: acc.distance + a.distance,
          seconds: acc.seconds + secs,
          elevationGain: acc.elevationGain + (a.elevation_gain ?? 0),
          runCount: acc.runCount + 1,
        };
      },
      { distance: 0, seconds: 0, elevationGain: 0, runCount: 0 }
    );

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

interface WeeklyChartProps {
  weeksBack?: number;
}

const WeeklyChart = ({ weeksBack = 12 }: WeeklyChartProps) => {
  const { activities } = useActivities();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const thisWeekKey = getWeekKey(todayStr);

  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(thisWeekKey);

  const { weeklyData, labelToKey } = useMemo(() => {
    const weekMap = new Map<string, number>();
    const keyMap = new Map<string, string>();

    for (let i = weeksBack - 1; i >= 0; i--) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - i * 7
      );
      const key = getWeekKey(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      );
      const label = getWeekLabel(key);
      weekMap.set(key, 0);
      keyMap.set(label, key);
    }

    activities.forEach((a) => {
      const key = getWeekKey(a.start_date_local);
      if (weekMap.has(key)) {
        weekMap.set(key, (weekMap.get(key) ?? 0) + a.distance / M_TO_DIST);
      }
    });

    const data = Array.from(weekMap.entries()).map(([key, dist]) => ({
      week: getWeekLabel(key),
      weekKey: key,
      distance: parseFloat(dist.toFixed(2)),
      isCurrentWeek: key === thisWeekKey,
      isSelected: key === selectedWeekKey,
    }));

    return { weeklyData: data, labelToKey: keyMap };
  }, [activities, weeksBack, selectedWeekKey]);

  const selectedStats = useMemo(
    () => computeWeekStats(activities, selectedWeekKey),
    [activities, selectedWeekKey]
  );

  const isThisWeek = selectedWeekKey === thisWeekKey;
  const headerLabel = isThisWeek ? 'This Week' : getWeekRange(selectedWeekKey);

  const handleChartClick = (data: { activeLabel?: string }) => {
    if (data?.activeLabel) {
      const key = labelToKey.get(data.activeLabel);
      if (key && key !== selectedWeekKey) {
        setSelectedWeekKey(key);
        navigator.vibrate?.(8);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Dynamic week summary */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p
          className="mb-3 text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {headerLabel}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p
              className="text-xl font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              {(selectedStats.distance / M_TO_DIST).toFixed(1)}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {DIST_UNIT}
            </p>
          </div>
          <div>
            <p
              className="text-xl font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              {formatTime(selectedStats.seconds)}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Time
            </p>
          </div>
          <div>
            <p
              className="text-xl font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              {Math.round(selectedStats.elevationGain * 3.28084)}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              ft Elev
            </p>
          </div>
        </div>
      </div>

      {/* Line chart */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p
          className="mb-1 text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Past {weeksBack} Weeks · tap a week
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart
            data={weeklyData}
            margin={{ top: 10, right: 4, left: 4, bottom: 0 }}
            onClick={handleChartClick}
            style={{ cursor: 'pointer' }}
          >
            <defs>
              <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-brand)"
                  stopOpacity={0.55}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-brand)"
                  stopOpacity={0.55}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="week"
              tick={({ x, y, payload }: any) => {
                const lbl = monthLabelForWeek(payload.value);
                if (!lbl) return <g />;
                return (
                  <text
                    x={x}
                    y={y + 10}
                    textAnchor="middle"
                    fill="var(--color-text-muted)"
                    fontSize={9}
                  >
                    {lbl}
                  </text>
                );
              }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip content={() => null} cursor={false} />
            {weeklyData.find((d) => d.isSelected) && (
              <ReferenceLine
                x={weeklyData.find((d) => d.isSelected)!.week}
                stroke="var(--color-text)"
                strokeWidth={2}
                strokeOpacity={0.6}
              />
            )}
            <Area
              type="linear"
              dataKey="distance"
              stroke="var(--color-brand)"
              strokeWidth={2}
              fill="url(#weeklyGrad)"
              dot={(props) => {
                const { cx, cy, payload } = props;
                const isSelected = payload.weekKey === selectedWeekKey;
                return (
                  <Dot
                    key={payload.week}
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 5 : 3}
                    fill={
                      isSelected
                        ? 'var(--color-text)'
                        : 'var(--color-background)'
                    }
                    stroke={
                      isSelected ? 'var(--color-text)' : 'var(--color-brand)'
                    }
                    strokeWidth={isSelected ? 0 : 1.5}
                  />
                );
              }}
              activeDot={{ r: 5, fill: 'var(--color-brand)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WeeklyChart;
