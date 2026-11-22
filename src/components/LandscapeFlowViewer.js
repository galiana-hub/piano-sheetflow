import { pianoAudio } from '../audio/synth.js';
import { SheetGeneratorAlgorithm } from '../utils/sheetGenerator.js';
import { SongSearchComponent } from './SongSearch.js';
import { PIANO_SIZES } from './PianoSelector.js';

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class LandscapeFlowViewerComponent {
  constructor({ song, selectedKeys, bpm = 120, speedMultiplier = 1.0, onClose, t }) {
    this.song = song;
    this.selectedKeys = selectedKeys;
    this.bpm = bpm;
    this.speedMultiplier = speedMultiplier;
    this.onClose = onClose;
    this.t = t;
    this.isOpen = false;
    this.isPlaying = false;
    this.animationFrameId = null;
    this.startTime = null;
    this.pausedTime = 0;
    this.playedIndices = new Set();
  }

  open() {
    this.isOpen = true;
    this.playedIndices.clear();
    this.pausedTime = 0;

    // Intentar bloquear orientación en horizontal en móviles (API Screen Orientation)
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {
        // Fallback natural en navegadores de escritorio o sin permiso
      });
    }

    const modal = document.getElementById('landscape-modal-container');
    if (modal) {
      modal.style.display = 'flex';
      modal.innerHTML = this.render();
      this.attachEvents(modal);
    }
  }

  close() {
    this.stopPlayback();
    this.isOpen = false;
    const modal = document.getElementById('landscape-modal-container');
    if (modal) {
      modal.style.display = 'none';
      modal.innerHTML = '';
    }
    if (this.onClose) {
      this.onClose();
    }
  }

  // Genera teclas de piano para el teclado inferior del modo horizontal
  generatePianoKeys() {
    const config = PIANO_SIZES.find(s => s.keys === this.selectedKeys) || PIANO_SIZES[3];
    const startMidi = SheetGeneratorAlgorithm.noteToMidi(config.startNote);
    const endMidi = SheetGeneratorAlgorithm.noteToMidi(config.endNote);

    const keys = [];
    let whiteIndex = 0;

    for (let midi = startMidi; midi <= endMidi; midi++) {
      const noteName = SheetGeneratorAlgorithm.midiToNote(midi);
      const isBlack = noteName.includes('#');
      if (!isBlack) {
        keys.push({ midi, noteName, isBlack: false, whiteIndex });
        whiteIndex++;
      } else {
        keys.push({ midi, noteName, isBlack: true, whiteIndex: whiteIndex - 1 });
      }
    }
    return { keys, whiteKeysCount: whiteIndex };
  }

  startPlayback() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.startTime = performance.now() - this.pausedTime;
    this.runScrollLoop();
    this.updateControls();
  }

  pausePlayback() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.updateControls();
  }

  stopPlayback() {
    this.pausePlayback();
    this.pausedTime = 0;
    this.playedIndices.clear();
    const track = document.getElementById('landscape-notes-track');
    if (track) track.style.transform = `translateX(0px)`;
    this.updateControls();
  }

  runScrollLoop() {
    if (!this.isPlaying) return;

    const flatNotes = SongSearchComponent.getFlatNotes(this.song);
    const flowData = SheetGeneratorAlgorithm.generateContinuousFlow(flatNotes, this.selectedKeys);
    const effectiveBpm = this.bpm * this.speedMultiplier;
    // Escala de píxeles por segundo adaptada al tempo
    const pixelsPerSecond = (effectiveBpm / 60) * 120;

    const elapsedSeconds = (performance.now() - this.startTime) / 1000;
    this.pausedTime = elapsedSeconds * 1000;

    // Desplazamiento continuo suave hacia la izquierda
    const currentScrollX = elapsedSeconds * pixelsPerSecond;
    const track = document.getElementById('landscape-notes-track');
    if (track) {
      track.style.transform = `translateX(-${currentScrollX}px)`;
    }

    // Comprobar qué notas han alcanzado la línea de impacto (Target Strike Line)
    flowData.items.forEach((item, idx) => {
      const noteStrikeTime = item.startTime;
      if (elapsedSeconds >= noteStrikeTime && !this.playedIndices.has(idx)) {
        this.playedIndices.add(idx);
        pianoAudio.playNote(item.note);
        this.flashPianoKey(item.note);
      }
    });

    // Final de la canción
    if (elapsedSeconds > flowData.totalDuration + 1) {
      this.stopPlayback();
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.runScrollLoop());
  }

  flashPianoKey(noteName) {
    const key = document.querySelector(`.landscape-piano [data-note="${noteName}"]`);
    if (key) {
      key.classList.add('pressed');
      setTimeout(() => key.classList.remove('pressed'), 250);
    }
  }

  updateControls() {
    const playBtn = document.getElementById('landscape-play-toggle');
    if (playBtn) {
      playBtn.innerHTML = this.isPlaying
        ? `<span>⏸</span><span>${this.t('pause')}</span>`
        : `<span>▶</span><span>${this.t('play')}</span>`;
    }
  }

  render() {
    const t = this.t;
    const flatNotes = SongSearchComponent.getFlatNotes(this.song);
    const flowData = SheetGeneratorAlgorithm.generateContinuousFlow(flatNotes, this.selectedKeys);
    const { keys, whiteKeysCount } = this.generatePianoKeys();

    const effectiveBpm = Math.round(this.bpm * this.speedMultiplier);
    const pixelsPerSecond = (effectiveBpm / 60) * 120;
    const trackWidth = Math.round(flowData.totalDuration * pixelsPerSecond) + 800;
    const whiteKeyWidth = Math.max(14, Math.min(32, Math.floor(880 / whiteKeysCount)));
    const blackKeyWidth = Math.round(whiteKeyWidth * 0.65);

    return `
      <div class="landscape-fullscreen-modal">
        <!-- Barra superior flotante -->
        <header class="landscape-header">
          <div class="landscape-title-row">
            <span class="landscape-tag">📱 ${t('landscapeModeTitle')}</span>
            <strong style="color: #ffffff; font-size: 1rem;">${this.song.title}</strong>
            <span class="pulse-speed-badge">${effectiveBpm} BPM</span>
          </div>

          <!-- Botones de control con estilo blanco obligatorio -->
          <div class="landscape-controls-row">
            <button type="button" id="landscape-play-toggle" class="btn-white btn-sm btn-pill">
              <span>▶</span>
              <span>${t('play')}</span>
            </button>
            <button type="button" id="landscape-reset-btn" class="btn-white btn-sm btn-pill">
              <span>🔄</span>
              <span>${t('reset')}</span>
            </button>
            <button type="button" id="landscape-close-btn" class="btn-white btn-sm btn-pill" title="Salir de pantalla completa">
              <span>✕</span>
              <span>${t('exitLandscape')}</span>
            </button>
          </div>
        </header>

        <!-- Área de flujo horizontal de la partitura -->
        <div class="landscape-flow-zone">
          <!-- Línea de impacto fija (Strike Line) donde deben tocarse las notas -->
          <div class="landscape-strike-line">
            <span class="strike-label">▼</span>
          </div>

          <!-- Pista deslizante continua que se mueve al ritmo exacto -->
          <div class="landscape-notes-track" id="landscape-notes-track" style="width: ${trackWidth}px;">
            ${flowData.items.map((item, idx) => {
              // Empieza desplazado desde la línea de impacto (160px desde la izquierda)
              const leftPos = Math.round(item.startTime * pixelsPerSecond) + 160;
              const noteWidth = Math.max(50, Math.min(120, Math.round(item.duration * pixelsPerSecond * 0.9)));

              return `
                <div 
                  class="landscape-flow-note ${item.isBlack ? 'accidental' : ''}"
                  style="left: ${leftPos}px; top: ${item.topPercent}%; width: ${noteWidth}px;"
                  data-note="${item.note}"
                >
                  <span class="l-note-num">${idx + 1}</span>
                  <span class="l-note-text">${item.note}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Teclado horizontal inferior táctil -->
        <div class="landscape-piano-bottom">
          <div class="piano-keyboard landscape-piano" style="width: ${whiteKeysCount * whiteKeyWidth}px; margin: 0 auto;">
            ${keys.map(k => {
              if (!k.isBlack) {
                return `
                  <button 
                    type="button" 
                    class="white-key" 
                    data-note="${k.noteName}"
                    style="width: ${whiteKeyWidth}px; max-width: ${whiteKeyWidth}px; height: 110px;"
                  >
                    <span>${k.noteName.startsWith('C') ? k.noteName : ''}</span>
                  </button>
                `;
              } else {
                const leftPos = (k.whiteIndex * whiteKeyWidth) + (whiteKeyWidth - blackKeyWidth / 2);
                return `
                  <button 
                    type="button" 
                    class="black-key" 
                    data-note="${k.noteName}"
                    style="left: ${leftPos}px; width: ${blackKeyWidth}px; height: 68px;"
                  >
                    <span></span>
                  </button>
                `;
              }
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  attachEvents(container) {
    const playBtn = container.querySelector('#landscape-play-toggle');
    const resetBtn = container.querySelector('#landscape-reset-btn');
    const closeBtn = container.querySelector('#landscape-close-btn');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (this.isPlaying) {
          this.pausePlayback();
        } else {
          this.startPlayback();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.stopPlayback();
        this.startPlayback();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close();
      });
    }

    // Teclas táctiles del piano inferior
    const keys = container.querySelectorAll('.landscape-piano button');
    keys.forEach(btn => {
      const handlePress = (e) => {
        e.preventDefault();
        const note = btn.dataset.note;
        if (note) {
          pianoAudio.playNote(note);
          btn.classList.add('pressed');
        }
      };
      const handleRelease = () => btn.classList.remove('pressed');

      btn.addEventListener('mousedown', handlePress);
      btn.addEventListener('mouseup', handleRelease);
      btn.addEventListener('touchstart', handlePress, { passive: false });
      btn.addEventListener('touchend', handleRelease);
    });
  }
}
