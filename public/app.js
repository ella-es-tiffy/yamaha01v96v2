/**
 * MODULE: Pro Touch (Modern Remote)
 * VERSION: v0.3-pt (Stable)
        */

class YamahaTouchRemote {
    constructor() {
        this.socket = null;
        this.wsUrl = `ws://${window.location.hostname}:3007`;
        this.selectedChannel = 1;
        this.currentBankStart = 1;
        this.activeKnob = null;
        this.activeFader = null; // Track which fader is being actively moved
        this.storedGains = {}; // Storage for gain values before HPF/LPF snapping
        this.debugUI = false; // Toggle for hex values/addresses
        this.meterOffset = 0; // Noise gate for meters
        this.meterBankOnly = false; // ECO Mode: Only visible 8 ch
        this.autoCloseSafety = false; // Auto-close EQ lock cover
        this.currentPresetIdx = 0; // Track current preset (0-indexed)

        this.state = {
            channels: Array(36).fill(null).map((_, i) => ({
                fader: 0, mute: false, pan: 64, eqOn: false, fxOn: false, name: (i < 32) ? `CH${i + 1}` : `ST${i - 31}`, eq: {
                    low: { q: 64, freq: 64, gain: 64 },
                    lmid: { q: 64, freq: 64, gain: 64 },
                    hmid: { q: 64, freq: 64, gain: 64 },
                    high: { q: 64, freq: 64, gain: 64 }
                }
            })),
            master: { fader: 0, mute: false, fxOn: false },
            settings: { uiLocked: false }
        };

        this.init();
    }

    init() {
        // Inject SVG Gradients for Knobs
        this.injectGradients();
        this.renderMixer();
        this.renderEQ();
        this.connect();
        this.setupHandlers();

        // Delayed sync to ensure DOM is ready and initial state is received
        setTimeout(() => {
            console.log('[INIT] Delayed syncFaders for EQ buttons');
            this.syncFaders();
        }, 1000);

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1 && e.target.closest('.mixer-viewport')) e.preventDefault();
        }, { passive: false });
        document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
    }

    // ===== CUSTOM MODAL HELPER FUNCTIONS v1.0 =====

    showNotification(message, type = 'error', duration = 3000) {
        const notif = document.getElementById('custom-notification');
        notif.textContent = message;
        notif.className = `custom-notification ${type}`;
        notif.classList.add('active');
        setTimeout(() => notif.classList.remove('active'), duration);
    }

    async showConfirm(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-modal');
            const titleEl = document.getElementById('modal-title');
            const messageEl = document.getElementById('modal-message');
            const inputEl = document.getElementById('modal-input');
            const okBtn = document.getElementById('modal-ok');
            const cancelBtn = document.getElementById('modal-cancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            inputEl.style.display = 'none';
            modal.classList.add('active');
            okBtn.focus();

            const cleanup = () => {
                modal.classList.remove('active');
                okBtn.replaceWith(okBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            };

            setTimeout(() => {
                const newOkBtn = document.getElementById('modal-ok');
                const newCancelBtn = document.getElementById('modal-cancel');

                newOkBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(true);
                });

                newCancelBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(false);
                });
            }, 10);
        });
    }

    async showPrompt(title, message, defaultValue = '') {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-modal');
            const titleEl = document.getElementById('modal-title');
            const messageEl = document.getElementById('modal-message');
            const inputEl = document.getElementById('modal-input');
            const okBtn = document.getElementById('modal-ok');
            const cancelBtn = document.getElementById('modal-cancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            inputEl.style.display = 'block';
            inputEl.value = defaultValue;
            modal.classList.add('active');
            inputEl.focus();
            inputEl.select();

            const cleanup = () => {
                modal.classList.remove('active');
                okBtn.replaceWith(okBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            };

            setTimeout(() => {
                const newOkBtn = document.getElementById('modal-ok');
                const newCancelBtn = document.getElementById('modal-cancel');

                const submitValue = () => {
                    const value = inputEl.value.trim();
                    cleanup();
                    resolve(value || null);
                };

                newOkBtn.addEventListener('click', submitValue);
                newCancelBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(null);
                });

                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') submitValue();
                    else if (e.key === 'Escape') {
                        cleanup();
                        resolve(null);
                    }
                });
            }, 10);
        });
    }

    updatePresetDisplay() {
        const presetLabel = document.getElementById('val-eq-preset');
        if (!presetLabel) return;

        const uiNumber = this.currentPresetIdx + 1;
        const name = (this.state.eqPresets && this.state.eqPresets[uiNumber]) || '-- EMPTY --';

        presetLabel.innerHTML = `
            <span style="font-size: 0.5rem; color: var(--accent); margin-right: 5px; font-weight: bold;">${uiNumber.toString().padStart(3, '0')}</span>
            <span style="font-size: 0.6rem;">${name.toUpperCase()}</span>
        `;
    }

    injectGradients() {
        if (document.getElementById('svg-defs')) return;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = 'svg-defs';
        svg.style.position = 'absolute'; svg.style.width = 0; svg.style.height = 0;
        svg.innerHTML = `
            <defs>
                <linearGradient id="knobGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#888;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#444;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#222;stop-opacity:1" />
                </linearGradient>
            </defs>
        `;
        document.body.appendChild(svg);
    }

    renderMixer() {
        const mixer = document.getElementById('mixer');
        mixer.innerHTML = '';
        const end = Math.min(36, this.currentBankStart + 7);
        for (let i = this.currentBankStart; i <= end; i++) {
            const strip = document.createElement('div');
            strip.className = 'channel-strip';
            strip.id = `strip-${i}`;
            const chIdx = i - 1;
            const chState = this.state.channels[chIdx];

            strip.innerHTML = `
                <div class="ch-num">${i}</div>
                <div class="fx-button ${chState?.fxOn ? 'active' : ''}" id="fx-btn-${i}" data-ch="${i}">FX</div>
                <div class="on-button ${chState?.mute ? 'muted' : 'active'}" id="btn-${i}" data-ch="${i}">${chState?.mute ? 'MUTE' : 'ON'}</div>
                <div class="eq-button ${chState?.eqOn ? 'active' : ''}" id="eq-btn-${i}" data-ch="${i}">EQ</div>
                <button class="sel-button ${this.selectedChannel === i ? 'active' : ''}" id="sel-${i}" data-ch="${i}">SEL</button>
                <div class="pan-area">
                    <div class="value-display pan-val" id="val-pan-${i}">--</div>
                    <svg class="knob-svg pan-knob" id="pan-${i}" viewBox="0 0 60 60" data-ch="${i}">
                        <path d="M 12 48 A 24 24 0 1 1 48 48" fill="none" class="ring-bg" stroke-linecap="round" />
                        <path id="ring-pan-${i}" d="M 12 48 A 24 24 0 1 1 48 48" fill="none" class="ring-active" stroke-linecap="round" stroke-dasharray="120" stroke-dashoffset="120" />
                        <circle cx="30" cy="30" r="20" class="knob-circle"></circle>
                        <line x1="30" y1="30" x2="30" y2="10" class="knob-indicator" id="ind-pan-${i}"></line>
                    </svg>
                </div>
                <div class="fader-area" id="slot-${i}" data-ch="${i}">
                    <div class="fader-track"><div class="fader-thumb" id="thumb-${i}"></div></div>
                    <div class="meter-bar"><div class="meter-fill" id="meter-${i}"></div></div>
                </div>
                <div class="db-val" id="val-${i}">${chState?.fader || 0}</div>
                <div class="ch-name-box" id="name-box-${i}" data-ch="${i}">${chState?.name || `CH${i}`}</div>
            `;
            mixer.appendChild(strip);
            this.updateFaderUI(i, chState?.fader || 0);
            this.updatePanUI(i, chState?.pan ?? 64);
            this.updateMeterUI(i, chState?.meter || 0);
        }
        this.updateSelectionUI();
    }

    renderEQ() {
        const eqArea = document.getElementById('eq-area');
        if (!eqArea) return;

        eqArea.innerHTML = `
            <div style="padding: 0 5px 10px 5px; display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #222; margin-bottom: 12px;">
                <div style="display: flex; align-items: baseline; gap: 8px;">
                    <span style="color: #666; font-weight: 900; font-size: 0.8rem; letter-spacing: 1px;">EQ</span>
                    <span id="sel-ch-label" style="color: var(--accent); font-weight: 900; font-size: 0.8rem; text-shadow: 0 0 10px rgba(0,210,255,0.4); line-height: 1;">${this.selectedChannel}</span>
                </div>
                <span style="color: #444; font-size: 0.5rem; letter-spacing: 2px; font-weight: 300; text-transform: uppercase;">4-Band Parametric Equalizer</span>
            </div>

            <div class="eq-header">
                <div></div> <!-- Spacer for Label Col -->
                <div class="eq-column-header">LOW</div>
                <div class="eq-column-header">MID-LOW</div>
                <div class="eq-column-header">MID-HIGH</div>
                <div class="eq-column-header">HIGH</div>
            </div>
            <div class="eq-grid" id="eq-grid" style="margin-top: 5px;"></div>
        `;

        const grid = document.getElementById('eq-grid');

        // --- GLOBAL EQ SECTION (TOP) ---
        const globalRow = document.createElement('div');
        globalRow.style.position = 'relative';
        globalRow.style.overflow = 'hidden';
        globalRow.style.border = '1px solid var(--glass-border)';
        globalRow.style.borderRadius = '6px';
        globalRow.style.marginBottom = '5px';
        globalRow.style.background = '#0d0d0d'; // Darker background

        const innerGrid = document.createElement('div');
        innerGrid.style.display = 'grid';
        innerGrid.style.gridTemplateColumns = '80px 100px 180px';
        innerGrid.style.gap = '10px';
        innerGrid.style.alignItems = 'start';
        innerGrid.style.justifyContent = 'start';
        innerGrid.style.padding = '8px 12px';

        innerGrid.innerHTML = `
            <!-- ATTENUATION -->
            <div class="knob-container" style="flex-direction: row; gap: 8px; align-items: center; padding-top: 25px;">
                <div class="row-label" style="font-size: 0.55rem; color: #555;">ATT</div>
                <div style="position: relative;">
                    <div class="value-display" id="val-enc-att" style="position: absolute; top: -12px; width: 50px; text-align: center; left: 50%; transform: translateX(-50%); font-size: 0.45rem; color: var(--accent);">--</div>
                    <svg class="knob-svg" id="enc-att" viewBox="0 0 60 60" style="width: 55px; height: 55px;">
                        <path d="M 12 48 A 24 24 0 1 1 48 48" fill="none" class="ring-bg" stroke-linecap="round" />
                        <path id="ring-enc-att" d="M 12 48 A 24 24 0 1 1 48 48" fill="none" class="ring-active" stroke-linecap="round" stroke-dasharray="120" stroke-dashoffset="120" />
                        <circle cx="30" cy="30" r="20" class="knob-circle"></circle>
                        <line x1="30" y1="30" x2="30" y2="10" class="knob-indicator"></line>
                    </svg>
                </div>
            </div>

            <!-- EQ TYPE / RESET -->
            <div style="display: flex; gap: 4px; flex-direction: column; align-items: center; border-left: 1px solid #222; padding-left: 10px;">
                <span class="eq-label" style="font-size: 0.45rem; color: #555; font-weight: bold; text-align: center;">TYPE</span>
                <div style="display: flex; gap: 2px; width: 100%;">
                    <button class="eq-type-btn" id="btn-eq-type1" data-type="0" style="flex:1; font-size: 0.5rem; padding: 4px 0; background: #1a1a1a; border: 1px solid #333; color: #555; border-radius: 2px; cursor: pointer;">I</button>
                    <button class="eq-type-btn" id="btn-eq-type2" data-type="1" style="flex:1; font-size: 0.5rem; padding: 4px 0; background: #1a1a1a; border: 1px solid #333; color: #555; border-radius: 2px; cursor: pointer;">II</button>
                </div>
                <button id="btn-eq-reset" style="width: 100%; font-size: 0.5rem; height: 26px; background: #cc88aa; border: 1px solid #aa6688; color: #000; border-radius: 2px; cursor: pointer; font-weight: 900; margin-top: 5px; text-transform: uppercase;">SET NEUTRAL</button>
            </div>

            <!-- PRESET NAVIGATION -->
            <div style="display: flex; gap: 2px; flex-direction: column; align-items: center; border-left: 1px solid #222; padding-left: 10px;">
                <span class="eq-label" style="font-size: 0.55rem; color: #666; letter-spacing: 1px; font-weight: bold; text-transform: uppercase;">LIBRARY</span>
                <div class="value-display" id="val-eq-preset" style="width: 100%; height: 22px; background: #000; border: 1px solid #333; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: var(--accent); border-radius: 3px; box-shadow: inset 0 0 10px rgba(0,210,255,0.1); font-family: monospace; font-weight: bold; cursor: pointer; padding: 0 5px; overflow: hidden; white-space: nowrap;">
                    -- LOAD --
                </div>
                <div style="display: flex; gap: 4px; width: 100%; margin-top: 4px;">
                    <button class="lib-btn" id="btn-lib-prev" style="flex: 1; height: 32px; font-size: 1rem; background: #1a1a1a; border: 1px solid #333; color: var(--accent); border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center;">◀</button>
                    <button class="lib-btn" id="btn-lib-next" style="flex: 1; height: 32px; font-size: 1rem; background: #1a1a1a; border: 1px solid #333; color: var(--accent); border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center;">▶</button>
                </div>
            </div>
        `;

        // Safety Cover
        const cover = document.createElement('div');
        cover.className = 'safety-cover';
        cover.id = 'eq-safety-cover';
        cover.innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 5px;">🔒</div>
            <div style="font-size: 0.7rem; font-weight: 900; letter-spacing: 2px; color: #888;">LOCKED</div>
            <div style="font-size: 0.5rem; color: #555; margin-top: 5px;">TAP TO EDIT</div>
        `;

        // Add a "CLOSE" tab that only appears when open
        const closeTab = document.createElement('div');
        closeTab.innerHTML = 'RE-LOCK';
        closeTab.style.cssText = 'position: absolute; top: -25px; left: 50%; transform: translateX(-50%); background: #cc8800; color: #000; padding: 2px 10px; font-size: 0.5rem; font-weight: 900; border-radius: 4px 4px 0 0; cursor: pointer; display: none; transition: top 0.3s;';

        // This tab will be visible when the cover is up (open)
        globalRow.appendChild(closeTab);

        if (cover && globalRow) {
            cover.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!cover.classList.contains('open')) {
                    cover.classList.add('open');
                    closeTab.style.display = 'block';
                    setTimeout(() => closeTab.style.top = '0px', 10);
                }
            });

            closeTab.addEventListener('click', (e) => {
                e.stopPropagation();
                cover.classList.remove('open');
                closeTab.style.top = '-25px';
                setTimeout(() => closeTab.style.display = 'none', 300);
            });

            globalRow.addEventListener('mouseleave', () => {
                if (this.autoCloseSafety && cover.classList.contains('open')) {
                    cover.classList.remove('open');
                    closeTab.style.top = '-25px';
                    setTimeout(() => closeTab.style.display = 'none', 300);
                }
            });
        }

        // --- PRESET HANDLERS ---
        const presetLabel = innerGrid.querySelector('#val-eq-preset');


        presetLabel?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openPresetBrowser();
        });

        innerGrid.querySelector('#btn-lib-prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentPresetIdx > 0) {
                this.currentPresetIdx--;
                this.updatePresetDisplay();
                const presetId = this.currentPresetIdx + 1;
                console.log(`[UI] Recalling Preset ${presetId} (idx ${this.currentPresetIdx})`);
                this.send('recallEQ', { channel: this.selectedChannel, preset: presetId });
            }
        });

        innerGrid.querySelector('#btn-lib-next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentPresetIdx < 127) {
                this.currentPresetIdx++;
                this.updatePresetDisplay();
                const presetId = this.currentPresetIdx + 1;
                console.log(`[UI] Recalling Preset ${presetId} (idx ${this.currentPresetIdx})`);
                this.send('recallEQ', { channel: this.selectedChannel, preset: presetId });
            }
        });

        globalRow.appendChild(innerGrid);
        globalRow.appendChild(cover);
        eqArea.appendChild(globalRow);

        // Update display now that elements are in DOM
        this.updatePresetDisplay();

        grid.innerHTML = '';
        const bands = ['low', 'lmid', 'hmid', 'high'];
        const rows = [
            { id: 'q', label: 'Q' },
            { id: 'freq', label: 'F' },
            { id: 'gain', label: 'G' }
        ];

        rows.forEach(row => {
            const label = document.createElement('div');
            label.className = 'row-label';
            label.innerText = row.label;
            grid.appendChild(label);

            bands.forEach(band => {
                const id = `enc-${band}-${row.id}`;
                const cell = document.createElement('div');
                cell.className = 'knob-container';
                cell.innerHTML = `
                    <div class="value-display" id="val-${id}">--</div>
                    <svg class="knob-svg eq-knob" id="${id}" viewBox="0 0 60 60" data-band="${band}" data-param="${row.id}">
                        <path d="M 12 48 A 24 24 0 1 1 48 48" fill="none" class="ring-bg" stroke-linecap="round" />
                        <path id="ring-${id}" d="M 12 48 A 24 24 0 1 1 48 48" fill="none" class="ring-active" stroke-linecap="round" stroke-dasharray="120" stroke-dashoffset="120" />
                        <circle cx="30" cy="30" r="20" class="knob-circle"></circle>
                        <line x1="30" y1="30" x2="30" y2="10" class="knob-indicator" id="ind-${id}"></line>
                    </svg>
                `;
                grid.appendChild(cell);
            });
        });
        this.updateKnobAddresses();
        this.syncEQToSelected();
    }

    setupHandlers() {
        const handlePointer = (e, targetArea, chId) => {
            const rect = targetArea.getBoundingClientRect();
            const constrainedY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
            const value = Math.round((1 - (constrainedY / rect.height)) * 1023);
            this.updateFaderUI(chId, value);

            // Update local state to prevent snap-back
            if (chId === 'master') {
                this.state.master.fader = value;
            } else {
                const chIdx = parseInt(chId) - 1;
                if (this.state.channels[chIdx]) {
                    this.state.channels[chIdx].fader = value;
                }
            }

            this.send('setFader', { channel: chId, value });
        };

        // Channel Selection (SEL buttons)
        document.querySelector('.mixer-layout-wrapper').addEventListener('click', (e) => {
            const selBtn = e.target.closest('.sel-button');
            if (selBtn) {
                this.selectChannel(selBtn.dataset.ch);
            }
        });

        // Bank Buttons
        document.querySelectorAll('.bank-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('changelog-overlay').style.display = 'none';
                document.querySelectorAll('.bank-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentBankStart = parseInt(btn.dataset.start);
                this.renderMixer();
                if (this.meterBankOnly) this.triggerMeterSync();
            });
        });

        // Fader & Button Delegation (Mixer & Master)
        document.querySelector('.mixer-layout-wrapper').addEventListener('pointerdown', (e) => {
            const thumb = e.target.closest('.fader-thumb');
            const onBtn = e.target.closest('.on-button');
            const selBtn = e.target.closest('.sel-button');

            if (thumb) {
                const area = thumb.closest('.fader-area');
                const chId = area.dataset.ch;
                this.activeFader = chId; // Mark this fader as active
                thumb.setPointerCapture(e.pointerId);
                thumb.classList.add('dragging');
                handlePointer(e, area, chId);
                const onMove = (me) => { if (thumb.hasPointerCapture(me.pointerId)) handlePointer(me, area, chId); };
                const onUp = () => {
                    this.activeFader = null; // Clear active fader
                    thumb.releasePointerCapture(e.pointerId);
                    thumb.classList.remove('dragging');
                    thumb.removeEventListener('pointermove', onMove);
                };
                thumb.addEventListener('pointermove', onMove);
                thumb.addEventListener('pointerup', onUp, { once: true });
            } else if (onBtn) {
                const ch = onBtn.dataset.ch;
                const isMuted = onBtn.classList.contains('muted');
                this.updateMuteUI(ch, !isMuted);
                this.send('setMute', { channel: ch, value: !isMuted });
            } else if (e.target.closest('.eq-button')) {
                const btn = e.target.closest('.eq-button');
                const ch = parseInt(btn.dataset.ch);
                const chIdx = ch - 1;

                // Toggle state locally
                const currentState = this.state.channels[chIdx]?.eqOn || false;
                const newState = !currentState;

                if (this.state.channels[chIdx]) {
                    this.state.channels[chIdx].eqOn = newState;
                }

                btn.classList.toggle('active', newState);
                this.send('setEQOn', { channel: ch, value: newState });
            } else if (e.target.closest('.fx-button')) {
                const btn = e.target.closest('.fx-button');
                const ch = btn.dataset.ch;
                const chIdx = (ch === 'master') ? 'master' : parseInt(ch) - 1;

                let currentState;
                if (chIdx === 'master') {
                    currentState = this.state.master.fxOn || false;
                    this.state.master.fxOn = !currentState;
                } else {
                    currentState = this.state.channels[chIdx]?.fxOn || false;
                    this.state.channels[chIdx].fxOn = !currentState;
                }

                btn.classList.toggle('active', !currentState);
                // We don't have a backend command for FX yet, but we toggle the UI
            } else if (selBtn) {
                document.getElementById('changelog-overlay').style.display = 'none';
                this.selectChannel(selBtn.dataset.ch);
            }
        });

        // Channel Strip Pan Delegation
        document.querySelector('.mixer-layout-wrapper').addEventListener('pointerdown', (e) => {
            const knob = e.target.closest('.pan-knob');
            if (knob) {
                e.preventDefault(); e.stopPropagation();
                knob.setPointerCapture(e.pointerId);
                const chId = knob.dataset.ch;
                this.activeKnob = `pan-${chId}`;
                let startY = e.clientY;
                let startVal = this.state.channels[parseInt(chId) - 1].pan || 64;
                const onMove = (me) => {
                    if (this.activeKnob === `pan-${chId}`) {
                        const delta = (startY - me.clientY) * 0.6;
                        let val = Math.max(0, Math.min(127, Math.round(startVal + delta)));
                        this.updatePanUI(chId, val);
                        this.state.channels[parseInt(chId) - 1].pan = val;
                        this.send('setPan', { channel: chId, value: val });
                    }
                };
                const onUp = () => { knob.releasePointerCapture(e.pointerId); this.activeKnob = null; knob.removeEventListener('pointermove', onMove); };
                knob.addEventListener('pointermove', onMove);
                knob.addEventListener('pointerup', onUp, { once: true });
            }
        });

        document.getElementById('ver-btn')?.addEventListener('click', () => {
            const overlay = document.getElementById('changelog-overlay');
            const isVisible = overlay.style.display === 'block';
            overlay.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) this.send('getChangelog', {});
        });

        document.getElementById('sync-btn').addEventListener('click', (e) => {
            const btn = e.target;
            if (btn.classList.contains('syncing') || btn.disabled) return;
            this.send('sync', {});
            // Visual feedback starts immediately but actual state is driven by WebSocket 'syncStatus'
        });


        document.getElementById('debug-ui-btn')?.addEventListener('click', (e) => {
            this.debugUI = !this.debugUI;
            e.target.style.background = this.debugUI ? 'var(--accent)' : '#333';
            e.target.style.color = this.debugUI ? '#000' : '#fff';

            e.target.style.color = this.debugUI ? '#000' : '#fff';

            const devPanel = document.getElementById('dev-panel');
            if (devPanel) devPanel.classList.toggle('active', this.debugUI);
            document.body.classList.toggle('mode-dev-active', this.debugUI);
        });

        document.getElementById('dev-close-btn')?.addEventListener('click', () => {
            this.debugUI = false;
            document.body.classList.remove('mode-dev-active');
            const btn = document.getElementById('debug-ui-btn');
            if (btn) {
                btn.style.background = '#333';
                btn.style.color = '#fff';
            }
            document.getElementById('dev-panel')?.classList.remove('active');
            this.renderMixer();
            this.renderEQ();
        });

        // Developer Settings Handlers
        document.getElementById('meter-offset-slider')?.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            this.send('setMeterOffset', { value: val });
        });

        document.getElementById('meter-offset-slider')?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.meterOffset = val;
            document.getElementById('meter-offset-val').innerText = val;
        });

        document.getElementById('meter-rate-slider')?.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            this.send('setMeterInterval', { value: val * 1000 });
        });

        document.getElementById('meter-rate-slider')?.addEventListener('input', (e) => {
            document.getElementById('meter-rate-val').innerText = e.target.value + 's';
        });

        document.getElementById('meter-broadcast-slider')?.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            this.send('setMeterBroadcastRate', { value: val });
        });

        document.getElementById('meter-broadcast-slider')?.addEventListener('input', (e) => {
            document.getElementById('meter-broadcast-val').innerText = e.target.value + 'ms';
        });

        document.getElementById('debug-btn')?.addEventListener('click', () => {
            const l = document.getElementById('debug-log');
            if (l) l.style.display = l.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('refresh-meters')?.addEventListener('click', () => {
            console.log('🔄 Manually requesting meters...');
            this.send('sync', { type: 'meters' }); // Specific meter sync if supported, otherwise full
        });

        document.getElementById('dbg-bank-meters')?.addEventListener('change', (e) => {
            this.meterBankOnly = e.target.checked;
            this.send('setUIOption', { key: 'bankOnlyMetering', value: e.target.checked });
            this.triggerMeterSync();
        });

        document.getElementById('chk-auto-close-safety')?.addEventListener('change', (e) => {
            this.autoCloseSafety = e.target.checked;
            this.send('setUIOption', { key: 'autoCloseSafety', value: e.target.checked });
        });

        document.getElementById('copy-debug')?.addEventListener('click', () => {
            const logEl = document.getElementById('debug-log');
            const entries = Array.from(logEl.querySelectorAll('div:not(:first-child)'))
                .map(div => div.innerText.replace('> ', ''))
                .join('\n');

            // Fallback copy method for non-secure contexts (HTTP)
            const textArea = document.createElement("textarea");
            textArea.value = entries;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                const btn = document.getElementById('copy-debug');
                const oldText = btn.innerText;
                btn.innerText = 'COPIED!';
                setTimeout(() => btn.innerText = oldText, 2000);
            } catch (err) { }
            document.body.removeChild(textArea);
        });

        document.getElementById('scan-presets-btn')?.addEventListener('click', () => {
            console.log('[UI] Starting preset scan...');
            this.send('scanPresets', {});
        });

        // Encoder Delegation
        document.getElementById('eq-area').addEventListener('pointerdown', (e) => {
            const knob = e.target.closest('.knob-svg');
            if (knob) {
                e.preventDefault(); e.stopPropagation();
                knob.setPointerCapture(e.pointerId);
                this.activeKnob = knob.id;
                let startY = e.clientY;
                let startVal = this.getKnobMIDI(knob);
                const onMove = (me) => {
                    if (this.activeKnob === knob.id) {
                        const delta = (startY - me.clientY) * 0.6;
                        let val = Math.max(0, Math.min(127, Math.round(startVal + delta)));

                        this.handleEQChange(knob, val, startVal);
                    }
                };
                const onUp = () => { knob.releasePointerCapture(e.pointerId); this.activeKnob = null; knob.removeEventListener('pointermove', onMove); };
                knob.addEventListener('pointermove', onMove);
                knob.addEventListener('pointerup', onUp, { once: true });
            }
        });

        document.getElementById('eq-area').addEventListener('wheel', (e) => {
            const knob = e.target.closest('.knob-svg');
            if (knob) {
                e.preventDefault();
                const currentVal = this.getKnobMIDI(knob);
                let step = e.deltaY < 0 ? 3 : -3;
                let newVal = Math.max(0, Math.min(127, currentVal + step));

                // Pass currentVal as 'startVal' context for directional logic
                this.handleEQChange(knob, newVal, currentVal);
            }
        }, { passive: false });

        // EQ Type Button Clicks
        document.getElementById('eq-area').addEventListener('click', (e) => {
            const btn = e.target.closest('.eq-type-btn');
            if (btn) {
                const type = parseInt(btn.dataset.type);
                this.send('setEQType', { channel: this.selectedChannel, value: type });
                // Optimistic Local
                const ch = (this.selectedChannel === 'master') ? this.state.master : this.state.channels[this.selectedChannel - 1];
                if (ch) ch.eqType = type;
                this.syncEQToSelected();
            } else if (e.target.id === 'btn-eq-reset') {
                this.send('resetEQ', { channel: this.selectedChannel });
            } else if (e.target.id === 'val-eq-preset') {
                this.openPresetBrowser();
            }
        });
        // Global UI Lock Logic
        const lockBtn = document.getElementById('lock-ui-btn');
        const lockOverlay = document.getElementById('global-lock-overlay');
        const unlockSurface = lockOverlay?.querySelector('.unlock-surface');

        if (lockBtn && lockOverlay) {
            lockBtn.addEventListener('click', () => {
                console.log('🔒 Locking UI...');
                lockOverlay.classList.add('active');
                document.body.classList.add('mode-lock-active');
                this.send('setUILock', { value: true });
            });

            // Optimistic Unlock (UI opens immediately, then sends to server)
            const handleUnlock = () => {
                console.log('🔓 Unlocking UI (Local/Optimistic)...');
                lockOverlay.classList.remove('active');
                document.body.classList.remove('mode-lock-active');
                this.send('setUILock', { value: false });
            };

            lockOverlay.addEventListener('click', handleUnlock);
            lockOverlay.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleUnlock();
            }, { passive: false });
        }

        const panicBtn = document.getElementById('panic-unlock-btn');
        if (panicBtn) {
            panicBtn.addEventListener('click', () => {
                console.log('🚨 PANIC UNLOCK triggered');
                this.send('setUILock', { value: false });
                this.toggleDevPanel(); // Close dev panel afterwards
            });
        }
    }

    selectChannel(ch) {
        this.selectedChannel = (ch === 'master') ? 'master' : parseInt(ch);
        console.log(`🔵 [UI LOCAL] Selected: ${this.selectedChannel}`);

        this.send('setSelectChannel', { channel: ch });

        this.renderMixer();
        this.renderEQ();
        this.updateSelectionUI();
        this.syncEQToSelected();
    }

    updateSelectionUI() {
        document.querySelectorAll('.channel-strip').forEach(s => s.classList.remove('selected'));
        const active = document.getElementById(`strip-${this.selectedChannel}`);
        if (active) active.classList.add('selected');

        document.querySelectorAll('.sel-button').forEach(b => b.classList.remove('active'));
        const activeBtn = document.getElementById(`sel-${this.selectedChannel}`);
        if (activeBtn) activeBtn.classList.add('active');

        const label = document.getElementById('sel-ch-label');
        if (label) label.innerText = this.selectedChannel;
    }

    openPresetBrowser() {
        const overlay = document.getElementById('preset-browser-overlay');
        const list = document.getElementById('preset-list');
        const searchInput = document.getElementById('preset-search');
        const closeBtn = document.getElementById('close-preset-modal');
        const previewId = document.getElementById('preview-preset-id');
        const previewName = document.getElementById('preview-preset-name');
        const recallBtn = document.getElementById('btn-recall-selection');

        let selectedPresetId = null;
        const MAX_SLOTS = 128;

        if (closeBtn) closeBtn.onclick = () => overlay.classList.remove('active');

        const renderList = (filter = '') => {
            list.innerHTML = '';
            const query = filter.toLowerCase().trim();
            const presets = this.state.eqPresets || {};
            let matchCount = 0;

            for (let i = 1; i <= MAX_SLOTS; i++) {
                const name = presets[i] || '';
                const idStr = i.toString().padStart(3, '0');

                // Smart Filter
                if (query && !name.toLowerCase().includes(query) && !idStr.includes(query)) continue;

                matchCount++;

                const item = document.createElement('div');
                item.className = `preset-item ${name ? 'filled' : ''}`;
                item.style.position = 'relative';
                if (i === (this.currentPresetIdx + 1)) item.classList.add('current');

                item.innerHTML = `
                    <span class="id">${idStr}</span>
                    <span class="name">${name ? name.toUpperCase() : '-- EMPTY --'}</span>
                    ${i > 40 ? `
                        <button class="item-store-btn" data-id="${i}" style="margin-left: auto; background: #003300; border: 1px solid #005500; color: #8f8; font-size: 0.5rem; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-weight: bold;">STORE TO #${i}</button>
                    ` : '<span style="font-size:0.4rem; color:#666; margin-left:auto;">FACTORY</span>'}
                `;

                // Item Click = RECALL
                item.addEventListener('click', (e) => {
                    // Don't trigger recall if the store button was clicked
                    if (e.target.classList.contains('item-store-btn')) return;

                    this.currentPresetIdx = i - 1;
                    this.send('recallEQ', { channel: this.selectedChannel, preset: i });
                    this.updatePresetDisplay();
                    overlay.classList.remove('active');
                });

                // Button Click = STORE
                const storeBtn = item.querySelector('.item-store-btn');
                if (storeBtn) {
                    storeBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();

                        // Close browser first (as requested)
                        overlay.classList.remove('active');

                        const defaultName = name || `USER ${i}`;
                        const newName = await this.showPrompt(
                            `Preset ${i} speichern`,
                            'Preset-Name (max. 16 Zeichen):',
                            defaultName
                        );

                        if (newName !== null) {
                            const trimmedName = newName.substring(0, 16);
                            this.send('saveEQ', { channel: this.selectedChannel, preset: i, name: trimmedName });
                            this.showNotification(`Preset ${i} gespeichert: "${trimmedName}"`, 'success');
                        }
                    });
                }

                list.appendChild(item);
            }

            if (matchCount === 0) {
                list.innerHTML = `<div style="padding: 40px; text-align: center; color: #666; font-size: 0.8rem;">KEINE PRESETS GEFUNDEN ${query ? `FÜR "${query.toUpperCase()}"` : ''}</div>`;
            }
        };

        // Search Handler
        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = (e) => renderList(e.target.value);
        }


        renderList();
        overlay.classList.add('active');
        if (searchInput) setTimeout(() => searchInput.focus(), 100);
    }

    updateKnobAddresses() {
        const ch = this.selectedChannel;
        if (ch === 'master') return; // Master has no EQ

    }

    updateKnobUI(knobEl, midiVal) {
        if (!knobEl) return;

        let val = (midiVal === undefined || isNaN(midiVal)) ? 64 : midiVal;
        const hex = val.toString(16).toUpperCase().padStart(2, '0');
        const parts = knobEl.id.split('-');
        const isEQ = knobEl.id.startsWith('enc-');
        const band = isEQ ? parts[1] : null;
        const param = isEQ ? parts[2] : null;

        // --- FILTER OVERRIDE LOGIC (Optisch wie gewünscht) ---
        let visualVal = val;
        let forceOff = false;

        if (isEQ && param === 'gain') {
            const ch = this.selectedChannel;
            const chObj = (typeof ch === 'string' && ch === 'master') ? this.state.master : this.state.channels[parseInt(ch) - 1];
            if (chObj && chObj.eq[band]) {
                const qVal = chObj.eq[band].q;
                // --- HPF BINARY VISUAL SNAP ---
                if (band === 'low' && qVal === 0) {
                    forceOff = (val < 64);
                    visualVal = forceOff ? 0 : 127; // Snap to far left or far right
                }
            }
        }

        const deg = ((visualVal / 127) * 260) - 130;
        const indicator = knobEl.querySelector('.knob-indicator');
        if (indicator) indicator.setAttribute('transform', `rotate(${deg}, 30, 30)`);

        const ring = document.getElementById('ring-' + knobEl.id);
        if (ring) {
            const offset = 120 - ((visualVal / 127) * 120);
            ring.setAttribute('stroke-dashoffset', offset);
        }

        knobEl.dataset.midi = val;
        const valEl = document.getElementById('val-' + knobEl.id);
        if (valEl) {
            const hexLabel = this.debugUI ? ` [${hex}]` : '';
            if (knobEl.id.startsWith('pan-')) {
                const hexLabelPan = this.debugUI ? ` (${hex})` : '';
                if (val === 64) valEl.innerText = `CENTER${hexLabelPan}`;
                else if (val < 64) valEl.innerText = `L${64 - val}${hexLabelPan}`;
                else valEl.innerText = `R${val - 64}${hexLabelPan}`;
            } else if (knobEl.id === 'enc-att') {
                // ATTENUATION: -96 to +12
                const dB = ((val / 127) * 108 - 96).toFixed(1);
                valEl.innerText = (dB > 0 ? '+' : '') + dB + ' dB' + hexLabel;
            } else if (isEQ) {
                let display = hex;
                if (param === 'gain') {
                    if (band === 'low' && forceOff) display = 'OFF';
                    else if (band === 'low' && !forceOff && val === 127) display = 'ON'; // HPF 'ON'
                    else {
                        const dB = ((val / 127) * 36 - 18).toFixed(1);
                        display = (dB > 0 ? '+' : '') + dB + ' dB';
                    }
                } else if (param === 'freq') {
                    const freq = 21.2 * Math.pow(20000 / 21.2, val / 127);
                    display = freq >= 1000 ? (freq / 1000).toFixed(2) + ' kHz' : Math.round(freq) + ' Hz';
                } else if (param === 'q') {
                    if (band === 'low' && val === 0) display = 'HPF';
                    else if (band === 'low' && val === 127) display = 'L.SHLF';
                    else if (band === 'high' && val === 127) display = 'H.SHLF';
                    else if (band === 'high' && val === 0) display = 'LPF';
                    else {
                        // Q Mapping: val=1 -> 10.0, val=126 -> 0.10
                        const qValRaw = 10 - ((val - 1) / 125) * 9.9;
                        display = Math.max(0.1, Math.min(10, qValRaw)).toFixed(2);
                    }
                }
                valEl.innerText = display + hexLabel;
            } else {
                valEl.innerText = hex;
            }
        }
    }

    getKnobMIDI(knobEl) {
        const val = parseInt(knobEl.dataset.midi);
        return isNaN(val) ? 64 : val;
    }

    updatePanUI(id, value) {
        const knob = document.getElementById(`pan-${id}`);
        if (knob) this.updateKnobUI(knob, value);
    }

    updateFaderUI(id, value) {
        const thumb = document.getElementById(`thumb-${id}`);
        if (!thumb) return;
        const container = thumb.closest('.fader-area');
        const availableHeight = container.clientHeight - 64;
        thumb.style.top = `${Math.max(0, Math.min(availableHeight, (1 - (value / 1023)) * availableHeight))}px`;
        const valText = document.getElementById(`val-${id}`);
        if (valText) valText.innerText = value;
    }

    updateMuteUI(ch, isMuted) {
        const btn = document.getElementById(`btn-${ch}`);
        if (!btn) return;
        btn.classList.toggle('muted', isMuted);
        btn.classList.toggle('active', !isMuted);
        btn.innerText = isMuted ? 'MUTE' : 'ON';
    }

    // Centralized Logic Handler
    handleEQChange(knob, newVal, previousValContext) {
        // Apply Directional Toggle Logic for Low Band Gain HPF
        if (knob.dataset.param === 'gain') {
            const band = knob.dataset.band;
            const ch = this.selectedChannel;
            const chObj = (ch === 'master') ? this.state.master : this.state.channels[ch - 1];
            if (band === 'low' && chObj && chObj.eq.low.q === 0) {
                // Directional Toggle
                const delta = newVal - previousValContext;
                if (previousValContext < 64) newVal = (delta > 0) ? 127 : 0;
                else newVal = (delta < 0) ? 0 : 127;
            } else if (band === 'low' && chObj && (chObj.eq[band].q !== 0)) {
                // Continuous Save: If we are modifying Gain in a "Normal" (Non-HPF) mode,
                // update the storedGain immediately. This ensures we always have the latest value
                // ready if we suddenly switch Q to 0. (LOW BAND ONLY)
                this.storedGains[`${ch}-${band}`] = newVal;
            }
        }

        // Apply UI & Send
        this.updateKnobUI(knob, newVal);
        if (knob.id === 'enc-att') {
            this.send('setAtt', { channel: this.selectedChannel, value: newVal });
        } else {
            const band = knob.dataset.band;
            const param = knob.dataset.param;
            const ch = this.selectedChannel;
            const chObj = (ch === 'master') ? this.state.master : this.state.channels[ch - 1];

            // STATE-BASED TRANSITION LOGIC for SAVE/RESTORE (LOW BAND ONLY)
            if (band === 'low' && param === 'q' && chObj && chObj.eq[band]) {
                const prevQ = chObj.eq[band].q; // Read from STATE, not UI

                // RESTORE: Crossing from 0 to >0
                if (prevQ === 0 && newVal > 0) {
                    // Update state IMMEDIATELY/EARLY.
                    // We must let `updateKnobUI` know that Q is no longer 0, otherwise it will
                    // incorrectly apply the HPF Binary Snap logic (rendering 100% or 0%)
                    // to the gain value we are about to restore.
                    if (chObj.eq[band]) chObj.eq[band].q = newVal;

                    const key = `${this.selectedChannel}-${band}`;
                    // Default to 64 (0dB) if no stored value exists (e.g. fresh boot or never visited Shelf)
                    // This prevents STICKY MAX GAIN (127) when coming from HPF ON state.
                    const oldGain = (this.storedGains[key] !== undefined) ? this.storedGains[key] : 64;

                    const gainKnob = document.getElementById(`enc-${band}-gain`);
                    if (gainKnob) {
                        this.updateKnobUI(gainKnob, oldGain);
                        this.send('setEQ', { channel: this.selectedChannel, band: band, param: 'gain', value: oldGain });
                        // Update optimistic state for gain too
                        if (chObj.eq[band]) chObj.eq[band].gain = oldGain;
                    }
                }

                // SAVE & FORCE OFF: Crossing from >0 to 0
                if (prevQ > 0 && newVal === 0) {
                    // CRITICAL FIX: Optimistic State Update for Q here too!
                    // Ensure UI knows we are now in HPF mode so Gain 0 renders as "OFF" not "-18dB"
                    if (chObj.eq[band]) chObj.eq[band].q = newVal;

                    this.storedGains[`${ch}-${band}`] = chObj.eq[band].gain;

                    const gainKnob = document.getElementById(`enc-${band}-gain`);
                    if (gainKnob) {
                        this.updateKnobUI(gainKnob, 0);
                        this.send('setEQ', { channel: this.selectedChannel, band: band, param: 'gain', value: 0 });
                        // Update optimistic state for gain too
                        if (chObj.eq[band]) chObj.eq[band].gain = 0;
                    }
                }
            }

            this.send('setEQ', { channel: this.selectedChannel, band: band, param: param, value: newVal });

            // Optimistic State Update
            if (chObj && chObj.eq[band]) {
                chObj.eq[band][param] = newVal;
            }
        }
    }

    connect() {
        this.socket = new WebSocket(this.wsUrl);

        this.socket.onopen = () => {
            document.getElementById('status-dot').style.backgroundColor = '#00ff00';
            document.getElementById('status-dot').style.boxShadow = '0 0 10px #00ff00';
            this.send('get_state');
        };

        this.socket.onclose = () => {
            document.getElementById('status-dot').style.backgroundColor = '#ff0000';
            document.getElementById('status-dot').style.boxShadow = 'none';
            setTimeout(() => this.connect(), 2000); // Auto-reconnect
        };

        this.socket.onerror = (err) => {
            console.error('WS Error:', err);
            document.getElementById('status-dot').style.backgroundColor = '#ff0000';
        };
        this.socket.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'midiLog') {
                const isMeter = data.data[0] === 0xF0 && data.data[5] === 0x21;
                if (isMeter) return; // Hide meter spam in main UI log

                const hex = data.data.map(b => b.toString(16).padStart(2, '0')).join(' ');
                const isOut = data.isOutgoing;

                const logEl = document.getElementById('debug-log');
                if (logEl && logEl.style.display !== 'none') {
                    const entry = document.createElement('div');
                    entry.style.fontSize = '0.65rem';
                    entry.style.fontFamily = 'monospace';
                    entry.style.padding = '2px 0';
                    entry.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

                    const dir = isOut ?
                        '<span style="color:#aaa;">[OUT]</span>' :
                        '<span style="color:#34c759;">[IN]</span>';

                    entry.innerHTML = `${dir} ${hex}`;
                    logEl.appendChild(entry);

                    // Keep last 50 entries
                    while (logEl.children.length > 50) logEl.removeChild(logEl.firstChild);
                    logEl.scrollTop = logEl.scrollHeight;
                }
            } else if (data.type === 'state') {
                // Merge state selectively to preserve local fader values during drag
                const newState = data.data;

                // Sync UI Settings from Backend DB
                if (newState.settings) {
                    this.meterOffset = newState.settings.meterOffset;
                    this.autoCloseSafety = newState.settings.autoCloseSafety;
                    this.meterBankOnly = newState.settings.bankOnlyMetering;

                    // Update Sliders/Checkboxes if they exist
                    const offsetSlider = document.getElementById('meter-offset-slider');
                    if (offsetSlider) {
                        offsetSlider.value = this.meterOffset;
                        document.getElementById('meter-offset-val').innerText = this.meterOffset;
                    }

                    const rateSlider = document.getElementById('meter-rate-slider');
                    if (rateSlider) {
                        const seconds = newState.settings.meterInterval / 1000;
                        rateSlider.value = seconds;
                        document.getElementById('meter-rate-val').innerText = seconds + 's';
                    }

                    const broadcastSlider = document.getElementById('meter-broadcast-slider');
                    if (broadcastSlider && newState.settings.meterBroadcastRate) {
                        const ms = newState.settings.meterBroadcastRate;
                        broadcastSlider.value = ms;
                        document.getElementById('meter-broadcast-val').innerText = ms + 'ms';
                    }

                    const bankMetersChk = document.getElementById('dbg-bank-meters');
                    if (bankMetersChk) bankMetersChk.checked = this.meterBankOnly;

                    const autoCloseChk = document.getElementById('chk-auto-close-safety');
                    if (autoCloseChk) autoCloseChk.checked = this.autoCloseSafety;

                    // SYNC UI LOCK STATE (from State Broadcast)
                    const lockOverlay = document.getElementById('global-lock-overlay');
                    if (lockOverlay) {
                        const isLocked = !!newState.settings.uiLocked;
                        console.log('📡 Syncing UI Lock from State:', isLocked);
                        lockOverlay.classList.toggle('active', isLocked);
                        document.body.classList.toggle('mode-lock-active', isLocked);
                    }
                }

                // EQ PRESETS DEBUG & SYNC
                if (newState.eqPresets) {
                    console.log('📚 EQ Presets Received:', Object.keys(newState.eqPresets).length);
                    this.state.eqPresets = newState.eqPresets;
                    this.updatePresetDisplay();

                    const Overlay = document.getElementById('preset-browser-overlay');
                    if (Overlay?.classList.contains('active')) {
                        this.openPresetBrowser(); // Re-render list live
                    }
                }

                // Update channels, but preserve fader value if actively dragging
                for (let i = 0; i < 36; i++) {
                    if (!this.state.channels[i]) continue;
                    // Preserve fader and pan during drag
                    const preserveFader = this.activeFader === String(i + 1);
                    const preservePan = this.activeKnob === `pan-${i + 1}`;
                    this.state.channels[i] = {
                        ...newState.channels[i],
                        fader: preserveFader ? this.state.channels[i].fader : newState.channels[i].fader,
                        pan: preservePan ? this.state.channels[i].pan : newState.channels[i].pan
                    };
                }

                // Update master, preserve fader if dragging
                const preserveMasterFader = this.activeFader === 'master';
                this.state.master = {
                    ...newState.master,
                    fader: preserveMasterFader ? this.state.master.fader : newState.master.fader
                };

                // Sync UI Selection from hardware
                if (newState.selectedChannel !== undefined && this.selectedChannel !== newState.selectedChannel) {
                    this.selectedChannel = newState.selectedChannel;
                    this.renderMixer();
                    this.renderEQ();
                }

                this.syncFaders();
                // Duplicate sync removed as it is redundant
                this.syncEQToSelected();
                this.syncStoredGains(); // Ensure backup gains are populated from new state

            } else if (data.type === 'setUILock') {
                // Direct specific broadcast for speed
                const isLocked = !!data.value;
                console.log('📡 Syncing UI Lock from direct message:', isLocked);
                const lockOverlay = document.getElementById('global-lock-overlay');
                if (lockOverlay) {
                    lockOverlay.classList.toggle('active', isLocked);
                    document.body.classList.toggle('mode-lock-active', isLocked);
                }
            } else if (data.type === 'eq') {
                // Handle individual EQ parameter updates
                const d = data.data;
                const chIdx = parseInt(d.channel) - 1;
                if (this.state.channels[chIdx] && this.state.channels[chIdx].eq[d.band]) {
                    this.state.channels[chIdx].eq[d.band][d.param] = d.value;
                }

                // Update UI if this is the selected channel
                if (parseInt(d.channel) === this.selectedChannel) {
                    const knobId = `enc-${d.band}-${d.param}`;
                    const knob = document.getElementById(knobId);
                    if (knob) this.updateKnobUI(knob, d.value);
                }
            } else if (data.type === 'setFader') {
                const ch = data.channel;
                const val = data.value;
                if (ch === 'master') {
                    this.state.master.fader = val;
                } else {
                    const idx = parseInt(ch) - 1;
                    if (this.state.channels[idx]) this.state.channels[idx].fader = val;
                }
                this.updateFaderUI(ch, val);
            } else if (data.type === 'setMute') {
                const ch = data.channel;
                const val = data.value;
                if (ch === 'master') {
                    this.state.master.mute = val;
                } else {
                    const idx = parseInt(ch) - 1;
                    if (this.state.channels[idx]) this.state.channels[idx].mute = val;
                }
                this.updateMuteUI(ch, val);
            } else if (data.type === 'setPan') {
                const ch = parseInt(data.channel);
                const val = data.value;
                const idx = ch - 1;
                if (this.state.channels[idx]) {
                    this.state.channels[idx].pan = val;
                    this.updatePanUI(ch, val);
                }
            } else if (data.type === 'meters') {
                // Update only meters, don't touch faders
                for (let i = 0; i < 36; i++) {
                    if (this.state.channels[i]) {
                        this.state.channels[i].meter = data.data.channels[i] || 0;
                    }
                }
                this.state.master.meter = data.data.master || 0;
                // Update meter UI only
                this.updateMeterUIWithState();
            } else if (data.type === 'syncStatus') {
                const btn = document.getElementById('sync-btn');
                if (btn) {
                    if (data.status === 'start') {
                        btn.disabled = true;
                        btn.classList.add('syncing');
                        btn.innerText = 'SYNCING...';
                        btn.style.opacity = '0.5';
                        btn.style.cursor = 'wait';
                        btn.style.background = '#444';
                    } else if (data.status === 'end') {
                        btn.disabled = false;
                        btn.classList.remove('syncing');
                        btn.innerText = 'SYNC';
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                        btn.style.background = '';
                    } else if (data.status === 'start-eq') {
                        const presetLabel = document.getElementById('val-eq-preset');
                        if (presetLabel) {
                            presetLabel.style.background = '#331100';
                            presetLabel.innerHTML = '<span style="color:#ff8800; font-size:0.6rem; letter-spacing:2px; animation: pulse 1s infinite;">LOADING...</span>';
                        }
                    } else if (data.status === 'end-eq') {
                        const presetLabel = document.getElementById('val-eq-preset');
                        if (presetLabel) {
                            presetLabel.style.background = '#000';
                            this.updatePresetDisplay();
                        }
                    }
                }
            } else if (data.type === 'changelog') {
                const body = document.getElementById('changelog-body');
                if (body) body.innerHTML = data.data;
            }
        };
    }

    logMidi(bytes) {
        const logEl = document.getElementById('debug-log');
        if (!logEl || logEl.style.display === 'none') return;

        const hex = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        const entry = document.createElement('div');
        entry.style.borderBottom = '1px solid #111';
        entry.style.padding = '2px 0';
        entry.innerText = `> ${hex}`;

        logEl.appendChild(entry);
        if (logEl.childNodes.length > 100) logEl.removeChild(logEl.childNodes[1]);
        logEl.scrollTop = logEl.scrollHeight;
    }

    updateMeterUIWithState() {
        // Update meters for visible bank
        const end = Math.min(36, this.currentBankStart + 7);
        for (let i = this.currentBankStart; i <= end; i++) {
            if (this.state.channels[i - 1]) {
                this.updateMeterUI(i, this.state.channels[i - 1].meter);
            }
        }
        // Master Meter
        this.updateMeterUIWithVal('master', this.state.master.meter);
    }

    // Helper to update meter by channel ID
    updateMeterUI(i, val) {
        this.updateMeterUIWithVal(i, val);
    }

    updateMeterUIWithVal(id, val) {
        // Apply noise gate / offset
        if (val < this.meterOffset) val = 0;

        const el = document.getElementById(`meter-${id}`);
        if (el) {
            const pct = Math.min(100, (val / 32) * 100); // 32 is roughly max meter value in standard mode? Or 0-255?
            // Meter values from Yamaha are usually 0x00-0x20 (32) or potentially higher depending on metering point.
            // Assuming 0-32 based on previous mapping, or let's double check. 
            // Standard meters 01V96: 32 segments. So val is 0..32.

            el.style.height = `${pct}%`;

            // Color
            if (pct > 90) el.style.background = '#ff3b30'; // Clip
            else if (pct > 70) el.style.background = '#ffcc00'; // Warning
            else el.style.background = '#34c759'; // Normal
        }
    }

    syncFaders() {
        const end = Math.min(36, this.currentBankStart + 7);
        for (let i = this.currentBankStart; i <= end; i++) {
            const ch = this.state.channels[i - 1];
            if (!ch) continue;
            // Don't update fader if user is actively moving it
            if (this.activeFader !== String(i)) {
                this.updateFaderUI(i, ch.fader);
            }
            if (!this.activeKnob || this.activeKnob !== `pan-${i}`) {
                this.updatePanUI(i, ch.pan || 64);
            }
            this.updateMuteUI(i, ch.mute);
            this.updateMeterUI(i, ch.meter);
            this.updateNameUI(i, ch.name);

            // Update EQ button state
            const eqBtn = document.getElementById(`eq-btn-${i}`);
            if (eqBtn) {
                console.log(`[EQ-BTN] Ch${i} eqOn=${ch.eqOn}`);
                eqBtn.classList.toggle('active', ch.eqOn);
            }
        }
        if (this.activeFader !== 'master') {
            this.updateFaderUI('master', this.state.master.fader);
        }
        this.updateMuteUI('master', this.state.master.mute);
    }

    updateNameUI(ch, name) {
        const el = document.getElementById(`name-box-${ch}`);
        if (el && name) el.innerText = name;
    }

    updateMeterUI(ch, val) {
        // val comes as 7-bit (0-127)
        // APPLY OFFSET (Noise Gate/Floor)
        // meterOffset is 0-100. We map it to 0-127 range.
        const gateThreshold = Math.round((this.meterOffset / 100) * 80);
        const displayVal = val < gateThreshold ? 0 : val;

        const el = document.getElementById(`meter-${ch}`);
        if (el) {
            // Scaling: 01V meters often peak early in MIDI. Let's use 60 as full scale.
            const pct = Math.min(100, (displayVal / 60) * 100);
            el.style.height = `${pct}%`;

            // Color grading (based on percentage)
            if (pct > 90) el.style.background = '#ff3b30'; // Clip
            else if (pct > 70) el.style.background = '#ffcc00'; // Warning
            else el.style.background = '#34c759'; // Normal
        }
    }

    syncStoredGains() {
        // Populates storedGains from current state (Bulk/Init)
        // If a band is NOT in HPF/LPF mode (Q>0), we assume the current gain is a valid "Continuous" value
        // and store it. This fixes the issue where restoring gain after a boot+HPF toggle sequence
        // would fallback to 0 or Max because nothing was stored.
        this.state.channels.forEach((ch, idx) => {
            if (!ch) return;
            // RESTRICTED TO LOW BAND ONLY
            ['low'].forEach(band => {
                if (ch.eq && ch.eq[band]) {
                    // Start simple: If Q > 0, this gain is a valid 'normal' gain. Backup it.
                    if (ch.eq[band].q > 0) {
                        this.storedGains[`${idx + 1}-${band}`] = ch.eq[band].gain;
                    }
                }
            });
        });

        // Also Master if applicable (Master has no EQ in this map usually, but good practice)
        // Note: Master in 01V96 usually has EQ too, but state structure might differ. 
        // Our state.master only lists fader/mute/fxOn.
    }

    syncEQToSelected() {
        const ch = this.selectedChannel;
        const chObj = (ch === 'master') ? this.state.master : this.state.channels[ch - 1];
        if (!chObj || !chObj.eq) return;

        ['low', 'lmid', 'hmid', 'high'].forEach(band => {
            ['q', 'freq', 'gain'].forEach(param => {
                const knobId = `enc-${band}-${param}`;
                if (this.activeKnob !== knobId) {
                    const knob = document.getElementById(knobId);
                    this.updateKnobUI(knob, chObj.eq[band][param]);
                }
            });
        });

        // ATT
        const attKnob = document.getElementById('enc-att');
        if (attKnob && this.activeKnob !== 'enc-att') {
            this.updateKnobUI(attKnob, chObj.att || 0);
        }

        // EQ TYPE
        document.querySelectorAll('.eq-type-btn').forEach(btn => {
            const isSelected = parseInt(btn.dataset.type) === (chObj.eqType || 0);
            if (isSelected) {
                btn.style.background = '#ffcc00'; // Yamaha Orange active
                btn.style.color = '#000';
                btn.style.fontWeight = 'bold';
            } else {
                btn.style.background = '#222';
                btn.style.color = '#666';
                btn.style.fontWeight = 'normal';
            }
        });
    }

    triggerMeterSync() {
        const start = this.meterBankOnly ? (this.currentBankStart - 1) : 0;
        const count = this.meterBankOnly ? 8 : 32;
        console.log(`📡 Meter Range Update: ${start} - ${start + count}`);
        this.send('setMeterInterval', { range: { start, count } });
    }

    send(type, payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type, ...payload }));
    }
}
window.addEventListener('load', () => new YamahaTouchRemote());
