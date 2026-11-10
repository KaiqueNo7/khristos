const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const whole = (value, low, high) => clamp(Math.round(Number(value)) || low, low, high);
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const scale = (root, step) => root + 12 * Math.floor(step / 7) + DORIAN[step % 7];

const TOWER = [[0.5, 0.45, 1], [1, 1, 0.8], [1.2, 0.5, 0.6], [1.5, 0.2, 0.45], [2, 0.55, 0.4], [2.5, 0.18, 0.28], [3, 0.2, 0.2], [4.2, 0.1, 0.13]];
const TUBULAR = [[1, 0.3, 1], [1.21, 0.2, 0.7], [2, 1, 0.75], [2.99, 0.65, 0.5], [4.17, 0.4, 0.32], [5.56, 0.22, 0.2], [7.14, 0.1, 0.12]];
const HANDBELL = [[1, 1, 1], [2.76, 0.42, 0.55], [5.4, 0.18, 0.3]];
const DRUMHEAD = [[1.5, 0.5, 0.6], [1.99, 0.32, 0.45], [2.44, 0.16, 0.3]];
const VOWELS = {
  ah: [[650, 1, 7], [1080, 0.5, 9], [2650, 0.42, 12]],
  eh: [[400, 1, 6], [1700, 0.25, 10], [2600, 0.25, 12]],
  oh: [[400, 1, 6], [800, 0.32, 8], [2600, 0.2, 12]]
};

export function createKit(ctx, destination) {
  const rate = ctx.sampleRate;
  const nyquist = rate / 2;
  let seed = 20261110;
  let registry = null;

  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const spread = amount => (rand() * 2 - 1) * amount;
  const warm = ctx.currentTime + 0.2;
  const now = () => Math.max(ctx.currentTime + 0.02, warm);
  const track = set => { registry = set; };

  const amp = (value = 0) => {
    const node = ctx.createGain();
    node.gain.value = value;
    return node;
  };
  const filter = (type, frequency, q = 1) => {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  };
  const wave = partials => {
    const imag = new Float32Array(partials.length + 1);
    partials.forEach((level, i) => { imag[i + 1] = level; });
    return ctx.createPeriodicWave(new Float32Array(imag.length), imag);
  };

  const grain = ctx.createBuffer(1, Math.floor(rate * 2), rate);
  const white = grain.getChannelData(0);
  for (let i = 0; i < white.length; i++) white[i] = rand() * 2 - 1;

  const stone = ctx.createBuffer(2, Math.floor(rate * 3.5), rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = stone.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      const time = i / rate;
      const open = 1 - Math.exp(-2 * Math.PI * (700 + 6000 * Math.exp(-time * 2.5)) / rate);
      low += open * (rand() * 2 - 1 - low);
      data[i] = low * Math.exp(-1.974 * time) * Math.min(1, time / 0.03);
    }
  }

  const PRINCIPAL = wave([1, 0.6, 0, 0.4, 0, 0, 0, 0.2]);
  const QUINT = wave([0, 0, 1, 0, 0, 0.55]);
  const REED = wave(Array.from({ length: 20 }, (_, i) => (i % 2 ? 0.55 : 1) / (i + 1) ** 0.7));

  const mix = filter('highpass', 28, 0);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.18;
  const trim = amp(10 ** (-0.6 * 3 * (1 - 1 / 20) / 20));
  const ceiling = ctx.createWaveShaper();
  const bend = new Float32Array(4097);
  for (let i = 0; i < bend.length; i++) {
    const x = i / 2048 - 1;
    const size = Math.abs(x);
    bend[i] = Math.sign(x) * (size < 0.72 ? size : 0.72 + 0.165 * Math.tanh((size - 0.72) / 0.165));
  }
  ceiling.curve = bend;
  const master = amp(1);
  mix.connect(limiter).connect(trim).connect(ceiling).connect(master).connect(destination);

  const hall = ctx.createConvolver();
  hall.buffer = stone;
  const send = filter('highpass', 160, 0);
  const back = amp(1.1);
  send.connect(hall).connect(back).connect(mix);

  const strip = (level = 1, wet = 0.3, pan = 0) => {
    const input = amp(1);
    let tail = input;
    if (pan) {
      tail = ctx.createStereoPanner();
      tail.pan.value = pan;
      input.connect(tail);
    }
    tail.connect(amp(level * (globalThis.khristosScale || 1))).connect(mix);
    tail.connect(amp(level * wet * (globalThis.khristosScale || 1))).connect(send);
    return input;
  };

  const run = (node, from, to, offset = 0) => {
    const owner = registry;
    if (owner) owner.add(node);
    node.onended = () => {
      node.disconnect();
      if (owner) owner.delete(node);
    };
    node.start(from, offset);
    node.stop(to);
    return node;
  };
  const tone = (shape, frequency, from, to, detune = 0) => {
    const node = ctx.createOscillator();
    if (typeof shape === 'string') node.type = shape;
    else node.setPeriodicWave(shape);
    node.frequency.value = frequency;
    node.detune.value = detune;
    return run(node, from, to);
  };
  const hiss = (from, to) => {
    const node = ctx.createBufferSource();
    node.buffer = grain;
    node.loop = true;
    return run(node, from, to, rand() * 1.5);
  };
  const band = (type, frequency, q) => nyquist / (type === 'lowpass' ? frequency : type === 'highpass' ? nyquist - frequency : frequency / q);

  const swell = (param, t, peak, attack, hold, release) => {
    const off = t + attack + hold;
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.setValueAtTime(peak, off);
    param.linearRampToValueAtTime(peak * 0.3, off + release * 0.35);
    param.linearRampToValueAtTime(0, off + release);
    return off + release + 0.02;
  };
  const strike = (param, t, peak, decay) => {
    const top = Math.max(peak, 0.00001);
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(top, t + 0.004);
    param.exponentialRampToValueAtTime(top * 0.001, t + decay);
    param.linearRampToValueAtTime(0, t + decay + 0.02);
    return t + decay + 0.04;
  };

  const ping = (out, shape, frequency, t, peak, decay, detune = 0) => {
    const env = amp();
    const voice = tone(shape, frequency, t, strike(env.gain, t, peak, decay), detune);
    voice.connect(env).connect(out);
    return voice;
  };
  const burst = (out, t, peak, decay, type, frequency, q = 1) => {
    const env = amp();
    const shape = filter(type, frequency, q);
    hiss(t, strike(env.gain, t, peak * 0.5 * Math.sqrt(band(type, frequency, q)), decay)).connect(shape).connect(env).connect(out);
    return shape;
  };

  function organ(out, t, notes, dur, { gain = 0.3, attack = 0.05, release = 0.35, full = false } = {}) {
    const env = amp();
    const body = filter('lowpass', full ? 5200 : 3200, -3);
    const end = swell(env.gain, t, gain * 0.5 / Math.sqrt(notes.length), attack, Math.max(0.01, dur - attack), release);
    const ranks = [[PRINCIPAL, 0.45], [PRINCIPAL, 0.45], [QUINT, 0.2]];
    if (full) ranks.push([REED, 0.35]);
    for (const [shape, level] of ranks) {
      const rank = amp(level);
      for (const note of notes) tone(shape, hz(note), t, end, spread(5)).connect(rank);
      rank.connect(body);
    }
    body.connect(env).connect(out);
    return end;
  }

  function choir(out, t, notes, dur, { gain = 0.3, attack = 0.3, release = 0.5, vowel = 'ah', bend = 0 } = {}) {
    const env = amp();
    const end = swell(env.gain, t, gain / Math.sqrt(notes.length), attack, Math.max(0.01, dur - attack), release);
    const sections = [null, null];
    const section = high => {
      const mouth = amp(1);
      for (const [frequency, level, q] of VOWELS[vowel]) mouth.connect(filter('bandpass', frequency * (high ? 1.17 : 1), high ? q / 4 : q)).connect(amp(level * (high ? 0.5 : 1.45))).connect(env);
      mouth.connect(filter('lowpass', high ? 1000 : 420, 0)).connect(amp(high ? 0.12 : 0.15)).connect(env);
      return mouth;
    };
    const vibrato = [4.9, 5.7].map(speed => {
      const depth = amp();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(9, t + Math.min(0.6, dur));
      tone('sine', speed, t, end).connect(depth);
      return depth;
    });
    notes.forEach((note, i) => {
      const high = note >= 60 ? 1 : 0;
      sections[high] ||= section(high);
      for (const cents of [-11, 4, 13]) {
        const tuned = cents + spread(5);
        const voice = tone('sawtooth', hz(note), t, end, tuned);
        vibrato[i % 2].connect(voice.detune);
        if (bend) {
          voice.detune.setValueAtTime(tuned, t + attack);
          voice.detune.linearRampToValueAtTime(tuned + bend, end);
        }
        voice.connect(sections[high]);
      }
    });
    env.connect(out);
    return end;
  }

  function brass(out, t, notes, dur, { gain = 0.3, attack = 0.07, release = 0.2, bright = 6, fall = 0 } = {}) {
    const env = amp();
    const end = swell(env.gain, t, gain * 0.36 / Math.sqrt(notes.length), attack, Math.max(0.01, dur - attack), release);
    for (const note of notes) {
      const f = hz(note);
      const open = clamp(f * bright, 180 * bright, 7000);
      const horn = filter('lowpass', f * 1.5, 3);
      horn.frequency.setValueAtTime(f * 1.5, t);
      horn.frequency.exponentialRampToValueAtTime(open * 1.3, t + attack);
      horn.frequency.setTargetAtTime(open * 0.75, t + attack, 0.15);
      for (const cents of [-7, 6]) {
        const voice = tone('sawtooth', f, t, end, cents - 35);
        voice.detune.setValueAtTime(cents - 35, t);
        voice.detune.linearRampToValueAtTime(cents, t + 0.06);
        if (fall) {
          voice.detune.setValueAtTime(cents, Math.max(t + 0.07, t + dur * 0.3));
          voice.detune.linearRampToValueAtTime(cents - fall, end);
        }
        voice.connect(horn);
      }
      horn.connect(env);
    }
    env.connect(out);
    return end;
  }

  function strings(out, t, note, dur, gain = 0.3) {
    const env = amp();
    const bow = filter('lowpass', 2600, 0);
    bow.frequency.setValueAtTime(2600, t);
    bow.frequency.exponentialRampToValueAtTime(700, t + dur);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain * 0.4, t + 0.012);
    env.gain.exponentialRampToValueAtTime(gain * 0.008, t + dur);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.03);
    for (const [shift, cents] of [[0, -8], [0, 9], [-12, 0]]) tone('sawtooth', hz(note + shift), t, t + dur + 0.05, cents + spread(4)).connect(bow);
    bow.connect(env).connect(out);
  }

  function drum(out, t, frequency, { gain = 0.5, decay = 0.8, drop = 1.5, ring = 0, thump = 0.6, snap = 0.1 } = {}) {
    const skin = ping(out, 'sine', frequency, t, gain, decay);
    skin.frequency.setValueAtTime(frequency * drop, t);
    skin.frequency.exponentialRampToValueAtTime(frequency, t + 0.07);
    if (ring) for (const [ratio, level, life] of DRUMHEAD) ping(out, 'sine', frequency * ratio, t, gain * ring * level, decay * life);
    if (thump) burst(out, t, gain * thump, 0.12, 'lowpass', clamp(frequency * 5, 260, 900), 0);
    if (snap) burst(out, t, gain * snap, 0.035, 'highpass', 2400, 0);
  }
  const timpani = (out, t, note, gain = 0.5, decay = 1.3) => drum(out, t, hz(note), { gain: gain * 0.68, decay, drop: 1.35, ring: 1, thump: 0.5, snap: 0.04 });
  const taiko = (out, t, gain = 0.6, frequency = 58, decay = 0.75) => drum(out, t, frequency, { gain: gain * 0.82, decay, drop: 2.4, thump: 1.1, snap: 0.3 });

  function roll(out, t, note, dur, from, to) {
    const strokes = Math.max(2, Math.round(dur * 16));
    for (let i = 0; i < strokes; i++) {
      const rise = i / (strokes - 1);
      drum(out, t + (dur * i) / strokes + spread(0.004), hz(note), { gain: from + (to - from) * rise * rise, decay: 0.4, drop: 1.2, ring: 0.6, thump: 0.5, snap: 0 });
    }
  }

  function impact(out, t, gain = 0.7, decay = 1.6) {
    const sub = ping(out, 'sine', 46, t, gain * 0.77, decay);
    sub.frequency.setValueAtTime(150, t);
    sub.frequency.exponentialRampToValueAtTime(46, t + 0.3);
    const boom = burst(out, t, gain * 0.35, decay * 0.7, 'lowpass', 4200, 0);
    boom.frequency.setValueAtTime(4200, t);
    boom.frequency.exponentialRampToValueAtTime(160, t + 0.6);
    burst(out, t, gain * 0.2, 0.07, 'highpass', 3000, 0);
  }

  function bell(out, t, note, { gain = 0.3, decay = 3, partials = TOWER } = {}) {
    const f = hz(note);
    for (const [ratio, level, life] of partials) {
      if (f * ratio > 11000) continue;
      ping(out, 'sine', f * ratio, t, gain * level * 0.31, decay * life, spread(4));
      if (level >= 0.45) ping(out, 'sine', f * ratio + 0.5 + rand(), t, gain * level * 0.155, decay * life);
    }
    burst(out, t, gain * 0.2, 0.03, 'bandpass', Math.min(f * 6, 8000), 1.5);
  }

  function riser(out, t, dur, { gain = 0.25, note = 0 } = {}) {
    const env = amp();
    const end = t + dur + 0.07;
    env.gain.setValueAtTime(gain * 0.02, t);
    env.gain.exponentialRampToValueAtTime(gain, t + dur);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    const wind = filter('bandpass', 250, 1.2);
    wind.frequency.setValueAtTime(250, t);
    wind.frequency.exponentialRampToValueAtTime(5000, t + dur);
    hiss(t, end).connect(wind).connect(amp(1.2)).connect(env);
    if (note) {
      const glow = filter('lowpass', 300, 2);
      glow.frequency.setValueAtTime(300, t);
      glow.frequency.exponentialRampToValueAtTime(4000, t + dur);
      for (const cents of [-9, 8]) {
        const voice = tone('sawtooth', hz(note), t, end, cents);
        voice.frequency.setValueAtTime(hz(note), t);
        voice.frequency.exponentialRampToValueAtTime(hz(note + 12), t + dur);
        voice.connect(glow);
      }
      glow.connect(amp(0.4)).connect(env);
    }
    env.connect(out);
  }

  function cluster(out, t, attack, release, { gain = 0.3, root = 38 } = {}) {
    const env = amp();
    const dark = filter('lowpass', 160, 4);
    const growl = amp(1);
    const end = swell(env.gain, t, gain * 0.19, attack, 0.04, release);
    dark.frequency.setValueAtTime(160, t);
    dark.frequency.exponentialRampToValueAtTime(950, t + attack);
    dark.frequency.exponentialRampToValueAtTime(140, end);
    tone('sine', 8.5, t, end).connect(amp(0.3)).connect(growl.gain);
    for (const interval of [0, 1, 6, 13]) {
      for (const cents of [-10, 9]) {
        const tuned = cents + spread(6);
        const voice = tone('sawtooth', hz(root + interval), t, end, tuned);
        voice.detune.setValueAtTime(tuned, t);
        voice.detune.linearRampToValueAtTime(tuned - 80, end);
        voice.connect(dark);
      }
    }
    tone('sine', hz(root - 12), t, end).connect(amp(1.5)).connect(growl);
    dark.connect(growl).connect(env).connect(out);
  }

  function wood(out, t, frequency, gain = 0.4, decay = 0.2) {
    ping(out, 'sine', frequency, t, gain * 0.63, decay);
    ping(out, 'sine', frequency * 3.98, t, gain * 0.19, decay * 0.3);
    burst(out, t, gain * 0.57, 0.035, 'bandpass', clamp(frequency * 6, 700, 2400), 1.3);
  }

  function parchment(out, t, gain = 0.2, dur = 0.17) {
    const env = amp();
    const end = t + dur + 0.02;
    const sheet = filter('bandpass', 1600, 0.8);
    sheet.frequency.setValueAtTime(1600, t);
    sheet.frequency.exponentialRampToValueAtTime(5200, t + dur);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    env.gain.linearRampToValueAtTime(0, t + dur);
    hiss(t, end).connect(sheet).connect(env).connect(out);
    hiss(t, end).connect(filter('lowpass', 45, 0)).connect(amp(gain * 25)).connect(env.gain);
    burst(out, t + dur * 0.75, gain * 0.5, 0.05, 'bandpass', 800, 1);
  }

  return { ctx, master, rand, now, track, amp, filter, strip, ping, burst, organ, choir, brass, strings, drum, timpani, taiko, roll, impact, bell, riser, cluster, wood, parchment };
}

const EFFECTS = {
  card(k, { cost = 2, chain = 1, enemy = false } = {}) {
    const t = k.now();
    const size = whole(cost, 0, 10);
    const combo = whole(chain, 1, 12) - 1;
    const note = scale(enemy ? 45 : 50, combo);
    const o = k.strip(enemy ? 0.23 : 0.26, 0.02);
    k.wood(o, t, hz(note), 0.34 + combo * 0.02, 0.22);
    k.drum(o, t, 104 * 0.92 ** size, { gain: 0.5 + size * 0.03, decay: 0.26 + size * 0.055, drop: 2.2, thump: 0.8, snap: 0.15 });
    if (combo > 1) k.bell(o, t, note + 24, { gain: 0.05 + combo * 0.008, decay: 0.42, partials: HANDBELL });
  },

  draw(k) {
    k.parchment(k.strip(0.4, 0.02), k.now(), 0.16 + k.rand() * 0.04, 0.15 + k.rand() * 0.05);
  },

  evolve(k, { top = false } = {}) {
    const t = k.now();
    const o = k.strip(top ? 0.305 : 0.43, 0.45);
    const land = t + 0.36;
    k.riser(o, t, 0.34, { gain: 0.2, note: 50 });
    [50, 57, 62].forEach((note, i) => k.brass(o, t + 0.03 + i * 0.11, [note], 0.08, { gain: 0.4, attack: 0.025, release: 0.08 }));
    k.timpani(o, land, 38, 0.6);
    k.brass(o, land, [50, 57, 62, 66], top ? 1.5 : 0.8, { gain: 0.7 });
    k.choir(o, land, [50, 57, 62, 66, 69], top ? 1.7 : 1, { gain: 0.6, attack: 0.2, release: 0.7 });
    if (!top) return;
    k.taiko(o, land, 0.8);
    k.organ(o, land, [26, 38, 50, 57, 62, 66, 69, 74], 1.7, { gain: 0.8, full: true, release: 0.6 });
    [74, 81, 78, 86].forEach((note, i) => k.bell(o, land + i * 0.24, note, { gain: 0.3, decay: 2.4, partials: TUBULAR }));
  },

  relic(k) {
    const t = k.now();
    const o = k.strip(0.48, 0.45);
    k.wood(o, t, hz(57), 0.3, 0.16);
    k.bell(o, t + 0.03, 81, { gain: 0.5, decay: 1.6, partials: TUBULAR });
    k.bell(o, t + 0.16, 86, { gain: 0.4, decay: 1.9, partials: TUBULAR });
    k.choir(o, t + 0.05, [69, 74], 0.5, { gain: 0.25, attack: 0.25, release: 0.6 });
  },

  bless(k) {
    const t = k.now();
    const o = k.strip(0.37, 0.5);
    k.choir(o, t, [57, 62, 66, 69], 1, { gain: 0.6, attack: 0.4, release: 0.8 });
    k.organ(o, t, [50, 62, 69], 1, { gain: 0.3, attack: 0.3, release: 0.6 });
    [74, 78, 81, 86].forEach((note, i) => k.bell(o, t + 0.08 + i * 0.09, note, { gain: 0.22, decay: 1.4, partials: TUBULAR }));
  },

  sacrament(k) {
    const t = k.now();
    const o = k.strip(0.34, 0.45);
    const amen = t + 1;
    k.organ(o, t, [31, 43, 50, 55, 59, 62], 0.95, { gain: 0.7, full: true, release: 0.3 });
    k.choir(o, t, [43, 50, 55, 59, 62, 67], 0.95, { gain: 0.6, attack: 0.25, release: 0.35 });
    k.organ(o, amen, [26, 38, 45, 50, 54, 57, 62], 1.7, { gain: 0.8, full: true, attack: 0.08, release: 0.7 });
    k.choir(o, amen, [38, 45, 50, 54, 57, 62, 66], 1.8, { gain: 0.7, vowel: 'eh', attack: 0.2, release: 1 });
    k.timpani(o, amen, 38, 0.6);
    k.bell(o, amen + 0.05, 62, { gain: 0.5, decay: 3 });
  },

  heresy(k, { power = 2 } = {}) {
    const t = k.now();
    const weight = whole(power, 1, 3);
    const o = k.strip([0.34, 0.32, 0.29][weight - 1], 0.45);
    const hit = t + 0.5;
    k.cluster(o, t, 0.5, weight === 1 ? 0.7 : 1.1, { gain: 0.8 });
    k.burst(o, t, 0.2, 0.5, 'lowpass', 300, 0);
    if (weight === 1) return;
    k.brass(o, hit, [38, 39, 44], 0.7, { gain: 0.8, attack: 0.05, release: 0.5, bright: 4, fall: 150 });
    k.taiko(o, hit, 0.8, 52);
    if (weight === 2) return;
    k.impact(o, hit, 1, 2.2);
    k.taiko(o, hit + 0.24, 0.6, 46);
    k.choir(o, hit, [50, 56, 62, 65, 68], 1.6, { gain: 0.8, vowel: 'oh', attack: 0.08, release: 1, bend: -500 });
  },

  destroy(k) {
    const t = k.now();
    const o = k.strip(0.375, 0.4);
    k.impact(o, t, 0.9, 1.5);
    k.taiko(o, t, 0.6, 50);
    k.brass(o, t + 0.03, [38, 50, 53, 57], 0.9, { gain: 0.8, attack: 0.03, release: 0.5, fall: 1200 });
    for (let i = 0; i < 5; i++) k.burst(o, t + 0.12 + k.rand() * 0.5, 0.15, 0.06, 'bandpass', 600 + k.rand() * 2400, 2);
  },

  bell(k, enemy = false) {
    const t = k.now();
    const o = k.strip(0.34, 0.4);
    if (enemy) {
      k.bell(o, t, 50, { gain: 0.8, decay: 3.2 });
      k.taiko(o, t, 0.6, 49, 0.9);
      k.cluster(o, t, 0.3, 1.2, { gain: 0.25 });
      return;
    }
    k.bell(o, t, 62, { gain: 0.8, decay: 3 });
    k.bell(o, t + 0.02, 69, { gain: 0.22, decay: 2.2, partials: TUBULAR });
    k.timpani(o, t, 38, 0.5, 1.2);
  },

  count(k, step = 0) {
    const rung = whole(step, 0, 5);
    k.timpani(k.strip(0.4, 0.3), k.now(), [38, 41, 45, 50, 53, 57][rung], 0.7 + rung * 0.02, 1.1);
  },

  fe(k, step = 0) {
    const t = k.now();
    const rung = whole(step, 0, 8);
    const note = 74 + [0, 2, 4, 7, 9, 12, 14, 16, 19][rung];
    const o = k.strip(0.42 + rung * 0.015, 0.45);
    k.choir(o, t, [note - 12, Math.min(note, 86)], 0.3, { gain: 0.5, attack: 0.05, release: 0.45 });
    k.bell(o, t, note, { gain: 0.5, decay: 1.5, partials: TUBULAR });
  },

  nofaith(k) {
    const t = k.now();
    const o = k.strip(0.32, 0.12);
    k.drum(o, t, 62, { gain: 0.6, decay: 0.3, drop: 1.25, thump: 0.9, snap: 0 });
    k.drum(o, t + 0.17, 52, { gain: 0.4, decay: 0.34, drop: 1.2, thump: 0.7, snap: 0 });
  },

  majority(k, mine = true) {
    const t = k.now();
    const o = k.strip(mine ? 0.52 : 0.465, 0.45);
    const hit = t + 0.62;
    if (mine) {
      k.roll(o, t, 45, 0.6, 0.12, 0.55);
      k.riser(o, t, 0.6, { gain: 0.2, note: 57 });
      [57, 62, 66].forEach((note, i) => k.brass(o, hit - 0.36 + i * 0.12, [note - 12, note], 0.09, { gain: 0.5, attack: 0.025, release: 0.08 }));
      k.taiko(o, hit, 0.8);
      k.timpani(o, hit, 38, 0.6, 1.6);
      k.brass(o, hit, [38, 50, 57, 62, 66, 69], 0.7, { gain: 1, attack: 0.05, release: 0.15 });
      k.choir(o, hit, [50, 57, 62, 66, 69, 74], 2, { gain: 0.8, attack: 0.15, release: 0.8 });
      k.bell(o, hit, 74, { gain: 0.4, decay: 2.4, partials: TUBULAR });
      k.timpani(o, hit + 0.5, 45, 0.4);
      k.timpani(o, hit + 0.75, 38, 0.6, 1.6);
      k.brass(o, hit + 0.75, [38, 50, 57, 62, 66, 69, 74], 1.2, { gain: 1.1, attack: 0.05, release: 0.4 });
      k.bell(o, hit + 0.75, 81, { gain: 0.4, decay: 2.4, partials: TUBULAR });
      return;
    }
    k.roll(o, t, 38, 0.6, 0.12, 0.5);
    k.cluster(o, t, 0.6, 1, { gain: 0.6 });
    k.impact(o, hit, 0.8, 1.8);
    k.taiko(o, hit, 0.8, 48);
    k.brass(o, hit, [38, 45, 50, 53, 57], 0.62, { gain: 1, attack: 0.05, release: 0.15, bright: 4 });
    k.choir(o, hit, [38, 45, 50, 53, 57], 0.62, { gain: 0.6, vowel: 'oh', attack: 0.12, release: 0.2 });
    k.bell(o, hit, 50, { gain: 0.6, decay: 3 });
    k.taiko(o, hit + 0.7, 0.9, 44, 1);
    k.brass(o, hit + 0.7, [34, 46, 53, 58, 61], 1.2, { gain: 1.1, attack: 0.06, release: 0.5, bright: 4 });
    k.choir(o, hit + 0.7, [46, 53, 58, 61, 65], 1.3, { gain: 0.8, vowel: 'oh', attack: 0.15, release: 0.9 });
  },

  hegemony(k) {
    const t = k.now();
    const o = k.strip(0.294, 0.5);
    const home = t + 0.7;
    k.taiko(o, t, 0.8);
    k.timpani(o, t, 38, 0.6, 1.8);
    k.organ(o, t, [26, 38, 45, 50, 55, 57, 62, 67, 69, 74], 0.66, { gain: 1, full: true, attack: 0.03, release: 0.12 });
    k.choir(o, t, [50, 57, 62, 67, 69, 74], 0.66, { gain: 0.7, attack: 0.12, release: 0.2 });
    k.roll(o, t + 0.3, 45, 0.38, 0.15, 0.5);
    k.taiko(o, home, 0.9, 54);
    k.timpani(o, home, 38, 0.65, 2);
    k.organ(o, home, [26, 38, 45, 50, 54, 57, 62, 66, 69, 74], 1.9, { gain: 1.1, full: true, attack: 0.03, release: 0.8 });
    k.choir(o, home, [50, 57, 62, 66, 69, 74, 78], 2, { gain: 0.8, attack: 0.15, release: 1 });
    k.bell(o, home, 62, { gain: 0.5, decay: 3.5 });
    [86, 81, 78, 74, 81, 86].forEach((note, i) => k.bell(k.strip(0.294, 0.5, i % 2 ? 0.5 : -0.5), home + i * 0.21, note, { gain: 0.35, decay: 2.2, partials: TUBULAR }));
  },

  fervor(k, level = 1) {
    const t = k.now();
    const rung = whole(level, 1, 6) - 1;
    const o = k.strip(0.4 + rung * 0.03, 0.35);
    const figure = [0, 2, 4, 7].map(step => scale(62, step + rung * 2));
    k.riser(o, t, 0.22, { gain: 0.25, note: figure[0] });
    k.drum(o, t, 80, { gain: 0.5, decay: 0.3, drop: 2 });
    figure.forEach((note, i) => k.brass(o, t + 0.06 + i * 0.06, [note], i === 3 ? 0.32 : 0.05, { gain: 0.5 + i * 0.08, attack: 0.02, release: 0.09, bright: 7 }));
    k.bell(o, t + 0.24, figure[3] + 12, { gain: 0.3, decay: 1.1, partials: TUBULAR });
  },

  trigger(k) {
    const t = k.now();
    const o = k.strip(0.74, 0.03);
    k.bell(o, t, 81, { gain: 0.4, decay: 0.3, partials: HANDBELL });
    k.bell(o, t + 0.06, 86, { gain: 0.5, decay: 0.5, partials: HANDBELL });
  },

  office(k) {
    const t = k.now();
    const o = k.strip(0.475, 0.4);
    k.organ(o, t, [69], 0.14, { gain: 0.4, attack: 0.02, release: 0.1 });
    k.organ(o, t + 0.16, [62, 74], 0.4, { gain: 0.5, attack: 0.02, release: 0.4 });
    k.choir(o, t + 0.16, [62, 69], 0.35, { gain: 0.25, attack: 0.15, release: 0.5 });
    k.bell(o, t + 0.16, 86, { gain: 0.3, decay: 1.2, partials: HANDBELL });
  },

  active(k) {
    const t = k.now();
    const o = k.strip(0.49, 0.35);
    k.drum(o, t, 73, { gain: 0.5, decay: 0.4, drop: 1.8, thump: 0.8 });
    k.brass(o, t, [50, 57], 0.3, { gain: 0.6, attack: 0.04, release: 0.25 });
    k.brass(o, t + 0.12, [62], 0.3, { gain: 0.4, attack: 0.05, release: 0.3 });
  },

  saint(k, enemy = false) {
    const t = k.now();
    const o = k.strip(enemy ? 0.375 : 0.29, 0.5);
    const third = enemy ? 53 : 54;
    const vowel = enemy ? 'oh' : 'ah';
    const peak = t + 2.45;
    k.organ(o, t, [26, 38], 3, { gain: 0.7, full: true, attack: 0.5, release: 0.9 });
    k.choir(o, t, [38, 45, 50, third, 57], 3, { gain: 0.8, vowel, attack: 2.4, release: 0.9 });
    k.choir(o, t + 0.9, [62, third + 12, 69, 74], 2.1, { gain: 0.7, vowel, attack: 1.5, release: 0.9 });
    [0, 0.9, 1.6, 2.1].forEach((at, i) => k.taiko(o, t + at, 0.4 + i * 0.12, enemy ? 46 : 55));
    k.taiko(o, peak, 0.95, enemy ? 44 : 52, 1.1);
    k.timpani(o, peak, 38, 0.6, 1.8);
    if (enemy) {
      k.cluster(o, t, 2.4, 0.8, { gain: 0.4 });
      k.bell(o, t, 50, { gain: 0.6, decay: 3.5 });
      k.bell(o, t + 1.6, 50, { gain: 0.7, decay: 3.5 });
      k.brass(o, peak, [38, 45, 50, 53], 0.5, { gain: 0.8, attack: 0.05, release: 0.5, bright: 4 });
      return;
    }
    k.bell(o, t, 62, { gain: 0.6, decay: 3.2 });
    k.bell(o, t + 1, 69, { gain: 0.5, decay: 3, partials: TUBULAR });
    k.bell(o, t + 1.8, 74, { gain: 0.5, decay: 3, partials: TUBULAR });
    k.bell(o, peak, 62, { gain: 0.7, decay: 3.5 });
    k.organ(o, peak, [38, 50, 57, 62, 66, 69, 74], 0.5, { gain: 0.9, full: true, attack: 0.03, release: 0.6 });
  },

  loss(k) {
    const t = k.now();
    const o = k.strip(0.44, 0.4);
    k.drum(o, t, 58, { gain: 0.5, decay: 0.45, drop: 1.4, thump: 0.8, snap: 0 });
    k.organ(o, t, [38], 0.7, { gain: 0.3, attack: 0.05, release: 0.5 });
    k.choir(o, t, [53, 65], 0.26, { gain: 0.6, vowel: 'oh', attack: 0.04, release: 0.15 });
    k.choir(o, t + 0.3, [52, 64], 0.45, { gain: 0.5, vowel: 'oh', attack: 0.06, release: 0.6 });
  },

  win(k) {
    const t = k.now();
    const o = k.strip(0.284, 0.5);
    const home = t + 2;
    k.roll(o, t, 45, 0.5, 0.12, 0.55);
    k.riser(o, t, 0.5, { gain: 0.2, note: 57 });
    [[0.5, 34, [46, 53, 58, 62, 65], [58, 62, 65, 70]], [1.25, 36, [48, 55, 60, 64, 67], [60, 64, 67, 72]]].forEach(([at, bass, chord, call]) => {
      k.taiko(o, t + at, 0.8);
      k.timpani(o, t + at, bass + 12, 0.6);
      k.organ(o, t + at, [bass, ...chord], 0.7, { gain: 0.9, full: true, attack: 0.03, release: 0.12 });
      k.brass(o, t + at, [bass + 12, ...chord], 0.68, { gain: 0.9, attack: 0.05, release: 0.12 });
      call.forEach((note, i) => k.brass(o, t + at + i * 0.11, [note], i === 3 ? 0.36 : 0.08, { gain: 0.5, attack: 0.025, release: 0.08, bright: 7 }));
    });
    k.taiko(o, home, 0.95, 54, 1);
    k.timpani(o, home, 38, 0.7, 2);
    k.organ(o, home, [26, 38, 45, 50, 54, 57, 62, 66, 69, 74], 2.8, { gain: 1.1, full: true, attack: 0.03, release: 1 });
    k.brass(o, home, [38, 50, 57, 62, 66, 69], 2.7, { gain: 0.9, attack: 0.05, release: 0.8 });
    k.choir(o, home, [50, 57, 62, 66, 69, 74, 78], 2.8, { gain: 0.9, attack: 0.6, release: 1.1 });
    [[0, 62], [0.11, 66], [0.22, 69], [0.33, 74], [0.9, 78], [1.3, 81]].forEach(([at, note], i) => k.brass(o, home + at, [note], i < 3 ? 0.08 : i === 5 ? 1.4 : 0.5, { gain: 0.6, attack: 0.03, release: i === 5 ? 0.8 : 0.1, bright: 7 }));
    [86, 85, 83, 81, 79, 78, 76, 74, 86, 85, 83, 81, 79, 78, 76, 74].forEach((note, i) => k.bell(k.strip(0.284, 0.5, i % 2 ? 0.55 : -0.55), home + i * 0.17, note, { gain: 0.35, decay: 2.2, partials: TUBULAR }));
    k.bell(o, home, 62, { gain: 0.6, decay: 4 });
    k.timpani(o, home + 0.75, 45, 0.45);
    k.timpani(o, home + 1.5, 38, 0.55, 1.6);
    k.roll(o, home + 2, 38, 0.45, 0.15, 0.5);
    k.taiko(o, home + 2.45, 0.9, 52, 1.2);
    k.timpani(o, home + 2.45, 38, 0.7, 2.2);
    k.bell(o, home + 2.45, 62, { gain: 0.6, decay: 4 });
  },

  lose(k) {
    const t = k.now();
    const o = k.strip(0.27, 0.5);
    const beat = 0.52;
    k.organ(o, t, [26, 38], beat * 8 + 0.9, { gain: 0.5, attack: 0.3, release: 1.2 });
    [53, 52, 53, 50, 52, 48, 50, 50].forEach((note, i) => {
      const last = i === 7;
      const dur = last ? 1.3 : beat * 0.96;
      k.choir(o, t + i * beat, [note - 12, note], dur, { gain: 0.8, vowel: 'oh', attack: 0.09, release: last ? 1.2 : 0.16 });
      k.organ(o, t + i * beat, [note - 12, note], dur, { gain: 0.5, attack: 0.04, release: last ? 1 : 0.1 });
    });
    k.bell(o, t, 50, { gain: 0.6, decay: 4 });
    k.taiko(o, t, 0.6, 46, 1);
    k.bell(o, t + beat * 7, 50, { gain: 0.7, decay: 4.5 });
    k.taiko(o, t + beat * 7, 0.8, 44, 1.2);
  },

  nope(k) {
    const t = k.now();
    const o = k.strip(0.46, 0.02);
    k.wood(o, t, 98, 0.5, 0.13);
    k.wood(o, t + 0.09, 92.5, 0.42, 0.16);
  }
};

function createMusic(k) {
  const { ctx } = k;
  const BEAT = 0.25;
  const BAR = 8;
  const PHRASE = 32;
  const LEVEL = 0.13;
  const MINE = [[50, 57, 62, 65], [48, 55, 60, 64], [43, 55, 59, 62], [50, 57, 60, 65], [53, 57, 60, 65], [52, 55, 60, 64], [45, 57, 60, 64], [45, 57, 62, 64]];
  const THEIRS = [[50, 57, 62, 65], [46, 53, 58, 62], [43, 55, 58, 62], [50, 57, 62, 65], [46, 53, 58, 65], [48, 55, 60, 64], [45, 57, 60, 64], [45, 57, 61, 64]];
  const FIGURE = [0, 0, 1, 0, 2, 0, 1, 3];
  const STROKES = [1, 0, 0.45, 0.5, 0.8, 0, 0.5, 0.65];
  let rig = null;
  let timer = null;
  let origin = 0;
  let step = 0;
  let sung = -1;
  let chord = MINE[0];
  let intensity = 0;
  let mine = true;

  const fade = (low, high) => {
    const x = clamp((intensity - low) / (high - low), 0, 1);
    return x * x * (3 - 2 * x);
  };
  const levels = () => ({ pad: 1, choir: fade(0.15, 0.45), pulse: fade(0.5, 0.7), drive: fade(0.75, 0.95) });

  function apply(glide) {
    if (!rig) return;
    const at = ctx.currentTime;
    const level = levels();
    const set = (param, value) => {
      param.cancelScheduledValues(at);
      if (glide) param.setTargetAtTime(value, at, glide);
      else param.setValueAtTime(value, at);
    };
    for (const name of Object.keys(level)) set(rig.layers[name].gain, level[name]);
    set(rig.shade.frequency, mine ? 7000 : 2400);
    set(rig.bus.gain, LEVEL * (0.75 + 0.25 * intensity));
  }

  function playStep(index, at) {
    const { layers } = rig;
    const level = levels();
    const phrase = Math.floor(index / PHRASE);
    const beat = index % BAR;
    if (phrase !== sung) {
      sung = phrase;
      chord = (mine ? MINE : THEIRS)[phrase % MINE.length];
      const dur = origin + (phrase + 1) * PHRASE * BEAT - at;
      if (dur > 2) {
        k.organ(layers.pad, at, [26, 38], dur, { gain: 0.7, attack: 1.6, release: 2.4 });
        k.organ(layers.pad, at, chord, dur, { gain: 0.5, attack: 1.6, release: 2.4 });
        k.choir(layers.choir, at, chord, dur, { gain: 0.8, attack: 2, release: 2.6 });
      }
    }
    if (level.pulse > 0.01) {
      if (beat === 0) k.timpani(layers.pulse, at, 38, 0.55, 1.5);
      if (index % PHRASE === PHRASE - 2) k.timpani(layers.pulse, at, 45, 0.3, 0.9);
    }
    if (level.drive > 0.01) {
      const stroke = STROKES[beat];
      k.strings(layers.drive, at, chord[FIGURE[beat]], 0.22, beat % 4 ? 0.5 : 0.7);
      if (stroke) k.taiko(layers.drive, at, stroke * 0.45, stroke >= 0.8 ? 55 : 84, stroke >= 0.8 ? 0.6 : 0.3);
      if (beat === BAR - 1) k.taiko(layers.drive, at + BEAT / 2, 0.2, 84, 0.25);
    }
  }

  function schedule(until) {
    k.track(rig.voices);
    while (origin + step * BEAT < until) {
      playStep(step, origin + step * BEAT);
      step++;
    }
    k.track(null);
  }

  function tick() {
    const at = ctx.currentTime;
    const late = at - (origin + step * BEAT);
    if (late > 0) step += Math.ceil(late / BEAT);
    schedule(at + 1.2);
  }

  return {
    start() {
      if (rig) return;
      const bus = k.amp(0);
      const shade = k.filter('lowpass', 7000, 0);
      const layers = { pad: k.amp(1), choir: k.amp(0), pulse: k.amp(0), drive: k.amp(0) };
      for (const layer of Object.values(layers)) layer.connect(shade);
      shade.connect(bus).connect(k.strip(1, 0.4));
      rig = { bus, shade, layers, voices: new Set() };
      origin = ctx.currentTime + 0.1;
      step = 0;
      sung = -1;
      apply(0);
      if (ctx.length) {
        schedule(ctx.length / ctx.sampleRate);
        return;
      }
      tick();
      timer = setInterval(tick, 200);
    },
    stop() {
      if (!rig) return;
      clearInterval(timer);
      const at = ctx.currentTime;
      rig.bus.gain.cancelScheduledValues(at);
      rig.bus.gain.setTargetAtTime(0, at, 0.2);
      for (const voice of rig.voices) voice.stop(at + 1.2);
      rig = null;
    },
    setIntensity(value) {
      intensity = clamp(Number(value) || 0, 0, 1);
      apply(1.2);
    },
    setTurn(value) {
      mine = Boolean(value);
      apply(1.2);
    }
  };
}

const kept = new WeakMap();

export function createSound(ctx, destination = ctx.destination) {
  const kit = createKit(ctx, destination);
  kept.set(ctx, [...(kept.get(ctx) || []), kit]);
  const sfx = Object.fromEntries(Object.entries(EFFECTS).map(([name, play]) => [name, arg => play(kit, arg)]));
  return { sfx, music: createMusic(kit), master: kit.master };
}

const MODES = ['tudo', 'efeitos', 'mudo'];
const KEY = 'khristos-som';
const OLD_KEY = 'khristos-mudo';

function recall() {
  try {
    const saved = localStorage.getItem(KEY);
    if (MODES.includes(saved)) return saved;
    if (localStorage.getItem(OLD_KEY) !== '1') return 'tudo';
    localStorage.setItem(KEY, 'mudo');
    localStorage.removeItem(OLD_KEY);
    return 'mudo';
  } catch {
    return 'tudo';
  }
}

let mode = recall();
let audible = mode === 'mudo' ? 'tudo' : mode;
let live = null;
let wanted = false;
let intensity = 0;
let mine = true;

function ensure() {
  if (!live) {
    if (!globalThis.AudioContext) return null;
    const ctx = new AudioContext();
    live = { ctx, ...createSound(ctx) };
  }
  if (live.ctx.state !== 'running') live.ctx.resume();
  return live;
}

function sync() {
  const sound = wanted && mode === 'tudo' ? ensure() : null;
  if (sound) {
    sound.music.setIntensity(intensity);
    sound.music.setTurn(mine);
    sound.music.start();
  } else if (live) {
    live.music.stop();
  }
  if (live) live.master.gain.setTargetAtTime(mode === 'mudo' ? 0 : 1, live.ctx.currentTime, 0.02);
}

function setMode(next) {
  mode = next;
  if (mode !== 'mudo') audible = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    audible = mode === 'mudo' ? audible : mode;
  }
  sync();
  return mode;
}

if (typeof addEventListener === 'function') {
  for (const type of ['pointerdown', 'keydown']) {
    addEventListener(type, () => {
      if (live && live.ctx.state !== 'running') live.ctx.resume();
    }, true);
  }
}

export const sfx = Object.fromEntries(Object.keys(EFFECTS).map(name => [name, arg => {
  if (mode === 'mudo') return;
  try {
    const sound = ensure();
    if (sound) sound.sfx[name](arg);
  } catch (error) {
    console.error(`Som "${name}" falhou`, error);
  }
}]));

export const music = {
  start() {
    wanted = true;
    sync();
  },
  stop() {
    wanted = false;
    sync();
  },
  setIntensity(value) {
    intensity = value;
    if (live) live.music.setIntensity(value);
  },
  setTurn(value) {
    mine = value;
    if (live) live.music.setTurn(value);
  }
};

export const soundMode = () => mode;
export const cycleSoundMode = () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
export const isMuted = () => mode === 'mudo';
export const toggleMute = () => setMode(mode === 'mudo' ? audible : 'mudo') === 'mudo';
