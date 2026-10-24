/*
 * Built-in "Quantum Paws" templates: Star Citizen-style HUD alerts starring the three dogs.
 * Each alert type gets its own color, headline and crew line-up.
 */
// Text supports {variables} and plurals: {bits:bit|bits} reads "bit" when bits is 1.
const TEMPLATE_VERSION = 2;
const THEMES = {
  follow: { color: '#3fd8ff', dogs: ['dog1'], emote: 'wink', header: 'NEW RECRUIT', title: '{user}', sub: 'just joined the pack. Welcome aboard!', synth: 'chirp' },
  sub: { color: '#ffc94a', dogs: ['dog2'], emote: 'pog', header: 'WELCOME TO THE BIG DOGS', title: '{user}', sub: 'just subscribed  \u2022  {tier}', synth: 'quantum' },
  resub: { color: '#ff9f43', dogs: ['dog2'], emote: 'love', header: 'STILL ONE OF THE BIG DOGS', title: '{user}', sub: 'subscribed for {months} {months:month|months}!', message: '{message}', synth: 'quantum' },
  giftsub: { color: '#5cffb0', dogs: ['dog3'], emote: 'happy', header: 'GIFT INCOMING', title: '{user}', sub: 'gifted a sub to {recipient}!', synth: 'chirp' },
  giftbomb: { color: '#ff5ce1', dogs: ['dog1', 'dog2', 'dog3'], emote: 'pog', header: 'SUPPLY DROP', title: '{user}', sub: 'gifted {count} {count:sub|subs} to the pack!', synth: 'quantum' },
  cheer: { color: '#b07bff', dogs: ['dog1'], emote: 'wink', header: 'BITS INCOMING', title: '{user}', sub: 'cheered {bits} {bits:bit|bits}. Thank you!', message: '{message}', synth: 'hail' },
  raid: { color: '#ff4a5a', dogs: ['dog1', 'dog2', 'dog3'], emote: 'cool', helmet: true, header: 'RAID INCOMING', title: '{user}', sub: "brought {viewers} {viewers:pilot|pilots}. Let's throw some ass!", synth: 'alarm' },
};

function makeTemplate(RT, type) {
  const th = THEMES[type];
  const C = th.color;
  const D = 7;
  const k = (t, v, e) => ({ t, v, e: e || 'easeOut' });
  const L = (ltype, name, inP, outP, props, keys) => {
    const l = RT.makeLayer(ltype, name, props, { inPoint: inP, outPoint: outP });
    l.keys = {};
    for (const key in keys || {}) if (keys[key].length) l.keys[key] = keys[key];
    return l;
  };
  const multi = th.dogs.length > 1;
  const layers = [];

  // Geometry for the two layouts.
  const P = multi ? { x: 960, y: 385, w: 940, h: 170 } : { x: 1010, y: 300, w: 820, h: 190 };
  const TX = multi ? 960 : 745;
  const FIT = multi ? 880 : 650;
  const align = multi ? 'center' : 'left';
  const ty = multi ? { h: 333, t: 385, s: 437 } : { h: 240, t: 300, s: 357 };
  const flash = multi ? { x: 960, y: 190 } : { x: 585, y: 300 };
  const fadeOut = (a, b) => [k(a, 1, 'easeIn'), k(b, 0)];

  // ---- foreground: text
  if (th.message && !multi) {
    layers.push(L('text', 'Chat message', 2.6, D - 0.4, {
      text: th.message, font: 'Rajdhani', size: 28, weight: '600', italic: true, color: '#d6e4f0',
      x: P.x, y: P.y + P.h / 2 + 46, align: 'center', wrap: 780, glow: 8, glowColor: '#000000',
    }, { opacity: [k(2.6, 0), k(3.0, 1), ...fadeOut(D - 0.9, D - 0.5)], y: [k(2.6, P.y + P.h / 2 + 66), k(3.0, P.y + P.h / 2 + 46)] }));
  }
  layers.push(L('text', 'Subtitle', 2.2, D - 0.4, {
    text: th.sub, font: 'Rajdhani', size: multi ? 30 : 31, weight: '600', color: '#e3f6ff', x: TX, y: ty.s, align, fit: FIT,
  }, { reveal: [k(2.2, 0, 'linear'), k(2.9, 1)], opacity: fadeOut(D - 0.9, D - 0.5) }));
  layers.push(L('text', 'Name', 1.9, D - 0.4, {
    text: th.title, font: 'Orbitron', size: multi ? 56 : 60, weight: '900', color: '#ffffff', x: TX, y: ty.t, align, fit: FIT, glow: 22, glowColor: C,
  }, {
    opacity: [k(1.9, 0), k(2.3, 1), ...fadeOut(D - 0.9, D - 0.5)],
    x: multi ? [] : [k(1.9, TX + 50), k(2.4, TX)],
    tracking: [k(1.9, 24, 'expoOut'), k(2.6, 3)],
  }));
  layers.push(L('text', 'Header', 1.7, D - 0.4, {
    text: th.header, font: 'Share Tech Mono', size: 24, weight: '400', color: C, x: TX, y: ty.h, align, fit: FIT, tracking: 5, glow: 10, glowColor: C,
  }, { reveal: [k(1.7, 0, 'linear'), k(2.15, 1)], opacity: fadeOut(D - 0.9, D - 0.5) }));

  // ---- animated cartoon dog emote, peeking over the panel's top-right corner
  const E = multi ? { x: P.x + P.w / 2 - 10, y: P.y - P.h / 2 - 14, s: 165 } : { x: P.x + P.w / 2 - 25, y: P.y - P.h / 2 - 22, s: 185 };
  layers.push(L('emote', 'Dog emote', 2.3, D - 0.4, {
    expression: th.emote, helmet: !!th.helmet, accent: C, x: E.x, y: E.y, width: E.s, height: E.s, glow: 18, glowColor: C,
  }, {
    scale: [k(2.3, 0, 'backOut'), k(2.75, 1), k(D - 0.9, 1, 'backIn'), k(D - 0.55, 0)],
    rotation: [k(2.3, -35, 'backOut'), k(2.8, 0)],
  }));

  // ---- the crew (dogs)
  const dogXs = multi ? [770, 960, 1150] : [585];
  const dogY = multi ? 190 : 300;
  const dogSize = multi ? 150 : 230;
  th.dogs.forEach((dog, i) => {
    const t0 = 1.25 + i * 0.15;
    layers.push(L('shape', 'Wink glint ' + dog.slice(3), 3.2 + i * 0.2, 3.9 + i * 0.2, {
      kind: 'sparkle', x: dogXs[i] + dogSize * 0.3, y: dogY - dogSize * 0.3, width: dogSize * 0.26, height: dogSize * 0.26,
      fill: '#ffffff', fillAlpha: 1, strokeWidth: 0, glow: 22, glowColor: C, blend: 'lighter',
    }, {
      scale: [k(3.2 + i * 0.2, 0, 'backOut'), k(3.45 + i * 0.2, 1, 'easeIn'), k(3.9 + i * 0.2, 0)],
      rotation: [k(3.2 + i * 0.2, 0, 'linear'), k(3.9 + i * 0.2, 120)],
    }));
    layers.push(L('image', 'Dog ' + dog.slice(3), t0, D - 0.3, {
      asset: dog, x: dogXs[i], y: dogY, width: dogSize, height: dogSize, mask: 'circle', border: 4, borderColor: C, glow: 26, glowColor: C,
    }, {
      scale: [k(t0, 0, 'backOut'), k(t0 + 0.5, 1, 'linear'), k(4.3 + i * 0.2, 1, 'easeOut'), k(4.45 + i * 0.2, 1.1, 'backOut'), k(4.75 + i * 0.2, 1, 'linear'), k(D - 0.8, 1, 'backIn'), k(D - 0.4, 0)],
      rotation: [k(t0, -25), k(t0 + 0.6, 0, 'linear'), k(3.0 + i * 0.2, 0, 'easeInOut'), k(3.3 + i * 0.2, -10, 'easeInOut'), k(3.7 + i * 0.2, 8, 'easeInOut'), k(4.0 + i * 0.2, 0)],
    }));
    layers.push(L('shape', 'Dog ring ' + dog.slice(3), t0 + 0.1, D - 0.3, {
      kind: 'ring', x: dogXs[i], y: dogY, width: dogSize + 44, height: dogSize + 44, stroke: C, strokeWidth: 3, spin: i % 2 ? -40 : 40, dash: 18, glow: 12, glowColor: C,
    }, {
      reveal: [k(t0 + 0.1, 0), k(t0 + 0.8, 1)],
      opacity: [k(t0 + 0.1, 1), ...fadeOut(D - 0.8, D - 0.45)],
    }));
  });

  // ---- HUD frame
  layers.push(L('shape', 'Scan line', 1.8, 3.2, {
    kind: 'line', x: P.x, y: P.y - P.h / 2, width: P.w - 40, height: 4, stroke: C, strokeWidth: 2, glow: 16, glowColor: C,
  }, { y: [k(1.8, P.y - P.h / 2 + 8, 'easeInOut'), k(3.0, P.y + P.h / 2 - 8)], opacity: [k(1.8, 0.9), k(2.9, 0.9), k(3.2, 0)] }));
  layers.push(L('shape', 'Brackets', 1.5, D - 0.3, {
    kind: 'brackets', x: P.x, y: P.y, width: P.w + 44, height: P.h + 44, stroke: C, strokeWidth: 3, glow: 10, glowColor: C,
  }, { scale: [k(1.5, 1.35, 'expoOut'), k(2.0, 1)], opacity: [k(1.5, 0), k(1.8, 1), ...fadeOut(D - 0.9, D - 0.55)] }));
  layers.push(L('shape', 'HUD panel', 1.1, D - 0.2, {
    kind: 'panel', x: P.x, y: P.y, width: P.w, height: P.h, fill: '#04101d', fillAlpha: 0.84, stroke: C, strokeWidth: 2, glow: 18, glowColor: C,
  }, {
    width: [k(1.1, 0, 'expoOut'), k(1.5, P.w), k(D - 0.6, P.w, 'easeIn'), k(D - 0.2, 0)],
    height: [k(1.35, 4, 'expoOut'), k(1.75, P.h), k(D - 0.85, P.h, 'easeIn'), k(D - 0.6, 4)],
  }));
  layers.push(L('particles', 'Paw prints', 2.0, D, {
    kind: 'paws', x: P.x, y: P.y - 20, width: P.w + 120, height: 420, count: 16, color: C, size: 4, speed: 1, seed: 7,
  }, { intensity: [k(2.0, 0), k(2.8, 0.7), k(D - 1, 0.7), k(D, 0)] }));

  // ---- quantum arrival / departure
  layers.push(L('shape', 'Jump-out streak', D - 0.55, D, {
    kind: 'line', x: P.x, y: P.y, width: 0, height: 6, stroke: '#ffffff', strokeWidth: 4, glow: 30, glowColor: C, blend: 'lighter',
  }, { width: [k(D - 0.55, 0, 'expoOut'), k(D - 0.25, 1500)], opacity: [k(D - 0.4, 1), k(D, 0)] }));
  layers.push(L('shape', 'Arrival flash', 0.95, 1.45, {
    kind: 'circle', x: flash.x, y: flash.y, width: 120, height: 120, fill: '#ffffff', fillAlpha: 1, strokeWidth: 0, glow: 60, glowColor: C, blend: 'lighter',
  }, { scale: [k(0.95, 0.1, 'expoOut'), k(1.1, 1.6), k(1.45, 0.2)], opacity: [k(0.95, 1), k(1.45, 0)] }));
  layers.push(L('shape', 'Shockwave', 1.0, 1.9, {
    kind: 'circle', x: flash.x, y: flash.y, width: 200, height: 200, fillAlpha: 0, stroke: C, strokeWidth: 5, glow: 24, glowColor: C, blend: 'lighter',
  }, { scale: [k(1.0, 0.2, 'expoOut'), k(1.9, 4.5)], opacity: [k(1.0, 1), k(1.9, 0)] }));
  layers.push(L('particles', 'Quantum warp', 0, 1.6, {
    kind: 'warp', x: flash.x, y: flash.y, width: 1920, height: 1080, count: multi ? 160 : 120, color: '#d4f6ff', size: 3, speed: type === 'raid' ? 1.8 : 1.3, blend: 'lighter', seed: 3,
  }, { intensity: [k(0, 0), k(0.3, 1), k(1.05, 1), k(1.6, 0)] }));

  return {
    enabled: true,
    duration: D,
    offset: { x: 0, y: 0, scale: 1 },
    sound: { synth: th.synth, asset: null, volume: 1, delay: 0 },
    layers,
  };
}

function makeProject(RT) {
  const alerts = {};
  for (const a of RT.ALERT_TYPES) alerts[a.id] = makeTemplate(RT, a.id);
  return {
    version: 1,
    templateVersion: TEMPLATE_VERSION,
    width: 1920,
    height: 1080,
    assets: {
      dog1: { type: 'image', name: 'Dog 1', data: null, crew: true },
      dog2: { type: 'image', name: 'Dog 2', data: null, crew: true },
      dog3: { type: 'image', name: 'Dog 3', data: null, crew: true },
    },
    alerts,
    settings: { channel: '', token: '', clientId: '', volume: 0.8, gap: 1, testOnLoad: false, chatTest: true },
  };
}
