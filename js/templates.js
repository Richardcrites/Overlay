/*
 * Built-in "Quantum Paws" templates: Star Citizen-style HUD alerts starring the three dogs.
 * Each alert type gets its own color, headline and crew line-up.
 */
// Text supports {variables} and plurals: {bits:bit|bits} reads "bit" when bits is 1.
const TEMPLATE_VERSION = 7;
const THEMES = {
  follow: { color: '#3fd8ff', dogs: ['dog1'], emote: 'wink', header: 'NEW RECRUIT', title: '{user}', sub: 'just joined the pack. Welcome aboard!', synth: 'chirp' },
  sub: { color: '#ffc94a', dogs: ['dog2'], emote: 'pog', header: 'WELCOME TO THE BIG DOGS', title: '{user}', sub: 'just subscribed  \u2022  {tier}', synth: 'quantum' },
  resub: { color: '#ff9f43', dogs: ['dog2'], emote: 'love', header: 'STILL ONE OF THE BIG DOGS', title: '{user}', sub: 'subscribed for {months} {months:month|months}!', message: '{message}', synth: 'quantum' },
  giftsub: { color: '#5cffb0', dogs: ['dog3'], emote: 'happy', header: 'GIFT INCOMING', title: '{user}', sub: 'gifted a sub to {recipient}!', synth: 'chirp' },
  giftbomb: { color: '#ff5ce1', dogs: ['dog1', 'dog2', 'dog3'], emote: 'pog', header: 'SUPPLY DROP', title: '{user}', sub: 'gifted {count} {count:sub|subs} to the pack!', synth: 'quantum' },
  cheer: { color: '#b07bff', dogs: ['dog1'], emote: 'wink', header: 'BITS INCOMING', title: '{user}', sub: 'cheered {bits} {bits:bit|bits}. Thank you!', message: '{message}', synth: 'hail' },
  raid: { color: '#ff4a5a', dogs: ['dog1', 'dog2', 'dog3'], emote: 'cool', helmet: true, header: 'RAID INCOMING', title: '{user}', sub: "brought {viewers} {viewers:pilot|pilots}. Let's throw some ass!", synth: 'alarm' },
};

const PINK = '#e8405a';
// What the dog "says" for each alert. [c=...]...[/c] colours a word; {x:one|many} picks singular or plural.
const BUBBLE_TEXT = {
  follow: '[c=' + PINK + ']{user}[/c] just followed!',
  sub: '[c=' + PINK + ']{user}[/c] subscribed! Welcome to the Big Dogs!',
  resub: '[c=' + PINK + ']{user}[/c] resubbed for {months} {months:month|months}!',
  primesub: '[c=' + PINK + ']{user}[/c] subbed with Bezo\'s Bucks!',
  giftsub: '[c=' + PINK + ']{user}[/c] gifted a sub to {recipient}!',
  giftbomb: '[c=' + PINK + ']{user}[/c] gifted {count} {count:sub|subs}!',
  cheer: '[c=' + PINK + ']{user}[/c] cheered {bits} {bits:bit|bits}!',
  tip: '[c=' + PINK + ']{user}[/c] donated {amount}!',
  redeem: '[c=' + PINK + ']{user}[/c] used {reward}!',
  raid: '[c=' + PINK + ']{user}[/c] is raiding! Let\'s throw some ass!',
};
const HAS_MESSAGE = { resub: true, primesub: true, cheer: true, tip: true, redeem: true };
// The sound bites each alert plays (from the user's old StreamElements alerts), in sounds/.
const DEFAULT_SOUND = { follow: 'snd_follower', sub: 'snd_sub', resub: 'snd_sub', primesub: 'snd_sub', giftsub: 'snd_sub', giftbomb: 'snd_sub', cheer: 'snd_bits', tip: 'snd_donation', raid: 'snd_raid' };
const TEMPLATE_STYLES = [['video', 'Typing dog video (standard)'], ['doodle', 'Cartoon doodle dog'], ['hud', 'Star Citizen HUD']];

function layerMaker(RT) {
  return (ltype, name, inP, outP, props, keys) => {
    const l = RT.makeLayer(ltype, name, props, { inPoint: inP, outPoint: outP });
    l.keys = {};
    for (const key in keys || {}) if (keys[key].length) l.keys[key] = keys[key];
    return l;
  };
}
const kf = (t, v, e) => ({ t, v, e: e || 'easeOut' });

// The cartoon dog pops up in the corner and "says" it in a hand-drawn bubble.
function makeDoodleTemplate(RT, type) {
  const D = 6, k = kf, L = layerMaker(RT), INK = '#15100c';
  const pop = (t0, t1) => [k(t0, 0, 'backOut'), k(t0 + 0.3, 1, 'linear'), k(t1 - 0.25, 1, 'backIn'), k(t1, 0)];
  const layers = [];
  if (HAS_MESSAGE[type]) {
    layers.push(L('text', 'Message', 1.45, D - 0.45, {
      text: '{message}', font: 'Patrick Hand', size: 30, weight: '400', color: INK, x: 830, y: 862, align: 'center', fit: 500,
      animator: 'fadeUp', stagger: 0.03, onlyIf: 'message',
    }, { progress: [k(1.45, 0, 'linear'), k(2.3, 1)], scale: pop(1.35, D - 0.45) }));
    layers.push(L('shape', 'Message bubble', 1.35, D - 0.45, {
      kind: 'bubble', tail: 'none', x: 830, y: 862, width: 560, height: 62, fill: '#ffffff', fillAlpha: 1, stroke: INK, strokeWidth: 4, wobble: 1, onlyIf: 'message',
    }, { scale: pop(1.35, D - 0.45) }));
  }
  layers.push(L('text', 'Bubble text', 0.75, D - 0.6, {
    text: BUBBLE_TEXT[type], font: 'Patrick Hand', size: 54, weight: '400', color: INK, x: 720, y: 728, align: 'center', fit: 590, wrap: 600, fitHeight: 104,
    animator: 'pop', stagger: 0.05,
  }, { progress: [k(0.75, 0, 'linear'), k(1.55, 1)], scale: pop(0.62, D - 0.6), rotation: [k(0.62, -6, 'backOut'), k(1.0, -2)] }));
  layers.push(L('shape', 'Speech bubble', 0.62, D - 0.6, {
    kind: 'bubble', tail: 'left', x: 720, y: 728, width: 660, height: 118, fill: '#ffffff', fillAlpha: 1, stroke: INK, strokeWidth: 5, wobble: 1,
  }, { scale: pop(0.62, D - 0.6), rotation: [k(0.62, -6, 'backOut'), k(1.0, -2)] }));
  layers.push(L('mascot', 'Cartoon dog', 0, D, {
    x: 235, y: 885, width: 300, height: 510, motionBlur: true, pose: type === 'raid' || type === 'giftbomb' ? 'excited' : 'idle',
  }, {
    y: [k(0, 1420, 'backOut'), k(0.5, 885, 'linear'), k(D - 0.55, 885, 'backIn'), k(D - 0.05, 1450)],
    rotation: [k(0, -10, 'backOut'), k(0.6, 0)],
    talk: [k(0.7, 0, 'linear'), k(0.8, 1, 'linear'), k(2.1, 1, 'linear'), k(2.25, 0)],
  }));
  layers.push(L('particles', 'Floating paws', 0.6, D - 0.3, {
    kind: 'paws', x: 360, y: 760, width: 420, height: 420, count: 10, color: PINK, size: 4, speed: 1.2, seed: 5,
  }, { intensity: [k(0.6, 0), k(1.2, 0.8), k(D - 1, 0.8), k(D - 0.3, 0)] }));
  return { enabled: true, duration: D, offset: { x: 0, y: 0, scale: 1 }, sound: { synth: 'boing', asset: null, volume: 1, delay: 0 }, layers, style: 'doodle' };
}

// Where the speech bubble is in each frame of the typing dog video: [frame (24 fps), centre x, centre y, width, height],
// in video pixels (1280 x 720). The words follow it as it pops in, wiggles and pops out.
const TYPING_DOG_BUBBLE = [[23, 296.5, 171.5, 183, 55], [24, 266.5, 143.5, 297, 87], [25, 251.0, 129.0, 356, 106], [26, 241.0, 120.0, 394, 116], [27, 235.0, 114.0, 416, 124], [28, 231.0, 111.0, 430, 128], [29, 229.5, 109.5, 435, 129], [30, 229.5, 109.0, 435, 130], [31, 231.0, 110.0, 430, 128], [32, 233.0, 112.5, 422, 125], [33, 236.0, 115.0, 412, 122], [34, 238.5, 117.5, 403, 119], [35, 240.5, 119.5, 395, 117], [36, 241.0, 120.0, 392, 116], [37, 241.0, 120.0, 392, 116], [38, 241.0, 120.0, 392, 116], [39, 241.0, 120.0, 392, 116], [40, 241.0, 120.0, 392, 116], [41, 241.0, 120.0, 392, 116], [42, 241.0, 120.0, 392, 116], [43, 241.0, 120.0, 392, 116], [44, 241.0, 120.0, 392, 116], [45, 241.0, 120.0, 392, 116], [46, 241.0, 120.0, 392, 116], [47, 241.0, 120.0, 392, 116], [48, 241.0, 120.0, 392, 116], [49, 241.0, 120.0, 392, 116], [50, 241.0, 120.0, 392, 116], [51, 241.0, 120.0, 392, 116], [52, 241.0, 120.0, 392, 116], [53, 241.0, 120.0, 392, 116], [54, 241.0, 120.0, 392, 116], [55, 241.0, 120.0, 392, 116], [56, 241.0, 120.0, 392, 116], [57, 241.0, 120.0, 392, 116], [58, 241.0, 120.0, 392, 116], [59, 241.0, 120.0, 392, 116], [60, 241.0, 120.0, 392, 116], [61, 241.0, 120.0, 392, 116], [62, 241.0, 120.0, 392, 116], [63, 241.0, 120.0, 392, 116], [64, 241.0, 120.0, 392, 116], [65, 241.0, 120.0, 392, 116], [66, 241.0, 120.0, 392, 116], [67, 241.0, 120.0, 392, 116], [68, 241.0, 120.0, 392, 116], [69, 241.0, 120.0, 392, 116], [70, 241.0, 120.0, 392, 116], [71, 241.0, 120.0, 392, 116], [72, 241.0, 120.0, 392, 116], [73, 241.0, 120.0, 392, 116], [74, 241.0, 120.0, 392, 116], [75, 239.5, 118.5, 401, 119], [76, 237.0, 115.5, 414, 123], [77, 235.0, 113.5, 424, 125], [78, 236.0, 115.0, 418, 124], [79, 242.0, 123.0, 376, 110], [80, 256.0, 138.0, 286, 86], [81, 273.0, 157.5, 170, 51]];
// video/typing-dog-trimmed.webm: the whole typing dog scene (computer included), trimmed so he finishes typing
// (0-3.6 s of the original), then crossfades to the wink and smile (4.9-7.15 s). 5.6 s long.
// The bubble is in the first part, so its positions are unchanged.
const TYPING_DOG = { asset: 'vid_typingtrim', fps: 24, w: 1280, h: 720, bubbleW: 392, bubbleH: 116, duration: 5.6, track: TYPING_DOG_BUBBLE, cursor: true };

// video/prime-dog.webm ("Bezo's Bucks", Prime subs): the dog in a bald cap and headband, typing (0-3.2 s of the
// original), then crossfading to him looking at the camera (4.2-6.9 s). 5.6 s long. Its bubble is empty (no cursor).
const PRIME_DOG_BUBBLE = [[25, 297.0, 186.5, 115, 32], [26, 277.5, 162.5, 214, 62], [27, 261.0, 142.5, 299, 88], [28, 250.0, 128.5, 355, 106], [29, 243.0, 122.0, 385, 115], [30, 239.0, 118.0, 401, 119], [31, 236.5, 115.5, 410, 122], [32, 236.0, 115.0, 413, 123], [33, 236.5, 115.0, 412, 123], [34, 237.5, 116.5, 408, 122], [35, 238.5, 117.5, 404, 120], [36, 239.5, 118.0, 400, 119], [37, 240.5, 119.5, 396, 118], [38, 241.0, 120.0, 393, 117], [39, 241.0, 120.0, 393, 117], [40, 241.0, 120.0, 393, 117], [41, 241.0, 120.0, 393, 117], [42, 241.0, 120.0, 393, 117], [43, 241.0, 120.0, 393, 117], [44, 241.0, 120.0, 393, 117], [45, 241.0, 120.0, 393, 117], [46, 241.0, 120.0, 393, 117], [47, 241.0, 120.0, 393, 117], [48, 241.0, 120.0, 393, 117], [49, 241.0, 120.0, 393, 117], [50, 241.0, 120.0, 393, 117], [51, 241.0, 120.0, 393, 117], [52, 241.0, 120.0, 393, 117], [53, 241.0, 120.0, 393, 117], [54, 240.0, 119.0, 399, 119], [55, 238.5, 117.5, 406, 120], [56, 236.5, 116.0, 414, 123], [57, 235.5, 114.5, 420, 124], [58, 235.5, 114.5, 420, 124], [59, 237.0, 117.5, 403, 120], [60, 243.5, 125.0, 356, 105], [61, 252.0, 138.0, 281, 83], [62, 263.0, 153.0, 189, 55], [63, 273.5, 168.0, 96, 27]];
const PRIME_DOG = { asset: 'vid_prime', fps: 24, w: 1280, h: 720, bubbleW: 392, bubbleH: 116, duration: 5.6, track: PRIME_DOG_BUBBLE, cursor: false, typedBy: 1.85 };
const VIDEO_FOR = { primesub: PRIME_DOG };

// Standard: the green-screened typing dog video, with the alert's words typed into its speech bubble.
function makeVideoTemplate(RT, type) {
  const V = VIDEO_FOR[type] || TYPING_DOG, D = V.duration, k = kf, L = layerMaker(RT), INK = '#15100c';
  const layers = [];
  // Bottom-right corner: the monitor is cut off at the right of the source video, so that edge sits on the screen edge.
  const vid = L('video', 'Dog video', 0, D, { asset: V.asset, x: 1920 - V.w * 0.4, y: 1080 - V.h * 0.4, width: V.w, height: V.h, scale: 0.8 }, {
    opacity: [k(0, 0, 'linear'), k(0.2, 1, 'linear'), k(D - 0.35, 1, 'linear'), k(D, 0)],
  });
  // Follow the bubble: position/scale keys from the tracking data, in the video's own pixel space (parented to it).
  const tr = V.track;
  const tFirst = tr[0][0] / V.fps, tLast = tr[tr.length - 1][0] / V.fps;
  const track = (fn) => tr.map((f) => ({ t: Math.round(f[0] / V.fps * 1000) / 1000, v: fn(f), e: 'linear' }));
  const follow = {
    x: track((f) => f[1] - V.w / 2), y: track((f) => f[2] - V.h / 2),
    scale: track((f) => Math.round(f[3] / V.bubbleW * 1000) / 1000),
    opacity: [k(0, 0, 'hold'), k(tFirst, 1, 'hold'), k(tLast + 1 / V.fps, 0, 'hold')],
  };
  // A white patch hides the video's own blinking cursor; the words bring their own.
  const cover = L('shape', 'Cursor cover', 0, D, { kind: 'rect', anchorX: V.bubbleW / 2 - 25, width: 14, height: 56, fill: '#ffffff', fillAlpha: 1, strokeWidth: 0 },
    Object.assign({}, follow));
  const words = L('text', 'Bubble text', 0, D, {
    text: BUBBLE_TEXT[type], font: 'Patrick Hand', size: 40, weight: '400', color: INK, align: 'left', anchorX: V.bubbleW / 2 - 24,
    wrap: V.bubbleW - 48, fit: V.bubbleW - 48, fitHeight: V.bubbleH - 22,
  }, Object.assign({ reveal: [k(tFirst + 0.15, 0, 'linear'), k(V.typedBy || Math.min(tLast - 0.6, tFirst + 1.1), 1)] }, follow));
  cover.parent = vid.id;
  words.parent = vid.id;
  if (HAS_MESSAGE[type]) {
    layers.push(L('text', 'Message', 1.2, D - 0.5, {
      text: '{message}', font: 'Patrick Hand', size: 30, weight: '400', color: INK, x: 1131, y: 505, align: 'center', fit: 420, onlyIf: 'message',
      animator: 'fadeUp', stagger: 0.03,
    }, { progress: [k(1.3, 0, 'linear'), k(2.2, 1)], scale: [k(1.2, 0, 'backOut'), k(1.5, 1, 'linear'), k(D - 0.75, 1, 'backIn'), k(D - 0.5, 0)] }));
    layers.push(L('shape', 'Message bubble', 1.2, D - 0.5, {
      kind: 'bubble', tail: 'none', x: 1131, y: 505, width: 460, height: 56, fill: '#ffffff', fillAlpha: 1, stroke: INK, strokeWidth: 4, wobble: 1, onlyIf: 'message',
    }, { scale: [k(1.2, 0, 'backOut'), k(1.5, 1, 'linear'), k(D - 0.75, 1, 'backIn'), k(D - 0.5, 0)] }));
  }
  layers.push(words);
  if (V.cursor) layers.push(cover);
  layers.push(vid);
  return { enabled: true, duration: D, offset: { x: 0, y: 0, scale: 1 }, sound: { synth: 'none', asset: null, volume: 1, delay: 0 }, layers, style: 'video' };
}

// video/coin-dog.webm (Cheer): the dog at his desk as coins rain down; he looks up, grins and winks. 6 s.
// It has no speech bubble of its own, so a clean white one pops up beside his head.
const COIN_DOG = { asset: 'vid_coins', w: 1280, h: 720, duration: 6 };
function makeCoinTemplate(RT, type) {
  const V = COIN_DOG, D = V.duration, k = kf, L = layerMaker(RT), INK = '#15100c';
  const pop = (t0, t1) => [k(t0, 0, 'backOut'), k(t0 + 0.3, 1, 'linear'), k(t1 - 0.25, 1, 'backIn'), k(t1, 0)];
  // Bottom-left corner: the monitor is cut off at the left of the source video, so that edge sits on the screen edge.
  const vid = L('video', 'Dog video', 0, D, { asset: V.asset, x: V.w * 0.4, y: 1080 - V.h * 0.4, width: V.w, height: V.h, scale: 0.8 }, {
    opacity: [k(0, 0, 'linear'), k(0.2, 1, 'linear'), k(D - 0.35, 1, 'linear'), k(D, 0)],
  });
  // In the video's own pixels, centred on it (parented): up and to the right of his head.
  const bubble = L('shape', 'Speech bubble', 0.45, D - 0.45, {
    kind: 'bubble', tail: 'left', x: 330, y: -235, width: 470, height: 132, fill: '#ffffff', fillAlpha: 1, stroke: INK, strokeWidth: 4, wobble: 0.3,
  }, { scale: pop(0.45, D - 0.45) });
  const words = L('text', 'Bubble text', 0.45, D - 0.45, {
    text: BUBBLE_TEXT[type], font: 'Patrick Hand', size: 42, weight: '400', color: INK, x: 330, y: -235, align: 'center',
    wrap: 420, fit: 420, fitHeight: 104,
  }, { reveal: [k(0.65, 0, 'linear'), k(1.55, 1)], scale: pop(0.45, D - 0.45) });
  bubble.parent = vid.id;
  words.parent = vid.id;
  const layers = [];
  if (HAS_MESSAGE[type]) {
    layers.push(L('text', 'Message', 1.2, D - 0.5, {
      text: '{message}', font: 'Patrick Hand', size: 30, weight: '400', color: INK, x: 790, y: 492, align: 'center', fit: 420, onlyIf: 'message',
      animator: 'fadeUp', stagger: 0.03,
    }, { progress: [k(1.3, 0, 'linear'), k(2.2, 1)], scale: pop(1.2, D - 0.5) }));
    layers.push(L('shape', 'Message bubble', 1.2, D - 0.5, {
      kind: 'bubble', tail: 'none', x: 790, y: 492, width: 460, height: 56, fill: '#ffffff', fillAlpha: 1, stroke: INK, strokeWidth: 4, wobble: 0.3, onlyIf: 'message',
    }, { scale: pop(1.2, D - 0.5) }));
  }
  layers.push(words, bubble, vid);
  return { enabled: true, duration: D, offset: { x: 0, y: 0, scale: 1 }, sound: { synth: 'none', asset: null, volume: 1, delay: 0 }, layers, style: 'video' };
}

function makeTemplate(RT, type, style) {
  const al = buildTemplate(RT, type, style);
  if (DEFAULT_SOUND[type]) al.sound.asset = DEFAULT_SOUND[type];
  return al;
}

function buildTemplate(RT, type, style) {
  style = style || 'video';
  if (style === 'video') return type === 'cheer' ? makeCoinTemplate(RT, type) : makeVideoTemplate(RT, type);
  if (style === 'doodle' || !THEMES[type]) return makeDoodleTemplate(RT, type);
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
  const wiggle = (l, prop, f, a, sd) => { l.wiggle = l.wiggle || {}; l.wiggle[prop] = { f, a, s: sd }; return l; };
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
      x: P.x, y: P.y + P.h / 2 + 46, align: 'center', wrap: 780, outline: 2, outlineColor: '#02060c', animator: 'fadeUp', stagger: 0.03,
    }, { progress: [k(2.6, 0, 'linear'), k(3.5, 1)], opacity: fadeOut(D - 0.9, D - 0.5) }));
  }
  layers.push(L('text', 'Subtitle', 2.2, D - 0.4, {
    text: th.sub, font: 'Rajdhani', size: multi ? 30 : 31, weight: '600', color: '#e3f6ff', x: TX, y: ty.s, align, fit: FIT, animator: 'fadeUp', stagger: 0.06,
  }, { progress: [k(2.2, 0, 'linear'), k(3.0, 1)], opacity: fadeOut(D - 0.9, D - 0.5) }));
  layers.push(L('text', 'Name', 1.9, D - 0.4, {
    text: th.title, font: 'Orbitron', size: multi ? 56 : 60, weight: '900', color: '#ffffff', x: TX, y: ty.t, align, fit: FIT, glow: 22, glowColor: C,
    animator: 'decode', stagger: 0.12, gradient: true, color2: C, motionBlur: true, sweepWidth: 110,
  }, {
    opacity: [k(1.9, 0), k(2.2, 1), ...fadeOut(D - 0.9, D - 0.5)],
    progress: [k(1.9, 0, 'linear'), k(2.75, 1)],
    x: multi ? [] : [{ t: 1.9, v: TX + 70, e: 'bezier', b: [0.15, 0.9, 0.2, 1] }, k(2.4, TX)],
    tracking: [k(1.9, 24, 'expoOut'), k(2.6, 3)],
    sweep: [k(3.1, 0, 'easeInOut'), k(3.75, 1)],
  }));
  layers.push(L('text', 'Header', 1.7, D - 0.4, {
    text: th.header, font: 'Share Tech Mono', size: 24, weight: '400', color: C, x: TX, y: ty.h, align, fit: FIT, tracking: 5, glow: 10, glowColor: C,
    animator: 'decode', stagger: 0.05,
  }, { progress: [k(1.7, 0, 'linear'), k(2.3, 1)], opacity: fadeOut(D - 0.9, D - 0.5) }));

  // ---- animated cartoon dog emote, peeking over the panel's top-right corner
  const E = multi ? { x: P.x + P.w / 2 - 10, y: P.y - P.h / 2 - 14, s: 165 } : { x: P.x + P.w / 2 - 25, y: P.y - P.h / 2 - 22, s: 185 };
  layers.push(L('emote', 'Dog emote', 2.3, D - 0.4, {
    expression: th.emote, helmet: !!th.helmet, accent: C, x: E.x, y: E.y, width: E.s, height: E.s, glow: 18, glowColor: C, motionBlur: true,
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
      motionBlur: true, sweepWidth: 70,
    }, {
      sweep: [k(2.0 + i * 0.12, 0, 'easeInOut'), k(2.6 + i * 0.12, 1)],
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
  layers.push(wiggle(L('shape', 'Brackets', 1.5, D - 0.3, {
    kind: 'brackets', x: P.x, y: P.y, width: P.w + 44, height: P.h + 44, stroke: C, strokeWidth: 3, glow: 10, glowColor: C, motionBlur: true,
  }, { scale: [k(1.5, 1.35, 'expoOut'), k(2.0, 1)], opacity: [k(1.5, 0), k(1.8, 1), ...fadeOut(D - 0.9, D - 0.55)] }), 'opacity', 7, 0.18, 11));
  layers.push(L('shape', 'HUD panel', 1.1, D - 0.2, {
    kind: 'panel', x: P.x, y: P.y, width: P.w, height: P.h, fill: '#04101d', fillAlpha: 0.84, stroke: C, strokeWidth: 2, glow: 18, glowColor: C,
    motionBlur: true, sweepColor: C, sweepWidth: 260,
  }, {
    glitch: [k(1.1, 0.9, 'easeOut'), k(1.55, 0, 'linear'), k(D - 0.85, 0, 'easeIn'), k(D - 0.65, 0.75, 'easeOut'), k(D - 0.35, 0)],
    sweep: [k(2.35, 0, 'easeInOut'), k(3.2, 1)],
    width: [k(1.1, 0, 'expoOut'), k(1.5, P.w), k(D - 0.6, P.w, 'easeIn'), k(D - 0.2, 0)],
    height: [k(1.35, 4, 'expoOut'), k(1.75, P.h), k(D - 0.85, P.h, 'easeIn'), k(D - 0.6, 4)],
  }));
  layers.push(L('particles', 'Paw prints', 2.0, D, {
    kind: 'paws', x: P.x, y: P.y - 20, width: P.w + 120, height: 420, count: 16, color: C, size: 4, speed: 1, seed: 7,
  }, { intensity: [k(2.0, 0), k(2.8, 0.7), k(D - 1, 0.7), k(D, 0)] }));

  // ---- quantum arrival / departure
  layers.push(L('shape', 'Jump-out streak', D - 0.55, D, {
    kind: 'line', x: P.x, y: P.y, width: 0, height: 6, stroke: '#ffffff', strokeWidth: 4, glow: 30, glowColor: C, blend: 'lighter', motionBlur: true,
  }, { width: [k(D - 0.55, 0, 'expoOut'), k(D - 0.25, 1500)], opacity: [k(D - 0.4, 1), k(D, 0)] }));
  layers.push(L('shape', 'Arrival flash', 0.95, 1.45, {
    kind: 'circle', x: flash.x, y: flash.y, width: 120, height: 120, fill: '#ffffff', fillAlpha: 1, strokeWidth: 0, glow: 60, glowColor: C, blend: 'lighter',
  }, { scale: [k(0.95, 0.1, 'expoOut'), k(1.1, 1.6), k(1.45, 0.2)], opacity: [k(0.95, 1), k(1.45, 0)] }));
  layers.push(L('shape', 'Shockwave', 1.0, 1.9, {
    kind: 'circle', x: flash.x, y: flash.y, width: 200, height: 200, fillAlpha: 0, stroke: C, strokeWidth: 5, glow: 24, glowColor: C, blend: 'lighter', motionBlur: true,
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
    style: 'hud',
  };
}

function makeProject(RT) {
  const alerts = {};
  for (const a of RT.ALERT_TYPES) alerts[a.id] = makeTemplate(RT, a.id);
  alerts.redeem.enabled = false; // reward redemptions are announced elsewhere; tick Enabled to use it
  return {
    version: 1,
    redeemOff: true,
    cheerCoins: true,
    templateVersion: TEMPLATE_VERSION,
    soundsDone: Object.keys(DEFAULT_SOUND),
    width: 1920,
    height: 1080,
    assets: {
      dog1: { type: 'image', name: 'Dog 1', data: null, crew: true },
      dog2: { type: 'image', name: 'Dog 2', data: null, crew: true },
      dog3: { type: 'image', name: 'Dog 3', data: null, crew: true },
      vid_typingtrim: { type: 'video', name: 'Typing dog', data: null, builtin: 'video/typing-dog-trimmed.webm' },
      vid_coins: { type: 'video', name: 'Coin rain dog', data: null, builtin: 'video/coin-dog.webm' },
      vid_prime: { type: 'video', name: "Bezo's Bucks dog", data: null, builtin: 'video/prime-dog.webm' },
      snd_follower: { type: 'sound', name: 'Follower', data: null, builtin: 'sounds/follower.mp3' },
      snd_sub: { type: 'sound', name: 'Sub', data: null, builtin: 'sounds/sub.ogg' },
      snd_bits: { type: 'sound', name: 'Bits', data: null, builtin: 'sounds/bits.mp3' },
      snd_donation: { type: 'sound', name: 'Donation', data: null, builtin: 'sounds/donation.mp3' },
      snd_raid: { type: 'sound', name: 'Raid', data: null, builtin: 'sounds/raid.mp3' },
    },
    alerts,
    settings: { channel: '', token: '', clientId: '', volume: 0.8, gap: 1, testOnLoad: false, chatTest: true },
  };
}
