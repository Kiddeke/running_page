import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import useActivities from '@/hooks/useActivities';
import { M_TO_DIST, DIST_UNIT, Activity } from '@/utils/utils';

const getWeekKey = (dateStr: string): string => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
};

const getWeekLabel = (weekKey: string): string => {
  const d = new Date(weekKey);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface ThisWeekStats {
  distance: number;
  seconds: number;
  elevationGain: number;
  runCount: number;
}

const computeThisWeek = (activities: Activity[]): ThisWeekStats => {
  const thisWeek = getWeekKey(new Date().toISOString());
  return activities
    .filter((a) => getWeekKey(a.start_date_local) === thisWeek)
    .reduce(
      (acc, a) => {
        const parts = a.moving_time.split(', ').splice(-1)[0].split(':').map(Number);
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
};

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-neutral-800 px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-white">{label}</p>
      <p className="text-[var(--color-brand)]">
        {payload[0].value.toFixed(1)} {DIST_UNIT}
      </p>
    </div>
  );
};

interface WeeklyChartProps {
  weeksBack?: number;
}

const WeeklyChart = ({ weeksBack = 12 }: WeeklyChartProps) => {
  const { activities } = useActivities();

  const { weeklyData, thisWeek: tw } = useMemo(() => {
    const now = new Date();
    const thisWeekKey = getWeekKey(now.toISOString());

    const weekMap = new Map<string, number>();
    for (let i = weeksBack - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      const key = getWeekKey(d.toISOString());
      weekMap.set(key, 0);
    }

    activities.forEach((a) => {
      const key = getWeekKey(a.start_date_local);
      if (weekMap.has(key)) {
        weekMap.set(key, (weekMap.get(key) ?? 0) + a.distance / M_TO_DIST);
      }
    });

    const data = Array.from(weekMap.entries()).map(([key, dist]) => ({
      week: getWeekLabel(key),
      distance: parseFloat(dist.toFixed(1)),
      isCurrentWeek: key === thisWeekKey,
    }));

    return { weeklyData: data, thisWeek: computeThisWeek(activities) };
  }, [activities, weeksBack]);

  return (
    <div className="space-y-4">
      {/* This week summary */}
      <div className="rounded-xl bg-neutral-900 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-50">
          This Week
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-xl font-bold text-[var(--color-brand)]">
              {(tw.distance / M_TO_DIST).toFixed(1)}
            </p>
            <p className="text-xs opacity-50">{DIST_UNIT}</p>
          </div>
          <div>
            <p className="text-xl font-bold">{formatTime(tw.seconds)}</p>
            <p className="text-xs opacity-50">Time</p>
          </div>
          <div>
            <p className="text-xl font-bold">
              {Math.round(tw.elevationGain * 3.28084)}
            </p>
            <p className="text-xs opacity-50">ft Elev</p>
          </div>
        </div>
      </div>

      {/* 12-week bar chart */}
      <div className="rounded-xl bg-neutral-900 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-50">
          Past {weeksBack} Weeks
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={weeklyData} barCategoryGap="30%">
            <XAxis
              dataKey="week"
              tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="distance" radius={[3, 3, 0, 0]}>
              {weeklyData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.isCurrentWeek
                      ? 'var(--color-brand)'
                      : 'rgba(255,255,255,0.15)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WeeklyChart;
