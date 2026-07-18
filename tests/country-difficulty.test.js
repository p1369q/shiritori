const assert = require('assert');
global.window = global; global.MANABI_DATA = {};
delete require.cache[require.resolve('../data/countries.js')];
require('../data/countries.js');
const countries = global.MANABI_DATA.countries;
const expected = [30, 50, 56, 60];
assert.strictEqual(countries.length, 196);
assert.strictEqual(new Set(countries.map(c => c.name)).size, 196, '表示名は重複しない');
expected.forEach((count, i) => assert.strictEqual(countries.filter(c => c.difficulty === i + 1).length, count));
[30, 80, 136, 196].forEach((count, i) => {
  const available = countries.filter(c => c.difficulty <= i + 1);
  assert.strictEqual(available.length, count);
  if (i) assert(countries.filter(c => c.difficulty <= i).every(c => available.includes(c)), '下位レベルを含む');
});
assert.strictEqual(countries.find(c => c.name === '北朝鮮').difficulty, 2);
assert.strictEqual(countries.find(c => c.name === 'パレスチナ').difficulty, 3);
assert(!countries.some(c => ['クック諸島', 'ニウエ'].includes(c.name)));
console.log('country difficulty tests passed: exact=30/50/56/60 cumulative=30/80/136/196');
