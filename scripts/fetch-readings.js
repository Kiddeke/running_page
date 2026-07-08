#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
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

async function fetchOne(dateStr) {
  const compact = dateStr.replace(/-/g, '');
  const url = `https://universalis.com/US/${compact}/Mass.json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; running-page-bot/1.0)' },
    });
    if (!res.ok) { console.log(`  skip ${dateStr} (HTTP ${res.status})`); return; }
    const json = await res.json();
    fs.writeFileSync(path.join(OUT_DIR, `${compact}.json`), JSON.stringify(json));
    console.log(`  ✓ ${dateStr}`);
  } catch (e) {
    console.log(`  ✗ ${dateStr}: ${e.message}`);
  }
}

console.log(`Fetching readings for ${dates.length} days…`);
for (const d of dates) await fetchOne(d);
console.log('Done.');
