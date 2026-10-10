/* Quantum Paws Alert Studio: the After Effects-style editor. */
(function () {
  'use strict';

  const RT = OverlayRuntime();
  const W = 1920, H = 1080;
  const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Audiowide&family=Bebas+Neue&family=Exo+2:ital,wght@0,400;0,600;0,700;0,900;1,600&family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@400;600;700&family=Russo+One&family=Share+Tech+Mono&display=swap';
  const TYPE_ICON = { image: '\u{1F415}', text: 'T', shape: '▢', particles: '✨' };

  // ---------------------------------------------------------------- helpers
  const $ = (s, r) => (r || document).querySelector(s);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k in n && k !== 'list') n[k] = v;
      else n.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const snapT = (t) => Math.round(t * 100) / 100;
  const round = (v) => Math.round(v * 1000) / 1000;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2600);
  }
  const readDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

  // ---------------------------------------------------------------- storage (IndexedDB, falls back to memory)
  let dbp = null;
  function idb() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('quantum-paws', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function idbGet(k) {
    const db = await idb();
    return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  }
  async function idbSet(k, v) {
    const db = await idb();
    return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => idbSet('project', JSON.stringify(P)).catch((e) => console.warn('save failed', e)), 400);
  }

  // ---------------------------------------------------------------- state
  let P = null; // the project
  const S = {
    type: 'follow', sel: null, selKey: null, time: 0, playing: false, expanded: new Set(),
    vars: clone(RT.SAMPLE_VARS), dirty: true, bg: 'space', stopSound: null,
  };
  let images = {};
  const alertObj = () => P.alerts[S.type];
  const dur = () => alertObj().duration;
  const selLayer = () => (S.sel ? alertObj().layers.find((l) => l.id === S.sel) : null);
  const markDirty = () => { S.dirty = true; };

  function normalize(p) {
    const base = makeProject(RT);
    p.assets = p.assets || {};
    for (const id of ['dog1', 'dog2', 'dog3']) if (!p.assets[id]) p.assets[id] = base.assets[id];
    p.alerts = p.alerts || {};
    for (const a of RT.ALERT_TYPES) {
      if (!p.alerts[a.id]) p.alerts[a.id] = base.alerts[a.id];
      const al = p.alerts[a.id];
      al.offset = al.offset || { x: 0, y: 0, scale: 1 };
      al.sound = al.sound || { synth: 'none', asset: null, volume: 1, delay: 0 };
      for (const l of al.layers) { l.keys = l.keys || {}; l.props = Object.assign(RT.makeLayer(l.type).props, l.props); }
    }
    p.settings = Object.assign({}, base.settings, p.settings || {});
    p.width = W; p.height = H;
    return p;
  }

  function refreshImages() {
    const r = RT.loadImages(P.assets, images);
    images = r.cache;
    r.ready.then(markDirty);
  }
  function assetNames() {
    const o = {};
    for (const id in P.assets) o[id] = P.assets[id].name;
    return o;
  }

  // ---------------------------------------------------------------- history
  const hist = { stack: [], i: -1 };
  const snap = () => JSON.stringify({ alerts: P.alerts, settings: P.settings });
  function resetHistory() { hist.stack = [snap()]; hist.i = 0; }
  function commit() {
    const s = snap();
    if (s !== hist.stack[hist.i]) {
      hist.stack = hist.stack.slice(0, hist.i + 1);
      hist.stack.push(s);
      if (hist.stack.length > 100) hist.stack.shift();
      hist.i = hist.stack.length - 1;
      scheduleSave();
    }
    renderMain();
  }
  function restore(i) {
    hist.i = i;
    const o = JSON.parse(hist.stack[i]);
    P.alerts = o.alerts;
    P.settings = o.settings;
    if (!selLayer()) S.sel = null;
    S.selKey = null;
    scheduleSave();
    renderMain();
  }
  const undo = () => hist.i > 0 && restore(hist.i - 1);
  const redo = () => hist.i < hist.stack.length - 1 && restore(hist.i + 1);

  // ---------------------------------------------------------------- property editing (auto-keyframing like AE)
  function setProp(layer, key, val) {
    const f = RT.fieldDef(layer.type, key);
    if (f && f.anim && layer.keys[key] && layer.keys[key].length) upsertKey(layer, key, snapT(S.time), val);
    else layer.props[key] = val;
  }
  function upsertKey(layer, key, t, v, e) {
    const ks = layer.keys[key] || (layer.keys[key] = []);
    const ex = ks.find((k) => Math.abs(k.t - t) < 0.005);
    if (ex) ex.v = v;
    else { ks.push({ t, v, e: e || 'easeOut' }); ks.sort((a, b) => a.t - b.t); }
  }
  function keyAt(layer, key, t) {
    const ks = layer.keys[key];
    return ks ? ks.findIndex((k) => Math.abs(k.t - t) < 0.005) : -1;
  }
  function toggleStopwatch(layer, key) {
    const ks = layer.keys[key];
    if (ks && ks.length) {
      layer.props[key] = RT.evalProp(layer, key, S.time);
      delete layer.keys[key];
      if (S.selKey && S.selKey.layerId === layer.id && S.selKey.prop === key) S.selKey = null;
    } else {
      layer.keys[key] = [{ t: snapT(S.time), v: layer.props[key], e: 'easeOut' }];
      S.expanded.add(layer.id);
    }
    commit();
  }
  function toggleKeyHere(layer, key) {
    const i = keyAt(layer, key, S.time);
    if (i >= 0) {
      const v = RT.evalProp(layer, key, S.time);
      layer.keys[key].splice(i, 1);
      if (!layer.keys[key].length) { delete layer.keys[key]; layer.props[key] = v; }
    } else upsertKey(layer, key, snapT(S.time), RT.evalProp(layer, key, S.time));
    commit();
  }
  function jumpKey(layer, key, dir) {
    const ks = layer.keys[key] || [];
    const cand = dir < 0 ? ks.filter((k) => k.t < S.time - 0.004).pop() : ks.find((k) => k.t > S.time + 0.004);
    if (cand) setTime(cand.t);
  }
  function allKeyTimes(layer) {
    const set = new Set();
    for (const k in layer.keys) for (const kf of layer.keys[k]) set.add(kf.t);
    return [...set].sort((a, b) => a - b);
  }

  // ---------------------------------------------------------------- time & playback
  function setTime(t) {
    S.time = clamp(t, 0, dur());
    markDirty();
    updateTimeUI();
  }
  function play() {
    if (S.playing) return;
    if (S.time >= dur() - 0.02) S.time = 0;
    S.playing = true;
    startSound();
    $('#btnPlay').innerHTML = '&#x23F8;';
  }
  function pause() {
    S.playing = false;
    stopSound();
    $('#btnPlay').innerHTML = '&#x25B6;';
    updateTimeUI();
  }
  function startSound() {
    stopSound();
    if ($('#chkSound').checked && S.time < 0.15) S.stopSound = RT.playSound(alertObj().sound, P.assets, P.settings.volume, S.time);
  }
  function stopSound() { if (S.stopSound) { S.stopSound(); S.stopSound = null; } }

  function updateTimeUI() {
    $('#timeDisplay').textContent = S.time.toFixed(2) + 's / ' + dur().toFixed(1) + 's';
    const ph = $('#playhead');
    if (ph) ph.style.left = (S.time / dur() * 100) + '%';
    refreshInspectorValues();
  }

  // ---------------------------------------------------------------- canvas
  const cv = $('#preview');
  const ctx = cv.getContext('2d');
  const bgCache = {};
  function makeBg(kind) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const rnd = (() => { let s = 42; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    if (kind === 'checker') {
      for (let y = 0; y < H; y += 40) for (let x = 0; x < W; x += 40) { g.fillStyle = ((x + y) / 40) % 2 ? '#2a2f36' : '#1d2127'; g.fillRect(x, y, 40, 40); }
    } else if (kind === 'green') {
      g.fillStyle = '#00b140'; g.fillRect(0, 0, W, H);
    } else {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#02040a'); sky.addColorStop(1, kind === 'game' ? '#0b1a2c' : '#070d1a');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      const neb = g.createRadialGradient(W * 0.75, H * 0.3, 0, W * 0.75, H * 0.3, 700);
      neb.addColorStop(0, 'rgba(90,40,140,.35)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = neb; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.2 + rnd() * 0.8) + ')'; g.fillRect(rnd() * W, rnd() * H, rnd() * 2 + 0.5, rnd() * 2 + 0.5); }
      if (kind === 'game') {
        const pg = g.createRadialGradient(W * 0.3, H * 1.9, H * 0.9, W * 0.3, H * 1.9, H * 1.25);
        pg.addColorStop(0, '#c26a2e'); pg.addColorStop(0.85, '#5a2a14'); pg.addColorStop(0.97, 'rgba(255,170,90,.7)'); pg.addColorStop(1, 'rgba(255,170,90,0)');
        g.fillStyle = pg; g.beginPath(); g.arc(W * 0.3, H * 1.9, H * 1.25, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(80,200,255,.35)'; g.lineWidth = 2;
        g.beginPath(); g.arc(W / 2, H / 2, 46, 0, Math.PI * 2); g.moveTo(W / 2 - 70, H / 2); g.lineTo(W / 2 - 50, H / 2); g.moveTo(W / 2 + 50, H / 2); g.lineTo(W / 2 + 70, H / 2); g.stroke();
        g.fillStyle = 'rgba(80,200,255,.5)'; g.font = '22px "Share Tech Mono"';
        g.fillText('SCM 220 m/s', 120, H - 120); g.fillText('QT FUEL 87%', W - 300, H - 120);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(W - 420, H - 300, 380, 230);
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('[webcam]', W - 280, H - 180);
      }
    }
    return c;
  }

  function draw() {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    if (!bgCache[S.bg]) bgCache[S.bg] = makeBg(S.bg);
    ctx.drawImage(bgCache[S.bg], 0, 0);
    ctx.restore();
    const al = alertObj();
    RT.render(ctx, al, S.time, { width: W, height: H, images, assetNames: assetNames(), vars: S.vars[S.type] });
    drawSelection(al);
  }

  function drawSelection(al) {
    const L = selLayer();
    if (!L || !RT.layerActive(L, S.time) || S.playing) return;
    const b = RT.layerBounds(ctx, L, S.time, S.vars[S.type]);
    const v = b.v;
    ctx.save();
    RT.applyAlertTransform(ctx, al, W, H);
    ctx.translate(v.x, v.y);
    ctx.rotate(v.rotation * Math.PI / 180);
    const sc = Math.abs(v.scale) < 1e-3 ? 1e-3 : v.scale;
    ctx.scale(sc, sc);
    const lw = 2 / Math.abs(sc) / ((al.offset && al.offset.scale) || 1);
    ctx.lineWidth = lw;
    ctx.setLineDash([8 * lw, 6 * lw]);
    ctx.strokeStyle = '#ffc94a';
    ctx.strokeRect(b.x - 4 * lw, b.y - 4 * lw, b.w + 8 * lw, b.h + 8 * lw);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(-10 * lw, 0); ctx.lineTo(10 * lw, 0); ctx.moveTo(0, -10 * lw); ctx.lineTo(0, 10 * lw);
    ctx.stroke();
    ctx.restore();
  }

  function canvasPoint(e) {
    const r = cv.getBoundingClientRect();
    const px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height;
    const o = alertObj().offset || { x: 0, y: 0, scale: 1 };
    const s = o.scale || 1;
    return { x: (px - W / 2 - (o.x || 0)) / s + W / 2, y: (py - H / 2 - (o.y || 0)) / s + H / 2, s };
  }
  function hitTest(pt) {
    for (const L of alertObj().layers) {
      if (L.locked || !RT.layerActive(L, S.time)) continue;
      if (L.type === 'particles' && L.id !== S.sel) continue;
      const b = RT.layerBounds(ctx, L, S.time, S.vars[S.type]);
      const v = b.v;
      if (Math.abs(v.scale) < 1e-3 || v.opacity <= 0) continue;
      const a = -v.rotation * Math.PI / 180;
      const dx = pt.x - v.x, dy = pt.y - v.y;
      const lx = (dx * Math.cos(a) - dy * Math.sin(a)) / v.scale, ly = (dx * Math.sin(a) + dy * Math.cos(a)) / v.scale;
      const pad = 8 / Math.abs(v.scale);
      if (lx >= b.x - pad && lx <= b.x + b.w + pad && ly >= b.y - pad && ly <= b.y + b.h + pad) return L;
    }
    return null;
  }

  cv.addEventListener('pointerdown', (e) => {
    if (S.playing) pause();
    const pt = canvasPoint(e);
    const L = hitTest(pt);
    selectLayer(L ? L.id : null);
    if (!L || L.locked) return;
    const ox = RT.evalProp(L, 'x', S.time), oy = RT.evalProp(L, 'y', S.time);
    let moved = false;
    cv.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const p = canvasPoint(ev);
      let nx = ox + (p.x - pt.x), ny = oy + (p.y - pt.y);
      if (ev.shiftKey) { if (Math.abs(nx - ox) > Math.abs(ny - oy)) ny = oy; else nx = ox; }
      setProp(L, 'x', Math.round(nx));
      setProp(L, 'y', Math.round(ny));
      moved = true;
      markDirty();
      refreshInspectorValues();
    };
    const up = () => {
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      if (moved) commit();
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    cv.classList.toggle('grab', !!hitTest(canvasPoint(e)));
  });

  // ---------------------------------------------------------------- selection
  function selectLayer(id) {
    if (S.sel === id) return;
    S.sel = id;
    if (!id || (S.selKey && S.selKey.layerId !== id)) S.selKey = null;
    markDirty();
    renderInspector();
    renderTimeline();
  }

  // ---------------------------------------------------------------- top bar
  function renderTabs() {
    const nav = $('#alertTabs');
    nav.innerHTML = '';
    for (const a of RT.ALERT_TYPES) {
      const al = P.alerts[a.id];
      const accent = (al.layers.find((l) => l.type === 'image') || {}).props;
      nav.append(el('button', {
        class: (a.id === S.type ? 'active ' : '') + (al.enabled ? '' : 'off'),
        title: al.enabled ? a.label + ' alert' : a.label + ' alert (disabled)',
        onclick: () => switchType(a.id),
      }, el('span', { class: 'dot', style: 'background:' + ((accent && accent.borderColor) || '#3fd8ff') }), a.label));
    }
  }
  function switchType(id) {
    if (S.playing) pause();
    S.type = id;
    S.sel = null;
    S.selKey = null;
    S.time = Math.min(S.time, dur());
    renderMain();
  }

  // ---------------------------------------------------------------- left panel: crew, library, settings, preview vars
  async function importImage(file, assetId) {
    if (!file || !file.type.startsWith('image/')) { toast('That file is not an image'); return; }
    let data = await readDataUrl(file);
    const img = await loadImg(data);
    const max = 1024;
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    if (s < 1 || file.size > 1.5e6) {
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      data = /png|webp|gif/.test(file.type) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
    }
    if (!assetId) {
      assetId = RT.uid('img');
      P.assets[assetId] = { type: 'image', name: file.name.replace(/\.[^.]+$/, '').slice(0, 30), data };
    } else P.assets[assetId].data = data;
    refreshImages();
    scheduleSave();
    renderAssets();
    renderInspector();
    toast('Image added');
    return assetId;
  }
  async function importSound(file) {
    if (!file || !file.type.startsWith('audio/')) { toast('That file is not an audio file'); return; }
    if (file.size > 3e6) toast('Big sound file: short clips (under 5 s) keep the overlay light', 4000);
    const data = await readDataUrl(file);
    const id = RT.uid('snd');
    P.assets[id] = { type: 'sound', name: file.name.replace(/\.[^.]+$/, '').slice(0, 30), data };
    scheduleSave();
    renderAssets();
    renderAlertSettings();
    toast('Sound added. Pick it under Alert settings.');
    return id;
  }
  function pickFile(input) {
    return new Promise((res) => {
      input.value = '';
      input.onchange = () => res(input.files[0]);
      input.click();
    });
  }

  function renderAssets() {
    const crew = $('#crew');
    crew.innerHTML = '';
    for (const id of ['dog1', 'dog2', 'dog3']) {
      const a = P.assets[id];
      const thumb = el('div', {
        class: 'thumb' + (a.data ? ' has' : ''), title: 'Click or drop a photo of this dog',
        style: a.data ? 'background-image:url(' + a.data + ')' : '',
        onclick: async () => { const f = await pickFile($('#fileImage')); if (f) importImage(f, id); },
      }, '\u{1F43E}');
      thumb.addEventListener('dragover', (e) => { e.preventDefault(); thumb.classList.add('drag'); });
      thumb.addEventListener('dragleave', () => thumb.classList.remove('drag'));
      thumb.addEventListener('drop', (e) => { e.preventDefault(); thumb.classList.remove('drag'); importImage(e.dataTransfer.files[0], id); });
      crew.append(el('div', { class: 'crew-card' }, thumb, el('div', { class: 'meta' },
        el('input', {
          value: a.name, placeholder: 'Dog name', maxLength: 30,
          oninput: (e) => { a.name = e.target.value; markDirty(); scheduleSave(); },
          onchange: () => renderInspector(),
        }),
        el('div', { class: 'row' },
          el('button', { onclick: async () => { const f = await pickFile($('#fileImage')); if (f) importImage(f, id); } }, a.data ? 'Replace' : 'Upload photo'),
          a.data ? el('button', { class: 'danger', onclick: () => { a.data = null; refreshImages(); scheduleSave(); renderAssets(); } }, 'Clear') : null,
        ),
      )));
    }
    const lib = $('#library');
    lib.innerHTML = '';
    const ids = Object.keys(P.assets).filter((id) => !P.assets[id].crew);
    if (!ids.length) lib.append(el('div', { class: 'muted small' }, 'Logos, ship renders, bark recordings... add them here.'));
    for (const id of ids) {
      const a = P.assets[id];
      lib.append(el('div', { class: 'lib-item' },
        a.type === 'image' ? el('img', { src: a.data, alt: '' }) : el('button', { class: 'icon', title: 'Play', onclick: () => RT.playSound({ asset: id, synth: 'none', volume: 1 }, P.assets, P.settings.volume) }, '▶'),
        el('input', { class: 'name', value: a.name, oninput: (e) => { a.name = e.target.value; scheduleSave(); }, onchange: () => { renderInspector(); renderAlertSettings(); } }),
        el('button', {
          class: 'icon danger', title: 'Delete',
          onclick: () => {
            if (!confirm('Delete "' + a.name + '"? Layers using it will show a placeholder.')) return;
            delete P.assets[id];
            for (const k in P.alerts) if (P.alerts[k].sound.asset === id) P.alerts[k].sound.asset = null;
            refreshImages(); scheduleSave(); renderAssets(); renderMain();
          },
        }, '✕'),
      ));
    }
  }

  function field(label, input) { return el('div', { class: 'field' }, el('label', null, label), input); }
  function numInput(value, step, onset, opts) {
    opts = opts || {};
    return el('input', {
      type: 'number', value: round(value), step, min: opts.min, max: opts.max,
      oninput: (e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { onset(v); markDirty(); } },
      onchange: () => commit(),
    });
  }

  function renderAlertSettings() {
    const al = alertObj();
    const box = $('#alertSettings');
    box.innerHTML = '';
    const soundOpts = [el('option', { value: '' }, '(none)')].concat(
      Object.keys(P.assets).filter((id) => P.assets[id].type === 'sound').map((id) => el('option', { value: id, selected: al.sound.asset === id }, P.assets[id].name)));
    box.append(
      field('Enabled', el('input', { type: 'checkbox', checked: al.enabled, onchange: (e) => { al.enabled = e.target.checked; commit(); } })),
      field('Duration (s)', numInput(al.duration, 0.5, (v) => { al.duration = clamp(v, 1, 30); }, { min: 1, max: 30 })),
      field('Sound FX', el('select', { onchange: (e) => { al.sound.synth = e.target.value; commit(); } },
        Object.keys(RT.SYNTH_LABELS).map((k) => el('option', { value: k, selected: al.sound.synth === k }, RT.SYNTH_LABELS[k])))),
      field('Sound file', el('select', { onchange: (e) => { al.sound.asset = e.target.value || null; commit(); } }, soundOpts)),
      field('File delay (s)', numInput(al.sound.delay || 0, 0.1, (v) => { al.sound.delay = Math.max(0, v); }, { min: 0 })),
      field('Volume', el('input', { type: 'range', min: 0, max: 1.5, step: 0.05, value: al.sound.volume, oninput: (e) => { al.sound.volume = parseFloat(e.target.value); }, onchange: () => commit() })),
      field('Move all X', numInput(al.offset.x, 5, (v) => { al.offset.x = v; })),
      field('Move all Y', numInput(al.offset.y, 5, (v) => { al.offset.y = v; })),
      field('Scale all', numInput(al.offset.scale, 0.05, (v) => { al.offset.scale = clamp(v, 0.1, 4); }, { min: 0.1 })),
      el('div', { class: 'row' },
        el('button', { onclick: () => { RT.playSound(al.sound, P.assets, P.settings.volume); } }, '\u{1F50A} Test sound'),
        el('button', {
          onclick: () => {
            if (!confirm('Reset the ' + S.type + ' alert to the built-in Star Citizen template?')) return;
            P.alerts[S.type] = makeTemplate(RT, S.type);
            S.sel = null; S.selKey = null;
            commit();
          },
        }, 'Reset to template'),
        el('button', { title: 'Copy this design to the other alert types, keeping their own text', onclick: copyToAll }, 'Copy design to all'),
      ),
    );
  }

  function copyToAll() {
    if (!confirm('Copy this alert\'s layers, timing and sound to every other alert type?\nText layers keep each alert\'s own wording when the layer names match.')) return;
    const src = alertObj();
    for (const a of RT.ALERT_TYPES) {
      if (a.id === S.type) continue;
      const dst = P.alerts[a.id];
      const texts = {};
      for (const l of dst.layers) if (l.type === 'text') texts[l.name] = l.props.text;
      const copy = clone(src);
      for (const l of copy.layers) {
        l.id = RT.uid('l');
        if (l.type === 'text' && texts[l.name] != null) l.props.text = texts[l.name];
      }
      copy.enabled = dst.enabled;
      P.alerts[a.id] = copy;
    }
    commit();
    toast('Design copied to all alerts');
  }

  function renderVars() {
    const box = $('#previewVars');
    box.innerHTML = '';
    const meta = RT.ALERT_TYPES.find((a) => a.id === S.type);
    for (const v of meta.vars) {
      box.append(field('{' + v + '}', el('input', { value: S.vars[S.type][v], oninput: (e) => { S.vars[S.type][v] = e.target.value; markDirty(); } })));
    }
    box.append(el('div', { class: 'muted small' }, 'Use these {variables} in text layers. Real alerts fill them in live.'));
  }

  // ---------------------------------------------------------------- inspector
  function renderInspector() {
    const box = $('#inspector');
    box.innerHTML = '';
    const L = selLayer();
    if (!L) {
      box.append(el('div', { class: 'empty' },
        el('p', null, 'Select a layer on the canvas or in the timeline.'),
        el('p', { class: 'small' }, 'Tips: click the ⏱ stopwatch next to a property to animate it, move the playhead, then change the value to add another keyframe. Space plays, Ctrl+Z undoes.'),
      ));
      return;
    }
    const sec = (title, ...kids) => el('section', null, el('h3', null, title), ...kids);
    box.append(sec('Layer',
      el('div', { class: 'head' },
        el('span', { class: 'type-badge' }, L.type),
        el('input', { value: L.name, oninput: (e) => { L.name = e.target.value; }, onchange: () => commit() })),
      el('div', { class: 'row' },
        el('button', { onclick: duplicateLayer, title: 'Ctrl+D' }, 'Duplicate'),
        el('button', { onclick: () => moveLayer(-1), title: 'Bring forward' }, '↑ Up'),
        el('button', { onclick: () => moveLayer(1), title: 'Send backward' }, '↓ Down'),
        el('button', { class: 'danger', onclick: deleteLayer, title: 'Delete' }, 'Delete')),
      el('div', { class: 'prop static' }, el('span'), el('span', { class: 'lbl' }, 'Starts at (s)'), numInput(L.inPoint, 0.05, (v) => { L.inPoint = clamp(v, 0, L.outPoint - 0.05); })),
      el('div', { class: 'prop static' }, el('span'), el('span', { class: 'lbl' }, 'Ends at (s)'), numInput(L.outPoint, 0.05, (v) => { L.outPoint = Math.max(L.inPoint + 0.05, v); })),
    ));
    const fields = RT.SCHEMA[L.type];
    const commonKeys = new Set(['x', 'y', 'scale', 'rotation', 'opacity', 'blur', 'glow', 'glowColor', 'blend']);
    box.append(sec('Transform & effects', fields.filter((f) => commonKeys.has(f.key)).map((f) => propRow(L, f))));
    box.append(sec({ image: 'Image', text: 'Text', shape: 'Shape', particles: 'Particles' }[L.type], fields.filter((f) => !commonKeys.has(f.key)).map((f) => propRow(L, f))));

    const sk = S.selKey;
    if (sk && sk.layerId === L.id) {
      const props = sk.prop === '*' ? Object.keys(L.keys) : [sk.prop];
      const kfs = [];
      for (const p of props) for (const k of L.keys[p] || []) if (Math.abs(k.t - sk.t) < 0.005) kfs.push(k);
      if (kfs.length) {
        const label = sk.prop === '*' ? kfs.length + ' keyframe(s)' : RT.fieldDef(L.type, sk.prop).label;
        box.append(el('section', null, el('div', { class: 'keybox' },
          el('h4', null, '◆ ' + label + ' @ ' + sk.t.toFixed(2) + 's'),
          field('Easing to next', el('select', { onchange: (e) => { kfs.forEach((k) => { k.e = e.target.value; }); commit(); } },
            Object.keys(RT.EASE_LABELS).map((k) => el('option', { value: k, selected: kfs[0].e === k }, RT.EASE_LABELS[k])))),
          el('div', { class: 'row' },
            el('button', { class: 'danger', onclick: deleteSelectedKeys }, 'Delete keyframe'),
            el('button', { onclick: () => { S.selKey = null; renderInspector(); renderTimeline(); } }, 'Deselect')),
        )));
      }
    }
  }

  function propRow(L, f) {
    const animated = !!(L.keys[f.key] && L.keys[f.key].length);
    const value = f.anim ? RT.evalProp(L, f.key, S.time) : L.props[f.key];
    let input;
    const live = (v) => { setProp(L, f.key, v); markDirty(); };
    if (f.type === 'num') {
      input = el('input', {
        type: 'number', step: f.step, min: f.min, max: f.max, value: round(value), 'data-key': f.key,
        oninput: (e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) live(v); },
        onchange: () => commit(),
      });
    } else if (f.type === 'color') {
      input = el('input', { type: 'color', value, oninput: (e) => live(e.target.value), onchange: () => commit() });
    } else if (f.type === 'bool') {
      input = el('input', { type: 'checkbox', checked: !!value, onchange: (e) => { live(e.target.checked); commit(); } });
    } else if (f.type === 'select') {
      input = el('select', { onchange: (e) => { live(e.target.value); commit(); } },
        f.options.map(([v, lbl]) => el('option', { value: v, selected: String(value) === String(v) }, lbl)));
    } else if (f.type === 'asset') {
      const opts = Object.keys(P.assets).filter((id) => P.assets[id].type === 'image')
        .map((id) => el('option', { value: id, selected: value === id }, (P.assets[id].crew ? '\u{1F43E} ' : '') + P.assets[id].name));
      opts.push(el('option', { value: '__upload' }, '+ Upload new image...'));
      input = el('select', {
        onchange: async (e) => {
          if (e.target.value === '__upload') {
            e.target.value = value;
            const file = await pickFile($('#fileImage'));
            const id = file && (await importImage(file));
            if (id) { live(id); commit(); }
            return;
          }
          live(e.target.value);
          commit();
        },
      }, opts);
    } else if (f.type === 'textarea') {
      const ta = el('textarea', { rows: 2, value, oninput: (e) => live(e.target.value), onchange: () => commit() });
      const meta = RT.ALERT_TYPES.find((a) => a.id === S.type);
      return el('div', { class: 'prop wide' },
        el('span', { class: 'lbl' }, f.label), ta,
        el('div', { class: 'row' }, el('span', { class: 'muted small' }, 'Insert:'), meta.vars.map((v) => el('button', {
          class: 'icon small', onclick: () => { ta.value += '{' + v + '}'; live(ta.value); commit(); },
        }, '{' + v + '}'))));
    }
    const lbl = el('span', { class: 'lbl' + (f.type === 'num' ? ' scrub' : ''), title: f.type === 'num' ? 'Drag left/right to change (Shift = faster)' : '' }, f.label);
    if (f.type === 'num') attachScrub(lbl, L, f, input);
    if (!f.anim) return el('div', { class: 'prop static' }, el('span'), lbl, input);
    const k = keyAt(L, f.key, S.time) >= 0;
    return el('div', { class: 'prop' + (animated ? ' animated' : ''), 'data-prop': f.key },
      el('button', { class: 'sw' + (animated ? ' on' : ''), title: animated ? 'Stop animating (removes keyframes)' : 'Animate this property', onclick: () => toggleStopwatch(L, f.key) }, '⏱'),
      lbl, input,
      el('div', { class: 'kn' },
        el('button', { disabled: !animated, title: 'Previous keyframe', onclick: () => jumpKey(L, f.key, -1) }, '◀'),
        el('button', { class: 'k' + (k ? ' on' : ''), disabled: !animated, title: 'Add / remove keyframe here', onclick: () => toggleKeyHere(L, f.key) }, k ? '◆' : '◇'),
        el('button', { disabled: !animated, title: 'Next keyframe', onclick: () => jumpKey(L, f.key, 1) }, '▶')),
    );
  }

  function attachScrub(lbl, L, f, input) {
    lbl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const x0 = e.clientX;
      const v0 = parseFloat(input.value) || 0;
      let moved = false;
      lbl.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dx = ev.clientX - x0;
        if (Math.abs(dx) < 2 && !moved) return;
        moved = true;
        let v = v0 + dx * f.step * (ev.shiftKey ? 10 : 1);
        if (f.min != null) v = Math.max(f.min, v);
        if (f.max != null) v = Math.min(f.max, v);
        v = round(v);
        input.value = v;
        setProp(L, f.key, v);
        markDirty();
      };
      const up = () => {
        lbl.removeEventListener('pointermove', move);
        lbl.removeEventListener('pointerup', up);
        if (moved) commit();
      };
      lbl.addEventListener('pointermove', move);
      lbl.addEventListener('pointerup', up);
    });
  }

  function refreshInspectorValues() {
    const L = selLayer();
    if (!L) return;
    for (const row of document.querySelectorAll('#inspector .prop[data-prop]')) {
      const key = row.dataset.prop;
      const input = row.querySelector('input[data-key]');
      if (input && document.activeElement !== input) input.value = round(RT.evalProp(L, key, S.time));
      const kb = row.querySelector('.kn .k');
      if (kb && !kb.disabled) {
        const on = keyAt(L, key, S.time) >= 0;
        kb.classList.toggle('on', on);
        kb.textContent = on ? '◆' : '◇';
      }
    }
  }

  // ---------------------------------------------------------------- layer ops
  function addLayer(type) {
    const al = alertObj();
    const defaults = {
      image: { asset: 'dog1', x: 960, y: 540, glow: 20, border: 4 },
      text: { text: '{user}', x: 960, y: 540, glow: 14, glowColor: '#3fd8ff' },
      shape: { kind: 'panel', x: 960, y: 540, width: 600, height: 160 },
      particles: { kind: 'stars', x: 960, y: 540, count: 120 },
    }[type];
    const n = al.layers.filter((l) => l.type === type).length + 1;
    const name = { image: 'Image', text: 'Text', shape: 'Shape', particles: 'Particles' }[type] + ' ' + n;
    const L = RT.makeLayer(type, name, defaults, { inPoint: 0, outPoint: al.duration });
    const idx = S.sel ? al.layers.findIndex((l) => l.id === S.sel) : 0;
    al.layers.splice(Math.max(0, idx), 0, L);
    S.sel = L.id;
    S.selKey = null;
    commit();
  }
  function duplicateLayer() {
    const al = alertObj();
    const i = al.layers.findIndex((l) => l.id === S.sel);
    if (i < 0) return;
    const c = clone(al.layers[i]);
    c.id = RT.uid('l');
    c.name += ' copy';
    al.layers.splice(i, 0, c);
    S.sel = c.id;
    commit();
  }
  function deleteLayer() {
    const al = alertObj();
    const i = al.layers.findIndex((l) => l.id === S.sel);
    if (i < 0) return;
    al.layers.splice(i, 1);
    S.sel = null;
    S.selKey = null;
    commit();
  }
  function moveLayer(dir) {
    const al = alertObj();
    const i = al.layers.findIndex((l) => l.id === S.sel);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= al.layers.length) return;
    const [l] = al.layers.splice(i, 1);
    al.layers.splice(j, 0, l);
    commit();
  }
  function deleteSelectedKeys() {
    const sk = S.selKey;
    const L = sk && alertObj().layers.find((l) => l.id === sk.layerId);
    if (!L) return;
    const props = sk.prop === '*' ? Object.keys(L.keys) : [sk.prop];
    for (const p of props) {
      const ks = L.keys[p];
      if (!ks) continue;
      const v = RT.evalProp(L, p, sk.t);
      L.keys[p] = ks.filter((k) => Math.abs(k.t - sk.t) >= 0.005);
      if (!L.keys[p].length) { delete L.keys[p]; L.props[p] = v; }
    }
    S.selKey = null;
    commit();
  }

  // ---------------------------------------------------------------- timeline
  const tlBody = $('#tlBody');
  const pct = (t) => (t / dur() * 100) + '%';

  function renderTimeline() {
    const al = alertObj();
    const D = dur();
    tlBody.innerHTML = '';
    const ruler = el('div', { class: 'tl-row ruler' },
      el('div', { class: 'tl-name' }, el('span', { class: 'muted small' }, al.layers.length + ' layers (top draws in front)')),
      el('div', { class: 'tl-track', 'data-scrub': '1' }));
    const rt = ruler.lastChild;
    for (let s = 0; s <= D + 1e-6; s += 0.5) {
      const major = Math.abs(s - Math.round(s)) < 1e-6;
      rt.append(el('div', { class: 'tick' + (major ? '' : ' minor'), style: 'left:' + pct(s) }, major ? s + 's' : ''));
    }
    tlBody.append(ruler);
    if (!al.layers.length) tlBody.append(el('div', { class: 'tl-empty' }, 'No layers yet. Use "Add layer" above the canvas.'));

    const sk = S.selKey;
    al.layers.forEach((L, idx) => {
      const animProps = Object.keys(L.keys).filter((k) => L.keys[k].length);
      const open = S.expanded.has(L.id);
      const row = el('div', { class: 'tl-row' + (L.id === S.sel ? ' sel' : ''), 'data-layer': L.id, 'data-index': idx },
        el('div', { class: 'tl-name', 'data-name': L.id },
          el('button', {
            title: animProps.length ? 'Show keyframes' : 'No animated properties', style: animProps.length ? '' : 'visibility:hidden',
            onclick: (e) => { e.stopPropagation(); open ? S.expanded.delete(L.id) : S.expanded.add(L.id); renderTimeline(); },
          }, open ? '▾' : '▸'),
          el('span', { class: 'ty' }, TYPE_ICON[L.type]),
          el('span', { class: 'nm', title: 'Double-click to rename' }, L.name),
          el('button', { class: L.hidden ? 'off' : '', title: 'Show / hide', onclick: (e) => { e.stopPropagation(); L.hidden = !L.hidden; commit(); } }, '\u{1F441}'),
          el('button', { class: L.locked ? '' : 'off', title: 'Lock (can\'t click it on the canvas)', onclick: (e) => { e.stopPropagation(); L.locked = !L.locked; commit(); } }, '\u{1F512}'),
        ),
        el('div', { class: 'tl-track', 'data-scrub': '1' },
          el('div', { class: 'tl-bar', 'data-bar': L.id, style: 'left:' + pct(L.inPoint) + ';width:' + pct(Math.max(0, L.outPoint - L.inPoint)) },
            el('div', { class: 'h l', 'data-trim': 'in' }), el('div', { class: 'h r', 'data-trim': 'out' })),
          allKeyTimes(L).map((t) => el('div', {
            class: 'tl-key summary' + (sk && sk.layerId === L.id && Math.abs(sk.t - t) < 0.005 ? ' sel' : ''),
            style: 'left:' + pct(t), 'data-key': L.id, 'data-prop': '*', 'data-t': t, title: t.toFixed(2) + 's',
          })),
        ),
      );
      tlBody.append(row);
      if (open) {
        for (const p of animProps) {
          tlBody.append(el('div', { class: 'tl-row sub' },
            el('div', { class: 'tl-name' }, RT.fieldDef(L.type, p).label),
            el('div', { class: 'tl-track', 'data-scrub': '1' }, L.keys[p].map((k) => el('div', {
              class: 'tl-key' + (sk && sk.layerId === L.id && (sk.prop === p || sk.prop === '*') && Math.abs(sk.t - k.t) < 0.005 ? ' sel' : ''),
              style: 'left:' + pct(k.t), 'data-key': L.id, 'data-prop': p, 'data-t': k.t, title: RT.fieldDef(L.type, p).label + ' = ' + round(k.v) + ' @ ' + k.t.toFixed(2) + 's (' + RT.EASE_LABELS[k.e || 'linear'] + ')',
            })))));
        }
      }
    });
    const overlay = el('div', { style: 'position:absolute;top:0;bottom:0;left:var(--name-col);right:0;pointer-events:none' }, el('div', { id: 'playhead' }));
    tlBody.append(overlay);
    updateTimeUI();
  }

  function trackX2T(clientX) {
    const r = $('.tl-row.ruler .tl-track', tlBody).getBoundingClientRect();
    return clamp((clientX - r.left) / r.width * dur(), 0, dur());
  }
  // Window-level listeners: the element under the pointer may be re-rendered mid-drag.
  function dragLoop(e, onMove, onUp) {
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const move = (ev) => {
      if (!moved && Math.abs(ev.clientX - x0) < 3 && Math.abs(ev.clientY - y0) < 3) return;
      moved = true;
      onMove(ev);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onUp && onUp(moved, ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  tlBody.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const t = e.target;
    if (t.closest('button')) return;
    if (S.playing) pause();

    // Keyframe diamonds: click to select (and jump there), drag to retime.
    if (t.dataset.key) {
      const L = alertObj().layers.find((l) => l.id === t.dataset.key);
      const prop = t.dataset.prop, t0 = parseFloat(t.dataset.t);
      S.sel = L.id;
      S.selKey = { layerId: L.id, prop, t: t0 };
      const refs = [];
      for (const p of prop === '*' ? Object.keys(L.keys) : [prop]) for (const k of L.keys[p] || []) if (Math.abs(k.t - t0) < 0.005) refs.push(k);
      const start = trackX2T(e.clientX);
      dragLoop(e, (ev) => {
        const nt = snapT(clamp(t0 + trackX2T(ev.clientX) - start, 0, dur()));
        refs.forEach((k) => { k.t = nt; });
        for (const p in L.keys) L.keys[p].sort((a, b) => a.t - b.t);
        S.selKey.t = nt;
        t.style.left = pct(nt);
        markDirty();
      }, (moved) => {
        if (!moved) setTime(t0);
        else setTime(S.selKey.t);
        commit();
      });
      return;
    }

    // Layer bar: trim handles or slide the whole layer (keyframes move with it).
    const bar = t.closest('[data-bar]');
    if (bar) {
      const L = alertObj().layers.find((l) => l.id === bar.dataset.bar);
      selectLayer(L.id);
      const start = trackX2T(e.clientX);
      const in0 = L.inPoint, out0 = L.outPoint;
      const trim = t.dataset.trim;
      const keys0 = Object.keys(L.keys).map((p) => L.keys[p].map((k) => [k, k.t])).flat();
      const barEl = $('[data-bar="' + L.id + '"]', tlBody);
      dragLoop(e, (ev) => {
        const d = trackX2T(ev.clientX) - start;
        if (trim === 'in') L.inPoint = snapT(clamp(in0 + d, 0, L.outPoint - 0.05));
        else if (trim === 'out') L.outPoint = snapT(Math.max(L.inPoint + 0.05, out0 + d));
        else {
          const dd = snapT(Math.max(-in0, d));
          L.inPoint = snapT(in0 + dd);
          L.outPoint = snapT(out0 + dd);
          keys0.forEach(([k, kt]) => { k.t = snapT(kt + dd); });
        }
        barEl.style.left = pct(L.inPoint);
        barEl.style.width = pct(L.outPoint - L.inPoint);
        markDirty();
      }, (moved) => { if (moved) commit(); });
      return;
    }

    // Layer name: select, or drag vertically to reorder.
    const name = t.closest('[data-name]');
    if (name) {
      const id = name.dataset.name;
      selectLayer(id);
      const y0 = e.clientY;
      dragLoop(e, () => {}, (moved, ev) => {
        if (!moved || Math.abs(ev.clientY - y0) < 8) return;
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = hit && hit.closest('.tl-row[data-index]');
        if (!row) return;
        const al = alertObj();
        const from = al.layers.findIndex((l) => l.id === id);
        const to = parseInt(row.dataset.index, 10);
        if (from === to) return;
        const [l] = al.layers.splice(from, 1);
        al.layers.splice(to, 0, l);
        commit();
      });
      return;
    }

    // Anywhere else on a track or the ruler: scrub the playhead.
    if (t.closest('[data-scrub]')) {
      setTime(trackX2T(e.clientX));
      dragLoop(e, (ev) => setTime(trackX2T(ev.clientX)));
    }
  });

  tlBody.addEventListener('dblclick', (e) => {
    const nm = e.target.closest('.nm');
    const row = e.target.closest('[data-name]');
    if (!nm || !row) return;
    const L = alertObj().layers.find((l) => l.id === row.dataset.name);
    const input = el('input', { value: L.name, style: 'width:100%' });
    nm.replaceWith(input);
    input.focus();
    input.select();
    const done = () => { L.name = input.value || L.name; commit(); };
    input.addEventListener('blur', done);
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') input.blur(); if (ev.key === 'Escape') { input.value = L.name; input.blur(); } });
  });

  // ---------------------------------------------------------------- export
  function usedAssetIds() {
    const used = new Set();
    for (const k in P.alerts) {
      const al = P.alerts[k];
      if (!al.enabled) continue;
      if (al.sound.asset) used.add(al.sound.asset);
      for (const l of al.layers) if (l.type === 'image') used.add(l.props.asset);
    }
    return used;
  }

  // Dog photos only ever show at ~250px, so shrink them to keep the exported code small.
  async function compactImage(data, max) {
    try {
      const img = await loadImg(data);
      const s = max / Math.max(img.naturalWidth, img.naturalHeight);
      if (s >= 1) return data;
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return /^data:image\/(png|webp|gif)/.test(data) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88);
    } catch (e) {
      return data;
    }
  }

  // The whole overlay as one self-contained script: engine + designs + settings.
  async function buildPlayerScript(source) {
    const used = usedAssetIds();
    const assets = {};
    for (const id in P.assets) {
      if (!used.has(id)) continue;
      const a = P.assets[id];
      assets[id] = a.type === 'image' && a.data ? Object.assign({}, a, { data: await compactImage(a.data, 480) }) : a;
    }
    const project = { version: P.version, width: W, height: H, assets, alerts: P.alerts };
    const s = P.settings;
    const config = { source, volume: s.volume, gap: s.gap, chatTest: s.chatTest, fontCss: FONT_CSS, hideStatus: source === 'streamelements' };
    if (source === 'twitch') Object.assign(config, { channel: s.channel, token: s.token, testOnLoad: s.testOnLoad });
    const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
    return '/* Quantum Paws alerts - made with Quantum Paws Alert Studio. Paste this whole thing into the JS tab. */\n' +
      '(function () {\n' +
      'const RT = (' + OverlayRuntime.toString() + ')();\n' +
      'RT.startOverlay(' + safe(project) + ', ' + safe(config) + ');\n' +
      '})();\n';
  }

  async function buildOverlayHtml() {
    const js = await buildPlayerScript('twitch');
    return '<!doctype html>\n<html><head><meta charset="utf-8"><title>Quantum Paws Overlay</title></head><body>\n<script>\n' +
      js + '</' + 'script>\n</body></html>\n';
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = el('textarea', { value: text, style: 'position:fixed;opacity:0' });
      dlg.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  function download(name, text, type) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  const dlg = $('#exportDlg');
  function openExport() {
    const s = P.settings;
    $('#exChannel').value = s.channel || '';
    $('#exClientId').value = s.clientId || '';
    $('#exToken').value = s.token || '';
    $('#exVolume').value = s.volume;
    $('#exGap').value = s.gap;
    $('#exChatTest').checked = !!s.chatTest;
    $('#exTestOnLoad').checked = !!s.testOnLoad;
    if (s.token) { $('#followDetails').open = true; validateToken(); }
    $('#copyStatus').textContent = '';
    showExportTab(s.token ? 'obs' : 'se');
    dlg.showModal();
  }
  function readExportForm() {
    const s = P.settings;
    s.channel = $('#exChannel').value.trim().replace(/^.*twitch\.tv\//i, '').replace(/^#/, '');
    s.clientId = $('#exClientId').value.trim();
    s.token = $('#exToken').value.trim();
    s.volume = parseFloat($('#exVolume').value);
    s.gap = Math.max(0, parseFloat($('#exGap').value) || 0);
    s.chatTest = $('#exChatTest').checked;
    s.testOnLoad = $('#exTestOnLoad').checked;
    scheduleSave();
  }
  async function validateToken() {
    const st = $('#tokenStatus');
    const tok = $('#exToken').value.trim().replace(/^oauth:/i, '');
    if (!tok) { st.textContent = ''; return; }
    st.textContent = 'Checking token...';
    st.style.color = '';
    try {
      const r = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + tok } });
      if (!r.ok) throw new Error('Twitch says this token is invalid or expired');
      const info = await r.json();
      const ok = (info.scopes || []).includes('moderator:read:followers');
      st.textContent = ok ? '✔ Token OK for ' + info.login + '. Follow alerts enabled.' : '⚠ Token for ' + info.login + ' is missing the moderator:read:followers scope.';
      st.style.color = ok ? '#5cffb0' : '#ffc94a';
      if (!$('#exChannel').value.trim()) $('#exChannel').value = info.login;
    } catch (err) {
      st.textContent = '✖ ' + err.message;
      st.style.color = '#ff5a6a';
    }
  }
  $('#exToken').addEventListener('change', validateToken);
  $('#btnDownloadOverlay').addEventListener('click', async () => {
    readExportForm();
    if (!P.settings.channel && !confirm('No Twitch channel entered, so only test alerts will work. Export anyway?')) return;
    const html = await buildOverlayHtml();
    download('quantum-paws-overlay.html', html, 'text/html');
    toast('Overlay downloaded (' + Math.round(html.length / 1024) + ' KB). Add it to OBS as a Browser source.', 5000);
  });
  $('#exportForm').addEventListener('change', readExportForm);
  function showExportTab(which) {
    for (const b of document.querySelectorAll('[data-ex]')) b.classList.toggle('active', b.dataset.ex === which);
    for (const p of document.querySelectorAll('[data-expane]')) p.hidden = p.dataset.expane !== which;
  }
  for (const b of document.querySelectorAll('[data-ex]')) b.addEventListener('click', () => showExportTab(b.dataset.ex));
  $('#btnCopySE').addEventListener('click', async () => {
    readExportForm();
    const st = $('#copyStatus');
    st.textContent = 'Building...';
    st.style.color = '';
    const js = await buildPlayerScript('streamelements');
    const ok = await copyText(js);
    const kb = Math.round(js.length / 1024);
    if (ok) {
      st.textContent = '\u2714 Copied (' + kb + ' KB). Now paste it into the StreamElements JS tab.';
      st.style.color = '#5cffb0';
    } else {
      download('quantum-paws-streamelements.js', js, 'text/javascript');
      st.textContent = 'Your browser blocked copying, so it was downloaded instead. Open the file, copy everything, and paste it into the JS tab.';
      st.style.color = '#ffc94a';
    }
  });
  $('#btnTwitchLogin').addEventListener('click', () => {
    readExportForm();
    if (!P.settings.clientId) { toast('Enter your Twitch app Client ID first (see README)', 4000); return; }
    if (location.protocol === 'file:') { toast('Twitch login needs the editor running from a web address (see README), or paste a token instead.', 6000); return; }
    const stateTok = Math.random().toString(36).slice(2);
    sessionStorage.setItem('qp-oauth-state', stateTok);
    idbSet('project', JSON.stringify(P)).finally(() => {
      location.href = 'https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=' + encodeURIComponent(P.settings.clientId) +
        '&redirect_uri=' + encodeURIComponent(location.origin + location.pathname) + '&scope=moderator%3Aread%3Afollowers&state=' + stateTok;
    });
  });
  function handleOAuthReturn() {
    if (!location.hash.includes('access_token')) return false;
    const h = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    if (h.get('state') !== sessionStorage.getItem('qp-oauth-state')) { toast('Twitch login could not be verified, please try again'); return false; }
    P.settings.token = h.get('access_token');
    scheduleSave();
    return true;
  }

  // ---------------------------------------------------------------- project files
  $('#btnSave').addEventListener('click', () => {
    const copy = clone(P);
    copy.settings.token = '';
    download('quantum-paws-project.json', JSON.stringify(copy), 'application/json');
    toast('Project saved (token not included)');
  });
  $('#btnImport').addEventListener('click', async () => {
    const f = await pickFile($('#fileProject'));
    if (!f) return;
    try {
      const p = normalize(JSON.parse(await f.text()));
      p.settings.token = p.settings.token || P.settings.token;
      P = p;
      S.sel = null; S.selKey = null;
      refreshImages();
      resetHistory();
      scheduleSave();
      renderAll();
      toast('Project opened');
    } catch (err) {
      toast('Could not open that file: ' + err.message, 4000);
    }
  });

  // ---------------------------------------------------------------- wiring
  $('#btnExport').addEventListener('click', openExport);
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnPlay').addEventListener('click', () => (S.playing ? pause() : play()));
  $('#btnStart').addEventListener('click', () => { pause(); setTime(0); });
  $('#btnAddImage').addEventListener('click', async () => { const f = await pickFile($('#fileImage')); if (f) importImage(f); });
  $('#btnAddSound').addEventListener('click', async () => { const f = await pickFile($('#fileSound')); if (f) importSound(f); });
  $('#bgSelect').addEventListener('change', (e) => { S.bg = e.target.value; markDirty(); });
  for (const b of document.querySelectorAll('[data-add]')) b.addEventListener('click', () => addLayer(b.dataset.add));

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || dlg.open) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateLayer(); }
    else if (e.key === ' ') { e.preventDefault(); S.playing ? pause() : play(); }
    else if (e.key === 'Home') setTime(0);
    else if (e.key === 'End') setTime(dur());
    else if (e.key === ',' || e.key === '.') setTime(S.time + (e.key === ',' ? -1 : 1) / 30);
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); S.selKey ? deleteSelectedKeys() : deleteLayer(); }
    else if (e.key === 'Escape') { S.selKey = null; selectLayer(null); }
    else if (e.key.startsWith('Arrow') && selLayer()) {
      e.preventDefault();
      const L = selLayer();
      const d = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
      const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      setProp(L, 'x', RT.evalProp(L, 'x', S.time) + dx);
      setProp(L, 'y', RT.evalProp(L, 'y', S.time) + dy);
      commit();
    }
  });
  window.addEventListener('beforeunload', () => { if (P) idbSet('project', JSON.stringify(P)); });

  // ---------------------------------------------------------------- render orchestration
  function renderMain() {
    renderTabs();
    renderAlertSettings();
    renderVars();
    renderInspector();
    renderTimeline();
    markDirty();
  }
  function renderAll() {
    renderAssets();
    renderMain();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (S.playing) {
      S.time += dt;
      if (S.time >= dur()) {
        if ($('#chkLoop').checked) { S.time = 0; startSound(); }
        else { S.time = dur(); pause(); }
      }
      updateTimeUI();
      S.dirty = true;
    }
    if (S.dirty) { S.dirty = false; draw(); }
    requestAnimationFrame(loop);
  }

  async function init() {
    let stored = null;
    try { stored = await idbGet('project'); } catch (e) { console.warn('storage unavailable', e); }
    try { P = normalize(stored ? JSON.parse(stored) : makeProject(RT)); } catch (e) { P = makeProject(RT); }
    refreshImages();
    resetHistory();
    renderAll();
    const back = handleOAuthReturn();
    document.fonts.ready.then(markDirty);
    setTime(2.6);
    requestAnimationFrame(loop);
    if (back) { openExport(); toast('Connected to Twitch'); }
    else if (!stored) toast('Welcome! Start by uploading photos of your 3 dogs on the left.', 6000);
  }
  init();
})();
