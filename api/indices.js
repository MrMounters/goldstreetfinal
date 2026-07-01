// Serverless function — fetches live major-index quotes server-side
// (avoids browser CORS issues and keeps this a static-friendly setup).

const INDICES = [
  { symbol: '^spx', name: 'S&P 500' },
  { symbol: '^dji', name: 'Dow Jones' },
  { symbol: '^ndq', name: 'Nasdaq' },
  { symbol: '^rut', name: 'Russell 2000' },
  { symbol: '^ftm', name: 'FTSE 100' },
  { symbol: '^nkx', name: 'Nikkei 225' },
  { symbol: '^dax', name: 'DAX' },
];

const FALLBACK = [
  { symbol: '^spx', name: 'S&P 500',      price: 6090.27,  change: 20.5,  changePercent: 0.34 },
  { symbol: '^dji', name: 'Dow Jones',    price: 44722.06, change: -54.2, changePercent: -0.12 },
  { symbol: '^ndq', name: 'Nasdaq',       price: 19764.89, change: 113.6, changePercent: 0.58 },
  { symbol: '^rut', name: 'Russell 2000', price: 2312.44,  change: 4.8,   changePercent: 0.21 },
  { symbol: '^ftm', name: 'FTSE 100',     price: 8347.15,  change: -6.7,  changePercent: -0.08 },
  { symbol: '^nkx', name: 'Nikkei 225',   price: 39908.32, change: 166.4, changePercent: 0.42 },
  { symbol: '^dax', name: 'DAX',          price: 19332.71, change: 28.9,  changePercent: 0.15 },
];

function parseCsv(csv) {
  const lines = csv.trim().split('\n');
  const rows = lines.slice(1); // skip header
  const out = [];

  for (const line of rows) {
    // Stooq CSV: Symbol,Date,Time,Open,Close
    const cols = line.split(',').map((c) => c.replace(/"/g, '').trim());
    const [symbol, , , openStr, closeStr] = cols;
    const open = parseFloat(openStr);
    const price = parseFloat(closeStr);
    const meta = INDICES.find((i) => i.symbol === symbol?.toLowerCase());
    if (!meta || !isFinite(price) || !isFinite(open) || open === 0) continue;

    const change = price - open;
    const changePercent = (change / open) * 100;
    out.push({ symbol: meta.symbol, name: meta.name, price, change, changePercent });
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=60');
  res.setHeader('Content-Type', 'application/json');

  try {
    const symbols = INDICES.map((i) => i.symbol).join(',');
    const url = `https://stooq.com/q/l/?s=${symbols}&f=sd2t2oc&h&e=csv`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Upstream status ${response.status}`);

    const csv = await response.text();
    const parsed = parseCsv(csv);

    if (!parsed.length) throw new Error('No rows parsed');

    res.status(200).json({ source: 'live', indices: parsed });
  } catch (err) {
    res.status(200).json({ source: 'fallback', indices: FALLBACK });
  }
};
