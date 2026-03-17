// Preset-Profile-Check Extension

(function init() {
    const { eventSource, event_types } = SillyTavern.getContext();

    eventSource.on(event_types.APP_READY, () => {
        injectButton();
    });

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


// ── Popup ─────────────────────────────────────────────────────

function getOrCreatePopup() {
    let popup = document.getElementById('ppc-popup');
    if (popup) return popup;

    popup = document.createElement('div');
    popup.id = 'ppc-popup';
    popup.style.cssText = `
        display: none;
        position: fixed;
        z-index: 2147483647;
        background: #f5f0e8;
        border: 1px solid #d6cfc3;
        border-radius: 8px;
        padding: 10px 15px;
        font-size: 14px;
        line-height: 1.75;
        color: #2a2a2a;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        white-space: nowrap;
        pointer-events: none;
    `;
    document.body.appendChild(popup);
    return popup;
}

function positionPopup(popup, btn) {
    const rect = btn.getBoundingClientRect();
    const popupW = popup.offsetWidth || 200;
    const popupH = popup.offsetHeight || 80;

    let left = rect.left + rect.width / 2 - popupW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8));

    let top = rect.top - popupH - 8;
    // 위쪽 공간이 없으면 아래에 표시
    if (top < 8) top = rect.bottom + 8;

    popup.style.left = left + 'px';
    popup.style.top  = top + 'px';
}


// ── Button Injection ──────────────────────────────────────────

function injectButton() {
    if (document.getElementById('ppc-btn')) return;

    const popup = getOrCreatePopup();
    popup.innerHTML = buildPopupHTML();

    const btn = document.createElement('div');
    btn.id = 'ppc-btn';
    btn.title = 'Preset & Profile';
    btn.classList.add('interactable');
    btn.setAttribute('tabindex', '0');
    btn.textContent = '🔌';
    Object.assign(btn.style, {
        fontSize:       '1rem',
        cursor:         'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
    });

    let isOpen = false;

    function openPopup() {
        popup.innerHTML = buildPopupHTML();
        popup.style.display = 'block';
        requestAnimationFrame(() => positionPopup(popup, btn));
        isOpen = true;
    }
    function closePopup() {
        popup.style.display = 'none';
        isOpen = false;
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen ? closePopup() : openPopup();
    });
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target)) closePopup();
    });

    // 요술봉 바로 뒤에 삽입
    const wandSelectors = [
        '#options_button',
        '#extensionsMenuButton',
        '#extensionOptionsButton',
        '.fa-wand-magic-sparkles',
        '.fa-magic',
    ];

    let inserted = false;
    for (const sel of wandSelectors) {
        let target = document.querySelector(sel);
        if (!target) continue;
        if (sel.startsWith('.fa-')) {
            target = target.closest('.interactable, [tabindex]') || target.parentElement;
        }
        if (target?.parentElement) {
            target.parentElement.insertBefore(btn, target.nextSibling);
            inserted = true;
            break;
        }
    }
    if (!inserted) {
        for (const sel of ['#leftSendForm', '#send_form > div.flex-container', '#send_form']) {
            const el = document.querySelector(sel);
            if (el) { el.appendChild(btn); inserted = true; break; }
        }
    }
    if (!inserted) {
        const sendBtn = document.getElementById('send_but');
        if (sendBtn?.parentElement) sendBtn.parentElement.insertBefore(btn, sendBtn);
    }
}


// ── Data ──────────────────────────────────────────────────────

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

    for (const sel of ['#settings_preset', '#preset_name_select', 'select[name="preset_name"]']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const txt = el.options[el.selectedIndex]?.text?.trim();
        if (txt && txt !== '—') return txt;
    }
    return '—';
}

function getCurrentProfileName() {
    // Connection Profile 드롭다운
    for (const sel of ['#connection-profile-select', '#connection_profiles_list', 'select[name="connection_profile"]']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const txt = el.options[el.selectedIndex]?.text?.trim();
        if (txt && txt !== '' && txt !== '—') return txt;
    }
    return null;
}

function getCurrentModelName() {
    // 1. select 드롭다운 (표준 API들)
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

    // 2. Custom (OpenAI-compatible) — 텍스트 input 필드
    const customModelInputs = [
        '#model_custom_select',         // 혹시 select인 경우
        '#custom_model_id',
        'input[name="custom_model_id"]',
        '#openai_custom_model_id',
        'input[placeholder*="model" i]',
        'input[id*="model" i]',
    ];
    for (const sel of customModelInputs) {
        const el = document.querySelector(sel);
        if (!el || isHidden(el)) continue;
        const txt = (el.value || '').trim();
        if (txt && txt !== '') return txt;
    }

    // 3. mainApi fallback
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


// ── Popup HTML ────────────────────────────────────────────────

function buildPopupHTML() {
    const preset  = escapeHtml(getCurrentPresetName());
    const profile = getCurrentProfileName();
    const model   = getCurrentModelName();

    // 프로필명 / 모델명 — 둘 다 있으면 슬래시로 연결, 하나만 있으면 그것만
    let apiLine = '—';
    if (profile && model && model !== '—') {
        apiLine = escapeHtml(profile) + ' / ' + escapeHtml(model);
    } else if (profile) {
        apiLine = escapeHtml(profile);
    } else if (model && model !== '—') {
        apiLine = escapeHtml(model);
    }

    return `
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="flex-shrink:0">📋</span>
            <span style="font-weight:500">${preset}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:3px;">
            <span style="flex-shrink:0">🔌</span>
            <span style="font-weight:500">${apiLine}</span>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
