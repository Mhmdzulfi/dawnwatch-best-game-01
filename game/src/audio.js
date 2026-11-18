// All of Dawnwatch's sound is synthesised with WebAudio: no audio files, nothing to load. A
// short oscillator blip is a shot, a burst of filtered noise is a shard breaking, two low notes
// are the wave horn. The context is created lazily and unlocked by the first key or click, as
// browsers require; every call is safe before that and simply stays silent.

export function createAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let lastShotAt = 0;

  function unlock() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    try {
      context = new window.AudioContext();
    } catch {
      return;
    }
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  }

  /** One oscillator note: frequency slides from `from` to `to` over `seconds`, then fades out. */
  function tone(from, to, seconds, type, volume, delay = 0) {
    if (context === null || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  /** A burst of noise through a low-pass filter: the crunch of a shard breaking. */
  function noise(seconds, cutoff, volume, delay = 0) {
    if (context === null || muted) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(120, start + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
    source.stop(start + seconds + 0.02);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMuted() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() {
      if (context === null) return;
      const now = performance.now();
      if (now - lastShotAt < 45) return; // a held trigger is a stream, not a stack of blips
      lastShotAt = now;
      tone(880, 220, 0.09, 'square', 0.05);
    },
    boom(big) {
      noise(big ? 0.42 : 0.22, big ? 900 : 1400, big ? 0.5 : 0.28);
      tone(big ? 160 : 220, 40, big ? 0.4 : 0.22, 'triangle', big ? 0.4 : 0.22);
    },
    leak() {
      tone(196, 65, 0.35, 'sawtooth', 0.3);
      noise(0.3, 500, 0.3);
    },
    orb() {
      tone(660, 660, 0.08, 'sine', 0.18);
      tone(990, 990, 0.12, 'sine', 0.18, 0.07);
    },
    waveHorn() {
      tone(262, 262, 0.22, 'triangle', 0.22);
      tone(392, 392, 0.3, 'triangle', 0.22, 0.16);
    },
    win() {
      const notes = [523, 659, 784, 1047];
      for (let index = 0; index < notes.length; index += 1) tone(notes[index], notes[index], 0.34, 'triangle', 0.22, index * 0.13);
    },
    lose() {
      const notes = [392, 330, 262, 196];
      for (let index = 0; index < notes.length; index += 1) tone(notes[index], notes[index] * 0.94, 0.36, 'triangle', 0.22, index * 0.15);
    },
  };
}
