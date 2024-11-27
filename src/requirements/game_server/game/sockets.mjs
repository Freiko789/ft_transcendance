import { Ball } from './ball.mjs';
import { Pad } from './pad.mjs';
import { setupSoloGame, setupMultiGame, setupMultiGameFour} from './game.mjs';
import { setupTournamentEvents } from './tournament.mjs';
import { findRoomForSocket, findOrCreateRoom } from './socketUtils.mjs';
import { Client } from './client.mjs'


export const rooms = {};
export const roomsTypes = {};
const padsMap = new Map();
export const keysPressedMap = new Map();
export const clients = new Map();
const roomTeams = new Map();

export default function setupSockets(io) {
    io.on('connection', (socket) => {
        // console.log('Nouvel utilisateur connecté :', socket.id);


        socket.on('username', (data) => {
            // console.log('username :', data.username);
            // console.log('token :', data.token);
            // console.log('avatar :', data.avatar);
            const client = new Client(socket, socket.id, data.username, data.token);
            clients.set(socket.id, client);

        

        socket.on('disconnect', () => {
            // console.log('Utilisateur déconnecté :', client.getName());

            clients.delete(socket.id);

            for (let room in rooms) {
                if (rooms[room].includes(socket.id)) {
                    rooms[room] = rooms[room].filter(id => id !== socket.id);
                    // console.log(`Le joueur ${socket.id} a quitté ${room} de type ${roomsTypes[room]}`);

                    if (rooms[room].length === 0 || (roomsTypes[room] === 'multi-2-online'
                        && rooms[room].length === 0) || (roomsTypes[room] === 'multi-four'
                            && rooms[room].length === 0)) {
                        io.in(room).socketsLeave(room);
                        delete rooms[room];
                        delete roomsTypes[room];
                        padsMap.delete(room);
                        keysPressedMap.delete(room);
                        roomTeams.delete(room);
                        // console.log(`La salle ${room} a été supprimée`);
                    } else if (rooms[room].length === 1 && roomsTypes[room] === 'multi-2-online') {
                        const winner = clients.get(rooms[room][0]).getName();
                        io.to(rooms[room][0]).emit('gameOver', { winner: winner });
                    } else if (roomsTypes[room] === 'semi-tournament' || roomsTypes[room] === 'final-tournament') {
                        const winner = clients.get(rooms[room][0]).getName();
                        io.to(rooms[room]).emit('matchOver', { winner: winner, roomName: room, roomType: roomsTypes[room]});
                        // console.log('matchOver bien envoyé');
                    } else if (rooms[room].length > 0 && roomsTypes[room] === 'multi-four') {
                        let winningTeam;
                            if (roomTeams.get(room) !== null){
                                const teams = roomTeams.get(room);
                            if (teams.team1[0] !== null || teams.team1[1] !== null) 
                                if (teams.team1[0] === socket.id || teams.team1[1] === socket.id) {
                                    winningTeam = [clients.get(teams.team2[0]).getName(), clients.get(teams.team2[1]).getName()];
                            } else if (teams.team2[0] !== null && teams.team2[1] !== null)
                                if (teams.team2[0] === socket.id || teams.team2[1] === socket.id) {
                                    winningTeam = [clients.get(teams.team1[0]).getName(), clients.get(teams.team1[1]).getName()];
                            }
                            if (winningTeam) {
                                io.to(room).emit('gameOver', { winner: winningTeam, roomType: roomsTypes[room]});
                            } else {
                                console.error(`Impossible de déterminer l'équipe gagnante pour la salle ${room}`);
                            }

                            }
        
                    }

                    //break;
                }
            }
        });

        socket.on('lobby ready', () => {
            socket.emit('lobby');
            client.setReady();
        });

        socket.on('padMove', (data) => {
            const room = findRoomForSocket(socket.id, rooms);
            if (!room) return;

            const roomKeysPressed = keysPressedMap.get(room) || {
                pad1MoveUp: false,
                pad1MoveDown: false,
                pad2MoveUp: false,
                pad2MoveDown: false,
                pad3MoveUp: false,
                pad3MoveDown: false,
                pad4MoveUp: false,
                pad4MoveDown: false,
            };

            if (data.pad === 1) {
                roomKeysPressed.pad1MoveUp = data.direction === 'up' ? data.moving : roomKeysPressed.pad1MoveUp;
                roomKeysPressed.pad1MoveDown = data.direction === 'down' ? data.moving : roomKeysPressed.pad1MoveDown;
            } else if (data.pad === 2) {
                roomKeysPressed.pad2MoveUp = data.direction === 'up' ? data.moving : roomKeysPressed.pad2MoveUp;
                roomKeysPressed.pad2MoveDown = data.direction === 'down' ? data.moving : roomKeysPressed.pad2MoveDown;
            } else if (data.pad === 3) {
                roomKeysPressed.pad3MoveUp = data.direction === 'up' ? data.moving : roomKeysPressed.pad3MoveUp;
                roomKeysPressed.pad3MoveDown = data.direction === 'down' ? data.moving : roomKeysPressed.pad3MoveDown;
            } else if (data.pad === 4) {
                roomKeysPressed.pad4MoveUp = data.direction === 'up' ? data.moving : roomKeysPressed.pad4MoveUp;
                roomKeysPressed.pad4MoveDown = data.direction === 'down' ? data.moving : roomKeysPressed.pad4MoveDown;
            }

            keysPressedMap.set(room, roomKeysPressed);
        });

        socket.on('endGame', () => {
            const room = findRoomForSocket(socket.id, rooms);
            if (room) {
                io.in(room).emit('gameEnded');
        
                io.in(room).socketsLeave(room);

                rooms[room].forEach((socketId) => {
                    const client = clients.get(socketId);
                    if (client) {
                        client.delRoom(room);
                    }
                });
        
                delete rooms[room];
                delete roomsTypes[room];
                padsMap.delete(room);
                keysPressedMap.delete(room);
        
                // console.log(`La salle ${room} a été supprimée`);
            }
            else {
                io.in(room).emit('gameEnded');
            }
        });

        socket.on('solo_vs_ia', () => {
            if (client.getRoom() === null){
                let room = findOrCreateRoom('solo_vs_ia');
                rooms[room].push(socket.id);
                roomsTypes[room] = 'solo_vs_ia';
                socket.join(room);
    
                client.setRoom(room);
    
                keysPressedMap.set(room, {
                    pad1MoveUp: false,
                    pad1MoveDown: false,
                });
    
                io.in(room).emit('start-game', rooms[room], roomsTypes[room]);
                // console.log(`Démarrage du jeu dans ${room}`);
    
                setupSoloGame(io, rooms[room], room, socket, rooms, roomsTypes[room], keysPressedMap.get(room));
            }
        });

        socket.on('multi-2-local', () => {
            if (client.getRoom() === null){
                let room = findOrCreateRoom('multi-2-local');
                rooms[room].push(socket.id);
                roomsTypes[room] = 'multi-2-local';
                socket.join(room);
    
                client.setRoom(room);
    
                keysPressedMap.set(room, {
                    pad1MoveUp: false,
                    pad1MoveDown: false,
                    pad2MoveUp: false,
                    pad2MoveDown: false,
                });
    
                io.in(room).emit('start-game', rooms[room], roomsTypes[room]);
                // console.log(`Démarrage du jeu dans ${room}`);
    
                setupSoloGame(io, rooms[room], room, socket, rooms, roomsTypes[room], keysPressedMap.get(room));
            }
        });

        socket.on('invite', (data) => {
            let to = findClientByUsername(data.to);
            let from = findClientByUsername(data.from)
            if (to !== null && to.getRoom() === null && to.getReady() === true && from !== null && from.getReady() === true){
                io.to(to.getSocketId()).emit('invite', { from: data.from, to: data.to });
            }
            else if (to !== null){
                io.to(socket.id).emit('not-ready', {from: to.getName()});
            }
            // console.log(to);
        })

        socket.on('accept', (data) => {
            let from = findClientByUsername(data.from);
            if (client.getRoom() === null && from.getRoom() === null) {
                let room = findOrCreateRoom(`private game ${client.getName()}`);
                rooms[room].push(socket.id);
                rooms[room].push(from.getSocketId());
                roomsTypes[room] = 'multi-2-online';
                socket.join(room);
                from.getSocket().join(room);
                const pad1 = new Pad(0xc4d418, 0.045, 0.50, 16, -2.13, 3.59, 0);
                const pad2 = new Pad(0xb3261a, 0.045, 0.50, 16, 2.10, 3.59, 0);
                padsMap.set(room, { pad1, pad2 });
                client.setRoom(room);
                from.setRoom(room);
                // console.log(rooms[room]);
    
                if (rooms[room].length === 2) {
                    io.in(room).emit('start-game', rooms[room]);
                    // console.log(`Démarrage du jeu dans ${room}`);
                    
                    keysPressedMap.set(room, {
                        pad1MoveUp: false,
                        pad1MoveDown: false,
                        pad2MoveUp: false,
                        pad2MoveDown: false,
                    });
    
                    const ball = new Ball(0.07, 32);
                    const { pad1, pad2 } = padsMap.get(room);
    
                    io.in(room).emit('initBall', {
                        position: { x: ball.mesh.position.x, z: ball.mesh.position.z },
                        direction: { x: ball.direction.x, z: ball.direction.z },
                        speed: ball.speed,
                    });
    
                    setupMultiGame(io, socket, rooms[room], room, ball, pad1, pad2, keysPressedMap.get(room), roomsTypes);
                }
            }
        })

        socket.on('refuse', (data) => {
            let from = findClientByUsername(data.from);
            io.to(from.getSocketId()).emit('refuse-invit', {to: data.to});
        })

        socket.on('cancel', () => {
            const room = client.getRoom();
            client.delRoom(room);
            socket.leave(room);
            const index = rooms[room].indexOf(socket.id);
            if (index !== -1)
                rooms[room].splice(index, 1);
            if (rooms[room].length == 0){
                delete rooms[room];
                delete roomsTypes[room];
            }
            // console.log('Room actuel du joueur : ', client.getRoom());
            // console.log(rooms);
        })

        socket.on('multi-2-online', () => {
            if (client.getRoom() === null) {

                let room = findOrCreateRoom('multi-2-online');
                rooms[room].push(socket.id);
                roomsTypes[room] = 'multi-2-online';
                socket.join(room);
    
                if (rooms[room].length === 1) {
                    const pad1 = new Pad(0xc4d418, 0.045, 0.50, 16, -2.13, 3.59, 0);
                    const pad2 = new Pad(0xb3261a, 0.045, 0.50, 16, 2.10, 3.59, 0);
                    padsMap.set(room, { pad1, pad2 });
    
                }
    
                client.setRoom(room);
                
                // console.log(`Joueur ${socket.id} a rejoint ${room}`);
                
                if (rooms[room].length === 2) {
                    io.in(room).emit('start-game', rooms[room]);
                    // console.log(`Démarrage du jeu dans ${room}`);
                    
                    keysPressedMap.set(room, {
                        pad1MoveUp: false,
                        pad1MoveDown: false,
                        pad2MoveUp: false,
                        pad2MoveDown: false,
                    });
    
                    const ball = new Ball(0.07, 32);
                    const { pad1, pad2 } = padsMap.get(room);
    
                    io.in(room).emit('initBall', {
                        position: { x: ball.mesh.position.x, z: ball.mesh.position.z },
                        direction: { x: ball.direction.x, z: ball.direction.z },
                        speed: ball.speed,
                    });
    
                    setupMultiGame(io, socket, rooms[room], room, ball, pad1, pad2, keysPressedMap.get(room), roomsTypes);
                }
            }
        });

        socket.on('multi-four', () => {
            if (client.getRoom() === null) {

                let room = findOrCreateRoom('multi-four');
                rooms[room].push(socket.id);
                socket.join(room);
    
                if (rooms[room].length === 1) {
                    const pad1 = new Pad(0xc4d418, 0.045, 0.50, 16, -2.13, 3.59, 0);
                    const pad2 = new Pad(0xfa00ff, 0.045, 0.50, 16, 2.10, 3.59, 0);
                    const pad3 = new Pad(0xfa00ff, 0.045, 0.50, 16, -0.5, 3.59, 0);
                    const pad4 = new Pad(0xfa00ff, 0.045, 0.50, 16, 0.5, 3.59, 0);
                    padsMap.set(room, { pad1, pad2, pad3, pad4 });
    
                }
                
                client.setRoom(room);
    
                // console.log(`Joueur ${socket.id} a rejoint ${room}`);
                
                if (rooms[room].length === 4) {
                    roomTeams.set(room, {
                        team1: [rooms[room][0], rooms[room][2]],
                        team2: [rooms[room][1], rooms[room][3]]
                    });
                    io.in(room).emit('start-game', rooms[room], roomsTypes[room]);
                    // console.log(`Démarrage du jeu dans ${room}`);
                    
                    keysPressedMap.set(room, {
                        pad1MoveUp: false,
                        pad1MoveDown: false,
                        pad2MoveUp: false,
                        pad2MoveDown: false,
                        pad3MoveUp: false,
                        pad3MoveDown: false,
                        pad4MoveUp: false,
                        pad4MoveDown: false,
                    });
    
                    const ball = new Ball(0.07, 32);
                    const { pad1, pad2, pad3, pad4 } = padsMap.get(room);
    
                    io.in(room).emit('initBall', {
                        position: { x: ball.mesh.position.x, z: ball.mesh.position.z },
                        direction: { x: ball.direction.x, z: ball.direction.z },
                        speed: ball.speed,
                    });
    
                    setupMultiGameFour(io, room, ball, pad1, pad2, pad3, pad4, keysPressedMap.get(room), rooms[room], roomTeams);
                }
            }
        });

        /*socket.on('update_win_loose', (data) => {
            updateUserStats(clients.get(socket.id).getName(), clients.get(socket.id).getToken(), data);
        });*/

        // Tournoi
        setupTournamentEvents(io, socket, padsMap);
    });
    });
    
    function findClientByUsername(username) {
        for (const client of clients.values()) {
            if (client.getName() === username) {
                return client;
            }
        }
        return null;
    }

}
