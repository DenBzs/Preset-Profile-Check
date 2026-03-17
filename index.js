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
                refreshPopup(popup);
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
    const popupH = popup.offsetHeight || 70;

    let left = rect.left + rect.width / 2 - popupW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8));

    let top = rect.top - popupH - 8;
    if (top < 8) top = rect.bottom + 8;

    popup.style.left = left + 'px';
    popup.style.top  = top + 'px';
}

async function refreshPopup(popup) {
    popup.innerHTML = await buildPopupHTML();
}


// ── Button Injection ──────────────────────────────────────────

function injectButton() {
    if (document.getElementById('ppc-btn')) return;

    const popup = getOrCreatePopup();

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

    async function openPopup() {
        popup.innerHTML = '⏳';
        popup.style.display = 'block';
        requestAnimationFrame(() => positionPopup(popup, btn));
        popup.innerHTML = await buildPopupHTML();
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

async function getCurrentProfileName() {
    // 방법 1: /profile 슬래시 커맨드 실행해서 결과 읽기 (가장 정확)
    try {
        const ctx = SillyTavern.getContext();
        // executeSlashCommandsWithOptions는 staging 버전 함수명
        const execFn = ctx.executeSlashCommandsWithOptions
                    ?? window.executeSlashCommandsWithOptions
                    ?? ctx.executeSlashCommands
                    ?? window.executeSlashCommands;

        if (typeof execFn === 'function') {
            const result = await execFn('/profile', { showOutput: false, handleReturn: false });
            // 결과가 문자열로 반환됨
            const name = (typeof result === 'string' ? result : result?.pipe)?.trim();
            if (name && name !== '' && name !== 'null') return name;
        }
    } catch {}

    // 방법 2: Connection Manager DOM fallback
    for (const sel of [
        '#connection-profile-select',
        '#connection_profiles_list',
        'select[name="connection_profile"]',
    ]) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const txt = el.options[el.selectedIndex]?.text?.trim();
        if (txt && txt !== '' && txt !== '—') return txt;
    }

    return '—';
}


// ── Popup HTML ────────────────────────────────────────────────

async function buildPopupHTML() {
    const preset  = escapeHtml(getCurrentPresetName());
    const profile = escapeHtml(await getCurrentProfileName());

    return `
        <div style="display:flex;align-items:center;gap:8px;">
            <span>📋</span>
            <span style="font-weight:500">${preset}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
            <span>🤖</span>
            <span style="font-weight:500">${profile}</span>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
