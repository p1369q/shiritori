const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
context.window.window = context.window;
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/countries.js'), 'utf8'), context);
const countries = context.window.MANABI_DATA.countries;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(countries.length === 196, `countries.jsの登録件数が${countries.length}件です`);

const hashes = new Map();
for (const country of countries) {
  assert(country.flag, `${country.name}にflagパスがありません`);
  assert(!path.isAbsolute(country.flag), `${country.name}のflagパスが絶対パスです`);
  assert(!country.flag.startsWith('/') && !country.flag.startsWith('http'), `${country.name}のflagパスが相対パスではありません`);
  const fullPath = path.join(root, country.flag);
  assert(fs.existsSync(fullPath), `${country.name}のSVGファイルが存在しません: ${country.flag}`);
  const svg = fs.readFileSync(fullPath, 'utf8');
  assert(svg.trim().length > 0, `${country.name}のSVGが空です`);
  assert(/<svg\b/i.test(svg), `${country.name}のファイルがSVGではありません`);
  assert(!/<text\b/i.test(svg), `${country.name}のSVGにtext要素があります`);
  assert(!new RegExp(`>${country.code}<`, 'i').test(svg), `${country.name}のSVGにISO国コード表示があります`);
  const hash = crypto.createHash('sha256').update(svg).digest('hex');
  assert(!hashes.has(hash), `${country.name}と${hashes.get(hash)}が同じSVGを使い回しています`);
  hashes.set(hash, country.name);
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(html.includes('<script src="data/countries.js"></script>'), 'index.htmlが相対パスでcountries.jsを読み込んでいません');
assert(!html.includes('const countries=['), 'index.html内に国データが重複しています');
assert(/<img class=/.test(html) && /src="\$\{c\.flag\}"/.test(html), '画面表示がflag相対パスのimgになっていません');
assert(!/createObjectURL|data:image|https?:\/\//.test(html), '外部URLまたはインライン画像生成が残っています');

console.log('country flag data checks passed');
