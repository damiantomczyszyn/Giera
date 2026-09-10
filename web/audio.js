// SPDX-License-Identifier: GPL-3.0-only
export const SOUNDS = ['truTuTu','jakBabe','noCoJest','dlaczego','gameOver','zCalychSil',
  'wpiszLogin','nicNieCzuje','kapitanDupa','miernyWynik','sprobujJeszczeRaz','rundaPierwsza','najwyzszyWynik'];

export class Voice {
  constructor(onError) {
    this.buffers = new Map(); this.active = new Set(); this.epoch = 0;
    this.onError = onError; this.volume = .7; this.muted = false;
  }
  async unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) { this.onError(); return; }
    try {
      this.context ??= new AudioContext();
      if (!this.gain) { this.gain = this.context.createGain(); this.gain.connect(this.context.destination); }
      this.setVolume(this.volume, this.muted);
      await this.context.resume();
      this.loading ??= Promise.all(SOUNDS.map(async name => {
        for (const format of ['ogg', 'mp3']) {
          try {
            const response = await fetch(`assets/sounds/${name}.${format}`);
            if (!response.ok) throw new Error('Audio unavailable');
            const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
            this.buffers.set(name, buffer); return;
          } catch { /* Try the original MP3 if OGG decoding is unavailable. */ }
        }
        this.onError();
      }));
      await this.loading;
    } catch { this.onError(); }
  }
  setVolume(value, muted) {
    this.volume = value; this.muted = muted;
    if (this.gain) this.gain.gain.value = muted ? 0 : value;
  }
  stop() {
    this.epoch++;
    for (const source of this.active) { source.onended = null; source.stop(); }
    this.active.clear();
  }
  play(name, next) {
    const buffer = this.buffers.get(name);
    if (!buffer || this.context?.state !== 'running') return false;
    const epoch = this.epoch;
    const source = this.context.createBufferSource(); source.buffer = buffer;
    source.connect(this.gain); this.active.add(source);
    source.onended = () => { this.active.delete(source); if (this.epoch === epoch) next?.(); };
    source.start(); return true;
  }
  sequence(names) {
    if (!names.length) return;
    this.play(names[0], () => this.sequence(names.slice(1)));
  }
  loop() {
    const taunts = ['nicNieCzuje','dlaczego','jakBabe','noCoJest','zCalychSil',null];
    this.play('truTuTu', () => {
      const choice = taunts[Math.floor(Math.random() * taunts.length)];
      if (choice) this.play(choice, () => this.loop()); else this.loop();
    });
  }
}
