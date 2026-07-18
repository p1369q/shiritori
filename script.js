(() => {
  'use strict';
  const countries = window.MANABI_DATA.countries;
  const { Engine, cpuProfile, last } = window.FlagGame;
  const app = document.getElementById('app');
  const levels = {1:'初級',2:'中級',3:'上級',4:'激ムズ'};
  const durationKey = 'shiritoriExplanationDuration';
  const durations = { short:2000, normal:4000, long:7000, manual:null };
  const durationNames = { short:'短い（2秒）', normal:'ふつう（4秒）', long:'長い（7秒）', manual:'自分で進む' };
  const savedDuration = localStorage.getItem(durationKey);
  let explanationDuration = Object.hasOwn(durations, savedDuration) ? savedDuration : 'normal';
  let state = {}, timer = null;
  const hearts = n => '❤️'.repeat(Math.max(0,n)) + '♡'.repeat(Math.max(0,3-n));
  const flag = c => `<img class="flag" src="${c.flagFile}" alt="${c.name}の国旗">`;
  const clearTimer = () => { if (timer) window.clearTimeout(timer); timer = null; };
  const show = html => { app.innerHTML = `<section class="screen">${html}</section>`; };
  function title() {
    clearTimer(); state = { screen:'title' };
    const settings = Object.entries(durationNames).map(([value,label])=>`<label class="durationChoice"><input type="radio" name="explanationDuration" value="${value}" ${value===explanationDuration?'checked':''}><span>${label}</span></label>`).join('');
    show(`<div class="center"><p class="eyebrow">世界旅行クイズ</p><h1>国旗しりとり</h1><p class="lead">3つのライフで、国旗から国を選ぼう。国は再利用されるのでエンドレスで遊べます。</p><div class="modeGrid"><button data-mode="solo">1人で遊ぶ</button><button data-mode="local">みんなで対戦</button><button data-mode="cpu">コンピュータと対戦</button></div><fieldset class="durationSettings"><legend>回答後の解説時間</legend>${settings}</fieldset></div>`);
    document.querySelectorAll('[name=explanationDuration]').forEach(input=>input.onchange=()=>{ explanationDuration=input.value; localStorage.setItem(durationKey, explanationDuration); });
  }
  function setup(mode) {
    const cards = Object.entries(levels).map(([n,name]) => `<label class="levelCard"><input type="radio" name="quiz" value="${n}" ${n==='1'?'checked':''}><b>${name}</b><small>${['','有名な国を中心に出題','少し難しい国も登場','小国や似た国旗も登場','196か国すべてから出題'][n]}</small></label>`).join('');
    show(`<h2>難易度を選ぼう</h2><div class="levelGrid">${cards}</div>${mode==='cpu'?`<h3>CPUの強さ</h3><select id="cpuLevel">${Object.entries(levels).map(([n,x])=>`<option value="${n}">${x}</option>`).join('')}</select>`:''}${mode==='local'?'<label>人数 <select id="players"><option>2</option><option>3</option><option>4</option></select></label>':''}<div class="row"><button id="begin">スタート</button><button id="back" class="ghost">戻る</button></div>`);
    document.getElementById('back').onclick = title;
    document.getElementById('begin').onclick = () => start(mode, +document.querySelector('[name=quiz]:checked').value, +(document.getElementById('cpuLevel')?.value || 2), +(document.getElementById('players')?.value || 2));
  }
  const player = name => ({name, life:3, score:0, streak:0});
  function start(mode, difficulty, cpuLevel, count) {
    clearTimer(); const engine = new Engine(countries, {difficulty}); const current = engine.start();
    const players = mode==='cpu' ? [player('あなた'),player('CPU')] : Array.from({length:mode==='local'?count:1},(_,i)=>player(mode==='solo'?'あなた':`プレイヤー${i+1}`));
    state = {screen:'game',mode,difficulty,cpuLevel,engine,current,players,turn:0,ui:'ready',hint:0,more:false}; question();
  }
  function question() {
    clearTimer(); state.answer = state.engine.answer(state.current);
    if (!state.answer) { state.current = state.engine.start(); state.answer = state.engine.answer(state.current); }
    state.choices = state.engine.choices(state.answer); state.ui='ready'; state.hint=0; state.more=false; render();
    if (state.mode==='cpu' && state.turn===1) cpuTurn();
  }
  function status() {
    if (state.mode==='cpu') return `<header class="versus"><span>あなた ${hearts(state.players[0].life)} / ${state.players[0].score}問</span><b>${state.turn? 'CPU':'あなた'}の番</b><span>CPU ${hearts(state.players[1].life)} / ${state.players[1].score}問</span></header>`;
    const p=state.players[state.turn]; return `<header class="topbar"><span>${p.name}</span><span>正解 ${p.score} / 連続 ${p.streak}</span><span>${hearts(p.life)}</span></header>`;
  }
  function choice(c) { const picked=state.picked===c.id, right=c.id===state.answer.id, done=state.ui==='result'; return `<button class="choice ${done&&right?'isCorrect':''} ${done&&picked&&!right?'isWrong':''}" data-country="${c.id}" ${state.ui!=='ready'?'disabled':''}>${flag(c)}${done?`<b>${c.name}</b>`:'<b class="placeholder">国名</b>'}</button>`; }
  const line = (label,value) => value && (!Array.isArray(value) || value.length) ? `<div><dt>${label}</dt><dd>${Array.isArray(value)?value.join('、'):value}</dd></div>` : '';
  function learn() { if(state.ui!=='result') return ''; const c=state.answer, famous=[...(c.famousFoods||[]),...(c.famousPlaces||[]),...(c.specialties||[])].slice(0,3); const population=c.populationLabel ? c.populationLabel+(c.populationYear?`（${c.populationYear}年）`:'') : ''; const compact=[line('首都',c.capital),line('人口',population),line('面積',c.areaLabel),line('有名なもの',famous)].join(''); const details=[line('地域',c.region),line('主な言語',c.languages),line('通貨',c.currency),line('人口の基準年',c.populationYear&&`${c.populationYear}年`),line('世界遺産',c.worldHeritage),line('観光地',c.famousPlaces),line('代表料理',c.famousFoods),line('主な産業・名産',c.specialties),line('国旗の意味',c.flagMeaning),line('歴史や文化',c.extraFacts)].join(''); return `<aside class="learnSheet" aria-live="polite"><h3>${state.correct?'正解！':'残念！ 正解は'} ${c.name}</h3><dl class="factList">${compact}</dl>${c.trivia?`<p class="trivia">${c.trivia}</p>`:''}<div class="learnActions"><button id="more" aria-expanded="${state.more}">${state.more?'閉じる':'もっと見る'}</button><button id="next">次へ</button></div>${state.more&&details?`<dl class="details factList">${details}</dl>`:''}</aside>`; }
  function render() {
    const hints=(state.answer?.hints||[]).slice(0,state.hint); show(`${status()}<span class="badge">出題 ${levels[state.difficulty]}${state.mode==='cpu'?` / CPU ${levels[state.cpuLevel]}`:''}</span><section class="currentCountry">${flag(state.current)}<div><small>現在の国</small><strong>${state.current.name}</strong><small>${state.current.reading}</small></div></section><h2 class="question">「${last(state.current)}」から始まる国</h2>${state.ui==='thinking'?'<p class="thinking">コンピュータが考えています…</p>':''}<div class="choices">${state.choices.map(choice).join('')}</div><div class="hintPanel">${hints.map(h=>`<p>${h}</p>`).join('')}</div>${learn()}<footer class="gameActions"><button id="hint" ${state.ui!=='ready'||state.mode==='cpu'&&state.turn?'disabled':''}>${state.hint===0?'ヒントを見る':state.hint<3?'ヒントをもう1つ見る':'ヒントを閉じる'}</button><button id="menu">メニュー</button></footer>`);
    document.querySelectorAll('[data-country]').forEach(b=>b.onclick=()=>answer(b.dataset.country));
    document.getElementById('hint').onclick=()=>{state.hint=state.hint>=3?0:state.hint+1;render()}; document.getElementById('menu').onclick=title;
    document.getElementById('more')?.addEventListener('click',()=>{state.more=!state.more; clearTimer(); render(); if(!state.more)scheduleAdvance()}); document.getElementById('next')?.addEventListener('click',advance);
  }
  function answer(id) { if(state.ui!=='ready'||(state.mode==='cpu'&&state.turn))return; resolve(id); }
  function resolve(id) { clearTimer(); const p=state.players[state.turn], ok=id===state.answer.id; state.picked=id; state.correct=ok; state.ui='result'; if(ok){p.score++;p.streak++}else{p.life--;p.streak=0} render(); scheduleAdvance(); }
  function scheduleAdvance() { clearTimer(); const delay=durations[explanationDuration]; if(!state.more && delay!==null) timer=window.setTimeout(advance,delay+(state.correct?0:1000)); }
  function advance() { clearTimer(); const p=state.players[state.turn]; if(p.life<=0)return finish(`${p.name}のライフが0になりました`); state.engine.use(state.answer);state.current=state.answer; if(state.mode!=='solo')state.turn=(state.turn+1)%state.players.length; question(); }
  function cpuTurn() { state.ui='thinking';render();const profile=cpuProfile(state.cpuLevel,state.answer);timer=window.setTimeout(()=>{if(state.screen!=='game'||state.turn!==1)return;const ok=Math.random()<profile.probability;const pick=ok?state.answer:state.choices.find(c=>c.id!==state.answer.id);resolve(pick.id)},profile.delay); }
  function finish(message) { clearTimer(); const winner=state.mode==='cpu'?state.players[1-state.turn]?.name:'';show(`<div class="center"><h2>ゲーム終了</h2><p>${message}</p>${winner?`<h3>${winner}の勝ち！</h3>`:''}<button id="home">タイトルへ</button></div>`);document.getElementById('home').onclick=title; }
  document.addEventListener('click',e=>{const mode=e.target.dataset.mode;if(mode)setup(mode)}); title();
})();
