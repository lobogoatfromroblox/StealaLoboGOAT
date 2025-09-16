const WebSocket = require('ws');
const http = require('http');

// Criar servidor HTTP
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Armazenar conexões por sala
const rooms = new Map();
const userConnections = new Map();

console.log('🚀 Character Tycoon Server iniciando...');

wss.on('connection', (ws) => {
    console.log('👤 Nova conexão estabelecida');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Mensagem recebida:', data.type, 'de', data.username || 'anônimo');
            
            // Armazenar conexão do usuário
            if (data.username && data.room) {
                userConnections.set(data.username, { ws, room: data.room });
                
                // Adicionar à sala
                if (!rooms.has(data.room)) {
                    rooms.set(data.room, new Set());
                }
                rooms.get(data.room).add(ws);
                ws.currentRoom = data.room;
                ws.username = data.username;
            }
            
            // Processar diferentes tipos de mensagem
            switch (data.type) {
                case 'chat_message':
                    broadcastToRoom(data.room, {
                        type: 'chat_message',
                        username: data.username,
                        message: data.message,
                        timestamp: Date.now()
                    }, ws);
                    break;
                    
                case 'new_conveyor_generated':
                    broadcastToRoom(data.room, {
                        type: 'new_conveyor_generated',
                        conveyorItems: data.conveyorItems,
                        generatedBy: data.username
                    }, ws);
                    break;
                    
                case 'auction_started':
                    // Repassar leilão iniciado para todos na sala
                    broadcastToRoom(data.room, {
                        type: 'auction_started',
                        itemIndex: data.itemIndex,
                        item: data.item,
                        bidder: data.bidder,
                        timestamp: Date.now()
                    }, ws);
                    console.log(`⚔️ Leilão iniciado por ${data.bidder} para ${data.item.name}`);
                    break;
                    
                case 'auction_ended':
                    // Repassar resultado do leilão
                    broadcastToRoom(data.room, {
                        type: 'auction_ended',
                        itemIndex: data.itemIndex,
                        winner: data.winner,
                        itemName: data.itemName,
                        timestamp: Date.now()
                    }, ws);
                    console.log(`🏆 Leilão vencido por ${data.winner} - ${data.itemName}`);
                    break;
                    
                case 'admin_start_event':
                    broadcastToRoom(data.room, {
                        type: 'admin_event_start',
                        admin: data.admin,
                        event: data.event,
                        duration: data.duration
                    }, ws);
                    console.log(`🎉 Evento iniciado por admin ${data.admin}: ${data.event.name}`);
                    break;
                    
                case 'admin_action':
                    broadcastToRoom(data.room, {
                        type: 'admin_action',
                        admin: data.admin,
                        action: data.action
                    }, ws);
                    break;
                    
                case 'player_join':
                    // Notificar outros jogadores
                    broadcastToRoom(data.room, {
                        type: 'player_joined',
                        username: data.username,
                        timestamp: Date.now()
                    }, ws);
                    
                    // Enviar lista de jogadores online
                    sendPlayersOnline(data.room);
                    break;
                    
                default:
                    console.log('❓ Tipo de mensagem desconhecido:', data.type);
            }
            
        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('👋 Conexão fechada');
        
        // Remover da sala
        if (ws.currentRoom && rooms.has(ws.currentRoom)) {
            rooms.get(ws.currentRoom).delete(ws);
            
            // Se sala ficou vazia, remover
            if (rooms.get(ws.currentRoom).size === 0) {
                rooms.delete(ws.currentRoom);
                console.log(`🏠 Sala ${ws.currentRoom} removida (vazia)`);
            } else {
                // Atualizar lista de jogadores online
                sendPlayersOnline(ws.currentRoom);
            }
        }
        
        // Remover das conexões de usuário
        if (ws.username) {
            userConnections.delete(ws.username);
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ Erro na conexão WebSocket:', error);
    });
});

// Função para broadcast para uma sala específica
function broadcastToRoom(roomName, message, excludeWs = null) {
    if (!rooms.has(roomName)) {
        console.log(`⚠️ Tentativa de broadcast para sala inexistente: ${roomName}`);
        return;
    }
    
    const roomConnections = rooms.get(roomName);
    let sentCount = 0;
    
    roomConnections.forEach(ws => {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
                sentCount++;
            } catch (error) {
                console.error('❌ Erro ao enviar mensagem:', error);
                // Remover conexão inválida
                roomConnections.delete(ws);
            }
        }
    });
    
    console.log(`📡 Mensagem enviada para ${sentCount} jogadores na sala ${roomName}`);
}

// Função para enviar lista de jogadores online
function sendPlayersOnline(roomName) {
    if (!rooms.has(roomName)) return;
    
    const roomConnections = rooms.get(roomName);
    const playersOnline = [];
    
    roomConnections.forEach(ws => {
        if (ws.username && ws.readyState === WebSocket.OPEN) {
            playersOnline.push({
                username: ws.username,
                isAdmin: ws.isAdmin || false
            });
        }
    });
    
    broadcastToRoom(roomName, {
        type: 'players_online',
        players: playersOnline,
        count: playersOnline.length
    });
}

// Estatísticas do servidor a cada 30 segundos
setInterval(() => {
    const totalRooms = rooms.size;
    const totalConnections = Array.from(rooms.values()).reduce((sum, room) => sum + room.size, 0);
    
    console.log(`📊 Estatísticas: ${totalRooms} salas ativas, ${totalConnections} conexões`);
    
    // Listar salas ativas
    rooms.forEach((connections, roomName) => {
        console.log(`  🏠 Sala "${roomName}": ${connections.size} jogadores`);
    });
}, 30000);

// Iniciar servidor na porta 8080
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🎮 Character Tycoon Server rodando na porta ${PORT}`);
    console.log(`🌐 WebSocket Server ativo!`);
    console.log(`📡 Pronto para receber conexões...`);
});

// Tratamento de erros do servidor
server.on('error', (error) => {
    console.error('❌ Erro no servidor:', error);
});

process.on('SIGINT', () => {
    console.log('\n👋 Encerrando servidor...');
    
    // Notificar todos os clientes
    rooms.forEach((connections, roomName) => {
        broadcastToRoom(roomName, {
            type: 'server_shutdown',
            message: 'Servidor sendo reiniciado...'
        });
    });
    
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});
