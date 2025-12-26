const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const Yamaha01V96Controller = require('./yamaha_controller');

/**
 * MODULE: Server (Backend Bridge)
 * VERSION: v0.1.2-mon
 * DESCRIPTION: Refactored into a Class-based architecture to avoid procedural JS.
 */
class YamahaServer {
    constructor(wsPort = 3007, httpPort = 8009) {
        this.wsPort = wsPort;
        this.httpPort = httpPort;
        this.yamaha = new Yamaha01V96Controller(0);
        this.wss = null;
        this.server = null;
        this.lastMeterBroadcast = 0; // Throttle meter broadcasts
    }

    init() {
        this.setupYamaha();
        this.setupWebSocket();
        this.setupHttpServer();
        this.setupFileWatcher();

        console.log('-------------------------------------------');
        console.log('🚀 YAMAHA 01V96 MODULES INITIALIZED');
        console.log(`✓ WebSocket: port ${this.wsPort}`);
        console.log(`✓ HTTP: http://localhost:${this.httpPort}`);
        console.log('-------------------------------------------');
    }

    setupYamaha() {
        this.yamaha.onStateChange = (state) => this.broadcast({ type: 'state', data: state });
        this.yamaha.onSyncStatus = (status) => this.broadcast({ type: 'syncStatus', status: status });
        this.yamaha.onMeterChange = (state) => {
            const now = Date.now();
            const broadcastRate = state.settings?.meterBroadcastRate || 150;

            // Throttle broadcasts based on user setting
            if (now - this.lastMeterBroadcast < broadcastRate) return;
            this.lastMeterBroadcast = now;

            const meterData = {
                channels: state.channels.map(ch => ch.meter),
                master: state.master.meter
            };
            this.broadcast({ type: 'meters', data: meterData });
        };
        this.yamaha.onRawMidi = (msg, isOutgoing) => {
            this.broadcast({ type: 'midiLog', data: Array.from(msg), isOutgoing: !!isOutgoing });
        };

        if (this.yamaha.connect()) {
            console.log('✓ Yamaha Controller Connected');
        }
    }

    setupWebSocket() {
        this.wss = new WebSocket.Server({ port: this.wsPort, host: '0.0.0.0' });
        this.wss.on('connection', (ws, req) => {
            const params = new URLSearchParams(req.url.split('?')[1]);
            ws.clientType = params.get('client') === 'view' ? 'legacy' : 'modern';

            console.log(`[WS] Client connected (${ws.clientType})`);
            ws.send(JSON.stringify({ type: 'state', data: this.yamaha.state }));

            ws.on('message', (msg) => this.handleWsMessage(ws, msg));
        });
    }

    handleWsMessage(ws, message) {
        try {
            let data = JSON.parse(message);
            if (ws.clientType === 'legacy' && data.t) {
                data = this.translateLegacyToModern(data);
            }

            console.log(`WS RX (${ws.clientType}):`, data.type, data.channel || '');

            const y = this.yamaha;
            const handlers = {
                'setFader': () => y.setFader(data.channel, data.value),
                'setMute': () => y.setMute(data.channel, data.value),
                'sync': () => y.deepSync(),
                'requestSync': () => y.requestInitialState(),
                'setEQ': () => y.setEQ(data.channel, data.band, data.param, data.value),
                'setEQOn': () => y.setEQOn(data.channel, data.value),
                'setAtt': () => y.setAttenuation(data.channel, data.value),
                'setEQType': () => y.setEQType(data.channel, data.value),
                'resetEQ': () => y.resetEQ(data.channel),
                'recallEQ': () => y.recallEQ(data.channel, data.preset),
                'setSelectChannel': () => y.setSelectedChannel(data.channel),
                'setMeterInterval': () => y.setMeterInterval(data.value, data.range),
                'setMeterBroadcastRate': () => y.setMeterBroadcastRate(data.value),
                'setPan': () => y.setPan(data.channel, data.value),
                'scanPresets': () => y.scanPresets(),
                'saveEQ': () => y.saveEQ(data.channel, data.preset, data.name),
                'setUILock': () => y.setUIOption('uiLocked', data.value),
                'setMeterOffset': () => y.setMeterOffset(data.value),
                'setUIOption': () => y.setUIOption(data.key, data.value),
                'getChangelog': () => {
                    fs.readFile(path.join(__dirname, 'changelog.md'), 'utf8', (err, log) => {
                        const content = err ? 'Changelog not found.' : this.formatMarkdown(log);
                        ws.send(JSON.stringify({ type: 'changelog', data: content }));
                    });
                }
            };

            if (handlers[data.type]) handlers[data.type]();
            if (data.type.startsWith('set')) this.broadcast(data, ws);

        } catch (e) { console.error('WS Error:', e); }
    }

    translateLegacyToModern(data) {
        const legacyMap = { 'f': 'setFader', 'm': 'setMute', 'p': 'setPan', 'e': 'setEQ', 'l': 'setUILock', 'sync': 'sync' };
        return {
            type: legacyMap[data.t] || data.t,
            channel: data.c,
            value: data.v,
            band: data.b,
            param: data.pa
        };
    }

    translateModernToLegacy(data) {
        if (data.type === 'meters') return { t: 'me', d: data.data };
        if (data.type === 'reload') return { t: 'r' };

        // COMPACT STATE FOR LEGACY DEVICES (Pro View)
        if (data.type === 'state') {
            // Safety: If this is a partial update (e.g. eqPresets only), skip legacy translation
            if (!data.data || !data.data.channels) return null;

            return {
                t: 'state',
                m: data.data.channels.map(ch => ch.mute ? 1 : 0),
                n: data.data.channels.map(ch => ch.name || ''),
                f: data.data.channels.map(ch => ch.fader || 0),
                s: data.data.settings || {}
            };
        }

        const revMap = { 'setFader': 'f', 'setMute': 'm', 'setPan': 'p', 'setEQ': 'e', 'setUILock': 'l' };
        if (revMap[data.type]) {
            return {
                t: revMap[data.type],
                c: data.channel,
                v: data.value,
                b: data.band,
                pa: data.param
            };
        }
        if (data.type === 'setUIOption') {
            return { t: 'setUIOption', k: data.key, v: data.value };
        }
        return null;
    }

    broadcast(data, skipWs) {
        const modernMsg = JSON.stringify(data);
        const legacyMsg = JSON.stringify(this.translateModernToLegacy(data));

        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client !== skipWs) {
                const msg = (client.clientType === 'legacy' && legacyMsg !== 'null') ? legacyMsg : modernMsg;
                client.send(msg);
            }
        });
    }

    setupHttpServer() {
        this.server = http.createServer((req, res) => {
            // API: Lock Status (Lightweight Polling for Legacy)
            if (req.url === '/api/lock') {
                if (req.method === 'GET') {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ locked: !!this.yamaha.state.settings.uiLocked }));
                    return;
                } else if (req.method === 'POST') {
                    let body = '';
                    req.on('data', chunk => { body += chunk.toString(); });
                    req.on('end', () => {
                        try {
                            const params = JSON.parse(body);
                            // Update State
                            this.yamaha.setUIOption('uiLocked', params.locked);
                            // Broadcast change to all WS clients (so PT sees it)
                            this.broadcast({ type: 'setUILock', value: params.locked });

                            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                            res.end(JSON.stringify({ success: true, locked: params.locked }));
                        } catch (e) {
                            res.writeHead(400); res.end('Invalid JSON');
                        }
                    });
                    return;
                }
            }

            let filePath = (req.url.startsWith('/dev/'))
                ? path.join(__dirname, 'dev', req.url.replace('/dev/', ''))
                : path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);

            const extname = path.extname(filePath);
            const contentTypes = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
            const contentType = contentTypes[extname] || 'text/plain';

            fs.readFile(filePath, (err, content) => {
                if (err) { res.writeHead(404); res.end('404'); }
                else { res.writeHead(200, { 'Content-Type': contentType }); res.end(content); }
            });
        });
        this.server.listen(this.httpPort, '0.0.0.0');
    }

    setupFileWatcher() {
        const viewDir = path.join(__dirname, 'public', 'view');
        if (fs.existsSync(viewDir)) {
            fs.watch(viewDir, { recursive: true }, (eventType, filename) => {
                if (filename) this.broadcast({ type: 'reload' });
            });
        }
    }

    formatMarkdown(md) {
        return md
            .replace(/## \[(.*?)\] - (.*?)\n/g, '<div style="margin-top:25px; border-bottom: 2px solid #333; padding-bottom:10px;"><h3 style="color:var(--accent); display:inline;">v$1</h3> <span style="color:#666; font-size:0.8rem;">($2)</span></div>')
            .replace(/### (.*?)\n/g, '<h4 style="color:#aaa; border-left: 3px solid var(--accent); padding-left:10px; margin-top:15px;">$1</h4>')
            .replace(/- (.*?)\n/g, '<div style="padding-left:15px; margin-bottom:5px;">• $1</div>')
            .replace(/\n\n/g, '<br>');
    }
}

// Instantiate and Run
new YamahaServer().init();
