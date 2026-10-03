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
            if (!rooms[msg.room]) rooms[msg.room] = new Set();
            const room = rooms[msg.room];
            if (room.size >= 2) {
                ws.send(JSON.stringify({ type: 'room_full' }));
                return;
            }
            ws.room = msg.room;
            room.add(ws);
            ws.send(JSON.stringify({ type: 'joined', player: room.size })); // 1 = host, 2 = guest
            room.forEach(p => {
                if (p !== ws && p.readyState === WebSocket.OPEN) {
                    p.send(JSON.stringify({ type: 'peer_joined' }));
                }
            });
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
        peers.forEach(p => {
            if (p.readyState === WebSocket.OPEN) p.send(JSON.stringify({ type: 'peer_left' }));
        });
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
