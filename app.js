(function () {
  'use strict';

  const C = window.Calc;
  const B = window.BaseN;
  const { M, state, scope, CalcError } = C;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const el = {
    input: $('#input'), expr: $('#exprTex'), result: $('#result'), extra: $('#resultExtra'), status: $('#status'),
    area: $('#modeArea'), keypad: $('#keypad'), calc: $('#calc'), modes: $('#modes'), angle: $('#angle'),
  };

  const MODES = [
    ['CALC', 'Calculate'], ['STAT', 'Statistics'], ['EQN', 'Equation'], ['MATRIX', 'Matrix'],
    ['VECTOR', 'Vector'], ['CMPLX', 'Complex'], ['BASE', 'Base-N'], ['TABLE', 'Table'],
  ];
  const PLACEHOLDER = {
    CALC: 'e.g. 2sin(30) + 3/4', EQN: 'e.g. X^2 - 5X + 6 = 0', TABLE: 'f(X), e.g. X^2 + 1', MATRIX: 'e.g. MatA*MatB',
    VECTOR: 'e.g. cross(VctA, VctB)', CMPLX: 'e.g. (3+4i)/(1-2i)', BASE: 'e.g. FF and 0F',
  };

  const ui = {
    shift: false, justEvaluated: false, last: null, formIndex: 0, history: [], base: 'DEC', baseAns: 0, baseHas: false,
    inputs: {}, registry: [], coarse: matchMedia('(pointer: coarse)').matches, keyboard: false,
  };
  const ws = { eqGuess: '1', eqLo: '-100', eqHi: '100', tG: '', tStart: '1', tEnd: '10', tStep: '1', statX: '', statY: '' };

  const editors = {
    MATRIX: {
      names: ['MatA', 'MatB', 'MatC'], sel: 'MatA', vector: false,
      data: {
        MatA: { r: 2, c: 2, raw: [['2', '1'], ['1', '3']] },
        MatB: { r: 2, c: 2, raw: [['1', '2'], ['3', '4']] },
        MatC: { r: 3, c: 3, raw: [['1', '0', '2'], ['0', '1', '0'], ['3', '0', '1']] },
      },
    },
    VECTOR: {
      names: ['VctA', 'VctB', 'VctC'], sel: 'VctA', vector: true,
      data: {
        VctA: { r: 1, c: 3, raw: [['1', '2', '3']] },
        VctB: { r: 1, c: 3, raw: [['4', '5', '6']] },
        VctC: { r: 1, c: 2, raw: [['3', '4']] },
      },
    },
  };
  scope.set('MatAns', M.matrix([[0]]));
  scope.set('VctAns', M.matrix([0, 0, 0]));

  function cellValue(t) {
    try { const v = C.evalReal(t.trim() === '' ? '0' : t); return isFinite(v) ? v : NaN; } catch (e) { return NaN; }
  }
  function commit(edKey, name) {
    const ed = editors[edKey];
    const d = ed.data[name];
    const arr = d.raw.map((row) => row.map(cellValue));
    if (arr.flat().some((v) => Number.isNaN(v))) return false;
    scope.set(name, M.matrix(ed.vector ? arr[0] : arr));
    return true;
  }
  Object.keys(editors).forEach((k) => editors[k].names.forEach((n) => commit(k, n)));

  function renderTex(node, src, display = true) {
    try { katex.render(src, node, { throwOnError: false, displayMode: display }); } catch (e) { node.textContent = src; }
  }

  // ---------- Keys ----------
  const K = (l, ins, o = {}) => ({ l, ins, ...o });
  const MAIN_FN = [
    [K('SHIFT', null, { act: 'shift', cls: 'k-shift small' }), K('STO', null, { act: 'sto', cls: 'small', s: 'CLR', sact: 'clrvars', aria: 'Store answer in a variable' }), K('RCL', null, { act: 'rcl', cls: 'small', aria: 'Recall a variable' }), K('◀', null, { act: 'left', aria: 'Move cursor left' }), K('▶', null, { act: 'right', aria: 'Move cursor right' }), K('S⇔D', null, { act: 'sd', cls: 'small', aria: 'Toggle fraction and decimal result' })],
    [K('x²', '^2', { s: 'x³', sins: '^3', aria: 'Square' }), K('xⁿ', '^(|)', { s: 'ⁿ√x', sins: 'root(|, )', aria: 'Power' }), K('√', 'sqrt(|)', { s: '∛', sins: 'cbrt(|)', aria: 'Square root' }), K('x⁻¹', '^(-1)', { s: 'x!', sins: '!', aria: 'Reciprocal' }), K('log', 'log10(|)', { s: '10ˣ', sins: '10^(|)' }), K('ln', 'ln(|)', { s: 'eˣ', sins: 'e^(|)' })],
    [K('sin', 'sin(|)', { s: 'sin⁻¹', sins: 'asin(|)' }), K('cos', 'cos(|)', { s: 'cos⁻¹', sins: 'acos(|)' }), K('tan', 'tan(|)', { s: 'tan⁻¹', sins: 'atan(|)' }), K('sinh', 'sinh(|)', { s: 'sinh⁻¹', sins: 'asinh(|)' }), K('cosh', 'cosh(|)', { s: 'cosh⁻¹', sins: 'acosh(|)' }), K('tanh', 'tanh(|)', { s: 'tanh⁻¹', sins: 'atanh(|)' })],
    [K('a/b', '/', { s: 'a b/c', sins: 'mixed(|, , )', aria: 'Fraction' }), K('logₐb', 'logab(|, )', { aria: 'Logarithm with custom base' }), K('|x|', 'abs(|)', { s: 'Rnd', sins: 'round(|)', aria: 'Absolute value' }), K('nPr', 'nPr(|, )', { s: 'nCr', sins: 'nCr(|, )', aria: 'Permutations' }), K('Pol', 'Pol(|, )', { s: 'Rec', sins: 'Rec(|, )', aria: 'Rectangular to polar' }), K('Ran#', 'Ran()', { s: 'RanInt', sins: 'RanInt(|, )', aria: 'Random number' })],
    [K('(', '('), K(')', ')'), K(',', ', ', { aria: 'Comma' }), K('π', 'pi', { s: 'e', sins: 'e', aria: 'Pi' }), K('Σ', 'summation(|, 1, 10)', { aria: 'Summation' }), K('∫', 'integral(|, 0, 1)', { aria: 'Integral' })],
    [K('d/dx', 'ddx(|, 1)', { aria: 'Derivative' }), K('X', 'X'), K('%', '%', { aria: 'Percent' }), K('(−)', '-', { neg: true, aria: 'Negative' }), K('SOLVE', null, { act: 'solve', cls: 'small' }), K('CONST', null, { act: 'const', cls: 'small', aria: 'Scientific constants' })],
  ];
  const EXE_LABEL = { EQN: 'Solve', TABLE: 'Table' };
  const mainNum = () => [
    [K('7', '7'), K('8', '8'), K('9', '9'), K('DEL', null, { act: 'del', cls: 'danger', aria: 'Delete' }), K('AC', null, { act: 'ac', cls: 'danger', aria: 'All clear' })],
    [K('4', '4'), K('5', '5'), K('6', '6'), K('×', '*', { cls: 'op', aria: 'Multiply' }), K('÷', '/', { cls: 'op', aria: 'Divide' })],
    [K('1', '1'), K('2', '2'), K('3', '3'), K('+', '+', { cls: 'op', aria: 'Plus' }), K('−', '-', { cls: 'op', aria: 'Minus' })],
    [K('0', '0'), K('.', '.', { aria: 'Decimal point' }), K('×10ˣ', '*10^(|)', { cls: 'op', aria: 'Times ten to the power' }), K('Ans', 'Ans', { cls: 'op' }), K(EXE_LABEL[state.mode] || '=', null, { act: 'exe', cls: 'exe', aria: EXE_LABEL[state.mode] || 'Equals' })],
  ];
  const EXTRA = {
    CMPLX: [K('i', 'i', { aria: 'Imaginary unit' }), K('∠', 'polar(|, )', { aria: 'Polar form r angle theta' }), K('arg', 'arg(|)'), K('conj', 'conj(|)', { aria: 'Conjugate' }), K('Re', 're(|)', { aria: 'Real part' }), K('Im', 'im(|)', { aria: 'Imaginary part' })],
    EQN: [K('X', 'X'), K('=', ' = ', { aria: 'Insert equals sign' }), K('X²', 'X^2'), K('X³', 'X^3')],
    MATRIX: [K('MatA', 'MatA'), K('MatB', 'MatB'), K('MatC', 'MatC'), K('MatAns', 'MatAns'), K('det', 'det(|)', { aria: 'Determinant' }), K('Mat⁻¹', 'inv(|)', { aria: 'Inverse' }), K('Trn', 'transpose(|)', { aria: 'Transpose' })],
    VECTOR: [K('VctA', 'VctA'), K('VctB', 'VctB'), K('VctC', 'VctC'), K('VctAns', 'VctAns'), K('dot', 'dot(|, )', { aria: 'Dot product' }), K('cross', 'cross(|, )', { aria: 'Cross product' }), K('|v|', 'norm(|)', { aria: 'Magnitude' }), K('angle', 'angle(|, )', { aria: 'Angle between vectors' })],
    TABLE: [K('X', 'X'), K('X²', 'X^2')],
  };
  function baseKeys() {
    const r = B.RADIX[ui.base];
    const d = (n) => K(n, n, { disabled: parseInt(n, 16) >= r });
    const fn = [
      'ABCDEF'.split('').map(d),
      [K('and', ' and ', { cls: 'small' }), K('or', ' or ', { cls: 'small' }), K('xor', ' xor ', { cls: 'small' }), K('xnor', ' xnor ', { cls: 'small' }), K('Not', 'not(|)', { cls: 'small', aria: 'Bitwise not' }), K('Neg', 'neg(|)', { cls: 'small', aria: 'Negate' })],
    ];
    const num = [
      [d('7'), d('8'), d('9'), K('DEL', null, { act: 'del', cls: 'danger', aria: 'Delete' }), K('AC', null, { act: 'ac', cls: 'danger', aria: 'All clear' })],
      [d('4'), d('5'), d('6'), K('×', '*', { cls: 'op', aria: 'Multiply' }), K('÷', '/', { cls: 'op', aria: 'Integer divide' })],
      [d('1'), d('2'), d('3'), K('+', '+', { cls: 'op', aria: 'Plus' }), K('−', '-', { cls: 'op', aria: 'Minus' })],
      [d('0'), K('(', '('), K(')', ')'), K('Ans', 'Ans', { cls: 'op' }), K('=', null, { act: 'exe', cls: 'exe', aria: 'Equals' })],
    ];
    return { fn, num };
  }

  function keyBtn(k) {
    const id = ui.registry.push(k) - 1;
    const cls = ['key', k.cls, k.s ? 'has-alt' : ''].filter(Boolean).join(' ');
    const label = k.aria || k.l;
    const aria = k.s ? ` aria-label="${esc(`${label} (shift: ${k.s})`)}"` : k.aria ? ` aria-label="${esc(k.aria)}"` : '';
    return `<button type="button" class="${cls}" data-k="${id}"${aria}${k.disabled ? ' disabled' : ''}>${k.s ? `<span class="alt" aria-hidden="true">${esc(k.s)}</span>` : ''}<span class="main">${esc(k.l)}</span></button>`;
  }
  const grid = (rows, cls) => `<div class="keys ${cls}">${rows.flat().map(keyBtn).join('')}</div>`;

  function renderKeypad() {
    ui.registry = [];
    const m = state.mode;
    if (m === 'STAT') { el.keypad.innerHTML = ''; return; }
    if (m === 'BASE') {
      const { fn, num } = baseKeys();
      el.keypad.innerHTML = grid(fn, 'fn') + grid(num, 'num');
      return;
    }
    el.keypad.innerHTML = (EXTRA[m] ? grid([EXTRA[m]], 'extra') : '') + grid(MAIN_FN, 'fn') + grid(mainNum(), 'num');
  }

  el.keypad.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b || b.disabled) return;
    pressKey(ui.registry[+b.dataset.k]);
  });

  function setShift(on) {
    ui.shift = on;
    el.calc.classList.toggle('shift-on', on);
    renderStatus();
  }

  function pressKey(k) {
    if (k.act === 'shift') return setShift(!ui.shift);
    const useShift = ui.shift && (k.s || k.sact);
    setShift(false);
    const act = useShift ? k.sact : k.act;
    const ins = useShift ? (k.sins !== undefined ? k.sins : null) : k.ins;
    if (act) return actions[act]();
    if (ins != null) insert(ins, k);
  }

  // ---------- Input handling ----------
  function insert(text, k = {}) {
    const inp = el.input;
    let v = inp.value;
    let start = inp.selectionStart ?? v.length;
    let end = inp.selectionEnd ?? start;
    if (ui.justEvaluated) {
      ui.justEvaluated = false;
      const isOperator = /^\s*([\^!*/+\-%]|and|or|xor|xnor)/.test(text) && !k.neg;
      if (isOperator && ui.last) { v = 'Ans'; start = end = 3; }
      else { v = ''; start = end = 0; }
    }
    const cur = text.indexOf('|');
    const clean = text.replace('|', '');
    v = v.slice(0, start) + clean + v.slice(end);
    setInput(v, start + (cur >= 0 ? cur : clean.length));
  }

  function setInput(v, pos) {
    el.input.value = v;
    const p = pos ?? v.length;
    try { el.input.setSelectionRange(p, p); } catch (e) { /* input may be hidden */ }
    if (!ui.coarse || ui.keyboard) el.input.focus({ preventScroll: true });
    onInputChange();
  }

  function onInputChange() {
    ui.inputs[state.mode] = el.input.value;
    el.result.classList.add('stale');
    renderPreview();
  }

  el.input.addEventListener('input', () => { ui.justEvaluated = false; onInputChange(); });
  el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      execute();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      actions.ac();
    }
  });

  function renderPreview() {
    const v = el.input.value;
    el.expr.classList.remove('placeholder', 'raw');
    if (!v.trim()) {
      el.expr.classList.add('placeholder');
      el.expr.textContent = state.mode === 'STAT' ? '' : PLACEHOLDER[state.mode] || '';
      return;
    }
    if (state.mode === 'BASE') {
      el.expr.classList.add('raw');
      el.expr.textContent = v.replace(/\*/g, '×').replace(/\//g, '÷');
      return;
    }
    const t = C.toTex(v);
    if (t === null) { el.expr.classList.add('raw'); el.expr.textContent = v; return; }
    renderTex(el.expr, t);
  }

  function moveCaret(d) {
    const i = el.input;
    const p = Math.max(0, Math.min(i.value.length, (i.selectionStart ?? i.value.length) + d));
    i.setSelectionRange(p, p);
    if (!ui.coarse || ui.keyboard) i.focus({ preventScroll: true });
    ui.justEvaluated = false;
  }

  const WORD_DELETE = /(?:\s*\b(?:xnor|xor|and|or)\s*|[A-Za-z_][A-Za-z0-9_]*\(|\b(?:Ans|pi|Mat(?:A|B|C|Ans)|Vct(?:A|B|C|Ans))|\*10\^\()$/;
  function del() {
    const i = el.input;
    const v = i.value;
    const s = i.selectionStart ?? v.length;
    const e = i.selectionEnd ?? s;
    ui.justEvaluated = false;
    if (s !== e) return setInput(v.slice(0, s) + v.slice(e), s);
    if (s === 0) return;
    const m = WORD_DELETE.exec(v.slice(0, s));
    const n = m ? m[0].length : 1;
    setInput(v.slice(0, s - n) + v.slice(s), s - n);
  }

  // ---------- Results ----------
  function clearResult() {
    ui.last = null;
    el.result.innerHTML = '';
    el.result.classList.remove('stale', 'mono');
    el.extra.innerHTML = '';
  }

  function showError(err) {
    ui.last = null;
    ui.justEvaluated = false;
    el.result.classList.remove('stale', 'mono');
    el.result.innerHTML = `<div class="err" role="alert"><strong>${esc(err.title)}</strong><span>${esc(err.detail)}</span></div>`;
    el.extra.innerHTML = '';
  }

  function currentForm() {
    const l = ui.last;
    if (!l) return null;
    return l.forms ? l.forms[ui.formIndex] : l;
  }

  function renderResult() {
    const l = ui.last;
    el.result.classList.remove('stale', 'mono');
    el.extra.innerHTML = '';
    if (!l) { el.result.innerHTML = ''; return; }
    if (l.mono) {
      el.result.classList.add('mono');
      el.result.textContent = l.text;
    } else {
      renderTex(el.result, currentForm().tex);
    }
    if (l.forms && l.forms.length > 1) {
      el.extra.innerHTML = `<span class="chip">${esc(currentForm().label)}</span><span>Press S⇔D to switch form</span>`;
    }
    if (l.polar) {
      el.extra.innerHTML = '<span>Polar form</span><span class="polar"></span>';
      renderTex($('.polar', el.extra), l.polar, false);
    }
    if (l.note) {
      const s = document.createElement('span');
      s.textContent = l.note;
      el.extra.appendChild(s);
    }
  }

  function storeAns(value, out) {
    const v = C.lastOf(value);
    if (v && v.pair) { scope.set('Ans', out.first); return; }
    scope.set('Ans', v);
    if (M.isMatrix(v)) {
      const size = v.size();
      if (size.length === 2) scope.set('MatAns', v);
      if (size.length === 1) scope.set('VctAns', v);
    }
  }

  function execute() {
    const src = el.input.value;
    if (!src.trim()) {
      if (ui.last) return;
      return showError({ title: 'Syntax ERROR', detail: 'Type an expression first.' });
    }
    if (state.mode === 'BASE') return execBase(src);
    if (state.mode === 'EQN') return execEqn(src);
    if (state.mode === 'TABLE') return execTable(src);
    return execCalc(src);
  }

  function execCalc(src) {
    try {
      const value = C.evaluate(src);
      const out = C.formatValue(value);
      storeAns(value, out);
      ui.last = out;
      ui.formIndex = out.forms && out.forms.length > 1 && /\/|mixed|sqrt|√|pi|π/.test(src) ? 1 : 0;
      renderResult();
      addHistory(src, currentForm().tex, currentForm().plain);
      ui.justEvaluated = true;
      renderMemory();
    } catch (e) {
      showError(C.explain(e));
    }
  }

  function readNum(id, fallback) {
    const t = String(ws[id] ?? '').trim();
    if (!t) return fallback;
    const v = C.evalReal(t);
    return v;
  }

  function execEqn(src) {
    try {
      let guess, lo, hi;
      try {
        guess = readNum('eqGuess', 1); lo = readNum('eqLo', -100); hi = readNum('eqHi', 100);
      } catch (e) {
        throw new CalcError('Argument ERROR', 'The initial guess and search range must be numbers.');
      }
      const roots = C.solve(src, guess, lo, hi);
      if (!roots.length) throw new CalcError('Can’t Solve', 'No real solution was found in the search range. Try a different initial guess or a wider range.');
      scope.set('X', roots[0]);
      scope.set('Ans', roots[0]);
      const f = roots.map((r) => C.fmtNum(r));
      const tex = roots.length === 1
        ? `X=${f[0].tex}`
        : `\\begin{aligned}${f.map((x, i) => `X_{${i + 1}}&=${x.tex}`).join('\\\\')}\\end{aligned}`;
      ui.last = { tex, text: f.map((x) => x.text).join(', '), plain: f[0].plain, note: `${roots.length} solution${roots.length > 1 ? 's' : ''} found · X = first solution` };
      renderResult();
      addHistory(src, roots.length === 1 ? tex : f.map((x, i) => `X_{${i + 1}}=${x.tex}`).join(',\\;'), f[0].plain);
      ui.justEvaluated = false;
      renderMemory();
    } catch (e) {
      showError(C.explain(e));
    }
  }

  function execTable(src) {
    const out = $('#tableOut');
    try {
      let start, end, step;
      try {
        start = readNum('tStart', 1); end = readNum('tEnd', 10); step = readNum('tStep', 1);
      } catch (e) {
        throw new CalcError('Argument ERROR', 'Start, end and step must be numbers.');
      }
      if (!(step > 0)) throw new CalcError('Argument ERROR', 'Step must be a positive number.');
      if (end < start) throw new CalcError('Argument ERROR', 'End must be greater than or equal to start.');
      const count = Math.floor((end - start) / step + 1e-9) + 1;
      if (count > 200) throw new CalcError('Range ERROR', `That would create ${count} rows. The table supports up to 200 — increase the step.`);
      const f = C.compileX(src);
      const gSrc = ws.tG.trim();
      const gfn = gSrc ? C.compileX(gSrc) : null;
      const cell = (fn, x) => { try { return { t: C.fmtNum(fn(x)).text }; } catch (e) { return { t: 'ERROR', e: true }; } };
      const rows = [];
      for (let i = 0; i < count; i++) {
        const x = +(start + i * step).toPrecision(12);
        const a = cell(f, x);
        const b = gfn ? cell(gfn, x) : null;
        rows.push(`<tr><td>${esc(C.fmtNum(x).text)}</td><td class="${a.e ? 'e' : ''}">${esc(a.t)}</td>${b ? `<td class="${b.e ? 'e' : ''}">${esc(b.t)}</td>` : ''}</tr>`);
      }
      out.innerHTML = `<table><caption class="sr-only">Function table</caption><thead><tr><th scope="col">X</th><th scope="col">f(X)</th>${gfn ? '<th scope="col">g(X)</th>' : ''}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
      ui.last = { tex: `\\text{${count} rows}`, note: 'Table generated below' };
      renderResult();
    } catch (e) {
      if (out) out.innerHTML = '';
      showError(C.explain(e));
    }
  }

  function execBase(src) {
    try {
      const v = B.evaluate(src, ui.base, ui.baseAns);
      ui.baseAns = v;
      ui.baseHas = true;
      const text = B.format(v, ui.base);
      ui.last = { mono: true, text: ui.base === 'BIN' ? B.group(text, 4) : text, note: ui.base };
      renderResult();
      renderReadouts();
      addHistory(src, null, text, `= ${text}`);
      ui.justEvaluated = true;
    } catch (e) {
      showError(C.explain(e));
    }
  }

  // ---------- Actions ----------
  const actions = {
    sto: () => openVarDialog('store'),
    rcl: () => openVarDialog('recall'),
    clrvars: () => {
      ['A', 'B', 'C', 'D', 'E', 'F', 'X'].forEach((k) => scope.set(k, 0));
      renderMemory();
      flashNote('Variables A–F and X cleared');
    },
    left: () => moveCaret(-1),
    right: () => moveCaret(1),
    sd: () => {
      const l = ui.last;
      if (!l || !l.forms || l.forms.length < 2) return flashNote('No alternative form for this result');
      ui.formIndex = (ui.formIndex + 1) % l.forms.length;
      renderResult();
    },
    del,
    ac: () => { setInput('', 0); clearResult(); ui.justEvaluated = false; if (state.mode === 'TABLE' && $('#tableOut')) $('#tableOut').innerHTML = ''; },
    exe: execute,
    solve: () => {
      if (state.mode === 'EQN') return execute();
      setMode('EQN', el.input.value);
    },
    const: () => { selectTab('const'); if (window.innerWidth < 1000) $('.side').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  };

  function flashNote(text) {
    el.extra.innerHTML = `<span class="chip">${esc(text)}</span>`;
  }

  // ---------- Modes ----------
  function renderModes() {
    el.modes.innerHTML = MODES.map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" aria-selected="${state.mode === id}" aria-controls="calc" data-mode="${id}">${label}</button>`).join('');
  }
  el.modes.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  });
  el.modes.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const idx = MODES.findIndex(([id]) => id === state.mode);
    const next = MODES[(idx + (e.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length][0];
    setMode(next);
    $(`#tab-${next}`).focus();
  });

  function setMode(m, preset) {
    ui.inputs[state.mode] = el.input.value;
    state.mode = m;
    el.calc.dataset.mode = m;
    el.calc.setAttribute('aria-labelledby', `tab-${m}`);
    [...el.modes.children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    $(`#tab-${m}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    el.input.placeholder = PLACEHOLDER[m] || '';
    ui.justEvaluated = false;
    setShift(false);
    renderWorkspace();
    renderKeypad();
    clearResult();
    const v = preset !== undefined ? preset : ui.inputs[m] || '';
    el.input.value = v;
    try { el.input.setSelectionRange(v.length, v.length); } catch (e) { /* noop */ }
    onInputChange();
    el.result.classList.remove('stale');
    renderStatus();
  }

  function renderStatus() {
    const modeLabel = MODES.find(([id]) => id === state.mode)[1];
    const ang = { DEG: 'D', RAD: 'R', GRA: 'G' }[state.angle];
    el.status.innerHTML = `
      <span class="ind ${ui.shift ? 'on' : ''}" aria-live="polite">${ui.shift ? 'Shift' : 'S'}</span>
      <span class="ind" title="Angle unit">${ang}</span>
      <span class="ind">${esc(modeLabel)}</span>
      ${state.mode === 'BASE' ? `<span class="ind">${ui.base}</span>` : ''}
      <span class="spacer"></span>
      ${ui.coarse ? `<button type="button" id="kbToggle" aria-pressed="${ui.keyboard}">${ui.keyboard ? 'Hide keyboard' : 'Type'}</button>` : ''}`;
  }
  el.status.addEventListener('click', (e) => {
    if (!e.target.closest('#kbToggle')) return;
    ui.keyboard = !ui.keyboard;
    el.input.setAttribute('inputmode', ui.keyboard ? 'text' : 'none');
    renderStatus();
    if (ui.keyboard) el.input.focus(); else el.input.blur();
  });

  el.angle.addEventListener('click', (e) => {
    const b = e.target.closest('[data-angle]');
    if (!b) return;
    state.angle = b.dataset.angle;
    [...el.angle.children].forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    renderStatus();
    if (ui.last) el.result.classList.add('stale');
  });

  // ---------- Workspaces ----------
  const chips = (list) => `<div class="chips" role="group" aria-label="Examples">${list.map((x) => `<button type="button" data-set="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
  const field = (id, label, extra = '') => `<label class="field"><span>${label}</span><input id="${id}" value="${esc(ws[id])}" inputmode="decimal" autocomplete="off" ${extra}></label>`;

  function renderWorkspace() {
    const m = state.mode;
    let html = '';
    if (m === 'CMPLX') {
      html = `<div class="ws"><p class="hint">Use <b>i</b> for the imaginary unit and <b>∠</b> for polar input (r∠θ). Results show both a + bi and polar form, with angles in the selected unit.</p>${chips(['(3+4i)*(1-2i)', 'sqrt(-9)', 'polar(2, 45)', 'abs(3+4i)', 'conj(2-5i)', 'e^(i*pi)'])}</div>`;
    } else if (m === 'EQN') {
      html = `<div class="ws"><p class="hint">Type an equation in <b>X</b> (use the <b>=</b> key above the keypad), then press <b>Solve</b>. Without “=”, the expression is solved for 0.</p>
        <div class="ws-row three">${field('eqGuess', 'Initial guess')}${field('eqLo', 'Search from')}${field('eqHi', 'Search to')}</div>
        ${chips(['X^2 - 5X + 6 = 0', 'X^3 - 2X - 5 = 0', 'sin(X) = 0.5', 'e^X = 3X', '2X + 3 = 7'])}</div>`;
    } else if (m === 'TABLE') {
      html = `<div class="ws"><p class="hint">Enter <b>f(X)</b> on the expression line, optionally add g(X), then press <b>Table</b>.</p>
        <label class="field"><span>g(X) <em>(optional)</em></span><input id="tG" class="mono" value="${esc(ws.tG)}" autocomplete="off" spellcheck="false" placeholder="e.g. 2^X"></label>
        <div class="ws-row three">${field('tStart', 'Start')}${field('tEnd', 'End')}${field('tStep', 'Step')}</div>
        ${chips(['X^2 + 1', 'sin(X)', '2^X', 'X!', 'sqrt(X)'])}
        <div id="tableOut" class="table-wrap"></div></div>`;
    } else if (m === 'MATRIX' || m === 'VECTOR') {
      html = editorHTML(m);
    } else if (m === 'BASE') {
      html = `<div class="ws"><div class="ws-head"><div class="seg" role="radiogroup" aria-label="Number base" id="baseSeg">${['DEC', 'HEX', 'BIN', 'OCT'].map((b) => `<button type="button" role="radio" aria-checked="${ui.base === b}" data-base="${b}">${b}</button>`).join('')}</div><span class="hint">32-bit integers · two’s complement</span></div>
        <div class="readouts" role="group" aria-label="Last result in every base" id="readouts"></div></div>`;
    } else if (m === 'STAT') {
      html = statHTML();
    }
    el.area.innerHTML = html;
    if (m === 'MATRIX' || m === 'VECTOR') renderCells(m);
    if (m === 'BASE') renderReadouts();
  }

  el.area.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id && Object.prototype.hasOwnProperty.call(ws, t.id)) ws[t.id] = t.value;
    if (t.dataset.cell) onCellInput(t);
    if (t.id === 'estX' || t.id === 'estY') renderEstimate();
  });
  el.area.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.dim) onDimChange(t);
  });
  el.area.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.set !== undefined) { ui.justEvaluated = false; setInput(t.dataset.set); return; }
    if (t.dataset.expr) { setInput(t.dataset.expr); execute(); return; }
    if (t.dataset.sel) { editors[state.mode].sel = t.dataset.sel; renderWorkspace(); return; }
    if (t.dataset.base) return switchBase(t.dataset.base);
    if (t.dataset.ins) { insertInto('CALC', t.dataset.ins); return; }
    if (t.id === 'statRun') return runStats();
    if (t.id === 'statSample') {
      ws.statX = '1, 2, 3, 4, 5, 6, 7, 8';
      ws.statY = '2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8, 16.1';
      renderWorkspace();
      runStats();
      return;
    }
    if (t.id === 'statClear') { ws.statX = ''; ws.statY = ''; renderWorkspace(); }
  });

  // Matrix & vector editors
  function editorHTML(m) {
    const ed = editors[m];
    const d = ed.data[ed.sel];
    const short = ed.sel.slice(3);
    const dims = ed.vector
      ? `<label class="mini">Dimension <select data-dim="c">${[2, 3].map((n) => `<option ${d.c === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
      : `<label class="mini">Rows <select data-dim="r">${[1, 2, 3, 4].map((n) => `<option ${d.r === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
         <label class="mini">Cols <select data-dim="c">${[1, 2, 3, 4].map((n) => `<option ${d.c === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    const quick = ed.vector
      ? [['A + B', 'VctA+VctB'], ['A − B', 'VctA-VctB'], ['A · B', 'dot(VctA, VctB)'], ['A × B', 'cross(VctA, VctB)'], [`|${short}|`, `norm(${ed.sel})`], ['Angle A, B', 'angle(VctA, VctB)'], [`Unit ${short}`, `${ed.sel}/norm(${ed.sel})`], [`3 × ${short}`, `3*${ed.sel}`]]
      : [['A + B', 'MatA+MatB'], ['A − B', 'MatA-MatB'], ['A × B', 'MatA*MatB'], [`det(${short})`, `det(${ed.sel})`], [`${short}⁻¹`, `inv(${ed.sel})`], [`${short}ᵀ`, `transpose(${ed.sel})`], [`${short}²`, `${ed.sel}^2`], [`2 × ${short}`, `2*${ed.sel}`]];
    return `<div class="ws">
      <div class="ws-head"><div class="seg" role="radiogroup" aria-label="${ed.vector ? 'Vector' : 'Matrix'} to edit">${ed.names.map((n) => `<button type="button" role="radio" aria-checked="${ed.sel === n}" data-sel="${n}">${n}</button>`).join('')}</div>${dims}</div>
      <div class="matrix-frame"><div class="cells" id="cells"></div></div>
      <div class="quick" role="group" aria-label="Quick operations">${quick.map(([l, x]) => `<button type="button" data-expr="${esc(x)}">${esc(l)}</button>`).join('')}</div>
      <p class="hint">Cells accept numbers or expressions such as 1/3 or sqrt(2). Use ${ed.names.join(', ')} and ${ed.vector ? 'VctAns' : 'MatAns'} on the expression line.</p></div>`;
  }

  function renderCells(m) {
    const ed = editors[m];
    const d = ed.data[ed.sel];
    const box = $('#cells');
    box.style.gridTemplateColumns = `repeat(${d.c}, minmax(0, 1fr))`;
    let html = '';
    for (let i = 0; i < d.r; i++) {
      for (let j = 0; j < d.c; j++) {
        const t = d.raw[i][j];
        const bad = Number.isNaN(cellValue(t));
        html += `<input data-cell="${i},${j}" value="${esc(t)}" inputmode="decimal" autocomplete="off" aria-label="${ed.sel} ${ed.vector ? `component ${j + 1}` : `row ${i + 1}, column ${j + 1}`}" aria-invalid="${bad}">`;
      }
    }
    box.innerHTML = html;
  }

  function onCellInput(t) {
    const ed = editors[state.mode];
    const d = ed.data[ed.sel];
    const [i, j] = t.dataset.cell.split(',').map(Number);
    d.raw[i][j] = t.value;
    t.setAttribute('aria-invalid', String(Number.isNaN(cellValue(t.value))));
    commit(state.mode, ed.sel);
  }

  function onDimChange(t) {
    const ed = editors[state.mode];
    const d = ed.data[ed.sel];
    const n = +t.value;
    if (t.dataset.dim === 'r') d.r = n; else d.c = n;
    const raw = [];
    for (let i = 0; i < d.r; i++) {
      raw.push([]);
      for (let j = 0; j < d.c; j++) raw[i].push(d.raw[i] && d.raw[i][j] !== undefined ? d.raw[i][j] : '0');
    }
    d.raw = raw;
    commit(state.mode, ed.sel);
    renderCells(state.mode);
  }

  // Base-N
  function renderReadouts() {
    const box = $('#readouts');
    if (!box) return;
    box.innerHTML = ['DEC', 'HEX', 'BIN', 'OCT'].map((b) => {
      const s = ui.baseHas ? B.format(ui.baseAns, b) : '—';
      return `<button type="button" data-base="${b}" aria-pressed="${ui.base === b}" aria-label="Switch to ${b}"><span class="b">${b}</span><span class="v">${esc(b === 'BIN' && ui.baseHas ? B.group(s, 4) : s)}</span></button>`;
    }).join('');
  }

  function switchBase(b) {
    ui.base = b;
    $('#baseSeg')?.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.base === b)));
    renderKeypad();
    renderReadouts();
    renderStatus();
    el.input.placeholder = b === 'HEX' ? 'e.g. FF and 0F' : b === 'BIN' ? 'e.g. 1010 xor 0110' : b === 'OCT' ? 'e.g. 17 + 5' : 'e.g. 12 or 5';
    if (ui.baseHas) {
      setInput(B.format(ui.baseAns, b));
      const text = B.format(ui.baseAns, b);
      ui.last = { mono: true, text: b === 'BIN' ? B.group(text, 4) : text, note: b };
      renderResult();
      ui.justEvaluated = true;
    } else {
      setInput('');
    }
  }

  // Statistics
  function statHTML() {
    return `<div class="ws">
      <div class="ws-row two">
        <label class="field"><span>X data</span><textarea id="statX" rows="4" spellcheck="false" placeholder="e.g. 2, 4, 4, 5, 7, 9">${esc(ws.statX)}</textarea></label>
        <label class="field"><span>Y data <em>(optional — enables regression)</em></span><textarea id="statY" rows="4" spellcheck="false" placeholder="Same number of values as X">${esc(ws.statY)}</textarea></label>
      </div>
      <p class="hint">Separate values with commas, spaces or new lines. Values can be expressions like 1/3.</p>
      <div class="ws-actions"><button type="button" class="btn primary" id="statRun">Calculate statistics</button><button type="button" class="btn" id="statSample">Load sample data</button><button type="button" class="btn ghost" id="statClear">Clear</button></div>
      <div id="statOut" class="ws" aria-live="polite"></div></div>`;
  }

  function parseList(text, label) {
    const parts = text.split(/[\s,;]+/).filter(Boolean);
    return parts.map((p, i) => {
      let v;
      try { v = C.evalReal(p); } catch (e) { v = NaN; }
      if (!isFinite(v)) throw new CalcError('Data ERROR', `${label} value #${i + 1} (“${p}”) isn’t a number.`);
      return v;
    });
  }

  let lastStats = null;
  function runStats() {
    const out = $('#statOut');
    try {
      const xs = parseList(ws.statX, 'X');
      if (!xs.length) throw new CalcError('Data ERROR', 'Enter at least one X value.');
      let ys = null;
      if (ws.statY.trim()) {
        ys = parseList(ws.statY, 'Y');
        if (ys.length !== xs.length) throw new CalcError('Data ERROR', `X has ${xs.length} values but Y has ${ys.length}. Each X needs a matching Y.`);
      }
      const s = C.stats(xs, ys);
      lastStats = s;
      const f = (v) => (Number.isFinite(v) ? C.fmtNum(v) : { text: 'n/a', plain: '' });
      const cell = (tex, v, sub) => {
        const r = Array.isArray(v) ? { text: v.length ? v.map((x) => f(x).text).join(', ') : 'none', plain: v.length === 1 ? f(v[0]).plain : '' } : f(v);
        return `<button type="button" class="stat" ${r.plain ? `data-ins="${esc(r.plain)}" aria-label="${esc(`${sub}: ${r.text}. Insert into Calculate`)}"` : 'disabled'}><span class="lbl" data-tex="${esc(tex)}"></span><span class="val">${esc(r.text)}</span></button>`;
      };
      let html = `<section class="stat-section"><h3>One-variable</h3><div class="stat-grid">
        ${cell('n', s.n, 'count')}${cell('\\bar{x}', s.mean, 'mean')}${cell('\\text{Median}', s.median, 'median')}${cell('\\text{Mode}', s.mode, 'mode')}
        ${cell('\\sigma_x', s.sdP, 'population standard deviation')}${cell('s_x', s.sdS, 'sample standard deviation')}
        ${cell('\\sigma_x^2', s.varP, 'population variance')}${cell('s_x^2', s.varS, 'sample variance')}
        ${cell('\\Sigma x', s.sumX, 'sum of x')}${cell('\\Sigma x^2', s.sumX2, 'sum of x squared')}${cell('\\min', s.min, 'minimum')}${cell('\\max', s.max, 'maximum')}
      </div></section>`;
      if (ys) {
        html += `<section class="stat-section"><h3>Y and paired sums</h3><div class="stat-grid">
          ${cell('\\bar{y}', s.meanY, 'mean of y')}${cell('\\sigma_y', s.sdPY, 'population standard deviation of y')}${cell('s_y', s.sdSY, 'sample standard deviation of y')}
          ${cell('\\Sigma y', s.sumY, 'sum of y')}${cell('\\Sigma y^2', s.sumY2, 'sum of y squared')}${cell('\\Sigma xy', s.sumXY, 'sum of xy')}
        </div></section>`;
        if (s.regError) html += `<div class="box-error"><strong>Regression unavailable</strong>${esc(s.regError)}</div>`;
        else {
          const a = f(s.a), b = f(s.b);
          const eq = `\\hat{y}=${a.tex}${s.b < 0 ? '' : '+'}${b.tex}\\,x`;
          html += `<section class="stat-section"><h3>Linear regression · y = a + bx</h3><div class="reg-eq" data-tex="${esc(eq)}" data-display="1"></div>
            <div class="stat-grid">${cell('a', s.a, 'intercept a')}${cell('b', s.b, 'slope b')}${cell('r', s.r, 'correlation r')}${cell('r^2', s.r2, 'r squared')}</div>
            <div class="estimate">
              <label class="field"><span>Estimate ŷ for x =</span><input id="estX" inputmode="decimal" autocomplete="off"><output id="estXo" for="estX"></output></label>
              <label class="field"><span>Estimate x̂ for y =</span><input id="estY" inputmode="decimal" autocomplete="off"><output id="estYo" for="estY"></output></label>
            </div></section>`;
        }
      }
      html += '<p class="hint">Tap any value to insert it into Calculate mode.</p>';
      out.innerHTML = html;
      out.querySelectorAll('[data-tex]').forEach((n) => renderTex(n, n.dataset.tex, !!n.dataset.display));
      addHistory(`stats(${xs.length} values)`, `\\bar{x}=${f(s.mean).tex}`, f(s.mean).plain, null, 'STAT');
    } catch (e) {
      const ex = C.explain(e);
      out.innerHTML = `<div class="box-error" role="alert"><strong>${esc(ex.title)}</strong>${esc(ex.detail)}</div>`;
    }
  }

  function renderEstimate() {
    const s = lastStats;
    if (!s || s.b === undefined) return;
    const go = (id, fn) => {
      const t = $(`#${id}`).value.trim();
      const o = $(`#${id}o`);
      if (!t) { o.textContent = ''; return; }
      try { o.textContent = C.fmtNum(fn(C.evalReal(t))).text; } catch (e) { o.textContent = 'Enter a number'; }
    };
    go('estX', (x) => s.a + s.b * x);
    go('estY', (y) => {
      if (s.b === 0) throw new Error('flat');
      return (y - s.a) / s.b;
    });
  }

  function insertInto(mode, text) {
    if (state.mode !== mode) setMode(mode);
    ui.justEvaluated = false;
    const i = el.input;
    i.setSelectionRange(i.value.length, i.value.length);
    insert(text);
  }

  function insertHere(text) {
    if (state.mode === 'STAT' || state.mode === 'BASE') return insertInto('CALC', text);
    insert(text);
  }

  // ---------- History ----------
  function addHistory(src, resTex, plain, resText, mode = state.mode) {
    ui.history.unshift({ mode, src, resTex, plain, resText });
    if (ui.history.length > 60) ui.history.pop();
    renderHistory();
  }

  function renderHistory() {
    const list = $('#historyList');
    const empty = $('#historyEmpty');
    empty.hidden = ui.history.length > 0;
    list.innerHTML = ui.history.map((h, i) => {
      const modeLabel = MODES.find(([id]) => id === h.mode)[1];
      return `<li><button type="button" class="main-btn" data-h="${i}" aria-label="${esc(`Restore ${h.src}`)}"><span class="tag">${esc(modeLabel)}</span><span class="q" data-q="${i}"></span><span class="a" data-a="${i}"></span></button>
        ${h.plain && h.mode !== 'STAT' ? `<div class="row"><button type="button" class="link" data-hi="${i}">Insert result</button></div>` : ''}</li>`;
    }).join('');
    ui.history.forEach((h, i) => {
      const q = list.querySelector(`[data-q="${i}"]`);
      const a = list.querySelector(`[data-a="${i}"]`);
      const t = h.mode === 'BASE' || h.mode === 'STAT' ? null : C.toTex(h.src);
      if (t) renderTex(q, t, false); else { q.textContent = h.src; q.classList.add('raw'); }
      if (h.resTex) renderTex(a, h.resTex, false); else { a.textContent = h.resText || h.plain; a.classList.add('raw'); }
    });
  }

  $('#historyList').addEventListener('click', (e) => {
    const r = e.target.closest('[data-hi]');
    if (r) { const h = ui.history[+r.dataset.hi]; return h.mode === 'BASE' ? insertInto('BASE', h.plain) : insertHere(h.plain); }
    const b = e.target.closest('[data-h]');
    if (!b) return;
    const h = ui.history[+b.dataset.h];
    if (h.mode === 'STAT') return setMode('STAT');
    setMode(h.mode, h.src);
  });
  $('#historyClear').addEventListener('click', () => { ui.history = []; renderHistory(); });

  // ---------- Memory ----------
  const VARS = ['A', 'B', 'C', 'D', 'E', 'F', 'X'];
  function valueText(v) {
    if (typeof v === 'number') { try { return C.fmtNum(v).text; } catch (e) { return String(v); } }
    try { return M.format(v, { precision: 8 }); } catch (e) { return String(v); }
  }
  function renderMemory() {
    $('#memList').innerHTML = [...VARS, 'Ans'].map((n) => `<div class="mem-row"><span class="n">${n}</span><span class="v" title="${esc(valueText(scope.get(n)))}">${esc(valueText(scope.get(n)))}</span>
      <span class="acts"><button type="button" data-mi="${n}" aria-label="Insert ${n}">Insert</button>${n !== 'Ans' ? `<button type="button" data-ms="${n}" aria-label="Store Ans in ${n}">STO</button><button type="button" data-mc="${n}" aria-label="Clear ${n}">Clear</button>` : ''}</span></div>`).join('');
  }
  $('#memList').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mi) insertHere(b.dataset.mi);
    if (b.dataset.ms) { scope.set(b.dataset.ms, scope.get('Ans')); renderMemory(); }
    if (b.dataset.mc) { scope.set(b.dataset.mc, 0); renderMemory(); }
  });

  const dialog = $('#varDialog');
  let dialogMode = 'store';
  function openVarDialog(mode) {
    dialogMode = mode;
    $('#varTitle').textContent = mode === 'store' ? 'Store answer' : 'Recall variable';
    $('#varDesc').textContent = mode === 'store' ? `Save Ans (${valueText(scope.get('Ans'))}) into a variable.` : 'Insert a variable into the expression.';
    const names = mode === 'store' ? VARS : [...VARS, 'Ans'];
    $('#varGrid').innerHTML = names.map((n) => `<button type="button" data-v="${n}"><span class="n">${n}</span><span class="v">${esc(valueText(scope.get(n)))}</span></button>`).join('');
    dialog.showModal();
  }
  $('#varGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    const n = b.dataset.v;
    dialog.close();
    if (dialogMode === 'store') {
      scope.set(n, scope.get('Ans'));
      renderMemory();
      flashNote(`Ans stored in ${n}`);
    } else {
      insertHere(n);
    }
  });
  $('#varCancel').addEventListener('click', () => dialog.close());

  // ---------- Side tabs ----------
  const TABS = ['history', 'memory', 'const', 'conv'];
  function selectTab(id) {
    TABS.forEach((t) => {
      $(`#tab-side-${t}`).setAttribute('aria-selected', String(t === id));
      $(`#tab-side-${t}`).tabIndex = t === id ? 0 : -1;
      $(`#panel-${t}`).hidden = t !== id;
    });
  }
  $('.side-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) selectTab(b.dataset.tab);
  });
  $('.side-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const cur = TABS.findIndex((t) => $(`#tab-side-${t}`).getAttribute('aria-selected') === 'true');
    const n = TABS[(cur + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    selectTab(n);
    $(`#tab-side-${n}`).focus();
  });

  // ---------- Constants ----------
  const CONSTANTS = [
    ['c', 'Speed of light in vacuum', 299792458, 'm/s'],
    ['h', 'Planck constant', 6.62607015e-34, 'J·s'],
    ['\\hbar', 'Reduced Planck constant', 1.054571817e-34, 'J·s'],
    ['G', 'Gravitational constant', 6.6743e-11, 'N·m²/kg²'],
    ['g', 'Standard gravity', 9.80665, 'm/s²'],
    ['e', 'Elementary charge', 1.602176634e-19, 'C'],
    ['m_e', 'Electron mass', 9.1093837015e-31, 'kg'],
    ['m_p', 'Proton mass', 1.67262192369e-27, 'kg'],
    ['m_n', 'Neutron mass', 1.67492749804e-27, 'kg'],
    ['u', 'Atomic mass constant', 1.6605390666e-27, 'kg'],
    ['N_A', 'Avogadro constant', 6.02214076e23, '1/mol'],
    ['k_B', 'Boltzmann constant', 1.380649e-23, 'J/K'],
    ['R', 'Molar gas constant', 8.314462618, 'J/(mol·K)'],
    ['F', 'Faraday constant', 96485.33212, 'C/mol'],
    ['\\varepsilon_0', 'Vacuum permittivity', 8.8541878128e-12, 'F/m'],
    ['\\mu_0', 'Vacuum permeability', 1.25663706212e-6, 'N/A²'],
    ['\\sigma', 'Stefan–Boltzmann constant', 5.670374419e-8, 'W/(m²·K⁴)'],
    ['\\alpha', 'Fine-structure constant', 7.2973525693e-3, ''],
    ['a_0', 'Bohr radius', 5.29177210903e-11, 'm'],
    ['R_\\infty', 'Rydberg constant', 10973731.56816, '1/m'],
    ['\\mu_B', 'Bohr magneton', 9.2740100783e-24, 'J/T'],
    ['V_m', 'Molar volume of ideal gas (STP)', 0.02241396954, 'm³/mol'],
    ['\\text{atm}', 'Standard atmosphere', 101325, 'Pa'],
    ['T_0', 'Zero Celsius', 273.15, 'K'],
  ];
  function constInsert(v) {
    const [m, e] = v.toExponential().split('e');
    const ex = parseInt(e, 10);
    return Math.abs(ex) >= 5 ? `(${m}*10^(${ex}))` : String(v);
  }
  function renderConstants(filter = '') {
    const q = filter.trim().toLowerCase();
    const list = CONSTANTS.map((c, i) => [c, i]).filter(([c]) => !q || c[1].toLowerCase().includes(q) || c[0].toLowerCase().includes(q));
    $('#constList').innerHTML = list.length
      ? list.map(([c, i]) => `<li><button type="button" data-c="${i}" aria-label="${esc(`Insert ${c[1]}`)}"><span class="sym" data-ctex="${esc(c[0])}"></span><span><span class="nm">${esc(c[1])}</span><span class="vl">${esc(C.fmtNum(c[2]).text)} ${esc(c[3])}</span></span></button></li>`).join('')
      : '<li class="empty">No constants match your search.</li>';
    $('#constList').querySelectorAll('[data-ctex]').forEach((n) => renderTex(n, n.dataset.ctex, false));
  }
  $('#constSearch').addEventListener('input', (e) => renderConstants(e.target.value));
  $('#constList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (b) insertHere(constInsert(CONSTANTS[+b.dataset.c][2]));
  });

  // ---------- Conversions ----------
  const UNITS = {
    Length: [['metre', 'm'], ['centimetre', 'cm'], ['millimetre', 'mm'], ['kilometre', 'km'], ['inch', 'inch'], ['foot', 'ft'], ['yard', 'yd'], ['mile', 'mi'], ['nautical mile', 'nmi']],
    Mass: [['kilogram', 'kg'], ['gram', 'g'], ['milligram', 'mg'], ['tonne', 'tonne'], ['pound', 'lbm'], ['ounce', 'oz']],
    Temperature: [['Celsius', 'degC'], ['Fahrenheit', 'degF'], ['Kelvin', 'K']],
    Area: [['square metre', 'm^2'], ['square centimetre', 'cm^2'], ['square kilometre', 'km^2'], ['hectare', 'hectare'], ['acre', 'acre'], ['square foot', 'sqft']],
    Volume: [['litre', 'L'], ['millilitre', 'mL'], ['cubic metre', 'm^3'], ['US gallon', 'gal'], ['US cup', 'cup'], ['US fluid ounce', 'floz']],
    Speed: [['metre/second', 'm/s'], ['kilometre/hour', 'km/h'], ['mile/hour', 'mi/h'], ['foot/second', 'ft/s'], ['knot', 'knot']],
    Pressure: [['pascal', 'Pa'], ['kilopascal', 'kPa'], ['bar', 'bar'], ['atmosphere', 'atm'], ['psi', 'psi'], ['mmHg', 'mmHg'], ['torr', 'torr']],
    Energy: [['joule', 'J'], ['kilojoule', 'kJ'], ['calorie', 'cal'], ['kilocalorie', 'kcal'], ['kilowatt-hour', 'kWh'], ['electronvolt', 'eV'], ['BTU', 'BTU']],
    Time: [['second', 's'], ['minute', 'min'], ['hour', 'h'], ['day', 'day'], ['week', 'week'], ['year', 'year']],
  };
  Object.keys(UNITS).forEach((k) => {
    UNITS[k] = UNITS[k].filter(([, u]) => { try { M.unit(1, u); return true; } catch (e) { return false; } });
  });
  const convCat = $('#convCat'), convFrom = $('#convFrom'), convTo = $('#convTo'), convVal = $('#convVal');
  convCat.innerHTML = Object.keys(UNITS).map((k) => `<option>${k}</option>`).join('');
  function fillUnits() {
    const list = UNITS[convCat.value];
    const opts = list.map(([n, u]) => `<option value="${esc(u)}">${esc(n)}</option>`).join('');
    convFrom.innerHTML = opts;
    convTo.innerHTML = opts;
    convTo.selectedIndex = Math.min(1, list.length - 1);
    convert();
  }
  let convResult = null;
  function convert() {
    const big = $('#convBig'), small = $('#convSmall');
    convResult = null;
    const t = convVal.value.trim();
    if (!t) { big.textContent = '—'; small.textContent = 'Enter a value to convert'; return; }
    try {
      const v = C.evalReal(t);
      const r = M.unit(v, convFrom.value).toNumber(convTo.value);
      convResult = r;
      big.textContent = `${C.fmtNum(r).text}`;
      small.textContent = `${C.fmtNum(v).text} ${convFrom.selectedOptions[0].text} = ${C.fmtNum(r).text} ${convTo.selectedOptions[0].text}`;
    } catch (e) {
      big.textContent = '—';
      small.textContent = 'Enter a valid number';
    }
  }
  convCat.addEventListener('change', fillUnits);
  [convFrom, convTo].forEach((s) => s.addEventListener('change', convert));
  convVal.addEventListener('input', convert);
  $('#convSwap').addEventListener('click', () => {
    const a = convFrom.value;
    convFrom.value = convTo.value;
    convTo.value = a;
    convert();
  });
  $('#convInsert').addEventListener('click', () => {
    if (convResult === null) return;
    insertHere(C.fmtNum(convResult).plain);
  });

  // ---------- Init ----------
  if (ui.coarse) el.input.setAttribute('inputmode', 'none');
  renderModes();
  setMode('CALC');
  renderMemory();
  renderHistory();
  renderConstants();
  fillUnits();
  selectTab('history');
})();
