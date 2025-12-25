/**
 * MODULE: Pro View (Legacy Monitor)
 * VERSION: v0.1.1-mon
 * NOTICE: This script is fully decoupled from app.js.
 * Built for high-performance monitoring on legacy devices (iOS 12).
 */
class ProView {
    constructor() {
        this.wsUrl = `ws://${window.location.hostname}:3007?client=view`;
        this.socket = null;
        this.elCache = {};
        this.updateQueue = new Set();

        this.currentMidi = 64;
        this.activeKnob = false;
        this.isMuted = false;
        this.settings = { meterOffset: 0 };
        this.meterCount = 16; // Default to 16 channels
        this.peakHoldEnabled = false; // Peak Hold feature
        this.peakValues = new Array(33).fill(0); // Peak per channel (1-32)
        this.peakTimers = new Array(33).fill(null); // Timeout handles
        this.peakRenderCache = new Array(33).fill(null); // Last rendered peak

        // Performance tracking
        this.meterUpdateCount = 0;
        this.wsMessageCount = 0;
        this.lastStatsUpdate = performance.now();

        this.iosVersion = this.getIOSVersion();
        this.isLegacy = this.iosVersion > 0 && this.iosVersion < 17;
        if (this.isLegacy) document.body.classList.add('is-legacy');

        this.init();
    }

    getIOSVersion() {
        if (/iP(hone|od|ad)/.test(navigator.platform)) {
            const v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
            if (v) return parseInt(v[1], 10);
        }
        return 0;
    }

    sendLock(locked) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        // Broadcast lock/unlock to all clients
        this.socket.send(JSON.stringify({
            t: 'l',
            v: locked
        }));
    }


    init() {
        this.renderMeterBridge();
        this.setupNavigation();
        this.setupPeakHoldBtn(); // Peak Hold toggle
        this.setupSettingsBtn(); // Channel count toggle
        this.connect();
        this.setupEncoder();
        this.setupToggle();
        this.setupLockUI();
        this.startRaf();
    }

    setupLockUI() {
        const lockOverlay = document.getElementById('global-lock-overlay');
        if (lockOverlay) {
            const handleUnlock = () => {
                console.log('🔓 Unlocking UI (PV Local)...');
                lockOverlay.classList.remove('active');
                document.body.classList.remove('mode-lock-active');
                this.sendLock(false);
            };

            lockOverlay.addEventListener('click', handleUnlock);
            lockOverlay.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleUnlock();
            }, { passive: false });
        }
    }

    setupNavigation() {
        const navContainer = document.getElementById('main-nav');
        if (!navContainer) return;

        navContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.nav-btn');
            if (!btn) return;

            // UI Update
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // View Switch
            const viewId = btn.dataset.view;
            this.switchView(viewId);
        });
    }

    switchView(viewId) {
        document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
        const activeView = document.getElementById(`view-${viewId}`);
        if (activeView) activeView.classList.add('active');

        // Dynamic Rendering based on View
        if (viewId === 'aux') {
            this.renderAuxView(this.currentAux || 0);
        }
    }

    renderAuxView(auxIndex) {
        this.currentAux = auxIndex;
        const container = document.getElementById('view-aux');

        let subNavHTML = '';
        for (let i = 1; i <= 8; i++) {
            const isActive = (i - 1 === auxIndex) ? 'active' : '';
            subNavHTML += `<button class="aux-btn ${isActive}" data-aux="${i - 1}">AUX ${i}</button>`;
        }

        container.innerHTML = `
            <div class="module-frame no-pad">
                <div class="aux-subnav">${subNavHTML}</div>
                <div class="aux-stage" id="aux-stage">
                    <!-- Faders go here -->
                </div>
            </div>
        `;

        // Attach Events
        container.querySelectorAll('.aux-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.renderAuxView(parseInt(btn.dataset.aux));
                // TODO: Request Data
            });
        });

        this.renderAuxFaders();
    }

    renderAuxFaders() {
        // ... Placeholder
        const stage = document.getElementById('aux-stage');
        stage.innerHTML = '<div style="color:#666; padding:20px;">Faders for Aux ' + (this.currentAux + 1) + ' coming soon...</div>';
    }

    setupSettingsBtn() {
        const header = document.querySelector('.view-header');
        if (!header) return;

        // Remove existing if any (for HMR)
        const old = document.getElementById('meter-toggle');
        if (old) old.remove();

        const btn = document.createElement('button');
        btn.id = 'meter-toggle';
        btn.className = 'settings-btn';
        btn.innerText = this.meterCount + ' CH';
        btn.addEventListener('touchstart', (e) => { // iOS
            this.toggleMeterCount();
        }, { passive: true });
        btn.addEventListener('click', (e) => { // Desktop
            this.toggleMeterCount();
        });

        header.appendChild(btn);
    }

    toggleMeterCount() {
        this.meterCount = (this.meterCount === 16) ? 32 : 16;
        document.getElementById('meter-toggle').innerText = this.meterCount + ' CH';
        this.renderMeterBridge();
        // Save to server settings?
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'setUIOption', key: 'meterCount', value: this.meterCount }));
        }
    }

    setupPeakHoldBtn() {
        const container = document.getElementById('bridge-container');
        if (!container) return;

        const old = document.getElementById('peak-hold-toggle');
        if (old) old.remove();

        const btn = document.createElement('button');
        btn.id = 'peak-hold-toggle';
        btn.className = 'peak-btn-vertical';
        btn.innerText = 'PK'; // Simple text instead of vertical
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.togglePeakHold();
        }, { passive: false });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePeakHold();
        });

        // Insert at the beginning (will be positioned via CSS)
        container.insertBefore(btn, container.firstChild);
    }

    togglePeakHold() {
        this.peakHoldEnabled = !this.peakHoldEnabled;
        const btn = document.getElementById('peak-hold-toggle');
        if (btn) {
            if (this.peakHoldEnabled) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
                // Clear all peaks
                this.peakValues.fill(0);
                this.peakTimers.forEach(t => t && clearTimeout(t));
                this.peakTimers.fill(null);
                this.peakRenderCache.fill(null);
            }
        }
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'setUIOption', key: 'peakHold', value: this.peakHoldEnabled }));
        }
    }

    getEventCoords(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    renderMeterBridge() {
        const container = document.getElementById('view-meter');
        if (!container) return;

        // Wrap in Module Frame
        container.innerHTML = `
            <div class="module-frame short">
                <div class="meter-bridge-container" id="bridge-container"></div>
            </div>
        `;
        const bridge = document.getElementById('bridge-container');

        // Left Scale Strip
        const scaleStrip = document.createElement('div');
        scaleStrip.className = 'meter-scale-strip';
        scaleStrip.innerHTML = `
            <div class="meter-wrapper" style="position:relative; border:none; background:transparent; padding:0;">
                <div class="scale-val" style="top: 0%">10</div>
                <div class="scale-val" style="top: 15%">5</div>
                <div class="scale-val" style="top: 25%">0</div>
                <div class="scale-val" style="top: 35%">5</div>
                <div class="scale-val" style="top: 45%">10</div>
                <div class="scale-val" style="top: 55%">15</div>
                <div class="scale-val" style="top: 65%">20</div>
                <div class="scale-val" style="top: 80%">30</div>
                <div class="scale-val" style="top: 90%">40</div>
                <div class="scale-val" style="top: 96%">50</div>
            </div>
            <div class="db-val-box" style="visibility:hidden">.</div>
            <div class="status-stack" style="visibility:hidden; background:transparent">
                 <div class="st-ind" style="opacity:0"></div><div class="st-ind" style="opacity:0"></div>
                 <div class="st-ind" style="opacity:0"></div><div class="st-ind" style="opacity:0"></div>
                 <div class="st-ind" style="opacity:0"></div>
            </div>
            <div class="strip-label" style="visibility:hidden">.</div>
        `;
        bridge.appendChild(scaleStrip);

        for (let i = 1; i <= this.meterCount; i++) {
            const strip = document.createElement('div');
            strip.className = 'bridge-strip';
            strip.innerHTML = `
                <div class="meter-wrapper">
                    <div class="meter-tick-marks">
                        <div class="tick" style="top:0%"></div>
                        <div class="tick" style="top:15%"></div>
                        <div class="tick long" style="top:25%"></div> <!-- 0dB -->
                        <div class="tick" style="top:35%"></div>
                        <div class="tick" style="top:45%"></div>
                        <div class="tick" style="top:55%"></div>
                        <div class="tick" style="top:65%"></div>
                        <div class="tick" style="top:80%"></div>
                        <div class="tick" style="top:90%"></div>
                        <div class="tick" style="top:96%"></div>
                    </div>
                    <div class="meter-track">
                        <div class="meter-fill" id="meter-${i}"></div>
                        <div class="peak-hold-dot" id="peak-${i}"></div>
                    </div>
                </div>
                <div class="db-val-box" id="db-${i}"></div>
                <div class="status-stack" id="st-${i}">
                    <div class="st-ind eq" id="s-e-${i}"></div>
                    <div class="st-ind gate" id="s-g-${i}"></div>
                    <div class="st-ind comp" id="s-c-${i}"></div>
                    <div class="st-ind fx" id="s-f-${i}"></div>
                    <div class="st-ind mute" id="s-m-${i}"></div>
                </div>
                <div class="strip-label" id="label-${i}">${i}</div>
            `;
            bridge.appendChild(strip);
        }

        // Clear Cache to force re-fetch
        this.elCache = {};
    }

    updateMeters(channels) {
        const now = Date.now();
        if (this.lastRender && (now - this.lastRender < 30)) return;
        this.lastRender = now;

        this.meterUpdateCount++; // Track updates

        const offset = this.settings.meterOffset || 0;

        // Initialize cache if needed
        if (!this.dbValueCache) this.dbValueCache = new Array(this.meterCount + 1).fill(null);

        for (let i = 1; i <= this.meterCount; i++) {
            let val = channels[i - 1] || 0;
            const gateThreshold = (offset / 100) * 32;
            if (val < gateThreshold) val = 0;

            const elId = `meter-${i}`;
            const dbId = `db-${i}`;

            if (!this.elCache[elId]) this.elCache[elId] = document.getElementById(elId);
            if (!this.elCache[dbId]) this.elCache[dbId] = document.getElementById(dbId);

            const el = this.elCache[elId];
            const dbEl = this.elCache[dbId];

            if (el) {
                const pct = this.getMeterPct(val);
                // Inverted: curtain height = 100% - signal level
                el.style.height = `${100 - pct}%`;

                // Peak Hold Logic
                if (this.peakHoldEnabled) {
                    const peakId = `peak-${i}`;
                    if (!this.elCache[peakId]) this.elCache[peakId] = document.getElementById(peakId);
                    const peakEl = this.elCache[peakId];

                    if (val > this.peakValues[i]) {
                        this.peakValues[i] = val;

                        // Clear existing timer
                        if (this.peakTimers[i]) {
                            clearTimeout(this.peakTimers[i]);
                        }

                        // Set new timer (3 second hold)
                        this.peakTimers[i] = setTimeout(() => {
                            this.peakValues[i] = 0;
                            this.peakRenderCache[i] = null;
                            if (peakEl) peakEl.style.display = 'none';
                        }, 3000);
                    }

                    // Render peak dot - ONLY if value changed
                    if (peakEl && this.peakValues[i] > 0) {
                        const peakVal = this.peakValues[i];

                        // Only update DOM if peak changed
                        if (this.peakRenderCache[i] !== peakVal) {
                            const peakPct = this.getMeterPct(peakVal);
                            peakEl.style.bottom = `${peakPct}%`;
                            peakEl.style.display = 'block';

                            // Color based on peak level
                            let peakColor;
                            if (peakVal >= 32) {
                                peakColor = '#ff3b30'; // Red (>= +6dB)
                            } else if (peakVal >= 31) {
                                peakColor = '#ffcc00'; // Orange (+3dB to +6dB)
                            } else {
                                peakColor = '#34c759'; // Green (< +3dB)
                            }
                            peakEl.style.background = peakColor;

                            this.peakRenderCache[i] = peakVal;
                        }
                    }
                }

                // Update dB Box - OPTIMIZED to avoid DOM Reads
                if (dbEl) {
                    const dbStr = this.valToDB(val);
                    // Check against JS cache, NOT DOM
                    if (this.dbValueCache[i] !== dbStr) {
                        dbEl.innerText = dbStr;
                        const newColor = (dbStr === 'CLIP') ? '#ff3b30' : '#888';
                        dbEl.style.color = newColor;

                        this.dbValueCache[i] = dbStr;
                    }
                }

                // Clear old innerText
                el.innerText = '';
            }
        }
    }

    getMeterPct(val) {
        if (val <= 0) return 0;
        if (val >= 32) return 100;

        // Ultra-Steep Mapping v2 (Preserved & Refined)
        if (val >= 29) {
            // -5dB to Clip (Linear top range)
            return (val - 29) * 11.66 + 65;
        }
        // -60dB to -5dB (Exponential lower range)
        // Tuned to align -30dB marking precisely
        return Math.pow(val / 29, 1.75) * 65;

        // Old linear was: return val * 2.24;
    }

    valToDB(val) {
        if (val <= 0) return '-INF';
        if (val >= 31) return 'CLIP';
        if (val >= 29) return Math.round((val - 29) * 5 - 5);
        // Low range interpolation (1 -> -60dB, 29 -> -5dB)
        return Math.round(-60 + (val - 1) * 2);
    }

    updateStatusIndicators(data) {
        if (!data) return;
        const process = (key, type) => {
            const arr = data[key];
            if (arr && arr.length) {
                for (let i = 1; i <= this.meterCount; i++) {
                    const state = arr[i - 1];
                    const elId = `s-${type}-${i}`;
                    if (!this.elCache[elId]) this.elCache[elId] = document.getElementById(elId);
                    const el = this.elCache[elId];
                    if (el) {
                        if (state) el.classList.add('on');
                        else el.classList.remove('on');
                    }
                }
            }
        };

        process('m', 'm');    // Mute
        process('e', 'e');    // EQ
        process('g', 'g');    // Gate
        process('co', 'c');   // Comp
    }

    connect() {
        console.log('[VIEW] Connecting to:', this.wsUrl);
        this.socket = new WebSocket(this.wsUrl);

        this.socket.onopen = () => {
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.innerText = 'CONNECTED';
                statusEl.style.color = '#34c759';
            }
        };

        this.socket.onclose = () => {
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.innerText = 'DISCONNECTED';
                statusEl.style.color = '#ff3b30';
            }
            setTimeout(() => this.connect(), 5000);
        };

        this.socket.onmessage = (msg) => {
            this.wsMessageCount++; // Track WS traffic

            const data = JSON.parse(msg.data);
            const t = data.t || data.type;
            const c = data.c || data.channel;
            const v = (data.v !== undefined) ? data.v : data.value;

            if (t === 'me' || t === 'meters') {
                const meterData = data.d || data.data;
                this.updateMeters(meterData.channels || meterData);
            } else if (t === 'state') {
                if (data.s) {
                    this.settings = { ...this.settings, ...data.s };
                    this.syncLockState();
                }
                this.updateStatusIndicators(data);
            } else if (t === 'r' || t === 'reload') {
                location.reload();
            } else if (t === 'setUIOption' || t === 'l') {
                if (data.k === 'meterOffset') this.settings.meterOffset = data.v;
                if (data.k === 'uiLocked' || t === 'l') {
                    this.settings.uiLocked = (data.v !== undefined) ? data.v : data.value;
                    this.syncLockState();
                }
            }
        };
    }

    syncLockState() {
        const isLocked = !!this.settings.uiLocked;
        const lockOverlay = document.getElementById('global-lock-overlay');
        if (lockOverlay) {
            lockOverlay.classList.toggle('active', isLocked);
            document.body.classList.toggle('mode-lock-active', isLocked);
        }
    }

    setupEncoder() {
        const knob = document.getElementById('test-knob');
        if (!knob) return;

        const startEvents = ['pointerdown', 'mousedown', 'touchstart'];
        const moveEvents = ['pointermove', 'mousemove', 'touchmove'];
        const upEvents = ['pointerup', 'mouseup', 'touchend', 'touchcancel'];

        const handler = (e) => {
            if (e.type === 'touchstart') e.preventDefault();
            e.stopPropagation();

            this.activeKnob = true;
            const coords = this.getEventCoords(e);
            let startY = coords.y;
            let startVal = this.currentMidi;

            const onMove = (me) => {
                if (!this.activeKnob) return;
                const mCoords = this.getEventCoords(me);
                const delta = (startY - mCoords.y) * 0.6;
                let val = Math.max(0, Math.min(127, Math.round(startVal + delta)));

                if (val !== this.currentMidi) {
                    this.currentMidi = val;
                    this.updateQueue.add('test-knob');
                    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                        // Send in Legacy Dialect
                        this.socket.send(JSON.stringify({
                            t: 'p',
                            c: 1,
                            v: val
                        }));
                    }
                }
            };

            const onUp = () => {
                this.activeKnob = false;
                moveEvents.forEach(m => window.removeEventListener(m, onMove));
                upEvents.forEach(u => window.removeEventListener(u, onUp));
            };

            moveEvents.forEach(m => window.addEventListener(m, onMove, { passive: false }));
            upEvents.forEach(u => window.addEventListener(u, onUp, { once: true }));
        };

        startEvents.forEach(evt => knob.addEventListener(evt, handler, { passive: false }));
    }

    setupToggle() {
        const btn = document.getElementById('test-toggle');
        if (!btn) return;

        const onToggle = (e) => {
            if (e.type === 'touchstart') e.preventDefault();
            this.isMuted = !this.isMuted;

            // Send in Legacy Dialect
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    t: 'm',
                    c: 2,
                    v: this.isMuted
                }));
            }

            // Optimistic UI update
            btn.classList.toggle('active', !this.isMuted);
            btn.classList.toggle('muted', this.isMuted);
            btn.innerText = this.isMuted ? 'MUTED' : 'ON (CH2)';
        };

        btn.addEventListener('touchstart', onToggle, { passive: false });
        btn.addEventListener('mousedown', onToggle);
    }

    startRaf() {
        const statsEl = document.getElementById('perf-stats');

        const loop = () => {
            // Update stats every second
            const now = performance.now();
            const elapsed = now - this.lastStatsUpdate;

            if (elapsed >= 1000 && statsEl) {
                const seconds = elapsed / 1000;
                const wsPerSec = Math.round(this.wsMessageCount / seconds);
                const updatesPerSec = Math.round(this.meterUpdateCount / seconds);
                const activePeaks = this.peakValues.filter(v => v > 0).length;

                statsEl.innerText = `WS: ${wsPerSec}/s\nMTR: ${updatesPerSec}/s\nPK: ${activePeaks}`;

                // Reset counters
                this.wsMessageCount = 0;
                this.meterUpdateCount = 0;
                this.lastStatsUpdate = now;
            }

            if (this.updateQueue.has('test-knob')) {
                this.renderKnob('test-knob', this.currentMidi);
                this.updateQueue.delete('test-knob');
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    renderKnob(id, val) {
        if (!this.elCache[`ring-${id}`]) this.elCache[`ring-${id}`] = document.getElementById(`ring-${id}`);
        if (!this.elCache[`ind-${id}`]) this.elCache[`ind-${id}`] = document.getElementById(`ind-${id}`);
        if (!this.elCache[`val-${id}`]) this.elCache[`val-${id}`] = document.getElementById(`val-${id}`);

        const angle = (val / 127) * 270 - 135;
        const ring = this.elCache[`ring-${id}`];
        if (ring) {
            const offset = 150.8 - (val / 127) * 150.8;
            ring.style.strokeDashoffset = offset;
        }

        const ind = this.elCache[`ind-${id}`];
        if (ind) {
            ind.style.webkitTransform = `rotate(${angle}deg)`;
            ind.style.transform = `rotate(${angle}deg)`;
            ind.style.webkitTransformOrigin = '30px 30px';
            ind.style.transformOrigin = '30px 30px';
        }

        const valEl = this.elCache[`val-${id}`];
        if (valEl) valEl.innerText = val;
    }
}

window.addEventListener('load', () => {
    // Slight delay to ensure layout is stable on some legacy browsers
    setTimeout(() => new ProView(), 50);
});
