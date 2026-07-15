(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ManabiCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    mode: 'solo', theme: 'prefectures', level: 'standard', cpuLevel: 'normal',
    timeLimit: 45, timerEnabled: true, stripPrefectureSuffix: true,
    lenientDakuten: true, normalizeSmallKana: false, allowHints: true,
    localPlayers: 2, victoryType: 'elimination'
  };



  const THEME_DEFINITIONS = {
    prefectures: { id: 'prefectures', name: '日本の都道府県', icon: '🗾', description: '47都道府県でしりとり。省略名でも入力できます。', phase: 1 },
    countries: { id: 'countries', name: '世界の国', icon: '🌏', description: 'フェーズ2で追加予定です。', phase: 2 },
    animals: { id: 'animals', name: '動物', icon: '🦁', description: 'フェーズ2で追加予定です。', phase: 2 },
    foods: { id: 'foods', name: '食べ物', icon: '🍙', description: 'フェーズ2で追加予定です。', phase: 2 },
    mix: { id: 'mix', name: 'ランダムミックス', icon: '🎲', description: 'フェーズ2で追加予定です。', phase: 2 }
  };

  function getThemeWords(dataStore, themeId) {
    if (themeId === 'mix') return [];
    return Array.isArray(dataStore?.[themeId]) ? dataStore[themeId] : [];
  }

  function getThemeStats(dataStore, themeId) {
    const words = getThemeWords(dataStore, themeId);
    return { id: themeId, count: words.length, isPlayable: words.length > 0 };
  }

  const ELIMINATION_LABELS = {
    timeout: '時間切れ',
    'invalid-word': '登録されていない言葉',
    'already-used': '使用済みの言葉',
    'wrong-start': '必要な文字から始まっていない',
    'ends-with-n': '「ん」で終わった',
    'give-up': 'ギブアップ',
    'no-candidates': '続けられる候補がなくなった'
  };

  class WordNormalizer {
    static normalizeForLookup(text) {
      return String(text || '').normalize('NFKC').trim().replace(/[\s　]/g, '')
        .replace(/[!-/:-@[-`{-~、。・「」『』（）()［］【】,.!?！？]/g, '')
        .replace(/[ァ-ン]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
        .replace(/[ヶ]/g, 'け').replace(/[ヵ]/g, 'か');
    }
    static normalizeForLooseComparison(text, options = {}) {
      const opts = { lenientDakuten: false, normalizeSmallKana: true, ...options };
      let value = this.normalizeForLookup(text);
      if (opts.normalizeSmallKana) value = this.normalizeSmallKana(value);
      if (opts.lenientDakuten) value = this.removeDakuten(value);
      return value;
    }
    static normalizeText(text, options = {}) {
      return options.normalizeSmallKana ? this.normalizeForLooseComparison(text, options) : this.normalizeForLookup(text);
    }
    static katakanaToHiragana(text) { return String(text).normalize('NFKC').replace(/[ァ-ン]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)); }
    static normalizeSmallKana(text) { return String(text).replace(/[ぁぃぅぇぉゃゅょっゎ]/g, c => ({ぁ:'あ',ぃ:'い',ぅ:'う',ぇ:'え',ぉ:'お',ゃ:'や',ゅ:'ゆ',ょ:'よ',っ:'つ',ゎ:'わ'}[c])); }
    static removeDakuten(text) { return String(text).normalize('NFD').replace(/[\u3099\u309A]/g, '').normalize('NFC'); }
    static vowelOf(kana) { return ({あ:'あ',か:'あ',さ:'あ',た:'あ',な:'あ',は:'あ',ま:'あ',や:'あ',ら:'あ',わ:'あ',が:'あ',ざ:'あ',だ:'あ',ば:'あ',ぱ:'あ',い:'い',き:'い',し:'い',ち:'い',に:'い',ひ:'い',み:'い',り:'い',ぎ:'い',じ:'い',ぢ:'い',び:'い',ぴ:'い',う:'う',く:'う',す:'う',つ:'う',ぬ:'う',ふ:'う',む:'う',ゆ:'う',る:'う',ぐ:'う',ず:'う',づ:'う',ぶ:'う',ぷ:'う',え:'え',け:'え',せ:'え',て:'え',ね:'え',へ:'え',め:'え',れ:'え',げ:'え',ぜ:'え',で:'え',べ:'え',ぺ:'え',お:'お',こ:'お',そ:'お',と:'お',の:'お',ほ:'お',も:'お',よ:'お',ろ:'お',を:'お',ご:'お',ぞ:'お',ど:'お',ぼ:'お',ぽ:'お'}[kana] || kana); }
    static effectiveReading(reading, settings = {}) {
      let value = this.normalizeForLookup(reading);
      if (settings.stripPrefectureSuffix) value = value.replace(/(と|どう|ふ|けん)$/u, '');
      return value;
    }
    static getFirstKana(reading, settings = {}) { return this.effectiveReading(reading, settings).charAt(0); }
    static getLastKana(reading, settings = {}) {
      const value = this.effectiveReading(reading, settings);
      for (let i = value.length - 1; i >= 0; i--) {
        const ch = value[i];
        if (ch === 'ー' && i > 0) return this.vowelOf(value[i - 1]);
        if (ch) return ch;
      }
      return '';
    }
    static firstChar(reading, settings = {}) { return this.getFirstKana(reading, settings); }
    static lastChar(reading, settings = {}) { return this.getLastKana(reading, settings); }
    static endsWithN(reading, settings = {}) { return this.getLastKana(reading, settings) === 'ん'; }
  }

  class WordValidator {
    constructor(words, settings) { this.words = words || []; this.settings = { ...DEFAULT_SETTINGS, ...settings }; }
    findWord(input) {
      const lookupNeedle = WordNormalizer.normalizeForLookup(input);
      const looseNeedle = WordNormalizer.normalizeForLooseComparison(input, this.settings);
      if (!lookupNeedle) return null;
      return this.words.find(w => [w.name, w.reading, ...(w.aliases || [])].some(v => {
        if (WordNormalizer.normalizeForLookup(v) === lookupNeedle) return true;
        return this.settings.normalizeSmallKana && WordNormalizer.normalizeForLooseComparison(v, this.settings) === looseNeedle;
      })) || null;
    }
    validate(input, state) {
      if (!WordNormalizer.normalizeForLookup(input)) return { ok: false, reason: '答えを入力してください。', code: 'invalid-word' };
      const word = this.findWord(input);
      if (!word) return { ok: false, reason: 'このゲームの言葉リストには登録されていません。', code: 'invalid-word' };
      if (state.usedIds.has(word.id)) return { ok: false, reason: `「${word.name}」はもう使われています。`, word, code: 'already-used' };
      const first = WordNormalizer.getFirstKana(word.reading, this.settings);
      if (state.requiredChar && first !== state.requiredChar) return { ok: false, reason: `「${state.requiredChar}」から始まる言葉を入力してください。`, word, code: 'wrong-start' };
      if (WordNormalizer.endsWithN(word.reading, this.settings)) return { ok: false, reason: `「${word.name}」は「ん」で終わるため負けです。`, word, fatal: true, code: 'ends-with-n' };
      return { ok: true, word };
    }
    candidates(requiredChar, usedIds) { return this.words.filter(w => !usedIds.has(w.id) && (!requiredChar || WordNormalizer.getFirstKana(w.reading, this.settings) === requiredChar)); }
  }

  class ComputerPlayer {
    constructor(validator, settings) { this.validator = validator; this.settings = { ...DEFAULT_SETTINGS, ...settings }; }
    scoreCandidate(word, state) {
      const nextUsed = new Set([...state.usedIds, word.id]);
      const tail = WordNormalizer.getLastKana(word.reading, this.settings);
      const nextCount = this.validator.candidates(tail, nextUsed).length;
      if (WordNormalizer.endsWithN(word.reading, this.settings)) return -999;
      if (this.settings.cpuLevel === 'easy') return nextCount;
      if (this.settings.cpuLevel === 'hard') return -nextCount;
      return -Math.abs(nextCount - 2);
    }
    choose(state) {
      const candidates = this.validator.candidates(state.requiredChar, state.usedIds);
      if (!candidates.length) return null;
      return candidates.map(w => ({ w, score: this.scoreCandidate(w, state), tie: Math.random() }))
        .sort((a, b) => (b.score - a.score) || (b.tie - a.tie))[0].w;
    }
  }

  function createLocalPlayers(count) {
    return Array.from({ length: Number(count) }, (_, i) => ({
      id: `player-${i + 1}`,
      name: `プレイヤー${i + 1}`,
      isActive: true,
      eliminatedAt: null,
      eliminationReason: null,
      correctCount: 0,
      lastWord: null
    }));
  }

  function activePlayers(players) { return players.filter(p => p.isActive); }

  function findNextActivePlayer(currentIndex, players) {
    const activeCount = activePlayers(players).length;
    if (activeCount <= 1) return { index: -1, isGameOver: true };
    for (let step = 1; step <= players.length; step += 1) {
      const index = (currentIndex + step) % players.length;
      if (players[index]?.isActive) return { index, isGameOver: false };
    }
    return { index: -1, isGameOver: true };
  }

  function eliminatePlayer(players, index, reason, order) {
    const player = players[index];
    if (!player || !player.isActive) return { eliminated: false, player, order };
    player.isActive = false;
    player.eliminatedAt = order.length + 1;
    player.eliminationReason = reason;
    order.push(player.id);
    return { eliminated: true, player, order };
  }

  function buildRankings(players, eliminationOrder, winnerId = null) {
    const byId = new Map(players.map(p => [p.id, p]));
    const winner = winnerId ? byId.get(winnerId) : activePlayers(players)[0];
    const ranked = [];
    if (winner) ranked.push({ ...winner, rank: 1, displayReason: '最後まで残りました' });
    [...eliminationOrder].reverse().forEach(id => {
      const p = byId.get(id);
      if (p && p.id !== winner?.id) ranked.push({ ...p, rank: ranked.length + 1, displayReason: ELIMINATION_LABELS[p.eliminationReason] || p.eliminationReason || '' });
    });
    players.filter(p => p.isActive && p.id !== winner?.id).forEach(p => ranked.push({ ...p, rank: ranked.length + 1, displayReason: 'ゲーム終了時に残存' }));
    return ranked;
  }

  function validateThemeData(words, requiredFields = ['id','name','reading','difficulty']) {
    const problems = { count: words.length, duplicateIds: [], duplicateNames: [], duplicateReadings: [], emptyReadings: [], missingFields: [], duplicateAliases: [], invalidDifficulty: [] };
    const ids = new Set(), names = new Set(), readings = new Set(), aliases = new Map();
    for (const w of words) {
      if (ids.has(w.id)) problems.duplicateIds.push(w.id); ids.add(w.id);
      if (names.has(w.name)) problems.duplicateNames.push(w.name); names.add(w.name);
      if (readings.has(w.reading)) problems.duplicateReadings.push(w.reading); readings.add(w.reading);
      if (!w.reading) problems.emptyReadings.push(w.id);
      requiredFields.forEach(k => { if (w[k] === undefined || w[k] === '') problems.missingFields.push(`${w.id || '(no-id)'}:${k}`); });
      if (w.difficulty !== undefined && (!Number.isInteger(w.difficulty) || w.difficulty < 1 || w.difficulty > 3)) problems.invalidDifficulty.push(w.id);
      for (const a of (w.aliases || [])) {
        const n = WordNormalizer.normalizeForLookup(a);
        if (aliases.has(n) && aliases.get(n) !== w.id) problems.duplicateAliases.push(`${a}:${aliases.get(n)}:${w.id}`);
        aliases.set(n, w.id);
      }
    }
    return problems;
  }

  function validatePrefectureData(words) {
    const problems = validateThemeData(words, ['id','name','reading','region','capital','difficulty']);
    return problems;
  }

  return { DEFAULT_SETTINGS, THEME_DEFINITIONS, ELIMINATION_LABELS, WordNormalizer, WordValidator, ComputerPlayer, createLocalPlayers, activePlayers, findNextActivePlayer, eliminatePlayer, buildRankings, getThemeWords, getThemeStats, validateThemeData, validatePrefectureData };
});
