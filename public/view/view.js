/**
 * Yamaha 01V96 PRO VIEW - STANDALONE ENGINE
 * NOTICE: This script is fully decoupled from app.js.
 * Built for high-performance monitoring on legacy devices (iOS 12).
 * ARCHITECTURAL RULE: The WebSocket/Server MUST NOT be explicitly adapted for this View.
 * This View must consume generic data streams and handle filtering/rendering locally.
 */
class ProView {
    constructor() {
        this.wsUrl = `ws://${window.location.hostname}:3007`;
        this.socket = null;
        this.elCache = {};
        this.updateQueue = new Set();

        this.currentMidi = 64;
        this.activeKnob = false;
        this.toggleState = false;

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
            if (data.type === 'meters') {
                this.updateMeters(data.data.channels);
            } else if (data.type === 'state') {
                // Sync Ch 2 Mute State back to Toggle
                const ch2 = data.data.channels[1]; // Ch 2 is index 1
                if (ch2 && ch2.mute !== undefined) {
                    this.toggleState = ch2.mute;
                    const btn = document.getElementById('test-toggle');
                    if (btn) {
                        btn.classList.toggle('active', this.toggleState);
                        btn.innerText = this.toggleState ? 'MUTED' : 'ON (CH2)';
                    }
                }
            } else if (data.type === 'reload') {
                console.log('[VIEW] Auto-reloading due to file change...');
                location.reload();
            } else if (data.type === 'setFader') {
                // Future: Update specific fader UI
                console.log('[VIEW] Lightweight Fader Sync:', data.channel, data.value);
            } else if (data.type === 'setMute') {
                if (parseInt(data.channel) === 2) {
                    this.toggleState = data.value;
                    const btn = document.getElementById('test-toggle');
                    if (btn) {
                        btn.classList.toggle('active', this.toggleState);
                        btn.innerText = this.toggleState ? 'MUTED' : 'ON (CH2)';
                    }
                }
            } else if (data.type === 'setPan') {
                if (parseInt(data.channel) === 1) {
                    this.currentMidi = data.value;
                    this.updateQueue.add('test-knob');
                }
            }
        };
    }

    updateMeters(channels) {
        // Update 16 meters
        for (let i = 1; i <= 16; i++) {
            const val = channels[i - 1] || 0;
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
                        this.socket.send(JSON.stringify({
                            type: 'setPan',
                            channel: 1,
                            value: val
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
            this.toggleState = !this.toggleState;

            // Send to Server: Toggle Mute for Channel 2
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'setMute',
                    channel: 2,
                    value: this.toggleState
                }));
            }

            // Optimistic UI update
            btn.classList.toggle('active', this.toggleState);
            btn.innerText = this.toggleState ? 'MUTED' : 'ON (CH2)';
            console.log('[TOGGLE] CH2 Mute set to:', this.toggleState);
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
