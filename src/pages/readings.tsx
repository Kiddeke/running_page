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
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).toUpperCase();
};

interface Section {
  heading: string;
  ref: string;
  body: string;
}

interface MassData {
  longname: string;
  date: string;
  sections: Section[];
}

const parseUniversalisJson = (json: any, dateStr: string): MassData => {
  const longname: string = json.longname ?? json.day ?? '';
  const rawSections: { heading?: string; ref?: string; title?: string; source?: string; body?: string; }[] =
    json.Mass?.sections ?? json.sections ?? [];
  const sections: Section[] = rawSections
    .filter((s) => s.body)
    .map((s) => ({
      heading: s.heading ?? s.title ?? '',
      ref: s.ref ?? s.source ?? '',
      body: s.body ?? '',
    }));
  return { longname, date: dateStr, sections };
};

const tryFetchJson = async (url: string, timeoutMs = 6000): Promise<any | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// Load Universalis via JSONP script tag — bypasses CORS entirely
const loadJsonp = (url: string, timeoutMs = 8000): Promise<any | null> => {
  return new Promise((resolve) => {
    const cbName = `_ub_${Date.now()}`;
    const timer = setTimeout(() => {
      delete (window as any)[cbName];
      script.remove();
      resolve(null);
    }, timeoutMs);

    (window as any)[cbName] = (data: any) => {
      clearTimeout(timer);
      delete (window as any)[cbName];
      script.remove();
      resolve(data);
    };

    const script = document.createElement('script');
    script.src = `${url}?callback=${cbName}`;
    script.onerror = () => { clearTimeout(timer); resolve(null); };
    document.head.appendChild(script);
  });
};

// Base path for same-origin static files (respects /running_page/ prefix on GH Pages)
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

const fetchMassReadings = async (dateStr: string): Promise<MassData> => {
  const compact = dateStr.replace(/-/g, '');

  // 1. Same-origin static file generated at build time — fastest, no CORS
  const localJson = await tryFetchJson(`${BASE}/readings/${compact}.json`);
  if (localJson) {
    const data = parseUniversalisJson(localJson, dateStr);
    if (data.sections.length > 0) return data;
  }

  // 2. Universalis JSONP — bypasses CORS by loading as a <script> tag
  const jsonpData = await loadJsonp(`https://universalis.com/US/${compact}/Mass.json`);
  if (jsonpData) {
    const data = parseUniversalisJson(jsonpData, dateStr);
    if (data.sections.length > 0) return data;
  }

  throw new Error('All attempts failed');
};

// Strip HTML tags for plain-text rendering, or keep for innerHTML
const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#8203;/g, '').trim();

const SkeletonCard = () => (
  <div className="animate-pulse rounded-2xl p-6 mb-4" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
    <div className="h-3 w-1/3 rounded mb-3" style={{ backgroundColor: 'var(--color-card-2)' }} />
    <div className="h-5 w-1/2 rounded mb-4" style={{ backgroundColor: 'var(--color-card-2)' }} />
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`h-3 rounded`} style={{ backgroundColor: 'var(--color-border)', width: i === 4 ? '60%' : '100%' }} />
      ))}
    </div>
  </div>
);

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
    setData(null);
    fetchMassReadings(safeDate)
      .then((d) => {
        if (d.sections.length === 0) throw new Error('No readings returned');
        setData(d);
      })
      .catch(() => setError('readings-unavailable'))
      .finally(() => setLoading(false));
  }, [safeDate]);

  const usccbUrl = `https://bible.usccb.org/bible/readings/${safeDate.slice(5, 7)}${safeDate.slice(8, 10)}${safeDate.slice(2, 4)}.cfm`;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl px-4 pb-12">
        {/* Nav bar */}
        <div className="flex items-center justify-between py-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ‹ Back
          </button>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Daily Readings</p>
          <a
            href={usccbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm"
            style={{ color: 'var(--color-brand)' }}
          >
            USCCB
          </a>
        </div>

        {loading && (
          <>
            <div className="animate-pulse mb-8">
              <div className="h-8 rounded w-3/4 mb-3" style={{ backgroundColor: 'var(--color-card-2)' }} />
              <div className="h-8 rounded w-1/2 mb-4" style={{ backgroundColor: 'var(--color-card-2)' }} />
              <div className="h-4 rounded w-1/3" style={{ backgroundColor: 'var(--color-border)' }} />
            </div>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Readings unavailable</p>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
              Couldn't load the readings for this day.
            </p>
            <a
              href={usccbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full px-6 py-3 text-sm font-semibold"
              style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-background)' }}
            >
              View on USCCB →
            </a>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Hero header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold leading-tight mb-3" style={{ color: 'var(--color-text)' }}>
                {data.longname}
              </h1>
              <p className="text-xs font-semibold tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                {formatDisplayDate(safeDate)}
              </p>
            </div>

            {/* Reading sections */}
            <div className="space-y-5">
              {data.sections.map((s, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-6"
                  style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                >
                  {/* Heading (e.g. "First reading") */}
                  {s.heading && (
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
                      {s.heading}
                    </p>
                  )}

                  {/* Citation pill (e.g. "Hosea 8:4") */}
                  {s.ref && (
                    <div
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 mb-5"
                      style={{ backgroundColor: 'var(--color-card-2)', border: '1px solid var(--color-border)' }}
                    >
                      <span
                        className="w-1 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: 'var(--color-brand)' }}
                      />
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {s.ref}
                      </span>
                    </div>
                  )}

                  {/* Reading body */}
                  <p
                    className="text-base leading-relaxed"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {stripHtml(s.body)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ReadingsPage;
