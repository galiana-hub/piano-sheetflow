// Algoritmo de adaptación musical por bloque para la tesitura del teclado seleccionado.
// Conserva los intervalos cuando el rango completo cabe; cuando no cabe, informa el plegado de notas.
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

  // Calcula una adaptación de bloque.
  // Conserva los intervalos si todo el rango cabe; si no, marca el plegado por separado.
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

    // Buscar el desplazamiento por semitonos más cercano al centro que conserve
    // también todos los intervalos posibles dentro del rango disponible.
    let bestShift = Math.round((targetCenter - songCenter) / 12) * 12;
    const shiftCandidates = new Set();

    for (let shift = -84; shift <= 84; shift += 12) {
      shiftCandidates.add(shift);
    }

    if (songSpan <= availableSpan) {
      let bestCost = null;
      for (const shift of shiftCandidates) {
        const shiftedMin = songMinMidi + shift;
        const shiftedMax = songMaxMidi + shift;
        if (shiftedMin < targetMinMidi || shiftedMax > targetMaxMidi) continue;

        const centerCost = Math.abs((shiftedMin + shiftedMax) / 2 - targetCenter);
        const cost = [Math.abs(shift), centerCost];
        if (!bestCost ||
            cost[0] < bestCost[0] ||
            (cost[0] === bestCost[0] && cost[1] < bestCost[1])) {
          bestCost = cost;
          bestShift = shift;
        }
      }
    } else {
      // El rango original no cabe completo en un teclado compacto. Se mantiene
      // el desplazamiento por octavas más próximo y se comprime solo después.
      bestShift = Math.round((targetCenter - songCenter) / 12) * 12;
    }

    // Si la melodía cabe completa en el teclado, el desplazamiento por octava es perfecto
    if (songSpan <= availableSpan) {
      return { octaveShift: bestShift, isCompressed: false };
    }

    // Si el teclado físico es ultra compacto (ej. 25 teclas = 24 semitonos) y la canción
    // abarca más de 2 octavas, calculamos la transposición armónica por inversión de tonalidad
    return { octaveShift: bestShift, isCompressed: true, targetMinMidi, targetMaxMidi };
  }

  // Lleva un MIDI fuera del rango al mismo valor tonal más cercano dentro del teclado.
  // Esto garantiza que ningún resultado quede fuera de las notas físicas seleccionadas.
  static foldMidiToRange(midi, targetMinMidi, targetMaxMidi) {
    if (midi >= targetMinMidi && midi <= targetMaxMidi) return midi;

    let bestMidi = midi;
    let bestDistance = Infinity;
    for (let candidate = targetMinMidi; candidate <= targetMaxMidi; candidate++) {
      if (candidate % 12 !== midi % 12) continue;
      const distance = Math.abs(candidate - midi);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMidi = candidate;
      }
    }

    // Un rango que no contiene la clase tonal es improbable, pero se evita
    // devolver una nota fuera de límites con un clamp matemático.
    return bestMidi === midi
      ? Math.max(targetMinMidi, Math.min(targetMaxMidi, midi))
      : bestMidi;
  }

  // GENERADOR DE FLUJO CONTINUO ADAPTADO AL TECLADO
  static generateContinuousFlow(rawNotes, targetKeysCount) {
    if (!rawNotes || !rawNotes.length) {
      return { items: [], totalDuration: 0, minMidi: 60, maxMidi: 72, octaveShift: 0, isCompressed: false, foldedNotesCount: 0 };
    }

    const { octaveShift, isCompressed, targetMinMidi, targetMaxMidi } = 
      this.calculateFidelityTransposition(rawNotes, targetKeysCount);

    let currentTime = 0;
    const processedNotes = [];

    let foldedNotesCount = 0;

    rawNotes.forEach((item, index) => {
      const originalMidi = this.noteToMidi(item.note);
      let adaptedMidi = originalMidi + octaveShift;
      const preFoldMidi = adaptedMidi;

      // En teclados muy pequeños, si una nota extrema sobrepasa el límite físico,
      // se ajusta suavemente conservando la tónica sin romper la frase
      if (isCompressed) {
        const foldedMidi = this.foldMidiToRange(adaptedMidi, targetMinMidi, targetMaxMidi);
        if (foldedMidi !== adaptedMidi) foldedNotesCount++;
        adaptedMidi = foldedMidi;
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
        wasShifted: octaveShift !== 0 || adaptedMidi !== originalMidi,
        wasFolded: isCompressed && adaptedMidi !== preFoldMidi
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
      octaveShift: octaveShift / 12,
      isCompressed,
      foldedNotesCount
    };
  }
}
