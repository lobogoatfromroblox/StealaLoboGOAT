// Criar servidor HTTP
const http = require('http')
const server = http.createServer();
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

// Armazenar dados dos jogadores e salas
const rooms = new Map();
const players = new Map();

console.log('🚀 Servidor Character Tycoon Multiplayer iniciando...');

wss.on('connection', (ws) => {
    console.log('🔗 Nova conexão estabelecida');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Mensagem recebida:', data.type, data);
            
            switch (data.type) {
                case 'player_join':
                    handlePlayerJoin(ws, data);
                    break;
                    
                case 'chat_message':
                    handleChatMessage(ws, data);
                    break;
                    
                case 'auction_started':
                    handleAuctionStarted(ws, data);
                    break;
                    
                case 'auction_ended':
                    handleAuctionEnded(ws, data);
                    break;
                    
                case 'admin_start_event':
                    handleAdminEvent(ws, data);
                    break;
                    
                default:
                    console.log('❓ Tipo de mensagem desconhecido:', data.type);
            }
        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    });
    
    ws.on('close', () => {
        handlePlayerDisconnect(ws);
        console.log('🔌 Conexão fechada');
    });
    
    ws.on('error', (error) => {
        console.error('❌ Erro WebSocket:', error);
    });
});

function handlePlayerJoin(ws, data) {
    const { username, room } = data;
    
    // Registrar jogador
    players.set(ws, { username, room, isAdmin: false });
    
    // Adicionar à sala
    if (!rooms.has(room)) {
        rooms.set(room, new Set());
    }
    rooms.get(room).add(ws);
    
    console.log(`👋 ${username} entrou na sala: ${room}`);
    
    // Notificar outros jogadores da sala
    broadcastToRoom(room, {
        type: 'player_joined',
        username: username
    }, ws);
    
    // Enviar lista de jogadores online para todos na sala
    updatePlayersInRoom(room);
}

function handleChatMessage(ws, data) {
    const player = players.get(ws);
    if (!player) return;
    
    const { message, room } = data;
    
    console.log(`💬 [${room}] ${player.username}: ${message}`);
    
    // Enviar mensagem para todos na sala
    broadcastToRoom(room, {
        type: 'chat_message',
        username: player.username,
        message: message,
        timestamp: Date.now()
    });
}

function handleAuctionStarted(ws, data) {
    const player = players.get(ws);
    if (!player) return;
    
    const { item, room } = data;
    
    console.log(`⚔️ [${room}] ${player.username} iniciou leilão: ${item.name} por ${item.price}`);
    
    // Enviar leilão para todos na sala (exceto quem iniciou)
    broadcastToRoom(room, {
        type: 'auction_started',
        item: item,
        bidder: player.username,
        timestamp: Date.now()
    }, ws);
}

function handleAuctionEnded(ws, data) {
    const player = players.get(ws);
    if (!player) return;
    
    const { winner, itemName, room } = data;
    
    console.log(`🏆 [${room}] Leilão de ${itemName} vencido por ${winner}`);
    
    // Notificar todos na sala sobre o resultado
    broadcastToRoom(room, {
        type: 'auction_ended',
        winner: winner,
        itemName: itemName,
        timestamp: Date.now()
    });
}

function handleAdminEvent(ws, data) {
    const player = players.get(ws);
    if (!player) return;
    
    const { admin, event, duration, room } = data;
    
    console.log(`🎉 [${room}] Admin ${admin} iniciou evento: ${event.name}`);
    
    // Enviar evento para todos na sala
    broadcastToRoom(room, {
        type: 'admin_event_start',
        admin: admin,
        event: event,
        duration: duration,
        timestamp: Date.now()
    });
    
    // Finalizar evento após duração
    setTimeout(() => {
        broadcastToRoom(room, {
            type: 'admin_event_end',
            admin: admin,
            event: event,
            timestamp: Date.now()
        });
        console.log(`🎉 [${room}] Evento ${event.name} finalizado`);
    }, duration * 60 * 1000);
}

function handlePlayerDisconnect(ws) {
    const player = players.get(ws);
    if (!player) return;
    
    const { username, room } = player;
    
    // Remover da sala
    if (rooms.has(room)) {
        rooms.get(room).delete(ws);
        if (rooms.get(room).size === 0) {
            rooms.delete(room);
        }
    }
    
    // Remover dos jogadores
    players.delete(ws);
    
    console.log(`👋 ${username} saiu da sala: ${room}`);
    
    // Atualizar lista de jogadores
    updatePlayersInRoom(room);
}

function broadcastToRoom(roomName, message, excludeWs = null) {
    if (!rooms.has(roomName)) return;
    
    const roomPlayers = rooms.get(roomName);
    const messageStr = JSON.stringify(message);
    
    roomPlayers.forEach(ws => {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(messageStr);
            } catch (error) {
                console.error('❌ Erro ao enviar mensagem:', error);
            }
        }
    });
}

function updatePlayersInRoom(roomName) {
    if (!rooms.has(roomName)) return;
    
    const roomPlayers = rooms.get(roomName);
    const playersList = [];
    
    roomPlayers.forEach(ws => {
        const player = players.get(ws);
        if (player) {
            playersList.push({
                username: player.username,
                isAdmin: player.isAdmin
            });
        }
    });
    
    // Enviar lista atualizada para todos na sala
    broadcastToRoom(roomName, {
        type: 'players_online',
        players: playersList
    });
}

// Iniciar servidor na porta 8080
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🎮 Servidor Character Tycoon rodando na porta ${PORT}`);
    console.log(`🌐 WebSocket disponível em ws://localhost:${PORT}`);
    console.log('✅ Pronto para conexões multiplayer!');
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada:', reason);
});



