#!/usr/bin/env node
// Fetches Catholic mass readings from Universalis HTML pages and saves as JSON.
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
        return httpsGet(res.headers.location).then(resolve).catch(reject);
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

// Strip HTML tags and decode common entities
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&#8203;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseUniversalisHtml(html, dateStr) {
  // Extract day name from <h1> or title
  const dayMatch = html.match(/<h1[^>]*class="[^"]*dayname[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const longname = dayMatch ? stripHtml(dayMatch[1]) : '';

  const sections = [];

  // Universalis wraps each reading in a <div> with class "reading" or similar
  // Try to extract section blocks — each has a heading and body
  const sectionRegex = /<h(\d)[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h\d|<\/div>|$)/gi;
  let match;
  while ((match = sectionRegex.exec(html)) !== null) {
    const headingRaw = stripHtml(match[2]);
    const bodyBlock = match[3];

    // Look for a citation/ref line (often in <p class="ref"> or similar)
    const refMatch = bodyBlock.match(/<p[^>]*class="[^"]*ref[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      || bodyBlock.match(/<cite[^>]*>([\s\S]*?)<\/cite>/i);
    const ref = refMatch ? stripHtml(refMatch[1]) : '';

    // Body is all paragraph text
    const paraMatches = [...bodyBlock.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
    const bodyText = paraMatches
      .map(m => stripHtml(m[1]))
      .filter(t => t.length > 20 && t !== ref) // skip short/empty and the ref line
      .join('\n\n');

    if (bodyText.length > 50) {
      sections.push({ heading: headingRaw, ref, body: bodyText });
    }
  }

  return { longname, date: dateStr, sections };
}

async function fetchOne(dateStr) {
  const compact = dateStr.replace(/-/g, '');
  const outFile = path.join(OUT_DIR, `${compact}.json`);

  const urls = [
    `https://universalis.com/US/${compact}/Mass.htm`,
    `https://universalis.com/US/${compact}/Mass.htm`,  // retry same
    `https://universalis.com/${compact}/Mass.htm`,
  ];

  for (const url of urls) {
    try {
      const html = await httpsGet(url);
      if (html.includes('DOCTYPE') || html.includes('<html')) {
        // We got actual HTML — try to parse it
        const data = parseUniversalisHtml(html, dateStr);
        if (data.sections.length > 0) {
          fs.writeFileSync(outFile, JSON.stringify(data));
          console.log(`  ✓ ${dateStr} (${data.sections.length} sections, "${data.longname.slice(0, 40)}")`);
          return;
        }
        // Log first 500 chars of HTML to understand structure
        if (dateStr === dates[7]) { // only for today
          console.log(`  ~ ${dateStr}: got HTML but 0 sections. First 600 chars:\n${html.slice(0, 600)}\n`);
        } else {
          console.log(`  ~ ${dateStr}: got HTML but 0 sections`);
        }
      } else {
        console.log(`  ? ${dateStr}: unexpected non-HTML response from ${url}`);
      }
    } catch (e) {
      console.log(`  ✗ ${dateStr} [${url}]: ${e.message}`);
    }
    break; // don't retry same URL if HTML parsed to 0 sections
  }
}

console.log(`Fetching readings for ${dates.length} days…`);
for (const d of dates) await fetchOne(d);
const written = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json')).length;
console.log(`Done. ${written} files written.`);
