#!/usr/bin/env node
// Fetches Catholic mass readings from USCCB and saves as static JSON.
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pad = (n) => String(n).padStart(2, '0');
const OUT_DIR = path.join(__dirname, '../public/readings');
fs.mkdirSync(OUT_DIR, { recursive: true });

const dates = [];
const today = new Date();
for (let i = -7; i <= 21; i++) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
  dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 12000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://bible.usccb.org${res.headers.location}`;
        return httpsGet(next).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#160;/g, ' ')
    .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”').replace(/&ldquo;/g, '“')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseUSCCBHtml(html, dateStr) {
  // Day name: in <title> or an h1/h2 near the top
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? stripTags(titleMatch[1]) : '';
  // Clean up " | USCCB" suffix
  const longname = pageTitle.replace(/\s*\|.*$/, '').trim();

  const sections = [];

  // USCCB reading blocks: each reading is in a <div class="content-body">
  // Heading is in <h3>, citation in a link or <p>, body in <p> tags
  // Extract all reading blocks between <h3> tags
  const readingBlockRe = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|<\/div>\s*<\/div>|$)/gi;
  let m;
  while ((m = readingBlockRe.exec(html)) !== null) {
    const heading = stripTags(m[1]);
    const block = m[2];

    // Skip nav headings
    if (/nav|menu|sidebar|footer|header/i.test(heading)) continue;
    if (heading.length > 80) continue;

    // Citation: look for <p> with a book reference pattern, or a <strong>
    const citationMatch = block.match(/<p[^>]*>\s*<strong[^>]*>([\s\S]*?)<\/strong>/i)
      || block.match(/<p[^>]*class="[^"]*citation[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      || block.match(/<p[^>]*>\s*((?:[1-3]\s)?[A-Z][a-z]+(?:\s[0-9]+)?(?::[0-9, \-]+)?)\s*<\/p>/i);
    const ref = citationMatch ? stripTags(citationMatch[1]) : '';

    // Body: all <p> tags in block, skipping the citation
    const paras = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(p => stripTags(p[1]))
      .filter(t => t.length > 30 && t !== ref && !/^\s*$/.test(t));

    if (paras.length > 0 && heading) {
      sections.push({ heading, ref, body: paras.join('\n\n') });
    }
  }

  return { longname, date: dateStr, sections };
}

async function fetchOne(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const compact = `${dateStr.replace(/-/g, '')}`;
  const usccbDate = `${m}${d}${y.slice(2)}`; // MMDDYY
  const outFile = path.join(OUT_DIR, `${compact}.json`);
  const url = `https://bible.usccb.org/bible/readings/${usccbDate}.cfm`;

  try {
    const html = await httpsGet(url);
    const data = parseUSCCBHtml(html, dateStr);

    if (data.sections.length > 0) {
      fs.writeFileSync(outFile, JSON.stringify(data));
      console.log(`  ✓ ${dateStr} — ${data.sections.length} sections — "${data.longname.slice(0, 50)}"`);
    } else {
      // Log page snippet for debugging today only
      if (dateStr === dates[7]) {
        const snippet = html.slice(0, 1500).replace(/\s+/g, ' ');
        console.log(`  ~ ${dateStr}: 0 sections. Snippet:\n${snippet}\n`);
      } else {
        console.log(`  ~ ${dateStr}: 0 sections`);
      }
    }
  } catch (e) {
    console.log(`  ✗ ${dateStr}: ${e.message}`);
  }
}

console.log(`Fetching ${dates.length} days from USCCB…`);
for (const d of dates) await fetchOne(d);
const written = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json')).length;
console.log(`Done. ${written} files written.`);
