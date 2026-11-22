// Decodificador y Parser nativo de archivos MIDI estándar (.mid) en JavaScript
import { SheetGeneratorAlgorithm } from './sheetGenerator.js';

export class MidiParser {
  // Parsea un ArrayBuffer de un archivo MIDI estándar y devuelve las notas estructuradas
  static parse(arrayBuffer, defaultBpm = 120) {
    const data = new DataView(arrayBuffer);
    let offset = 0;

    // 1. Validar cabecera 'MThd' (0x4D546864)
    if (data.getUint32(0) !== 0x4D546864) {
      throw new Error('El archivo no tiene el formato estándar MIDI (MThd inválido).');
    }
    offset += 8; // Saltar 'MThd' y longitud del encabezado (normalmente 6)

    const formatType = data.getUint16(offset);
    const numTracks = data.getUint16(offset + 2);
    const timeDivision = data.getUint16(offset + 4);
    offset += 6;

    let currentTempoMicros = 500000; // 120 BPM por defecto (500,000 µs por negra)
    const allTracksNotes = [];

    // 2. Iterar por cada pista ('MTrk')
    for (let trackIndex = 0; trackIndex < numTracks && offset < data.byteLength; trackIndex++) {
      if (offset + 8 > data.byteLength) break;
      const trackMagic = data.getUint32(offset);
      const trackLength = data.getUint32(offset + 4);
      offset += 8;

      if (trackMagic !== 0x4D54726B) { // 'MTrk'
        offset += trackLength;
        continue;
      }

      const trackEnd = offset + trackLength;
      let trackTimeTicks = 0;
      let lastStatus = 0;
      const activeNotes = new Map(); // Para rastrear Note On y calcular duración en Note Off
      const trackNotes = [];

      while (offset < trackEnd && offset < data.byteLength) {
        // Leer delta-time de longitud variable (VLQ)
        let deltaTime = 0;
        let byte = 0;
        do {
          byte = data.getUint8(offset++);
          deltaTime = (deltaTime << 7) | (byte & 0x7F);
        } while (byte & 0x80);

        trackTimeTicks += deltaTime;

        // Leer byte de estado o usar running status
        let status = data.getUint8(offset);
        if (status & 0x80) {
          offset++;
          lastStatus = status;
        } else {
          status = lastStatus;
        }

        const eventType = status >> 4;
        const channel = status & 0x0F;

        // Eventos Meta (0xFF)
        if (status === 0xFF) {
          const metaType = data.getUint8(offset++);
          let metaLen = 0;
          do {
            byte = data.getUint8(offset++);
            metaLen = (metaLen << 7) | (byte & 0x7F);
          } while (byte & 0x80);

          // Meta evento de Tempo (0x51)
          if (metaType === 0x51 && metaLen === 3) {
            currentTempoMicros = (data.getUint8(offset) << 16) | (data.getUint8(offset + 1) << 8) | data.getUint8(offset + 2);
          }
          offset += metaLen;
          continue;
        }

        // Eventos SysEx (0xF0 o 0xF7)
        if (status === 0xF0 || status === 0xF7) {
          let sysexLen = 0;
          do {
            byte = data.getUint8(offset++);
            sysexLen = (sysexLen << 7) | (byte & 0x7F);
          } while (byte & 0x80);
          offset += sysexLen;
          continue;
        }

        // Eventos de Notas: Note Off (0x8) o Note On (0x9)
        if (eventType === 0x9) { // Note On
          const noteMidi = data.getUint8(offset++);
          const velocity = data.getUint8(offset++);

          if (velocity > 0) {
            // Nota pulsada
            activeNotes.set(noteMidi, {
              startTicks: trackTimeTicks,
              velocity
            });
          } else {
            // Note On con velocidad 0 equivale a Note Off
            this.handleNoteOff(activeNotes, noteMidi, trackTimeTicks, trackNotes);
          }
        } else if (eventType === 0x8) { // Note Off
          const noteMidi = data.getUint8(offset++);
          offset++; // saltar velocidad de liberación
          this.handleNoteOff(activeNotes, noteMidi, trackTimeTicks, trackNotes);
        } else if (eventType === 0xA || eventType === 0xB || eventType === 0xE) {
          offset += 2; // Eventos de 2 bytes (Aftertouch, Control Change, Pitch Bend)
        } else if (eventType === 0xC || eventType === 0xD) {
          offset += 1; // Eventos de 1 byte (Program Change, Channel Pressure)
        }
      }

      if (trackNotes.length > 0) {
        allTracksNotes.push(trackNotes);
      }
    }

    // 3. Seleccionar la pista con mayor riqueza melódica (más notas)
    if (!allTracksNotes.length) {
      throw new Error('El archivo MIDI no contiene pistas con notas audibles.');
    }

    allTracksNotes.sort((a, b) => b.length - a.length);
    const mainTrack = allTracksNotes[0];

    // 4. Convertir ticks a segundos reales según el tempo y la división de tiempo
    const secondsPerTick = (currentTempoMicros / 1000000) / timeDivision;
    const bpm = Math.round(60000000 / currentTempoMicros);

    const convertedNotes = mainTrack.map(n => {
      const durationSec = Math.max(0.2, Math.min(3.0, (n.endTicks - n.startTicks) * secondsPerTick));
      const noteName = SheetGeneratorAlgorithm.midiToNote(n.midi);
      return {
        note: noteName,
        duration: parseFloat(durationSec.toFixed(2)),
        velocity: n.velocity
      };
    });

    return {
      bpm: bpm || defaultBpm,
      notes: convertedNotes
    };
  }

  static handleNoteOff(activeNotes, noteMidi, endTicks, trackNotes) {
    if (activeNotes.has(noteMidi)) {
      const noteData = activeNotes.get(noteMidi);
      activeNotes.delete(noteMidi);
      const startTicks = noteData.startTicks;
      if (endTicks > startTicks) {
        trackNotes.push({
          midi: noteMidi,
          startTicks,
          endTicks,
          velocity: noteData.velocity
        });
      }
    }
  }
}
