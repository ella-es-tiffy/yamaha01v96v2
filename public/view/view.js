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

    renderMeterBridge() {
        const container = document.getElementById('view-meter');
        if (!container) return;

        container.innerHTML = `<div class="meter-bridge-container" id="bridge-container"></div>`;
        const bridge = document.getElementById('bridge-container');

        for (let i = 1; i <= 32; i++) {
            const strip = document.createElement('div');
            strip.className = 'bridge-strip';
            strip.innerHTML = `
                <div class="meter-track">
                    <div class="meter-fill" id="meter-${i}"></div>
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
                // Map 0-32 (meter value) to 0-100% (CSS height)
                // Linear mapping for now, matching the clean bar style
                const pct = Math.min(100, (val / 32) * 100);
                el.style.height = `${pct}%`;
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

window.addEventListener('load', () => {
    // Slight delay to ensure layout is stable on some legacy browsers
    setTimeout(() => new ProView(), 50);
});
