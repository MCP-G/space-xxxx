import * as Tone from 'tone';

const THREE_clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Procedural synth engine, M0 edition: one adaptive station groove.
 * Acid-ish bassline (16-step), euclidean hat pattern, drifting pad,
 * everything through a bitcrusher into a limiter. Footsteps are FM blips.
 */
export type MusicMode = 'station' | 'flight' | 'danger';

export class AudioDirector {
  private started = false;
  private master!: Tone.Limiter;
  private crusher!: Tone.BitCrusher;
  private footSynth!: Tone.MembraneSynth;
  private padChannel!: Tone.Channel;
  private leadChannel!: Tone.Channel;
  private kick!: Tone.MembraneSynth;
  private hatChannel!: Tone.Channel;
  private thrustNoise!: Tone.Noise;
  private thrustGain!: Tone.Gain;
  private mode: MusicMode = 'station';
  private intensity = 0;
  private intensityClock = 0;

  async start() {
    if (this.started) return;
    this.started = true;
    await Tone.start();

    this.master = new Tone.Limiter(-1).toDestination();
    this.crusher = new Tone.BitCrusher(6).connect(this.master);
    this.crusher.wet.value = 0.35;

    // --- acid bass: MonoSynth + filter envelope, A minor-ish 16-step line
    const bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.1, release: 0.1 },
      filterEnvelope: {
        attack: 0.002, decay: 0.12, sustain: 0.2, release: 0.1,
        baseFrequency: 120, octaves: 3.2,
      },
    }).connect(this.crusher);
    bass.volume.value = -10;

    const bassSteps: (string | null)[] = [
      'A1', null, 'A1', 'A2', null, 'A1', 'C2', null,
      'A1', null, 'G1', null, 'A2', 'A1', null, 'E2',
    ];
    new Tone.Sequence(
      (time, note) => { if (note) bass.triggerAttackRelease(note, '16n', time); },
      bassSteps, '16n'
    ).start(0);

    // --- hats: euclidean-ish noise ticks
    this.hatChannel = new Tone.Channel(0).connect(this.crusher);
    const hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    }).connect(this.hatChannel);
    hat.volume.value = -22;
    const hatSteps = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];
    new Tone.Sequence(
      (time, hit) => { if (hit) hat.triggerAttackRelease('16n', time); },
      hatSteps, '16n'
    ).start(0);

    // --- kick: four on the floor, obviously
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    }).connect(this.master);
    this.kick.volume.value = -12; // quiet at rest; intensity brings it up
    new Tone.Loop((time) => this.kick.triggerAttackRelease('C1', '8n', time), '4n').start(0);

    // --- pad: slow drifting chords, heavily crushed, very station-ambience
    this.padChannel = new Tone.Channel(0).connect(this.crusher);
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 1.5, decay: 1, sustain: 0.6, release: 3 },
    });
    const padFilter = new Tone.Filter(800, 'lowpass').connect(this.padChannel);
    pad.connect(padFilter);
    pad.volume.value = -18;
    const chords = [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'], ['A2', 'C3', 'G3']];
    let chordIdx = 0;
    new Tone.Loop((time) => {
      pad.triggerAttackRelease(chords[chordIdx % chords.length], '2n', time);
      chordIdx++;
    }, '1m').start(0);

    // --- flight lead: square-wave arp, muted in station mode
    this.leadChannel = new Tone.Channel(-60).connect(this.crusher);
    const lead = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.15, release: 0.08 },
      filterEnvelope: {
        attack: 0.002, decay: 0.08, sustain: 0.3, release: 0.1,
        baseFrequency: 400, octaves: 2.5,
      },
    }).connect(this.leadChannel);
    lead.volume.value = -12;
    const arp = ['A3', 'C4', 'E4', 'A4', 'G4', 'E4', 'C4', 'E3'];
    let arpIdx = 0;
    new Tone.Loop((time) => {
      lead.triggerAttackRelease(arp[arpIdx % arp.length], '16n', time);
      arpIdx += (arpIdx % 5 === 0) ? 2 : 1; // limp slightly, on purpose
    }, '8n').start(0);

    // --- engine thrust: filtered brown noise, gain driven by game
    this.thrustNoise = new Tone.Noise('brown').start();
    this.thrustGain = new Tone.Gain(0).connect(this.master);
    const thrustFilter = new Tone.Filter(220, 'lowpass').connect(this.thrustGain);
    this.thrustNoise.connect(thrustFilter);

    // --- footsteps
    this.footSynth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
    }).connect(this.master);
    this.footSynth.volume.value = -14;

    Tone.getTransport().bpm.value = 124;
    Tone.getTransport().start();
  }

  /** Crossfade between station groove and flight mode (faster, lead in). */
  setMode(mode: MusicMode) {
    if (!this.started || mode === this.mode) return;
    this.mode = mode;
    if (mode === 'flight') {
      this.padChannel.volume.rampTo(-14, 1.5);
      this.leadChannel.volume.rampTo(0, 1.5);
      this.crusher.wet.rampTo(0.35, 1);
    } else if (mode === 'danger') {
      this.padChannel.volume.rampTo(-24, 0.8);
      this.leadChannel.volume.rampTo(3, 0.8);
      this.crusher.wet.rampTo(0.55, 0.5);
    } else {
      this.padChannel.volume.rampTo(0, 1.5);
      this.leadChannel.volume.rampTo(-60, 1.5);
      this.crusher.wet.rampTo(0.35, 1);
    }
    this.applyIntensity(true);
  }

  /**
   * Continuous intensity 0..1 — walking pace on foot, velocity in flight.
   * Drives tempo, kick weight, and hat energy so the music audibly tracks
   * how fast life is currently happening. Throttled internally.
   */
  setIntensity(level: number, dt: number) {
    if (!this.started) return;
    this.intensity = THREE_clamp(level, 0, 1);
    this.intensityClock -= dt;
    if (this.intensityClock <= 0) {
      this.intensityClock = 0.4;
      this.applyIntensity(false);
    }
  }

  private lastBpm = 0;

  private applyIntensity(immediate: boolean) {
    const t = immediate ? 0.6 : 0.45;
    const i = this.intensity;
    const baseBpm = this.mode === 'station' ? 116 : this.mode === 'flight' ? 132 : 150;
    const bpmSpread = this.mode === 'station' ? 12 : 22;
    // bpm set discretely — TickSignal automation (rampTo) accumulates events
    // and can hang the audio graph, so we snap in whole-bpm steps instead
    const targetBpm = Math.round(baseBpm + i * bpmSpread);
    if (targetBpm !== this.lastBpm) {
      this.lastBpm = targetBpm;
      Tone.getTransport().bpm.value = targetBpm;
    }
    // kick: a heartbeat when idle, a club when moving fast
    this.kick.volume.rampTo(-14 + i * 10, t);
    this.hatChannel.volume.rampTo(-6 + i * 6, t);
    if (this.mode === 'flight') this.leadChannel.volume.rampTo(-6 + i * 8, t);
  }

  /**
   * Navigation chime. aligned=1: pleasant rising major third (you're on
   * course, the universe approves for once). aligned=0: flat low blip.
   * In between: increasingly in-tune.
   */
  navPing(aligned: number) {
    if (!this.started) return;
    const s = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.22, sustain: 0, release: 0.1 },
    }).connect(this.master);
    s.volume.value = -16;
    if (aligned > 0.7) {
      s.triggerAttackRelease('A5', '16n');
      const s2 = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
      }).connect(this.master);
      s2.volume.value = -18;
      setTimeout(() => { s2.triggerAttackRelease('C#6', '16n'); setTimeout(() => s2.dispose(), 600); }, 90);
    } else {
      // detune toward sour as you drift off course
      const freq = 220 + aligned * 200;
      s.triggerAttackRelease(freq, '32n');
    }
    setTimeout(() => s.dispose(), 700);
  }

  /** Blaster discharge: descending zap. */
  zap() {
    if (!this.started) return;
    const s = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 },
    }).connect(this.crusher);
    s.frequency.value = 900;
    s.triggerAttackRelease(900, '16n');
    s.frequency.rampTo(120, 0.12);
    setTimeout(() => s.dispose(), 400);
  }

  /** Pulse cannon: a deep descending whomp with bite. */
  pulse() {
    if (!this.started) return;
    const s = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.05 },
      filterEnvelope: {
        attack: 0.001, decay: 0.3, sustain: 0, release: 0.05,
        baseFrequency: 800, octaves: -2.5,
      },
    }).connect(this.crusher);
    s.volume.value = -6;
    s.triggerAttackRelease('A1', '8n');
    setTimeout(() => s.dispose(), 800);
  }

  /** Something exploded. Probably fine. */
  boom() {
    if (!this.started) return;
    const n = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.002, decay: 0.5, sustain: 0 },
    }).connect(this.master);
    n.volume.value = -4;
    n.triggerAttackRelease('4n');
    setTimeout(() => n.dispose(), 1200);
  }

  /** Engine rumble loudness, 0..1 (thrust input + speed). */
  setThrust(level: number) {
    if (!this.started) return;
    this.thrustGain.gain.rampTo(Math.min(level, 1) * 0.5, 0.1);
  }

  footstep() {
    if (!this.started) return;
    const note = 60 + Math.random() * 25;
    this.footSynth.triggerAttackRelease(note, '16n');
  }

  /** Crank the bitcrusher momentarily — pairs with visual glitches. */
  glitchBurst() {
    if (!this.started) return;
    this.crusher.wet.rampTo(0.9, 0.02);
    this.crusher.wet.rampTo(0.35, 0.4);
  }
}
