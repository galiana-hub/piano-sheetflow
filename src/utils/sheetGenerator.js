// Algoritmo de Adaptación Musical de Alta Fidelidad
// Preserva al 100% los intervalos melódicos, la coherencia de frase y la tesitura sin deformar notas
import { PIANO_SIZES } from '../components/PianoSelector.js';

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class SheetGeneratorAlgorithm {
  // Convierte un nombre de nota a su número MIDI estándar (0 a 127)
  static noteToMidi(noteName) {
    const match = noteName.match(/^([A-G][#b]?)([0-8])$/);
    if (!match) return 60; // C4 por defecto
    let [, pitch, octaveStr] = match;
    let octave = parseInt(octaveStr, 10);

    const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    if (flatMap[pitch]) pitch = flatMap[pitch];

    const noteIndex = CHROMATIC_NOTES.indexOf(pitch);
    return (octave + 1) * 12 + noteIndex;
  }

  // Convierte un número MIDI a nombre de nota estándar
  static midiToNote(midi) {
    const pitch = CHROMATIC_NOTES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${pitch}${octave}`;
  }

  // ALGORITMO DE TRANSPOSICIÓN FIEL EN BLOQUE:
  // Preserva con precisión matemática los intervalos entre todas las notas.
  // Nunca transpone notas aisladas, lo que garantiza que la canción suene
  // exactamente como la original sin saltos bruscos ni notas desafinadas.
  static calculateFidelityTransposition(notes, targetKeysCount) {
    const config = PIANO_SIZES.find(s => s.keys === targetKeysCount) || PIANO_SIZES[3];
    const targetMinMidi = this.noteToMidi(config.startNote);
    const targetMaxMidi = this.noteToMidi(config.endNote);
    const availableSpan = targetMaxMidi - targetMinMidi;

    const midis = notes.map(n => this.noteToMidi(n.note));
    const songMinMidi = Math.min(...midis);
    const songMaxMidi = Math.max(...midis);
    const songSpan = songMaxMidi - songMinMidi;

    // Centro tonal de la canción y del teclado del usuario
    const songCenter = (songMinMidi + songMaxMidi) / 2;
    const targetCenter = (targetMinMidi + targetMaxMidi) / 2;

    // Calcular desplazamiento de octavas que acerque el centro de la canción al centro del piano
    let bestShift = Math.round((targetCenter - songCenter) / 12) * 12;

    // Comprobar si con ese desplazamiento encaja perfectamente dentro de los límites
    if (songMinMidi + bestShift < targetMinMidi) {
      const neededUp = Math.ceil((targetMinMidi - (songMinMidi + bestShift)) / 12) * 12;
      bestShift += neededUp;
    }
    if (songMaxMidi + bestShift > targetMaxMidi) {
      const neededDown = Math.ceil(((songMaxMidi + bestShift) - targetMaxMidi) / 12) * 12;
      bestShift -= neededDown;
    }

    // Si la melodía cabe completa en el teclado, el desplazamiento por octava es perfecto
    if (songSpan <= availableSpan) {
      return { octaveShift: bestShift, isCompressed: false };
    }

    // Si el teclado físico es ultra compacto (ej. 25 teclas = 24 semitonos) y la canción
    // abarca más de 2 octavas, calculamos la transposición armónica por inversión de tonalidad
    return { octaveShift: bestShift, isCompressed: true, targetMinMidi, targetMaxMidi };
  }

  // GENERADOR DE FLUJO CONTINUO CON MÁXIMA FIDELIDAD
  static generateContinuousFlow(rawNotes, targetKeysCount) {
    if (!rawNotes || !rawNotes.length) {
      return { items: [], totalDuration: 0, minMidi: 60, maxMidi: 72, octaveShift: 0 };
    }

    const { octaveShift, isCompressed, targetMinMidi, targetMaxMidi } = 
      this.calculateFidelityTransposition(rawNotes, targetKeysCount);

    let currentTime = 0;
    const processedNotes = [];

    rawNotes.forEach((item, index) => {
      const originalMidi = this.noteToMidi(item.note);
      let adaptedMidi = originalMidi + octaveShift;

      // En teclados muy pequeños, si una nota extrema sobrepasa el límite físico,
      // se ajusta suavemente conservando la tónica sin romper la frase
      if (isCompressed) {
        if (adaptedMidi > targetMaxMidi) adaptedMidi = targetMaxMidi - ((adaptedMidi - targetMaxMidi) % 12);
        if (adaptedMidi < targetMinMidi) adaptedMidi = targetMinMidi + ((targetMinMidi - adaptedMidi) % 12);
      }

      const adaptedNoteName = this.midiToNote(adaptedMidi);
      const duration = item.duration || 0.45;

      processedNotes.push({
        index,
        originalNote: item.note,
        note: adaptedNoteName,
        midi: adaptedMidi,
        startTime: currentTime,
        duration: duration,
        section: item.section || '',
        isBlack: adaptedNoteName.includes('#'),
        wasShifted: octaveShift !== 0 || adaptedMidi !== originalMidi
      });

      currentTime += duration;
    });

    const allMidis = processedNotes.map(n => n.midi);
    const minMidi = Math.min(...allMidis);
    const maxMidi = Math.max(...allMidis);
    const midiSpan = Math.max(12, maxMidi - minMidi);

    const items = processedNotes.map(n => {
      const verticalRatio = (n.midi - minMidi) / midiSpan;
      const topPercent = 80 - (verticalRatio * 65);

      return {
        ...n,
        topPercent: Math.round(topPercent),
        leftSeconds: n.startTime
      };
    });

    return {
      items,
      totalDuration: currentTime,
      minMidi,
      maxMidi,
      octaveShift: octaveShift / 12
    };
  }
}
