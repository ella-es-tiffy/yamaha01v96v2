
/**
 * Yamaha 01V96 Pro Touch Remote - iPad Engine (v10 - Yamaha Classic Aesthetic & Hex Debug)
 */

class YamahaTouchRemote {
    constructor() {
        this.socket = null;
        this.wsUrl = `ws://${window.location.hostname}:3007`;
        this.selectedChannel = 1;
        this.currentBankStart = 1;
        this.activeKnob = null;

        this.state = {
            channels: Array(32).fill(null).map((_, i) => ({
                fader: 0, mute: false, eq: {
                    low: { q: 64, freq: 64, gain: 64 },
                    lmid: { q: 64, freq: 64, gain: 64 },
                    hmid: { q: 64, freq: 64, gain: 64 },
                    high: { q: 64, freq: 64, gain: 64 }
                }
            })),
            master: { fader: 0, mute: false }
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

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1 && e.target.closest('.mixer-viewport')) e.preventDefault();
        }, { passive: false });
        document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
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
        const end = Math.min(32, this.currentBankStart + 7);
        for (let i = this.currentBankStart; i <= end; i++) {
            const strip = document.createElement('div');
            strip.className = 'channel-strip';
            strip.id = `strip-${i}`;
            const chIdx = i - 1;
            const chState = this.state.channels[chIdx];

            strip.innerHTML = `
                <div class="ch-num">${i}</div>
                <div class="on-button ${chState?.mute ? 'muted' : 'active'}" id="btn-${i}" data-ch="${i}">${chState?.mute ? 'MUTE' : 'ON'}</div>
                <div class="eq-button" id="eq-btn-${i}" data-ch="${i}">EQ</div>
                <button class="sel-button ${this.selectedChannel === i ? 'active' : ''}" id="sel-${i}" data-ch="${i}">SEL</button>
                <div class="fader-area" id="slot-${i}" data-ch="${i}">
                    <div class="fader-track"><div class="fader-thumb" id="thumb-${i}"></div></div>
                    <div class="meter-bar"><div class="meter-fill" id="meter-${i}"></div></div>
                </div>
                <div class="db-val" id="val-${i}">${chState?.fader || 0}</div>
            `;
            mixer.appendChild(strip);
            this.updateFaderUI(i, chState?.fader || 0);
            this.updateMeterUI(i, chState?.meter || 0);
        }
        this.updateSelectionUI();
    }

    renderEQ() {
        const eqArea = document.getElementById('eq-area');
        if (!eqArea) return;

        eqArea.innerHTML = `
            <div style="font-weight: bold; padding: 8px 12px; color: #aaa; font-size: 0.75rem; text-align: left; background: rgba(255,255,255,0.05); margin-bottom: 20px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="opacity: 0.6; font-size: 0.6rem; letter-spacing: 1px;">CHANNEL SELECT:</span>
                    <span id="sel-ch-label" style="color: var(--accent); font-weight: 800; font-size: 1.1rem; text-shadow: 0 0 10px rgba(0,210,255,0.3);">1</span>
                </div>
                <span style="color: #666; font-size: 0.6rem; letter-spacing: 1px; font-weight: 900;">4-BAND PARAMETRIC EQ</span>
            </div>
            <div class="eq-header">
                <div></div> <!-- Spacer for Label Col -->
                <div class="eq-column-header">LOW</div>
                <div class="eq-column-header">L-MID</div>
                <div class="eq-column-header">H-MID</div>
                <div class="eq-column-header">HIGH</div>
            </div>
            <div class="eq-grid" id="eq-grid"></div>
        `;

        const grid = document.getElementById('eq-grid');
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
                    <div class="knob-addr" id="addr-${id}">-- --</div>
                    <svg class="knob-svg" id="${id}" viewBox="0 0 60 60" data-band="${band}" data-param="${row.id}">
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
            this.send('setFader', { channel: chId, value });
        };

        // Bank Buttons
        document.querySelectorAll('.bank-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.bank-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentBankStart = parseInt(btn.dataset.start);
                this.renderMixer();
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
                thumb.setPointerCapture(e.pointerId);
                thumb.classList.add('dragging');
                handlePointer(e, area, chId);
                const onMove = (me) => { if (thumb.hasPointerCapture(me.pointerId)) handlePointer(me, area, chId); };
                const onUp = () => { thumb.releasePointerCapture(e.pointerId); thumb.classList.remove('dragging'); thumb.removeEventListener('pointermove', onMove); };
                thumb.addEventListener('pointermove', onMove);
                thumb.addEventListener('pointerup', onUp, { once: true });
            } else if (onBtn) {
                const ch = onBtn.dataset.ch;
                const isMuted = onBtn.classList.contains('muted');
                this.updateMuteUI(ch, !isMuted);
                this.send('setMute', { channel: ch, value: !isMuted });
            } else if (e.target.closest('.eq-button')) {
                const btn = e.target.closest('.eq-button');
                const ch = btn.dataset.ch;
                const isActive = btn.classList.contains('active');
                btn.classList.toggle('active', !isActive);
                this.send('setEQOn', { channel: ch, value: !isActive });
            } else if (selBtn) {
                this.selectChannel(selBtn.dataset.ch);
            }
        });

        document.getElementById('sync-btn').addEventListener('click', (e) => {
            const btn = e.target;
            if (btn.classList.contains('cooldown')) return;

            this.send('requestSync', {});

            // Start Cooldown
            btn.classList.add('cooldown');
            const originalText = btn.innerText;
            let seconds = 10;

            const timer = setInterval(() => {
                seconds--;
                if (seconds <= 0) {
                    clearInterval(timer);
                    btn.classList.remove('cooldown');
                    btn.innerText = originalText;
                } else {
                    btn.innerText = `SYNC (${seconds}s)`;
                }
            }, 1000);

            btn.innerText = `SYNC (10s)`;
        });
        document.getElementById('debug-btn').addEventListener('click', () => {
            const l = document.getElementById('debug-log');
            l.style.display = l.style.display === 'none' ? 'block' : 'none';
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
                        this.updateKnobUI(knob, val);
                        this.send('setEQ', { channel: this.selectedChannel, band: knob.dataset.band, param: knob.dataset.param, value: val });
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
                const step = e.deltaY < 0 ? 3 : -3;
                const newVal = Math.max(0, Math.min(127, currentVal + step));
                if (newVal !== currentVal) {
                    this.updateKnobUI(knob, newVal);
                    this.send('setEQ', { channel: this.selectedChannel, band: knob.dataset.band, param: knob.dataset.param, value: newVal });
                }
            }
        }, { passive: false });
    }

    selectChannel(ch) {
        this.selectedChannel = parseInt(ch);
        this.updateSelectionUI();
        this.updateKnobAddresses();
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

    updateKnobAddresses() {
        const ch = this.selectedChannel;
        const isUpper = ch > 24;
        const statusMap = { low: 0xB2, lmid: 0xB4, hmid: 0xB6, high: 0xB8 };
        const baseCCMap = { gain: 0x21, freq: 0x40, q: 0x59 };
        ['low', 'lmid', 'hmid', 'high'].forEach(band => {
            ['q', 'freq', 'gain'].forEach(param => {
                const id = `enc-${band}-${param}`;
                const addrEl = document.getElementById(`addr-${id}`);
                if (addrEl) {
                    const status = (statusMap[band] + (isUpper ? 1 : 0)).toString(16).toUpperCase();
                    const cc = (baseCCMap[param] + ((ch - 1) % 24)).toString(16).toUpperCase().padStart(2, '0');
                    if (param === 'gain') {
                        const extraCC = (((ch - 1) % 24) + 1).toString(16).toUpperCase().padStart(2, '0');
                        addrEl.innerHTML = `<span style="opacity:0.4;">${status} ${extraCC}</span><br>${status} ${cc}`;
                    } else {
                        addrEl.innerText = `${status} ${cc}`;
                    }
                }
            });
        });
    }

    updateKnobUI(knobEl, midiVal) {
        if (!knobEl) return;
        const deg = ((midiVal / 127) * 260) - 130;
        const indicator = knobEl.querySelector('.knob-indicator');
        if (indicator) {
            indicator.setAttribute('transform', `rotate(${deg}, 30, 30)`);
        }
        const ring = document.getElementById('ring-' + knobEl.id);
        if (ring) {
            const offset = 120 - ((midiVal / 127) * 120);
            ring.setAttribute('stroke-dashoffset', offset);
        }
        knobEl.dataset.midi = midiVal;
        const valEl = document.getElementById('val-' + knobEl.id);
        if (valEl) {
            // FORMAT AS HEX
            valEl.innerText = midiVal.toString(16).toUpperCase().padStart(2, '0') + 'h';
        }
    }

    getKnobMIDI(knobEl) { return parseInt(knobEl.dataset.midi) || 64; }

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

    connect() {
        this.socket = new WebSocket(this.wsUrl);
        this.socket.onopen = () => {
            document.getElementById('status').innerText = 'Verbunden';
            document.getElementById('status').style.color = '#34c759';
        };
        this.socket.onclose = () => {
            document.getElementById('status').innerText = 'Verbindung unterbrochen';
            document.getElementById('status').style.color = '#ff3b30';
            setTimeout(() => this.connect(), 5000); // Auto-reconnect
        };
        this.socket.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.type === 'state') {
                this.state = data.data;
                this.syncFaders();
                this.syncEQToSelected();
            } else if (data.type === 'midiLog') {
                this.logMidi(data.data);
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

    syncFaders() {
        const end = Math.min(32, this.currentBankStart + 7);
        for (let i = this.currentBankStart; i <= end; i++) {
            const ch = this.state.channels[i - 1];
            this.updateFaderUI(i, ch.fader);
            this.updateMuteUI(i, ch.mute);
            this.updateMeterUI(i, ch.meter);
        }
        this.updateFaderUI('master', this.state.master.fader);
        this.updateMuteUI('master', this.state.master.mute);
    }

    updateMeterUI(ch, val) {
        const el = document.getElementById(`meter-${ch}`);
        if (!el) return;
        // 0-127 approx range
        const pct = Math.min(100, (val / 60) * 100); // 01V meters are weird, peak is around 0x20-0x40? Let's guess scaling.
        // Actually, typical MIDI VL is 0-127. 69 (0x45) is loud? 
        el.style.height = `${pct}%`;
        if (pct > 90) el.style.background = '#f00';
        else if (pct > 70) el.style.background = '#ff0';
        else el.style.background = '#0f0';
    }

    syncEQToSelected() {
        const ch = this.selectedChannel;
        const chObj = this.state.channels[ch - 1];
        if (!chObj) return;
        const eqState = chObj.eq;
        ['low', 'lmid', 'hmid', 'high'].forEach(band => {
            ['q', 'freq', 'gain'].forEach(param => {
                const knobId = `enc-${band}-${param}`;
                if (this.activeKnob !== knobId) {
                    const knob = document.getElementById(knobId);
                    this.updateKnobUI(knob, eqState[band][param]);
                }
            });
        });
    }

    send(type, payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type, ...payload }));
    }
}
window.addEventListener('load', () => new YamahaTouchRemote());
