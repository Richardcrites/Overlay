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
  // Cubic-bezier easing like After Effects' speed graph: handles (x1, y1) and (x2, y2), x within 0..1.
  const bz = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  function cubicBezier(b, x) {
    const x1 = Math.max(0, Math.min(1, b[0])), x2 = Math.max(0, Math.min(1, b[2]));
    let lo = 0, hi = 1, tt = x;
    for (let i = 0; i < 24; i++) {
      const bx = bz(tt, x1, x2);
      if (Math.abs(bx - x) < 1e-5) break;
      if (bx < x) lo = tt; else hi = tt;
      tt = (lo + hi) / 2;
    }
    return bz(tt, b[1], b[3]);
  }
  const EASY_EASE = [0.33, 0, 0.67, 1];
  const BEZIER_PRESETS = {
    'Easy Ease': [0.33, 0, 0.67, 1], 'Ease In': [0.6, 0, 1, 1], 'Ease Out': [0, 0, 0.4, 1],
    'Snappy': [0.15, 0.9, 0.2, 1], 'Anticipate': [0.5, -0.4, 0.7, 1], 'Overshoot': [0.3, 0, 0.3, 1.35], 'Linear': [0, 0, 1, 1],
  };
  const EASES = {
    linear: (p) => p,
    easyEase: (p) => cubicBezier(EASY_EASE, p),
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
    easyEase: 'Easy Ease (F9)', bezier: 'Custom curve (graph)', linear: 'Linear', hold: 'Hold', easeIn: 'Ease In', easeOut: 'Ease Out', easeInOut: 'Ease In/Out',
    expoIn: 'Expo In', expoOut: 'Expo Out', backIn: 'Back In (anticipate)', backOut: 'Back Out (overshoot)',
    elastic: 'Elastic', bounce: 'Bounce',
  };

  // ---------------------------------------------------------------- schema
  const FONTS = ['Orbitron', 'Rajdhani', 'Share Tech Mono', 'Exo 2', 'Audiowide', 'Bebas Neue', 'Russo One', 'Patrick Hand', 'Comic Neue', 'Arial'];
  const BLENDS = [['source-over', 'Normal'], ['screen', 'Screen'], ['lighter', 'Add (glow)'], ['multiply', 'Multiply'], ['overlay', 'Overlay']];

  const COMMON = [
    { key: 'x', label: 'Position X', type: 'num', anim: true, def: 960, step: 1 },
    { key: 'y', label: 'Position Y', type: 'num', anim: true, def: 540, step: 1 },
    { key: 'anchorX', label: 'Anchor X', type: 'num', anim: true, def: 0, step: 1 },
    { key: 'anchorY', label: 'Anchor Y', type: 'num', anim: true, def: 0, step: 1 },
    { key: 'scale', label: 'Scale', type: 'num', anim: true, def: 1, step: 0.01 },
    { key: 'scaleX', label: 'Stretch X', type: 'num', anim: true, def: 1, step: 0.01 },
    { key: 'scaleY', label: 'Stretch Y', type: 'num', anim: true, def: 1, step: 0.01 },
    { key: 'rotation', label: 'Rotation', type: 'num', anim: true, def: 0, step: 1 },
    { key: 'skew', label: 'Skew', type: 'num', anim: true, def: 0, step: 0.5 },
    { key: 'opacity', label: 'Opacity', type: 'num', anim: true, def: 1, step: 0.01, min: 0, max: 1 },
    { key: 'blur', label: 'Blur', type: 'num', anim: true, def: 0, step: 0.5, min: 0 },
    { key: 'glow', label: 'Glow (bloom)', type: 'num', anim: true, def: 0, step: 1, min: 0 },
    { key: 'glowColor', label: 'Glow color', type: 'color', def: '#3fd8ff' },
    { key: 'blend', label: 'Blend mode', type: 'select', def: 'source-over', options: BLENDS },
    { key: 'motionBlur', label: 'Motion blur', type: 'bool', def: false },
    { key: 'sweep', label: 'Light sweep', type: 'num', anim: true, def: 0, step: 0.01, min: 0, max: 1 },
    { key: 'sweepColor', label: 'Sweep color', type: 'color', def: '#ffffff' },
    { key: 'sweepWidth', label: 'Sweep width', type: 'num', def: 140, step: 5, min: 5 },
    { key: 'glitch', label: 'Glitch', type: 'num', anim: true, def: 0, step: 0.01, min: 0, max: 1 },
    { key: 'onlyIf', label: 'Show', type: 'select', def: '', options: [['', 'Always'], ['message', 'Only if there is a {message}']] },
  ];
  const TRANSFORM_KEYS = ['x', 'y', 'anchorX', 'anchorY', 'scale', 'scaleX', 'scaleY', 'rotation', 'skew', 'opacity'];
  const EFFECT_KEYS = ['blur', 'glow', 'glowColor', 'blend', 'motionBlur', 'sweep', 'sweepColor', 'sweepWidth', 'glitch', 'onlyIf'];

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
      { key: 'animator', label: 'Letter animation', type: 'select', def: 'none', options: [['none', 'None'], ['decode', 'Decode (sci-fi scramble)'], ['fadeUp', 'Fade up'], ['pop', 'Pop'], ['slide', 'Slide in'], ['wave', 'Wave']] },
      { key: 'progress', label: 'Letter progress', type: 'num', anim: true, def: 1, step: 0.01, min: 0, max: 1 },
      { key: 'stagger', label: 'Letter stagger', type: 'num', def: 0.15, step: 0.01, min: 0, max: 1 },
      { key: 'gradient', label: 'Gradient fill', type: 'bool', def: false },
      { key: 'color2', label: 'Gradient bottom', type: 'color', def: '#7fd8ff' },
      { key: 'wrap', label: 'Wrap width (0 = off)', type: 'num', def: 0, step: 10, min: 0 },
      { key: 'fit', label: 'Shrink to fit width (0 = off)', type: 'num', def: 0, step: 10, min: 0 },
      { key: 'fitHeight', label: 'Shrink to fit height (0 = off)', type: 'num', def: 0, step: 5, min: 0 },
      { key: 'outline', label: 'Outline', type: 'num', anim: true, def: 0, step: 0.5, min: 0 },
      { key: 'outlineColor', label: 'Outline color', type: 'color', def: '#000000' },
    ],
    shape: [
      { key: 'kind', label: 'Shape', type: 'select', def: 'panel', options: [['panel', 'HUD panel'], ['rect', 'Rectangle'], ['circle', 'Circle / ellipse'], ['hex', 'Hexagon'], ['brackets', 'Corner brackets'], ['ring', 'Dashed ring'], ['line', 'Line'], ['sparkle', 'Sparkle (wink glint)'], ['bubble', 'Speech bubble (hand-drawn)']] },
      { key: 'width', label: 'Width', type: 'num', anim: true, def: 400, step: 1, min: 0 },
      { key: 'height', label: 'Height', type: 'num', anim: true, def: 160, step: 1, min: 0 },
      { key: 'fill', label: 'Fill color', type: 'color', def: '#06121f' },
      { key: 'fillAlpha', label: 'Fill opacity', type: 'num', anim: true, def: 0.8, step: 0.01, min: 0, max: 1 },
      { key: 'stroke', label: 'Stroke color', type: 'color', def: '#3fd8ff' },
      { key: 'strokeWidth', label: 'Stroke width', type: 'num', anim: true, def: 2, step: 0.5, min: 0 },
      { key: 'reveal', label: 'Wipe reveal', type: 'num', anim: true, def: 1, step: 0.01, min: 0, max: 1 },
      { key: 'spin', label: 'Spin (deg/sec)', type: 'num', def: 0, step: 1 },
      { key: 'dash', label: 'Dash length', type: 'num', def: 14, step: 1, min: 1 },
      { key: 'tail', label: 'Bubble tail', type: 'select', def: 'left', options: [['left', 'Bottom left'], ['right', 'Bottom right'], ['none', 'None']] },
      { key: 'wobble', label: 'Hand-drawn wobble', type: 'num', def: 0, step: 0.1, min: 0 },
    ],
    video: [
      { key: 'asset', label: 'Video', type: 'video', def: '' },
      { key: 'width', label: 'Width', type: 'num', anim: true, def: 1280, step: 1, min: 0 },
      { key: 'height', label: 'Height', type: 'num', anim: true, def: 720, step: 1, min: 0 },
      { key: 'startAt', label: 'Start the video at (s)', type: 'num', def: 0, step: 0.1, min: 0 },
      { key: 'loop', label: 'Loop', type: 'bool', def: false },
      { key: 'volume', label: 'Video sound volume', type: 'num', def: 1, step: 0.05, min: 0, max: 2 },
      { key: 'chroma', label: 'Green screen key', type: 'bool', def: false },
      { key: 'keyColor', label: 'Key color', type: 'color', def: '#16be28' },
      { key: 'keyTolerance', label: 'Key tolerance', type: 'num', def: 0.3, step: 0.01, min: 0, max: 1 },
      { key: 'keySoftness', label: 'Key edge softness', type: 'num', def: 0.12, step: 0.01, min: 0.01, max: 1 },
    ],
    mascot: [
      { key: 'pose', label: 'Pose', type: 'select', def: 'idle', options: [['idle', 'Idle (blinks, ear twitches)'], ['excited', 'Excited (bouncy, happy eyes)']] },
      { key: 'talk', label: 'Talking', type: 'num', anim: true, def: 0, step: 0.05, min: 0, max: 1 },
      { key: 'width', label: 'Width', type: 'num', anim: true, def: 300, step: 1, min: 0 },
      { key: 'height', label: 'Height', type: 'num', anim: true, def: 510, step: 1, min: 0 },
      { key: 'fur', label: 'Fur', type: 'color', def: '#c99a62' },
      { key: 'furDark', label: 'Dark fur', type: 'color', def: '#8b5a33' },
      { key: 'mask', label: 'Muzzle', type: 'color', def: '#2b211b' },
      { key: 'cream', label: 'Chest & brows', type: 'color', def: '#ecd6ad' },
      { key: 'innerEar', label: 'Inner ears', type: 'color', def: '#e3a98d' },
      { key: 'eye', label: 'Eyes', type: 'color', def: '#3a2212' },
      { key: 'ears', label: 'Ears', type: 'select', def: 'perky', options: [['perky', 'Perky (big, upright)'], ['floppy', 'Floppy']] },
      { key: 'vestOn', label: 'Vest', type: 'bool', def: true },
      { key: 'vest', label: 'Vest color', type: 'color', def: '#22b5e8' },
      { key: 'harness', label: 'Harness', type: 'color', def: '#16191d' },
      { key: 'outline', label: 'Outline', type: 'color', def: '#15100c' },
      { key: 'lineWidth', label: 'Line thickness', type: 'num', def: 1, step: 0.1, min: 0.2 },
      { key: 'wobble', label: 'Hand-drawn wobble', type: 'num', def: 1, step: 0.1, min: 0 },
      { key: 'speed', label: 'Animation speed', type: 'num', def: 1, step: 0.1, min: 0 },
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
    { id: 'tip', label: 'Donation', vars: ['user', 'amount', 'message'] },
    { id: 'redeem', label: 'Redeem', vars: ['user', 'reward', 'message'] },
    { id: 'raid', label: 'Raid', vars: ['user', 'viewers'] },
  ];
  const SAMPLE_VARS = {
    follow: { user: 'StarRunner_42' },
    sub: { user: 'OrgCommander', tier: 'Tier 1' },
    resub: { user: 'Vanduul_Hunter', months: '14', tier: 'Tier 1', message: 'o7 Best crew in the verse, give the pups a treat!' },
    giftsub: { user: 'Hull_C_Hauler', recipient: 'NewPilot99', tier: 'Tier 1' },
    giftbomb: { user: 'Idris_Captain', count: '10', tier: 'Tier 1' },
    cheer: { user: 'aUEC_Baron', bits: '500', message: 'Fuel for the Carrack! Good boys!' },
    tip: { user: 'GenerousPilot', amount: '$5.00', message: 'Treats for the dogs!' },
    redeem: { user: 'so_hey', reward: 'Bezos Money', message: 'I think you should be puffy' },
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

  function keyedValue(layer, key, t) {
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
        const e = a.e === 'bezier' ? cubicBezier(a.b || EASY_EASE, p) : (EASES[a.e] || EASES.linear)(p);
        return a.v + (b.v - a.v) * e;
      }
    }
    return last.v;
  }

  // Smooth 1D value noise in -1..1, for the wiggle expression.
  function vnoise(x, seed) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    const h = (n) => { const q = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return q - Math.floor(q); };
    return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
  }

  // Keyframed value, plus wiggle(freq, amount) if the property has it (like the After Effects expression).
  function evalProp(layer, key, t) {
    let v = keyedValue(layer, key, t);
    const wg = layer.wiggle && layer.wiggle[key];
    if (wg && wg.a && typeof v === 'number') {
      const sd = wg.s || 1;
      v += wg.a * (vnoise(t * wg.f, sd) * 0.75 + vnoise(t * wg.f * 2.13, sd + 17) * 0.25);
      const f = fieldDef(layer.type, key);
      if (f && f.min != null) v = Math.max(f.min, v);
      if (f && f.max != null) v = Math.min(f.max, v);
    }
    return v;
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

  // ---------------------------------------------------------------- hand-drawn doodle helpers
  // A smooth closed (or open) curve through points, each nudged a little. The nudges change about 8 times a
  // second, so outlines "boil" like a hand-drawn GIF.
  function doodlePath(ctx, pts, wob, seed, frame, closed) {
    const n = pts.length;
    if (n < 2) return;
    const j = !wob ? pts : pts.map(([x, y], i) => {
      const a = charHash(seed * 131.7 + i * 17.31 + frame * 7.13) * Math.PI * 2;
      const r = charHash(seed * 71.3 + i * 3.77 + frame * 13.9) * wob;
      return [x + Math.cos(a) * r, y + Math.sin(a) * r];
    });
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ctx.beginPath();
    if (closed !== false) {
      const m0 = mid(j[n - 1], j[0]);
      ctx.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) { const p = j[i], m = mid(p, j[(i + 1) % n]); ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
      ctx.closePath();
    } else {
      ctx.moveTo(j[0][0], j[0][1]);
      for (let i = 1; i < n - 1; i++) { const m = mid(j[i], j[i + 1]); ctx.quadraticCurveTo(j[i][0], j[i][1], m[0], m[1]); }
      ctx.lineTo(j[n - 1][0], j[n - 1][1]);
    }
  }
  function ellPts(cx, cy, rx, ry, n) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return out;
  }
  // Rounded speech bubble with an optional tail, sampled as points so it can wobble.
  function bubblePts(w, h, tail) {
    const r = Math.max(4, Math.min(h * 0.45, 40, w / 4));
    const pts = [];
    const edge = (x0, y0, x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 40)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
    const corner = (cx, cy, a0) => { for (let i = 0; i < 4; i++) { const a = a0 + i / 4 * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    const L = -w / 2, R = w / 2, T = -h / 2, B = h / 2;
    edge(L + r, T, R - r, T); corner(R - r, T + r, -Math.PI / 2);
    edge(R, T + r, R, B - r); corner(R - r, B - r, 0);
    if (tail === 'left' || tail === 'right') {
      const sgn = tail === 'left' ? -1 : 1;
      const a = sgn * w * 0.18, b = sgn * w * 0.3, tip = [sgn * w * 0.43, B + Math.min(70, h * 0.6)];
      // Bottom edge right to left, with the tail inserted.
      if (sgn < 0) { edge(R - r, B, a, B); pts.push([a, B]); pts.push(tip); edge(b, B, L + r, B); }
      else { edge(R - r, B, b, B); pts.push([b, B]); pts.push(tip); edge(a, B, L + r, B); }
    } else edge(R - r, B, L + r, B);
    corner(L + r, B - r, Math.PI / 2);
    edge(L, B - r, L, T + r); corner(L + r, T + r, Math.PI);
    return pts;
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

  // Text after {variables}, with [c=#hex]colored[/c] markup split out into a per-letter color list.
  function richText(v, vars) {
    const src = substitute(v.text, vars);
    let plain = '', color = null, last = 0;
    const colors = [];
    const re = /\[c=([^\]]+)\]|\[\/c\]/g;
    let m;
    while ((m = re.exec(src))) {
      const chunk = src.slice(last, m.index);
      plain += chunk;
      for (let i = 0; i < chunk.length; i++) colors.push(color);
      color = m[1] ? m[1].trim() : null;
      last = re.lastIndex;
    }
    const tail = src.slice(last);
    plain += tail;
    for (let i = 0; i < tail.length; i++) colors.push(color);
    if (v.upper) plain = plain.toUpperCase();
    return { plain, colors, colored: colors.some((c) => c) };
  }
  function textString(v, vars) { return richText(v, vars).plain; }

  // Long usernames shrink instead of spilling out of the panel.
  function fitScale(ctx, v, lines) {
    let k = 1;
    if (v.fit > 0) {
      let w = 0;
      for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
      if (w > v.fit) k = v.fit / w;
    }
    if (v.fitHeight > 0) {
      const h = lines.length * v.size * 1.15;
      if (h > v.fitHeight) k = Math.min(k, v.fitHeight / h);
    }
    return k;
  }

  const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$<>/\\=+*';
  const widthCache = new Map();
  // Letter widths measured before a web font finishes loading are wrong, so start over when fonts arrive.
  if (typeof document !== 'undefined' && document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => widthCache.clear());
  function charWidths(ctx, line) {
    const key = ctx.font + '|' + (ctx.letterSpacing || '') + '|' + line;
    let ws = widthCache.get(key);
    if (!ws) {
      ws = Array.from(line, (ch) => ctx.measureText(ch).width);
      if (widthCache.size > 300) widthCache.clear();
      widthCache.set(key, ws);
    }
    return ws;
  }
  const charHash = (n) => { const q = Math.sin(n * 91.345 + 47.853) * 43758.5453; return q - Math.floor(q); };

  function drawText(ctx, v, env, t) {
    setupText(ctx, v);
    const rich = richText(v, env.vars);
    const lines = textLines(ctx, rich.plain, v.wrap);
    // Where each wrapped line starts in the plain text, to look up letter colors.
    const starts = [];
    for (let i = 0, at = 0; i < lines.length; i++) { const f = rich.plain.indexOf(lines[i], at); starts.push(f < 0 ? at : f); at = (f < 0 ? at : f) + lines[i].length; }
    const colorAt = (i) => rich.colors[i] || null;
    const k = fitScale(ctx, v, lines);
    if (k < 1) ctx.scale(k, k);
    const total = lines.reduce((n, l) => n + l.length, 0);
    let budget = v.reveal >= 1 ? Infinity : Math.floor(total * Math.max(0, v.reveal));
    const lh = v.size * 1.15;
    const top = -(lines.length - 1) * lh / 2;
    let fill = v.color;
    if (v.gradient) {
      fill = ctx.createLinearGradient(0, top - v.size * 0.45, 0, top + (lines.length - 1) * lh + v.size * 0.45);
      fill.addColorStop(0, v.color);
      fill.addColorStop(1, v.color2);
    }
    ctx.fillStyle = fill;
    ctx.lineJoin = 'round';
    const anim = v.animator && v.animator !== 'none';
    if (!anim) {
      let y = top;
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
        if (rich.colored) {
          drawRuns(ctx, v, line, y, starts[i], colorAt, fill);
        } else {
          if (v.outline > 0) {
            ctx.lineWidth = v.outline * 2;
            ctx.strokeStyle = v.outlineColor;
            ctx.strokeText(line, 0, y);
          }
          ctx.fillText(line, 0, y);
        }
        y += lh;
      }
    } else {
      // Per-letter animation (like an After Effects text animator with a range selector):
      // each letter runs its own 0..1 animation, offset from the previous one by `stagger`.
      const st = Math.max(0, Math.min(1, v.stagger));
      const P = Math.max(0, Math.min(1, v.progress));
      const span = 1 + st * Math.max(0, total - 1);
      const fr = Math.floor((t || 0) * 24);
      ctx.textAlign = 'center';
      let ci = 0;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li], y = top + li * lh;
        const ws = charWidths(ctx, line);
        const lw = ws.reduce((a, b) => a + b, 0);
        let x = v.align === 'left' ? 0 : v.align === 'right' ? -lw : -lw / 2;
        for (let j = 0; j < line.length; j++, ci++) {
          if (ci >= budget) return finishText(ctx);
          const ch = line[j], cw = ws[j], cx = x + cw / 2;
          x += cw;
          const pc = Math.max(0, Math.min(1, P * span - st * ci));
          if (pc <= 0 || ch === ' ') continue;
          let glyph = ch, alpha = 1, dx = 0, dy = 0, sc = 1, rot = 0;
          if (v.animator === 'decode') {
            if (pc < 1) { glyph = GLYPHS[Math.floor(charHash(ci * 13.7 + fr) * GLYPHS.length)]; alpha = 0.55 + 0.45 * pc; }
          } else if (v.animator === 'fadeUp') {
            const e = EASES.easeOut(pc); alpha = e; dy = (1 - e) * v.size * 0.55;
          } else if (v.animator === 'pop') {
            sc = EASES.backOut(pc); alpha = Math.min(1, pc * 3);
          } else if (v.animator === 'slide') {
            const e = EASES.expoOut(pc); dx = (1 - e) * v.size * 1.6; alpha = pc; rot = (1 - e) * -0.35;
          } else if (v.animator === 'wave') {
            const e = EASES.easeOut(pc); alpha = e;
            dy = Math.sin((t || 0) * 6 + ci * 0.55) * v.size * 0.1 + (1 - e) * v.size * 0.4;
          }
          ctx.save();
          ctx.globalAlpha *= alpha;
          const col = colorAt(starts[li] + j);
          if (col) ctx.fillStyle = col;
          if (sc !== 1 || rot) {
            ctx.translate(cx + dx, y + dy);
            if (rot) ctx.rotate(rot);
            ctx.scale(sc, sc);
            if (v.outline > 0) { ctx.lineWidth = v.outline * 2; ctx.strokeStyle = v.outlineColor; ctx.strokeText(glyph, 0, 0); }
            ctx.fillText(glyph, 0, 0);
          } else {
            if (v.outline > 0) { ctx.lineWidth = v.outline * 2; ctx.strokeStyle = v.outlineColor; ctx.strokeText(glyph, cx + dx, y + dy); }
            ctx.fillText(glyph, cx + dx, y + dy);
          }
          ctx.restore();
        }
      }
    }
    finishText(ctx);
  }
  function finishText(ctx) { if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; }

  // One line drawn as runs of same-colored letters.
  function drawRuns(ctx, v, line, y, start, colorAt, fill) {
    const w = ctx.measureText(line).width;
    let x = v.align === 'left' ? 0 : v.align === 'right' ? -w : -w / 2;
    const align = ctx.textAlign;
    ctx.textAlign = 'left';
    let i = 0;
    while (i < line.length) {
      const col = colorAt(start + i);
      let j = i + 1;
      while (j < line.length && colorAt(start + j) === col) j++;
      const run = line.slice(i, j);
      if (v.outline > 0) { ctx.lineWidth = v.outline * 2; ctx.strokeStyle = v.outlineColor; ctx.strokeText(run, x, y); }
      ctx.fillStyle = col || fill;
      ctx.fillText(run, x, y);
      x += ctx.measureText(run).width;
      i = j;
    }
    ctx.fillStyle = fill;
    ctx.textAlign = align;
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
    else if (kind === 'bubble') {
      ctx.lineJoin = 'round';
      doodlePath(ctx, bubblePts(w, h, v.tail), (v.wobble || 0) * 2.2, 7, Math.floor(Math.max(0, t - layer.inPoint) * 8));
    }
    else if (kind === 'circle') {
      ctx.beginPath();
      if (reveal < 1) { ctx.moveTo(0, 0); ctx.ellipse(0, 0, w / 2, h / 2, 0, -Math.PI / 2, endA); ctx.closePath(); }
      else ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    }

    if (kind === 'rect' || kind === 'panel' || kind === 'hex' || kind === 'circle' || kind === 'sparkle' || kind === 'bubble') {
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

  // ---------------------------------------------------------------- video layer
  // The <video> follows the alert's clock: playing while the alert plays, seeking when scrubbed in the editor.
  function syncVideo(vid, v, layer, env) {
    const t = env.frameTime == null ? 0 : env.frameTime;
    let want = Math.max(0, t - layer.inPoint) + (v.startAt || 0);
    const dur = isFinite(vid.duration) ? vid.duration : 0;
    if (dur) want = v.loop ? want % dur : Math.min(want, dur - 0.04);
    vid.muted = vid._qpNoSound || !env.audio || !(v.volume > 0);
    vid.volume = Math.max(0, Math.min(1, (v.volume == null ? 1 : v.volume) * (env.masterVolume == null ? 1 : env.masterVolume)));
    vid.playbackRate = env.rate || 1;
    vid._qpUsed = true;
    if (env.playing) {
      if ((vid.paused || vid.ended) && !vid._qpStarting) {
        vid.currentTime = want;
        vid._qpStarting = true;
        const p = vid.play();
        const done = () => { vid._qpStarting = false; };
        if (p && p.then) {
          p.then(done, () => {
            // The browser blocked sound without a click (OBS doesn't): play muted instead of freezing.
            vid._qpNoSound = true;
            vid.muted = true;
            vid.play().then(done, done);
          });
        } else done();
      } else if (!vid._qpStarting && Math.abs(vid.currentTime - want) > 0.25) vid.currentTime = want;
      else if (Math.abs(vid.currentTime - want) > 0.25) vid.currentTime = want;
    } else {
      if (!vid.paused) vid.pause();
      if (Math.abs(vid.currentTime - want) > 0.02 && !vid.seeking) {
        vid.currentTime = want;
        if (env.onVideoSeek) vid.addEventListener('seeked', env.onVideoSeek, { once: true });
      }
    }
  }

  // Live chroma key into a scratch canvas, redone only when the video frame changes.
  function keyedFrame(vid, v) {
    const w = vid.videoWidth, h = vid.videoHeight;
    let c = vid._qpKey;
    if (!c || c.width !== w || c.height !== h) { c = vid._qpKey = document.createElement('canvas'); c.width = w; c.height = h; c._g = c.getContext('2d', { willReadFrequently: true }); }
    const sig = vid.currentTime + '|' + v.keyColor + '|' + v.keyTolerance + '|' + v.keySoftness;
    if (c._sig === sig) return c;
    c._sig = sig;
    const g = c._g;
    g.clearRect(0, 0, w, h);
    g.drawImage(vid, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const kc = parseInt(String(v.keyColor || '#16be28').slice(1), 16), kr = (kc >> 16) & 255, kg = (kc >> 8) & 255, kb = kc & 255;
    // Compare colour (chroma) only, so shadows and highlights of the screen key out too.
    const ky = 0.299 * kr + 0.587 * kg + 0.114 * kb, kU = kb - ky, kV = kr - ky;
    const tol = Math.max(0, v.keyTolerance) * 180, soft = Math.max(1, v.keySoftness * 180);
    const greenKey = kg > kr && kg > kb;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gr = d[i + 1], b = d[i + 2];
      const y = 0.299 * r + 0.587 * gr + 0.114 * b;
      const dist = Math.hypot(b - y - kU, r - y - kV);
      let a = (dist - tol) / soft;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      if (greenKey && a < 1) { const m = r > b ? r : b; if (gr > m) d[i + 1] = m; }   // remove green spill on edges
      d[i + 3] = d[i + 3] * a;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function drawVideo(ctx, v, env, layer) {
    const w = Math.max(0, v.width), h = Math.max(0, v.height);
    if (w < 1 || h < 1) return;
    const vid = env.videos && env.videos[v.asset];
    if (!vid || vid.readyState < 2) {
      ctx.fillStyle = 'rgba(10,20,35,0.6)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#9fe8ff';
      ctx.font = '600 ' + Math.max(12, Math.round(h * 0.05)) + 'px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(vid ? 'Loading video...' : 'Pick a video for this layer', 0, 0);
      if (vid) syncVideo(vid, v, layer, env);
      return;
    }
    syncVideo(vid, v, layer, env);
    ctx.shadowBlur = 0;
    ctx.drawImage(v.chroma ? keyedFrame(vid, v) : vid, -w / 2, -h / 2, w, h);
  }

  function loadVideos(assets, cache) {
    cache = cache || {};
    const jobs = [];
    for (const id in assets) {
      const a = assets[id];
      if (a.type !== 'video') continue;
      if (!a.data) { delete cache[id]; continue; }
      if (cache[id] && cache[id]._src === a.data) continue;
      const vid = document.createElement('video');
      vid._src = a.data;
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = 'auto';
      vid.crossOrigin = 'anonymous';
      cache[id] = vid;
      jobs.push((async () => {
        try {
          // A blob URL is much lighter than a huge data: URL.
          vid.src = a.data.startsWith('data:') ? URL.createObjectURL(await (await fetch(a.data)).blob()) : a.data;
          await new Promise((res) => { vid.addEventListener('loadeddata', res, { once: true }); vid.addEventListener('error', res, { once: true }); setTimeout(res, 8000); });
        } catch (e) { /* stays as a placeholder */ }
      })());
    }
    return { cache, ready: Promise.all(jobs) };
  }
  function stopVideos(cache) {
    for (const id in cache || {}) { const vid = cache[id]; if (!vid.paused) vid.pause(); vid._qpUsed = false; }
  }

  // ---------------------------------------------------------------- cartoon dog mascot (doodle style)
  // A bust of the dog in a thick-outlined, hand-drawn GIF style: blinks, twitches an ear, bobs, and talks.
  // Every idle motion repeats within this many seconds, so exported GIFs loop seamlessly.
  const MASCOT_LOOP = Math.PI * 2 / 1.5;
  function drawMascot(ctx, v, t, layer) {
    const u = Math.min(v.width, v.height / 1.7);
    if (u < 4) return;
    const lt = Math.max(0, t - layer.inPoint) * (v.speed == null ? 1 : v.speed);
    const frame = v.wobble > 0 ? Math.floor(Math.max(0, t - layer.inPoint) * 8) : 0;
    const wob = Math.max(0, v.wobble) * u * 0.007;
    const lw = Math.max(1, u * 0.024 * (v.lineWidth == null ? 1 : v.lineWidth));
    const ink = v.outline;
    const excited = v.pose === 'excited';
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    let seed = 1;
    const sc = (pts) => pts.map(([x, y]) => [x * u, y * u]);
    const shape = (pts, fill, stroke, closed) => {
      doodlePath(ctx, sc(pts), wob, seed++, frame, closed);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke !== false) { ctx.strokeStyle = ink; ctx.lineWidth = lw; ctx.stroke(); }
    };
    const line = (pts, color, width) => {
      doodlePath(ctx, sc(pts), wob, seed++, frame, false);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    };
    ctx.shadowBlur = 0;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.translate(0, -0.17 * u);   // centre the bust in the layer box

    // Body, cut off flat at the bottom like a portrait bust: neck and shoulders, cream chest, vest and harness.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-0.7 * u, -1.2 * u, 1.4 * u, 2.2 * u - lw / 2);
    ctx.clip();
    shape([[-0.52, 1.15], [-0.48, 0.72], [-0.4, 0.5], [-0.24, 0.36], [-0.14, 0.18], [0.14, 0.18], [0.24, 0.36], [0.4, 0.5], [0.48, 0.72], [0.52, 1.15]], v.fur);
    shape([[-0.13, 0.28], [0.13, 0.28], [0.09, 0.6], [0, 0.68], [-0.09, 0.6]], v.cream, false);
    if (v.vestOn) {
      shape([[-0.53, 1.15], [-0.5, 0.72], [-0.41, 0.53], [-0.24, 0.55], [-0.09, 0.7], [0, 0.74], [0.09, 0.7], [0.24, 0.55], [0.41, 0.53], [0.5, 0.72], [0.53, 1.15]], v.vest);
      line([[-0.42, 0.8], [-0.3, 0.86], [-0.14, 0.9]], 'rgba(255,255,255,0.35)', lw * 0.9);   // vest shine
      line([[-0.4, 0.54], [-0.22, 0.61], [0, 0.65], [0.22, 0.61], [0.4, 0.54]], v.harness, lw * 2.3);
      shape([[0.14, 0.57], [0.23, 0.56], [0.245, 0.65], [0.155, 0.66]], '#c9ced6');
    }
    ctx.restore();
    // The flat bottom edge.
    line([[-0.53, 1.0], [0, 1.0], [0.53, 1.0]], ink, lw);

    // Head group: bobs and tilts around the neck.
    ctx.save();
    const bob = Math.sin(lt * 3) * 0.012 - (excited ? Math.abs(Math.sin(lt * 6)) * 0.035 : 0);
    const tilt = Math.sin(lt * 1.5) * 0.05 + (excited ? Math.sin(lt * 6) * 0.05 : 0);
    ctx.translate(0, (bob + 0.3) * u);
    ctx.rotate(tilt);
    ctx.translate(0, -0.3 * u);

    // Ears (behind the head). The right ear twitches now and then.
    const tp = lt % (MASCOT_LOOP / 2);
    const twitch = tp < 0.28 ? Math.sin(tp / 0.28 * Math.PI) : 0;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 0.17 * u, -0.16 * u);
      ctx.rotate(side * (0.1 + (side === 1 ? twitch * 0.28 : 0) + (excited ? Math.sin(lt * 6) * 0.06 : 0)));
      const ear = v.ears === 'floppy'
        ? [[-0.1, 0.02], [0.09, -0.03], [0.17, 0.12], [0.13, 0.3], [0.04, 0.32], [-0.02, 0.16]]
        : [[-0.11, 0.04], [0.1, 0.0], [0.13, -0.2], [0.09, -0.4], [0.02, -0.48], [-0.06, -0.32]];
      const mir = (pts) => pts.map(([x, y]) => [x * side, y]);
      shape(mir(ear), v.fur);
      const inner = ear.map(([x, y]) => [x * 0.55 + 0.005, y * 0.62 + 0.02]);
      shape(mir(inner), v.ears === 'floppy' ? v.furDark : v.innerEar, false);
      ctx.restore();
    }

    // Face.
    const head = [];
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, sn = Math.sin(a);
      head.push([Math.cos(a) * 0.31 * (1 + 0.07 * Math.max(0, sn)), sn * 0.27 - 0.02 + Math.max(0, sn) * 0.03]);
    }
    shape(head, v.fur);
    ctx.globalAlpha *= 0.55;
    shape(ellPts(0, -0.2, 0.11, 0.05, 12), v.furDark, false);
    ctx.globalAlpha /= 0.55;
    for (const side of [-1, 1]) shape(ellPts(side * 0.12, -0.135, 0.042, 0.024, 10), v.cream, false);

    // Eyes: blink every few seconds; happy arcs when excited.
    const bp = lt % MASCOT_LOOP;
    const blink = bp > MASCOT_LOOP - 0.3 && bp < MASCOT_LOOP - 0.15 ? 1 - Math.abs(bp - (MASCOT_LOOP - 0.225)) / 0.075 : 0;
    for (const side of [-1, 1]) {
      const ex = side * 0.12, ey = -0.05;
      if (excited || blink > 0.8) {
        line([[ex - 0.05, ey + (excited ? 0.015 : 0)], [ex, ey - (excited ? 0.03 : 0)], [ex + 0.05, ey + (excited ? 0.015 : 0)]], ink, lw * 1.1);
      } else {
        const open = 1 - blink;
        shape(ellPts(ex, ey, 0.052, 0.062 * open, 16), v.eye);
        shape(ellPts(ex - side * 0.012 - 0.008, ey - 0.022 * open, 0.017, 0.017 * open, 8), '#ffffff', false);
      }
    }

    // Black muzzle, nose and mouth.
    shape(ellPts(0, 0.135, 0.145, 0.105, 22), v.mask);
    shape(ellPts(0, 0.02, 0.05, 0.055, 10), v.fur, false);
    const talk = clamp01(v.talk);
    const open = excited ? 0.6 : talk * clamp01(0.55 + 0.45 * Math.sin(lt * 18 + Math.sin(lt * 4.5) * 2));
    if (open > 0.06) {
      const my = 0.18 + open * 0.02, ry = 0.015 + 0.06 * open;
      shape(ellPts(0, my, 0.075, ry, 16), '#4a1018');
      shape(ellPts(0, my + ry * 0.45, 0.045, ry * 0.5, 12), '#f07a8c', false);
    } else {
      line([[-0.07, 0.155], [-0.035, 0.178], [0, 0.163], [0.035, 0.178], [0.07, 0.155]], '#6d5a4c', lw * 0.9);
    }
    shape([[-0.058, 0.048], [0.058, 0.048], [0.036, 0.094], [0, 0.112], [-0.036, 0.094]], '#0d0907');
    shape(ellPts(-0.02, 0.062, 0.014, 0.009, 8), 'rgba(255,255,255,0.75)', false);
    ctx.restore();
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

  function layerActive(layer, t) { return !layer.hidden && t >= layer.inPoint && t < layer.outPoint; }

  // The whole alert's "Move all / Scale all" offset.
  function alertMatrix(alert, W, H) {
    const o = alert.offset || {};
    return new DOMMatrix().translateSelf(W / 2 + (o.x || 0), H / 2 + (o.y || 0)).scaleSelf(o.scale || 1, o.scale || 1).translateSelf(-W / 2, -H / 2);
  }
  function applyAlertTransform(ctx, alert, W, H) {
    const m = alertMatrix(alert, W, H);
    ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  }

  // Position -> rotation -> skew -> scale/stretch -> anchor point, like an After Effects layer.
  function localMatrix(v) {
    return new DOMMatrix().translateSelf(v.x, v.y).rotateSelf(v.rotation || 0).skewXSelf(v.skew || 0)
      .scaleSelf(v.scale * (v.scaleX == null ? 1 : v.scaleX), v.scale * (v.scaleY == null ? 1 : v.scaleY))
      .translateSelf(-(v.anchorX || 0), -(v.anchorY || 0));
  }
  // Layer -> alert space, through its parent chain (Parent & Link).
  function worldMatrix(layer, t, byId, depth) {
    const m = localMatrix(evalLayer(layer, t));
    const p = layer.parent && byId && byId[layer.parent];
    if (p && p !== layer && (depth || 0) < 8) return worldMatrix(p, t, byId, (depth || 0) + 1).multiply(m);
    return m;
  }
  function layerIndex(alert) {
    const byId = {};
    for (const l of alert.layers) if (l.id) byId[l.id] = l;
    return byId;
  }

  function drawContent(g, layer, v, t, env) {
    if (layer.type === 'image') drawImage(g, v, env, layer, t);
    else if (layer.type === 'emote') drawEmote(g, v, t, layer);
    else if (layer.type === 'mascot') drawMascot(g, v, t, layer);
    else if (layer.type === 'video') drawVideo(g, v, env, layer);
    else if (layer.type === 'text') drawText(g, v, env, t);
    else if (layer.type === 'shape') drawShape(g, v, t, layer);
    else if (layer.type === 'particles') drawParticles(g, v, t, layer);
  }
  // Draws a layer's pixels at time t with its full transform (opacity and blend are applied later).
  function drawLayerAt(g, base, layer, t, env, byId, shadowGlow) {
    const v = evalLayer(layer, t);
    const m = base.multiply(worldMatrix(layer, t, byId));
    g.save();
    g.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    if (v.blur > 0) g.filter = 'blur(' + v.blur + 'px)';
    // Standard quality: the classic, cheap drop-shadow glow instead of bloom.
    if (shadowGlow && v.glow > 0 && layer.type !== 'particles') { g.shadowColor = v.glowColor; g.shadowBlur = v.glow; }
    drawContent(g, layer, v, t, env);
    g.restore();
  }

  // Off-screen buffers, one set per output canvas: full-size layer buffers plus a half-size bloom buffer.
  // Effects only touch the rectangle around the layer (its "region"), which keeps them cheap.
  function pool(ctx) {
    const c = ctx.canvas;
    let p = c._qpPool;
    if (!p || p.w !== c.width || p.h !== c.height) {
      const mk = (w, h) => { const e = document.createElement('canvas'); e.width = w; e.height = h; return e; };
      const w = c.width, h = c.height;
      p = c._qpPool = { w, h, L: mk(w, h), T: mk(w, h), U: mk(w, h), B: mk(Math.ceil(w / 2) + 6, Math.ceil(h / 2) + 6), C: mk(Math.ceil(w / 4) + 6, Math.ceil(h / 4) + 6) };
      for (const k of ['L', 'T', 'U', 'B', 'C']) p[k + 'c'] = p[k].getContext('2d');
    }
    return p;
  }
  function reset(g) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.filter = 'none';
  }
  function wipe(g, R) { reset(g); g.clearRect(R.x, R.y, R.w, R.h); }
  const blit = (g, src, R, dx, dy) => g.drawImage(src, R.x, R.y, R.w, R.h, R.x + (dx || 0), R.y + (dy || 0), R.w, R.h);

  // Roughly how many pixels the layer moves during one shutter interval (0 = still).
  function motionPx(layer, t, span, byId, box) {
    const a = worldMatrix(layer, t - span / 2, byId), b = worldMatrix(layer, t + span / 2, byId);
    const size = Math.max(box.w, box.h) / Math.max(1e-6, box.scale);
    let px = Math.hypot(a.e - b.e, a.f - b.f) + (Math.abs(a.a - b.a) + Math.abs(a.b - b.b) + Math.abs(a.c - b.c) + Math.abs(a.d - b.d)) * size * 0.5;
    for (const key in layer.keys) {
      if (!layer.keys[key].length || key === 'x' || key === 'y' || key === 'opacity' || key === 'glow' || key === 'sweep' || key === 'glitch') continue;
      const f = fieldDef(layer.type, key);
      const d = Math.abs(evalProp(layer, key, t - span / 2) - evalProp(layer, key, t + span / 2));
      px = Math.max(px, f && f.max != null && f.max <= 1 ? d * 200 : d * 0.5);
    }
    return px * box.scale;
  }

  // Screen-space box of a layer at time t.
  function screenBox(g, base, layer, t, env, byId) {
    const b = layerBounds(g, layer, t, env.vars);
    const m = base.multiply(worldMatrix(layer, t, byId));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
      const p = m.transformPoint(new DOMPoint(x, y));
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, scale: Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) };
  }
  // The pixel rectangle a layer and its effects can reach, clamped to the canvas.
  function regionFor(P, base, layer, v, t, env, byId, mb, glitchOn) {
    const boxes = [screenBox(P.Tc, base, layer, t, env, byId)];
    if (mb) {
      boxes.push(screenBox(P.Tc, base, layer, t - SHUTTER / 2, env, byId));
      boxes.push(screenBox(P.Tc, base, layer, t + SHUTTER / 2, env, byId));
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sc = 1;
    for (const b of boxes) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); sc = Math.max(sc, b.scale); }
    if (layer.type === 'particles') return { x: 0, y: 0, w: P.w, h: P.h };
    // Room for things drawn past the bounds: ears/helmets, strokes, letters sliding in, blur, glow and glitch slices.
    let pad = 6 + (v.blur || 0) * 3 + (v.glow || 0) * 1.6;
    if (layer.type === 'text') pad += (v.size || 0) * sc * (v.animator !== 'none' && v.progress < 1 ? 1.7 : 0.35);
    else if (layer.type === 'shape') pad += ((v.strokeWidth || 0) * 7 + (v.kind === 'ring' ? 20 : 0)) * sc;
    else if (layer.type === 'emote') pad += (x1 - x0) * 0.25;
    else if (layer.type === 'mascot') pad += 12 * sc;
    else if (layer.type === 'image') pad += ((v.border || 0) + 2) * sc;
    if (glitchOn) pad += 110;
    const x = Math.max(0, Math.floor(x0 - pad)), y = Math.max(0, Math.floor(y0 - pad));
    const r = Math.min(P.w, Math.ceil(x1 + pad)), btm = Math.min(P.h, Math.ceil(y1 + pad));
    if (!isFinite(x) || !isFinite(r) || r <= x || btm <= y) return null;
    return { x, y, w: r - x, h: btm - y };
  }

  // CC Light Sweep: a slanted band of light crossing the layer, only where the layer has pixels.
  function lightSweep(P, v, box, R) {
    const g = P.Lc, w = Math.max(5, v.sweepWidth);
    const x = box.x - w + (box.w + 2 * w) * v.sweep;
    g.save();
    reset(g);
    g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
    g.globalCompositeOperation = 'source-atop';
    g.translate(x, box.y + box.h / 2);
    g.rotate(0.35);
    const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    gr.addColorStop(0, hexToRgba(v.sweepColor, 0));
    gr.addColorStop(0.5, hexToRgba(v.sweepColor, 0.85));
    gr.addColorStop(1, hexToRgba(v.sweepColor, 0));
    g.fillStyle = gr;
    const reach = Math.max(box.h, box.w) * 2 + 200;
    g.fillRect(-w / 2, -reach, w, reach * 2);
    g.restore();
  }

  // Digital glitch: displaced slices plus an RGB channel split. Returns the canvas holding the result.
  function glitch(P, amt, t, R) {
    const r = mulberry(Math.floor(t * 30) * 977 + 13);
    wipe(P.Tc, R);
    blit(P.Tc, P.L, R);
    const n = 3 + Math.floor(amt * 9);
    for (let i = 0; i < n; i++) {
      const sy = R.y + r() * R.h, sh = Math.min(R.y + R.h - sy, 4 + r() * 70 * amt), dx = Math.round((r() - 0.5) * 170 * amt);
      if (sh <= 0) continue;
      const S = { x: R.x, y: sy, w: R.w, h: sh };
      P.Tc.clearRect(S.x, S.y, S.w, S.h);
      P.Tc.save(); P.Tc.beginPath(); P.Tc.rect(R.x, R.y, R.w, R.h); P.Tc.clip();
      blit(P.Tc, P.L, S, dx, 0);
      P.Tc.restore();
    }
    wipe(P.Uc, R);
    const off = Math.round(2 + amt * 16);
    P.Uc.save(); P.Uc.beginPath(); P.Uc.rect(R.x, R.y, R.w, R.h); P.Uc.clip();
    for (const [col, dx] of [['#ff0000', -off], ['#00ff00', 0], ['#0000ff', off]]) {
      const g = P.Lc;
      wipe(g, R);
      blit(g, P.T, R);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = col;
      g.fillRect(R.x, R.y, R.w, R.h);
      g.globalCompositeOperation = 'destination-in';
      blit(g, P.T, R);
      P.Uc.globalCompositeOperation = 'lighter';
      blit(P.Uc, P.L, R, dx, 0);
    }
    P.Uc.restore();
    return P.U;
  }

  // Bloom glow, the way games do it: the layer at half size is shrunk by further halves (each 2x step averages
  // pixels, like a mip chain), tinted, and two of the copies are stretched back up and added under the layer:
  // a tight glow and a wide one. `paint(g, w, h)` puts the half-size layer into g, inside a 1px empty border.
  function bloom(ctx, P, v, R, paint) {
    const lg = (x) => Math.round(Math.log2(x));
    const l1 = Math.max(1, Math.min(3, lg(Math.max(2, v.glow * 0.3))));
    const l2 = Math.max(l1 + 1, Math.min(5, lg(Math.max(4, v.glow * 1.1))));
    let from = null, fr = null, cw = R.w, ch = R.h;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    for (let lvl = 1; lvl <= l2; lvl++) {
      const to = lvl % 2 ? P.B : P.C, g = lvl % 2 ? P.Bc : P.Cc;
      const w = Math.max(1, Math.ceil(cw / 2)), h = Math.max(1, Math.ceil(ch / 2));
      reset(g);
      // Clear one extra texel too: smoothing samples just past the copied edge, which may hold an older level.
      g.clearRect(0, 0, w + 4, h + 4);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'low';
      if (lvl === 1) {
        paint(g, w, h);
        reset(g);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = v.glowColor;
        g.fillRect(0, 0, w + 2, h + 2);
      } else {
        g.drawImage(from, fr.x, fr.y, fr.w, fr.h, 1, 1, w, h);
      }
      if (lvl === l1 || lvl === l2) {
        const sx = R.w / w, sy = R.h / h;
        ctx.globalAlpha = Math.min(1, v.opacity) * (lvl === l1 ? 0.9 : 0.65);
        ctx.drawImage(to, 0, 0, w + 2, h + 2, R.x - sx, R.y - sy, (w + 2) * sx, (h + 2) * sy);
      }
      from = to; fr = { x: 1, y: 1, w, h }; cw = w; ch = h;
    }
    ctx.restore();
  }

  const SHUTTER = 1 / 60;   // 180 degree shutter at 30 fps, like an After Effects comp
  const MB_SAMPLES = 6;

  // Layers are stored top-first (like After Effects), so draw them in reverse.
  function render(ctx, alert, t, env) {
    const W = env.width || 1920, H = env.height || 1080;
    env.frameTime = t;   // videos sync to this, not to motion-blur sub-samples
    const byId = layerIndex(alert);
    const t0 = ctx.getTransform();
    const base = new DOMMatrix([t0.a, t0.b, t0.c, t0.d, t0.e, t0.f]).multiply(alertMatrix(alert, W, H));
    // 'high' (default): motion blur + bloom. 'standard' / 'draft': drop-shadow glow, no motion blur.
    const full = env.quality !== 'draft' && env.quality !== 'standard';
    for (let i = alert.layers.length - 1; i >= 0; i--) {
      const layer = alert.layers[i];
      if (!layerActive(layer, t)) continue;
      const v = evalLayer(layer, t);
      if (v.opacity <= 0) continue;
      if (v.onlyIf && !String((env.vars || {})[v.onlyIf] || '').trim()) continue;
      const blend = v.blend || 'source-over';
      let samples = 0;
      if (full && v.motionBlur && layer.type !== 'video') {
        const px = motionPx(layer, t, SHUTTER, byId, screenBox(ctx, base, layer, t, env, byId));
        if (px > 0.8) samples = Math.max(2, Math.min(MB_SAMPLES, Math.ceil(px / 5) + 1));
      }
      const mb = samples > 0;
      const sweepOn = v.sweep > 0 && v.sweep < 1;
      const glitchOn = v.glitch > 0.002;
      const glowOn = full && v.glow > 0.5;
      const needBuffer = mb || sweepOn || glitchOn;
      const P = (needBuffer || glowOn) && pool(ctx);
      const R = P && regionFor(P, base, layer, v, t, env, byId, mb, glitchOn);
      if (R && !needBuffer) {
        // Glow only: no full-size buffer needed. Draw the layer at half size straight into the bloom buffer.
        bloom(ctx, P, v, R, (g) => drawLayerAt(g, new DOMMatrix().translateSelf(1 - R.x / 2, 1 - R.y / 2).scaleSelf(0.5).multiply(base), layer, t, env, byId));
      }
      if (!R || !needBuffer) {
        ctx.save();
        ctx.globalAlpha *= Math.min(1, v.opacity);
        ctx.globalCompositeOperation = blend;
        drawLayerAt(ctx, base, layer, t, env, byId, !full);
        ctx.restore();
        continue;
      }
      // Precompose the layer so effects apply to all of its pixels at once.
      wipe(P.Lc, R);
      if (mb) {
        for (let s = 0; s < samples; s++) {
          const ts = t + SHUTTER * (s / (samples - 1) - 0.5);
          wipe(P.Tc, R);
          drawLayerAt(P.Tc, base, layer, ts, env, byId);
          P.Lc.globalAlpha = 1 / (s + 1);   // running average of the samples
          blit(P.Lc, P.T, R);
        }
        P.Lc.globalAlpha = 1;
      } else {
        drawLayerAt(P.Lc, base, layer, t, env, byId, !full);
      }
      if (sweepOn) lightSweep(P, v, screenBox(P.Tc, base, layer, t, env, byId), R);
      const src = glitchOn ? glitch(P, Math.min(1, v.glitch), t, R) : P.L;
      if (glowOn) bloom(ctx, P, v, R, (g, w, h) => g.drawImage(src, R.x, R.y, R.w, R.h, 1, 1, w, h));
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(1, v.opacity);
      ctx.globalCompositeOperation = blend;
      blit(ctx, src, R);
      ctx.restore();
    }
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
    boing(ac, out, at) {
      // Cartoon spring: a wobbly rising tone, plus a little pop.
      const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(170, at + 0.35);
      o.frequency.exponentialRampToValueAtTime(560, at + 0.75);
      lfo.frequency.value = 22; lg.gain.value = 40;
      lfo.connect(lg).connect(o.frequency);
      env(ac, g, at + 0.35, 0.45, 0.02, 0.55);
      o.connect(g).connect(out);
      o.start(at + 0.35); o.stop(at + 1.0); lfo.start(at + 0.35); lfo.stop(at + 1.0);
      tone(ac, out, 'triangle', 900, 1400, at + 0.62, 0.08, 0.25);
    },
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
  const SYNTH_LABELS = { boing: 'Cartoon boing', none: 'None', quantum: 'Quantum jump (whoosh + boom)', chirp: 'Comm chirp', hail: 'Incoming hail', alarm: 'Red alert klaxon' };

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
    if (d.message && typeof d.message === 'object' && (d.message.message || d.message.text)) return d.message.message || d.message.text;
    return d.text || d.userInput || '';
  }

  async function sbAuth(password, salt, challenge) {
    const b64sha = async (str) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    };
    return b64sha((await b64sha(password + salt)) + challenge);
  }

  // Donation services Streamer.bot can connect to, and the event each one sends for a tip.
  const TIP_SOURCES = [['StreamElements', 'Tip'], ['Streamlabs', 'Donation'], ['Kofi', 'Donation'], ['TipeeeStream', 'Donation']];
  function money(amount, currency) {
    const n = Number(amount);
    if (!isFinite(n)) return String(amount == null ? '' : amount);
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'USD').toUpperCase() }).format(n); }
    catch (e) { return n.toFixed(2) + (currency ? ' ' + currency : ''); }
  }

  function StreamerbotEvents(onEvent, opts) {
    opts = opts || {};
    const log = opts.log || function () {};
    const url = 'ws://' + (opts.host || '127.0.0.1') + ':' + (opts.port || 8080) + '/';
    const events = opts.cheersOnly ? ['Cheer'] : ['Follow', 'Cheer', 'Sub', 'ReSub', 'GiftSub', 'GiftBomb', 'Raid', 'RewardRedemption'];
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
      else if (type === 'RewardRedemption') {
        const rw = d.reward && typeof d.reward === 'object' ? d.reward : {};
        onEvent({ type: 'redeem', user, reward: rw.title || rw.name || d.rewardName || d.title || 'a reward',
          message: d.user_input || d.userInput || d.input || '' });
      }
      else if (type === 'ChatMessage' && opts.onTest) {
        // Streamer.bot 0.2 nests the chatter in data.message; 1.0 uses data.user and data.text.
        const m = d.message && typeof d.message === 'object' ? d.message : {};
        const u = d.user && typeof d.user === 'object' ? d.user : {};
        const text = sbText(d).trim();
        const role = Math.max(parseInt(m.role, 10) || 0, parseInt(u.role, 10) || 0, parseInt(d.role, 10) || 0); // 3 = moderator, 4 = broadcaster
        const badges = [].concat(m.badges || [], u.badges || [], d.badges || []).map((b) => String((b && (b.name || b.setId || b.set_id)) || b).toLowerCase());
        const boss = role >= 3 || m.isModerator || m.isBroadcaster || u.isModerator || u.isBroadcaster || d.isModerator || d.isBroadcaster ||
          badges.some((b) => /^(broadcaster|moderator)/.test(b));
        if (/^!testalert\b/i.test(text) && boss) opts.onTest((text.split(/\s+/)[1] || 'follow').toLowerCase());
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
          if (!opts.cheersOnly) {
            for (const [src, type] of TIP_SOURCES) ws.send(JSON.stringify({ request: 'Subscribe', id: 'qp-tip-' + src, events: { [src]: [type] } }));
          }
          return;
        }
        if (m.id === 'qp-auth' && m.status !== 'ok') log('Streamer.bot rejected the password', true);
        if (m.id === 'qp-sub') {
          if (m.status === 'ok') log(opts.cheersOnly ? 'Streamer.bot connected (cheers)' : 'Connected to Streamer.bot');
          else log('Streamer.bot: ' + (m.error || 'could not subscribe to events'), true);
        }
        if (m.event && m.data && (!m.event.source || m.event.source === 'Twitch')) handle(m.event.type, m.data);
        else if (m.event && m.data && !opts.cheersOnly && TIP_SOURCES.some(([src, type]) => src === m.event.source && type === m.event.type)) {
          const d = m.data;
          onEvent({ type: 'tip', user: d.username || d.from || d.displayName || d.name || 'Someone',
            amount: d.formattedAmount || d.formatted_amount || money(d.amount, d.currency), message: d.message || '' });
        }
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
      else if (L === 'tip-latest') onEvent({ type: 'tip', user: ev.name, amount: money(ev.amount, ev.currency), message: ev.message || '' });
      else if (L === 'event' && (ev.type === 'channelPointsRedemption' || ev.type === 'channel-points-redemption')) {
        const dd = ev.data || ev;
        onEvent({ type: 'redeem', user: dd.displayName || dd.username || dd.name, reward: dd.redemption || dd.rewardTitle || (dd.reward && dd.reward.title) || dd.item || 'a reward', message: dd.message || dd.userInput || '' });
      }
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
    const { cache: videos, ready: videosReady } = loadVideos(project.assets);
    const assetNames = {};
    for (const id in project.assets) assetNames[id] = project.assets[id].name;
    await Promise.all([ready, videosReady]);
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
          stopVideos(videos);
          cooldownUntil = now + (config.gap == null ? 1 : config.gap) * 1000 / rate();
        } else {
          render(ctx, current.alert, current.t, {
            width: W, height: H, images, videos, assetNames, vars: current.ev, quality: config.quality || 'high',
            playing: true, audio: true, rate: rate(), masterVolume: config.volume == null ? 0.8 : config.volume,
          });
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    if (config.testOnLoad) setTimeout(() => test('all'), 800);
  }

  return {
    EASES, EASE_LABELS, BEZIER_PRESETS, EASY_EASE, FONTS, SCHEMA, TRANSFORM_KEYS, EFFECT_KEYS, ALERT_TYPES, SAMPLE_VARS, SYNTHS, SYNTH_LABELS,
    uid, makeLayer, fieldDef, evalProp, keyedValue, evalLayer, substitute, render, layerBounds, layerActive, cubicBezier,
    alertMatrix, worldMatrix, layerIndex, applyAlertTransform, MASCOT_LOOP, loadVideos, stopVideos, isAnimatedData, imageHasAlpha, playSound, getAudio, loadImages, usedFonts, parseIrc, startOverlay, pawPath,
  };
}
