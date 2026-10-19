'use strict';
const W = 1920, H = 1080;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// ---------- farger ----------
const C = {
  bg: '#ffffff', ink: '#1b2635', mid: '#5b6878', soft: '#8a96a6',
  grid: '#e7ebf0', grid2: '#d3d9e1', acc: '#e8553f', accSoft: 'rgba(232,85,63,0.10)',
  line: '#2b3748', gray: '#7c8797'
};

// ---------- hjelpefunksjoner ----------
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = x => { x = clamp(x); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fmt1 = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1).replace('.', ',');

// fargeskala (dB -> farge)
const stops = [[-20, 26, 35, 140], [-15, 30, 70, 200], [-10, 30, 140, 220], [-7, 30, 180, 210], [-4, 60, 190, 140], [-1, 140, 205, 70], [1.5, 215, 215, 50], [4.5, 245, 170, 45], [7, 242, 120, 50], [9.5, 235, 70, 60], [10, 232, 64, 60]];
const lutRGB = [], lutStr = [];
(function () {
  for (let i = 0; i <= 300; i++) {
    const v = -20 + i * 0.1; let c = stops[stops.length - 1].slice(1);
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1];
      if (v >= a[0] && v <= b[0]) { const t = (v - a[0]) / (b[0] - a[0]); c = [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; break; }
    }
    c = c.map(Math.round); lutRGB.push(c); lutStr.push('rgb(' + c.join(',') + ')');
  }
})();
const cmi = v => Math.max(0, Math.min(300, Math.round((v + 20) * 10)));
const cm = v => lutStr[cmi(v)];

// ---------- tekst ----------
function T(s, x, y, o = {}) {
  ctx.save();
  ctx.font = o.f || '400 22px Roboto';
  ctx.fillStyle = o.c || C.ink;
  ctx.textAlign = o.al || 'left';
  ctx.textBaseline = 'alphabetic';
  if (o.a !== undefined) ctx.globalAlpha *= o.a;
  if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); ctx.fillText(s, 0, 0); }
  else ctx.fillText(s, x, y);
  ctx.restore();
}
function L(x1, y1, x2, y2, c, w = 1, dash) {
  ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}

// ---------- data: EEG ----------
function makeEEG(seed, dur = 6, fs = 250) {
  const r = rng(seed), n = Math.round(dur * fs);
  const comps = [
    [1.6 + r() * .3, 0.9], [3.0 + r() * .2, 1.4], [5.2 + r() * .3, 0.30],
    [9.2 + r() * .3, 0.9], [10.6 + r() * .3, 1.0], [12.0 + r() * .3, 0.35],
    [16 + r(), 0.10], [21.5 + r(), 0.12], [25 + r(), 0.09]
  ].map(c => ({ f: c[0], a: c[1], ph: r() * 6.283, ef: 0.15 + r() * 0.5, ep: r() * 6.283 }));
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / fs; let v = 0;
    for (const c of comps) v += c.a * (0.65 + 0.35 * Math.sin(2 * Math.PI * c.ef * t + c.ep)) * Math.sin(2 * Math.PI * c.f * t + c.ph);
    x[i] = v;
  }
  // lett støy, glattet
  let p = 0; for (let i = 0; i < n; i++) { p = 0.6 * p + 0.4 * gauss(r); x[i] += 0.55 * p; }
  let s = 0; for (let i = 0; i < n; i++) s += x[i] * x[i];
  const k = 20 / Math.sqrt(s / n);
  for (let i = 0; i < n; i++) x[i] *= k;
  return { x, fs, n };
}
const EEG = [makeEEG(11), makeEEG(23), makeEEG(37), makeEEG(51)];
const CH = ['L1', 'L2', 'R1', 'R2'];

// effektspekter fra de to første sekundene av L1
const SPEC = (function () {
  const e = EEG[0], n = 500, mag = [];
  for (let k = 0; k <= 60; k++) {
    const f = k * 0.5; let re = 0, im = 0;
    for (let i = 0; i < n; i++) {
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)), a = 2 * Math.PI * f * i / e.fs;
      re += e.x[i] * w * Math.cos(a); im -= e.x[i] * w * Math.sin(a);
    }
    mag.push(Math.hypot(re, im));
  }
  const db = mag.map(m => 20 * Math.log10(m + 1e-9));
  const mx = Math.max(...db), off = 18.4 - mx;
  return db.map(v => Math.max(-20, v + off));
})();
const BANDS = [
  { n: 'Delta', r: '< 4 Hz', a: 0, b: 4, end: 4.0 },
  { n: 'Theta', r: '4–7 Hz', a: 4, b: 7, end: 7.5 },
  { n: 'Alfa', r: '8–12 Hz', a: 8, b: 12, end: 12.5 },
  { n: 'Beta', r: '13–30 Hz', a: 13, b: 30, end: 30 }
];
BANDS.forEach(b => { let m = -99; for (let k = 0; k <= 60; k++) { const f = k * .5; if (f >= b.a && f <= b.b) m = Math.max(m, SPEC[k]); } b.peak = m; });
const specAt = f => { const k = clamp(f * 2, 0, 60), i = Math.floor(k), j = Math.min(60, i + 1); return lerp(SPEC[i], SPEC[j], k - i); };

// små bølgeformer for frekvensbåndene
function bandWave(kind, N = 120) {
  const out = [], r = rng(5 + kind);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1); let v;
    if (kind === 0) v = Math.sin(2 * Math.PI * 3.2 * u);
    else if (kind === 1) v = Math.sin(2 * Math.PI * 7 * u) * Math.exp(-Math.pow((u - 0.33) / 0.12, 2)) * 1.0 + 0.08 * Math.sin(2 * Math.PI * 9 * u);
    else if (kind === 2) v = Math.sin(2 * Math.PI * 17 * u) * (0.25 + 0.75 * smooth(0.6, 1, u)) ;
    else v = Math.sin(2 * Math.PI * 38 * u + 2 * Math.sin(2 * Math.PI * 3 * u)) * (0.35 + 0.65 * Math.abs(Math.sin(2 * Math.PI * 2.5 * u + 1)));
    out.push(v);
  }
  return out;
}
const BW = [0, 1, 2, 3].map(k => bandWave(k));

// ---------- data: DSA ----------
const prof = [[0, 2], [0.8, 9], [3.8, 9], [4.6, 3], [5.4, 2], [7.4, 3], [8.2, 10], [12, 10.5], [13, -1], [14.5, -5], [22, -8], [30, -14]];
function profile(f) {
  for (let k = 0; k < prof.length - 1; k++) if (f <= prof[k + 1][0]) { const t = (f - prof[k][0]) / (prof[k + 1][0] - prof[k][0]); return lerp(prof[k][1], prof[k + 1][1], t); }
  return prof[prof.length - 1][1];
}
function field(nT, nF, seed, sd, blur) {
  const r = rng(seed); let g = [];
  for (let i = 0; i < nT; i++) { g.push(new Float32Array(nF)); for (let j = 0; j < nF; j++) g[i][j] = gauss(r); }
  for (let b = 0; b < blur; b++) {
    const h = g.map(a => Float32Array.from(a));
    for (let i = 0; i < nT; i++) for (let j = 0; j < nF; j++) {
      let s = 0, c = 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const a = i + di, bb = j + dj; if (a >= 0 && a < nT && bb >= 0 && bb < nF) { s += h[a][bb]; c++; } }
      g[i][j] = s / c;
    }
  }
  if (blur) { let q = 0, c = 0; for (const a of g) for (const v of a) { q += v * v; c++; } const k = 1 / Math.sqrt(q / c); for (const a of g) for (let j = 0; j < nF; j++) a[j] *= k; }
  const out = [];
  for (let i = 0; i < nT; i++) {
    out.push(new Float32Array(nF));
    for (let j = 0; j < nF; j++) {
      const f = j / (nF - 1) * 30, tt = i / (nT - 1);
      const mod = 1.8 * Math.sin(2 * Math.PI * 1.5 * tt + f * 0.35) + (f > 12.5 ? 1.2 * Math.sin(2 * Math.PI * 0.8 * tt + f) : 0);
      const s = f < 13 ? sd : sd * 0.85;
      out[i][j] = clamp(profile(f) + mod + g[i][j] * s, -20, 13);
    }
  }
  return out;
}
const NT = 90, NF = 40;
const SURF = field(NT + 1, NF + 1, 7, 3.6, 0);
const HM_L = field(180, 60, 31, 3.2, 2), HM_R = field(180, 60, 77, 3.2, 2);

// forhåndsbygde varmekart
function heatCanvas(g, nT, nF, flipF) {
  const c = document.createElement('canvas'); c.width = nT; c.height = nF;
  const x = c.getContext('2d'), im = x.createImageData(nT, nF);
  for (let i = 0; i < nT; i++) for (let j = 0; j < nF; j++) {
    const v = g[i][j], col = lutRGB[cmi(v)], row = flipF ? j : nF - 1 - j, p = (row * nT + i) * 4;
    im.data[p] = col[0]; im.data[p + 1] = col[1]; im.data[p + 2] = col[2]; im.data[p + 3] = 255;
  }
  x.putImageData(im, 0, 0); return c;
}
const HC_L = heatCanvas(HM_L, 180, 60, false);
const HC_R = heatCanvas(HM_R, 180, 60, true);
const HC_S = (function () { // 3D-flate sett ovenfra (celler = snitt av hjørner)
  const g = []; for (let i = 0; i < NT; i++) { g.push(new Float32Array(NF)); for (let j = 0; j < NF; j++) g[i][j] = (SURF[i][j] + SURF[i + 1][j] + SURF[i][j + 1] + SURF[i + 1][j + 1]) / 4; }
  return heatCanvas(g, NT, NF, false);
})();

// ---------- felles ramme ----------
const SEC = [
  { a: 0, b: 10, n: 'EEG' }, { a: 10, b: 40, n: 'Frekvenser' }, { a: 40, b: 50, n: 'Farge' },
  { a: 50, b: 65, n: '3D-flate' }, { a: 65, b: 80, n: 'DSA' }, { a: 80, b: 90, n: 'SedLine' }
];
const secIdx = t => { let k = 0; SEC.forEach((s, i) => { if (t >= s.a) k = i; }); return k; };

function drawBackground() {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#f4f6f9'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W; x += 40) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); }
  for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); }
  ctx.stroke();
}
function drawHeader(title, sub, idx) {
  T('Masimo SedLine® / EEG–DSA', 1840, 76, { f: '500 24px Roboto', c: C.mid, al: 'right' });
  T(title, 80, 176, { f: '600 62px SerifD', c: C.ink });
  T(sub, 82, 217, { f: '500 26px Roboto', c: C.mid });
  T('0' + (idx + 1) + ' / 06', 1838, 172, { f: '500 24px Roboto', c: C.mid, al: 'right' });
  L(80, 253, 1840, 253, C.grid2, 1.5);
}
function drawCaption(main, small) {
  ctx.fillStyle = C.acc; ctx.fillRect(80, 934, 4, 38);
  T(main, 104, 962, { f: '500 29px Roboto', c: C.ink });
  if (small) T(small, 104, 990, { f: '400 17px Roboto', c: C.soft });
}
function drawFooter(t) {
  const act = secIdx(t);
  SEC.forEach((s, i) => {
    const x = 80 + 296 * i;
    L(x, 1013, x + 264, 1013, t >= s.a ? C.acc : '#cfd5de', 3);
    T(s.n, x, 1049, { f: (i === act ? '700' : '400') + ' 21px Roboto', c: i === act ? C.ink : C.mid });
  });
  T(String(Math.min(90, Math.floor(t))).padStart(2, '0') + ' / 90 s', 1840, 1049, { f: '500 21px Roboto', c: C.mid, al: 'right' });
}
const sceneAlpha = (t, a, b, fi = 0.4, fo = 0.3) => clamp((t - a) / fi) * clamp((b - t) / fo);

// ---------- fargeskala ----------
function colorbar(x, y0, y1, labX, ticks, titleY) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (let i = 0; i <= 30; i++) g.addColorStop(i / 30, cm(10 - i));
  ctx.fillStyle = g; ctx.fillRect(x, y0, 25, y1 - y0);
  ticks.forEach(v => {
    const y = y0 + (10 - v) / 30 * (y1 - y0);
    L(x + 25, y, x + 32, y, C.mid, 1.5);
    T((v < 0 ? '−' : '') + Math.abs(v), labX, y + 7, { f: '400 22px Roboto', c: C.mid });
  });
  T('dB*', x + 12, titleY, { f: '500 22px Roboto', c: C.mid, al: 'center' });
}

// ---------- SCENE 1 ----------
function scene1(t) {
  drawHeader('Fra EEG til DSA', 'Fire EEG-kanaler. En måte å se frekvensenes effekt over tid.', 0);
  const x0 = 256, pps = 235, base = [403, 523, 644, 765];
  T('Spenning (µV)', 256, 300, { f: '400 24px Roboto', c: C.mid });
  T('VENSTRE', 82, 387, { f: '500 22px Roboto', c: C.mid });
  T('HØYRE', 82, 629, { f: '500 22px Roboto', c: C.mid });
  const prog = Math.min(6, Math.max(0, (t - 0.3) * 1.8));
  CH.forEach((n, k) => {
    T(n, 172, base[k] + 9, { f: '700 26px Roboto', c: C.ink });
    L(x0, base[k], x0 + 6 * pps, base[k], C.grid2, 1.5);
    const e = EEG[k]; ctx.save(); ctx.beginPath(); ctx.strokeStyle = C.line; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    const N = Math.floor(prog * e.fs);
    for (let i = 0; i < N; i += 2) { const x = x0 + i / e.fs * pps, y = base[k] - e.x[i] * 0.95; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
  });
  // skalastang
  L(1738, 345, 1738, 434, C.mid, 1.5); L(1730, 345, 1746, 345, C.mid, 1.5); L(1730, 434, 1746, 434, C.mid, 1.5);
  T('+50', 1760, 353, { f: '400 22px Roboto', c: C.mid }); T('−50', 1760, 442, { f: '400 22px Roboto', c: C.mid });
  // tidsakse
  for (let k = 0; k <= 6; k++) { L(x0 + k * pps, 829, x0 + k * pps, 840, C.mid, 1.5); T(String(k), x0 + k * pps, 874, { f: '400 24px Roboto', c: C.mid, al: 'center' }); }
  T('Tid (s)', 1840, 874, { f: '400 28px Roboto', c: C.mid, al: 'right' });
  // analysevindu
  const wa = smooth(4.6, 5.8, t);
  if (wa > 0) {
    ctx.save(); ctx.globalAlpha *= wa;
    ctx.fillStyle = 'rgba(232,85,63,0.07)'; ctx.fillRect(x0, 322, 2 * pps, 513);
    ctx.strokeStyle = C.acc; ctx.lineWidth = 2.5; ctx.strokeRect(x0, 322, 2 * pps, 513);
    T('2 s analysevindu', x0 + 14, 350, { f: '500 22px Roboto', c: C.acc });
    ctx.restore();
  }
  drawCaption('EEG er svingninger i spenning. Analysen henter ut korte tidsperioder.', 'Syntetisk frontal-EEG · eksempel med alfa- og langsombølgedominans');
}

// ---------- SCENE 2 ----------
function scene2(t) {
  const lt = t - 10;
  drawHeader('Frekvensene skilles fra hverandre', 'Fourier-transformasjon gjør EEG-perioden om til en frekvensframstilling.', 1);
  // venstre: EEG-utsnitt
  const bx = 195, bw = 540, by = 350, bh = 168, yz = 434;
  T('EEG · L1', bx, 307, { f: '500 26px Roboto', c: C.ink });
  T('µV', 177, 327, { f: '400 22px Roboto', c: C.mid, al: 'right' });
  L(bx + 270, by, bx + 270, by + bh, C.grid2, 1.5);
  [[50, '50'], [0, '0'], [-50, '−50']].forEach(([v, s]) => { T(s, 172, yz - v * 1.4 + 8, { f: '400 22px Roboto', c: C.mid, al: 'right' }); });
  L(bx, by, bx, by + bh, C.mid, 1.5); L(bx, by + bh, bx + bw, by + bh, C.mid, 1.5); L(bx + bw, by, bx + bw, by + bh, C.grid2, 1.5);
  [0, 1, 2].forEach(k => T(String(k), bx + 270 * k, 553, { f: '400 22px Roboto', c: C.mid, al: 'center' }));
  T('Tid (s)', bx + bw, 592, { f: '400 24px Roboto', c: C.mid, al: 'right' });
  const sp = clamp(lt / 1.6), e0 = EEG[0];
  ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip(); ctx.beginPath(); ctx.strokeStyle = C.gray; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
  const N = Math.floor(sp * 500);
  for (let i = 0; i < N; i += 2) { const x = bx + i / 250 * 270, y = yz - e0.x[i] * 1.4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.restore();

  // aktivt bånd
  const stage = lt < 5 ? -1 : Math.min(4, Math.floor((lt - 5) / 5)); // -1 intro, 0..3 bånd, 4 helhet
  const bandI = stage >= 0 && stage <= 3 ? stage : -1;
  if (bandI >= 0) T('Fremhevet frekvenskomponent', bx, 593, { f: '500 18px Roboto', c: C.acc });
  T('EEGs frekvensbånd', bx, 631, { f: '400 22px Roboto', c: C.mid });
  const ry = [674, 740, 806, 872];
  BANDS.forEach((b, k) => {
    const on = k === bandI;
    if (on) { ctx.fillStyle = C.accSoft; ctx.fillRect(181, ry[k] - 28, 568, 57); ctx.fillStyle = C.acc; ctx.fillRect(181, ry[k] - 28, 4, 57); }
    T(b.n, 195, ry[k] + 8, { f: '700 24px Roboto', c: on ? C.acc : C.ink });
    T(b.r, 289, ry[k] + 8, { f: '400 22px Roboto', c: on ? C.acc : C.mid });
    ctx.save(); ctx.beginPath(); ctx.strokeStyle = on ? C.acc : C.line; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    BW[k].forEach((v, i) => { const x = 460 + i / 119 * 275, y = ry[k] - v * 22; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.restore();
  });

  // midten: bånd, Hann, FFT, pil
  const ma = smooth(0.8, 1.8, lt);
  ctx.save(); ctx.globalAlpha *= ma;
  if (bandI >= 0) { T(BANDS[bandI].n, 870, 311, { f: '700 28px Roboto', c: C.acc, al: 'center' }); T(BANDS[bandI].r, 870, 343, { f: '400 20px Roboto', c: C.acc, al: 'center' }); }
  T('Hann-vindu', 870, 397, { f: '400 22px Roboto', c: C.mid, al: 'center' });
  T('FFT', 870, 443, { f: '700 38px Roboto', c: C.ink, al: 'center' });
  const aw = smooth(1.2, 2.4, lt) * 183;
  L(785, 480, 785 + aw, 480, C.acc, 2.5);
  if (aw > 170) { ctx.fillStyle = C.acc; ctx.beginPath(); ctx.moveTo(968, 480); ctx.lineTo(954, 473); ctx.lineTo(954, 487); ctx.fill(); }
  ctx.restore();

  // høyre: effektspekter
  const sx = f => 1078 + f * 20.87, sy = d => 350 + (30 - d) * 7.8;
  T('Effektspekter', 1078, 307, { f: '700 26px Roboto', c: C.ink });
  T('Spektral effekt (dB*)', 1078, 335, { f: '400 22px Roboto', c: C.mid });
  [[30, '30'], [15, '15'], [0, '0'], [-20, '−20']].forEach(([v, s]) => { if (v === 15 || v === 0 || v === 30) L(1078, sy(v), 1704, sy(v), C.grid2, 1.5); T(s, 1054, sy(v) + 8, { f: '400 22px Roboto', c: C.mid, al: 'right' }); });
  [10, 20, 30].forEach(f => L(sx(f), 350, sx(f), 740, C.grid2, 1.5));
  L(1078, 350, 1078, 740, C.mid, 1.5); L(1078, 740, 1704, 740, C.mid, 1.5);
  [0, 10, 20, 30].forEach(f => T(String(f), sx(f), 775, { f: '400 22px Roboto', c: C.mid, al: 'center' }));
  T('Frekvens (Hz)', 1704, 912, { f: '400 24px Roboto', c: C.mid, al: 'right' });
  T('Toppeffekt (dB*)', 1078, 912, { f: '400 20px Roboto', c: C.mid });
  // bånd-parenteser
  BANDS.forEach((b, k) => {
    const x1 = sx(b.a) + (k === 0 ? 0 : 2), x2 = sx(b.b) - (k === 3 ? 1 : 0), on = k === bandI;
    ctx.save(); ctx.strokeStyle = on ? C.acc : C.gray; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x1, 799); ctx.lineTo(x1, 792); ctx.lineTo(x2, 792); ctx.lineTo(x2, 799); ctx.stroke(); ctx.restore();
    const cx = (x1 + x2) / 2;
    T(b.n, cx, 822, { f: '700 19px Roboto', c: on ? C.acc : C.ink, al: 'center' });
    T(b.r, cx, 847, { f: '400 17px Roboto', c: on ? C.acc : C.mid, al: 'center' });
    // verdi
    let done = false;
    if (stage > k || stage === 4) done = true; else if (stage === k) done = ((lt - 5) % 5) > 3.2;
    T(done ? fmt1(b.peak) : '—', cx, 880, { f: '700 20px Roboto', c: on ? C.acc : C.ink, al: 'center' });
  });

  // spekterkurve
  if (stage >= 0) {
    const ph = stage === 4 ? 1 : ease(((lt - 5) % 5) / 3);
    const prevEnd = stage === 4 ? 30 : (stage === 0 ? 0 : BANDS[stage - 1].end);
    const curEnd = stage === 4 ? 30 : BANDS[stage].end;
    const fmax = stage === 4 ? 30 : lerp(prevEnd, curEnd, ph);
    const pts = []; for (let f = 0; f <= fmax + 1e-6; f += 0.5) pts.push([f, specAt(f)]);
    if (fmax % 0.5 > 1e-6) pts.push([fmax, specAt(fmax)]);
    const draw = (from, to, col, w) => {
      ctx.save(); ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; let st = false;
      for (let f = from; f <= to + 1e-6; f += 0.5) { const ff = Math.min(f, fmax); if (f > fmax + 0.5) break; const x = sx(ff), y = sy(specAt(ff)); st ? ctx.lineTo(x, y) : ctx.moveTo(x, y); st = true; }
      ctx.stroke(); ctx.restore();
    };
    const fill = (from, to, col) => {
      ctx.save(); ctx.beginPath(); ctx.fillStyle = col; const a = from, b = Math.min(to, fmax); if (b <= a) { ctx.restore(); return; }
      ctx.moveTo(sx(a), sy(-20)); for (let f = a; f <= b + 1e-6; f += 0.5) ctx.lineTo(sx(Math.min(f, b)), sy(specAt(Math.min(f, b)))); ctx.lineTo(sx(b), sy(-20)); ctx.closePath(); ctx.fill(); ctx.restore();
    };
    if (stage === 4) { fill(0, 30, 'rgba(27,38,53,0.05)'); draw(0, 30, C.line, 3); }
    else {
      const bs = BANDS[stage].a;
      fill(0, bs, 'rgba(27,38,53,0.05)'); draw(0, Math.max(0, bs), C.gray, 3);
      // koral del
      ctx.save(); ctx.beginPath(); ctx.rect(sx(bs) - 1, 340, 2000, 420); ctx.clip();
      fill(bs, curEnd, 'rgba(232,85,63,0.14)'); draw(Math.max(0, bs - 0.5), curEnd, C.acc, 3.5); ctx.restore();
      // topp-markør
      if (ph > 0.85) {
        let pf = 0, pv = -99; for (let f = BANDS[stage].a; f <= BANDS[stage].b; f += 0.5) if (specAt(f) > pv) { pv = specAt(f); pf = f; }
        L(sx(pf), sy(pv), sx(pf), 740, C.acc, 1.5, [5, 5]);
        ctx.fillStyle = C.acc; ctx.beginPath(); ctx.arc(sx(pf), sy(pv), 6, 0, 7); ctx.fill();
      }
    }
  }
  // bildetekst
  const FOOT = '* Toppeffekt = største spektrale effekt i båndet · dB relativt til 1 µV²/Hz';
  let cap, small = null;
  if (lt < 5) cap = 'Den røde kurven viser én frekvenskomponent i EEG.';
  else if (lt < 25) { cap = 'Kurvens høyde viser effekt. Tallet viser toppeffekten i båndet.'; small = FOOT; }
  else if (lt < 30) { cap = 'Kurvens høyde viser effekt. Tallet viser toppeffekten i båndet.'; small = FOOT; }
  else if (lt < 35) { cap = 'Fourier-transformasjonen flytter blikket fra tid til frekvens.'; small = FOOT; }
  else { cap = 'Effektspekteret viser hvilke frekvenser EEG-en har effekt i.'; small = FOOT; }
  drawCaption(cap, small);
}

// ---------- SCENE 3 ----------
function scene3(t) {
  const lt = t - 40;
  drawHeader('Spektral effekt får farge', 'Høy effekt vises som varme farger, lav effekt som kalde.', 2);
  const x0 = 220, x1 = 1480, y0 = 350, y1 = 731, px = (x1 - x0) / 30, py = (y1 - y0) / 50;
  const sx = f => x0 + f * px, sy = d => y0 + (30 - d) * py;
  T('Spektral effekt (dB*)', 220, 317, { f: '400 26px Roboto', c: C.mid });
  [[30, '30'], [15, '15'], [0, '0'], [-20, '−20']].forEach(([v, s]) => { if (v !== -20) L(x0, sy(v), x1, sy(v), C.grid2, 1.5); T(s, 196, sy(v) + 8, { f: '400 22px Roboto', c: C.mid, al: 'right' }); });
  for (let f = 5; f <= 30; f += 5) L(sx(f), y0, sx(f), y1, C.grid2, 1.5);
  L(x0, y0, x0, y1, C.mid, 1.5); L(x0, y1, x1, y1, C.mid, 1.5);
  for (let f = 0; f <= 30; f += 5) T(String(f), sx(f), 764, { f: '400 22px Roboto', c: C.mid, al: 'center' });
  T('Frekvens (Hz)', x1, 900, { f: '400 26px Roboto', c: C.mid, al: 'right' });
  // kurve
  const draw = clamp(lt / 1.6), fmax = 30 * ease(draw);
  const pts = []; for (let f = 0; f <= fmax + 1e-6; f += 0.5) pts.push([f, specAt(f)]);
  if (fmax % 0.5 > 1e-6) pts.push([fmax, specAt(fmax)]);
  const gfade = smooth(1.6, 3.2, lt);
  ctx.save(); ctx.beginPath(); ctx.moveTo(sx(0), y1); pts.forEach(p => ctx.lineTo(sx(p[0]), sy(p[1]))); ctx.lineTo(sx(pts[pts.length - 1][0]), y1); ctx.closePath();
  const g = ctx.createLinearGradient(0, y0, 0, y1); for (let i = 0; i <= 30; i++) g.addColorStop(clamp((30 - (10 - i)) / 50), cm(10 - i));
  g.addColorStop(0, cm(10));
  ctx.globalAlpha *= gfade; ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(sx(p[0]), sy(p[1])) : ctx.moveTo(sx(p[0]), sy(p[1])));
  ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  // fargebånd
  T('Én EEG-periode', 220, 808, { f: '400 22px Roboto', c: C.mid });
  const sp = clamp((lt - 3.2) / 6), nC = 60, cw = (x1 - x0) / nC, shown = sp * nC;
  for (let k = 0; k < nC; k++) {
    if (k + 1 > shown + 1e-6 && k > shown) break;
    const f = (k + 0.5) / 2, w = Math.min(1, shown - k);
    ctx.fillStyle = cm(specAt(f)); ctx.fillRect(x0 + k * cw, 825, cw * w + 0.6, 40);
  }
  if (sp > 0 && sp < 1) {
    const fc = sp * 30; L(sx(fc), sy(specAt(fc)), sx(fc), 870, C.ink, 1.5, [5, 5]);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(fc), sy(specAt(fc)), 6, 0, 7); ctx.fill(); ctx.stroke();
  }
  // fargeskala
  const ca = smooth(1.6, 3, lt); ctx.save(); ctx.globalAlpha *= ca;
  colorbar(1657, 350, 731, 1700, [10, 0, -10, -20], 325);
  T('Stor', 1633, 358, { f: '400 24px Roboto', c: C.mid, al: 'right' }); T('Liten', 1633, 738, { f: '400 24px Roboto', c: C.mid, al: 'right' });
  ctx.restore();
  drawCaption('Hele effektspekteret komprimeres til ett fargebånd.', 'Fargeskala: −20…10 dB* · Referanse: 1 µV²/Hz');
}

// ---------- SCENE 4+5: 3D-flate -> DSA ----------
const CAM3 = { O: [380, 700], T: [1040, 180], F: [100, -400], P: 5 };
const CAM2 = { O: [330, 866], T: [1260, 0], F: [0, -520], P: 0 };
function surface(t) {
  const e = ease((t - 66.5) / 8);
  const mix = (a, b) => a.map((v, i) => lerp(v, b[i], e));
  const O = mix(CAM3.O, CAM2.O), Tv = mix(CAM3.T, CAM2.T), Fv = mix(CAM3.F, CAM2.F), P = lerp(CAM3.P, CAM2.P, e);
  const grow = clamp((t - 50.5) / 9.5), vis = Math.max(0, Math.floor(ease(grow) * NT + 1e-6));
  const pr = (ti, fj, z) => {
    const u = ti / NT, v = fj / NF, h = (z + 20) * P;
    return [O[0] + Tv[0] * u + Fv[0] * v, O[1] + Tv[1] * u + Fv[1] * v - h];
  };
  const alpha = clamp((t - 50) / 0.6);
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.beginPath(); ctx.rect(0, 256, W, 640); ctx.clip();
  // bunn
  const b0 = pr(0, 0, -20), b1 = pr(NT, 0, -20), b2 = pr(NT, NF, -20), b3 = pr(0, NF, -20);
  ctx.beginPath(); ctx.moveTo(...b0); ctx.lineTo(...b1); ctx.lineTo(...b2); ctx.lineTo(...b3); ctx.closePath();
  ctx.fillStyle = '#eef1f5'; ctx.fill(); ctx.strokeStyle = C.grid2; ctx.lineWidth = 1.5; ctx.stroke();
  // flate
  const flat = e > 0.995;
  if (vis > 0 && !flat) {
    ctx.lineWidth = 0.7; ctx.lineJoin = 'round';
    for (let j = NF - 1; j >= 0; j--) for (let i = 0; i < vis; i++) {
      const z00 = SURF[i][j], z10 = SURF[i + 1][j], z11 = SURF[i + 1][j + 1], z01 = SURF[i][j + 1];
      const p00 = pr(i, j, z00), p10 = pr(i + 1, j, z10), p11 = pr(i + 1, j + 1, z11), p01 = pr(i, j + 1, z01);
      let col = cm((z00 + z10 + z11) / 3);
      ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(...p00); ctx.lineTo(...p10); ctx.lineTo(...p11); ctx.closePath(); ctx.fill(); ctx.stroke();
      col = cm((z00 + z11 + z01) / 3); ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(...p00); ctx.lineTo(...p11); ctx.lineTo(...p01); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // frontvegg
    const wa = 1 - e;
    if (wa > 0.01) {
      ctx.save(); ctx.globalAlpha *= wa;
      for (let i = 0; i < vis; i++) {
        const a = pr(i, 0, SURF[i][0]), b = pr(i + 1, 0, SURF[i + 1][0]), c = pr(i + 1, 0, -20), d = pr(i, 0, -20);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
        ctx.fillStyle = '#cdd5df'; ctx.strokeStyle = '#cdd5df'; ctx.lineWidth = 0.6; ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }
  if (vis > 0) { // blokk-visning ovenfra
    const a = smooth(0.86, 1, e);
    if (a > 0) {
      ctx.save(); ctx.globalAlpha *= a; ctx.imageSmoothingEnabled = false;
      const cols = vis; // vis hele når grow = 1
      ctx.drawImage(HC_S, 0, 0, cols, NF, O[0], O[1] + Fv[1], Tv[0] * cols / NT, -Fv[1]);
      ctx.restore();
    }
  }
  ctx.restore();

  // akser
  ctx.save(); ctx.globalAlpha *= alpha;
  const top = e;
  // frekvensakse
  const fa = pr(0, 0, -20), fb = pr(0, NF, -20);
  L(fa[0] - 64, fa[1] - 12, fb[0] - 64, fb[1] - 12, C.grid2, 1.5);
  [0, 10, 20, 30].forEach(f => {
    const p = pr(0, f / 30 * NF, -20);
    L(p[0] - 70, p[1] - 12, p[0] - 58, p[1] - 12, C.mid, 1.5);
    T(String(f), p[0] - 80, p[1] - 4, { f: '400 22px Roboto', c: C.mid, al: 'right' });
  });
  const mid = pr(0, NF * 0.58, -20), ang = Math.atan2(Fv[1], Fv[0]);
  T('Frekvens (Hz)', mid[0] - lerp(165, 150, e), mid[1] - 10, { f: '400 26px Roboto', c: C.mid, al: 'center', rot: ang });
  // tidsakse
  [0, 60, 120, 180].forEach(s => {
    const p = pr(s / 180 * NT, 0, -20);
    L(p[0], p[1] + 2, p[0], p[1] + 11, C.mid, 1.5);
    T(String(s), p[0], p[1] + 31, { f: '400 24px Roboto', c: C.mid, al: 'center' });
  });
  const tm = pr(NT * 0.8, 0, -20); T('Tid (s)', tm[0], tm[1] + lerp(36, 50, e), { f: '400 26px Roboto', c: C.mid, al: 'center' });
  // effekt-akse (3D)
  const pa = 1 - smooth(0, 0.45, e);
  if (pa > 0.01) { ctx.save(); ctx.globalAlpha *= pa; const o = pr(0, 0, -20); L(o[0] - 6, o[1] - 8, o[0] - 6, o[1] - 70, C.mid, 1.8); ctx.fillStyle = C.mid; ctx.beginPath(); ctx.moveTo(o[0] - 6, o[1] - 78); ctx.lineTo(o[0] - 12, o[1] - 66); ctx.lineTo(o[0], o[1] - 66); ctx.fill(); T('Spektral effekt', o[0] + 18, o[1] - 70, { f: '400 22px Roboto', c: C.mid }); T('(dB*)', o[0] + 18, o[1] - 44, { f: '400 22px Roboto', c: C.mid }); ctx.restore(); }
  // DSA-tittel
  const da = smooth(0.9, 1, e); if (da > 0) T('Density Spectral Array (DSA)', O[0] + Tv[0] / 2, O[1] + Fv[1] - 16, { f: '500 22px Roboto', c: C.mid, al: 'center', a: da });
  colorbar(1750, 385, 740, 1790, [10, 0, -10, -20], 360);
  ctx.restore();
}

// ---------- SCENE 6 ----------
function scene6(t) {
  const lt = t - 80;
  drawHeader('SedLine: venstre og høyre DSA', 'Fire frontale EEG-kanaler gir informasjon fra begge sider.', 5);
  const x0 = 257, x1 = 1605, rv = clamp((lt - 0.8) / 6), xr = lerp(x0, x1, ease(rv));
  const panels = [{ y: 353, h: 195, hc: HC_L, lab: 'VENSTRE  ·  L1 / L2', ly: 320, fl: false, ty: 583 }, { y: 641, h: 195, hc: HC_R, lab: 'HØYRE  ·  R1 / R2', ly: 608, fl: true, ty: 871 }];
  panels.forEach(p => {
    T('Hz', 205, p.ly - 1, { f: '400 22px Roboto', c: C.mid, al: 'center' });
    T(p.lab, 257, p.ly + 4, { f: '700 26px Roboto', c: C.ink });
    ctx.save(); ctx.beginPath(); ctx.rect(x0, p.y, Math.max(0, xr - x0), p.h); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(p.hc, x0, p.y, x1 - x0, p.h); ctx.restore();
    ctx.strokeStyle = C.grid2; ctx.lineWidth = 1.5; ctx.strokeRect(x0, p.y, x1 - x0, p.h);
    [0, 10, 20, 30].forEach(f => {
      const y = p.fl ? p.y + f / 30 * p.h : p.y + p.h - f / 30 * p.h;
      L(x0 - 10, y, x0, y, C.mid, 1.5); T(String(f), 233, y + 8, { f: '400 22px Roboto', c: C.mid, al: 'right' });
    });
    [0, 60, 120, 180].forEach(s => T(String(s), x0 + s / 180 * (x1 - x0), p.ty, { f: '400 24px Roboto', c: C.mid, al: 'center' }));
    if (rv > 0 && rv < 1) L(xr, p.y, xr, p.y + p.h, '#ffffff', 2);
  });
  T('Tid (s)', x1, 902, { f: '400 26px Roboto', c: C.mid, al: 'right' });
  colorbar(1747, 376, 773, 1790, [10, 0, -10, -20], 350);
  drawCaption('DSA samler endringene i EEGs frekvensinnhold, så de blir lette å se.', 'Fargeskala: −20…10 dB* · Referanse: 1 µV²/Hz · Syntetisk EEG');
}

// ---------- hovedløkke ----------
function drawFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  drawBackground();
  const run = (fn, a, b, fi = 0.35, fo = 0.3) => {
    if (t < a - 0.01 || t >= b + 0.01) return;
    ctx.save(); ctx.globalAlpha = sceneAlpha(t, a, b, a === 0 ? 0.01 : fi, b >= 90 ? 0.01 : fo); fn(t); ctx.restore();
  };
  run(scene1, 0, 10); run(scene2, 10, 40); run(scene3, 40, 50);
  if (t >= 50 && t < 80.3) { ctx.save(); ctx.globalAlpha = clamp((80.3 - t) / 0.3); surface(t); ctx.restore(); }
  const heads = () => {
    if (t >= 50 && t < 65) {
      const a = sceneAlpha(t, 50, 65, 0.35, 0.01); ctx.save(); ctx.globalAlpha = a;
      drawHeader('Tid gjør spekteret til en 3D-flate', 'Nye EEG-perioder gir nye effektspektre over tid.', 3);
      drawCaption('Frekvens, spektral effekt og tid danner en tredimensjonal flate.', 'Fargeskala: −20…10 dB* · Referanse: 1 µV²/Hz'); ctx.restore();
    } else if (t >= 65 && t < 80) {
      const a = sceneAlpha(t, 65, 80, 0.01, 0.3) * (t < 65.4 ? clamp((t - 65) / 0.4) : 1); ctx.save(); ctx.globalAlpha = a;
      drawHeader('Sett ovenfra er flaten en DSA', 'Fargen bevarer informasjonen om spektral effekt også i et todimensjonalt bilde.', 4);
      drawCaption('Tid ligger på den horisontale aksen, frekvens på den vertikale og spektral effekt vises som farge.', 'Fargeskala: −20…10 dB* · Referanse: 1 µV²/Hz'); ctx.restore();
    }
  };
  heads();
  run(scene6, 80, 90);
  drawFooter(t);
}
window.drawFrame = drawFrame;
Promise.all(['400 20px Roboto', '500 20px Roboto', '700 20px Roboto', '600 40px SerifD'].map(f => document.fonts.load(f))).then(() => { window.ready = true; });

// Avspilling i nettleser (hoppes over når siden åpnes med ?render, brukt av scripts/)
if (!/render/.test(location.search)) {
  window.addEventListener('load', () => {
    const go = () => { const t0 = performance.now(); (function tick(now) { drawFrame(((now - t0) / 1000) % 90); requestAnimationFrame(tick); })(t0); };
    const w = setInterval(() => { if (window.ready) { clearInterval(w); go(); } }, 50);
  });
}
