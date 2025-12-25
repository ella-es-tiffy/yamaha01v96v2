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
        this.connect();
        this.setupEncoder();
        this.setupToggle();
        this.startRaf();
    }

    getEventCoords(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    connect() {
        console.log('[VIEW] Connecting to:', this.wsUrl);
        this.socket = new WebSocket(this.wsUrl);

        this.socket.onopen = () => {
            document.getElementById('status').innerText = 'CONNECTED';
            document.getElementById('status').style.color = '#34c759';
        };

        this.socket.onclose = () => {
            document.getElementById('status').innerText = 'DISCONNECTED';
            document.getElementById('status').style.color = '#ff3b30';
            setTimeout(() => this.connect(), 5000);
        };

        this.socket.onmessage = (msg) => {
            const data = JSON.parse(msg.data);

            // Handle Legacy Dialect from Server
            const t = data.t || data.type;
            const c = data.c || data.channel;
            const v = (data.v !== undefined) ? data.v : data.value;

            if (t === 'me' || t === 'meters') {
                const meterData = data.d || data.data;
                this.updateMeters(meterData.channels || meterData);
            } else if (t === 'state') {
                // Sync Settings (Meter Offset etc)
                if (data.s) {
                    this.settings = { ...this.settings, ...data.s };
                    console.log('[VIEW] Settings synced:', this.settings);
                }

                // Handle Compact State for CH2 Test
                if (data.m && data.m[1] !== undefined) {
                    this.isMuted = !!data.m[1];
                    const btn = document.getElementById('test-toggle');
                    if (btn) {
                        btn.classList.toggle('active', !this.isMuted);
                        btn.classList.toggle('muted', this.isMuted);
                        btn.innerText = this.isMuted ? 'MUTED' : 'ON (CH2)';
                    }
                }
                // Later we can loop data.n for Names etc.
            } else if (t === 'r' || t === 'reload') {
                console.log('[VIEW] Auto-reloading due to file change...');
                location.reload();
            } else if (t === 'f') { // setFader
                console.log('[VIEW] Sync Fader:', c, v);
            } else if (t === 'm') { // setMute
                if (parseInt(c) === 2) {
                    this.isMuted = v;
                    const btn = document.getElementById('test-toggle');
                    if (btn) {
                        btn.classList.toggle('active', !this.isMuted);
                        btn.classList.toggle('muted', this.isMuted);
                        btn.innerText = this.isMuted ? 'MUTED' : 'ON (CH2)';
                    }
                }
            } else if (t === 'p') { // setPan
                if (parseInt(c) === 1) {
                    this.currentMidi = v;
                    this.updateQueue.add('test-knob');
                }
            } else if (t === 'setUIOption') {
                if (data.k === 'meterOffset') this.settings.meterOffset = data.v;
            }
        };
    }

    updateMeters(channels) {
        const offset = this.settings.meterOffset || 0;

        // Update 16 meters
        for (let i = 1; i <= 16; i++) {
            let val = channels[i - 1] || 0;

            // Apply noise gate (mapping 0-100 offset to 0-32 meter range)
            const gateThreshold = (offset / 100) * 32;
            if (val < gateThreshold) val = 0;

            const elId = `meter-${i}`;
            if (!this.elCache[elId]) this.elCache[elId] = document.getElementById(elId);
            const el = this.elCache[elId];
            if (el) {
                const scale = val / 32;
                el.style.webkitTransform = `scaleY(${scale})`;
                el.style.transform = `scaleY(${scale})`;
            }
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

window.addEventListener('load', () => new ProView());
