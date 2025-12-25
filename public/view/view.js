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

        this.init();
    }

    init() {
        this.renderMeterBridge();
        this.connect();
        this.setupNavigation();
        this.setupEncoder();
        this.setupToggle();
        this.startRaf();
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
            document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
            const activeView = document.getElementById(`view-${viewId}`);
            if (activeView) activeView.classList.add('active');
        });
    }

    getEventCoords(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    renderMeterBridge() {
        const container = document.getElementById('view-meter');
        if (!container) return;

        container.innerHTML = `<div class="meter-bridge-container" id="bridge-container"></div>`;
        const bridge = document.getElementById('bridge-container');

        // Left Scale Strip
        const scaleStrip = document.createElement('div');
        scaleStrip.className = 'meter-scale-strip';
        scaleStrip.innerHTML = `
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
        `;
        bridge.appendChild(scaleStrip);

        for (let i = 1; i <= 32; i++) {
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
                    </div>
                </div>
                <div class="strip-label" id="label-${i}">${i}</div>
            `;
            bridge.appendChild(strip);
        }
    }

    updateMeters(channels) {
        const offset = this.settings.meterOffset || 0;

        // Update 32 meters
        for (let i = 1; i <= 32; i++) {
            let val = channels[i - 1] || 0;

            // Apply noise gate
            const gateThreshold = (offset / 100) * 32;
            if (val < gateThreshold) val = 0;

            const elId = `meter-${i}`;
            if (!this.elCache[elId]) this.elCache[elId] = document.getElementById(elId);
            const el = this.elCache[elId];

            if (el) {
                const pct = Math.min(100, (val / 32) * 100);
                el.style.height = `${pct}%`;

                // Show dB value
                if (val > 4) {
                    const dbStr = this.valToDB(val);
                    if (el.dataset.lastDb !== dbStr && pct > 20) {
                        el.innerText = dbStr;
                        el.style.color = '#fff';
                        el.style.fontSize = '0.55rem';
                        el.style.fontWeight = '700';
                        el.style.display = 'flex';
                        el.style.justifyContent = 'center';
                        el.style.alignItems = 'flex-start';
                        el.style.paddingTop = '2px';
                        el.style.textShadow = '0 1px 2px #000';
                        el.dataset.lastDb = dbStr;
                    } else if (pct <= 20) {
                        el.innerText = '';
                        el.dataset.lastDb = '';
                    }
                } else {
                    if (el.dataset.lastDb) {
                        el.innerText = '';
                        el.dataset.lastDb = '';
                    }
                }
            }
        }
    }

    valToDB(val) {
        if (val >= 32) return 'CLIP';
        return Math.round((val - 32) * 1.8);
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
            const data = JSON.parse(msg.data);
            const t = data.t || data.type;
            const c = data.c || data.channel;
            const v = (data.v !== undefined) ? data.v : data.value;

            if (t === 'me' || t === 'meters') {
                const meterData = data.d || data.data;
                this.updateMeters(meterData.channels || meterData);
            } else if (t === 'state') {
                if (data.s) this.settings = { ...this.settings, ...data.s };
            } else if (t === 'r' || t === 'reload') {
                location.reload();
            } else if (t === 'setUIOption') {
                if (data.k === 'meterOffset') this.settings.meterOffset = data.v;
            }
        };
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
        const loop = () => {
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
