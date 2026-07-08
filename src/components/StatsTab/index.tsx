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
      {/* Year picker */}
      <div className="mb-8 flex flex-wrap gap-2">
        {availableYears.map((y) => (
          <button
            key={y}
            onClick={() => onYearChange(y)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              displayYear === y
                ? 'bg-[var(--color-brand)] text-black'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {displayYear ? (
        <Suspense fallback={<div className="p-8 text-center opacity-50">Loading charts...</div>}>
          <div className="flex flex-col gap-10">
            {GithubYearSVG && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-50">
                  {displayYear} Activity Heatmap
                </h2>
                <div className="overflow-x-auto rounded-xl bg-neutral-900 p-4">
                  <GithubYearSVG className="github-year-svg h-auto w-full border-0 p-0" />
                </div>
              </div>
            )}
            {YearSVG && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-50">
                  {displayYear} Running Clock
                </h2>
                <div className="flex justify-center rounded-xl bg-neutral-900 p-6">
                  <YearSVG className="year-svg h-auto w-full max-w-lg border-0 p-0" />
                </div>
              </div>
            )}
            {!YearSVG && !GithubYearSVG && (
              <p className="text-center opacity-40">No charts available for {displayYear}.</p>
            )}
          </div>
        </Suspense>
      ) : (
        <p className="text-center opacity-40">No data yet.</p>
      )}
    </div>
  );
};

export default StatsTab;
