// Preset-Profile-Check Extension
// Shows current prompt preset and connection profile in a small popup above the button

(function init() {
    const { eventSource, event_types } = SillyTavern.getContext();

    eventSource.on(event_types.APP_READY, () => {
        injectButton();
    });

    // Update popup content on any relevant change event
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

    // ── Popup ──
    const popup = document.createElement('div');
    popup.id = 'ppc-popup';
    Object.assign(popup.style, {
        display:        'none',
        position:       'absolute',
        bottom:         'calc(100% + 8px)',
        right:          '0',           // 오른쪽 기준 정렬 → 모바일 잘림 방지
        background:     'var(--SmartThemeBlurTintColor, rgba(18,18,26,0.97))',
        border:         '1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.22))',
        borderRadius:   '8px',
        padding:        '8px 13px',
        minWidth:       '180px',
        maxWidth:       'calc(100vw - 24px)',
        fontSize:       '0.84rem',
        lineHeight:     '1.75',
        color:          'var(--SmartThemeBodyColor, #e0e0e0)',
        boxShadow:      '0 4px 20px rgba(0,0,0,0.65)',
        zIndex:         '99999',
        whiteSpace:     'nowrap',
        pointerEvents:  'none',
        backdropFilter: 'blur(6px)',
    });

    popup.innerHTML = buildPopupHTML();

    // ── Button — ST 스타일 맞추기 ──
    const btn = document.createElement('div');
    btn.id = 'ppc-btn';
    btn.title = 'Preset & Profile';
    // ST 기본 입력줄 버튼들과 동일한 인라인 스타일 모방
    Object.assign(btn.style, {
        position:        'relative',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           '40px',
        height:          '40px',
        borderRadius:    '50%',
        background:      'var(--SmartThemeBlurTintColor, rgba(255,255,255,0.07))',
        border:          '1px solid var(--SmartThemeBorderColor, rgba(255,255,255,0.15))',
        cursor:          'pointer',
        fontSize:        '1.1rem',
        flexShrink:      '0',
        transition:      'background 0.15s',
    });
    btn.textContent = '🔌';
    btn.appendChild(popup);

    btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--SmartThemeBodyColorAlt, rgba(255,255,255,0.15))';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'var(--SmartThemeBlurTintColor, rgba(255,255,255,0.07))';
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
        const p = document.getElementById('ppc-popup');
        if (p) p.style.display = 'none';
    });

    // ── Inject: ST 버튼줄 컨테이너에 붙이기 ──
    const targets = [
        '#leftSendForm',
        '#send_form > div.flex-container.flexGap5',
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
    const selectors = [
        '#settings_preset',
        '#preset_name_select',
        'select[name="preset_name"]',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const txt = el.options[el.selectedIndex]?.text?.trim();
        if (txt && txt !== '—') return txt;
    }
    return '—';
}

function getCurrentProfileInfo() {
    // 1. Connection Profile 이름 (ST 1.12.6+)
    const profileSelectors = [
        '#connection-profile-select',
        '#connection_profiles_list',
        'select[name="connection_profile"]',
    ];
    for (const sel of profileSelectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const txt = el.options[el.selectedIndex]?.text?.trim();
        if (txt && txt !== '' && txt !== '—') return txt;
    }

    // 2. 모델명 fallback — 현재 활성 API에 해당하는 select만 읽기
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
        if (!el) continue;
        // 숨겨진 섹션 안에 있으면 현재 API가 아님
        if (isHidden(el)) continue;
        const txt = (el.options[el.selectedIndex]?.text || el.value || '').trim();
        if (txt && txt !== '—' && txt !== '') return txt;
    }

    // 3. API 이름만
    try {
        const api = SillyTavern.getContext().mainApi;
        if (api) return api;
    } catch {}

    return '—';
}

function isHidden(el) {
    let node = el;
    while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return true;
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
            <span style="overflow:hidden;text-overflow:ellipsis">${preset}</span>
        </div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:3px;">
            <span style="flex-shrink:0">🔌</span>
            <span style="overflow:hidden;text-overflow:ellipsis">${profile}</span>
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
