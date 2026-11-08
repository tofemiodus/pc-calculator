(function () {
  'use strict';

  const RADIX = { DEC: 10, HEX: 16, BIN: 2, OCT: 8 };
  const DIGITS = { DEC: /^[0-9]+$/, HEX: /^[0-9A-F]+$/i, BIN: /^[01]+$/, OCT: /^[0-7]+$/ };
  const KEYWORDS = ['and', 'or', 'xor', 'xnor', 'not', 'neg', 'ans'];
  const fail = (kind, msg) => new window.Calc.CalcError(kind, msg);

  function tokenize(src, base) {
    const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[()+\-*/]/.test(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
      const m = /^[0-9A-Za-z]+/.exec(s.slice(i));
      if (!m) throw fail('Syntax ERROR', `Unexpected character “${ch}”.`);
      const w = m[0];
      const lw = w.toLowerCase();
      if (KEYWORDS.includes(lw)) tokens.push({ t: 'op', v: lw });
      else {
        if (!DIGITS[base].test(w)) throw fail('Syntax ERROR', `“${w}” is not a valid ${base} number.`);
        const v = parseInt(w, RADIX[base]);
        if (v > 0xffffffff || (base === 'DEC' && v > 2147483647)) throw fail('Math ERROR', `“${w}” is outside the 32-bit range.`);
        tokens.push({ t: 'num', v: v | 0 });
      }
      i += w.length;
    }
    return tokens;
  }

  function evaluate(src, base, ans) {
    const toks = tokenize(src, base);
    if (!toks.length) throw fail('Syntax ERROR', 'Type an expression first.');
    let p = 0;
    const isOp = (...vs) => toks[p] && toks[p].t === 'op' && vs.includes(toks[p].v);
    const next = () => toks[p++];

    function primary() {
      const tk = next();
      if (!tk) throw fail('Syntax ERROR', 'The expression ends too early — a number is missing.');
      if (tk.t === 'num') return tk.v;
      if (tk.v === 'ans') return ans | 0;
      if (tk.v === '(') {
        const v = orExpr();
        if (isOp(')')) next();
        return v;
      }
      throw fail('Syntax ERROR', `Unexpected “${tk.v}” — a number was expected.`);
    }
    function unary() {
      if (isOp('not')) { next(); return ~unary(); }
      if (isOp('neg', '-')) { next(); return -unary() | 0; }
      if (isOp('+')) { next(); return unary(); }
      return primary();
    }
    function mul() {
      let v = unary();
      while (isOp('*', '/')) {
        const o = next().v;
        const r = unary();
        if (o === '*') v = Math.imul(v, r);
        else {
          if (r === 0) throw fail('Math ERROR', 'Division by zero.');
          v = Math.trunc(v / r) | 0;
        }
      }
      return v;
    }
    function add() {
      let v = mul();
      while (isOp('+', '-')) {
        const o = next().v;
        const r = mul();
        v = (o === '+' ? v + r : v - r) | 0;
      }
      return v;
    }
    function andExpr() {
      let v = add();
      while (isOp('and')) { next(); v &= add(); }
      return v;
    }
    function orExpr() {
      let v = andExpr();
      while (isOp('or', 'xor', 'xnor')) {
        const o = next().v;
        const r = andExpr();
        v = o === 'or' ? v | r : o === 'xor' ? v ^ r : ~(v ^ r);
      }
      return v;
    }
    const v = orExpr();
    if (p < toks.length) throw fail('Syntax ERROR', `Unexpected “${toks[p].v}”.`);
    return v | 0;
  }

  function format(v, base) {
    if (base === 'DEC') return String(v | 0);
    return (v >>> 0).toString(RADIX[base]).toUpperCase();
  }

  function group(s, size) {
    const out = [];
    for (let i = s.length; i > 0; i -= size) out.unshift(s.slice(Math.max(0, i - size), i));
    return out.join(' ');
  }

  window.BaseN = { RADIX, evaluate, format, group };
})();
