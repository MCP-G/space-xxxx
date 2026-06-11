import * as Tone from 'tone';

/**
 * Procedural synth engine, M0 edition: one adaptive station groove.
 * Acid-ish bassline (16-step), euclidean hat pattern, drifting pad,
 * everything through a bitcrusher into a limiter. Footsteps are FM blips.
 */
export class AudioDirector {
  private started = false;
  private master!: Tone.Limiter;
  private crusher!: Tone.BitCrusher;
  private footSynth!: Tone.MembraneSynth;

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
    const hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    }).connect(this.crusher);
    hat.volume.value = -22;
    const hatSteps = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];
    new Tone.Sequence(
      (time, hit) => { if (hit) hat.triggerAttackRelease('16n', time); },
      hatSteps, '16n'
    ).start(0);

    // --- kick: four on the floor, obviously
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    }).connect(this.master);
    kick.volume.value = -6;
    new Tone.Loop((time) => kick.triggerAttackRelease('C1', '8n', time), '4n').start(0);

    // --- pad: slow drifting chords, heavily crushed, very station-ambience
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 1.5, decay: 1, sustain: 0.6, release: 3 },
    });
    const padFilter = new Tone.Filter(800, 'lowpass').connect(this.crusher);
    pad.connect(padFilter);
    pad.volume.value = -18;
    const chords = [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'], ['A2', 'C3', 'G3']];
    let chordIdx = 0;
    new Tone.Loop((time) => {
      pad.triggerAttackRelease(chords[chordIdx % chords.length], '2n', time);
      chordIdx++;
    }, '1m').start(0);

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
