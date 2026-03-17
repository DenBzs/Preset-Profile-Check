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
            if (popup && popup.dataset.open === 'true') {
                popup.innerHTML = buildPopupHTML();
            }
        });
    }
})();


// ── UI Injection ──────────────────────────────────────────────

function injectButton() {
    if (document.getElementById('ppc-btn')) return;

    // ── Popup (fixed, bottom-center) ──
    const popup = document.createElement('div');
    popup.id = 'ppc-popup';
    popup.dataset.open = 'false';
    Object.assign(popup.style, {
        display:        'none',
        position:       'fixed',
        bottom:         '130px',
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
        zIndex:         '10000',
        whiteSpace:     'nowrap',
        backdropFilter: 'blur(6px)',
    });
    popup.innerHTML = buildPopupHTML();
    document.body.appendChild(popup);

    // ── Button ──
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

    function openPopup() {
        popup.innerHTML = buildPopupHTML();
        popup.style.display = 'block';
        popup.dataset.open = 'true';
    }
    function closePopup() {
        popup.style.display = 'none';
        popup.dataset.open = 'false';
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.dataset.open === 'true' ? closePopup() : openPopup();
    });

    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target)) closePopup();
    });

    // ── 요술봉(wand) 버튼 바로 뒤에 삽입 ──
    // ST wand button selectors (try most specific first)
    const wandSelectors = [
        '#options_button',          // 일반적인 ST wand
        '#extensionsMenuButton',
        '#extensionOptionsButton',
        '[id*="option"][id*="btn"]',
        '.fa-magic',                // font-awesome magic icon 부모
        '.fa-wand-magic-sparkles',
    ];

    let inserted = false;

    for (const sel of wandSelectors) {
        let target = document.querySelector(sel);
        // fa- 클래스는 아이콘 자체 → 버튼 부모로 올라가기
        if (target && (sel.startsWith('.fa-'))) {
            target = target.closest('.interactable, [tabindex], div[id]') || target.parentElement;
        }
        if (target && target.parentElement) {
            // 요술봉 바로 뒤에 삽입 = nextSibling 앞에 삽입
            target.parentElement.insertBefore(btn, target.nextSibling);
            inserted = true;
            break;
        }
    }

    if (!inserted) {
        // fallback: 버튼줄 맨 뒤
        const containers = [
            '#leftSendForm',
            '#send_form > div.flex-container.flexGap5',
            '#send_form > div.flex-container',
            '#send_form',
        ];
        for (const sel of containers) {
            const el = document.querySelector(sel);
            if (el) { el.appendChild(btn); inserted = true; break; }
        }
    }

    if (!inserted) {
        const sendBtn = document.getElementById('send_but');
        if (sendBtn?.parentElement) sendBtn.parentElement.insertBefore(btn, sendBtn);
    }

    console.log('[PPC] Button injected:', btn.parentElement?.id ?? '(no parent id)', '| wand found:', !!document.querySelector(wandSelectors[0]));
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
        if (txt && txt !== '—' && txt !== '') return txt;
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
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
