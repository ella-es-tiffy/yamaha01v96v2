/**
 * MODULE: Pro View (Legacy Monitor)
 * VERSION: v0.2.37-stable-ios12 (ES5 + Polling)
 * NOTICE: These are the stable settings for iOS 12 iPad 2/3/4.
 * Features: ES5 Transpilation, HTTP Polling Lock, No CSS Rotation.
 */
var ProView = function () {
    this.wsUrl = 'ws://' + window.location.hostname + ':3007?client=view';
    this.socket = null;
    this.elCache = {};
    // Use an object instead of Set for better compatibility, or polyfill it. 
    // Since we only use it for 'test-knob', a simple object key-check is fine.
    this.updateQueue = {};

    this.currentMidi = 64;
    this.activeKnob = false;
    this.isMuted = false;
    this.settings = { meterOffset: 0 };
    this.meterCount = 16;
    this.peakHoldEnabled = false;

    // Legacy Array fill
    this.peakValues = [];
    this.peakTimers = [];
    this.peakRenderCache = [];
    for (var i = 0; i < 33; i++) {
        this.peakValues.push(0);
        this.peakTimers.push(null);
        this.peakRenderCache.push(null);
    }

    this.meterUpdateCount = 0;
    this.wsMessageCount = 0;
    this.lastStatsUpdate = Date.now(); // performance.now() might need prefix or fallback, Date.now() is safer

    this.iosVersion = this.getIOSVersion();
    this.isLegacy = this.iosVersion > 0 && this.iosVersion < 17;
    if (this.isLegacy) document.body.classList.add('is-legacy');

    this.init();
};

ProView.prototype.getIOSVersion = function () {
    if (/iP(hone|od|ad)/.test(navigator.platform)) {
        var v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
        if (v) return parseInt(v[1], 10);
    }
    return 0;
};

ProView.prototype.sendLock = function (locked) {
    // Legacy: Use HTTP POST instead of WS to avoid lag/drops
    // Fallback to fetch (available in iOS 12)
    try {
        fetch('/api/lock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locked: locked })
        }).catch(function (e) { console.error('Lock Post Error:', e); });
    } catch (e) { console.error('Fetch Error:', e); }
};

ProView.prototype.init = function () {
    this.renderMeterBridge();
    this.setupNavigation();
    this.setupPeakHoldBtn();
    this.setupSettingsBtn();
    this.connect();
    this.setupEncoder();
    this.setupToggle();
    this.setupLockUI();
    this.startRaf();
    this.startLockPolling();
};

ProView.prototype.startLockPolling = function () {
    var self = this;
    // Ultra Lightweight Polling (1x/sec) as requested
    setInterval(function () {
        fetch('/api/lock')
            .then(function (res) { return res.json(); })
            .then(function (data) {
                // Only update if changed to avoid thrashing
                if (data.locked !== self.settings.uiLocked) {
                    console.log('[Poll] Lock State Changed:', data.locked);
                    self.settings.uiLocked = data.locked;
                    self.syncLockState();
                }
            })
            .catch(function (e) { /* ignore poll errors */ });
    }, 1000);
};

ProView.prototype.setupLockUI = function () {
    var self = this;
    var lockOverlay = document.getElementById('global-lock-overlay');
    if (lockOverlay) {
        var handleUnlock = function (e) {
            if (e && e.preventDefault) e.preventDefault();
            console.log('🔓 Unlocking UI (PV Local)...');

            // Optimistic Update
            self.settings.uiLocked = false;
            self.syncLockState();

            self.sendLock(false);
        };

        lockOverlay.addEventListener('click', handleUnlock);
        lockOverlay.addEventListener('touchstart', handleUnlock);
    }

    var lockBtn = document.getElementById('lock-ui-btn');
    if (lockBtn) {
        var handleLock = function (e) {
            if (e && e.preventDefault) e.preventDefault();
            console.log('🔒 Locking UI (PV Local)...');

            // Optimistic Update
            self.settings.uiLocked = true;
            self.syncLockState();

            self.sendLock(true);
        };
        lockBtn.addEventListener('click', handleLock);
        lockBtn.addEventListener('touchstart', handleLock);
    }
};

ProView.prototype.setupNavigation = function () {
    var self = this;
    var navContainer = document.getElementById('main-nav');
    if (!navContainer) return;

    navContainer.addEventListener('click', function (e) {
        var btn = e.target;
        // manually traverse up
        while (btn && !btn.classList.contains('nav-btn')) {
            btn = btn.parentElement;
        }
        if (!btn) return;

        // Fix: Do not treat LOCK button as a nav tab
        if (btn.id === 'lock-ui-btn') return;

        // UI Update
        var allBtns = document.querySelectorAll('.nav-btn');
        for (var i = 0; i < allBtns.length; i++) {
            allBtns[i].classList.remove('active');
        }
        btn.classList.add('active');

        // View Switch
        var viewId = btn.getAttribute('data-view');
        self.switchView(viewId);
    });
};

ProView.prototype.switchView = function (viewId) {
    var views = document.querySelectorAll('.view-content');
    for (var i = 0; i < views.length; i++) {
        views[i].classList.remove('active');
    }
    var activeView = document.getElementById('view-' + viewId);
    if (activeView) activeView.classList.add('active');

    if (viewId === 'aux') {
        this.renderAuxView(this.currentAux || 0);
    }
};

ProView.prototype.renderAuxView = function (auxIndex) {
    var self = this;
    this.currentAux = auxIndex;
    var container = document.getElementById('view-aux');

    var subNavHTML = '';
    for (var i = 1; i <= 8; i++) {
        var isActive = (i - 1 === auxIndex) ? 'active' : '';
        subNavHTML += '<button class="aux-btn ' + isActive + '" data-aux="' + (i - 1) + '">AUX ' + i + '</button>';
    }

    container.innerHTML =
        '<div class="module-frame no-pad">' +
        '<div class="aux-subnav">' + subNavHTML + '</div>' +
        '<div class="aux-stage" id="aux-stage">' +
        '</div>' +
        '</div>';

    var btns = container.querySelectorAll('.aux-btn');
    for (var j = 0; j < btns.length; j++) {
        btns[j].addEventListener('click', function () {
            var idx = parseInt(this.getAttribute('data-aux'));
            self.renderAuxView(idx);
        });
    }

    this.renderAuxFaders();
};

ProView.prototype.renderAuxFaders = function () {
    var stage = document.getElementById('aux-stage');
    stage.innerHTML = '<div style="color:#666; padding:20px;">Faders for Aux ' + (this.currentAux + 1) + ' coming soon...</div>';
};

ProView.prototype.setupSettingsBtn = function () {
    var self = this;
    var header = document.querySelector('.view-header');
    if (!header) return;

    var old = document.getElementById('meter-toggle');
    if (old) old.parentNode.removeChild(old);

    var btn = document.createElement('button');
    btn.id = 'meter-toggle';
    btn.className = 'settings-btn';
    btn.innerText = this.meterCount + ' CH';

    var toggle = function (e) { self.toggleMeterCount(); };
    btn.addEventListener('touchstart', toggle);
    btn.addEventListener('click', toggle);

    header.appendChild(btn);
};

ProView.prototype.toggleMeterCount = function () {
    this.meterCount = (this.meterCount === 16) ? 32 : 16;
    document.getElementById('meter-toggle').innerText = this.meterCount + ' CH';
    this.renderMeterBridge();

    if (this.socket && this.socket.readyState === 1) {
        this.socket.send(JSON.stringify({ type: 'setUIOption', key: 'meterCount', value: this.meterCount }));
    }
};

ProView.prototype.setupPeakHoldBtn = function () {
    var self = this;
    var container = document.getElementById('bridge-container');
    if (!container) return;

    var old = document.getElementById('peak-hold-toggle');
    if (old) old.parentNode.removeChild(old);

    var btn = document.createElement('button');
    btn.id = 'peak-hold-toggle';
    btn.className = 'peak-btn-vertical';
    btn.innerText = 'PK';

    var toggle = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        self.togglePeakHold();
    };

    btn.addEventListener('touchstart', toggle);
    btn.addEventListener('click', toggle);

    container.insertBefore(btn, container.firstChild);
};

ProView.prototype.togglePeakHold = function () {
    this.peakHoldEnabled = !this.peakHoldEnabled;
    var btn = document.getElementById('peak-hold-toggle');
    if (btn) {
        if (this.peakHoldEnabled) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
            // Clear all peaks
            for (var i = 0; i < this.peakValues.length; i++) this.peakValues[i] = 0;
            for (var j = 0; j < this.peakTimers.length; j++) {
                if (this.peakTimers[j]) clearTimeout(this.peakTimers[j]);
                this.peakTimers[j] = null;
            }
            for (var k = 0; k < this.peakRenderCache.length; k++) this.peakRenderCache[k] = null;
        }
    }
    if (this.socket && this.socket.readyState === 1) {
        this.socket.send(JSON.stringify({ type: 'setUIOption', key: 'peakHold', value: this.peakHoldEnabled }));
    }
};

ProView.prototype.getEventCoords = function (e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
};

ProView.prototype.renderMeterBridge = function () {
    var container = document.getElementById('view-meter');
    if (!container) return;

    container.innerHTML =
        '<div class="module-frame short">' +
        '<div class="meter-bridge-container" id="bridge-container"></div>' +
        '</div>';
    var bridge = document.getElementById('bridge-container');

    var scaleStrip = document.createElement('div');
    scaleStrip.className = 'meter-scale-strip';
    scaleStrip.innerHTML =
        '<div class="meter-wrapper" style="position:relative; border:none; background:transparent; padding:0;">' +
        '<div class="scale-val" style="top: 0%">10</div>' +
        '<div class="scale-val" style="top: 15%">5</div>' +
        '<div class="scale-val" style="top: 25%">0</div>' +
        '<div class="scale-val" style="top: 35%">5</div>' +
        '<div class="scale-val" style="top: 45%">10</div>' +
        '<div class="scale-val" style="top: 55%">15</div>' +
        '<div class="scale-val" style="top: 65%">20</div>' +
        '<div class="scale-val" style="top: 80%">30</div>' +
        '<div class="scale-val" style="top: 90%">40</div>' +
        '<div class="scale-val" style="top: 96%">50</div>' +
        '</div>' +
        '<div class="db-val-box" style="visibility:hidden">.</div>' +
        '<div class="status-stack" style="visibility:hidden; background:transparent">' +
        '<div class="st-ind" style="opacity:0"></div><div class="st-ind" style="opacity:0"></div>' +
        '<div class="st-ind" style="opacity:0"></div><div class="st-ind" style="opacity:0"></div>' +
        '<div class="st-ind" style="opacity:0"></div>' +
        '</div>' +
        '<div class="strip-label" style="visibility:hidden">.</div>';
    bridge.appendChild(scaleStrip);

    for (var i = 1; i <= this.meterCount; i++) {
        var strip = document.createElement('div');
        strip.className = 'bridge-strip';
        strip.innerHTML =
            '<div class="meter-wrapper">' +
            '<div class="meter-tick-marks">' +
            '<div class="tick" style="top:0%"></div>' +
            '<div class="tick" style="top:15%"></div>' +
            '<div class="tick long" style="top:25%"></div>' + // 0dB
            '<div class="tick" style="top:35%"></div>' +
            '<div class="tick" style="top:45%"></div>' +
            '<div class="tick" style="top:55%"></div>' +
            '<div class="tick" style="top:65%"></div>' +
            '<div class="tick" style="top:80%"></div>' +
            '<div class="tick" style="top:90%"></div>' +
            '<div class="tick" style="top:96%"></div>' +
            '</div>' +
            '<div class="meter-track">' +
            '<div class="meter-fill" id="meter-' + i + '"></div>' +
            '<div class="peak-hold-dot" id="peak-' + i + '"></div>' +
            '</div>' +
            '</div>' +
            '<div class="db-val-box" id="db-' + i + '"></div>' +
            '<div class="status-stack" id="st-' + i + '">' +
            '<div class="st-ind eq" id="s-e-' + i + '"></div>' +
            '<div class="st-ind gate" id="s-g-' + i + '"></div>' +
            '<div class="st-ind comp" id="s-c-' + i + '"></div>' +
            '<div class="st-ind fx" id="s-f-' + i + '"></div>' +
            '<div class="st-ind mute" id="s-m-' + i + '"></div>' +
            '</div>' +
            '<div class="strip-label" id="label-' + i + '">' + i + '</div>';
        bridge.appendChild(strip);
    }
    this.elCache = {};
};

ProView.prototype.updateMeters = function (channels) {
    var now = Date.now();
    if (this.lastRender && (now - this.lastRender < 30)) return;
    this.lastRender = now;
    this.meterUpdateCount++;

    var offset = this.settings.meterOffset || 0;
    if (!this.dbValueCache) {
        this.dbValueCache = [];
        for (var k = 0; k <= this.meterCount; k++) this.dbValueCache.push(null);
    }

    for (var i = 1; i <= this.meterCount; i++) {
        var val = channels[i - 1] || 0;
        var gateThreshold = (offset / 100) * 32;
        if (val < gateThreshold) val = 0;

        var elId = 'meter-' + i;
        var dbId = 'db-' + i;

        if (!this.elCache[elId]) this.elCache[elId] = document.getElementById(elId);
        if (!this.elCache[dbId]) this.elCache[dbId] = document.getElementById(dbId);

        var el = this.elCache[elId];
        var dbEl = this.elCache[dbId];

        if (el) {
            var pct = this.getMeterPct(val);
            el.style.height = (100 - pct) + '%';

            // Peak Hold
            if (this.peakHoldEnabled) {
                var peakId = 'peak-' + i;
                if (!this.elCache[peakId]) this.elCache[peakId] = document.getElementById(peakId);
                var peakEl = this.elCache[peakId];

                if (val > this.peakValues[i]) {
                    this.peakValues[i] = val;
                    if (this.peakTimers[i]) clearTimeout(this.peakTimers[i]);

                    var self = this;
                    // Closure to capture i
                    (function (idx, pElement) {
                        self.peakTimers[idx] = setTimeout(function () {
                            self.peakValues[idx] = 0;
                            self.peakRenderCache[idx] = null;
                            if (pElement) pElement.style.display = 'none';
                        }, 3000);
                    })(i, peakEl);
                }

                if (peakEl && this.peakValues[i] > 0) {
                    var peakVal = this.peakValues[i];
                    if (this.peakRenderCache[i] !== peakVal) {
                        var peakPct = this.getMeterPct(peakVal);
                        peakEl.style.bottom = peakPct + '%';
                        peakEl.style.display = 'block';

                        var peakColor;
                        if (peakVal >= 32) peakColor = '#ff3b30';
                        else if (peakVal >= 31) peakColor = '#ffcc00';
                        else peakColor = '#34c759';

                        peakEl.style.background = peakColor;
                        this.peakRenderCache[i] = peakVal;
                    }
                }
            }

            if (dbEl) {
                var dbStr = this.valToDB(val);
                if (this.dbValueCache[i] !== dbStr) {
                    dbEl.innerText = dbStr;
                    dbEl.style.color = (dbStr === 'CLIP') ? '#ff3b30' : '#888';
                    this.dbValueCache[i] = dbStr;
                }
            }
            el.innerText = '';
        }
    }
};

ProView.prototype.getMeterPct = function (val) {
    if (val <= 0) return 0;
    if (val >= 32) return 100;
    if (val >= 29) return (val - 29) * 11.66 + 65;
    return Math.pow(val / 29, 1.75) * 65;
};

ProView.prototype.valToDB = function (val) {
    if (val <= 0) return '-INF';
    if (val >= 31) return 'CLIP';
    if (val >= 29) return Math.round((val - 29) * 5 - 5);
    return Math.round(-60 + (val - 1) * 2);
};

ProView.prototype.updateStatusIndicators = function (data) {
    if (!data) return;
    var self = this;
    var process = function (key, type) {
        var arr = data[key];
        if (arr && arr.length) {
            for (var i = 1; i <= self.meterCount; i++) {
                var state = arr[i - 1];
                var elId = 's-' + type + '-' + i;
                if (!self.elCache[elId]) self.elCache[elId] = document.getElementById(elId);
                var el = self.elCache[elId];
                if (el) {
                    if (state) el.classList.add('on');
                    else el.classList.remove('on');
                }
            }
        }
    };
    process('m', 'm'); process('e', 'e'); process('g', 'g'); process('co', 'c');
};

ProView.prototype.connect = function () {
    var self = this;
    console.log('[VIEW] Connecting to:', this.wsUrl);
    this.socket = new WebSocket(this.wsUrl);

    this.socket.onopen = function () {
        var statusEl = document.getElementById('status-dot');
        if (statusEl) {
            statusEl.style.backgroundColor = '#00ff00';
            statusEl.style.boxShadow = '0 0 10px #00ff00';
        }
    };

    this.socket.onclose = function () {
        var statusEl = document.getElementById('status-dot');
        if (statusEl) {
            statusEl.style.backgroundColor = '#ff0000';
            statusEl.style.boxShadow = 'none';
        }
        setTimeout(function () { self.connect(); }, 5000);
    };

    this.socket.onmessage = function (msg) {
        self.wsMessageCount++;
        var data = JSON.parse(msg.data);
        var t = data.t || data.type;
        var v = (data.v !== undefined) ? data.v : data.value;

        if (t === 'me' || t === 'meters') {
            var meterData = data.d || data.data;
            self.updateMeters(meterData.channels || meterData);
        } else if (t === 'state') {
            if (data.s) {
                // merge settings
                for (var key in data.s) self.settings[key] = data.s[key];
                self.syncLockState();
            }
            self.updateStatusIndicators(data);
        } else if (t === 'r' || t === 'reload') {
            location.reload();
        } else if (t === 'setUIOption' || t === 'l') {
            if (data.k === 'meterOffset') self.settings.meterOffset = data.v;
            if (data.k === 'uiLocked' || t === 'l') {
                self.settings.uiLocked = (data.v !== undefined) ? data.v : data.value;
                self.syncLockState();
            }
        }
    };
};

ProView.prototype.syncLockState = function () {
    var isLocked = !!this.settings.uiLocked;
    this.toggleLockUI(isLocked);
};

ProView.prototype.setupEncoder = function () {
    var self = this;
    var knob = document.getElementById('test-knob');
    if (!knob) return;

    var startEvents = ['pointerdown', 'mousedown', 'touchstart'];
    var moveEvents = ['pointermove', 'mousemove', 'touchmove'];
    var upEvents = ['pointerup', 'mouseup', 'touchend', 'touchcancel'];

    var handler = function (e) {
        if (e.type === 'touchstart') e.preventDefault();
        e.stopPropagation();

        self.activeKnob = true;
        var coords = self.getEventCoords(e);
        var startY = coords.y;
        var startVal = self.currentMidi;

        var onMove = function (me) {
            if (!self.activeKnob) return;
            var mCoords = self.getEventCoords(me);
            var delta = (startY - mCoords.y) * 0.6;
            var val = Math.max(0, Math.min(127, Math.round(startVal + delta)));

            if (val !== self.currentMidi) {
                self.currentMidi = val;
                self.updateQueue['test-knob'] = true;
                if (self.socket && self.socket.readyState === 1) {
                    self.socket.send(JSON.stringify({
                        t: 'p',
                        c: 1,
                        v: val
                    }));
                }
            }
        };

        var onUp = function () {
            self.activeKnob = false;
            moveEvents.forEach(function (m) { window.removeEventListener(m, onMove); });
            upEvents.forEach(function (u) { window.removeEventListener(u, onUp); });
        };

        moveEvents.forEach(function (m) { window.addEventListener(m, onMove, { passive: false }); });
        upEvents.forEach(function (u) { window.addEventListener(u, onUp, { once: true }); });
    };

    startEvents.forEach(function (evt) { knob.addEventListener(evt, handler, { passive: false }); });
};

ProView.prototype.setupToggle = function () {
    var self = this;
    var btn = document.getElementById('test-toggle');
    if (!btn) return;

    var onToggle = function (e) {
        if (e.type === 'touchstart') e.preventDefault();
        self.isMuted = !self.isMuted;

        if (self.socket && self.socket.readyState === 1) {
            self.socket.send(JSON.stringify({
                t: 'm',
                c: 2,
                v: self.isMuted
            }));
        }

        if (self.isMuted) {
            btn.classList.add('muted');
            btn.classList.remove('active');
            btn.innerText = 'MUTED';
        } else {
            btn.classList.remove('muted');
            btn.classList.add('active');
            btn.innerText = 'ON (CH2)';
        }
    };

    btn.addEventListener('touchstart', onToggle);
    btn.addEventListener('mousedown', onToggle);
};

ProView.prototype.startRaf = function () {
    var self = this;
    var statsEl = document.getElementById('perf-stats');

    var loop = function () {
        var now = Date.now();
        var elapsed = now - self.lastStatsUpdate;

        if (elapsed >= 1000 && statsEl) {
            var seconds = elapsed / 1000;
            var wsPerSec = Math.round(self.wsMessageCount / seconds);
            var updatesPerSec = Math.round(self.meterUpdateCount / seconds);
            var activePeaks = 0;
            for (var i = 0; i < self.peakValues.length; i++) if (self.peakValues[i] > 0) activePeaks++;

            statsEl.innerText = 'WS: ' + wsPerSec + '/s\nMTR: ' + updatesPerSec + '/s\nPK: ' + activePeaks;

            self.wsMessageCount = 0;
            self.meterUpdateCount = 0;
            self.lastStatsUpdate = now;
        }

        if (self.updateQueue['test-knob']) {
            self.renderKnob('test-knob', self.currentMidi);
            delete self.updateQueue['test-knob'];
        }
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
};

ProView.prototype.renderKnob = function (id, val) {
    if (!this.elCache['ring-' + id]) this.elCache['ring-' + id] = document.getElementById('ring-' + id);
    if (!this.elCache['ind-' + id]) this.elCache['ind-' + id] = document.getElementById('ind-' + id);
    if (!this.elCache['val-' + id]) this.elCache['val-' + id] = document.getElementById('val-' + id);

    var angle = (val / 127) * 270 - 135;
    var ring = this.elCache['ring-' + id];
    if (ring) {
        var offset = 150.8 - (val / 127) * 150.8;
        ring.style.strokeDashoffset = offset;
    }

    var ind = this.elCache['ind-' + id];
    if (ind) {
        ind.style.webkitTransform = 'rotate(' + angle + 'deg)';
        ind.style.transform = 'rotate(' + angle + 'deg)';
        ind.style.webkitTransformOrigin = '30px 30px';
        ind.style.transformOrigin = '30px 30px';
    }

    if (valEl) valEl.innerText = val;
};

// Snapshot Engine for Legacy iOS (Zoom Out Lock)
ProView.prototype.toggleLockUI = function (locked) {
    var overlay = document.getElementById('global-lock-overlay');
    var stage = document.querySelector('.view-container');

    if (locked) {
        if (document.getElementById('snapshot-proxy')) return;

        // 1. Clone Stage
        var clone = stage.cloneNode(true);
        clone.id = 'snapshot-proxy';

        // 2. Freeze & Position
        // Must copy computed styles or set explicitly to match exact position
        var rect = stage.getBoundingClientRect();
        clone.style.position = 'fixed';
        clone.style.top = rect.top + 'px';
        clone.style.left = rect.left + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.zIndex = '9999';
        clone.style.backgroundColor = '#0a0a0a'; // Match background

        clone.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.4s ease';
        clone.style.transformOrigin = 'center center';
        clone.style.willChange = 'transform';

        document.body.appendChild(clone);

        // 3. Hide Original
        stage.style.visibility = 'hidden';

        // 4. Animate (Force reflow)
        void clone.offsetWidth;

        // Zoom Out Legacy Style (No Rotation)
        clone.style.transform = 'scale(0.85)';
        clone.style.opacity = '0.5';
        clone.style.filter = 'grayscale(0.8)';

        if (overlay) overlay.classList.add('active');
        document.body.classList.add('mode-lock-active');

    } else {
        // Unlock
        var clone = document.getElementById('snapshot-proxy');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('mode-lock-active');

        if (clone) {
            clone.style.transform = 'scale(1)';
            clone.style.opacity = '1';
            clone.style.filter = 'none';

            setTimeout(function () {
                if (clone.parentNode) clone.parentNode.removeChild(clone);
                stage.style.visibility = '';
            }, 400); // Sync with transition
        } else {
            stage.style.visibility = '';
        }
    }
};

window.addEventListener('load', function () {
    setTimeout(function () { new ProView(); }, 50);
});
