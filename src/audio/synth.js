// Motor de audio Web Audio API para piano acústico y pulsómetro/metrónomo

class PianoAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.isMetronomeSoundEnabled = false;
  }

  // Inicializa el contexto de audio tras la primera interacción del usuario
  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Convierte un nombre de nota a frecuencia en Hz
  noteToFrequency(noteName) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = noteName.match(/^([A-G][#b]?)([0-8])$/);
    if (!match) return 440;
    
    let [, note, octave] = match;
    const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    if (flatMap[note]) note = flatMap[note];

    const semitoneOffset = notes.indexOf(note);
    const midiNumber = (parseInt(octave, 10) + 1) * 12 + semitoneOffset;
    return 440 * Math.pow(2, (midiNumber - 69) / 12);
  }

  // Reproduce una nota con envolvente ADSR de piano acústico
  playNote(noteName, duration = 1.2) {
    if (this.isMuted) return;
    this.initContext();

    const freq = typeof noteName === 'number' ? noteName : this.noteToFrequency(noteName);
    const now = this.audioCtx.currentTime;

    const osc1 = this.audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = this.audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.35, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.35);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  // Click de percusión de madera para el pulsómetro / metrónomo
  playMetronomeClick(isDownbeat = false) {
    if (this.isMuted || !this.isMetronomeSoundEnabled) return;
    this.initContext();

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    // Tono más agudo para el primer tiempo de compás
    osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, now);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }
}

export const pianoAudio = new PianoAudioEngine();
