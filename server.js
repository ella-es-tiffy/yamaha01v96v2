
const WebSocket = require('ws');
const Yamaha01V96Controller = require('./yamaha_controller');

const WS_PORT = 3007;

const yamaha = new Yamaha01V96Controller(0);

yamaha.onStateChange = (state) => {
    broadcast({ type: 'state', data: state });
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
    console.log('✓ Yamaha Controller Active (with EQ)');
}

const wss = new WebSocket.Server({ port: WS_PORT, host: '0.0.0.0' });

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'state', data: yamaha.state }));
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('WS RX:', data.type, data.channel, data.value);
            if (data.type === 'setFader') yamaha.setFader(data.channel, data.value);
            else if (data.type === 'setMute') yamaha.setMute(data.channel, data.value);
            else if (data.type === 'sync') yamaha.deepSync(); // Added 'sync' command
            else if (data.type === 'requestSync') yamaha.requestInitialState();
            // --- NEW EQ HANDLER ---
            else if (data.type === 'setEQ') yamaha.setEQ(data.channel, data.band, data.param, data.value);
            else if (data.type === 'setEQOn') yamaha.setEQOn(data.channel, data.value);
            else if (data.type === 'setSelectChannel') yamaha.setSelectedChannel(data.channel);
            else if (data.type === 'setPan') yamaha.setPan(data.channel, data.value);
            else if (data.type === 'getChangelog') {
                fs.readFile(path.join(__dirname, 'changelog.md'), 'utf8', (err, log) => {
                    if (err) ws.send(JSON.stringify({ type: 'changelog', data: 'Changelog not found.' }));
                    else ws.send(JSON.stringify({ type: 'changelog', data: formatMarkdown(log) }));
                });
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

function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(msg); });
}

const http = require('http');
const fs = require('fs');
const path = require('path');
const HTTP_PORT = 8009;

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
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

server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`🌐 Web Remote running at http://localhost:${HTTP_PORT}`);
});
