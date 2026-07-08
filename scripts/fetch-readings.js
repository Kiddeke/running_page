#!/usr/bin/env node
// Fetches Catholic mass readings from Universalis JSONP endpoint.
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
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
      timeout: 12000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchOne(dateStr) {
  const compact = dateStr.replace(/-/g, '');
  const outFile = path.join(OUT_DIR, `${compact}.json`);
  // Universalis JSONP: returns  universalisCallback({...json...});
  const url = `https://universalis.com/US/${compact}/Mass.json?callback=universalisCallback`;

  try {
    const body = await httpsGet(url);
    // Strip JSONP wrapper: "universalisCallback({...});" → "{...}"
    const jsonStr = body.replace(/^\s*\w+\s*\(/, '').replace(/\);\s*$/, '');
    const json = JSON.parse(jsonStr);

    const longname = json.longname ?? json.day ?? '';
    const rawSections = json.Mass?.sections ?? json.sections ?? [];
    const sections = rawSections
      .filter(s => s.body)
      .map(s => ({ heading: s.heading ?? '', ref: s.ref ?? '', body: s.body ?? '' }));

    if (sections.length > 0) {
      fs.writeFileSync(outFile, JSON.stringify({ longname, date: dateStr, sections }));
      console.log(`  ✓ ${dateStr} — ${sections.length} sections — "${longname.slice(0, 50)}"`);
    } else {
      console.log(`  ~ ${dateStr}: 0 sections (longname="${longname}")`);
    }
  } catch (e) {
    console.log(`  ✗ ${dateStr}: ${e.message}`);
  }
}

console.log(`Fetching ${dates.length} days from Universalis JSONP…`);
for (const d of dates) await fetchOne(d);
const written = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json')).length;
console.log(`Done. ${written} files written.`);
