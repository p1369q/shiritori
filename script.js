(() => {
  'use strict';

  const { DEFAULT_SETTINGS, THEME_DEFINITIONS, ELIMINATION_LABELS, WordNormalizer, WordValidator, ComputerPlayer, createLocalPlayers, activePlayers, findNextActivePlayer, buildRankings, getThemeWords, getThemeStats, validateThemeData, validatePrefectureData } = window.ManabiCore;
  const THEMES = THEME_DEFINITIONS;

  class GameState {
    constructor(settings, words) {
      this.settings = settings; this.words = words; this.usedIds = new Set(); this.history = [];
      this.requiredChar = ''; this.score = 0; this.combo = 0; this.turn = 0; this.active = true;
      this.message = '最初の言葉を入力してください。'; this.players = []; this.eliminationOrder = []; this.winner = ''; this.rankings = []; this.isCpuThinking = false;
    }
  }

  class ScoreManager { static addCorrect(state) { state.combo += 1; state.score += 10 + Math.max(0, state.combo - 1) * 2; } }

  class TimerManager {
    constructor(onTimeout) { this.onTimeout = onTimeout; this.id = null; this.remaining = 0; this.turnId = 0; }
    start(seconds, turnId) {
      this.stop(); this.remaining = seconds; this.turnId = turnId; UI.renderTimer(this.remaining);
      this.id = setInterval(() => {
        if (this.turnId !== turnId) return this.stop();
        this.remaining -= 1; UI.renderTimer(this.remaining);
        if (this.remaining <= 0) { this.stop(); this.onTimeout(turnId); }
      }, 1000);
    }
    stop() { if (this.id) clearInterval(this.id); this.id = null; }
  }

  class StorageManager {
    static key = 'manabiShiritori.phase1';
    static storage() { try { return window.localStorage; } catch { return null; } }
    static load() { try { return JSON.parse(this.storage()?.getItem(this.key)) || { records: {}, learned: [] }; } catch { return { records: {}, learned: [] }; } }
    static save(data) { try { this.storage()?.setItem(this.key, JSON.stringify(data)); } catch { /* localStorage無効時はゲーム継続を優先 */ } }
    static record(word, state) { const data = this.load(); if (!data.learned.includes(word.id)) data.learned.push(word.id); data.records[state.settings.mode] = Math.max(data.records[state.settings.mode] || 0, state.score); this.save(data); }
  }

  class GameController {
    constructor() { this.settings = { ...DEFAULT_SETTINGS }; this.state = null; this.validator = null; this.cpu = null; this.timer = new TimerManager(turnId => this.timeout(turnId)); this.isProcessing = false; this.currentTurnId = 0; this.cpuTimeout = null; }
    words() { return getThemeWords(window.MANABI_DATA, this.settings.theme); }
    theme() { return THEMES[this.settings.theme] || THEMES.prefectures; }
    startGame(settings) {
      this.cleanupAsync();
      this.settings = { ...DEFAULT_SETTINGS, ...settings };
      this.state = new GameState(this.settings, this.words());
      this.validator = new WordValidator(this.state.words, this.settings);
      this.cpu = new ComputerPlayer(this.validator, this.settings);
      if (this.settings.mode === 'local') this.state.players = createLocalPlayers(this.settings.localPlayers);
      this.advanceTurn(); UI.showGame(this.state); this.resetTimer();
    }
    submit(input) {
      if (this.isProcessing || !this.state?.active || this.state.isCpuThinking) return;
      this.isProcessing = true; UI.setInputDisabled(true);
      const turnId = this.currentTurnId;
      const result = this.validator.validate(input, this.state);
      if (turnId !== this.currentTurnId || !this.state.active) return this.finishProcessing();
      result.ok ? this.acceptWord(result.word, 'player') : this.reject(result);
      window.setTimeout(() => this.finishProcessing(), 180);
    }
    finishProcessing() { this.isProcessing = false; UI.setInputDisabled(Boolean(this.state?.isCpuThinking)); }
    acceptWord(word, actor) {
      if (!this.state?.active) return;
      this.timer.stop(); this.state.usedIds.add(word.id); this.state.history.push({ word, actor, player: this.currentPlayerName() });
      if (this.settings.mode === 'local') { const p = this.state.players[this.state.turn]; if (p) { p.correctCount += 1; p.lastWord = word.name; } }
      this.state.requiredChar = WordNormalizer.lastChar(word.reading, this.settings); ScoreManager.addCorrect(this.state); StorageManager.record(word, this.state);
      this.state.message = `${actor === 'cpu' ? 'CPUの答え' : '正解'}！ 次は「${this.state.requiredChar}」です。`;
      if (this.state.usedIds.size >= this.state.words.length) return this.finishNoCandidates('全都道府県を使い切りました！');
      if (this.settings.mode === 'local' && this.state.requiredChar && this.validator.candidates(this.state.requiredChar, this.state.usedIds).length === 0) return this.finishNoCandidates('続けられる候補がなくなりました。');
      if (this.settings.mode === 'cpu' && actor === 'player') return this.startCpuTurn();
      if (this.settings.mode === 'local') { const next = findNextActivePlayer(this.state.turn, this.state.players); if (next.isGameOver) return this.finishLocalGame(); this.state.turn = next.index; }
      this.advanceTurn(); UI.showGame(this.state); this.resetTimer();
    }
    reject(result) {
      this.timer.stop(); this.state.message = result.reason;
      if (this.settings.mode === 'local') return this.eliminateCurrentPlayer(result.code || 'invalid-word', this.currentTurnId);
      if (this.settings.mode === 'solo' && !result.fatal) { UI.showGame(this.state); this.resetTimer(); return; }
      this.finish(result.reason);
    }
    startCpuTurn() {
      this.advanceTurn(); this.state.isCpuThinking = true; this.state.message = 'CPUが考えています…'; UI.showGame(this.state); UI.setInputDisabled(true);
      const turnId = this.currentTurnId;
      this.cpuTimeout = window.setTimeout(() => this.cpuTurn(turnId), 650);
    }
    cpuTurn(turnId) {
      if (!this.state?.active || turnId !== this.currentTurnId) return;
      this.state.isCpuThinking = false;
      const word = this.cpu.choose(this.state);
      if (!word) return this.finish('CPUが答えられる候補がありません。あなたの勝ちです！');
      this.acceptWord(word, 'cpu');
    }
    timeout(turnId) { if (!this.state?.active || turnId !== this.currentTurnId) return; if (this.settings.mode === 'local') return this.eliminateCurrentPlayer('timeout', turnId); this.finish('残り時間が0秒になりました。'); }
    resetTimer() { if (this.settings.timerEnabled && this.settings.mode !== 'solo' && !this.state.isCpuThinking) this.timer.start(this.settings.timeLimit, this.currentTurnId); else UI.renderTimer(null); }
    advanceTurn() { this.currentTurnId += 1; }
    currentPlayerName() { return this.settings.mode === 'local' ? (this.state.players[this.state.turn]?.name || `プレイヤー${this.state.turn + 1}`) : 'あなた'; }
    cleanupAsync() { this.timer.stop(); if (this.cpuTimeout) window.clearTimeout(this.cpuTimeout); this.cpuTimeout = null; this.isProcessing = false; this.currentTurnId += 1; }
    eliminateCurrentPlayer(reason, turnId = this.currentTurnId) {
      if (!this.state?.active || this.settings.mode !== 'local' || turnId !== this.currentTurnId || this.isProcessing === 'eliminating') return;
      this.isProcessing = 'eliminating'; this.timer.stop(); UI.setInputDisabled(true);
      const player = this.state.players[this.state.turn];
      if (!player?.isActive) return this.finishProcessing();
      player.isActive = false; player.eliminatedAt = this.state.eliminationOrder.length + 1; player.eliminationReason = reason; this.state.eliminationOrder.push(player.id);
      const remaining = activePlayers(this.state.players);
      this.state.message = `${player.name} が脱落しました（${ELIMINATION_LABELS[reason] || reason}）。`;
      if (remaining.length <= 1) return this.finishLocalGame();
      const next = findNextActivePlayer(this.state.turn, this.state.players);
      this.state.turn = next.index; this.advanceTurn(); UI.showGame(this.state); this.resetTimer(); this.finishProcessing();
    }
    finishNoCandidates(message) {
      if (this.settings.mode === 'local') { const last = this.state.history.at(-1); const winner = this.state.players.find(p => p.name === last?.player) || activePlayers(this.state.players)[0]; this.finishLocalGame(message, winner?.id); return; }
      this.finish(message);
    }
    finishLocalGame(message = '最後の1人が決まりました。', winnerId = null) {
      if (!this.state) return; this.cleanupAsync(); this.state.active = false; this.state.isCpuThinking = false;
      const winner = winnerId ? this.state.players.find(p => p.id === winnerId) : activePlayers(this.state.players)[0];
      this.state.winner = winner?.name || ''; this.state.rankings = buildRankings(this.state.players, this.state.eliminationOrder, winner?.id); this.state.message = message; UI.showResult(this.state);
    }
    finish(message) { if (!this.state) return; this.cleanupAsync(); this.state.active = false; this.state.isCpuThinking = false; this.state.message = message; this.state.winner = message.includes('CPUが答えられる候補がありません') ? 'あなた' : ''; UI.showResult(this.state); }
    leaveGame() { this.cleanupAsync(); if (this.state) this.state.active = false; }
  }

  const controller = new GameController();

  class UIController {
    constructor(app) { this.app = app; this.pendingMode = 'solo'; }
    button(label, action, cls = '') { return `<button class="${cls}" data-action="${action}" type="button">${label}</button>`; }
    renderTitle() { controller.leaveGame(); this.app.innerHTML = `<main class="screen hero"><p class="eyebrow">教育型しりとりゲーム</p><h1>まなびしりとり</h1><p>都道府県の名前をつなげながら、自然に日本地図にくわしくなろう。</p><div class="actions">${this.button('ゲームをはじめる','mode','primary')}${this.button('遊び方','help')}${this.button('図鑑（準備中）','coming')}</div></main>`; }
    renderModes() { controller.leaveGame(); this.app.innerHTML = `<main class="screen"><h2>モードを選んでください</h2><div class="card-grid">${this.modeCard('solo','ひとりで練習','間違えても続けやすい練習モード。')}${this.modeCard('cpu','コンピュータと対戦','CPUと交互に答えます。')}${this.modeCard('local','みんなで対戦','1台の端末で2〜4人プレイ。')}${this.modeCard('online','オンライン対戦準備中','将来追加予定です。')}</div>${this.button('タイトルへ戻る','title')}</main>`; }
    modeCard(id, title, desc) { return `<button class="card" data-mode="${id}" type="button"><strong>${title}</strong><span>${desc}</span></button>`; }
    renderSettings(mode) {
      controller.leaveGame(); const disabled = mode === 'online'; this.pendingMode = mode;
      this.app.innerHTML = `<main class="screen"><h2>${disabled ? 'オンライン対戦は準備中' : 'ゲーム設定'}</h2>${disabled ? '<p>フェーズ1では実装しません。</p>' : `<section class="panel"><h3>テーマ</h3>${this.themeOptions()}<label>レベル<select id="level"><option value="kids">キッズ</option><option value="standard" selected>スタンダード</option><option value="challenge">チャレンジ</option></select></label>${mode==='cpu'?'<label>CPU難易度<select id="cpuLevel"><option value="easy">やさしい</option><option value="normal" selected>ふつう</option><option value="hard">むずかしい</option></select></label>':''}${mode==='local'?'<label>人数<select id="localPlayers"><option>2</option><option>3</option><option>4</option></select></label>':''}<label>制限時間<select id="timeLimit"><option value="30">30秒</option><option value="45" selected>45秒</option><option value="60">60秒</option></select></label><details><summary>詳細設定</summary><label><input type="checkbox" id="includeSuffix"> 都・道・府・県を含めて判定</label></details>${this.button('この設定ではじめる','start','primary')}</section>`}${this.button('戻る','mode')}</main>`;
    }
    themeOptions() { return `<div class="theme-list">${Object.values(THEMES).map(t => { const stats = getThemeStats(window.MANABI_DATA, t.id); const disabled = !stats.isPlayable; return `<label class="theme-option ${disabled ? 'disabled' : ''}"><input type="radio" name="theme" value="${t.id}" ${t.id === 'prefectures' ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>${t.icon} ${t.name}</span><small>${stats.count ? `${stats.count}語` : '準備中'} / ${t.description}</small></label>`; }).join('')}</div>`; }
    showGame(state) {
      const last = state.history.at(-1); const used = state.history.slice(-10).map(h => `<li>${h.word.name}<small>${h.word.reading}</small></li>`).join('');
      this.app.innerHTML = `<main class="screen game"><div class="status"><span>現在: ${state.isCpuThinking ? 'CPU' : controller.currentPlayerName()}</span><span>スコア: ${state.score}</span><span>コンボ: ${state.combo}</span><span id="timer">--</span></div><section class="play-card"><p class="message">${state.message}</p><p>前の言葉: <strong>${last ? last.word.name : 'なし'}</strong></p><p class="needed">次に必要な文字: <strong>${state.requiredChar || '自由'}</strong></p><form id="answerForm" class="answer"><input id="answerInput" autocomplete="off" inputmode="text" aria-label="答えを入力" placeholder="例：東京都 / 東京 / とうきょうと" ${state.isCpuThinking ? 'disabled' : ''}><button id="submitBtn" class="primary" ${state.isCpuThinking ? 'disabled' : ''}>決定</button></form><div class="actions"><button type="button" data-action="hint">ヒント</button><button type="button" data-action="giveup">ギブアップ</button></div></section><section class="learn-card">${last ? `<h3>${last.word.name}</h3><p>${last.word.region}地方 / 県庁所在地: ${last.word.capital}</p><p>${last.word.trivia}</p>` : '<p>正解すると学習カードが表示されます。</p>'}</section>${this.playerStatusList(state)}<section><h3>使用済み</h3><ul class="used">${used}</ul></section></main>`;
      this.bindGame(); this.setInputDisabled(Boolean(state.isCpuThinking));
    }
    showResult(state) { const rows = state.settings.mode === 'local' ? `<section class="ranking"><h3>順位</h3>${state.rankings.map(r => `<div class="rank-row ${r.rank === 1 ? 'winner' : ''}"><strong>${r.rank}位：${r.name}</strong><span>正解 ${r.correctCount}回</span><span>${r.displayReason}</span><small>最後の回答：${r.lastWord || 'なし'}</small></div>`).join('')}</section>` : ''; this.app.innerHTML = `<main class="screen result"><h2>結果</h2><p class="message">${state.message}</p>${state.winner ? `<p>勝者: <strong>${state.winner}</strong></p>` : ''}${rows}<p>使用した言葉の総数: <strong>${state.usedIds.size}</strong></p><p>スコア: <strong>${state.score}</strong></p><p>最大コンボ: <strong>${state.combo}</strong></p><div class="actions">${this.button('もう一度遊ぶ','restart','primary')}${this.button('タイトルへ戻る','title')}</div></main>`; }
    bindGame() { const form = document.getElementById('answerForm'); form?.addEventListener('submit', e => { e.preventDefault(); controller.submit(document.getElementById('answerInput').value); }); document.getElementById('answerInput')?.focus(); }
    renderTimer(v) { const el = document.getElementById('timer'); if (el) el.textContent = v == null ? '時間なし' : `残り ${v}秒`; }
    setInputDisabled(v) { const input = document.getElementById('answerInput'); const b = document.getElementById('submitBtn'); if (input) input.disabled = v; if (b) b.disabled = v; }
    playerStatusList(state) { if (state.settings.mode !== 'local') return ''; return `<section class="players"><h3>プレイヤー状況（残り${activePlayers(state.players).length}人）</h3>${state.players.map((p, i) => `<div class="player-row ${p.isActive ? (i === state.turn ? 'current' : '') : 'eliminated'}"><strong>${p.name}</strong><span>${p.isActive ? (i === state.turn ? 'プレイ中' : '待機中') : `脱落：${ELIMINATION_LABELS[p.eliminationReason] || p.eliminationReason}`}</span><small>正解 ${p.correctCount}回</small></div>`).join('')}</section>`; }
    hint() { const state = controller.state; if (!state) return; const c = controller.validator.candidates(state.requiredChar, state.usedIds); window.alert(`ヒント: 「${state.requiredChar || '好きな文字'}」から始まる候補は${c.length}個です。例: ${c.slice(0,3).map(w=>w.name).join('、') || 'なし'}`); }
    help() { window.alert('前の言葉の最後の文字から始まる都道府県を入力します。同じ言葉は使えません。初期設定では「都・道・府・県」を除いて判定します。'); }
  }

  const UI = new UIController(document.getElementById('app'));
  window.UI = UI;

  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const mode = e.target.closest('[data-mode]')?.dataset.mode;
    if (mode) UI.renderSettings(mode);
    if (action === 'title') UI.renderTitle();
    if (action === 'mode') UI.renderModes();
    if (action === 'help') UI.help();
    if (action === 'coming') window.alert('フェーズ2で追加予定です。');
    if (action === 'start') controller.startGame({ mode: UI.pendingMode, theme: document.querySelector('input[name="theme"]:checked')?.value || 'prefectures', level: document.getElementById('level')?.value, cpuLevel: document.getElementById('cpuLevel')?.value || 'normal', localPlayers: Number(document.getElementById('localPlayers')?.value || 2), timeLimit: Number(document.getElementById('timeLimit')?.value || 45), stripPrefectureSuffix: !Boolean(document.getElementById('includeSuffix')?.checked) });
    if (action === 'hint') UI.hint();
    if (action === 'giveup') { if (controller.settings.mode === 'local') controller.eliminateCurrentPlayer('give-up', controller.currentTurnId); else controller.finish('ギブアップしました。'); }
    if (action === 'restart') controller.startGame(controller.settings);
  });

  console.info('まなびしりとり データ検証', Object.fromEntries(Object.keys(THEMES).map(id => [id, id === 'prefectures' ? validatePrefectureData(getThemeWords(window.MANABI_DATA, id)) : validateThemeData(getThemeWords(window.MANABI_DATA, id))])));
  UI.renderTitle();
})();
