import { lazy, Suspense, useMemo } from 'react';
import { yearStats, githubYearStats } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import useActivities from '@/hooks/useActivities';

const yearSvgs = Object.fromEntries(
  Object.keys(yearStats).map((path) => [
    path,
    lazy(() => loadSvgComponent(yearStats, path)),
  ])
);

const githubYearSvgs = Object.fromEntries(
  Object.keys(githubYearStats).map((path) => [
    path,
    lazy(() => loadSvgComponent(githubYearStats, path)),
  ])
);

interface Props {
  year: string;
  onYearChange: (_year: string) => void;
}

const card: React.CSSProperties = {
  backgroundColor: 'var(--color-card)',
  border: '1px solid var(--color-border)',
};

const StatsTab = ({ year, onYearChange }: Props) => {
  const { activities } = useActivities();

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    activities.forEach((a) => years.add(a.start_date_local.slice(0, 4)));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [activities]);

  const displayYear = year === 'Total' ? availableYears[0] ?? '' : year;

  const YearSVG = yearSvgs[`./year_${displayYear}.svg`];
  const GithubYearSVG = githubYearSvgs[`./github_${displayYear}.svg`];

  return (
    <div className="w-full py-6 px-2">
      <div className="mb-8 flex flex-wrap gap-2">
        {availableYears.map((y) => (
          <button
            key={y}
            onClick={() => onYearChange(y)}
            className="rounded-full px-4 py-1.5 text-sm font-semibold transition-colors"
            style={
              displayYear === y
                ? { backgroundColor: 'var(--color-brand)', color: 'var(--color-background)' }
                : { backgroundColor: 'var(--color-card-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
            }
          >
            {y}
          </button>
        ))}
      </div>

      {displayYear ? (
        <Suspense fallback={<div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading charts...</div>}>
          <div className="flex flex-col gap-10">
            {GithubYearSVG && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  {displayYear} Activity Heatmap
                </h2>
                <div className="overflow-x-auto rounded-xl p-4" style={card}>
                  <GithubYearSVG className="github-year-svg h-auto w-full border-0 p-0" />
                </div>
              </div>
            )}
            {YearSVG && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  {displayYear} Running Clock
                </h2>
                <div className="flex justify-center rounded-xl p-6" style={card}>
                  <YearSVG className="year-svg h-auto w-full max-w-lg border-0 p-0" />
                </div>
              </div>
            )}
            {!YearSVG && !GithubYearSVG && (
              <p className="text-center" style={{ color: 'var(--color-text-muted)' }}>No charts available for {displayYear}.</p>
            )}
          </div>
        </Suspense>
      ) : (
        <p className="text-center" style={{ color: 'var(--color-text-muted)' }}>No data yet.</p>
      )}
    </div>
  );
};

export default StatsTab;
