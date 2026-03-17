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
            if (document.getElementById('ppc-popup')) {
                refreshPopup();
            }
        });
    }
})();


// ── Popup (global, appended to body once) ────────────────────

function getOrCreatePopup() {
    let popup = document.getElementById('ppc-popup');
    if (popup) return popup;

    popup = document.createElement('div');
    popup.id = 'ppc-popup';

    // 스타일: z-index 최대, fixed, 기본 숨김
    popup.style.cssText = `
        display: none;
        position: fixed;
        z-index: 2147483647;
        background: rgba(18, 18, 26, 0.97);
        border: 1px solid rgba(255,255,255,0.22);
        border-radius: 8px;
        padding: 10px 15px;
        font-size: 14px;
        line-height: 1.75;
        color: #e0e0e0;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        white-space: nowrap;
        pointer-events: none;
    `;

    document.body.appendChild(popup);
    return popup;
}

function refreshPopup() {
    const popup = document.getElementById('ppc-popup');
    if (!popup) return;
    popup.innerHTML = buildPopupHTML();
}

function positionPopup(popup, btn) {
    // 버튼 위치를 기준으로 팝업 좌표 계산
    const rect = btn.getBoundingClientRect();
    const popupW = popup.offsetWidth || 200;

    // 가로: 버튼 중앙 기준, 화면 밖으로 안 나가게 클램프
    let left = rect.left + rect.width / 2 - popupW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8));

    // 세로: 버튼 위쪽 8px
    const top = rect.top - (popup.offsetHeight || 80) - 8;

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
        // 일단 화면에 렌더링 후 위치 계산 (offsetHeight 확보)
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

    // ── 요술봉 바로 뒤에 삽입 ──
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
        // 아이콘 클래스면 부모 버튼으로
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
        // fallback: 버튼줄 맨 뒤
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

function getCurrentProfileInfo() {
    for (const sel of ['#connection-profile-select', '#connection_profiles_list', 'select[name="connection_profile"]']) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const txt = el.options[el.selectedIndex]?.text?.trim();
        if (txt && txt !== '' && txt !== '—') return txt;
    }
    const modelSelectors = [
        '#model_openai_select', '#model_claude_select', '#model_windowai_select',
        '#openrouter_model', '#model_openrouter_select', '#model_cohere_select',
        '#model_google_select', '#model_mistral_select', '#model_ai21_select',
        '#model_custom_select', '#model_textgenerationwebui_select',
        '#model_kobold_select', '#model_novel_select',
    ];
    for (const sel of modelSelectors) {
        const el = document.querySelector(sel);
        if (!el || isHidden(el)) continue;
        const txt = (el.options[el.selectedIndex]?.text || el.value || '').trim();
        if (txt && txt !== '—') return txt;
    }
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
    const profile = escapeHtml(getCurrentProfileInfo());
    return `
        <div style="display:flex;align-items:center;gap:7px;">
            <span>📋</span><span>${preset}</span>
        </div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:3px;">
            <span>🔌</span><span>${profile}</span>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
