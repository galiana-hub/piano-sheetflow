import { supportedLanguages } from '../i18n/translations.js';

export class HeaderComponent {
  constructor({ onLanguageChange, getCurrentLang, t }) {
    this.onLanguageChange = onLanguageChange;
    this.getCurrentLang = getCurrentLang;
    this.t = t;
    this.deferredPrompt = null;

    // Escuchar el evento PWA de instalación
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBtn = document.getElementById('pwa-install-btn');
      if (installBtn) installBtn.style.display = 'inline-flex';
    });
  }

  render() {
    const currentLang = this.getCurrentLang();
    const t = this.t;

    return `
      <header class="app-header">
        <div class="brand">
          <div class="brand-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6V5h2v8h1.5V5h2v8H13V5h2v8h1.5V5H18v14z"/>
            </svg>
          </div>
          <div class="brand-text">
            <h1>${t('appTitle')}</h1>
            <p>${t('tagline')}</p>
          </div>
        </div>

        <div class="header-actions">
          <!-- Botón PWA para instalar la app -->
          <button id="pwa-install-btn" class="btn-white btn-sm btn-pill" style="display: none;">
            <span>📥</span>
            <span>${t('installApp')}</span>
          </button>

          <!-- Selector de Idiomas (10 idiomas) -->
          <div class="lang-selector-wrapper">
            <select id="lang-select" class="lang-select" aria-label="Language selection">
              ${supportedLanguages.map(lang => `
                <option value="${lang.code}" ${lang.code === currentLang ? 'selected' : ''}>
                  ${lang.flag} ${lang.name}
                </option>
              `).join('')}
            </select>
            <span class="lang-icon">▼</span>
          </div>
        </div>
      </header>
    `;
  }

  attachEvents(container) {
    const select = container.querySelector('#lang-select');
    if (select) {
      select.addEventListener('change', (e) => {
        this.onLanguageChange(e.target.value);
      });
    }

    const installBtn = container.querySelector('#pwa-install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            installBtn.style.display = 'none';
          }
          this.deferredPrompt = null;
        }
      });
    }
  }
}
