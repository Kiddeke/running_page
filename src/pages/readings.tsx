import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';

const pad = (n: number) => String(n).padStart(2, '0');

const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDisplayDate = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

interface Reading {
  title: string;
  source: string;
  body: string;
}

interface MassData {
  day: string;
  readings: Reading[];
}

// Universalis API: https://universalis.com/US/YYYYMMDD/Mass.json
const fetchMassReadings = async (dateStr: string): Promise<MassData> => {
  const compact = dateStr.replace(/-/g, '');
  const url = `https://universalis.com/US/${compact}/Mass.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch readings');
  const json = await res.json();

  const day: string = json.day ?? json.title ?? '';
  const readings: Reading[] = [];

  // Universalis returns { Mass: { Scripture: [...] } } or { Sections: [...] }
  const sections: { heading?: string; title?: string; verses?: { body: string }[]; body?: string; reference?: string; source?: string }[] =
    json.Mass?.Scripture ?? json.Sections ?? [];

  for (const s of sections) {
    const title = s.heading ?? s.title ?? '';
    const source = s.reference ?? s.source ?? '';
    const body =
      s.body ??
      (s.verses ?? []).map((v: { body: string }) => v.body).join('\n\n') ??
      '';
    if (body) readings.push({ title, source, body });
  }

  return { day, readings };
};

const ReadingsPage = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<MassData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const safeDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : (() => {
          const now = new Date();
          return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        })();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMassReadings(safeDate)
      .then(setData)
      .catch(() => setError('Could not load readings. Please try again.'))
      .finally(() => setLoading(false));
  }, [safeDate]);

  const usccbUrl = `https://bible.usccb.org/bible/readings/${safeDate.slice(5, 7)}${safeDate.slice(8, 10)}${safeDate.slice(2, 4)}.cfm`;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        {/* Back + date header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white hover:bg-neutral-700"
            aria-label="Back"
          >
            ←
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
              Daily Mass Readings
            </p>
            <p className="font-semibold text-white">{formatDisplayDate(safeDate)}</p>
          </div>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl bg-neutral-900 p-5">
                <div className="mb-3 h-3 w-1/3 rounded bg-neutral-700" />
                <div className="space-y-2">
                  <div className="h-3 rounded bg-neutral-800" />
                  <div className="h-3 w-5/6 rounded bg-neutral-800" />
                  <div className="h-3 w-4/6 rounded bg-neutral-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-neutral-900 p-6 text-center">
            <p className="mb-4 text-white/60">{error}</p>
            <a
              href={usccbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-black"
            >
              View on USCCB →
            </a>
          </div>
        )}

        {data && !loading && (
          <>
            {data.day && (
              <div className="mb-5 rounded-xl bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/20 px-4 py-3">
                <p className="font-semibold text-[var(--color-brand)]">{data.day}</p>
              </div>
            )}

            {data.readings.length === 0 ? (
              <div className="rounded-xl bg-neutral-900 p-6 text-center">
                <p className="mb-1 text-white/60">Readings not available in this format.</p>
                <a
                  href={usccbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-black"
                >
                  View on USCCB →
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {data.readings.map((r, i) => (
                  <div key={i} className="rounded-xl bg-neutral-900 p-5">
                    {r.title && (
                      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--color-brand)]">
                        {r.title}
                      </p>
                    )}
                    {r.source && (
                      <p className="mb-3 text-sm font-semibold text-white">{r.source}</p>
                    )}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                      {r.body}
                    </p>
                  </div>
                ))}

                <a
                  href={usccbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs text-white/30 hover:text-white/60 pb-8"
                >
                  Also available on USCCB →
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default ReadingsPage;
