import './styles/main.css';
import { translations, supportedLanguages } from './i18n/translations.js';
import { HeaderComponent } from './components/Header.js';
import { PianoSelectorComponent } from './components/PianoSelector.js';
import { SongSearchComponent, FEATURED_SONGS } from './components/SongSearch.js';
import { PianoKeyboardComponent } from './components/PianoKeyboard.js';
import { SongPlayerComponent } from './components/SongPlayer.js';
import { ContinuousSheetMusicComponent } from './components/ContinuousSheetMusic.js';
import { LandscapeFlowViewerComponent } from './components/LandscapeFlowViewer.js';

class App {
  constructor() {
    this.currentLang = localStorage.getItem('app_piano_lang') || 'en';
    this.selectedKeys = parseInt(localStorage.getItem('app_piano_keys'), 10) || 61;
    this.selectedSong = FEATURED_SONGS[0];
    this.currentViewMode = 'overview';

    this.t = this.t.bind(this);
    this.handleLanguageChange = this.handleLanguageChange.bind(this);
    this.handleKeysChange = this.handleKeysChange.bind(this);
    this.handleSongSelect = this.handleSongSelect.bind(this);
    this.handleViewModeChange = this.handleViewModeChange.bind(this);
    this.handleOpenLandscape = this.handleOpenLandscape.bind(this);

    window.addEventListener('notation-changed', () => {
      this.render();
    });

    this.initComponents();
    this.render();
    this.registerServiceWorker();
  }

  t(key) {
    const langObj = translations[this.currentLang] || translations.en;
    return langObj[key] || translations.en[key] || key;
  }

  initComponents() {
    this.header = new HeaderComponent({
      onLanguageChange: this.handleLanguageChange,
      getCurrentLang: () => this.currentLang,
      t: this.t
    });

    this.pianoSelector = new PianoSelectorComponent({
      selectedKeys: this.selectedKeys,
      onKeysChange: this.handleKeysChange,
      t: this.t
    });

    this.songSearch = new SongSearchComponent({
      onSelectSong: this.handleSongSelect,
      t: this.t
    });

    this.keyboard = new PianoKeyboardComponent({
      selectedKeys: this.selectedKeys,
      t: this.t
    });

    this.continuousSheet = new ContinuousSheetMusicComponent({
      song: this.selectedSong,
      selectedKeys: this.selectedKeys,
      onNotePlay: (note) => this.keyboard.triggerNote(note),
      t: this.t
    });

    this.player = new SongPlayerComponent({
      song: this.selectedSong,
      selectedKeys: this.selectedKeys,
      onNotePlay: (note) => {
        this.keyboard.triggerNote(note);
        if (this.player && typeof this.player.currentStep === 'number') {
          this.continuousSheet.highlightNoteIndex(this.player.currentStep - 1);
        }
      },
      onViewModeChange: this.handleViewModeChange,
      onOpenLandscape: this.handleOpenLandscape,
      currentViewMode: this.currentViewMode,
      t: this.t
    });
  }

  handleOpenLandscape() {
    const landscapeViewer = new LandscapeFlowViewerComponent({
      song: this.selectedSong,
      selectedKeys: this.selectedKeys,
      bpm: this.selectedSong.tempo || 120,
      speedMultiplier: this.player?.speedMultiplier || 1.0,
      onClose: () => {},
      t: this.t
    });
    landscapeViewer.open();
  }

  handleLanguageChange(newLang) {
    this.currentLang = newLang;
    localStorage.setItem('app_piano_lang', newLang);

    const langMeta = supportedLanguages.find(l => l.code === newLang);
    document.documentElement.dir = langMeta?.dir || 'ltr';
    document.documentElement.lang = newLang;

    this.render();
  }

  handleKeysChange(newKeys) {
    this.selectedKeys = newKeys;
    localStorage.setItem('app_piano_keys', newKeys.toString());

    this.pianoSelector.setKeys(newKeys);
    this.keyboard.setKeys(newKeys);
    this.player.setKeys(newKeys);
    this.continuousSheet.setKeys(newKeys);

    this.render();
  }

  handleSongSelect(song) {
    this.selectedSong = song;
    this.player.setSong(song);
    this.continuousSheet.setSong(song);
    this.render();
  }

  handleViewModeChange(mode) {
    this.currentViewMode = mode;
    this.render();
  }

  render() {
    const appRoot = document.getElementById('app');
    if (!appRoot) return;

    this.header.t = this.t;
    this.pianoSelector.t = this.t;
    this.songSearch.t = this.t;
    this.keyboard.t = this.t;
    this.player.t = this.t;
    this.continuousSheet.t = this.t;

    appRoot.innerHTML = `
      <div class="app-container">
        ${this.header.render()}
        <main style="display: flex; flex-direction: column; gap: 2rem;">
          ${this.pianoSelector.render()}
          ${this.songSearch.render()}
          ${this.player.render()}
          ${this.continuousSheet.render()}
          ${this.keyboard.render()}
        </main>
        <footer class="app-footer">
          <p>${this.t('footerNote')}</p>
          <div class="footer-badge">App Piano PWA · ${this.selectedKeys} ${this.t('keysCount')}</div>
        </footer>
      </div>
    `;

    this.header.attachEvents(appRoot);
    this.pianoSelector.attachEvents(appRoot);
    this.songSearch.attachEvents(appRoot);
    this.player.attachEvents(appRoot);
    this.continuousSheet.attachEvents(appRoot);
    this.keyboard.attachEvents(appRoot);
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registrado con éxito'))
        .catch((err) => console.log('Registro de Service Worker omitido:', err));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
