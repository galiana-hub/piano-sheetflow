import { pianoAudio } from '../audio/synth.js';
import { PIANO_SIZES } from './PianoSelector.js';

// Lista estándar de notas en la escala cromática
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class PianoKeyboardComponent {
  constructor({ selectedKeys, t }) {
    this.selectedKeys = selectedKeys;
    this.t = t;
    this.keysData = [];
    this.activeNote = null;
    this.generateKeys();
  }

  setKeys(keys) {
    this.selectedKeys = keys;
    this.generateKeys();
  }

  // Genera el listado ordenado de teclas (blancas y negras) según el tamaño del piano
  generateKeys() {
    const config = PIANO_SIZES.find(s => s.keys === this.selectedKeys) || PIANO_SIZES[3];
    
    // Convertir nota a número de semitono absoluto para iterar
    const startMidi = this.noteNameToMidi(config.startNote);
    const endMidi = this.noteNameToMidi(config.endNote);

    this.keysData = [];
    let whiteKeyIndex = 0;

    for (let midi = startMidi; midi <= endMidi; midi++) {
      const noteName = this.midiToNoteName(midi);
      const isBlack = noteName.includes('#');

      if (!isBlack) {
        this.keysData.push({
          midi,
          noteName,
          isBlack: false,
          whiteIndex: whiteKeyIndex
        });
        whiteKeyIndex++;
      } else {
        // La tecla negra se posiciona en base a la tecla blanca previa
        this.keysData.push({
          midi,
          noteName,
          isBlack: true,
          whiteIndex: whiteKeyIndex - 1
        });
      }
    }
  }

  noteNameToMidi(noteName) {
    const match = noteName.match(/^([A-G]#?)([0-8])$/);
    if (!match) return 60; // C4 por defecto
    const [, note, octave] = match;
    const index = CHROMATIC_NOTES.indexOf(note);
    return (parseInt(octave, 10) + 1) * 12 + index;
  }

  midiToNoteName(midi) {
    const note = CHROMATIC_NOTES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${note}${octave}`;
  }

  // Resalta una tecla visualmente y reproduce el sonido
  triggerNote(noteName) {
    pianoAudio.playNote(noteName);
    this.highlightKey(noteName);
  }

  highlightKey(noteName) {
    const keyEl = document.querySelector(`[data-note="${noteName}"]`);
    if (keyEl) {
      keyEl.classList.add('pressed');
      setTimeout(() => {
        keyEl.classList.remove('pressed');
      }, 300);
    }
  }

  render() {
    const t = this.t;
    // Contar cuántas teclas blancas hay para dimensionar el contenedor
    const whiteKeysCount = this.keysData.filter(k => !k.isBlack).length;
    // Ancho dinámico de tecla según el número de teclas para que quepa bien
    const whiteKeyWidth = Math.max(16, Math.min(36, Math.floor(950 / whiteKeysCount)));
    const blackKeyWidth = Math.round(whiteKeyWidth * 0.65);
    const containerWidth = whiteKeysCount * whiteKeyWidth;

    return `
      <section class="card-section" aria-labelledby="keyboard-heading">
        <div class="section-header">
          <h2 id="keyboard-heading" class="section-title">
            <span>🎶</span>
            <span>${t('interactivePreview')}</span>
          </h2>
          <span class="section-badge">${this.selectedKeys} ${t('keysCount')}</span>
        </div>

        <p style="font-size: 0.88rem; color: var(--text-white-dim); margin-top: -0.5rem;">
          ${t('tapToPlay')}
        </p>

        <div class="piano-wrapper">
          <div 
            class="piano-keyboard" 
            id="piano-keys-container"
            style="width: ${containerWidth}px; min-width: 100%; justify-content: center;"
          >
            ${this.keysData.map(key => {
              if (!key.isBlack) {
                return `
                  <button 
                    type="button"
                    class="white-key" 
                    data-note="${key.noteName}"
                    data-midi="${key.midi}"
                    style="width: ${whiteKeyWidth}px; max-width: ${whiteKeyWidth}px;"
                    title="${key.noteName}"
                    aria-label="${key.noteName}"
                  >
                    <span>${key.noteName.startsWith('C') ? key.noteName : ''}</span>
                  </button>
                `;
              } else {
                // Cálculo de desplazamiento horizontal para teclas negras
                const leftPos = (key.whiteIndex * whiteKeyWidth) + (whiteKeyWidth - blackKeyWidth / 2);
                return `
                  <button 
                    type="button"
                    class="black-key" 
                    data-note="${key.noteName}"
                    data-midi="${key.midi}"
                    style="left: ${leftPos}px; width: ${blackKeyWidth}px;"
                    title="${key.noteName}"
                    aria-label="${key.noteName}"
                  >
                    <span></span>
                  </button>
                `;
              }
            }).join('')}
          </div>
        </div>
      </section>
    `;
  }

  attachEvents(container) {
    const keys = container.querySelectorAll('#piano-keys-container button');
    keys.forEach(btn => {
      const handlePress = (e) => {
        e.preventDefault();
        const note = btn.dataset.note;
        if (note) {
          pianoAudio.playNote(note);
          btn.classList.add('pressed');
        }
      };

      const handleRelease = () => {
        btn.classList.remove('pressed');
      };

      btn.addEventListener('mousedown', handlePress);
      btn.addEventListener('mouseup', handleRelease);
      btn.addEventListener('mouseleave', handleRelease);

      btn.addEventListener('touchstart', handlePress, { passive: false });
      btn.addEventListener('touchend', handleRelease);
    });
  }
}
