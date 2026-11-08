(function () {
  'use strict';

  const M = math.create(math.all, { number: 'number' });
  const state = { angle: 'DEG', mode: 'CALC' };
  const scope = new Map();
  ['A', 'B', 'C', 'D', 'E', 'F', 'X', 'Ans'].forEach((k) => scope.set(k, 0));

  class CalcError extends Error {
    constructor(kind, message) {
      super(message);
      this.kind = kind;
    }
  }

  const PI = Math.PI;
  const toRad = (x) => (state.angle === 'DEG' ? (x * PI) / 180 : state.angle === 'GRA' ? (x * PI) / 200 : x);
  const fromRad = (x) => (state.angle === 'DEG' ? (x * 180) / PI : state.angle === 'GRA' ? (x * 200) / PI : x);
  const angleSuffix = () => (state.angle === 'DEG' ? '^\\circ' : state.angle === 'GRA' ? '^{g}' : '');

  function snap(v) {
    if (typeof v !== 'number' || !isFinite(v)) return v;
    if (Math.abs(v) < 1e-13) return 0;
    const r = Math.round(v);
    if (Math.abs(v - r) < 1e-12 * Math.max(1, Math.abs(v))) return r;
    return v;
  }

  const base = { sin: M.sin, cos: M.cos, tan: M.tan, asin: M.asin, acos: M.acos, atan: M.atan, arg: M.arg };
  const isNum = (x) => typeof x === 'number';
  const elementwise = (fn) => (x) => (M.isMatrix(x) || Array.isArray(x) ? M.map(x, (v) => fn(v)) : fn(x));

  function inverseTrig(realFn, baseFn, name) {
    return elementwise((x) => {
      if (isNum(x) && x >= -1 && x <= 1) return snap(fromRad(realFn(x)));
      if (state.mode === 'CMPLX') return baseFn(x);
      if (isNum(x)) throw new CalcError('Math ERROR', `${name} only accepts values from −1 to 1.`);
      return baseFn(x);
    });
  }

  function wholeNumbers(name, ...vals) {
    vals.forEach((v) => {
      if (!Number.isInteger(v) || v < 0) throw new CalcError('Math ERROR', `${name} needs whole numbers ≥ 0.`);
    });
  }

  const custom = {
    sin: elementwise((x) => (isNum(x) ? snap(Math.sin(toRad(x))) : base.sin(x))),
    cos: elementwise((x) => (isNum(x) ? snap(Math.cos(toRad(x))) : base.cos(x))),
    tan: elementwise((x) => {
      if (!isNum(x)) return base.tan(x);
      const r = toRad(x);
      if (Math.abs(Math.cos(r)) < 1e-12) throw new CalcError('Math ERROR', 'tan is undefined at odd multiples of 90° (π/2).');
      return snap(Math.tan(r));
    }),
    asin: inverseTrig(Math.asin, base.asin, 'sin⁻¹'),
    acos: inverseTrig(Math.acos, base.acos, 'cos⁻¹'),
    atan: elementwise((x) => (isNum(x) ? snap(fromRad(Math.atan(x))) : base.atan(x))),
    arg: (z) => snap(fromRad(base.arg(z))),
    ln: (x) => M.log(x),
    logab: (a, b) => {
      if (a === 1) throw new CalcError('Math ERROR', 'A logarithm base cannot be 1.');
      return M.divide(M.log(b), M.log(a));
    },
    root: (n, x) => {
      if (n === 0) throw new CalcError('Math ERROR', 'The 0th root is undefined.');
      if (isNum(n) && isNum(x)) {
        if (x < 0) {
          if (Number.isInteger(n) && Math.abs(n) % 2 === 1) return -Math.pow(-x, 1 / n);
          return M.pow(x, 1 / n);
        }
        return Math.pow(x, 1 / n);
      }
      return M.pow(x, M.divide(1, n));
    },
    mixed: (a, b, c) => {
      if (c === 0) throw new CalcError('Math ERROR', 'A fraction cannot have a denominator of 0.');
      const sign = a < 0 || Object.is(a, -0) ? -1 : 1;
      return a + (sign * b) / c;
    },
    nPr: (n, r) => {
      wholeNumbers('nPr', n, r);
      if (r > n) throw new CalcError('Math ERROR', 'In nPr, r cannot be larger than n.');
      return M.permutations(n, r);
    },
    nCr: (n, r) => {
      wholeNumbers('nCr', n, r);
      if (r > n) throw new CalcError('Math ERROR', 'In nCr, r cannot be larger than n.');
      return M.combinations(n, r);
    },
    Pol: (x, y) => ({ pair: [['r', Math.hypot(x, y)], ['\\theta', snap(fromRad(Math.atan2(y, x))), true]] }),
    Rec: (r, t) => {
      const ph = toRad(t);
      return { pair: [['x', snap(r * snap(Math.cos(ph)))], ['y', snap(r * snap(Math.sin(ph)))]] };
    },
    Ran: () => Math.floor(Math.random() * 1000) / 1000,
    RanInt: (a, b) => {
      if (!Number.isInteger(a) || !Number.isInteger(b)) throw new CalcError('Math ERROR', 'RanInt needs whole-number limits.');
      if (a > b) [a, b] = [b, a];
      return a + Math.floor(Math.random() * (b - a + 1));
    },
    polar: (r, t) => {
      const ph = toRad(t);
      return M.complex(snap(r * snap(Math.cos(ph))), snap(r * snap(Math.sin(ph))));
    },
    angle: (u, v) => {
      const d = M.dot(u, v);
      const n = M.norm(u) * M.norm(v);
      if (n === 0) throw new CalcError('Math ERROR', 'The angle with a zero vector is undefined.');
      return snap(fromRad(Math.acos(Math.max(-1, Math.min(1, d / n)))));
    },
    pct: 0.01,
  };

  function cloneScope(sc) {
    const m = new Map();
    try {
      if (sc && typeof sc.keys === 'function' && typeof sc.get === 'function') {
        for (const k of sc.keys()) m.set(k, sc.get(k));
      } else if (sc) {
        Object.keys(sc).forEach((k) => m.set(k, sc[k]));
      }
    } catch (e) {
      /* fall back to the global scope below */
    }
    for (const [k, v] of scope) if (!m.has(k)) m.set(k, v);
    return m;
  }

  function toReal(r) {
    if (typeof r === 'number') return r;
    if (M.isComplex(r) && Math.abs(r.im) < 1e-12) return r.re;
    if (M.isFraction(r) || M.isBigNumber(r)) return M.number(r);
    if (typeof r === 'boolean') return r ? 1 : 0;
    throw new CalcError('Math ERROR', 'This calculation needs a real-valued expression.');
  }

  function makeFn(node, sc) {
    const code = node.compile();
    const s = cloneScope(sc);
    return (v) => {
      s.set('X', v);
      return toReal(code.evaluate(s));
    };
  }

  const evalArg = (node, sc) => toReal(node.compile().evaluate(cloneScope(sc)));
  function needArgs(args, n, usage) {
    if (args.length !== n) throw new CalcError('Argument ERROR', `Usage: ${usage}`);
  }

  function summation(args, _m, sc) {
    needArgs(args, 3, 'Σ(expression in X, start, end)');
    const f = makeFn(args[0], sc);
    const a = evalArg(args[1], sc);
    const b = evalArg(args[2], sc);
    if (!Number.isInteger(a) || !Number.isInteger(b)) throw new CalcError('Math ERROR', 'Σ limits must be whole numbers.');
    if (b - a > 1e6) throw new CalcError('Math ERROR', 'Σ supports at most 1,000,000 terms.');
    let s = 0;
    for (let k = a; k <= b; k++) s += f(k);
    return s;
  }
  summation.rawArgs = true;

  function ddx(args, _m, sc) {
    needArgs(args, 2, 'd/dX(expression in X, value of X)');
    const f = makeFn(args[0], sc);
    const a = evalArg(args[1], sc);
    const h = 1e-3 * Math.max(1, Math.abs(a));
    const d = (-f(a + 2 * h) + 8 * f(a + h) - 8 * f(a - h) + f(a - 2 * h)) / (12 * h);
    if (!isFinite(d)) throw new CalcError('Math ERROR', 'The derivative does not exist at this point.');
    return +d.toPrecision(11);
  }
  ddx.rawArgs = true;

  const XGK = [0.991455371120812639, 0.949107912342758525, 0.864864423359769073, 0.741531185599394440, 0.586087235467691130, 0.405845151377397167, 0.207784955007898468, 0];
  const WGK = [0.022935322010529225, 0.063092092629978553, 0.104790010322250184, 0.140653259715525919, 0.169004726639267903, 0.190350578064785410, 0.204432940075298892, 0.209482141084727828];
  const WG = [0.129484966168869693, 0.279705391489276668, 0.381830050505118945, 0.417959183673469388];

  function gk15(F, a, b) {
    const c = (a + b) / 2;
    const h = (b - a) / 2;
    const fc = F(c);
    let rk = fc * WGK[7];
    let rg = fc * WG[3];
    for (let j = 0; j < 7; j++) {
      const dx = h * XGK[j];
      const s = F(c - dx) + F(c + dx);
      rk += WGK[j] * s;
      if (j % 2 === 1) rg += WG[(j - 1) / 2] * s;
    }
    return { val: rk * h, err: Math.abs((rk - rg) * h) };
  }

  function adaptive(F, a, b, tol, depth) {
    const r = gk15(F, a, b);
    if (r.err <= Math.max(tol, 50 * Number.EPSILON * Math.abs(r.val)) || depth > 40) return r.val;
    const m = (a + b) / 2;
    return adaptive(F, a, m, Math.max(tol / 2, 1e-15), depth + 1) + adaptive(F, m, b, Math.max(tol / 2, 1e-15), depth + 1);
  }

  function integral(args, _m, sc) {
    needArgs(args, 3, '∫(expression in X, lower limit, upper limit)');
    const f = makeFn(args[0], sc);
    const a = evalArg(args[1], sc);
    const b = evalArg(args[2], sc);
    if (!isFinite(a) || !isFinite(b)) throw new CalcError('Math ERROR', 'Integration limits must be finite numbers.');
    if (a === b) return 0;
    let evals = 0;
    const F = (x) => {
      if (++evals > 300000) throw new CalcError('Time Out', 'The integral did not converge. Try narrower limits.');
      const y = f(x);
      if (!isFinite(y)) throw new CalcError('Math ERROR', 'The function is undefined somewhere inside the integration interval.');
      return y;
    };
    const est = gk15(F, a, b).val;
    const v = adaptive(F, a, b, 1e-11 * Math.max(1, Math.abs(est)), 0);
    return +v.toPrecision(11);
  }
  integral.rawArgs = true;

  M.import(Object.assign(custom, { summation, ddx, integral }), { override: true });

  function preprocess(s) {
    return String(s)
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/%/g, 'pct ')
      .replace(/(?<![A-Za-z_])x(?![A-Za-z_0-9(])/g, 'X');
  }

  const box = '\\square';
  const g = (a, i) => (a[i] !== undefined ? a[i] : box);
  const TEX = {
    ln: (a) => `\\ln\\left(${g(a, 0)}\\right)`,
    log10: (a) => `\\log\\left(${g(a, 0)}\\right)`,
    logab: (a) => `\\log_{${g(a, 0)}}\\left(${g(a, 1)}\\right)`,
    root: (a) => `\\sqrt[${g(a, 0)}]{${g(a, 1)}}`,
    cbrt: (a) => `\\sqrt[3]{${g(a, 0)}}`,
    sqrt: (a) => `\\sqrt{${g(a, 0)}}`,
    mixed: (a) => `${g(a, 0)}\\tfrac{${g(a, 1)}}{${g(a, 2)}}`,
    nPr: (a) => `{}_{${g(a, 0)}}\\mathrm{P}_{${g(a, 1)}}`,
    nCr: (a) => `{}_{${g(a, 0)}}\\mathrm{C}_{${g(a, 1)}}`,
    Pol: (a) => `\\mathrm{Pol}\\left(${g(a, 0)},${g(a, 1)}\\right)`,
    Rec: (a) => `\\mathrm{Rec}\\left(${g(a, 0)},${g(a, 1)}\\right)`,
    Ran: () => '\\mathrm{Ran\\#}',
    RanInt: (a) => `\\mathrm{RanInt}\\left(${g(a, 0)},${g(a, 1)}\\right)`,
    polar: (a) => `${g(a, 0)}\\angle ${g(a, 1)}`,
    summation: (a) => `\\sum_{X=${g(a, 1)}}^{${g(a, 2)}}\\left(${g(a, 0)}\\right)`,
    ddx: (a) => `\\left.\\frac{d}{dX}\\left(${g(a, 0)}\\right)\\right|_{X=${g(a, 1)}}`,
    integral: (a) => `\\int_{${g(a, 1)}}^{${g(a, 2)}}\\left(${g(a, 0)}\\right)\\,dX`,
    angle: (a) => `\\angle\\left(${g(a, 0)},${g(a, 1)}\\right)`,
    arg: (a) => `\\arg\\left(${g(a, 0)}\\right)`,
    conj: (a) => `\\overline{${g(a, 0)}}`,
    re: (a) => `\\mathrm{Re}\\left(${g(a, 0)}\\right)`,
    im: (a) => `\\mathrm{Im}\\left(${g(a, 0)}\\right)`,
    abs: (a) => `\\left|${g(a, 0)}\\right|`,
    round: (a) => `\\mathrm{Rnd}\\left(${a.length ? a.join(',') : box}\\right)`,
    det: (a) => `\\det\\left(${g(a, 0)}\\right)`,
    inv: (a) => `{${g(a, 0)}}^{-1}`,
    transpose: (a) => `{${g(a, 0)}}^{\\mathsf{T}}`,
    norm: (a) => `\\left\\|${g(a, 0)}\\right\\|`,
    dot: (a) => `${g(a, 0)}\\cdot ${g(a, 1)}`,
    cross: (a) => `${g(a, 0)}\\times ${g(a, 1)}`,
    asin: (a) => `\\sin^{-1}\\left(${g(a, 0)}\\right)`,
    acos: (a) => `\\cos^{-1}\\left(${g(a, 0)}\\right)`,
    atan: (a) => `\\tan^{-1}\\left(${g(a, 0)}\\right)`,
    asinh: (a) => `\\sinh^{-1}\\left(${g(a, 0)}\\right)`,
    acosh: (a) => `\\cosh^{-1}\\left(${g(a, 0)}\\right)`,
    atanh: (a) => `\\tanh^{-1}\\left(${g(a, 0)}\\right)`,
  };
  const SYM = { pct: '\\%', Ans: '\\mathrm{Ans}', pi: '\\pi', e: 'e', i: 'i', _box: box };
  ['A', 'B', 'C', 'D', 'E', 'F', 'X'].forEach((k) => (SYM[k] = k));
  ['MatA', 'MatB', 'MatC', 'MatAns', 'VctA', 'VctB', 'VctC', 'VctAns'].forEach((k) => (SYM[k] = `\\mathrm{${k}}`));

  function texHandler(node, options) {
    if (node.type === 'FunctionNode' && TEX[node.name]) return TEX[node.name](node.args.map((n) => n.toTex(options)));
    if (node.type === 'SymbolNode' && SYM[node.name] !== undefined) return SYM[node.name];
    return undefined;
  }

  function texOne(pre) {
    const attempt = (s) => {
      try {
        return M.parse(s).toTex({ parenthesis: 'auto', implicit: 'hide', handler: texHandler });
      } catch (e) {
        return null;
      }
    };
    const open = Math.max(0, (pre.match(/\(/g) || []).length - (pre.match(/\)/g) || []).length);
    const closes = ')'.repeat(open);
    return attempt(pre) ?? attempt(pre + closes) ?? attempt(pre + '_box' + closes) ?? attempt(pre.replace(/,\s*$/, '') + closes);
  }

  function splitEquation(pre) {
    const parts = pre.split(/(?<![=<>!])=(?!=)/);
    return parts;
  }

  function toTex(src) {
    const pre = preprocess(src);
    if (!pre.trim()) return '';
    const parts = splitEquation(pre);
    if (parts.length === 2) {
      const l = texOne(parts[0]);
      const r = parts[1].trim() ? texOne(parts[1]) : box;
      if (l !== null && r !== null) return `${l}=${r}`;
    }
    return texOne(pre);
  }

  function evaluate(src) {
    const pre = preprocess(src);
    if (!pre.trim()) throw new CalcError('Syntax ERROR', 'Type an expression first.');
    return M.evaluate(pre, scope);
  }

  function evalReal(src) {
    return toReal(lastOf(evaluate(src)));
  }

  function lastOf(v) {
    if (v && Array.isArray(v.entries) && v.isResultSet) {
      if (!v.entries.length) throw new CalcError('Syntax ERROR', 'Nothing to calculate.');
      return v.entries[v.entries.length - 1];
    }
    return v;
  }

  const strip = (m) => (m.includes('.') ? m.replace(/\.?0+$/, '') : m);

  function fmtNum(x) {
    if (Number.isNaN(x)) throw new CalcError('Math ERROR', 'The result is undefined — a value is outside the function’s domain.');
    if (!isFinite(x)) throw new CalcError('Math ERROR', 'The result is infinite or too large — check for division by zero.');
    if (x === 0) return { text: '0', tex: '0', plain: '0' };
    const ax = Math.abs(x);
    if (ax >= 1e10 || ax < 1e-6) {
      const [mm, ee] = x.toExponential(9).split('e');
      const m = strip(mm);
      const e = parseInt(ee, 10);
      return { text: `${m}×10^${e}`, tex: `${m}\\times10^{${e}}`, plain: `${m}*10^(${e})` };
    }
    const s = String(parseFloat(x.toPrecision(10)));
    return { text: s, tex: s, plain: s };
  }

  function toFrac(x, maxDen) {
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, b = x;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(b);
      const h2 = a * h1 + h0;
      const k2 = a * k1 + k0;
      if (k2 > maxDen) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(x - h1 / k1) < 1e-12 * Math.max(1, Math.abs(x))) return [h1, k1];
      const frac = b - a;
      if (frac === 0) break;
      b = 1 / frac;
    }
    return null;
  }

  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  function squareFree(n) {
    let k = 1;
    for (let f = 2; f * f <= n; f++) while (n % (f * f) === 0) { n /= f * f; k *= f; }
    return [k, n];
  }

  function exactForms(x) {
    const out = [];
    if (!isFinite(x) || Number.isInteger(x) || Math.abs(x) >= 1e9) return out;
    const sign = x < 0 ? '-' : '';
    const fr = toFrac(x, 10000);
    if (fr && fr[1] > 1) {
      const [p, q] = fr;
      const P = Math.abs(p);
      out.push({ label: 'Fraction', tex: `${sign}\\frac{${P}}{${q}}`, text: `${p}/${q}`, plain: `${p}/${q}` });
      if (P > q) {
        const w = Math.floor(P / q);
        const r = P % q;
        out.push({ label: 'Mixed', tex: `${sign}${w}\\tfrac{${r}}{${q}}`, text: `${sign}${w} ${r}/${q}`, plain: `${sign}mixed(${w},${r},${q})` });
      }
      return out;
    }
    const fp = toFrac(Math.abs(x) / PI, 12);
    if (fp && fp[0] <= 100) {
      const [p, q] = fp;
      const num = p === 1 ? '\\pi' : `${p}\\pi`;
      out.push({ label: 'π form', tex: q === 1 ? `${sign}${num}` : `${sign}\\frac{${num}}{${q}}`, text: `${sign}${p}π/${q}`, plain: `${sign}${p}*pi/${q}` });
      return out;
    }
    const s = toFrac(x * x, 1000);
    if (s && s[0] <= 1e6) {
      let [k, m] = squareFree(s[0] * s[1]);
      let d = s[1];
      if (m > 1) {
        const gg = gcd(k, d);
        k /= gg; d /= gg;
        const top = `${k === 1 ? '' : k}\\sqrt{${m}}`;
        out.push({ label: 'Surd', tex: d === 1 ? `${sign}${top}` : `${sign}\\frac{${top}}{${d}}`, text: `${sign}${k}√${m}/${d}`, plain: `${sign}${k}*sqrt(${m})/${d}` });
      }
    }
    return out;
  }

  function withForms(x) {
    const dec = fmtNum(x);
    return { ...dec, forms: [{ label: 'Decimal', ...dec }, ...exactForms(x)] };
  }

  function cleanComplex(z) {
    let re = z.re, im = z.im;
    const s = Math.max(Math.abs(re), Math.abs(im));
    if (Math.abs(re) < 1e-12 * s) re = 0;
    if (Math.abs(im) < 1e-12 * s) im = 0;
    return { re: snap(re), im: snap(im) };
  }

  function fmtComplex(z) {
    const { re, im } = cleanComplex(z);
    if (im === 0) return fmtNum(re);
    const mag = fmtNum(Math.abs(im));
    const imTex = (Math.abs(im) === 1 ? '' : mag.tex) + 'i';
    const imText = (Math.abs(im) === 1 ? '' : mag.text) + 'i';
    const imPlain = (Math.abs(im) === 1 ? '' : `${mag.plain}*`) + 'i';
    const op = im < 0 ? '-' : '+';
    if (re === 0) return { tex: `${im < 0 ? '-' : ''}${imTex}`, text: `${im < 0 ? '-' : ''}${imText}`, plain: `${im < 0 ? '-' : ''}${imPlain}` };
    const r = fmtNum(re);
    return { tex: `${r.tex} ${op} ${imTex}`, text: `${r.text} ${op} ${imText}`, plain: `(${r.plain}${op}${imPlain})` };
  }

  function polarTex(z) {
    const { re, im } = cleanComplex(z);
    const mod = Math.hypot(re, im);
    const ang = snap(fromRad(Math.atan2(im, re)));
    return `${fmtNum(mod).tex}\\angle ${fmtNum(ang).tex}${angleSuffix()}`;
  }

  function fmtScalar(v) {
    if (typeof v === 'number') return fmtNum(v);
    if (M.isFraction(v) || M.isBigNumber(v)) return fmtNum(M.number(v));
    if (M.isComplex(v)) {
      const c = cleanComplex(v);
      if (c.im === 0) return fmtNum(c.re);
      if (state.mode !== 'CMPLX') throw new CalcError('Math ERROR', 'Non-real result. Switch to Complex mode to see complex answers.');
      return fmtComplex(v);
    }
    if (typeof v === 'boolean') return { tex: `\\text{${v}}`, text: String(v), plain: v ? '1' : '0' };
    const s = M.format(v, { precision: 10 });
    return { tex: `\\text{${s.replace(/[\\{}$&#^_%~]/g, '')}}`, text: s, plain: s };
  }

  function fmtMatrix(v) {
    const arr = M.isMatrix(v) ? v.toArray() : v;
    if (!arr.length) return { tex: '[\\,]', text: '[]', plain: '[]' };
    if (!Array.isArray(arr[0])) {
      const cells = arr.map(fmtScalar);
      return {
        tex: `\\begin{bmatrix}${cells.map((c) => c.tex).join(' & ')}\\end{bmatrix}`,
        text: `[${cells.map((c) => c.text).join(', ')}]`,
        plain: `[${cells.map((c) => c.plain).join(', ')}]`,
      };
    }
    if (Array.isArray(arr[0][0])) {
      const s = M.format(v, { precision: 10 });
      return { tex: `\\text{${s}}`, text: s, plain: s };
    }
    const rows = arr.map((r) => r.map(fmtScalar));
    return {
      tex: `\\begin{bmatrix}${rows.map((r) => r.map((c) => c.tex).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`,
      text: `[${rows.map((r) => `[${r.map((c) => c.text).join(', ')}]`).join(', ')}]`,
      plain: `[${rows.map((r) => `[${r.map((c) => c.plain).join(', ')}]`).join(', ')}]`,
    };
  }

  function formatValue(raw) {
    const v = lastOf(raw);
    if (v === undefined || v === null) throw new CalcError('Syntax ERROR', 'Nothing to calculate.');
    if (typeof v === 'function') throw new CalcError('Syntax ERROR', 'A function name needs parentheses and arguments, e.g. sin(30).');
    if (typeof v === 'number') return withForms(v);
    if (M.isFraction(v) || M.isBigNumber(v)) return withForms(M.number(v));
    if (M.isComplex(v)) {
      const c = cleanComplex(v);
      if (c.im === 0) return withForms(c.re);
      if (state.mode !== 'CMPLX') throw new CalcError('Math ERROR', 'Non-real result. Switch to Complex mode to see complex answers.');
      return { ...fmtComplex(v), polar: polarTex(v) };
    }
    if (M.isMatrix(v) || Array.isArray(v)) return fmtMatrix(v);
    if (v.pair) {
      const parts = v.pair.map(([n, val, isAngle]) => ({ n, f: fmtNum(val), isAngle }));
      return {
        tex: parts.map((p) => `${p.n}=${p.f.tex}${p.isAngle ? angleSuffix() : ''}`).join(',\\quad '),
        text: parts.map((p) => `${p.n.replace('\\theta', 'θ')} = ${p.f.text}`).join(', '),
        plain: parts[0].f.plain,
        first: v.pair[0][1],
      };
    }
    return fmtScalar(v);
  }

  function explain(err) {
    if (err instanceof CalcError) return { title: err.kind, detail: err.message };
    const m = String((err && err.message) || err);
    const pos = /\(char (\d+)\)/.exec(m);
    const at = pos ? ` (near character ${pos[1]})` : '';
    let r;
    if (/Parenthesis \) expected/.test(m)) r = ['Syntax ERROR', 'A closing parenthesis “)” is missing.'];
    else if (/Unexpected end of expression/.test(m)) r = ['Syntax ERROR', 'The expression ends too early — a number or argument is missing.'];
    else if (/Value expected|Unexpected operator/.test(m)) r = ['Syntax ERROR', `An operator is missing a number on one side${at}.`];
    else if (/Undefined symbol (\S+)/.test(m)) {
      const name = /Undefined symbol (\S+)/.exec(m)[1];
      r = ['Syntax ERROR', `“${name}” isn’t recognised. Variables are A–F, X and Ans; put * between letters to multiply (e.g. A*B).`];
    } else if (/Undefined function (\S+)/.test(m)) r = ['Syntax ERROR', `“${/Undefined function (\S+)/.exec(m)[1]}()” isn’t a known function.`];
    else if (/Invalid left hand side/.test(m)) r = ['Syntax ERROR', 'Only a single variable can be assigned, e.g. A = 5. To solve an equation use Equation mode.'];
    else if (/length 3|Vectors with length 3/.test(m)) r = ['Dimension ERROR', 'The cross product needs two 3-dimensional vectors.'];
    else if (/Dimension mismatch|must be square|dimension|Dimensions mismatch|size/i.test(m)) r = ['Dimension ERROR', 'Matrix or vector sizes aren’t compatible for this operation.'];
    else if (/determinant is zero|singular/i.test(m)) r = ['Math ERROR', 'This matrix has no inverse because its determinant is 0.'];
    else if (/Too few arguments|Too many arguments|Wrong number of arguments/i.test(m)) r = ['Argument ERROR', 'Wrong number of values inside a function — separate arguments with commas.'];
    else if (/Unexpected type of argument/.test(m)) r = ['Argument ERROR', 'A function received a value of the wrong type (e.g. a matrix where a number was expected).'];
    else if (/Syntax|Unexpected|Unterminated/.test(m)) r = ['Syntax ERROR', `The expression couldn’t be read${at}.`];
    else r = ['Math ERROR', m];
    return { title: r[0], detail: r[1] };
  }

  function compileX(src) {
    const node = M.parse(preprocess(src));
    return makeFn(node, scope);
  }

  function solve(src, guess, lo, hi) {
    const pre = preprocess(src);
    const parts = splitEquation(pre);
    if (parts.length > 2) throw new CalcError('Syntax ERROR', 'An equation can contain only one “=” sign.');
    if (parts.length === 2 && (!parts[0].trim() || !parts[1].trim())) throw new CalcError('Syntax ERROR', 'Both sides of “=” need an expression.');
    const exprStr = parts.length === 2 ? `(${parts[0]})-(${parts[1]})` : pre;
    const node = M.parse(exprStr);
    let usesX = false;
    node.traverse((n) => { if (n.type === 'SymbolNode' && n.name === 'X') usesX = true; });
    if (!usesX) throw new CalcError('Syntax ERROR', 'The equation must contain the variable X.');
    const strict = makeFn(node, scope);
    const f = (x) => { try { const y = strict(x); return isFinite(y) ? y : NaN; } catch (e) { return NaN; } };
    if (!(lo < hi)) throw new CalcError('Argument ERROR', 'The search range start must be less than its end.');

    const roots = [];
    const tidy = (r) => {
      let v = +r.toPrecision(12);
      if (Math.abs(v - Math.round(v)) < 1e-9) v = Math.round(v);
      return v === 0 ? 0 : v;
    };
    const accept = (r) => {
      if (!isFinite(r)) return;
      const fr = f(r);
      if (!isFinite(fr) || Math.abs(fr) > 1e-8 * Math.max(1, Math.abs(r))) return;
      const v = tidy(r);
      if (roots.some((x) => Math.abs(x - v) < 1e-7 * Math.max(1, Math.abs(v)))) return;
      roots.push(v);
    };
    const newton = (x0) => {
      let x = x0;
      for (let i = 0; i < 120; i++) {
        const fx = f(x);
        if (!isFinite(fx)) return NaN;
        if (fx === 0) return x;
        const h = 1e-7 * Math.max(1, Math.abs(x));
        const d = (f(x + h) - f(x - h)) / (2 * h);
        if (!isFinite(d) || d === 0) return x;
        let step = fx / d;
        let xn = x - step;
        let tries = 0;
        while (tries < 30 && !(Math.abs(f(xn)) < Math.abs(fx))) { step /= 2; xn = x - step; tries++; }
        if (tries === 30) return x;
        if (Math.abs(xn - x) < 1e-15 * Math.max(1, Math.abs(x))) return xn;
        x = xn;
      }
      return x;
    };
    const bisect = (a, b, fa) => {
      for (let i = 0; i < 200; i++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (fm === 0 || b - a < 1e-15 * Math.max(1, Math.abs(m))) return m;
        if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
      }
      return (a + b) / 2;
    };

    if (isFinite(guess)) accept(newton(guess));
    const N = 4000;
    const step = (hi - lo) / N;
    let px = lo, pf = f(lo), ppf = NaN;
    for (let i = 1; i <= N && roots.length < 12; i++) {
      const x = lo + i * step;
      const fx = f(x);
      if (pf === 0) accept(px);
      else if (isFinite(pf) && isFinite(fx) && Math.sign(pf) !== Math.sign(fx) && fx !== 0) accept(newton(bisect(px, x, pf)));
      if (isFinite(ppf) && isFinite(pf) && isFinite(fx) && Math.abs(pf) < Math.abs(ppf) && Math.abs(pf) < Math.abs(fx) && Math.abs(pf) < 1e-2 * Math.max(1, Math.abs(ppf))) accept(newton(px));
      ppf = pf; pf = fx; px = x;
    }
    if (pf === 0) accept(px);
    return roots.sort((a, b) => a - b);
  }

  function stats(xs, ys) {
    const sum = (a) => a.reduce((s, v) => s + v, 0);
    const n = xs.length;
    const mean = sum(xs) / n;
    const sorted = [...xs].sort((a, b) => a - b);
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const counts = new Map();
    xs.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    const maxc = Math.max(...counts.values());
    const mode = maxc === 1 && n > 1 ? [] : [...counts].filter(([, c]) => c === maxc).map(([v]) => v).sort((a, b) => a - b);
    const ssx = sum(xs.map((v) => (v - mean) ** 2));
    const res = {
      n, sumX: sum(xs), sumX2: sum(xs.map((v) => v * v)), mean, median, mode,
      varP: ssx / n, varS: n > 1 ? ssx / (n - 1) : NaN,
      sdP: Math.sqrt(ssx / n), sdS: n > 1 ? Math.sqrt(ssx / (n - 1)) : NaN,
      min: sorted[0], max: sorted[n - 1],
    };
    if (ys) {
      const my = sum(ys) / n;
      const ssy = sum(ys.map((v) => (v - my) ** 2));
      const sxy = sum(xs.map((x, i) => (x - mean) * (ys[i] - my)));
      Object.assign(res, {
        meanY: my, sumY: sum(ys), sumY2: sum(ys.map((v) => v * v)), sumXY: sum(xs.map((x, i) => x * ys[i])),
        sdPY: Math.sqrt(ssy / n), sdSY: n > 1 ? Math.sqrt(ssy / (n - 1)) : NaN,
      });
      if (ssx === 0) res.regError = 'All X values are equal, so a regression line can’t be fitted.';
      else if (n < 2) res.regError = 'Regression needs at least two data points.';
      else {
        const b = sxy / ssx;
        res.b = b;
        res.a = my - b * mean;
        res.r = ssy === 0 ? NaN : sxy / Math.sqrt(ssx * ssy);
        res.r2 = res.r * res.r;
      }
    }
    return res;
  }

  window.Calc = {
    M, state, scope, CalcError, preprocess, toTex, evaluate, evalReal, formatValue, fmtNum, explain, compileX, solve, stats, snap, lastOf,
  };
})();
