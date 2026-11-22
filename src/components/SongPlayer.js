import { pianoAudio } from '../audio/synth.js';
import { SheetGeneratorAlgorithm } from '../utils/sheetGenerator.js';
import { SongSearchComponent } from './SongSearch.js';
import { SongPulseMeterComponent } from './SongPulseMeter.js';

export class SongPlayerComponent {
  constructor({ song, selectedKeys, onNotePlay, onViewModeChange, onOpenLandscape, currentViewMode, t }) {
    this.song = song;
    this.selectedKeys = selectedKeys;
    this.onNotePlay = onNotePlay;
    this.onViewModeChange = onViewModeChange;
    this.onOpenLandscape = onOpenLandscape;
    this.currentViewMode = currentViewMode || 'overview';
    this.t = t;
    this.isPlaying = false;
    this.currentStep = 0;
    this.playbackTimer = null;
    this.speedMultiplier = 1.0;

    this.pulseMeter = new SongPulseMeterComponent({
      initialBpm: song.tempo || 120,
      onBpmChange: (effectiveBpm, multiplier) => {
        this.speedMultiplier = multiplier;
        if (this.isPlaying) {
          this.pause();
          this.play();
        }
      },
      t: this.t
    });
  }

  setSong(song) {
    this.stop();
    this.song = song;
    this.currentStep = 0;
    this.pulseMeter.setBpm(song.tempo || 120);
  }

  setKeys(keys) {
    this.selectedKeys = keys;
  }

  // Obtiene la misma secuencia adaptada que usa la vista continua.
  getAdaptedNotesSequence() {
    const flatNotes = SongSearchComponent.getFlatNotes(this.song);
    const flowData = SheetGeneratorAlgorithm.generateContinuousFlow(flatNotes, this.selectedKeys);
    return flowData.items;
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.pulseMeter.startPulse();
    this.playNextStep();
    this.updateControlsUI();
  }

  pause() {
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.updateControlsUI();
  }

  stop() {
    this.pause();
    this.currentStep = 0;
  }

  playNextStep() {
    const adaptedNotes = this.getAdaptedNotesSequence();
    if (!this.isPlaying || !adaptedNotes.length) return;

    if (this.currentStep >= adaptedNotes.length) {
      this.currentStep = 0;
    }

    const noteItem = adaptedNotes[this.currentStep];

    if (this.onNotePlay) {
      this.onNotePlay(noteItem.note);
    }

    this.currentStep++;
    const stepDurationMs = ((noteItem.duration || 0.45) / this.speedMultiplier) * 1000;

    this.playbackTimer = setTimeout(() => {
      this.playNextStep();
    }, stepDurationMs);
  }

  updateControlsUI() {
    const playBtn = document.getElementById('player-toggle-btn');
    if (playBtn) {
      playBtn.innerHTML = this.isPlaying 
        ? `<span>⏸</span><span>${this.t('pause')}</span>`
        : `<span>▶</span><span>${this.t('play')}</span>`;
    }
  }

  render() {
    const t = this.t;
    const song = this.song;
    const flowData = SheetGeneratorAlgorithm.generateContinuousFlow(
      SongSearchComponent.getFlatNotes(song),
      this.selectedKeys
    );
    const rangeStatus = flowData.isCompressed
      ? t('foldedNotesStatus').replace('{count}', flowData.foldedNotesCount)
      : t('octavesTransposed').replace('{keys}', this.selectedKeys);

    return `
      <section class="card-section" aria-labelledby="active-song-heading">
        <div class="active-song-card">
          <div class="song-info-header">
            <div class="song-title-group">
              <h3 id="active-song-heading">${song.title}</h3>
              <p>${song.composer} · ${song.genre} ${song.album ? `· ${song.album}` : ''}</p>
            </div>

            <!-- Botones blancos obligatorios -->
            <div class="song-controls">
              <button type="button" id="player-toggle-btn" class="btn-white btn-pill">
                <span>▶</span>
                <span>${t('play')}</span>
              </button>
              <button type="button" id="player-reset-btn" class="btn-white btn-pill">
                <span>🔄</span>
                <span>${t('reset')}</span>
              </button>

              <button type="button" id="open-landscape-btn" class="btn-white btn-pill" style="border: 2px solid var(--gold-accent);">
                <span>📱</span>
                <span>${t('openLandscape')}</span>
              </button>
            </div>
          </div>

          <!-- Pulsómetro personalizado integrado -->
          ${this.pulseMeter.render()}

          <div style="font-size: 0.85rem; color: var(--gold-accent); font-weight: 600;">
            ✓ ${rangeStatus}
          </div>
          <div style="margin-top: 0.35rem; font-size: 0.78rem; opacity: 0.82;">
            ${t('transcriptionSource')}: ${song.sourceLabel || t('generatedApproximate')}
          </div>
        </div>
      </section>
    `;
  }

  attachEvents(container) {
    const toggleBtn = container.querySelector('#player-toggle-btn');
    const resetBtn = container.querySelector('#player-reset-btn');
    const landscapeBtn = container.querySelector('#open-landscape-btn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (this.isPlaying) {
          this.pause();
        } else {
          this.play();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.stop();
        this.play();
      });
    }

    if (landscapeBtn) {
      landscapeBtn.addEventListener('click', () => {
        if (this.onOpenLandscape) {
          this.onOpenLandscape();
        }
      });
    }

    this.pulseMeter.attachEvents(container);
  }
}
