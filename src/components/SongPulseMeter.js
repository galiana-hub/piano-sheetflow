import { pianoAudio } from '../audio/synth.js';

export class SongPulseMeterComponent {
  constructor({ initialBpm = 120, onBpmChange, t }) {
    this.bpm = initialBpm;
    this.speedMultiplier = 1.0;
    this.onBpmChange = onBpmChange;
    this.t = t;
    this.pulseInterval = null;
    this.isTicking = false;
    this.soundActive = false;
  }

  setBpm(newBpm) {
    this.bpm = newBpm || 120;
    this.restartPulse();
  }

  getEffectiveBpm() {
    return Math.round(this.bpm * this.speedMultiplier);
  }

  startPulse() {
    this.stopPulse();
    this.isTicking = true;
    const intervalMs = (60 / this.getEffectiveBpm()) * 1000;

    let beatCounter = 0;
    this.pulseInterval = setInterval(() => {
      beatCounter++;
      const isDownbeat = beatCounter % 4 === 1;

      // Animación visual del pulso
      const heartEl = document.getElementById('pulse-indicator-heart');
      const waveEl = document.getElementById('pulse-wave-ring');
      if (heartEl) {
        heartEl.classList.add('pulse-beat');
        setTimeout(() => heartEl.classList.remove('pulse-beat'), 160);
      }
      if (waveEl) {
        waveEl.classList.add('wave-expand');
        setTimeout(() => waveEl.classList.remove('wave-expand'), 350);
      }

      // Sonido opcional del metrónomo
      if (this.soundActive) {
        pianoAudio.playMetronomeClick(isDownbeat);
      }
    }, intervalMs);
  }

  stopPulse() {
    this.isTicking = false;
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = null;
    }
  }

  restartPulse() {
    if (this.isTicking) {
      this.startPulse();
    }
  }

  render() {
    const t = this.t;
    const effectiveBpm = this.getEffectiveBpm();

    return `
      <div class="pulse-meter-container" id="pulse-meter-box">
        <div class="pulse-visual-badge">
          <!-- Anillo de onda expansiva de pulso -->
          <div class="pulse-wave-ring" id="pulse-wave-ring"></div>
          
          <!-- Núcleo luminoso del pulsómetro -->
          <div class="pulse-heart-core" id="pulse-indicator-heart">
            <span class="pulse-icon">🫀</span>
            <span class="pulse-bpm-val">${effectiveBpm}</span>
            <span class="pulse-bpm-unit">BPM</span>
          </div>
        </div>

        <div class="pulse-controls-wrap">
          <div class="pulse-label-row">
            <span class="pulse-title">⚡ ${t('pulseMeterTitle')}:</span>
            <span class="pulse-speed-badge">${this.speedMultiplier}x</span>
          </div>

          <!-- Selector de velocidad con botones blancos -->
          <div class="speed-buttons-row">
            <button type="button" class="btn-white btn-sm btn-pill speed-preset-btn ${this.speedMultiplier === 0.75 ? 'active-speed' : ''}" data-speed="0.75">
              <span>🐢</span>
              <span>0.75x (${t('slowPractice')})</span>
            </button>
            <button type="button" class="btn-white btn-sm btn-pill speed-preset-btn ${this.speedMultiplier === 1.0 ? 'active-speed' : ''}" data-speed="1.0">
              <span>🎯</span>
              <span>1.0x (${t('normalSpeed')})</span>
            </button>
            <button type="button" class="btn-white btn-sm btn-pill speed-preset-btn ${this.speedMultiplier === 1.25 ? 'active-speed' : ''}" data-speed="1.25">
              <span>🚀</span>
              <span>1.25x</span>
            </button>

            <!-- Botón de sonido del pulso -->
            <button type="button" id="toggle-pulse-sound-btn" class="btn-white btn-sm btn-pill ${this.soundActive ? 'active-speed' : ''}">
              <span>${this.soundActive ? '🔔' : '🔕'}</span>
              <span>${this.soundActive ? t('soundOn') : t('pulseMuted')}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents(container) {
    const speedButtons = container.querySelectorAll('.speed-preset-btn');
    speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.speed);
        this.speedMultiplier = speed;
        this.restartPulse();
        if (this.onBpmChange) {
          this.onBpmChange(this.getEffectiveBpm(), this.speedMultiplier);
        }
        // Actualizar UI
        const box = container.querySelector('#pulse-meter-box');
        if (box) {
          const bpmVal = box.querySelector('.pulse-bpm-val');
          const speedBadge = box.querySelector('.pulse-speed-badge');
          if (bpmVal) bpmVal.textContent = this.getEffectiveBpm();
          if (speedBadge) speedBadge.textContent = `${this.speedMultiplier}x`;
          speedButtons.forEach(b => b.classList.remove('active-speed'));
          btn.classList.add('active-speed');
        }
      });
    });

    const soundToggle = container.querySelector('#toggle-pulse-sound-btn');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        this.soundActive = !this.soundActive;
        pianoAudio.isMetronomeSoundEnabled = this.soundActive;
        soundToggle.innerHTML = `
          <span>${this.soundActive ? '🔔' : '🔕'}</span>
          <span>${this.soundActive ? this.t('soundOn') : this.t('pulseMuted')}</span>
        `;
        soundToggle.classList.toggle('active-speed', this.soundActive);
      });
    }

    // Iniciar el latido continuo del pulsómetro
    this.startPulse();
  }
}
