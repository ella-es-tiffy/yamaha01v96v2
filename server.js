/**
 * MODULE: Server (Backend Bridge)
 * VERSION: v0.1.1-mon
 */
const WebSocket = require('ws');
const Yamaha01V96Controller = require('./yamaha_controller');

const WS_PORT = 3007;

const yamaha = new Yamaha01V96Controller(0);

yamaha.onStateChange = (state) => {
    broadcast({ type: 'state', data: state });
};

yamaha.onSyncStatus = (status) => {
    broadcast({ type: 'syncStatus', status: status });
};

yamaha.onMeterChange = (state) => {
    // Only broadcast meter values, not full state
    const meterData = {
        channels: state.channels.map(ch => ch.meter),
        master: state.master.meter
    };
    broadcast({ type: 'meters', data: meterData });
};

yamaha.onRawMidi = (msg, isOutgoing) => {
    broadcast({ type: 'midiLog', data: Array.from(msg), isOutgoing: !!isOutgoing });
};

if (yamaha.connect()) {
    console.log('-------------------------------------------');
    console.log('🚀 YAMAHA 01V96 PRO TOUCH ENGINE v1.1stable');
    console.log('✓ Yamaha Controller Active (with Smart Cache)');
    console.log('-------------------------------------------');
}

const wss = new WebSocket.Server({ port: WS_PORT, host: '0.0.0.0' });

wss.on('connection', (ws, req) => {
    // Determine client type from URL (e.g., ws://host:port?client=view)
    const params = new URLSearchParams(req.url.split('?')[1]);
    ws.clientType = params.get('client') === 'view' ? 'legacy' : 'modern';

    console.log(`[WS] Client connected (${ws.clientType}). Sending initial state.`);

    // Initial state is always full for now, but we could trim it for legacy if needed
    ws.send(JSON.stringify({ type: 'state', data: yamaha.state }));

    ws.on('message', (message) => {
        try {
            let data = JSON.parse(message);

            // TRANSLATION: Legacy (View) -> Modern (Internal)
            if (ws.clientType === 'legacy' && data.t) {
                const legacyMap = { 'f': 'setFader', 'm': 'setMute', 'p': 'setPan', 'e': 'setEQ' };
                data = {
                    type: legacyMap[data.t] || data.t,
                    channel: data.c,
                    value: data.v,
                    band: data.b,
                    param: data.pa
                };
            }

            console.log(`WS RX (${ws.clientType}):`, data.type, data.channel, data.value);

            // Execute command on Yamaha controller
            if (data.type === 'setFader') yamaha.setFader(data.channel, data.value);
            else if (data.type === 'setMute') yamaha.setMute(data.channel, data.value);
            else if (data.type === 'sync') yamaha.deepSync();
            else if (data.type === 'requestSync') yamaha.requestInitialState();
            else if (data.type === 'setEQ') yamaha.setEQ(data.channel, data.band, data.param, data.value);
            else if (data.type === 'setEQOn') yamaha.setEQOn(data.channel, data.value);
            else if (data.type === 'setAtt') yamaha.setAttenuation(data.channel, data.value);
            else if (data.type === 'setEQType') yamaha.setEQType(data.channel, data.value);
            else if (data.type === 'resetEQ') yamaha.resetEQ(data.channel);
            else if (data.type === 'recallEQ') yamaha.recallEQ(data.channel, data.preset);
            else if (data.type === 'setSelectChannel') yamaha.setSelectedChannel(data.channel);
            else if (data.type === 'setMeterInterval') yamaha.setMeterInterval(data.value, data.range);
            else if (data.type === 'setPan') yamaha.setPan(data.channel, data.value);
            else if (data.type === 'scanPresets') yamaha.scanPresets();
            else if (data.type === 'saveEQ') yamaha.saveEQ(data.channel, data.preset, data.name);
            else if (data.type === 'setMeterOffset') yamaha.setMeterOffset(data.value);
            else if (data.type === 'setUIOption') yamaha.setUIOption(data.key, data.value);
            else if (data.type === 'getChangelog') {
                fs.readFile(path.join(__dirname, 'changelog.md'), 'utf8', (err, log) => {
                    if (err) ws.send(JSON.stringify({ type: 'changelog', data: 'Changelog not found.' }));
                    else ws.send(JSON.stringify({ type: 'changelog', data: formatMarkdown(log) }));
                });
            }

            // LIGHTWEIGHT BROADCAST: Send this change to all OTHER clients
            if (data.type.startsWith('set')) {
                broadcast(data, ws);
            }

        } catch (e) { console.error('WS Error:', e); }
    });
});

function formatMarkdown(md) {
    return md
        .replace(/## \[(.*?)\] - (.*?)\n/g, '<div style="margin-top:25px; border-bottom: 2px solid #333; padding-bottom:10px;"><h3 style="color:var(--accent); display:inline;">v$1</h3> <span style="color:#666; font-size:0.8rem;">($2)</span></div>')
        .replace(/### (.*?)\n/g, '<h4 style="color:#aaa; border-left: 3px solid var(--accent); padding-left:10px; margin-top:15px;">$1</h4>')
        .replace(/- (.*?)\n/g, '<div style="padding-left:15px; margin-bottom:5px;">• $1</div>')
        .replace(/\n\n/g, '<br>');
}

function broadcast(data, skipWs) {
    const modernMsg = JSON.stringify(data);

    // Pre-calculate Legacy version
    let legacyMsg = null;
    if (data.type === 'meters') {
        legacyMsg = JSON.stringify({ t: 'me', d: data.data });
    } else if (data.type === 'reload') {
        legacyMsg = JSON.stringify({ t: 'r' });
    } else {
        const revMap = { 'setFader': 'f', 'setMute': 'm', 'setPan': 'p', 'setEQ': 'e' };
        if (revMap[data.type]) {
            legacyMsg = JSON.stringify({
                t: revMap[data.type],
                c: data.channel,
                v: data.value,
                b: data.band,
                pa: data.param
            });
        }
    }

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client !== skipWs) {
            if (client.clientType === 'legacy' && legacyMsg) {
                client.send(legacyMsg);
            } else {
                client.send(modernMsg);
            }
        }
    });
}

const http = require('http');
const fs = require('fs');
/**
 * MODULE: Server (Backend Bridge)
 * VERSION: v0.1.1-mon
 */
const express = require('express');
const path = require('path');
const HTTP_PORT = 8009;

const server = http.createServer((req, res) => {
    let filePath;
    if (req.url.startsWith('/dev/')) {
        filePath = path.join(__dirname, 'dev', req.url.replace('/dev/', ''));
    } else {
        filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    }
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
    }
    fs.readFile(filePath, (err, content) => {
        if (err) { res.writeHead(404); res.end('404'); }
        else { res.writeHead(200, { 'Content-Type': contentType }); res.end(content); }
    });
});

// File Watcher for Standalone View Auto-Reload
const VIEW_DIR = path.join(__dirname, 'public', 'view');
if (fs.existsSync(VIEW_DIR)) {
    fs.watch(VIEW_DIR, { recursive: true }, (eventType, filename) => {
        if (filename) {
            console.log(`[WATCH] Change detected in view: ${filename} (${eventType})`);
            broadcast({ type: 'reload' });
        }
    });
}

server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`🌐 Web Remote running at http://localhost:${HTTP_PORT}`);
});
