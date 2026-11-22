// Componente de selección de tamaño de teclado de piano

export const PIANO_SIZES = [
  { keys: 25, startNote: 'C4', endNote: 'C6', octaves: '2.0', labelKey: 'keys25Desc' },
  { keys: 32, startNote: 'F3', endNote: 'C6', octaves: '2.5', labelKey: 'keys32Desc' },
  { keys: 49, startNote: 'C2', endNote: 'C6', octaves: '4.0', labelKey: 'keys49Desc' },
  { keys: 61, startNote: 'C2', endNote: 'C7', octaves: '5.0', labelKey: 'keys61Desc' },
  { keys: 88, startNote: 'A0', endNote: 'C8', octaves: '7.25', labelKey: 'keys88Desc' }
];

export class PianoSelectorComponent {
  constructor({ selectedKeys, onKeysChange, t }) {
    this.selectedKeys = selectedKeys;
    this.onKeysChange = onKeysChange;
    this.t = t;
  }

  setKeys(keys) {
    this.selectedKeys = keys;
  }

  render() {
    const t = this.t;
    const currentConfig = PIANO_SIZES.find(s => s.keys === this.selectedKeys) || PIANO_SIZES[3];

    return `
      <section class="card-section" aria-labelledby="piano-size-heading">
        <div class="section-header">
          <h2 id="piano-size-heading" class="section-title">
            <span>🎹</span>
            <span>${t('selectKeys')}</span>
          </h2>
          <span class="section-badge">${this.selectedKeys} ${t('keysCount')} · ${currentConfig.octaves} Oct</span>
        </div>

        <div class="keys-grid" role="radiogroup" aria-label="${t('selectKeys')}">
          ${PIANO_SIZES.map(item => {
            const isActive = item.keys === this.selectedKeys;
            return `
              <button 
                type="button" 
                class="btn-tab ${isActive ? 'active' : ''}" 
                data-keys="${item.keys}"
                role="radio"
                aria-checked="${isActive}"
              >
                <span class="tab-title">${item.keys} ${t('keysCount')}</span>
                <span class="tab-subtitle">${item.startNote} - ${item.endNote}</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="key-summary-banner">
          <div class="key-summary-text">
            <span>${t('octaveRange')}: </span>
            <strong>${currentConfig.startNote} → ${currentConfig.endNote}</strong>
            <span style="opacity: 0.85; margin-left: 0.5rem;">(${t(currentConfig.labelKey)})</span>
          </div>
          <div class="key-summary-text" style="font-size: 0.82rem; opacity: 0.9;">
            ✓ ${t('adaptedRange')}
          </div>
        </div>
      </section>
    `;
  }

  attachEvents(container) {
    const buttons = container.querySelectorAll('.keys-grid button');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const keys = parseInt(btn.dataset.keys, 10);
        this.selectedKeys = keys;
        this.onKeysChange(keys);
      });
    });
  }
}
