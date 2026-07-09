import { useMemo, useState, type ReactNode } from 'react';
import useActivities from '@/hooks/useActivities';
import { M_TO_DIST, DIST_UNIT } from '@/utils/utils';

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

const ProfileCards = () => {
  const { activities } = useActivities();
  const [modal, setModal] = useState<'streaks' | 'log' | null>(null);

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

  const last7Total = stats.last7.reduce((sum, d) => sum + d.miles, 0);
  const last7Max = Math.max(...stats.last7.map((d) => d.miles), 0);
  const last14Max = Math.max(...stats.last14.map((d) => d.miles), 0);

  const dayLabel = (ds: string) =>
    parseLocalDate(ds).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

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
              <div key={d.date} className="flex items-center gap-3">
                <span
                  className="w-24 shrink-0 text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {dayLabel(d.date)}
                </span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--color-card-2)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:
                        last14Max > 0
                          ? `${(d.miles / last14Max) * 100}%`
                          : '0%',
                      backgroundColor: 'var(--color-brand)',
                    }}
                  />
                </div>
                <span
                  className="w-14 shrink-0 text-right text-xs font-semibold"
                  style={{
                    color:
                      d.miles > 0
                        ? 'var(--color-text)'
                        : 'var(--color-text-muted)',
                  }}
                >
                  {d.miles > 0 ? `${d.miles.toFixed(1)} ${DIST_UNIT}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </PopModal>
      )}
    </>
  );
};

export default ProfileCards;
