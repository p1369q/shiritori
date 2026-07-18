const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

assert(!html.includes('好きな文字'), 'must not render 好きな文字');
assert(!html.includes('どれでも'), 'must not render どれでも');
assert(html.includes("${state.show?'ヒントを隠す':'ヒントを見る'}"), 'hint button label must reflect visibility state');
assert(html.includes('state.show=!state.show'), 'hint button must toggle visibility instead of forcing it on');
assert(html.includes('state.show=false;state.answer=pickAnswer()'), 'new questions must start with hidden country names');
assert(!html.includes('state.show=true;renderGame()'), 'hint button must not only show country names');

const source = html.match(/const countries=([\s\S]*?\n\];)/)[1];
const countries = vm.runInNewContext(source.replace(/;$/, ''));
const byId = Object.fromEntries(countries.map(c => [c.id, c]));
const stripMarks = s => s.normalize('NFD').replace(/[\u3099\u309A]/g, '').normalize('NFC');
const small = {ぁ:'あ',ぃ:'い',ぅ:'う',ぇ:'え',ぉ:'お',ゃ:'や',ゅ:'ゆ',ょ:'よ',っ:'つ',ゎ:'わ'};
const cleanRead = r => stripMarks(String(r)).replace(/ー/g, '').replace(/[ぁぃぅぇぉゃゅょっゎ]/g, c => small[c]);
const first = r => cleanRead(r)[0];
const last = r => cleanRead(r).slice(-1);
const playableCountries = () => countries.filter(c => last(c.read) !== 'ん');
const hasNextFrom = (country, used = [], allowUsed = false) => playableCountries().some(c => (allowUsed || !used.includes(c.id)) && c.id !== country.id && first(c.read) === last(country.read));

assert.strictEqual(countries.length, 196, 'country count must be exactly 196');
assert(!byId.north_korea, 'North Korea must not be included');
['vatican', 'kosovo', 'cook_islands', 'niue', 'japan'].forEach(id => assert(byId[id], `${id} must be included`));
assert.strictEqual(byId.korea.read, 'かんこく', 'Korea reading must be かんこく');
assert.strictEqual(last(byId.rwanda.read), 'た');
assert.strictEqual(last(byId.india.read), 'と');
assert.strictEqual(first(byId.turkey.read), 'と');
assert.strictEqual(last(byId.denmark.read), 'く');
assert.strictEqual(last(byId.japan.read), 'ん');

for (const [field, label] of [['id', 'id'], ['name', 'display name']]) {
  const values = countries.map(c => c[field]);
  assert.strictEqual(new Set(values).size, values.length, `${label} values must be unique`);
}
for (const c of countries) {
  assert(c.read, `${c.id} reading must be nonempty`);
  assert(c.svg && c.svg.includes('<svg'), `${c.id} svg must be nonempty`);
  assert(c.region, `${c.id} region must be set`);
  assert(first(c.read), `${c.id} first kana must be available`);
  assert(last(c.read), `${c.id} last kana must be available`);
}

function chooseAnswer(state) {
  const recent = c => c.id === state.current?.id || c.id === state.prev?.id;
  const poolFor = allowUsed => {
    const base = playableCountries().filter(c => first(c.read) === state.need && !recent(c) && (allowUsed || !state.used.includes(c.id)));
    const safe = base.filter(c => state.q >= 10 || hasNextFrom(c, [...state.used, c.id], allowUsed));
    return safe.length ? safe : base;
  };
  let pool = poolFor(false);
  if (!pool.length) pool = poolFor(true);
  return pool[0] || null;
}
function choicesFor(answer, need) {
  const wrong = countries.filter(c => c.id !== answer.id && first(c.read) !== need).slice(0, 2);
  return [answer, ...wrong];
}
for (const start of playableCountries().filter(c => hasNextFrom(c)).slice(0, 1000)) {
  const state = { used: [start.id], current: start, prev: null, need: last(start.read), q: 1 };
  for (let turn = 1; turn <= 10; turn += 1) {
    const answer = chooseAnswer(state);
    assert(answer, `dead end from ${state.current.id} on turn ${turn}`);
    const choices = choicesFor(answer, state.need);
    assert.strictEqual(new Set(choices.map(c => c.id)).size, 3, 'choices must not duplicate countries');
    assert.strictEqual(choices.filter(c => first(c.read) === state.need).length, 1, 'exactly one answer must match the requested kana');
    state.prev = state.current;
    if (!state.used.includes(answer.id)) state.used.push(answer.id);
    state.current = answer;
    state.need = last(answer.read);
    state.q += 1;
  }
}
console.log('flag-shiritori tests passed');
