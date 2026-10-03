const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;   // hosts set PORT for you
const wss = new WebSocket.Server({ port: PORT });
const rooms = {};                        // roomCode -> Set of sockets

wss.on('connection', ws => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', raw => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        // First message from a player: {"type":"join","room":"ABCD"}
        if (msg.type === 'join') {
            ws.room = msg.room;
            if (!rooms[ws.room]) rooms[ws.room] = new Set();
            rooms[ws.room].add(ws);
            return;
        }

        // Everything else is forwarded to the other player in the same room
        const peers = rooms[ws.room];
        if (!peers) return;
        peers.forEach(p => {
            if (p !== ws && p.readyState === WebSocket.OPEN) p.send(raw.toString());
        });
    });

    ws.on('close', () => {
        const peers = rooms[ws.room];
        if (!peers) return;
        peers.delete(ws);
        if (peers.size === 0) delete rooms[ws.room];
    });
});

// Drop dead connections every 30s
setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

console.log('Signaling server running on port ' + PORT);
