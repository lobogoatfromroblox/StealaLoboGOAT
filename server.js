const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('../client'));

// Salas de jogo
const gameRooms = new Map();

// Gerador de esteira sincronizada
function generateBeltSeed() {
  return Date.now() + Math.floor(Math.random() * 1000000);
}

io.on('connection', (socket) => {
  console.log(`🔗 Jogador conectado: ${socket.id}`);

  socket.on('joinRoom', (data) => {
    const { playerName, roomCode, playerData } = data;
    
    socket.join(roomCode);
    socket.playerName = playerName;
    socket.roomCode = roomCode;
    socket.playerData = playerData;

    // Inicializar sala se não existir
    if (!gameRooms.has(roomCode)) {
      gameRooms.set(roomCode, {
        players: new Map(),
        beltSeed: generateBeltSeed(),
        lastBeltUpdate: Date.now()
      });
    }

    const room = gameRooms.get(roomCode);
    room.players.set(socket.id, {
      socketId: socket.id,
      name: playerName,
      ...playerData
    });

    // Confirmar entrada na sala
    socket.emit('joinSuccess', {
      playerCount: room.players.size,
      beltSeed: room.beltSeed
    });

    // Atualizar lista de jogadores para todos
    const playersList = Array.from(room.players.values());
    io.to(roomCode).emit('playersUpdate', playersList);

    console.log(`✅ ${playerName} entrou na sala ${roomCode}`);
  });

  socket.on('buyItem', (data) => {
    const { itemName, price } = data;
    const roomCode = socket.roomCode;
    
    if (roomCode) {
      // Notificar todos na sala sobre a compra
      socket.to(roomCode).emit('itemSold', {
        itemName,
        price,
        buyerName: socket.playerName
      });
      
      console.log(`💰 ${socket.playerName} comprou ${itemName} por $${price}`);
    }
  });

  socket.on('playerUpdate', (playerData) => {
    const roomCode = socket.roomCode;
    
    if (roomCode && gameRooms.has(roomCode)) {
      const room = gameRooms.get(roomCode);
      if (room.players.has(socket.id)) {
        room.players.set(socket.id, {
          socketId: socket.id,
          name: socket.playerName,
          ...playerData
        });

        // Atualizar lista para todos
        const playersList = Array.from(room.players.values());
        io.to(roomCode).emit('playersUpdate', playersList);
      }
    }
  });

  socket.on('attack', (data) => {
    const { targetId, success, stolenItem } = data;
    const roomCode = socket.roomCode;
    
    if (roomCode) {
      io.to(roomCode).emit('attackResult', {
        attackerId: socket.id,
        attackerName: socket.playerName,
        targetId,
        success,
        stolenItem
      });
      
      console.log(`⚔️ ${socket.playerName} atacou ${success ? 'com sucesso' : 'sem sucesso'}`);
    }
  });

  socket.on('trade', (data) => {
    const { targetId, offeredItems, requestedItems } = data;
    const roomCode = socket.roomCode;
    
    if (roomCode) {
      socket.to(targetId).emit('tradeOffer', {
        fromId: socket.id,
        fromName: socket.playerName,
        offeredItems,
        requestedItems
      });
      
      console.log(`💱 ${socket.playerName} enviou oferta de troca`);
    }
  });

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    
    if (roomCode && gameRooms.has(roomCode)) {
      const room = gameRooms.get(roomCode);
      room.players.delete(socket.id);
      
      // Atualizar lista de jogadores
      const playersList = Array.from(room.players.values());
      io.to(roomCode).emit('playersUpdate', playersList);
      
      // Remover sala se vazia
      if (room.players.size === 0) {
        gameRooms.delete(roomCode);
        console.log(`🗑️ Sala ${roomCode} removida (vazia)`);
      }
    }
    
    console.log(`❌ Jogador desconectado: ${socket.id}`);
  });
});

// Atualizar esteiras a cada 90 segundos
setInterval(() => {
  gameRooms.forEach((room, roomCode) => {
    if (room.players.size > 0) {
      room.beltSeed = generateBeltSeed();
      room.lastBeltUpdate = Date.now();
      
      io.to(roomCode).emit('beltUpdate', {
        seed: room.beltSeed
      });
      
      console.log(`🔄 Esteira atualizada para sala ${roomCode}`);
    }
  });
}, 90000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor Character Tycoon rodando na porta ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
});