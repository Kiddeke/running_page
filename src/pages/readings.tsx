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
  copyright?: string;
  // Present on days with an optional memorial, where Universalis provides
  // a second set of readings (keys suffixed "_Optional") alongside the
  // primary weekday ones. Labels are derived by splitting the combined
  // longname on " or " (e.g. "Thursday ... or Saint Augustine Zhao Rong").
  altSections?: Section[];
  primaryLabel?: string;
  altLabel?: string;
}

let jsonpCallbackSeq = 0;

// Load Universalis via JSONP. Each call gets its own uniquely-named
// callback (instead of a single shared "universalisCallback") so that two
// overlapping requests — e.g. navigating from one reading date to another
// before the first one's ~10s timeout window has resolved — can't clobber
// each other. With a shared name, a late-arriving response for the OLD
// date would fire whatever callback is currently installed (the NEW
// date's), handing that page another day's content under its own date
// header — which is exactly what produced identical readings across
// several different dates.
const loadUniversalisJsonp = (
  dateStr: string,
  trace: string[],
  // Dates outside Universalis's free window never call back at all, so
  // this is purely how long that dead-end wait lasts before falling back
  // to the "unavailable" screen. Shorter than before now that the
  // calendar itself avoids offering out-of-window dates in the first
  // place; this only matters for stale links/bookmarks.
  timeoutMs = 6000
): Promise<any | null> => {
  const compact = dateStr.replace(/-/g, '');
  const callbackName = `universalisCallback_${compact}_${Date.now()}_${jsonpCallbackSeq++}`;
  // Empty region = Universalis General Calendar, confirmed valid per
  // Universalis's own JSONP documentation and sample widget code.
  const urls = [
    `https://universalis.com/${compact}/jsonpmass.js?callback=${callbackName}`,
  ];

  const tryUrl = (url: string): Promise<any | null> =>
    new Promise((resolve) => {
      let settled = false;
      const settle = (val: any, reason: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        delete (window as any)[callbackName];
        script.remove();
        trace.push(`${url} -> ${reason}`);
        resolve(val);
      };

      const timer = setTimeout(
        () => settle(null, 'timeout (callback never invoked)'),
        timeoutMs
      );
      (window as any)[callbackName] = (data: any) =>
        settle(data, 'callback invoked');

      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => settle(null, 'script load error');
      document.head.appendChild(script);
    });

  return urls.reduce(
    (chain, url) =>
      chain.then((result) => (result !== null ? result : tryUrl(url))),
    Promise.resolve(null as any)
  );
};

// Parse the flat Universalis JSONP data structure into MassData.
// Universalis's callback prepends "Universalis_" only when building DOM
// element ids — the raw JSON keys themselves are unprefixed (day, Mass_R1,
// Mass_G, copyright, etc.), per Universalis's own sample callback code.
const buildSections = (data: any, suffix: string): Section[] => {
  const keys = ['R1', 'Ps', 'R2', 'GA', 'G'];
  const sections: Section[] = [];
  for (const k of keys) {
    const entry = data[`Mass_${k}${suffix}`];
    const text = entry?.text ?? '';
    if (!text) continue;
    sections.push({
      heading: entry?.heading ?? '',
      ref: entry?.source ?? '',
      body: text,
    });
  }
  return sections;
};

const parseUniversalisFlat = (data: any, dateStr: string): MassData => {
  const longname: string = data['day'] ?? '';
  const sections = buildSections(data, '');
  const altSections = buildSections(data, '_Optional');
  const copyright: string | undefined = data['copyright']?.text;

  let primaryLabel: string | undefined;
  let altLabel: string | undefined;
  if (altSections.length > 0 && longname.includes(' or ')) {
    const idx = longname.indexOf(' or ');
    primaryLabel = longname.slice(0, idx);
    altLabel = longname.slice(idx + 4);
  }

  return {
    longname,
    date: dateStr,
    sections,
    copyright,
    altSections: altSections.length > 0 ? altSections : undefined,
    primaryLabel,
    altLabel,
  };
};

const fetchMassReadings = async (dateStr: string): Promise<MassData> => {
  const trace: string[] = [];

  // Universalis JSONP — bypasses CORS via <script> tag, fixed callback
  const jsonpData = await loadUniversalisJsonp(dateStr, trace);
  if (jsonpData) {
    const flat = parseUniversalisFlat(jsonpData, dateStr);
    if (flat.sections.length > 0) return flat;
    trace.push('jsonp -> parsed but 0 sections');
  }

  throw new Error(trace.join(' | ') || 'All attempts failed');
};

// Strip HTML tags for plain-text rendering. Block-level boundaries are
// turned into spaces first so words from adjacent <div>/<p> lines (as
// Universalis wraps each verse line) don't get mashed together. Entities
// (named and numeric, e.g. &#x2010; &#160;) are decoded via the DOM rather
// than a hardcoded list, since Universalis's text uses many of them.
const stripHtml = (html: string): string => {
  const spaced = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|p|li)>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  const decoder = document.createElement('textarea');
  decoder.innerHTML = spaced;
  return decoder.value
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Universalis's Gospel Acclamation citation glues the abbreviated book
// name straight to the chapter number (e.g. "Ps94:8", "1Jn2:5"), unlike
// the other readings which use full names with normal spacing ("Hosea
// 10:1-3"). Insert the missing space in both directions so citations
// read consistently.
const formatRef = (ref: string): string =>
  stripHtml(ref)
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2');

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
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAlt, setShowAlt] = useState(false);

  const safeDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : (() => {
          const now = new Date();
          return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        })();

  useEffect(() => {
    // Guard against a stale/late-arriving fetch (e.g. quickly navigating
    // between dates, or React re-invoking effects in dev) overwriting the
    // state for whichever date is actually current.
    let cancelled = false;
    setLoading(true);
    setError(null);
    setErrorDetail(null);
    setData(null);
    setShowAlt(false);
    fetchMassReadings(safeDate)
      .then((d) => {
        if (cancelled) return;
        if (d.sections.length === 0) throw new Error('No readings returned');
        setData(d);
      })
      .catch((e) => {
        if (cancelled) return;
        setError('readings-unavailable');
        setErrorDetail(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
            {errorDetail && (
              <p
                className="mt-6 font-mono text-xs break-words whitespace-pre-wrap"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {errorDetail}
              </p>
            )}
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
                {stripHtml(
                  data.altSections
                    ? ((showAlt ? data.altLabel : data.primaryLabel) ??
                        data.longname)
                    : data.longname
                )}
              </h1>
              <p
                className="text-xs font-semibold tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {formatDisplayDate(safeDate)}
              </p>
            </div>

            {/* Optional-memorial toggle */}
            {data.altSections && (
              <div className="mb-6 flex gap-2">
                <button
                  onClick={() => setShowAlt(false)}
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={
                    !showAlt
                      ? {
                          backgroundColor: 'var(--color-brand)',
                          color: 'var(--color-background)',
                        }
                      : {
                          backgroundColor: 'var(--color-card-2)',
                          color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border)',
                        }
                  }
                >
                  {stripHtml(data.primaryLabel ?? 'Weekday')}
                </button>
                <button
                  onClick={() => setShowAlt(true)}
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={
                    showAlt
                      ? {
                          backgroundColor: 'var(--color-brand)',
                          color: 'var(--color-background)',
                        }
                      : {
                          backgroundColor: 'var(--color-card-2)',
                          color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border)',
                        }
                  }
                >
                  {stripHtml(data.altLabel ?? 'Memorial')}
                </button>
              </div>
            )}

            {/* Reading sections */}
            <div className="space-y-5">
              {(showAlt ? data.altSections! : data.sections).map((s, i) => (
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
                      {stripHtml(s.heading)}
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
                        {formatRef(s.ref)}
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

            {data.copyright && (
              <>
                <p
                  className="mt-6 text-xs leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {stripHtml(data.copyright)}
                </p>
                <a
                  href="https://universalis.com/mass.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs"
                  style={{ color: 'var(--color-brand)' }}
                >
                  Readings via Universalis →
                </a>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default ReadingsPage;
