const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

assert(!html.includes('好きな文字'), 'must not render 好きな文字');
assert(!html.includes('どれでも'), 'must not render どれでも');

const source = html.match(/const countries=([\s\S]*?\n\];)/)[1];
const countries = vm.runInNewContext(source.replace(/;$/, ''));
const byId = Object.fromEntries(countries.map(c => [c.id, c]));
const stripMarks = s => s.normalize('NFD').replace(/[\u3099\u309A]/g, '').normalize('NFC');
const cleanRead = r => stripMarks(String(r)).replace(/ー/g, '');
const first = r => cleanRead(r)[0];
const last = r => cleanRead(r).slice(-1);

assert.strictEqual(last(byId.rwanda.read), 'た');
assert.strictEqual(last(byId.india.read), 'と');
assert.strictEqual(first(byId.turkey.read), 'と');
assert.strictEqual(last(byId.denmark.read), 'く');
assert.strictEqual(last(byId.japan.read), 'ん');

const playableCountries = () => countries.filter(c => last(c.read) !== 'ん');
const hasNextFrom = (country, used = []) => playableCountries().some(c => !used.includes(c.id) && c.id !== country.id && first(c.read) === last(country.read));
assert(playableCountries().filter(c => hasNextFrom(c)).length > 0, 'random opening country must always have a next answer');

const expected = ['brazil', 'rwanda', 'thailand', 'india', 'turkey', 'korea'];
for (let i = 0; i < expected.length - 1; i += 1) {
  const current = byId[expected[i]];
  const next = byId[expected[i + 1]];
  assert.strictEqual(first(next.read), last(current.read), `${current.name} should connect to ${next.name}`);
  assert.notStrictEqual(last(next.read), 'ん', `${next.name} must be playable as an answer`);
}

function choicesFor(answer, need) {
  const wrong = countries.filter(c => c.id !== answer.id && first(c.read) !== need).slice(0, 2);
  return [answer, ...wrong];
}
for (let i = 1; i < expected.length; i += 1) {
  const need = last(byId[expected[i - 1]].read);
  const answer = byId[expected[i]];
  assert.strictEqual(choicesFor(answer, need).filter(c => first(c.read) === need).length, 1);
}

let state = { used: ['brazil'], current: byId.brazil, need: last(byId.brazil.read) };
function continueFrom(country) { state.used.push(country.id); state.current = country; state.need = last(country.read); }
continueFrom(byId.rwanda);
assert.strictEqual(state.current.id, 'rwanda');
assert.strictEqual(state.need, 'た');
continueFrom(byId.thailand);
assert.strictEqual(state.need, 'い');
continueFrom(byId.india);
assert.strictEqual(state.need, 'と');
continueFrom(byId.turkey);
assert.strictEqual(state.need, 'こ');
continueFrom(byId.korea);
assert.strictEqual(state.need, 'く');

console.log('flag-shiritori tests passed');
