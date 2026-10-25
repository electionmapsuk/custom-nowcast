// Publish the CURRENT page design with the results FROZEN at an earlier published nowcast.
//   node build/build_frozen.js <old_published_standalone.html>      (run from the project root)
// Takes the up-to-date electionmaps_nowcast.standalone.html (run build_standalone.js first) and swaps in
// the old file's model data (seats/config/central/NI), its engine bundle and its pre-baked central
// simulations, so the map, totals, odds and custom-scenario engine all behave exactly as on that date.
// Output: publish/electionmaps_nowcast.standalone.html (same filename the site's iframe loads).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const oldPath = process.argv[2];
if (!oldPath) { console.error('usage: node build/build_frozen.js <old_published_standalone.html>'); process.exit(1); }
const OLD = fs.readFileSync(oldPath, 'utf8');
let NEW = fs.readFileSync(path.join(ROOT, 'electionmaps_nowcast.standalone.html'), 'utf8');

// the whole <script ...>...</script> element whose body starts with `marker`
function grab(html, marker) {
  const m = html.indexOf(marker); if (m < 0) return null;
  const s = html.lastIndexOf('<script', m), e = html.indexOf('</script>', m);
  if (s < 0 || e < 0) return null;
  return { start: s, end: e + 9, text: html.slice(s, e + 9), body: html.slice(html.indexOf('>', s) + 1, e) };
}
function swap(marker, label, wrap) {
  const o = grab(OLD, marker), n = grab(NEW, marker);
  if (!o) throw new Error('old file has no ' + label);
  if (!n) throw new Error('new file has no ' + label);
  NEW = NEW.slice(0, n.start) + (wrap ? wrap(o.body) : o.text) + NEW.slice(n.end);
  console.log('  ' + label + ': swapped (' + (o.text.length / 1024).toFixed(0) + 'KB from the old file)');
}

swap('window.__NOWCAST_DATA__=', 'model data (seats, config, central, NI)');
// engine: keep the new page's id so the Web-Worker simulations can find the bundle source
swap('window.NowcastEngine =', 'engine bundle', body => '<script id="nowcast-engine-src">' + body + '</script>');
if (grab(OLD, 'window.__CENTRAL_MC__=')) swap('window.__CENTRAL_MC__=', 'central simulations');
else { const n = grab(NEW, 'window.__CENTRAL_MC__='); if (n) { NEW = NEW.slice(0, n.start) + NEW.slice(n.end); console.log('  central simulations: old file had none, removed (page will simulate live)'); } }

const outDir = path.join(ROOT, 'publish'); fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'electionmaps_nowcast.standalone.html');
fs.writeFileSync(out, NEW);
console.log('frozen standalone written: publish/electionmaps_nowcast.standalone.html (' + (NEW.length / 1024).toFixed(0) + 'KB)');
