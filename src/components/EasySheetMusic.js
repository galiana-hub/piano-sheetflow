import { pianoAudio } from '../audio/synth.js';
import { PIANO_SIZES } from './PianoSelector.js';

// Mapeo entre cifrado anglosajón y solfeo latino/europeo
const SOLFEGE_MAP = {
  'C': 'Do', 'C#': 'Do#', 'Db': 'Reb',
  'D': 'Re', 'D#': 'Re#', 'Eb': 'Mib',
  'E': 'Mi',
  'F': 'Fa', 'F#': 'Fa#', 'Gb': 'Solb',
  'G': 'Sol', 'G#': 'Sol#', 'Ab': 'Lab',
  'A': 'La', 'A#': 'La#', 'Bb': 'Sib',
  'B': 'Si'
};

export class EasySheetMusicComponent {
  constructor({ song, selectedKeys, onNotePlay, t }) {
    this.song = song;
    this.selectedKeys = selectedKeys;
    this.onNotePlay = onNotePlay;
    this.t = t;
    this.notationMode = 'latin'; // 'latin' (Do Re Mi) o 'anglo' (C D E)
  }

  setSong(song) {
    this.song = song;
  }

  setKeys(keys) {
    this.selectedKeys = keys;
  }

  // Transpone una nota al rango disponible del piano seleccionado
  adaptNoteToRange(noteName) {
    const config = PIANO_SIZES.find(s => s.keys === this.selectedKeys) || PIANO_SIZES[3];
    const match = noteName.match(/^([A-G][#b]?)([0-8])$/);
    if (!match) return { note: noteName, wasAdapted: false, original: noteName };

    const [, pitch, octaveStr] = match;
    let octave = parseInt(octaveStr, 10);
    const originalOctave = octave;

    const minOctave = parseInt(config.startNote.slice(-1), 10);
    const maxOctave = parseInt(config.endNote.slice(-1), 10);

    while (octave > maxOctave) octave -= 1;
    while (octave < minOctave) octave += 1;

    const adaptedNote = `${pitch}${octave}`;
    return {
      note: adaptedNote,
      wasAdapted: octave !== originalOctave,
      original: noteName,
      pitch,
      octave
    };
  }

  // Convierte una nota a texto según el modo de notación
  formatNoteLabel(pitch, octave) {
    if (this.notationMode === 'latin') {
      const solfege = SOLFEGE_MAP[pitch] || pitch;
      return `${solfege}${octave}`;
    }
    return `${pitch}${octave}`;
  }

  // Obtiene todas las notas únicas usadas en la canción para el mapa de teclas
  getUniqueNotesInSong() {
    const unique = new Set();
    const measures = this.song.measures || [{ measureNumber: 1, notes: this.song.notes || [] }];
    measures.forEach(m => {
      m.notes.forEach(n => {
        const adapted = this.adaptNoteToRange(n.note);
        unique.add(adapted.note);
      });
    });
    return Array.from(unique);
  }

  render() {
    const t = this.t;
    const song = this.song;
    const measures = song.measures || [{ measureNumber: 1, notes: song.notes || [] }];
    const uniqueNotes = this.getUniqueNotesInSong();

    return `
      <section class="card-section sheet-full-view" aria-labelledby="easy-sheet-heading">
        <div class="section-header">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <h2 id="easy-sheet-heading" class="section-title">
              <span>📜</span>
              <span>${t('easySheet')} — ${t('overviewMode')}</span>
            </h2>
            <span class="section-badge">${song.title} (${measures.length} ${t('measures')})</span>
          </div>

          <!-- Selector de sistema de notación (Do-Re-Mi vs C-D-E) con botones blancos -->
          <div class="sheet-actions-group">
            <button type="button" id="toggle-notation-btn" class="btn-white btn-sm btn-pill" title="Cambiar sistema de notas">
              <span>🔤</span>
              <span>${this.notationMode === 'latin' ? 'Do - Re - Mi' : 'C - D - E'}</span>
            </button>
            <button type="button" id="print-sheet-btn" class="btn-white btn-sm btn-pill" title="Imprimir o guardar">
              <span>🖨️</span>
              <span>${t('printSheet')}</span>
            </button>
          </div>
        </div>

        <!-- 1. MAPA DE TECLAS DE LA CANCIÓN DE UN VISTAZO -->
        <div class="song-keys-overview">
          <div class="overview-header-row">
            <span class="overview-tag">🗺️ ${t('keysNeededLabel')}:</span>
            <span style="font-size: 0.85rem; color: var(--text-white-dim);">
              ${t('keysNeededDesc')} (${uniqueNotes.length} ${t('notesCount')})
            </span>
          </div>
          <div class="key-pills-row">
            ${uniqueNotes.map(n => {
              const match = n.match(/^([A-G][#b]?)([0-8])$/);
              const label = match ? this.formatNoteLabel(match[1], match[2]) : n;
              return `
                <button type="button" class="key-pill-interactive" data-note="${n}">
                  <span class="pill-dot"></span>
                  <strong>${label}</strong>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. PARTITURA COMPLETA VISUAL EN COMPASES -->
        <div class="sheet-measures-container">
          ${measures.map(m => `
            <div class="measure-card">
              <div class="measure-number-badge">${t('measure')} ${m.measureNumber}</div>
              <div class="measure-notes-row">
                ${m.notes.map(n => {
                  const adapted = this.adaptNoteToRange(n.note);
                  const match = adapted.note.match(/^([A-G][#b]?)([0-8])$/);
                  const label = match ? this.formatNoteLabel(match[1], match[2]) : adapted.note;
                  const durationSec = n.duration || 0.5;
                  const isBlack = adapted.note.includes('#') || adapted.note.includes('b');

                  return `
                    <div 
                      class="sheet-note-block ${isBlack ? 'accidental' : ''} ${adapted.wasAdapted ? 'transposed' : ''}" 
                      data-note="${adapted.note}"
                      title="${label} (${durationSec}s)${adapted.wasAdapted ? ' · ' + t('octaveShifted') : ''}"
                    >
                      <div class="note-duration-bar" style="width: ${Math.min(100, Math.max(30, durationSec * 70))}%;"></div>
                      <div class="note-head">
                        <span class="note-name">${label}</span>
                        ${adapted.wasAdapted ? '<span class="note-shift-indicator">↕</span>' : ''}
                      </div>
                      <span class="note-octave-tag">Oct ${match ? match[2] : ''}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  attachEvents(container) {
    // Alternar entre Do-Re-Mi y C-D-E
    const toggleNotationBtn = container.querySelector('#toggle-notation-btn');
    if (toggleNotationBtn) {
      toggleNotationBtn.addEventListener('click', () => {
        this.notationMode = this.notationMode === 'latin' ? 'anglo' : 'latin';
        // Disparar re-renderizado
        const event = new CustomEvent('notation-changed');
        window.dispatchEvent(event);
      });
    }

    // Botón de imprimir / PDF
    const printBtn = container.querySelector('#print-sheet-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Clic en cualquier nota o pastilla para escucharla al instante
    const noteBlocks = container.querySelectorAll('.sheet-note-block, .key-pill-interactive');
    noteBlocks.forEach(el => {
      el.addEventListener('click', () => {
        const note = el.dataset.note;
        if (note) {
          pianoAudio.playNote(note);
          if (this.onNotePlay) {
            this.onNotePlay(note);
          }
          el.classList.add('note-active-pulse');
          setTimeout(() => el.classList.remove('note-active-pulse'), 300);
        }
      });
    });
  }
}
