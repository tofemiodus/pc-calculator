'use strict';

// Headless smoke test: loads the real index.html in Electron, drives the UI and
// prints engine results plus any console errors. Run with:
//   node_modules/electron/dist/electron.exe scripts/smoke.js

const path = require('node:path');
const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 880,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  const problems = [];
  win.webContents.on('console-message', (...args) => {
    const details = args[0] && typeof args[0] === 'object' && 'message' in args[0] ? args[0] : { level: args[1], message: args[2] };
    const level = typeof details.level === 'number' ? details.level : 0;
    const message = details.message || '';
    if (level >= 2 || /Content Security Policy|Refused to/i.test(message)) problems.push(`[console] ${message}`);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, url) => problems.push(`[load] ${code} ${desc} ${url}`));

  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await new Promise((r) => setTimeout(r, 500));

  const report = await win.webContents.executeJavaScript(`(async () => {
    const run = (expr) => {
      const input = document.querySelector('#input');
      input.value = expr;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return {
        expr: expr,
        result: document.querySelector('#result').innerText.trim(),
        texNodes: document.querySelectorAll('#result .katex').length,
      };
    };
    const cases = [run('2sin(30)+3/4'), run('1/2'), run('det(MatA)'), run('log10(1000)'), run('sqrt(-9)')];
    return {
      mathLoaded: typeof window.math === 'object',
      katexLoaded: typeof window.katex === 'object',
      modeTabs: document.querySelectorAll('#modes button').length,
      keypadKeys: document.querySelectorAll('#keypad .key').length,
      styleApplied: getComputedStyle(document.body).backgroundColor,
      cases: cases,
      history: document.querySelectorAll('#historyList li').length,
      constants: document.querySelectorAll('#constList li').length,
      fontsLoaded: [...document.fonts].filter((f) => f.family.includes('KaTeX')).length,
    };
  })()`);

  console.log(JSON.stringify({ report, problems }, null, 2));
  app.exit(problems.length ? 1 : 0);
});
