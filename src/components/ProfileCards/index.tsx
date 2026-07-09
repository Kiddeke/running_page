import { useMemo, useState, type ReactNode } from 'react';
import useActivities from '@/hooks/useActivities';
import {
  M_TO_DIST,
  DIST_UNIT,
  M_TO_ELEV,
  ELEV_UNIT,
  formatPace,
  convertMovingTime2Sec,
  Activity,
} from '@/utils/utils';

const pad = (n: number) => String(n).padStart(2, '0');

const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const getWeekKey = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  const daysToMonday = (d.getDay() + 6) % 7;
  return toDateStr(addDays(d, -daysToMonday));
};

const dayLabel = (ds: string) =>
  parseLocalDate(ds).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

// All-time records need the year to be meaningful
const recordDate = (ds: string) =>
  parseLocalDate(ds).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const hourLabel = (h: number) => {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${period}`;
};

interface DayEntry {
  date: string;
  miles: number;
}

interface CardStats {
  currentDayStreak: number;
  longestDayStreak: number;
  currentWeekStreak: number;
  longestWeekStreak: number;
  last7: DayEntry[];
  last14: DayEntry[];
}

const PopModal = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
    style={{
      backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
    }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl p-6 pb-8"
      style={{
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="text-base font-bold"
          style={{ color: 'var(--color-text)' }}
        >
          {title}
        </h2>
        <button
          onClick={onClose}
          className="text-lg leading-none"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

const statTile = {
  backgroundColor: 'var(--color-card-2)',
  border: '1px solid var(--color-border)',
};

const DetailTile = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) => (
  <div className="rounded-xl p-4" style={statTile}>
    <p
      className="mb-1 text-xs font-semibold tracking-widest uppercase"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {label}
    </p>
    <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
      {value}
    </p>
    {sub && (
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {sub}
      </p>
    )}
  </div>
);

const BarRow = ({
  label,
  frac,
  right,
  dim,
}: {
  label: string;
  frac: number;
  right: string;
  dim?: boolean;
}) => (
  <div className="flex items-center gap-3">
    <span
      className="w-24 shrink-0 text-xs"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {label}
    </span>
    <div
      className="h-2 flex-1 overflow-hidden rounded-full"
      style={{ backgroundColor: 'var(--color-card-2)' }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(100, frac * 100)}%`,
          backgroundColor: 'var(--color-brand)',
        }}
      />
    </div>
    <span
      className="w-16 shrink-0 text-right text-xs font-semibold"
      style={{
        color: dim ? 'var(--color-text-muted)' : 'var(--color-text)',
      }}
    >
      {right}
    </span>
  </div>
);

const FunRow = ({
  emoji,
  value,
  label,
}: {
  emoji: string;
  value: string;
  label: string;
}) => (
  <div className="flex items-center gap-3">
    <span className="text-xl">{emoji}</span>
    <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
      {value}
    </span>
    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
      {label}
    </span>
  </div>
);

const MetricCard = ({
  label,
  value,
  unit,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="rounded-xl p-4 text-left"
    style={{
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
    }}
  >
    <p
      className="mb-1 text-xs font-semibold tracking-widest uppercase"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {label}
    </p>
    <p
      className="text-xl leading-tight font-bold"
      style={{ color: 'var(--color-text)' }}
    >
      {value}
      {unit && (
        <span
          className="text-xs font-normal"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {' '}
          {unit}
        </span>
      )}
    </p>
    {sub && (
      <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {sub}
      </p>
    )}
  </button>
);

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LETTERS = 'JFMAMJJASOND'.split('');

const ProfileCards = () => {
  const { activities } = useActivities();
  const [modal, setModal] = useState<string | null>(null);

  const stats: CardStats = useMemo(() => {
    const dayMiles = new Map<string, number>();
    activities.forEach((a) => {
      const day = a.start_date_local.slice(0, 10);
      dayMiles.set(day, (dayMiles.get(day) ?? 0) + a.distance / M_TO_DIST);
    });

    const sortedDays = [...dayMiles.keys()].sort();
    let longestDayStreak = 0;
    let run = 0;
    let prev: string | null = null;
    sortedDays.forEach((ds) => {
      run =
        prev && toDateStr(addDays(parseLocalDate(prev), 1)) === ds
          ? run + 1
          : 1;
      prev = ds;
      if (run > longestDayStreak) longestDayStreak = run;
    });

    const today = new Date();
    // A streak survives until a full day is missed, so start counting from
    // today if it has a run, otherwise from yesterday.
    let cursor = dayMiles.has(toDateStr(today)) ? today : addDays(today, -1);
    let currentDayStreak = 0;
    while (dayMiles.has(toDateStr(cursor))) {
      currentDayStreak += 1;
      cursor = addDays(cursor, -1);
    }

    const weekSet = new Set(sortedDays.map(getWeekKey));
    const sortedWeeks = [...weekSet].sort();
    let longestWeekStreak = 0;
    run = 0;
    let prevWeek: string | null = null;
    sortedWeeks.forEach((wk) => {
      run =
        prevWeek && toDateStr(addDays(parseLocalDate(prevWeek), 7)) === wk
          ? run + 1
          : 1;
      prevWeek = wk;
      if (run > longestWeekStreak) longestWeekStreak = run;
    });

    const thisWeek = getWeekKey(toDateStr(today));
    let weekCursor = weekSet.has(thisWeek)
      ? thisWeek
      : toDateStr(addDays(parseLocalDate(thisWeek), -7));
    let currentWeekStreak = 0;
    while (weekSet.has(weekCursor)) {
      currentWeekStreak += 1;
      weekCursor = toDateStr(addDays(parseLocalDate(weekCursor), -7));
    }

    const last7: DayEntry[] = [];
    for (let i = 6; i >= 0; i--) {
      const ds = toDateStr(addDays(today, -i));
      last7.push({ date: ds, miles: dayMiles.get(ds) ?? 0 });
    }
    const last14: DayEntry[] = [];
    for (let i = 0; i < 14; i++) {
      const ds = toDateStr(addDays(today, -i));
      last14.push({ date: ds, miles: dayMiles.get(ds) ?? 0 });
    }

    return {
      currentDayStreak,
      longestDayStreak,
      currentWeekStreak,
      longestWeekStreak,
      last7,
      last14,
    };
  }, [activities]);

  const metrics = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${pad(lastMonth.getMonth() + 1)}`;
    const yearKey = `${now.getFullYear()}`;
    const lastYearKey = `${now.getFullYear() - 1}`;

    let monthDist = 0;
    let monthRuns = 0;
    let monthElev = 0;
    let lastMonthDist = 0;
    let yearDist = 0;
    let yearRuns = 0;
    let yearElev = 0;
    let lastYearDist = 0;
    const yearMonths = new Array(12).fill(0) as number[];
    let totalMeters = 0;
    let totalRuns = 0;
    let totalSeconds = 0;
    let totalElevM = 0;
    const weekdayRuns = new Array(7).fill(0) as number[];
    const weekdayDist = new Array(7).fill(0) as number[];
    const hourRuns = new Array(24).fill(0) as number[];
    const dayDist = new Map<string, number>();
    let longest: Activity | null = null;

    activities.forEach((a) => {
      const dist = a.distance / M_TO_DIST;
      const day = a.start_date_local.slice(0, 10);
      dayDist.set(day, (dayDist.get(day) ?? 0) + dist);
      totalMeters += a.distance;
      totalRuns += 1;
      totalSeconds += convertMovingTime2Sec(a.moving_time);
      totalElevM += a.elevation_gain ?? 0;

      // getDay(): 0=Sun; shift so 0=Mon to match the display order
      const wd = (parseLocalDate(day).getDay() + 6) % 7;
      weekdayRuns[wd] += 1;
      weekdayDist[wd] += dist;
      const hour = Number(a.start_date_local.slice(11, 13));
      if (!Number.isNaN(hour)) hourRuns[hour] += 1;

      if (a.start_date_local.slice(0, 7) === monthKey) {
        monthDist += dist;
        monthRuns += 1;
        monthElev += (a.elevation_gain ?? 0) * M_TO_ELEV;
      }
      if (a.start_date_local.slice(0, 7) === lastMonthKey) {
        lastMonthDist += dist;
      }
      if (a.start_date_local.slice(0, 4) === yearKey) {
        yearDist += dist;
        yearRuns += 1;
        yearElev += (a.elevation_gain ?? 0) * M_TO_ELEV;
        yearMonths[Number(a.start_date_local.slice(5, 7)) - 1] += dist;
      }
      if (a.start_date_local.slice(0, 4) === lastYearKey) {
        lastYearDist += dist;
      }
      if (!longest || a.distance > longest.distance) longest = a;
    });

    // Eddington number: the largest E such that you've covered at least
    // E distance-units on at least E separate days.
    const dayVals = [...dayDist.values()].sort((a, b) => b - a);
    let eddington = 0;
    for (let i = 0; i < dayVals.length; i++) {
      if (dayVals[i] >= i + 1) eddington = i + 1;
      else break;
    }
    const eddingtonNext = eddington + 1;
    const daysAtNext = dayVals.filter((v) => v >= eddingtonNext).length;
    const daysNeeded = eddingtonNext - daysAtNext;

    // Ignore sub-unit-distance runs for best pace — short GPS blips
    // produce absurd paces.
    const paceable = activities.filter(
      (a) => a.distance / M_TO_DIST >= 1 && a.average_speed > 0
    );
    const topFastest = [...paceable]
      .sort((a, b) => b.average_speed - a.average_speed)
      .slice(0, 5);
    const topLongest = [...activities]
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 5);
    const monthRunList = activities
      .filter((a) => a.start_date_local.slice(0, 7) === monthKey)
      .sort((a, b) => (a.start_date_local < b.start_date_local ? 1 : -1));

    let favoriteWeekday = 0;
    weekdayRuns.forEach((n, i) => {
      if (n > weekdayRuns[favoriteWeekday]) favoriteWeekday = i;
    });
    let favoriteHour = 0;
    hourRuns.forEach((n, h) => {
      if (n > hourRuns[favoriteHour]) favoriteHour = h;
    });

    return {
      monthDist,
      monthRuns,
      monthElev,
      lastMonthDist,
      yearDist,
      yearRuns,
      yearElev,
      lastYearDist,
      yearMonths,
      totalMeters,
      totalRuns,
      totalSeconds,
      totalElevM,
      weekdayRuns,
      weekdayDist,
      hourRuns,
      eddington,
      eddingtonNext,
      daysAtNext,
      daysNeeded,
      topFastest,
      topLongest,
      monthRunList,
      favoriteWeekday,
      favoriteHour,
      longest: longest as Activity | null,
      fastest: (topFastest[0] ?? null) as Activity | null,
    };
  }, [activities]);

  const last7Total = stats.last7.reduce((sum, d) => sum + d.miles, 0);
  const last7Max = Math.max(...stats.last7.map((d) => d.miles), 0);
  const last14Max = Math.max(...stats.last14.map((d) => d.miles), 0);

  const totalDist = metrics.totalMeters / M_TO_DIST;
  const totalHours = metrics.totalSeconds / 3600;
  const marathons = metrics.totalMeters / 42195;
  const everests = metrics.totalElevM / 8849;
  const earthPct = (metrics.totalMeters / 40075000) * 100;
  const trackLaps = metrics.totalMeters / 400;
  const donuts = ((metrics.totalMeters / 1609.344) * 100) / 250;

  const yearMonthMax = Math.max(...metrics.yearMonths, 0);
  const weekdayMax = Math.max(...metrics.weekdayRuns, 0);
  const trend = (cur: number, prevVal: number): string => {
    if (prevVal <= 0) return '';
    const pct = ((cur - prevVal) / prevVal) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs last`;
  };

  const metricDefs = [
    {
      key: 'month',
      label: 'This Month',
      value: metrics.monthDist.toFixed(1),
      unit: DIST_UNIT,
      sub: `${metrics.monthRuns} run${metrics.monthRuns === 1 ? '' : 's'}`,
      detail: (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <DetailTile
              label="Distance"
              value={`${metrics.monthDist.toFixed(1)} ${DIST_UNIT}`}
              sub={trend(metrics.monthDist, metrics.lastMonthDist)}
            />
            <DetailTile label="Runs" value={`${metrics.monthRuns}`} />
            <DetailTile
              label="Elevation"
              value={`${Math.round(metrics.monthElev)} ${ELEV_UNIT}`}
            />
            <DetailTile
              label="Avg / Run"
              value={
                metrics.monthRuns > 0
                  ? `${(metrics.monthDist / metrics.monthRuns).toFixed(1)} ${DIST_UNIT}`
                  : '—'
              }
            />
          </div>
          <div className="space-y-2">
            {metrics.monthRunList.map((a) => (
              <BarRow
                key={a.run_id}
                label={dayLabel(a.start_date_local)}
                frac={
                  metrics.longest ? a.distance / metrics.longest.distance : 0
                }
                right={`${(a.distance / M_TO_DIST).toFixed(1)} ${DIST_UNIT}`}
              />
            ))}
          </div>
        </>
      ),
    },
    {
      key: 'year',
      label: 'This Year',
      value: metrics.yearDist.toFixed(0),
      unit: DIST_UNIT,
      sub: `${metrics.yearRuns} runs · ${Math.round(metrics.yearElev)} ${ELEV_UNIT} elev`,
      detail: (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <DetailTile
              label="Distance"
              value={`${metrics.yearDist.toFixed(1)} ${DIST_UNIT}`}
              sub={trend(metrics.yearDist, metrics.lastYearDist)}
            />
            <DetailTile label="Runs" value={`${metrics.yearRuns}`} />
          </div>
          <p
            className="mb-2 text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            By Month
          </p>
          <div className="flex h-24 items-end gap-1">
            {metrics.yearMonths.map((dist, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm"
                  style={{
                    height:
                      yearMonthMax > 0
                        ? `${Math.max(3, (dist / yearMonthMax) * 80)}px`
                        : '3px',
                    backgroundColor:
                      dist > 0 ? 'var(--color-brand)' : 'var(--color-card-2)',
                  }}
                />
                <span
                  className="text-[9px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {MONTH_LETTERS[i]}
                </span>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      key: 'longest',
      label: 'Longest Run',
      value: metrics.longest
        ? (metrics.longest.distance / M_TO_DIST).toFixed(1)
        : '—',
      unit: DIST_UNIT,
      sub: metrics.longest ? recordDate(metrics.longest.start_date_local) : '',
      detail: (
        <div className="space-y-2">
          {metrics.topLongest.map((a, i) => (
            <BarRow
              key={a.run_id}
              label={`${i + 1}. ${recordDate(a.start_date_local)}`}
              frac={
                metrics.topLongest[0]
                  ? a.distance / metrics.topLongest[0].distance
                  : 0
              }
              right={`${(a.distance / M_TO_DIST).toFixed(1)} ${DIST_UNIT}`}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'pace',
      label: 'Best Pace',
      value: metrics.fastest ? formatPace(metrics.fastest.average_speed) : '—',
      unit: `/${DIST_UNIT}`,
      sub: metrics.fastest ? recordDate(metrics.fastest.start_date_local) : '',
      detail: (
        <>
          <div className="space-y-2">
            {metrics.topFastest.map((a, i) => (
              <BarRow
                key={a.run_id}
                label={`${i + 1}. ${recordDate(a.start_date_local)}`}
                frac={
                  metrics.topFastest[0]
                    ? a.average_speed / metrics.topFastest[0].average_speed
                    : 0
                }
                right={`${formatPace(a.average_speed)}`}
              />
            ))}
          </div>
          <p
            className="mt-4 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Runs shorter than 1 {DIST_UNIT} are excluded.
          </p>
        </>
      ),
    },
    {
      key: 'eddington',
      label: 'Eddington',
      value: `${metrics.eddington}`,
      sub: `${metrics.daysNeeded} more ${metrics.eddingtonNext}+ ${DIST_UNIT} day${metrics.daysNeeded === 1 ? '' : 's'} to ${metrics.eddingtonNext}`,
      detail: (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <DetailTile
              label="Eddington #"
              value={`${metrics.eddington}`}
              sub={`${metrics.eddington} days of ${metrics.eddington}+ ${DIST_UNIT}`}
            />
            <DetailTile
              label={`Next: ${metrics.eddingtonNext}`}
              value={`${metrics.daysAtNext}/${metrics.eddingtonNext}`}
              sub={`days of ${metrics.eddingtonNext}+ ${DIST_UNIT}`}
            />
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--color-card-2)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (metrics.daysAtNext / metrics.eddingtonNext) * 100)}%`,
                backgroundColor: 'var(--color-brand)',
              }}
            />
          </div>
          <p
            className="mt-4 text-xs leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Your Eddington number is the largest E where you've run at least E{' '}
            {DIST_UNIT} on E different days. It only ever goes up — and every
            new level gets harder. A favorite bragging-rights number among
            runners and cyclists.
          </p>
        </>
      ),
    },
    {
      key: 'lifetime',
      label: 'Lifetime',
      value: totalDist.toFixed(0),
      unit: DIST_UNIT,
      sub: `${metrics.totalRuns} runs all-time`,
      detail: (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <DetailTile
              label="Distance"
              value={`${totalDist.toFixed(1)} ${DIST_UNIT}`}
            />
            <DetailTile label="Runs" value={`${metrics.totalRuns}`} />
            <DetailTile
              label="Time on Feet"
              value={`${Math.floor(totalHours)}h ${Math.round((totalHours % 1) * 60)}m`}
            />
            <DetailTile
              label="Elevation"
              value={`${Math.round(metrics.totalElevM * M_TO_ELEV)} ${ELEV_UNIT}`}
            />
          </div>
          <p
            className="mb-2 text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            That's the same as…
          </p>
          <div className="space-y-2">
            <FunRow emoji="🏃" value={marathons.toFixed(1)} label="marathons" />
            <FunRow
              emoji="🏟"
              value={Math.round(trackLaps).toLocaleString()}
              label="laps of a 400m track"
            />
            <FunRow
              emoji="🌍"
              value={`${earthPct.toFixed(2)}%`}
              label="of the way around Earth"
            />
            <FunRow
              emoji="🗻"
              value={everests.toFixed(2)}
              label="Everests climbed"
            />
            <FunRow
              emoji="🍩"
              value={`~${Math.round(donuts).toLocaleString()}`}
              label="donuts burned"
            />
          </div>
        </>
      ),
    },
    {
      key: 'weekday',
      label: 'Run Day',
      value: WEEKDAYS[metrics.favoriteWeekday],
      sub: `${metrics.weekdayRuns[metrics.favoriteWeekday]} runs — your favorite`,
      detail: (
        <div className="space-y-2">
          {WEEKDAYS.map((wd, i) => (
            <BarRow
              key={wd}
              label={wd}
              frac={weekdayMax > 0 ? metrics.weekdayRuns[i] / weekdayMax : 0}
              right={`${metrics.weekdayRuns[i]} · ${metrics.weekdayDist[i].toFixed(0)} ${DIST_UNIT}`}
              dim={metrics.weekdayRuns[i] === 0}
            />
          ))}
        </div>
      ),
    },
    {
      key: 'hour',
      label: 'Golden Hour',
      value: hourLabel(metrics.favoriteHour),
      sub: 'your usual start time',
      detail: (() => {
        const inBucket = (h: number, from: number, to: number) =>
          from < to ? h >= from && h < to : h >= from || h < to;
        const buckets = (
          [
            ['🌅 Early bird (4–9 AM)', 4, 9],
            ['☀️ Daytime (9 AM–3 PM)', 9, 15],
            ['🌇 Evening (3–8 PM)', 15, 20],
            ['🌙 Night owl (8 PM–4 AM)', 20, 4],
          ] as const
        ).map(([label, from, to]) => ({
          label,
          count: metrics.hourRuns.reduce(
            (sum, n, h) => sum + (inBucket(h, from, to) ? n : 0),
            0
          ),
        }));
        const maxBucket = Math.max(...buckets.map((b) => b.count), 1);
        return (
          <>
            <div className="space-y-2">
              {buckets.map((b) => (
                <BarRow
                  key={b.label}
                  label={b.label}
                  frac={b.count / maxBucket}
                  right={`${b.count}`}
                  dim={b.count === 0}
                />
              ))}
            </div>
            <p
              className="mt-4 text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Most common start: {hourLabel(metrics.favoriteHour)} (
              {metrics.hourRuns[metrics.favoriteHour]} runs)
            </p>
          </>
        );
      })(),
    },
  ];

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Streaks card */}
        <button
          onClick={() => setModal('streaks')}
          className="rounded-xl p-4 text-left"
          style={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p
            className="mb-2 text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Streaks
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <p
                className="text-xl leading-none font-bold"
                style={{ color: 'var(--color-text)' }}
              >
                {stats.currentDayStreak}
                <span
                  className="text-xs font-normal"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {' '}
                  day
                </span>
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {stats.currentWeekStreak} week
              </p>
            </div>
          </div>
        </button>

        {/* Training log card */}
        <button
          onClick={() => setModal('log')}
          className="rounded-xl p-4 text-left"
          style={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <p
            className="mb-2 text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Log
          </p>
          <div className="flex h-8 items-end gap-1">
            {stats.last7.map((d) => (
              <div
                key={d.date}
                className="flex-1 rounded-sm"
                style={{
                  height:
                    last7Max > 0
                      ? `${Math.max(8, (d.miles / last7Max) * 100)}%`
                      : '8%',
                  backgroundColor:
                    d.miles > 0 ? 'var(--color-brand)' : 'var(--color-card-2)',
                }}
              />
            ))}
          </div>
          <p
            className="mt-1 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {last7Total.toFixed(1)} {DIST_UNIT} / 7d
          </p>
        </button>
      </div>

      {/* Metric cards */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {metricDefs.map((m) => (
          <MetricCard
            key={m.key}
            label={m.label}
            value={m.value}
            unit={m.unit}
            sub={m.sub}
            onClick={() => setModal(m.key)}
          />
        ))}
      </div>

      {metricDefs.map(
        (m) =>
          modal === m.key && (
            <PopModal
              key={m.key}
              title={m.label}
              onClose={() => setModal(null)}
            >
              {m.detail}
            </PopModal>
          )
      )}

      {modal === 'streaks' && (
        <PopModal title="Streaks" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['Current', `${stats.currentDayStreak}`, 'day streak'],
                ['Longest', `${stats.longestDayStreak}`, 'day streak'],
                ['Current', `${stats.currentWeekStreak}`, 'week streak'],
                ['Longest', `${stats.longestWeekStreak}`, 'week streak'],
              ] as const
            ).map(([kind, value, label], i) => (
              <div key={i} className="rounded-xl p-4" style={statTile}>
                <p
                  className="mb-1 text-xs font-semibold tracking-widest uppercase"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {kind}
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: 'var(--color-text)' }}
                >
                  ⚡ {value}
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
          <p
            className="mt-4 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Day streaks count consecutive days with at least one run. Week
            streaks count consecutive weeks with at least one run.
          </p>
        </PopModal>
      )}

      {modal === 'log' && (
        <PopModal title="Training Log" onClose={() => setModal(null)}>
          <div className="space-y-2">
            {stats.last14.map((d) => (
              <BarRow
                key={d.date}
                label={dayLabel(d.date)}
                frac={last14Max > 0 ? d.miles / last14Max : 0}
                right={d.miles > 0 ? `${d.miles.toFixed(1)} ${DIST_UNIT}` : '—'}
                dim={d.miles === 0}
              />
            ))}
          </div>
        </PopModal>
      )}
    </>
  );
};

export default ProfileCards;
