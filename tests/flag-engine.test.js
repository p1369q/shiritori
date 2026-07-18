const assert = require('assert');
global.window = global; global.MANABI_DATA = {};
delete require.cache[require.resolve('../data/countries.js')];
require('../data/countries.js');
const { Engine, cpuProfile, first, last } = require('../flag-game.js');
const countries = global.MANABI_DATA.countries;
assert.strictEqual(countries.length, 196);
for (const c of countries) {
  assert(c.difficulty >= 1 && c.difficulty <= 4, `${c.id}: difficulty`);
  assert(Array.isArray(c.hints) && c.hints.length >= 3, `${c.id}: hints`);
  c.hints.forEach(h => assert(!h.includes(c.name), `${c.id}: hint reveals name`));
  if (c.population) assert(c.populationYear, `${c.id}: population year`);
}
for (let difficulty=1; difficulty<=4; difficulty++) {
  const game = new Engine(countries, {difficulty, random:Math.random}); let current=game.start();
  for(let i=0;i<1200;i++) {
    const answer=game.answer(current); assert(answer, `difficulty ${difficulty}, turn ${i}`);
    assert.notStrictEqual(answer.id,current.id);
    const choices=game.choices(answer); assert.strictEqual(choices.length,3);
    assert.strictEqual(new Set(choices.map(c=>c.id)).size,3);
    assert.strictEqual(choices.filter(c=>first(c)===last(current)).length,1);
    game.use(answer); current=answer;
  }
}
for(let level=1;level<=4;level++) {
  let total=0; for(let i=0;i<20000;i++) total+=cpuProfile(level,{difficulty:level},Math.random).probability;
  const rate=total/20000, range={1:[.45,.60],2:[.65,.75],3:[.80,.90],4:[.93,.98]}[level];
  assert(rate>=range[0]&&rate<=range[1], `CPU ${level}: ${rate}`);
}
console.log('flag-engine tests passed');
