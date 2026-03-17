// Preset-Profile-Check Extension
// Shows current prompt preset and connection profile in a small popup

(function init() {
    const { eventSource, event_types } = SillyTavern.getContext();

    eventSource.on(event_types.APP_READY, () => {
        injectButton();
    });

    // Update popup content on any relevant change event (if popup is open)
    const UPDATE_EVENTS = [
        'preset_changed',
        'mainApiChanged',
        'connection_profile_loaded',
        event_types.CHAT_CHANGED,
    ];
    for (const evt of UPDATE_EVENTS) {
        eventSource.on(evt, () => {
            const popup = document.getElementById('ppc-popup');
            if (popup && popup.style.display === 'block') {
                popup.innerHTML = buildPopupHTML();
            }
        });
    }
})();


// ── UI Injection ────────────────────────────────────────────────

function injectButton() {
    if (document.getElementById('ppc-btn')) return;

    // ── Popup: fixed to bottom-center of screen ──
    const popup = document.createElement('div');
    popup.id = 'ppc-popup';
    Object.assign(popup.style, {
        display:        'none',
        position:       'fixed',
        bottom:         '110px',        // 입력창 + QR 위쪽
        left:           '50%',
        transform:      'translateX(-50%)',
        background:     'var(--SmartThemeBlurTintColor, rgba(18,18,26,0.97))',
        border:         '1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.22))',
        borderRadius:   '8px',
        padding:        '9px 14px',
        fontSize:       '0.85rem',
        lineHeight:     '1.75',
        color:          'var(--SmartThemeBodyColor, #e0e0e0)',
        boxShadow:      '0 4px 20px rgba(0,0,0,0.6)',
        zIndex:         '99999',
        whiteSpace:     'nowrap',
        pointerEvents:  'none',
        backdropFilter: 'blur(6px)',
    });
    popup.innerHTML = buildPopupHTML();
    document.body.appendChild(popup);

    // ── Button: uses ST's native "interactable" class ──
    const btn = document.createElement('div');
    btn.id = 'ppc-btn';
    btn.title = 'Preset & Profile';
    btn.classList.add('interactable');
    btn.setAttribute('tabindex', '0');
    btn.textContent = '🔌';
    Object.assign(btn.style, {
        fontSize:   '1rem',
        cursor:     'pointer',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
    });

    // Toggle popup
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = popup.style.display === 'block';
        if (isOpen) {
            popup.style.display = 'none';
        } else {
            popup.innerHTML = buildPopupHTML();
            popup.style.display = 'block';
        }
    });

    // Close on outside click
    document.addEventListener('click', () => {
        popup.style.display = 'none';
    });

    // ── Inject: just before Quick Persona List button ──
    // Quick-Persona-List 확장이 만드는 버튼의 id/class를 순서대로 시도
    const quickPersonaSelectors = [
        '#quick-persona-list-btn',
        '#quickPersonaListBtn',
        '[id*="quick-persona"]',
        '[id*="quickPersona"]',
        '[id*="quick_persona"]',
    ];

    let inserted = false;

    for (const sel of quickPersonaSelectors) {
        const target = document.querySelector(sel);
        if (target && target.parentElement) {
            target.parentElement.insertBefore(btn, target);
            inserted = true;
            break;
        }
    }

    if (!inserted) {
        // Fallback: 버튼줄 컨테이너 맨 뒤에 추가
        const containers = [
            '#leftSendForm',
            '#send_form > div.flex-container.flexGap5',
            '#send_form > div.flex-container',
            '#send_form',
        ];
        for (const sel of containers) {
            const el = document.querySelector(sel);
            if (el) {
                el.appendChild(btn);
                inserted = true;
                break;
            }
        }
    }

    if (!inserted) {
        // Last resort: 전송 버튼 앞에
        const sendBtn = document.getElementById('send_but');
        if (sendBtn?.parentElement) {
            sendBtn.parentElement.insertBefore(btn, sendBtn);
        }
    }
}


// ── Data Helpers ────────────────────────────────────────────────

function getCurrentPresetName() {
    try {
        const ctx = SillyTavern.getContext();
        if (typeof ctx.getPresetManager === 'function') {
            const pm = ctx.getPresetManager();
            if (typeof pm?.getSelectedPresetName === 'function') {
                const name = pm.getSelectedPresetName();
                if (name) return name;
            }
        }
    } catch {}

    // DOM fallback
    for (const sel of ['#settings_preset', '#preset_name_select', 'select[name="preset_name"]']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const txt = el.options[el.selectedIndex]?.text?.trim();
        if (txt && txt !== '—') return txt;
    }
    return '—';
}

function getCurrentProfileInfo() {
    // 1. Connection Profile name
    for (const sel of ['#connection-profile-select', '#connection_profiles_list', 'select[name="connection_profile"]']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const txt = el.options[el.selectedIndex]?.text?.trim();
        if (txt && txt !== '' && txt !== '—') return txt;
    }

    // 2. Active model select (skip hidden sections)
    const modelSelectors = [
        '#model_openai_select',
        '#model_claude_select',
        '#model_windowai_select',
        '#openrouter_model',
        '#model_openrouter_select',
        '#model_cohere_select',
        '#model_google_select',
        '#model_mistral_select',
        '#model_ai21_select',
        '#model_custom_select',
        '#model_textgenerationwebui_select',
        '#model_kobold_select',
        '#model_novel_select',
    ];
    for (const sel of modelSelectors) {
        const el = document.querySelector(sel);
        if (!el || isHidden(el)) continue;
        const txt = (el.options[el.selectedIndex]?.text || el.value || '').trim();
        if (txt && txt !== '—' && txt !== '') return txt;
    }

    // 3. API type only
    try {
        const api = SillyTavern.getContext().mainApi;
        if (api) return api;
    } catch {}

    return '—';
}

function isHidden(el) {
    let node = el;
    while (node && node !== document.body) {
        const s = window.getComputedStyle(node);
        if (s.display === 'none' || s.visibility === 'hidden') return true;
        node = node.parentElement;
    }
    return false;
}


// ── Popup HTML ──────────────────────────────────────────────────

function buildPopupHTML() {
    const preset  = escapeHtml(getCurrentPresetName());
    const profile = escapeHtml(getCurrentProfileInfo());
    return `
        <div style="display:flex;align-items:center;gap:7px;">
            <span style="flex-shrink:0">📋</span>
            <span>${preset}</span>
        </div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:3px;">
            <span style="flex-shrink:0">🔌</span>
            <span>${profile}</span>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
