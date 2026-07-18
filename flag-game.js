(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FlagGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';
  const SMALL = { 'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','ゃ':'や','ゅ':'ゆ','ょ':'よ','っ':'つ','ゎ':'わ' };
  const clean = value => String(value || '').normalize('NFD').replace(/[\u3099\u309a]/g, '').normalize('NFC').replace(/ー/g, '').replace(/[ぁぃぅぇぉゃゅょっゎ]/g, c => SMALL[c]);
  const first = c => clean(c.reading)[0] || '';
  const last = c => clean(c.reading).slice(-1);
  const shuffle = (items, random = Math.random) => items.map(value => ({ value, n: random() })).sort((a,b) => a.n-b.n).map(x => x.value);
  const CPU = {
    1: { accuracy:[.45,.60], delay:[2500,4000] }, 2:{ accuracy:[.65,.75], delay:[2000,3200] },
    3: { accuracy:[.80,.90], delay:[1400,2500] }, 4:{ accuracy:[.93,.98], delay:[800,1800] }
  };
  class Engine {
    constructor(countries, options = {}) {
      this.countries = countries.filter(c => c.flagFile && c.reading);
      this.random = options.random || Math.random; this.difficulty = Number(options.difficulty || 2);
      this.useCount = new Map(this.countries.map(c => [c.id, 0])); this.history = [];
    }
    playable() { return this.countries.filter(c => last(c) !== 'ん'); }
    count(c) { return this.useCount.get(c.id) || 0; }
    hasNext(c) { return this.playable().some(n => n.id !== c.id && first(n) === last(c)); }
    sustainable() {
      if (this._sustainable) return this._sustainable;
      let viable = this.playable();
      while (true) {
        const ids = new Set(viable.map(c => c.id));
        const next = viable.filter(c => viable.some(n => n.id !== c.id && ids.has(n.id) && first(n) === last(c)));
        if (next.length === viable.length) return (this._sustainable = viable);
        viable = next;
      }
    }
    start() { const loop = this.sustainable(), safe = loop.filter(c => c.difficulty <= this.difficulty); const c = shuffle(safe.length ? safe : loop, this.random)[0]; this.use(c); return c; }
    use(c) { this.useCount.set(c.id, this.count(c) + 1); this.history.push(c.id); }
    answer(current) {
      const need = last(current), previous = this.history.at(-2), sustainable = new Set(this.sustainable().map(c => c.id));
      const base = this.playable().filter(c => first(c) === need && c.id !== current.id && sustainable.has(c.id));
      const tier = list => { if (!list.length) return null; const min = Math.min(...list.map(c => this.count(c))); return shuffle(list.filter(c => this.count(c) === min), this.random)[0]; };
      const preferred = c => c.id !== previous;
      const level = c => c.difficulty <= this.difficulty;
      return tier(base.filter(c => this.count(c) === 0 && this.hasNext(c) && preferred(c) && level(c)))
        || tier(base.filter(c => this.hasNext(c) && preferred(c) && level(c)))
        || tier(base.filter(c => preferred(c) && level(c)))
        || tier(base.filter(preferred)) || tier(base);
    }
    choices(answer) {
      const preferred = this.countries.filter(c => c.id !== answer.id && first(c) !== first(answer) && c.difficulty <= this.difficulty);
      const fallback = this.countries.filter(c => c.id !== answer.id && first(c) !== first(answer));
      return shuffle([answer, ...shuffle(preferred.length >= 2 ? preferred : fallback, this.random).slice(0,2)], this.random);
    }
  }
  function cpuProfile(level, country, random = Math.random) {
    const p = CPU[level] || CPU[2], base = p.accuracy[0] + random() * (p.accuracy[1]-p.accuracy[0]);
    return { probability: Math.max(.05, Math.min(.99, base - Math.max(0, (country.difficulty || 1)-level)*.08)), delay: Math.round(p.delay[0]+random()*(p.delay[1]-p.delay[0])) };
  }
  return { Engine, CPU, cpuProfile, first, last };
});
