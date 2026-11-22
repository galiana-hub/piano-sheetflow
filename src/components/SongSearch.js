import { UniversalSongProvider, BUILT_IN_CATALOG } from '../utils/songProvider.js';
import { MidiParser } from '../utils/midiParser.js';

export const FEATURED_SONGS = BUILT_IN_CATALOG;

export class SongSearchComponent {
  constructor({ onSelectSong, t }) {
    this.onSelectSong = onSelectSong;
    this.t = t;
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.selectedSong = BUILT_IN_CATALOG[0];
    this.isSearching = false;
    this.searchResults = [];
  }

  static getFlatNotes(song) {
    if (song.notes && song.notes.length) return song.notes;
    if (song.measures) {
      const flat = [];
      song.measures.forEach(m => {
        m.notes.forEach(n => flat.push({ ...n, measureNumber: m.measureNumber }));
      });
      return flat;
    }
    return [];
  }

  render() {
    const t = this.t;

    return `
      <section class="card-section" aria-labelledby="song-search-heading" id="song-search-section">
        <div class="section-header">
          <h2 id="song-search-heading" class="section-title">
            <span>🔍</span>
            <span>${t('searchBtn')}</span>
          </h2>

          <span class="section-badge">${t('apiOnlineReady')}</span>
        </div>

        <!-- Formulario del buscador -->
        <form class="search-form" id="search-form">
          <div class="search-input-wrapper">
            <span class="search-icon">🎵</span>
            <input 
              type="text" 
              class="search-input" 
              id="search-input"
              placeholder="${t('searchUniversalPlaceholder')}"
              value="${this.searchTerm}"
              autocomplete="off"
            />
          </div>
          <!-- Botón blanco según regla obligatoria -->
          <button type="submit" class="btn-white btn-pill" id="search-submit-btn">
            <span>✨</span>
            <span>${this.isSearching ? t('searchingOnline') : t('searchBtn')}</span>
          </button>
        </form>

        <div class="midi-upload-row">
          <label class="midi-upload-label" for="midi-file-input">
            <span>📁</span>
            <span>${t('uploadMidi')}</span>
          </label>
          <input type="file" id="midi-file-input" accept=".mid,.midi,audio/midi" hidden>
          <span class="midi-upload-hint">${t('uploadMidiHint')}</span>
        </div>

        <!-- PANEL DE RESULTADOS MULTIPLES DE LA API (CUANDO HAY BÚSQUEDA) -->
        <div id="api-search-results-container" style="${this.searchResults.length ? 'display: block;' : 'display: none;'}">
          <div class="results-header-bar">
            <span>🎯 ${t('multipleResultsFound')}:</span>
            <button type="button" id="clear-results-btn" class="btn-clear-results">✕ ${t('closeResults')}</button>
          </div>
          <div class="search-results-grid">
            ${this.searchResults.map(item => `
              <div class="result-song-card" data-result-id="${item.id}">
                ${item.artwork ? `<img src="${item.artwork}" alt="${item.title}" class="result-artwork" />` : '<div class="result-artwork-placeholder">🎵</div>'}
                <div class="result-info">
                  <strong class="result-title">${item.title}</strong>
                  <span class="result-artist">${item.composer}</span>
                  ${item.album ? `<span class="result-album">${item.album}</span>` : ''}
                </div>
                <!-- Botón blanco con letras negras obligatorio -->
                <button type="button" class="btn-white btn-sm btn-pill select-song-btn" data-result-id="${item.id}">
                  <span>🎹</span>
                  <span>${t('playSongBtn')}</span>
                </button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- SECCIÓN DE CANCIONES DESTACADAS (SI NO HAY RESULTADOS ACTIVOS) -->
        <div id="default-featured-section" style="${this.searchResults.length ? 'display: none;' : 'display: block;'}">
          <div class="popular-chips">
            ${BUILT_IN_CATALOG.map(song => `
              <button 
                type="button" 
                class="chip-btn ${this.selectedSong?.id === song.id ? 'active' : ''}" 
                data-song-id="${song.id}"
              >
                <strong>${song.title}</strong>
                <span style="opacity: 0.75; font-size: 0.75rem;">· ${song.composer}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  attachEvents(container) {
    const form      = container.querySelector('#search-form');
    const input     = container.querySelector('#search-input');
    const submitBtn = container.querySelector('#search-submit-btn');
    const clearBtn  = container.querySelector('#clear-results-btn');
    const midiInput = container.querySelector('#midi-file-input');
    const midiHint  = container.querySelector('.midi-upload-hint');

    // Búsqueda en API con múltiples resultados
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = input.value.trim();
        this.searchTerm = query;
        if (!query) return;

        this.isSearching = true;
        if (submitBtn) {
          submitBtn.innerHTML = `<span>⏳</span><span>${this.t('searchingOnline')}...</span>`;
        }

        try {
          const results = await UniversalSongProvider.searchOnlineApi(query);
          this.searchResults = results;
          this.renderResults(container);
        } finally {
          this.isSearching = false;
          if (submitBtn) {
            submitBtn.innerHTML = `<span>✨</span><span>${this.t('searchBtn')}</span>`;
          }
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchResults = [];
        this.renderResults(container);
      });
    }

    if (midiInput) {
      midiInput.addEventListener('change', async () => {
        const file = midiInput.files?.[0];
        if (!file) return;
        if (midiHint) midiHint.textContent = this.t('readingMidi');

        try {
          const parsed = MidiParser.parse(await file.arrayBuffer());
          const title = file.name.replace(/\.(mid|midi)$/i, '') || 'Imported MIDI';
          const midiSong = {
            id: 'midi-' + Date.now(),
            title,
            composer: this.t('uploadedMidiComposer'),
            genre: 'MIDI',
            tempo: parsed.bpm,
            notes: parsed.notes,
            sourceType: 'midi',
            sourceLabel: 'User MIDI file'
          };
          this.selectedSong = midiSong;
          this.onSelectSong(midiSong);
          if (midiHint) midiHint.textContent = this.t('midiLoaded');
        } catch (error) {
          console.error('MIDI import failed:', error);
          if (midiHint) midiHint.textContent = this.t('midiInvalid');
        } finally {
          midiInput.value = '';
        }
      });
    }

    this.attachResultsClickEvents(container);
    this.attachChipEvents(container);
  }

  renderResults(container) {
    const resultsContainer = container.querySelector('#api-search-results-container');
    const featuredSection  = container.querySelector('#default-featured-section');

    if (this.searchResults.length > 0) {
      if (resultsContainer) {
        resultsContainer.style.display = 'block';
        const grid = resultsContainer.querySelector('.search-results-grid');
        if (grid) {
          grid.innerHTML = this.searchResults.map(item => `
            <div class="result-song-card" data-result-id="${item.id}">
              ${item.artwork ? `<img src="${item.artwork}" alt="${item.title}" class="result-artwork" />` : '<div class="result-artwork-placeholder">🎵</div>'}
              <div class="result-info">
                <strong class="result-title">${item.title}</strong>
                <span class="result-artist">${item.composer}</span>
                ${item.album ? `<span class="result-album">${item.album}</span>` : ''}
              </div>
              <button type="button" class="btn-white btn-sm btn-pill select-song-btn" data-result-id="${item.id}">
                <span>🎹</span>
                <span>${this.t('playSongBtn')}</span>
              </button>
            </div>
          `).join('');
          this.attachResultsClickEvents(resultsContainer);
        }
      }
      if (featuredSection) featuredSection.style.display = 'none';
    } else {
      if (resultsContainer) resultsContainer.style.display = 'none';
      if (featuredSection)  featuredSection.style.display = 'block';
    }
  }

  attachResultsClickEvents(container) {
    const selectButtons = container.querySelectorAll('.select-song-btn, .result-song-card');
    selectButtons.forEach(el => {
      el.addEventListener('click', async () => {
        const id   = el.dataset.resultId;
        const item = this.searchResults.find(r => r.id === id);
        if (!item) return;

        // Mostrar estado de carga mientras se consulta MusicBrainz (máx 3s con timeout)
        const btn = el.classList.contains('select-song-btn')
          ? el
          : el.querySelector('.select-song-btn');
        const original = btn ? btn.innerHTML : '';
        if (btn) btn.innerHTML = `<span>⏳</span><span>${this.t('adaptingSongLoading')}</span>`;

        try {
          const playableSong = await UniversalSongProvider.convertResultToPlayableSong(item);
          this.selectedSong  = playableSong;
          this.onSelectSong(playableSong);
        } finally {
          if (btn) btn.innerHTML = original;
        }
      });
    });
  }

  attachChipEvents(container) {
    const chipBtns = container.querySelectorAll('.chip-btn');
    chipBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const songId = btn.dataset.songId;
        const song   = BUILT_IN_CATALOG.find(s => s.id === songId);
        if (song) {
          const catalogSong = {
            ...song,
            sourceType: 'catalog',
            sourceLabel: 'Catalog melody'
          };
          this.selectedSong = catalogSong;
          this.onSelectSong(catalogSong);
          chipBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });
  }
}
