// Preset & Profile Indicator Extension
// Shows current prompt preset and API profile in a small popup above the button

const MODULE_NAME = 'Preset_Profile_Check';

(function init() {
    const { eventSource, event_types } = SillyTavern.getContext();

    // Wait for app to be fully ready before injecting UI
    eventSource.on(event_types.APP_READY, () => {
        injectButton();
    });

    // Update popup content whenever preset or API settings change
    const UPDATE_EVENTS = [
        event_types.SETTINGS_UPDATED,
        event_types.CHAT_CHANGED,
        event_types.CHARACTER_MESSAGE_RENDERED,
    ];

    for (const evt of UPDATE_EVENTS) {
        eventSource.on(evt, () => updatePopupContent());
    }
})();


// ── UI Injection ────────────────────────────────────────────────

function injectButton() {
    if (document.getElementById('ppi-btn')) return; // already injected

    // Popup element
    const popup = document.createElement('div');
    popup.id = 'ppi-popup';
    popup.style.cssText = `
        display: none;
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--SmartThemeBlurTintColor, rgba(30,30,40,0.97));
        border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.15));
        border-radius: 8px;
        padding: 8px 12px;
        min-width: 220px;
        max-width: 320px;
        font-size: 0.82rem;
        line-height: 1.6;
        color: var(--SmartThemeBodyColor, #ddd);
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        z-index: 9999;
        white-space: nowrap;
        pointer-events: none;
    `;

    popup.innerHTML = buildPopupHTML();

    // Button element
    const btn = document.createElement('div');
    btn.id = 'ppi-btn';
    btn.title = 'Current Preset & API Profile';
    btn.style.cssText = `
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.1rem;
        opacity: 0.75;
        transition: opacity 0.15s;
        padding: 2px 4px;
    `;
    btn.textContent = '⚙️';
    btn.appendChild(popup);

    btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.75'; });

    // Toggle popup on click
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = popup.style.display === 'block';
        if (isVisible) {
            popup.style.display = 'none';
        } else {
            updatePopupContent();
            popup.style.display = 'block';
        }
    });

    // Close on outside click
    document.addEventListener('click', () => {
        popup.style.display = 'none';
    });

    // Inject into the send bar button row
    // ST's input toolbar: #send_form or #leftSendForm / #rightSendForm area
    const toolbar = document.querySelector('#send_form .extraMesButtons, #extensionsMenu, #send_but_sheld');
    
    // Try multiple known button row selectors, fallback to send button's parent
    const targets = [
        '#leftSendForm',
        '#send_form > div.flex-container',
        '#send_form',
    ];

    let inserted = false;
    for (const sel of targets) {
        const el = document.querySelector(sel);
        if (el) {
            el.appendChild(btn);
            inserted = true;
            break;
        }
    }

    if (!inserted) {
        // Last resort: append near send button
        const sendBtn = document.getElementById('send_but');
        if (sendBtn && sendBtn.parentElement) {
            sendBtn.parentElement.insertBefore(btn, sendBtn);
        }
    }
}


// ── Data Helpers ────────────────────────────────────────────────

function getCurrentPresetName() {
    try {
        const ctx = SillyTavern.getContext();

        // Try getPresetManager (staging API)
        if (typeof ctx.getPresetManager === 'function') {
            const pm = ctx.getPresetManager();
            if (pm && typeof pm.getSelectedPresetName === 'function') {
                return pm.getSelectedPresetName() || '—';
            }
        }

        // Fallback: read the preset dropdown directly from DOM
        const presetSelect = document.querySelector('#settings_preset, #preset_name_select, select[name="preset_name"]');
        if (presetSelect) {
            const opt = presetSelect.options[presetSelect.selectedIndex];
            return opt ? opt.text.trim() : '—';
        }

        return '—';
    } catch {
        return '—';
    }
}

function getCurrentAPIInfo() {
    try {
        const ctx = SillyTavern.getContext();

        // Connection profile name (newer ST versions)
        if (ctx.connectionManagerActive) {
            const profileSel = document.querySelector('#connection_profile_name, #connection-profile-select');
            if (profileSel) {
                const opt = profileSel.options?.[profileSel.selectedIndex];
                if (opt) return opt.text.trim();
            }
        }

        // API type + model fallback
        const apiType = ctx.mainApi || '';
        const modelEl = document.querySelector(
            '#model_openai_select, #model_claude_select, #model_cohere_select, ' +
            '#model_google_select, #model_ai21_select, #model_mistral_select, ' +
            '#model_custom_select, #openrouter_model, #model_textgenerationwebui_select'
        );

        let model = '';
        if (modelEl) {
            const opt = modelEl.options?.[modelEl.selectedIndex];
            model = opt ? opt.text.trim() : (modelEl.value || '');
        }

        if (apiType && model) return `${apiType} / ${model}`;
        if (model) return model;
        if (apiType) return apiType;
        return '—';
    } catch {
        return '—';
    }
}


// ── Popup Content ───────────────────────────────────────────────

function buildPopupHTML() {
    const preset = getCurrentPresetName();
    const api = getCurrentAPIInfo();
    return `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <span>📋</span>
            <span id="ppi-preset" style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(preset)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
            <span>🔌</span>
            <span id="ppi-api" style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(api)}</span>
        </div>
    `;
}

function updatePopupContent() {
    const popup = document.getElementById('ppi-popup');
    if (!popup) return;
    popup.innerHTML = buildPopupHTML();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
