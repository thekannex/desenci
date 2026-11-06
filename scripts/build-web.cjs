// Vite çıktısını (dist/) tek bir HTML dosyasına gömer: release/Desenci.html.
// Bu dosya internetsiz, kurulumsuz her tarayıcıda çift tıklayınca açılır (Windows, Mac, Linux, tablet).
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'release');
const outFile = path.join(outDir, 'Desenci.html');

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const read = (href) => fs.readFileSync(path.join(dist, href.replace(/^\.\//, '')));

// Betik: satır içi modül (içindeki "</script" dizisi kaçırılır)
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, (_m, src) => {
  const code = read(src).toString('utf8').replace(/<\/script/gi, '<\/script');
  return `<script type="module">${code}</script>`;
});
// Stil dosyaları
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_m, href) => `<style>${read(href).toString('utf8')}</style>`);
// Simge
html = html.replace(/<link rel="icon" type="image\/svg\+xml" href="([^"]+)" \/?>/, (_m, href) => {
  const data = href.startsWith('data:') ? href : `data:image/svg+xml;base64,${read(href).toString('base64')}`;
  return `<link rel="icon" type="image/svg+xml" href="${data}" />`;
});

// Dışarıdaki bir dosyaya başvuru kalırsa tek dosya çalışmaz
const left = html.match(/assets\/[\w.-]+\.(js|css|svg|png|woff2?)/);
if (left) throw new Error('Gömülmeyen dosya kaldı: ' + left[0]);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
console.log(`  • tek dosya  ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
