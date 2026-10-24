/*
 * Quantum Paws runtime: the animation engine, sound synth and Twitch connectors.
 *
 * Everything lives inside ONE self-contained function so the editor can both
 * call it directly and inline its source (OverlayRuntime.toString()) into the
 * exported overlay.html. Do not reference anything outside this function.
 */
function OverlayRuntime() {
  'use strict';

  // ---------------------------------------------------------------- easing
  const EASES = {
    linear: (p) => p,
    hold: () => 0,
    easeIn: (p) => p * p * p,
    easeOut: (p) => 1 - Math.pow(1 - p, 3),
    easeInOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    expoOut: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    expoIn: (p) => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
    backOut: (p) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    backIn: (p) => { const c = 1.70158; return (c + 1) * p * p * p - c * p * p; },
    elastic: (p) => (p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
    bounce: (p) => {
      const n = 7.5625, d = 2.75;
      if (p < 1 / d) return n * p * p;
      if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
      if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
      return n * (p -= 2.625 / d) * p + 0.984375;
    },
  };
  const EASE_LABELS = {
    linear: 'Linear', hold: 'Hold', easeIn: 'Ease In', easeOut: 'Ease Out', easeInOut: 'Ease In/Out',
    expoIn: 'Expo In', expoOut: 'Expo Out', backIn: 'Back In (anticipate)', backOut: 'Back Out (overshoot)',
    elastic: 'Elastic', bounce: 'Bounce',
  };

  // ---------------------------------------------------------------- schema
  const FONTS = ['Orbitron', 'Rajdhani', 'Share Tech Mono', 'Exo 2', 'Audiowide', 'Bebas Neue', 'Russo One', 'Arial'];
  const BLENDS = [['source-over', 'Normal'], ['screen', 'Screen'], ['lighter', 'Add (glow)'], ['multiply', 'Multiply'], ['overlay', 'Overlay']];

  const COMMON = [
    { key: 'x', label: 'Position X', type: 'num', anim: true, def: 960, step: 1 },
    { key: 'y', label: 'Position Y', type: 'num', anim: true, def: 540, step: 1 },
    { key: 'scale', label: 'Scale', type: 'num', anim: true, def: 1, step: 0.01 },
    { key: 'rotation', label: 'Rotation', type: 'num', anim: true, def: 0, step: 1 },
    { key: 'opacity', label: 'Opacity', type: 'num', anim: true, def: 1, step: 0.01, min: 0, max: 1 },
    { key: 'blur', label: 'Blur', type: 'num', anim: true, def: 0, step: 0.5, min: 0 },
    { key: 'glow', label: 'Glow', type: 'num', anim: true, def: 0, step: 1, min: 0 },
    { key: 'glowColor', label: 'Glow color', type: 'color', def: '#3fd8ff' },
    { key: 'blend', label: 'Blend mode', type: 'select', def: 'source-over', options: BLENDS },
  ];

  const SCHEMA = {
    image: [
      { key: 'asset', label: 'Image', type: 'asset', def: 'dog1' },
      { key: 'width', label: 'Width', type: 'num', anim: true, def: 240, step: 1, min: 0 },
      { key: 'height', label: 'Height', type: 'num', anim: true, def: 240, step: 1, min: 0 },
      { key: 'mask', label: 'Mask', type: 'select', def: 'circle', options: [['none', 'None (no frame)'], ['circle', 'Circle'], ['rounded', 'Rounded'], ['hex', 'Hexagon']] },
      { key: 'fit', label: 'Fit', type: 'select', def: 'cover', options: [['cover', 'Fill (crop)'], ['contain', 'Fit (whole image)']] },
      { key: 'border', label: 'Border', type: 'num', anim: true, def: 0, step: 1, min: 0 },
      { key: 'borderColor', label: 'Border color', type: 'color', def: '#3fd8ff' },
    ],
    text: [
      { key: 'text', label: 'Text', type: 'textarea', def: '{user}' },
      { key: 'font', label: 'Font', type: 'select', def: 'Orbitron', options: FONTS.map((f) => [f, f]) },
      { key: 'size', label: 'Size', type: 'num', anim: true, def: 64, step: 1, min: 1 },
      { key: 'weight', label: 'Weight', type: 'select', def: '700', options: [['400', 'Regular'], ['600', 'Semi-bold'], ['700', 'Bold'], ['900', 'Black']] },
      { key: 'italic', label: 'Italic', type: 'bool', def: false },
      { key: 'upper', label: 'UPPERCASE', type: 'bool', def: false },
      { key: 'color', label: 'Color', type: 'color', def: '#ffffff' },
      { key: 'align', label: 'Align', type: 'select', def: 'center', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] },
      { key: 'tracking', label: 'Letter spacing', type: 'num', anim: true, def: 0, step: 0.5 },
      { key: 'reveal', label: 'Typewriter', type: 'num', anim: true, def: 1, step: 0.01, min: 0, max: 1 },
      { key: 'wrap', label: 'Wrap width (0 = off)', type: 'num', def: 0, step: 10, min: 0 },
      { key: 'fit', label: 'Shrink to fit width (0 = off)', type: 'num', def: 0, step: 10, min: 0 },
      { key: 'outline', label: 'Outline', type: 'num', anim: true, def: 0, step: 0.5, min: 0 },
      { key: 'outlineColor', label: 'Outline color', type: 'color', def: '#000000' },
    ],
    shape: [
      { key: 'kind', label: 'Shape', type: 'select', def: 'panel', options: [['panel', 'HUD panel'], ['rect', 'Rectangle'], ['circle', 'Circle / ellipse'], ['hex', 'Hexagon'], ['brackets', 'Corner brackets'], ['ring', 'Dashed ring'], ['line', 'Line'], ['sparkle', 'Sparkle (wink glint)']] },
      { key: 'width', label: 'Width', type: 'num', anim: true, def: 400, step: 1, min: 0 },
      { key: 'height', label: 'Height', type: 'num', anim: true, def: 160, step: 1, min: 0 },
      { key: 'fill', label: 'Fill color', type: 'color', def: '#06121f' },
      { key: 'fillAlpha', label: 'Fill opacity', type: 'num', anim: true, def: 0.8, step: 0.01, min: 0, max: 1 },
      { key: 'stroke', label: 'Stroke color', type: 'color', def: '#3fd8ff' },
      { key: 'strokeWidth', label: 'Stroke width', type: 'num', anim: true, def: 2, step: 0.5, min: 0 },
      { key: 'reveal', label: 'Wipe reveal', type: 'num', anim: true, def: 1, step: 0.01, min: 0, max: 1 },
      { key: 'spin', label: 'Spin (deg/sec)', type: 'num', def: 0, step: 1 },
      { key: 'dash', label: 'Dash length', type: 'num', def: 14, step: 1, min: 1 },
    ],
    emote: [
      { key: 'expression', label: 'Expression', type: 'select', def: 'wink', options: [['wink', 'Wink'], ['pog', 'Pog (jaw drop)'], ['happy', 'Happy (tongue wag)'], ['love', 'Heart eyes'], ['cool', 'Cool visor']] },
      { key: 'width', label: 'Width', type: 'num', anim: true, def: 170, step: 1, min: 0 },
      { key: 'height', label: 'Height', type: 'num', anim: true, def: 170, step: 1, min: 0 },
      { key: 'fur', label: 'Fur color', type: 'color', def: '#d9a066' },
      { key: 'ear', label: 'Ear color', type: 'color', def: '#8a5a2b' },
      { key: 'muzzle', label: 'Muzzle color', type: 'color', def: '#f6e3c4' },
      { key: 'helmet', label: 'Space helmet', type: 'bool', def: false },
      { key: 'accent', label: 'Helmet trim', type: 'color', def: '#3fd8ff' },
      { key: 'speed', label: 'Animation speed', type: 'num', def: 1, step: 0.1, min: 0 },
    ],
    particles: [
      { key: 'kind', label: 'Effect', type: 'select', def: 'warp', options: [['warp', 'Quantum warp streaks'], ['stars', 'Starfield'], ['sparks', 'Spark burst'], ['paws', 'Floating paw prints'], ['embers', 'Rising embers']] },
      { key: 'intensity', label: 'Intensity', type: 'num', anim: true, def: 1, step: 0.01, min: 0, max: 1 },
      { key: 'count', label: 'Count', type: 'num', def: 80, step: 1, min: 1, max: 600 },
      { key: 'color', label: 'Color', type: 'color', def: '#bfefff' },
      { key: 'size', label: 'Size', type: 'num', anim: true, def: 3, step: 0.5, min: 0.5 },
      { key: 'speed', label: 'Speed', type: 'num', anim: true, def: 1, step: 0.05, min: 0 },
      { key: 'width', label: 'Area width', type: 'num', anim: true, def: 1920, step: 10, min: 1 },
      { key: 'height', label: 'Area height', type: 'num', anim: true, def: 1080, step: 10, min: 1 },
      { key: 'seed', label: 'Random seed', type: 'num', def: 1, step: 1 },
    ],
  };
  for (const t in SCHEMA) SCHEMA[t] = COMMON.concat(SCHEMA[t]);

  const ALERT_TYPES = [
    { id: 'follow', label: 'Follow', vars: ['user'] },
    { id: 'sub', label: 'Sub', vars: ['user', 'tier'] },
    { id: 'resub', label: 'Resub', vars: ['user', 'months', 'tier', 'message'] },
    { id: 'giftsub', label: 'Gift Sub', vars: ['user', 'recipient', 'tier'] },
    { id: 'giftbomb', label: 'Gift Bomb', vars: ['user', 'count', 'tier'] },
    { id: 'cheer', label: 'Cheer', vars: ['user', 'bits', 'message'] },
    { id: 'raid', label: 'Raid', vars: ['user', 'viewers'] },
  ];
  const SAMPLE_VARS = {
    follow: { user: 'StarRunner_42' },
    sub: { user: 'OrgCommander', tier: 'Tier 1' },
    resub: { user: 'Vanduul_Hunter', months: '14', tier: 'Tier 1', message: 'o7 Best crew in the verse, give the pups a treat!' },
    giftsub: { user: 'Hull_C_Hauler', recipient: 'NewPilot99', tier: 'Tier 1' },
    giftbomb: { user: 'Idris_Captain', count: '10', tier: 'Tier 1' },
    cheer: { user: 'aUEC_Baron', bits: '500', message: 'Fuel for the Carrack! Good boys!' },
    raid: { user: 'PyroExplorer', viewers: '87' },
  };

  let _uid = 0;
  function uid(p) { return (p || 'l') + Date.now().toString(36) + (++_uid).toString(36) + Math.random().toString(36).slice(2, 6); }

  function makeLayer(type, name, props, extra) {
    const p = {};
    for (const f of SCHEMA[type]) p[f.key] = f.def;
    Object.assign(p, props || {});
    return Object.assign({ id: uid('l'), name: name || type, type, inPoint: 0, outPoint: 6, hidden: false, locked: false, props: p, keys: {} }, extra || {});
  }

  // ---------------------------------------------------------------- evaluation
  function fieldDef(type, key) { return SCHEMA[type].find((f) => f.key === key); }

  function evalProp(layer, key, t) {
    const ks = layer.keys && layer.keys[key];
    if (!ks || !ks.length) {
      const v = layer.props[key];
      return v === undefined ? (fieldDef(layer.type, key) || {}).def : v;
    }
    if (t <= ks[0].t) return ks[0].v;
    const last = ks[ks.length - 1];
    if (t >= last.t) return last.v;
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i], b = ks[i + 1];
      if (t >= a.t && t < b.t) {
        const span = b.t - a.t;
        const p = span > 0 ? (t - a.t) / span : 1;
        const e = (EASES[a.e] || EASES.linear)(p);
        return a.v + (b.v - a.v) * e;
      }
    }
    return last.v;
  }

  function evalLayer(layer, t) {
    const v = {};
    for (const f of SCHEMA[layer.type]) v[f.key] = f.anim ? evalProp(layer, f.key, t) : (layer.props[f.key] === undefined ? f.def : layer.props[f.key]);
    return v;
  }

  function substitute(str, vars) {
    // {bits} inserts a value; {bits:bit|bits} picks a word by whether the value is 1.
    return String(str == null ? '' : str).replace(/\{(\w+)(?::([^|}]*)\|([^}]*))?\}/g, (m, k, one, many) => {
      const v = vars && vars[k] != null ? vars[k] : null;
      if (one !== undefined) return Number(v) === 1 ? one : many;
      return v != null ? v : m;
    });
  }

  function hexToRgba(hex, a) {
    let h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- drawing helpers
  function pawPath(ctx, r) {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.32, r * 0.5, r * 0.42, 0, 0, Math.PI * 2);
    const toes = [[-0.62, -0.22, 0.2], [-0.24, -0.6, 0.22], [0.24, -0.6, 0.22], [0.62, -0.22, 0.2]];
    for (const [x, y, s] of toes) {
      ctx.moveTo(x * r + s * r, y * r);
      ctx.ellipse(x * r, y * r, s * r, s * r * 1.2, 0, 0, Math.PI * 2);
    }
  }

  function polyPath(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  }

  function hexPts(w, h) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      pts.push([Math.cos(a) * w / 2, Math.sin(a) * h / 2]);
    }
    return pts;
  }

  function roundRectPath(ctx, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    const x = -w / 2, y = -h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function maskPath(ctx, mask, w, h) {
    if (mask === 'circle') { ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0, w / 2), Math.max(0, h / 2), 0, 0, Math.PI * 2); }
    else if (mask === 'rounded') roundRectPath(ctx, w, h, Math.min(w, h) * 0.18);
    else if (mask === 'hex') polyPath(ctx, hexPts(w, h));
    else { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); }
  }

  // Four-point twinkle star.
  function sparklePts(w, h) {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? 0.14 : 0.5;
      pts.push([Math.cos(a) * w * r, Math.sin(a) * h * r]);
    }
    return pts;
  }

  function panelPts(w, h) {
    const c = Math.max(0, Math.min(22, h / 3, w / 3));
    return [[-w / 2 + c, -h / 2], [w / 2, -h / 2], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2 + c]];
  }

  // ---------------------------------------------------------------- layer renderers
  function animFrame(img, lt) {
    const a = img && img._anim;
    if (!a) return null;
    let ms = (lt * 1000) % a.total;
    for (let i = 0; i < a.frames.length; i++) { if (ms < a.durs[i]) return a.frames[i]; ms -= a.durs[i]; }
    return a.frames[a.frames.length - 1];
  }

  function drawImage(ctx, v, env, layer, t) {
    const w = Math.max(0, v.width), h = Math.max(0, v.height);
    if (w < 1 || h < 1) return;
    const base = env.images && env.images[v.asset];
    const ready = base && base.complete && base.naturalWidth > 0;
    const img = ready ? animFrame(base, Math.max(0, t - layer.inPoint)) || base : null;
    // Cut-out photos (transparent background) float without a frame, and the glow hugs the dog's outline.
    const cutout = ready && base._cutout;
    const alpha = ready && base._alpha;
    const mask = cutout ? 'none' : v.mask;
    if (v.glow > 0 && !cutout) {
      maskPath(ctx, mask, w, h);
      if (alpha) {
        // A filled halo would show through the see-through parts, so glow along the frame's edge only.
        ctx.strokeStyle = v.glowColor;
        ctx.lineWidth = Math.max(2, v.border || 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = v.glowColor;
        ctx.fill();
      }
    }
    if (!cutout) ctx.shadowBlur = 0;
    ctx.save();
    if (!cutout) {
      maskPath(ctx, mask, w, h);
      ctx.clip();
    }
    if (ready) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const contain = cutout || v.fit === 'contain';
      const s = contain ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
      if (contain && !alpha) { ctx.fillStyle = '#06121f'; ctx.fillRect(-w / 2, -h / 2, w, h); }
      ctx.drawImage(img, -iw * s / 2, -ih * s / 2, iw * s, ih * s);
    } else {
      // Placeholder until a photo is uploaded.
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2);
      g.addColorStop(0, '#12314a');
      g.addColorStop(1, '#050d17');
      ctx.fillStyle = g;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.save();
      ctx.translate(0, -h * 0.06);
      pawPath(ctx, Math.min(w, h) * 0.24);
      ctx.fillStyle = v.borderColor || '#3fd8ff';
      ctx.globalAlpha *= 0.85;
      ctx.fill();
      ctx.restore();
      const name = (env.assetNames && env.assetNames[v.asset]) || 'No image';
      ctx.fillStyle = '#cfe9ff';
      ctx.font = '600 ' + Math.max(10, Math.round(Math.min(w, h) * 0.1)) + 'px "Rajdhani", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.toUpperCase(), 0, h * 0.3);
    }
    ctx.restore();
    if (v.border > 0 && !cutout) {
      ctx.shadowBlur = 0;
      maskPath(ctx, mask, w, h);
      ctx.lineWidth = v.border;
      ctx.strokeStyle = v.borderColor;
      ctx.stroke();
    }
  }

  function textLines(ctx, s, wrap) {
    const out = [];
    for (const para of s.split('\n')) {
      if (!wrap || wrap <= 0) { out.push(para); continue; }
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (line && ctx.measureText(test).width > wrap) { out.push(line); line = w; }
        else line = test;
      }
      out.push(line);
    }
    return out;
  }

  function setupText(ctx, v) {
    ctx.font = (v.italic ? 'italic ' : '') + v.weight + ' ' + Math.max(1, v.size) + 'px "' + v.font + '", sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (v.tracking || 0) + 'px';
    ctx.textAlign = v.align;
    ctx.textBaseline = 'middle';
  }

  function textString(v, vars) {
    let s = substitute(v.text, vars);
    if (v.upper) s = s.toUpperCase();
    return s;
  }

  // Long usernames shrink instead of spilling out of the panel.
  function fitScale(ctx, v, lines) {
    if (!v.fit || v.fit <= 0) return 1;
    let w = 0;
    for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    return w > v.fit ? v.fit / w : 1;
  }

  function drawText(ctx, v, env) {
    setupText(ctx, v);
    const lines = textLines(ctx, textString(v, env.vars), v.wrap);
    const k = fitScale(ctx, v, lines);
    if (k < 1) ctx.scale(k, k);
    const total = lines.reduce((n, l) => n + l.length, 0);
    let budget = v.reveal >= 1 ? Infinity : Math.floor(total * Math.max(0, v.reveal));
    const lh = v.size * 1.15;
    let y = -(lines.length - 1) * lh / 2;
    ctx.fillStyle = v.color;
    ctx.lineJoin = 'round';
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let cursor = false;
      if (budget !== Infinity) {
        if (budget <= 0) break;
        if (line.length > budget) { line = line.slice(0, budget); cursor = true; }
        budget -= line.length;
        if (budget === 0 && v.reveal < 1) cursor = true;
      }
      if (cursor) line += '▌';
      if (v.outline > 0) {
        ctx.lineWidth = v.outline * 2;
        ctx.strokeStyle = v.outlineColor;
        ctx.strokeText(line, 0, y);
      }
      ctx.fillText(line, 0, y);
      y += lh;
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function drawShape(ctx, v, t, layer) {
    const w = Math.max(0, v.width), h = Math.max(0, v.height);
    const sw = v.strokeWidth;
    if (v.spin) ctx.rotate((v.spin * (t - layer.inPoint)) * Math.PI / 180);
    const kind = v.kind;
    const reveal = Math.max(0, Math.min(1, v.reveal));
    if (reveal <= 0) return;
    if (reveal < 1 && kind !== 'ring' && kind !== 'circle') {
      ctx.beginPath();
      ctx.rect(-w / 2 - sw - 2, -h / 2 - sw - 2, (w + 2 * sw + 4) * reveal, h + 2 * sw + 4);
      ctx.clip();
    }
    const fillIt = v.fillAlpha > 0 && kind !== 'brackets' && kind !== 'line' && kind !== 'ring';
    ctx.lineWidth = sw;
    ctx.strokeStyle = v.stroke;
    ctx.fillStyle = hexToRgba(v.fill, v.fillAlpha);
    ctx.lineJoin = 'miter';
    const endA = -Math.PI / 2 + Math.PI * 2 * reveal;

    if (kind === 'rect') { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); }
    else if (kind === 'panel') polyPath(ctx, panelPts(w, h));
    else if (kind === 'hex') polyPath(ctx, hexPts(w, h));
    else if (kind === 'sparkle') polyPath(ctx, sparklePts(w, h));
    else if (kind === 'circle') {
      ctx.beginPath();
      if (reveal < 1) { ctx.moveTo(0, 0); ctx.ellipse(0, 0, w / 2, h / 2, 0, -Math.PI / 2, endA); ctx.closePath(); }
      else ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    }

    if (kind === 'rect' || kind === 'panel' || kind === 'hex' || kind === 'circle' || kind === 'sparkle') {
      if (fillIt) ctx.fill();
      if (sw > 0) {
        if (fillIt) ctx.shadowBlur = 0;
        if (kind === 'circle' && reveal < 1) { ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, -Math.PI / 2, endA); }
        ctx.stroke();
      }
      if (kind === 'panel' && sw > 0 && w > 60) {
        // HUD accents: a solid tab on the top edge and a tick on the bottom right.
        const c = Math.max(0, Math.min(22, h / 3, w / 3));
        ctx.lineWidth = sw * 2.5;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + c + 12, -h / 2);
        ctx.lineTo(-w / 2 + c + 12 + Math.min(140, w * 0.22), -h / 2);
        ctx.moveTo(w / 2 - c - 12, h / 2);
        ctx.lineTo(w / 2 - c - 12 - Math.min(60, w * 0.1), h / 2);
        ctx.stroke();
      }
    } else if (kind === 'brackets') {
      const L = Math.min(w, h) * 0.22;
      ctx.lineCap = 'square';
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const cx = sx * w / 2, cy = sy * h / 2;
        ctx.moveTo(cx - sx * L, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy - sy * L);
      }
      if (sw > 0) ctx.stroke();
    } else if (kind === 'ring') {
      const r = Math.max(0, w / 2);
      ctx.setLineDash([v.dash, v.dash * 0.6]);
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, endA);
      if (sw > 0) ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha *= 0.5;
      ctx.lineWidth = Math.max(1, sw / 2);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0, r - sw * 3), -Math.PI / 2, endA);
      ctx.stroke();
      ctx.globalAlpha *= 2;
      ctx.lineWidth = sw * 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        ctx.moveTo(Math.cos(a) * (r + sw * 2), Math.sin(a) * (r + sw * 2));
        ctx.lineTo(Math.cos(a) * (r + sw * 6), Math.sin(a) * (r + sw * 6));
      }
      ctx.stroke();
    } else if (kind === 'line') {
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(w / 2, 0);
      if (sw > 0) ctx.stroke();
    }
  }

  function drawParticles(ctx, v, t, layer) {
    const lt = Math.max(0, t - layer.inPoint);
    const I = Math.max(0, Math.min(1, v.intensity));
    if (I <= 0) return;
    const w = v.width, h = v.height, n = Math.max(1, Math.min(600, v.count | 0));
    const base = ctx.globalAlpha;
    ctx.shadowBlur = 0;
    ctx.fillStyle = v.color;
    ctx.strokeStyle = v.color;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const r = mulberry((v.seed | 0) * 7919 + i * 104729);
      const r1 = r(), r2 = r(), r3 = r(), r4 = r(), r5 = r();
      if (v.kind === 'warp') {
        const ang = r1 * Math.PI * 2, maxR = Math.hypot(w, h) / 2;
        const f = (lt * v.speed * (0.35 + r2 * 0.65) * 0.9 + r3) % 1;
        const d = f * f * maxR, len = 8 + f * f * maxR * 0.3 * Math.max(0.3, v.speed);
        const c = Math.cos(ang), s = Math.sin(ang);
        ctx.globalAlpha = base * I * Math.min(1, f * 1.6);
        ctx.lineWidth = v.size * (0.3 + f);
        ctx.beginPath();
        ctx.moveTo(c * d, s * d * (h / w + 0.4));
        ctx.lineTo(c * (d + len), s * (d + len) * (h / w + 0.4));
        ctx.stroke();
      } else if (v.kind === 'stars') {
        let x = (r1 - 0.5) * w - lt * v.speed * 30 * (r3 + 0.2);
        x = ((x + w / 2) % w + w) % w - w / 2;
        const y = (r2 - 0.5) * h;
        ctx.globalAlpha = base * I * (0.35 + 0.65 * Math.abs(Math.sin(lt * (1 + r4 * 3) + r5 * 6.28)));
        ctx.beginPath();
        ctx.arc(x, y, v.size * (0.3 + r3), 0, Math.PI * 2);
        ctx.fill();
      } else if (v.kind === 'sparks') {
        const life = 0.5 + r3 * 1.3;
        if (lt > life) continue;
        const ang = r1 * Math.PI * 2, vel = (150 + r2 * 650) * v.speed;
        const k = lt / life;
        const x = Math.cos(ang) * vel * lt * (1 - k * 0.4), y = Math.sin(ang) * vel * lt * (1 - k * 0.4) + 260 * lt * lt;
        ctx.globalAlpha = base * I * (1 - k);
        ctx.lineWidth = v.size * (1 - k * 0.5);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(ang) * 14 * v.speed, y - Math.sin(ang) * 14 * v.speed);
        ctx.stroke();
      } else if (v.kind === 'paws' || v.kind === 'embers') {
        const period = (3 + r2 * 3) / Math.max(0.05, v.speed);
        const f = (lt / period + r3) % 1;
        const x = (r1 - 0.5) * w + Math.sin(lt * (0.8 + r4) + r5 * 6) * (v.kind === 'embers' ? 18 : 10);
        const y = h / 2 - f * h;
        ctx.globalAlpha = base * I * Math.sin(f * Math.PI) * (0.5 + r4 * 0.5);
        if (v.kind === 'paws') {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((r5 - 0.5) * 0.9);
          pawPath(ctx, v.size * 4 * (0.6 + r4 * 0.7));
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, v.size * (0.4 + r4 * 0.8), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = base;
  }

  // ---------------------------------------------------------------- cartoon dog emote
  // A hand-drawn dog face that animates by itself: winks, jaw-drop "pog", tongue wag, heart eyes, visor.
  function heartPath(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
    ctx.closePath();
  }

  function drawEmote(ctx, v, t, layer) {
    const s = Math.min(v.width, v.height);
    if (s < 4) return;
    const lt = Math.max(0, t - layer.inPoint) * (v.speed == null ? 1 : v.speed);
    const ex = v.expression;
    const dark = '#2b1a12';
    const ell = (x, y, rx, ry, rot) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); };
    const clamp01 = (x) => Math.max(0, Math.min(1, x));

    // Whole-head motion: gentle bob and tilt; pog adds a quick shocked shake.
    let jaw = 0;
    if (ex === 'pog') {
      const p = clamp01((lt - 0.15) / 0.35);
      jaw = EASES.backOut(p) * (1 + 0.05 * Math.sin(lt * 14));
      if (p > 0 && p < 1) ctx.translate(Math.sin(lt * 60) * s * 0.012, 0);
    }
    ctx.translate(0, Math.sin(lt * 4) * s * 0.015);
    ctx.rotate(Math.sin(lt * 2.2) * 0.07);

    if (v.helmet) {
      // Collar of the space suit.
      ctx.fillStyle = '#2a3442';
      ctx.save(); ctx.translate(0, s * 0.42); roundRectPath(ctx, s * 0.78, s * 0.2, s * 0.08); ctx.fill(); ctx.restore();
      ctx.shadowBlur = 0;
      ctx.fillStyle = v.accent;
      ctx.fillRect(-s * 0.36, s * 0.4, s * 0.72, s * 0.03);
    }

    // Head (carries the layer glow), then no more shadows.
    ctx.fillStyle = v.fur;
    ell(0, 0, s * 0.4, s * 0.36);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Floppy ears that flap.
    const flap = Math.sin(lt * 6) * 0.1 + (ex === 'pog' ? -0.35 * jaw : 0);
    ctx.fillStyle = v.ear;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * s * 0.34, -s * 0.2);
      ctx.rotate(side * (0.28 + flap));
      ell(0, s * 0.2, s * 0.12, s * 0.25);
      ctx.fill();
      ctx.restore();
    }

    // Muzzle and blush.
    ctx.fillStyle = v.muzzle;
    ell(0, s * 0.15, s * 0.23, s * 0.17);
    ctx.fill();
    if (ex === 'wink' || ex === 'love' || ex === 'happy') {
      ctx.fillStyle = 'rgba(255,120,150,0.35)';
      ell(-s * 0.25, s * 0.08, s * 0.06, s * 0.035); ctx.fill();
      ell(s * 0.25, s * 0.08, s * 0.06, s * 0.035); ctx.fill();
    }

    // Eyes.
    const eyX = s * 0.15, eyY = -s * 0.06, er = s * 0.052;
    const blinkCycle = lt % 3.2;
    const blink = blinkCycle > 3.0 ? 1 - Math.abs(blinkCycle - 3.1) / 0.1 : 0;
    const dotEye = (x, open) => {
      if (open < 0.25) {
        ctx.strokeStyle = dark; ctx.lineWidth = s * 0.024; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, eyY + er * 0.5, er, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        return;
      }
      ctx.fillStyle = dark;
      ell(x, eyY, er * 0.9, er * 1.1 * open); ctx.fill();
      ctx.fillStyle = '#fff';
      ell(x - er * 0.3, eyY - er * 0.4 * open, er * 0.3, er * 0.3 * open); ctx.fill();
    };
    let wink = 0;
    if (ex === 'wink') {
      const ph = lt % 2.6;
      wink = ph > 0.5 && ph < 1.2 ? Math.sin((ph - 0.5) / 0.7 * Math.PI) : 0;
      dotEye(-eyX, 1 - blink);
      dotEye(eyX, 1 - Math.min(1, wink * 1.6));
    } else if (ex === 'pog') {
      const big = 1 + 0.45 * jaw;
      for (const x of [-eyX, eyX]) {
        ctx.fillStyle = '#fff';
        ell(x, eyY - s * 0.01, er * 1.25 * big, er * 1.35 * big); ctx.fill();
        ctx.strokeStyle = dark; ctx.lineWidth = s * 0.014; ctx.stroke();
        ctx.fillStyle = dark;
        ell(x, eyY, er * 0.45, er * 0.5); ctx.fill();
      }
      // Raised eyebrows.
      ctx.strokeStyle = dark; ctx.lineWidth = s * 0.022; ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * (eyX - er), eyY - er * 2.1 * big);
        ctx.quadraticCurveTo(side * eyX, eyY - er * 2.8 * big, side * (eyX + er), eyY - er * 2.2 * big);
        ctx.stroke();
      }
    } else if (ex === 'happy') {
      ctx.strokeStyle = dark; ctx.lineWidth = s * 0.026; ctx.lineCap = 'round';
      for (const x of [-eyX, eyX]) { ctx.beginPath(); ctx.arc(x, eyY + er * 0.5, er, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    } else if (ex === 'love') {
      const pulse = 1 + 0.18 * Math.max(0, Math.sin(lt * 9));
      ctx.fillStyle = '#ff3d6e';
      for (const x of [-eyX, eyX]) { heartPath(ctx, x, eyY, er * 1.15 * pulse); ctx.fill(); }
    } else if (ex === 'cool') {
      ctx.fillStyle = '#0b1622';
      ctx.save(); ctx.translate(0, eyY); roundRectPath(ctx, s * 0.52, s * 0.13, s * 0.05); ctx.fill();
      ctx.clip();
      const gx = ((lt * 0.6) % 1.6 - 0.3) * s * 0.6 - s * 0.3;
      const g = ctx.createLinearGradient(gx - s * 0.08, 0, gx + s * 0.08, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, v.accent); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.globalAlpha *= 0.8;
      ctx.fillRect(-s * 0.3, -s * 0.1, s * 0.6, s * 0.2);
      ctx.restore();
    }

    // Nose.
    ctx.fillStyle = dark;
    ell(0, s * 0.06, s * 0.055, s * 0.038); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ell(-s * 0.015, s * 0.05, s * 0.016, s * 0.01); ctx.fill();

    // Mouth.
    ctx.strokeStyle = dark; ctx.lineWidth = s * 0.018; ctx.lineCap = 'round';
    if (ex === 'pog') {
      ctx.fillStyle = '#5a0f1a';
      ell(0, s * 0.19 + jaw * s * 0.03, s * 0.06 * (0.6 + 0.5 * jaw), s * 0.03 + s * 0.075 * jaw); ctx.fill();
      ctx.fillStyle = '#ff7a8c';
      ell(0, s * 0.22 + jaw * s * 0.07, s * 0.045 * (0.5 + 0.5 * jaw), s * 0.025 * jaw); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.09); ctx.lineTo(0, s * 0.13);
      ctx.arc(-s * 0.045, s * 0.13, s * 0.045, 0, Math.PI * 0.85);
      ctx.moveTo(0, s * 0.13);
      ctx.arc(s * 0.045, s * 0.13, s * 0.045, Math.PI, Math.PI * 0.15, true);
      ctx.stroke();
      if (ex !== 'cool') {
        const wag = ex === 'happy' ? Math.sin(lt * 10) * 0.3 : Math.sin(lt * 3) * 0.08;
        ctx.save();
        ctx.translate(0, s * 0.16);
        ctx.rotate(wag);
        ctx.fillStyle = '#ff6f8a';
        ctx.translate(0, ex === 'happy' ? s * 0.07 : s * 0.035);
        roundRectPath(ctx, s * 0.075, ex === 'happy' ? s * 0.16 : s * 0.09, s * 0.035);
        ctx.fill();
        ctx.restore();
      }
    }

    // Wink sparkle.
    if (wink > 0.3) {
      ctx.save();
      ctx.translate(eyX + s * 0.13, eyY - s * 0.13);
      ctx.rotate(lt * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = v.accent; ctx.shadowBlur = s * 0.1;
      polyPath(ctx, sparklePts(s * 0.16 * wink, s * 0.16 * wink));
      ctx.fill();
      ctx.restore();
    }

    if (v.helmet) {
      // Glass bubble with a reflection.
      ctx.fillStyle = 'rgba(160,225,255,0.10)';
      ell(0, 0, s * 0.52, s * 0.5); ctx.fill();
      ctx.strokeStyle = 'rgba(200,240,255,0.85)'; ctx.lineWidth = s * 0.022; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = s * 0.03;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.43, Math.PI * 1.08, Math.PI * 1.38); ctx.stroke();
    }
  }

  // Applies a layer's transform/compositing to ctx. Returns evaluated values, or null if invisible.
  function applyLayer(ctx, layer, t) {
    const v = evalLayer(layer, t);
    if (v.opacity <= 0 || Math.abs(v.scale) < 1e-4) return null;
    ctx.globalCompositeOperation = v.blend || 'source-over';
    ctx.globalAlpha *= Math.min(1, v.opacity);
    ctx.translate(v.x, v.y);
    if (v.rotation) ctx.rotate(v.rotation * Math.PI / 180);
    ctx.scale(v.scale, v.scale);
    if (v.blur > 0) ctx.filter = 'blur(' + v.blur + 'px)';
    if (v.glow > 0 && layer.type !== 'particles') { ctx.shadowColor = v.glowColor; ctx.shadowBlur = v.glow; }
    return v;
  }

  function layerActive(layer, t) { return !layer.hidden && t >= layer.inPoint && t < layer.outPoint; }

  function applyAlertTransform(ctx, alert, W, H) {
    const o = alert.offset || { x: 0, y: 0, scale: 1 };
    ctx.translate(W / 2 + (o.x || 0), H / 2 + (o.y || 0));
    ctx.scale(o.scale || 1, o.scale || 1);
    ctx.translate(-W / 2, -H / 2);
  }

  // Layers are stored top-first (like After Effects), so draw them in reverse.
  function render(ctx, alert, t, env) {
    const W = env.width || 1920, H = env.height || 1080;
    ctx.save();
    applyAlertTransform(ctx, alert, W, H);
    for (let i = alert.layers.length - 1; i >= 0; i--) {
      const layer = alert.layers[i];
      if (!layerActive(layer, t)) continue;
      ctx.save();
      const v = applyLayer(ctx, layer, t);
      if (v) {
        if (layer.type === 'image') drawImage(ctx, v, env, layer, t);
        else if (layer.type === 'emote') drawEmote(ctx, v, t, layer);
        else if (layer.type === 'text') drawText(ctx, v, env);
        else if (layer.type === 'shape') drawShape(ctx, v, t, layer);
        else if (layer.type === 'particles') drawParticles(ctx, v, t, layer);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // Local-space bounding box {x, y, w, h} (centered at the layer anchor).
  function layerBounds(ctx, layer, t, vars) {
    const v = evalLayer(layer, t);
    if (layer.type === 'text') {
      ctx.save();
      setupText(ctx, v);
      const lines = textLines(ctx, textString(v, vars), v.wrap);
      let w = 0;
      for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
      const k = fitScale(ctx, v, lines);
      ctx.restore();
      w *= k;
      const h = lines.length * v.size * 1.15 * k;
      const x = v.align === 'left' ? 0 : v.align === 'right' ? -w : -w / 2;
      return { v, x, y: -h / 2, w, h };
    }
    const w = v.width || 0, h = layer.type === 'shape' && v.kind === 'line' ? Math.max(12, v.strokeWidth * 2) : v.height || 0;
    if (layer.type === 'shape' && v.kind === 'ring') return { v, x: -w / 2, y: -w / 2, w, h: w };
    return { v, x: -w / 2, y: -h / 2, w, h };
  }

  // ---------------------------------------------------------------- sound
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function noiseBuffer(ac, secs) {
    const b = ac.createBuffer(1, Math.floor(ac.sampleRate * secs), ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function env(ac, g, at, peak, a, d) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + a);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  }

  function tone(ac, out, type, f0, f1, at, dur, peak) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    env(ac, g, at, peak, 0.01, dur);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  const SYNTHS = {
    none: null,
    quantum(ac, out, at) {
      // Spool-up whoosh, then the quantum exit boom.
      const n = ac.createBufferSource();
      n.buffer = noiseBuffer(ac, 1.3);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 5;
      bp.frequency.setValueAtTime(180, at);
      bp.frequency.exponentialRampToValueAtTime(4200, at + 1.0);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.6, at + 0.95);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.25);
      n.connect(bp).connect(g).connect(out);
      n.start(at); n.stop(at + 1.3);
      tone(ac, out, 'sine', 140, 38, at + 1.0, 0.9, 0.9);
      tone(ac, out, 'triangle', 1400, 2400, at + 1.0, 0.35, 0.18);
    },
    chirp(ac, out, at) {
      [880, 1320, 1760].forEach((f, i) => tone(ac, out, 'sine', f, f * 1.02, at + 0.9 + i * 0.11, 0.16, 0.35));
    },
    hail(ac, out, at) {
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      lp.connect(out);
      for (let i = 0; i < 6; i++) tone(ac, lp, 'square', i % 2 ? 990 : 660, i % 2 ? 990 : 660, at + 0.9 + i * 0.085, 0.07, 0.18);
    },
    alarm(ac, out, at) {
      for (let i = 0; i < 3; i++) tone(ac, out, 'sawtooth', 420, 880, at + 0.6 + i * 0.32, 0.26, 0.2);
      tone(ac, out, 'sine', 120, 35, at + 1.0, 1.0, 0.9);
    },
  };
  const SYNTH_LABELS = { none: 'None', quantum: 'Quantum jump (whoosh + boom)', chirp: 'Comm chirp', hail: 'Incoming hail', alarm: 'Red alert klaxon' };

  // Plays an alert's sound; returns a stop() function.
  function playSound(sound, assets, master, offset) {
    sound = sound || {};
    offset = offset || 0;
    const vol = Math.max(0, (sound.volume == null ? 1 : sound.volume) * (master == null ? 1 : master));
    const stops = [];
    const ac = getAudio();
    const synth = SYNTHS[sound.synth];
    if (ac && synth && vol > 0 && offset < 0.5) {
      const g = ac.createGain();
      g.gain.value = vol;
      g.connect(ac.destination);
      synth(ac, g, ac.currentTime + 0.02);
      stops.push(() => { try { g.disconnect(); } catch (e) { /* already gone */ } });
    }
    const a = sound.asset && assets && assets[sound.asset];
    if (a && a.data && vol > 0) {
      const el = new Audio(a.data);
      el.volume = Math.min(1, vol);
      const delay = Math.max(0, (sound.delay || 0) - offset);
      const tm = setTimeout(() => { el.play().catch(() => {}); }, delay * 1000);
      stops.push(() => { clearTimeout(tm); el.pause(); });
    }
    return () => stops.forEach((s) => s());
  }

  // ---------------------------------------------------------------- Twitch chat (subs, gifts, cheers, raids)
  function tierName(plan) {
    plan = String(plan == null ? '' : plan).toLowerCase();
    if (plan.includes('prime')) return 'Prime';
    if (plan === '2000' || plan === '2' || plan === 'tier 2' || plan === 'tier2') return 'Tier 2';
    if (plan === '3000' || plan === '3' || plan === 'tier 3' || plan === 'tier3') return 'Tier 3';
    return 'Tier 1';
  }

  function parseIrc(line) {
    const msg = { tags: {}, prefix: '', command: '', params: [], trailing: '' };
    let rest = line;
    if (rest[0] === '@') {
      const i = rest.indexOf(' ');
      for (const kv of rest.slice(1, i).split(';')) {
        const j = kv.indexOf('=');
        const k = j < 0 ? kv : kv.slice(0, j);
        const val = j < 0 ? '' : kv.slice(j + 1);
        msg.tags[k] = val.replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\').replace(/\\r/g, '').replace(/\\n/g, '');
      }
      rest = rest.slice(i + 1);
    }
    if (rest[0] === ':') {
      const i = rest.indexOf(' ');
      msg.prefix = rest.slice(1, i);
      rest = rest.slice(i + 1);
    }
    const ti = rest.indexOf(' :');
    if (ti >= 0) { msg.trailing = rest.slice(ti + 2); rest = rest.slice(0, ti); }
    const parts = rest.split(' ');
    msg.command = parts[0];
    msg.params = parts.slice(1);
    return msg;
  }

  function TwitchChat(channel, onEvent, opts) {
    opts = opts || {};
    channel = String(channel).trim().replace(/^#/, '').toLowerCase();
    const giftSuppress = {};
    let ws = null, backoff = 1000;
    const log = opts.log || function () {};

    function connect() {
      ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send('PASS SCHMOOPIIE');
        ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 80000));
        ws.send('JOIN #' + channel);
      };
      ws.onmessage = (e) => String(e.data).split('\r\n').forEach((l) => l && handle(parseIrc(l)));
      ws.onclose = () => {
        log('Chat disconnected, retrying...', true);
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30000);
      };
    }

    function handle(m) {
      const tg = m.tags;
      if (m.command === 'PING') { ws.send('PONG :' + m.trailing); return; }
      if (m.command === 'RECONNECT') { ws.close(); return; }
      if (m.command === 'ROOMSTATE' || m.command === 'JOIN') { backoff = 1000; }
      if (m.command === 'ROOMSTATE') log('Listening to #' + channel + ' chat for subs, gifts, cheers & raids');
      const name = tg['display-name'] || tg.login || 'Someone';
      if (m.command === 'USERNOTICE') {
        const id = tg['msg-id'];
        const anon = tg.login === 'ananonymousgifter';
        const giver = anon ? 'An anonymous pilot' : name;
        if (id === 'sub') onEvent({ type: 'sub', user: name, tier: tierName(tg['msg-param-sub-plan']) });
        else if (id === 'resub') onEvent({ type: 'resub', user: name, months: tg['msg-param-cumulative-months'] || '1', tier: tierName(tg['msg-param-sub-plan']), message: m.trailing || '' });
        else if (id === 'submysterygift') {
          const count = parseInt(tg['msg-param-mass-gift-count'] || '1', 10);
          giftSuppress[tg.login] = (giftSuppress[tg.login] || 0) + count;
          onEvent({ type: 'giftbomb', user: giver, count: String(count), tier: tierName(tg['msg-param-sub-plan']) });
        } else if (id === 'subgift') {
          if (giftSuppress[tg.login] > 0) { giftSuppress[tg.login]--; return; }
          onEvent({ type: 'giftsub', user: giver, recipient: tg['msg-param-recipient-display-name'] || 'someone', tier: tierName(tg['msg-param-sub-plan']) });
        } else if (id === 'raid') onEvent({ type: 'raid', user: tg['msg-param-displayName'] || name, viewers: tg['msg-param-viewerCount'] || '0' });
      } else if (m.command === 'PRIVMSG') {
        if (tg.bits) {
          onEvent({ type: 'cheer', user: name, login: tg.login, bits: String(parseInt(tg.bits, 10) || 0), message: m.trailing.replace(/\b[A-Za-z]+\d+\b/g, '').replace(/\s+/g, ' ').trim() });
          return;
        }
        const badges = tg.badges || '';
        if (opts.chatTest && /^!testalert\b/i.test(m.trailing) && (/broadcaster\//.test(badges) || /moderator\//.test(badges))) {
          const arg = (m.trailing.split(/\s+/)[1] || 'follow').toLowerCase();
          if (opts.onTest) opts.onTest(arg);
        }
      }
    }

    connect();
    return { close() { if (ws) { ws.onclose = null; ws.close(); } } };
  }

  // ---------------------------------------------------------------- Twitch EventSub (follows)
  function TwitchFollows(token, onEvent, log) {
    token = String(token).trim().replace(/^oauth:/i, '');
    let clientId = '', userId = '', watchdog = null;
    const seen = new Set();

    function connect(url, viaReconnect) {
      const ws = new WebSocket(url || 'wss://eventsub.wss.twitch.tv/ws');
      let keepalive = 30;
      const bump = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => ws.close(), (keepalive + 10) * 1000);
      };
      ws.onmessage = async (e) => {
        bump();
        const msg = JSON.parse(e.data);
        const type = msg.metadata && msg.metadata.message_type;
        if (type === 'session_welcome') {
          keepalive = msg.payload.session.keepalive_timeout_seconds || 30;
          bump();
          if (viaReconnect) return;
          const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token, 'Client-Id': clientId, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'channel.follow', version: '2',
              condition: { broadcaster_user_id: userId, moderator_user_id: userId },
              transport: { method: 'websocket', session_id: msg.payload.session.id },
            }),
          });
          if (res.ok) log('Follow alerts connected');
          else log('Follow alerts failed: ' + (await res.text()), true);
        } else if (type === 'session_reconnect') {
          ws.onclose = null;
          connect(msg.payload.session.reconnect_url, true);
        } else if (type === 'notification' && msg.metadata.subscription_type === 'channel.follow') {
          const ev = msg.payload.event;
          if (seen.has(ev.user_id)) return;
          seen.add(ev.user_id);
          onEvent({ type: 'follow', user: ev.user_name || ev.user_login });
        } else if (type === 'revocation') {
          log('Follow subscription revoked: ' + msg.payload.subscription.status, true);
        }
      };
      ws.onclose = () => {
        clearTimeout(watchdog);
        setTimeout(() => connect(), 5000);
      };
    }

    fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + token } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('token invalid or expired'))))
      .then((info) => {
        clientId = info.client_id;
        userId = info.user_id;
        if (!(info.scopes || []).includes('moderator:read:followers')) log('Token is missing the moderator:read:followers scope', true);
        connect();
      })
      .catch((err) => log('Follow alerts disabled: ' + err.message, true));
  }

  // ---------------------------------------------------------------- Streamer.bot WebSocket server
  // Streamer.bot is logged into Twitch as the broadcaster and reports every cheer, sub, gift and raid.
  // Field names differ between Streamer.bot versions, so each value is looked up a few ways.
  function sbName(d) {
    const m = d.message && typeof d.message === 'object' ? d.message : {};
    const u = d.user && typeof d.user === 'object' ? d.user : {};
    return d.displayName || d.user_name || d.userName || u.name || u.display_name || u.login || m.displayName || m.username ||
      d.username || d.user_login || d.from_broadcaster_user_name || 'Someone';
  }
  function sbLogin(d) {
    const m = d.message && typeof d.message === 'object' ? d.message : {};
    const u = d.user && typeof d.user === 'object' ? d.user : {};
    return d.userName || d.user_login || u.login || m.username || d.username || '';
  }
  function sbText(d) {
    if (typeof d.message === 'string') return d.message;
    if (d.message && typeof d.message === 'object') return d.message.message || d.message.text || '';
    return d.text || d.userInput || '';
  }

  async function sbAuth(password, salt, challenge) {
    const b64sha = async (str) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    };
    return b64sha((await b64sha(password + salt)) + challenge);
  }

  function StreamerbotEvents(onEvent, opts) {
    opts = opts || {};
    const log = opts.log || function () {};
    const url = 'ws://' + (opts.host || '127.0.0.1') + ':' + (opts.port || 8080) + '/';
    const events = opts.cheersOnly ? ['Cheer'] : ['Follow', 'Cheer', 'Sub', 'ReSub', 'GiftSub', 'GiftBomb', 'Raid'];
    if (opts.chatTest && !opts.cheersOnly) events.push('ChatMessage');
    let backoff = 2000, warned = false;

    function handle(type, d) {
      const user = sbName(d);
      if (type === 'Cheer') {
        const bits = (d.message && typeof d.message === 'object' && d.message.bits) || d.bits || d.amount;
        onEvent({ type: 'cheer', user, login: sbLogin(d), bits: String(parseInt(bits, 10) || 0), message: sbText(d).replace(/\b[A-Za-z]+\d+\b/g, '').replace(/\s+/g, ' ').trim() });
      } else if (type === 'Follow') onEvent({ type: 'follow', user });
      else if (type === 'Sub') onEvent({ type: 'sub', user, tier: tierName(d.isPrime ? 'prime' : d.subTier || d.tier || d.sub_tier) });
      else if (type === 'ReSub') {
        onEvent({ type: 'resub', user, months: String(d.cumulativeMonths || d.cumulative_months || d.monthsSubscribed || d.months || 1),
          tier: tierName(d.isPrime ? 'prime' : d.subTier || d.tier || d.sub_tier), message: sbText(d) });
      } else if (type === 'GiftSub') {
        if (d.fromSubBomb || d.fromGiftBomb || d.fromCommunitySubGift) return; // part of a gift bomb
        const r = d.recipient && typeof d.recipient === 'object' ? d.recipient : {};
        onEvent({ type: 'giftsub', user: d.isAnonymous || d.anonymous ? 'An anonymous pilot' : user,
          recipient: d.recipientDisplayName || d.recipientUserName || d.recipient_user_name || r.name || r.login || 'someone',
          tier: tierName(d.subTier || d.tier || d.sub_tier) });
      } else if (type === 'GiftBomb') {
        onEvent({ type: 'giftbomb', user: d.isAnonymous || d.anonymous ? 'An anonymous pilot' : user,
          count: String(d.gifts || d.total || d.count || d.amount || 1), tier: tierName(d.subTier || d.tier || d.sub_tier) });
      } else if (type === 'Raid') onEvent({ type: 'raid', user, viewers: String(d.viewers || d.viewerCount || d.viewer_count || 0) });
      else if (type === 'ChatMessage' && opts.onTest) {
        const m = d.message && typeof d.message === 'object' ? d.message : d;
        const text = sbText(d);
        const role = parseInt(m.role, 10) || 0; // 3 = moderator, 4 = broadcaster
        if (/^!testalert\b/i.test(text) && (role >= 3 || m.isModerator || m.isBroadcaster)) opts.onTest((text.split(/\s+/)[1] || 'follow').toLowerCase());
      }
    }

    function connect() {
      let ws;
      try { ws = new WebSocket(url); } catch (e) { retry(); return; }
      ws.onmessage = async (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.request === 'Hello') {
          backoff = 2000;
          warned = false;
          if (m.authentication) {
            if (!opts.password) { log('Streamer.bot wants a password: add it in the export window, or turn off authentication', true); return; }
            ws.send(JSON.stringify({ request: 'Authenticate', id: 'qp-auth', authentication: await sbAuth(opts.password, m.authentication.salt, m.authentication.challenge) }));
          }
          ws.send(JSON.stringify({ request: 'Subscribe', id: 'qp-sub', events: { Twitch: events } }));
          return;
        }
        if (m.id === 'qp-auth' && m.status !== 'ok') log('Streamer.bot rejected the password', true);
        if (m.id === 'qp-sub') {
          if (m.status === 'ok') log(opts.cheersOnly ? 'Streamer.bot connected (cheers)' : 'Connected to Streamer.bot');
          else log('Streamer.bot: ' + (m.error || 'could not subscribe to events'), true);
        }
        if (m.event && m.data && (!m.event.source || m.event.source === 'Twitch')) handle(m.event.type, m.data);
      };
      ws.onclose = () => {
        if (!warned) { log('Waiting for Streamer.bot at ' + url + ' (is its WebSocket server started?)', true); warned = true; }
        retry();
      };
    }
    function retry() {
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 1.5, 15000);
    }
    connect();
  }

  // ---------------------------------------------------------------- StreamElements custom widget events
  // StreamElements handles the Twitch login and sends every event to the widget, follows included.
  function StreamElementsEvents(onEvent, opts) {
    opts = opts || {};
    // A cheer can reach us up to four ways: StreamElements' 'cheer-latest' and general 'event'
    // listeners, the chat message StreamElements forwards, and Twitch chat directly. StreamElements
    // can skip a repeat (same viewer, same amount), but Twitch chat never does. Play the first copy
    // of each cheer and swallow the copies from the other sources.
    const recent = [];
    const bitsOf = (v) => String(parseInt(v, 10) || 0);
    const cheerMsg = (t) => String(t || '').replace(/\b[A-Za-z]+\d+\b/g, '').replace(/\s+/g, ' ').trim();
    function cheerOnce(src, ev, names) {
      const now = Date.now();
      while (recent.length && now - recent[0].at > 8000) recent.shift();
      names = names.filter(Boolean).map((n) => String(n).toLowerCase());
      const hit = recent.find((r) => r.bits === ev.bits && !r.srcs.has(src) && names.some((n) => r.names.has(n)));
      if (hit) { hit.srcs.add(src); names.forEach((n) => hit.names.add(n)); return; }
      recent.push({ at: now, bits: ev.bits, srcs: new Set([src]), names: new Set(names) });
      onEvent(ev);
    }

    let ircStarted = false;
    function startChat(channel) {
      if (ircStarted || !channel) return;
      ircStarted = true;
      TwitchChat(channel, (ev) => {
        if (ev.type === 'cheer') cheerOnce('irc', ev, [ev.user, ev.login]);
      }, { log: opts.log });
    }
    startChat(opts.channel);
    if (opts.streamerbot) StreamerbotEvents((ev) => cheerOnce('sb', ev, [ev.user, ev.login]), Object.assign({ cheersOnly: true, log: opts.log }, opts.streamerbot));
    window.addEventListener('onWidgetLoad', (obj) => {
      const ch = obj && obj.detail && obj.detail.channel;
      startChat(ch && ch.username);
    });

    window.addEventListener('onEventReceived', (obj) => {
      const d = (obj && obj.detail) || {};
      const ev = d.event || {};
      const L = d.listener;
      if (L === 'follower-latest') onEvent({ type: 'follow', user: ev.name });
      else if (L === 'subscriber-latest') {
        if (ev.isCommunityGift) return; // the individual subs of a gift bomb
        const tier = tierName(ev.tier);
        if (ev.bulkGifted) onEvent({ type: 'giftbomb', user: ev.sender || ev.name || 'An anonymous pilot', count: String(ev.amount || 1), tier });
        else if (ev.gifted) onEvent({ type: 'giftsub', user: ev.sender || 'An anonymous pilot', recipient: ev.name, tier });
        else if ((parseInt(ev.amount, 10) || 1) > 1) onEvent({ type: 'resub', user: ev.name, months: String(ev.amount), tier, message: ev.message || '' });
        else onEvent({ type: 'sub', user: ev.name, tier });
      } else if (L === 'cheer-latest') {
        cheerOnce('latest', { type: 'cheer', user: ev.name, bits: bitsOf(ev.amount), message: ev.message || '' }, [ev.name, ev.displayName, ev.username]);
      } else if (L === 'event' && ev.type === 'cheer') {
        const dd = ev.data || ev;
        cheerOnce('event', { type: 'cheer', user: dd.displayName || dd.username || dd.name, bits: bitsOf(dd.amount), message: dd.message || '' }, [dd.displayName, dd.username, dd.name]);
      } else if (L === 'raid-latest') onEvent({ type: 'raid', user: ev.name, viewers: String(ev.amount) });
      else if (L === 'message' && ev.data) {
        const data = ev.data, tags = data.tags || {};
        if (tags.bits) {
          const user = data.displayName || tags['display-name'] || data.nick;
          cheerOnce('chat', { type: 'cheer', user, bits: bitsOf(tags.bits), message: cheerMsg(data.text) }, [user, data.nick, tags['display-name']]);
          return;
        }
        const text = data.text || '';
        if (opts.chatTest && /^!testalert\b/i.test(text) && /(broadcaster|moderator)\//.test(tags.badges || '') && opts.onTest) opts.onTest((text.split(/\s+/)[1] || 'follow').toLowerCase());
      }
    });
  }

  // Builds the overlay page itself, so the whole overlay can be one pasted script.
  function mountStage(fontCss) {
    let canvas = document.getElementById('stage');
    if (canvas) return canvas;
    const de = document.documentElement;
    de.style.cssText = 'margin:0;padding:0;background:transparent;overflow:hidden;width:100%;height:100%';
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;padding:0;background:transparent;overflow:hidden;width:100%;height:100%';
    if (fontCss) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontCss;
      document.head.appendChild(link);
    }
    canvas = document.createElement('canvas');
    canvas.id = 'stage';
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;display:block;object-fit:contain';
    const status = document.createElement('div');
    status.id = 'status';
    status.style.cssText = 'position:fixed;left:16px;bottom:12px;font:600 20px Rajdhani,sans-serif;text-shadow:0 0 6px #000,0 0 2px #000;transition:opacity .8s;opacity:0';
    document.body.appendChild(canvas);
    document.body.appendChild(status);
    return canvas;
  }

  // ---------------------------------------------------------------- image loading
  function isAnimatedData(data) {
    if (!data || !data.startsWith('data:image/')) return false;
    if (data.startsWith('data:image/gif')) return true;
    try {
      const head = atob(data.slice(data.indexOf(',') + 1, data.indexOf(',') + 1 + 4000));
      return (data.startsWith('data:image/webp') && head.includes('ANIM')) || (data.startsWith('data:image/png') && head.includes('acTL'));
    } catch (e) { return false; }
  }

  async function decodeAnimation(img, data) {
    if (typeof ImageDecoder === 'undefined' || !isAnimatedData(data)) return;
    try {
      const type = data.slice(5, data.indexOf(';'));
      const dec = new ImageDecoder({ data: await (await fetch(data)).arrayBuffer(), type });
      await dec.tracks.ready;
      const n = Math.min(240, dec.tracks.selectedTrack ? dec.tracks.selectedTrack.frameCount : 1);
      if (n < 2) return;
      const frames = [], durs = [];
      for (let i = 0; i < n; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        durs.push(Math.max(20, (image.duration || 100000) / 1000));
        frames.push(await createImageBitmap(image));
        image.close();
      }
      img._anim = { frames, durs, total: durs.reduce((a, b) => a + b, 0) };
    } catch (e) { /* plays as a still image */ }
  }

  // True when a noticeable part of the image is see-through (a background-removed photo).
  function imageHasAlpha(img) {
    try {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      let clear = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
      return clear > 64 * 64 * 0.03;
    } catch (e) { return false; }
  }

  function loadImages(assets, cache) {
    cache = cache || {};
    const jobs = [];
    for (const id in assets) {
      const a = assets[id];
      if (a.type !== 'image') continue;
      if (!a.data) { delete cache[id]; continue; }
      if (cache[id] && cache[id]._src === a.data) { cache[id]._cutout = !!a.cutout; continue; }
      const img = new Image();
      img._src = a.data;
      img._cutout = !!a.cutout;
      jobs.push(new Promise((res) => {
        img.onload = () => { img._alpha = imageHasAlpha(img); decodeAnimation(img, a.data).then(res); };
        img.onerror = res;
      }));
      img.src = a.data;
      cache[id] = img;
    }
    return { cache, ready: Promise.all(jobs) };
  }

  function usedFonts(project) {
    const set = new Set(['Rajdhani']);
    for (const k in project.alerts) for (const l of project.alerts[k].layers) if (l.type === 'text') set.add(l.props.font);
    return [...set];
  }

  // ---------------------------------------------------------------- the OBS overlay player
  async function startOverlay(project, config) {
    config = config || {};
    const W = project.width || 1920, H = project.height || 1080;
    const canvas = mountStage(config.fontCss);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const status = document.getElementById('status');
    let statusTimer = null;
    function log(text, isError) {
      if (window.console) console[isError ? 'warn' : 'log']('[QuantumPaws] ' + text);
      if (!status || config.hideStatus) return;
      status.textContent = text;
      status.style.color = isError ? '#ff8a8a' : '#9fe8ff';
      status.style.opacity = '1';
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => { status.style.opacity = '0'; }, isError ? 15000 : 6000);
    }

    const queue = [];
    let current = null, cooldownUntil = 0;

    function enqueue(ev) {
      const alert = project.alerts[ev.type];
      if (!alert || !alert.enabled) return;
      if (queue.length > 50) return;
      queue.push(ev);
    }
    function test(type) {
      const types = type === 'all' ? ALERT_TYPES.map((a) => a.id) : [type];
      types.forEach((tp) => SAMPLE_VARS[tp] && enqueue(Object.assign({ type: tp }, SAMPLE_VARS[tp])));
    }
    window.testAlert = test;

    // Listen right away: events that arrive while photos and fonts load wait in the queue.
    if (config.source === 'streamelements') {
      StreamElementsEvents(enqueue, { chatTest: config.chatTest, onTest: test, channel: config.channel, log, streamerbot: config.streamerbot });
      log('Quantum Paws alerts ready');
    } else if (config.source === 'streamerbot') {
      StreamerbotEvents(enqueue, Object.assign({ chatTest: config.chatTest, onTest: test, log }, config.streamerbot));
    } else if (config.channel) TwitchChat(config.channel, enqueue, { log, chatTest: config.chatTest, onTest: test });
    else log('No Twitch channel set - re-export the overlay with your channel name', true);
    if (config.token) TwitchFollows(config.token, enqueue, log);

    const { cache: images, ready } = loadImages(project.assets);
    const assetNames = {};
    for (const id in project.assets) assetNames[id] = project.assets[id].name;
    await ready;
    try {
      await Promise.race([
        Promise.all(usedFonts(project).map((f) => document.fonts.load('700 40px "' + f + '"'))),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
    } catch (e) { /* offline: fall back to system fonts */ }

    // When alerts pile up (a cheer train, a gift bomb), play them faster so nobody waits long.
    const catchUp = config.catchUp !== false;
    const rate = () => (catchUp && queue.length ? Math.min(2, 1 + 0.5 * queue.length) : 1);
    let last = 0;
    function frame(now) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (!current && queue.length && now >= cooldownUntil) {
        const ev = queue.shift();
        current = { ev, alert: project.alerts[ev.type], t: 0 };
        try { window.dispatchEvent(new CustomEvent('quantumpaws:alert', { detail: ev })); } catch (e) { /* old browsers */ }
        playSound(current.alert.sound, project.assets, config.volume == null ? 0.8 : config.volume);
      }
      ctx.clearRect(0, 0, W, H);
      if (current) {
        current.t += dt * rate();
        if (current.t >= current.alert.duration) {
          current = null;
          cooldownUntil = now + (config.gap == null ? 1 : config.gap) * 1000 / rate();
        } else {
          render(ctx, current.alert, current.t, { width: W, height: H, images, assetNames, vars: current.ev });
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    if (config.testOnLoad) setTimeout(() => test('all'), 800);
  }

  return {
    EASES, EASE_LABELS, FONTS, SCHEMA, ALERT_TYPES, SAMPLE_VARS, SYNTHS, SYNTH_LABELS,
    uid, makeLayer, fieldDef, evalProp, evalLayer, substitute, render, layerBounds, layerActive,
    applyAlertTransform, isAnimatedData, imageHasAlpha, playSound, getAudio, loadImages, usedFonts, parseIrc, startOverlay, pawPath,
  };
}
