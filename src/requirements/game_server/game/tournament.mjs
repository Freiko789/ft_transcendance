import { findOrCreateRoom, findRoomForSocket } from './socketUtils.mjs';
import { setupMultiGame } from './game.mjs';
import { Ball } from './ball.mjs';
import { Pad } from './pad.mjs';
import { keysPressedMap } from './sockets.mjs';
import { rooms, roomsTypes, clients } from './sockets.mjs';

let roomMain;
const playerRoomMap = {};
const finalPlayers = [];
const finalPlayersName = [];
let playersName = {};

export function setupTournamentEvents(io, socket, padsMap) {
    socket.on('match-finished', (data) => {
        const winnerId = data.playerWinner;
        finalPlayers.push(winnerId);
        finalPlayersName.push(data.playerName);
        // console.log(`Match terminé dans la room: ${data.room}. Gagnant: ${data.playerName}. Type de room: ${data.roomType}`);

        if (data.roomType === "semi-tournament" && finalPlayers.length === 2) {
            // console.log('Les 2 finalistes sont :', finalPlayersName);
            io.to(roomMain).emit('update tournament', finalPlayersName);
            finalGame(io, rooms, finalPlayers, padsMap);
        } 
        else if (finalPlayers.length === 1 && data.roomType === "final-tournament") {
            // console.log(`Le gagnant final est : ${playersName[data.room][0]}`);
            io.to(roomMain).emit('update tournament', finalPlayersName);
            finalPlayers.length = 0;
            finalPlayersName.length = 0;
            
            for (const room in rooms) {
                if (room !== roomMain) {
                    delete rooms[room];
                    delete roomsTypes[room];
                    keysPressedMap.delete(room);
                    padsMap.delete(room);
                }
            }
        }

        if (rooms[data.room] && data.room !== roomMain) {
            delete rooms[data.room];
            delete roomsTypes[data.room];
            keysPressedMap.delete(data.room);
            padsMap.delete(data.room);
            // console.log(`Room ${data.room} a été supprimée`);
        }        
    });

    socket.on('padMove', (data) => {
        const room = playerRoomMap[socket.id];
        if (!room) return;

        const roomKeysPressed = keysPressedMap.get(room) || {
            pad1MoveUp: false,
            pad1MoveDown: false,
            pad2MoveUp: false,
            pad2MoveDown: false,
        };

        if (data.pad === 1) {
            roomKeysPressed.pad1MoveUp = data.direction === 'up' ? data.moving : roomKeysPressed.pad1MoveUp;
            roomKeysPressed.pad1MoveDown = data.direction === 'down' ? data.moving : roomKeysPressed.pad1MoveDown;
        } else if (data.pad === 2) {
            roomKeysPressed.pad2MoveUp = data.direction === 'up' ? data.moving : roomKeysPressed.pad2MoveUp;
            roomKeysPressed.pad2MoveDown = data.direction === 'down' ? data.moving : roomKeysPressed.pad2MoveDown;
        }

        keysPressedMap.set(room, roomKeysPressed);
    });

    socket.on('create-tournament', () => {
        const roomName = `${clients.get(socket.id).getName()}'s tournament`;
        const room = findOrCreateRoom('tournament', roomName);
        rooms[room] = [socket.id];
        roomsTypes[room] = "tournament";
        playerRoomMap[socket.id] = room;
        playersName[room] = [clients.get(socket.id).getName()];
        socket.join(room);

        // console.log(`Player ${clients.get(socket.id).getName()} created ${room}`);
        socket.emit('tournament-created');
        socket.emit('tournament-updated', { room: playersName[room] });
        updateTournamentList(io, rooms, roomsTypes);

        if (room && rooms[room].length === 4) {
            createQuarterRooms(io, socket, room, roomsTypes, padsMap);
        }
    });

    socket.on('join-tournament', (data) => {
        const { roomName } = data;
        let room = rooms[roomName] ? roomName : null;

        if (room && rooms[room].length < 4) {
            rooms[room].push(socket.id);
            playerRoomMap[socket.id] = room;
            playersName[room].push(clients.get(socket.id).getName());
            socket.join(room);
            // console.log(`Player ${clients.get(socket.id).getName()} joined ${room}`);
            io.to(room).emit('tournament-updated', { room: playersName[room] });
        }

        if (room && rooms[room].length === 4) {
            createQuarterRooms(io, socket, room, roomsTypes, padsMap);
        }
    });

    socket.on('quit-tournament', (data) => {
        const room = findRoomForSocket(socket.id, rooms);

        if (room) {
            const index = rooms[room].indexOf(socket.id);
            if (index !== -1)
                rooms[room].splice(index, 1);
            delete playerRoomMap[socket.id];
            playersName[room] = playersName[room].filter(name => name !== clients.get(socket.id).getName());
            socket.leave(room);

            if (!data && rooms[room].length > 0) {
                io.to(room).emit('tournament-updated', { room: playersName[room] });
            }

            if (rooms[room].length === 0) {
                delete rooms[room];
                delete roomsTypes[room];
                delete playersName[room];
                roomMain = null;
                updateTournamentList(io, rooms, roomsTypes);
            }
        }
    });

    socket.on('return-list', () => {
        updateTournamentList(io, rooms, roomsTypes);
    });
}

function updateTournamentList(io, rooms, roomsTypes) {
    const tournamentList = Object.keys(rooms).filter(room => roomsTypes[room] === 'tournament');
    io.emit('tournament-list', tournamentList);
}

function createQuarterRooms(io, socket, mainRoom, roomsTypes, padsMap) {
    const players = [...rooms[mainRoom]];
    const quarterRooms = [];
    roomMain = mainRoom;

    for (let i = 0; i < 2; i++) {
        const quarterRoom = `${mainRoom}-quarter-${i + 1}`;
        rooms[quarterRoom] = [players[i * 2], players[i * 2 + 1]];
        roomsTypes[quarterRoom] = "semi-tournament";
        playersName[quarterRoom] = [playersName[mainRoom][i * 2], playersName[mainRoom][i * 2 + 1]];
        quarterRooms.push(quarterRoom);

        keysPressedMap.set(quarterRoom, {
            pad1MoveUp: false,
            pad1MoveDown: false,
            pad2MoveUp: false,
            pad2MoveDown: false,
        });
        
        for (const playerId of rooms[quarterRoom]) {
            const playerSocket = io.sockets.sockets.get(playerId);
            if (playerSocket) {
                playerSocket.join(quarterRoom);
                playerRoomMap[playerId] = quarterRoom;
            }
        }

        // console.log(`Players ${playersName[quarterRoom].join(' et ')} joined room: ${quarterRoom}`);
    }

    io.to(mainRoom).emit('tournament-started', { quarterRooms });
    startQuarterMatch(0, socket);
    startQuarterMatch(1, socket);

    function startQuarterMatch(index, socket) {
        if (index >= quarterRooms.length) return;

        const quarterRoom = quarterRooms[index];
        const names = playersName[quarterRoom];
        const opponentMessage = `${names[0]} vs ${names[1]}`;
    
        io.in(quarterRoom).emit('match-info', { message: opponentMessage, countdown: 5 });

        setTimeout(() => {
            const pad1 = new Pad(0xc4d418, 0.045, 0.50, 16, -2.13, 3.59, 0);
            const pad2 = new Pad(0xb3261a, 0.045, 0.50, 16, 2.10, 3.59, 0);
            const ball = new Ball(0.07, 32);
    
            io.in(quarterRoom).emit('start-game', rooms[quarterRoom]);

            setupMultiGame(io, socket, rooms[quarterRoom], quarterRoom, ball, pad1, pad2, keysPressedMap.get(quarterRoom), "semi-tournament");
        }, 5000);
    }
}

function finalGame(io, rooms, finalPlayers, padsMap) {
    const finalRoom = `${roomMain}-final`;
    rooms[finalRoom] = [finalPlayers[0], finalPlayers[1]];
    roomsTypes[finalRoom] = "final-tournament";
    playersName[finalRoom] = [clients.get(finalPlayers[0]).getName(), clients.get(finalPlayers[1]).getName()];
    const allPlayers = rooms[roomMain];

    keysPressedMap.set(finalRoom, {
        pad1MoveUp: false,
        pad1MoveDown: false,
        pad2MoveUp: false,
        pad2MoveDown: false,
    });

    for (const playerId of rooms[finalRoom]) {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
            playerSocket.join(finalRoom);
            playerRoomMap[playerId] = finalRoom;
        }
    }

    const spectators = allPlayers.filter(playerId => !finalPlayers.includes(playerId));
    for (const spectatorId of spectators) {
        const spectatorSocket = io.sockets.sockets.get(spectatorId);
        if (spectatorSocket) {
            spectatorSocket.join(finalRoom);
        }
    }

    finalPlayers.length = 0;
    finalPlayersName.length = 0;

    // console.log(`Players ${playersName[finalRoom].join(' et ')} joined the final room: ${finalRoom}`);

    const opponentMessage = `Finale : ${playersName[finalRoom][0]} vs ${playersName[finalRoom][1]}`;
    io.in(finalRoom).emit('match-info', { message: opponentMessage, countdown: 5 });

    setTimeout(() => {
        const pad1 = new Pad(0xc4d418, 0.045, 0.50, 16, -2.13, 3.59, 0);
        const pad2 = new Pad(0xb3261a, 0.045, 0.50, 16, 2.10, 3.59, 0);
        const ball = new Ball(0.07, 32);

        io.in(finalRoom).emit('start-game', rooms[finalRoom]);

        setupMultiGame(io, null, rooms[finalRoom], finalRoom, ball, pad1, pad2, keysPressedMap.get(finalRoom), "final-tournament");
    }, 5000);
}
