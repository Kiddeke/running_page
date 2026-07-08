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

  // Start: previous Sunday (or today if today is Sunday)
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());

  // End: two Sundays from today
  const end = new Date(today);
  end.setDate(today.getDate() + (14 - today.getDay()));

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
      className="flex gap-1 overflow-x-auto pb-1 scrollbar-none"
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
            className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-2 transition-colors ${
              isToday
                ? 'bg-[var(--color-brand)] text-black'
                : isSunday
                  ? 'bg-neutral-800 text-[var(--color-brand)]'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
            }`}
          >
            <span className="text-[10px] font-semibold tracking-widest">
              {DAY_ABBR[d.getDay()]}
            </span>
            <span className="text-lg font-bold leading-none">{d.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
};

export default MassCalendar;
