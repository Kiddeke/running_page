import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const pad = (n: number) => String(n).padStart(2, '0');

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const MassCalendar = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateStr(today);

  // Universalis's free JSONP access is a rolling window relative to today,
  // not calendar-week-aligned as originally assumed here — confirmed by
  // testing on 2026-07-11 (Saturday), where Jul 5-7 (the previous Sunday
  // through Tuesday, which the old "previous Sunday" math still offered)
  // had no data, while Jul 8 (today - 3) onward worked. Dates outside the
  // real window return no data at all (the fetch just times out), so the
  // calendar must not offer days it can't actually load.
  const start = new Date(today);
  start.setDate(today.getDate() - 3);

  const end = new Date(start);
  end.setDate(start.getDate() + 13);

  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const handleDay = (d: Date) => {
    navigate(`/readings/${toLocalDateStr(d)}`);
  };

  return (
    <div
      ref={scrollRef}
      className="scrollbar-none flex gap-1 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {days.map((d) => {
        const dateStr = toLocalDateStr(d);
        const isToday = dateStr === todayStr;
        const isSunday = d.getDay() === 0;

        return (
          <button
            key={dateStr}
            onClick={() => handleDay(d)}
            className="flex shrink-0 flex-col items-center rounded-xl px-3 py-2 transition-colors"
            style={
              isToday
                ? {
                    backgroundColor: 'var(--color-brand)',
                    color: 'var(--color-background)',
                  }
                : isSunday
                  ? {
                      backgroundColor: 'var(--color-card)',
                      color: 'var(--color-brand)',
                      border: '1px solid var(--color-border)',
                    }
                  : {
                      backgroundColor: 'var(--color-card)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }
            }
          >
            <span className="text-[10px] font-semibold tracking-widest">
              {DAY_ABBR[d.getDay()]}
            </span>
            <span className="text-lg leading-none font-bold">
              {d.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default MassCalendar;
