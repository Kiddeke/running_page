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
  return d
    .toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
    .toUpperCase();
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
  const rawSections: {
    heading?: string;
    ref?: string;
    title?: string;
    source?: string;
    body?: string;
  }[] = json.Mass?.sections ?? json.sections ?? [];
  const sections: Section[] = rawSections
    .filter((s) => s.body)
    .map((s) => ({
      heading: s.heading ?? s.title ?? '',
      ref: s.ref ?? s.source ?? '',
      body: s.body ?? '',
    }));
  return { longname, date: dateStr, sections };
};

const tryFetchJson = async (
  url: string,
  timeoutMs = 6000
): Promise<any | null> => {
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

// Load Universalis via JSONP — fixed callback name "universalisCallback"
const loadUniversalisJsonp = (
  dateStr: string,
  timeoutMs = 10000
): Promise<any | null> => {
  const compact = dateStr.replace(/-/g, '');
  const urls = [
    `https://universalis.com/USA/${compact}/jsonpmass.js?callback=universalisCallback`,
    `https://universalis.com/${compact}/jsonpmass.js?callback=universalisCallback`,
  ];

  const tryUrl = (url: string): Promise<any | null> =>
    new Promise((resolve) => {
      let settled = false;
      const settle = (val: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        (window as any).universalisCallback = undefined;
        script.remove();
        resolve(val);
      };

      const timer = setTimeout(() => settle(null), timeoutMs);
      (window as any).universalisCallback = (data: any) => settle(data);

      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => settle(null);
      document.head.appendChild(script);
    });

  return urls.reduce(
    (chain, url) =>
      chain.then((result) => (result !== null ? result : tryUrl(url))),
    Promise.resolve(null as any)
  );
};

// Parse the flat Universalis JSONP data structure into MassData
const parseUniversalisFlat = (data: any, dateStr: string): MassData => {
  const longname: string = data['Universalis_day'] ?? '';
  const keys = ['R1', 'Ps', 'R2', 'GA', 'G'];
  const sections: Section[] = [];
  for (const k of keys) {
    const text =
      data[`Universalis_Mass_${k}`]?.text ??
      data[`Universalis_Mass_${k}.text`] ??
      '';
    if (!text) continue;
    sections.push({
      heading:
        data[`Universalis_Mass_${k}`]?.heading ??
        data[`Universalis_Mass_${k}.heading`] ??
        '',
      ref:
        data[`Universalis_Mass_${k}`]?.source ??
        data[`Universalis_Mass_${k}.source`] ??
        '',
      body: text,
    });
  }
  return { longname, date: dateStr, sections };
};

// Base path for same-origin static files (respects /running_page/ prefix on GH Pages)
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

const fetchMassReadings = async (dateStr: string): Promise<MassData> => {
  const compact = dateStr.replace(/-/g, '');

  // 1. Same-origin static file generated at build time — fastest, no CORS
  const localJson = await tryFetchJson(`${BASE}/readings/${compact}.json`);
  if (localJson) {
    // Try flat structure first, fall back to sections array
    const flat = parseUniversalisFlat(localJson, dateStr);
    if (flat.sections.length > 0) return flat;
    const nested = parseUniversalisJson(localJson, dateStr);
    if (nested.sections.length > 0) return nested;
  }

  // 2. Universalis JSONP — bypasses CORS via <script> tag, fixed callback
  const jsonpData = await loadUniversalisJsonp(dateStr);
  if (jsonpData) {
    const flat = parseUniversalisFlat(jsonpData, dateStr);
    if (flat.sections.length > 0) return flat;
    const nested = parseUniversalisJson(jsonpData, dateStr);
    if (nested.sections.length > 0) return nested;
  }

  throw new Error('All attempts failed');
};

// Strip HTML tags for plain-text rendering, or keep for innerHTML
const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8203;/g, '')
    .trim();

const SkeletonCard = () => (
  <div
    className="mb-4 animate-pulse rounded-2xl p-6"
    style={{
      backgroundColor: 'var(--color-card)',
      border: '1px solid var(--color-border)',
    }}
  >
    <div
      className="mb-3 h-3 w-1/3 rounded"
      style={{ backgroundColor: 'var(--color-card-2)' }}
    />
    <div
      className="mb-4 h-5 w-1/2 rounded"
      style={{ backgroundColor: 'var(--color-card-2)' }}
    />
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-3 rounded`}
          style={{
            backgroundColor: 'var(--color-border)',
            width: i === 4 ? '60%' : '100%',
          }}
        />
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
        <div className="mb-2 flex items-center justify-between py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ‹ Back
          </button>
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            Daily Readings
          </p>
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
            <div className="mb-8 animate-pulse">
              <div
                className="mb-3 h-8 w-3/4 rounded"
                style={{ backgroundColor: 'var(--color-card-2)' }}
              />
              <div
                className="mb-4 h-8 w-1/2 rounded"
                style={{ backgroundColor: 'var(--color-card-2)' }}
              />
              <div
                className="h-4 w-1/3 rounded"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
            </div>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {error && (
          <div className="py-16 text-center">
            <p
              className="mb-2 text-lg font-semibold"
              style={{ color: 'var(--color-text)' }}
            >
              Readings unavailable
            </p>
            <p
              className="mb-6 text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Couldn't load the readings for this day.
            </p>
            <a
              href={usccbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full px-6 py-3 text-sm font-semibold"
              style={{
                backgroundColor: 'var(--color-brand)',
                color: 'var(--color-background)',
              }}
            >
              View on USCCB →
            </a>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Hero header */}
            <div className="mb-8">
              <h1
                className="mb-3 text-3xl leading-tight font-bold"
                style={{ color: 'var(--color-text)' }}
              >
                {data.longname}
              </h1>
              <p
                className="text-xs font-semibold tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {formatDisplayDate(safeDate)}
              </p>
            </div>

            {/* Reading sections */}
            <div className="space-y-5">
              {data.sections.map((s, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-6"
                  style={{
                    backgroundColor: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {/* Heading (e.g. "First reading") */}
                  {s.heading && (
                    <p
                      className="mb-3 text-xs font-bold tracking-widest uppercase"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {s.heading}
                    </p>
                  )}

                  {/* Citation pill (e.g. "Hosea 8:4") */}
                  {s.ref && (
                    <div
                      className="mb-5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                      style={{
                        backgroundColor: 'var(--color-card-2)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <span
                        className="h-4 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: 'var(--color-brand)' }}
                      />
                      <span
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text)' }}
                      >
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
