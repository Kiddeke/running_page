#!/usr/bin/env node
// Fetches Catholic mass readings and saves as static JSON for same-origin serving.
// Uses DivinumOfficium-style data via the USCCB lectionary RSS, or Universalis as fallback.
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

// Raw HTTPS GET that bypasses any proxy/fetch wrappers
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; running-page/1.0)',
        'Accept': 'application/json, */*',
      },
      timeout: 10000,
    }, (res) => {
      // Follow redirects
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

async function fetchOne(dateStr) {
  const compact = dateStr.replace(/-/g, '');
  const outFile = path.join(OUT_DIR, `${compact}.json`);

  // Try multiple sources
  const urls = [
    `https://universalis.com/US/${compact}/Mass.json`,
    `https://universalis.com/UK/${compact}/Mass.json`,
  ];

  for (const url of urls) {
    try {
      const body = await httpsGet(url);
      const json = JSON.parse(body);
      const sections = json.Mass?.sections ?? json.sections ?? [];
      const hasSections = sections.some(s => s.body);
      if (hasSections) {
        fs.writeFileSync(outFile, body);
        console.log(`  ✓ ${dateStr} (${url.includes('UK') ? 'UK' : 'US'})`);
        return;
      }
      console.log(`  ~ ${dateStr}: empty sections from ${url}`);
    } catch (e) {
      console.log(`  ✗ ${dateStr} [${url}]: ${e.message}`);
    }
  }
}

console.log(`Fetching readings for ${dates.length} days…`);
for (const d of dates) await fetchOne(d);

const written = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json')).length;
console.log(`Done. ${written} files written.`);
