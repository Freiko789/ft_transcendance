import { rooms, roomsTypes } from './sockets.mjs'

let roomCounter = 1;

export function findOrCreateRoom(type, name = null) {
    let room = null;
    let maxPlayers;

    if (type === 'tournament') {
        maxPlayers = 4;
    } else if (type === 'multi-four') {
        maxPlayers = 4;
    } else if (type === 'multi-2-online') {
        maxPlayers = 2;
    }

    if (type === 'tournament' && name) {
        for (const r in rooms) {
            if (roomsTypes[r] === type && r === name && rooms[r].length < maxPlayers) {
                room = r;
                break;
            }
        }
    } else {
        for (const r in rooms) {
            if (roomsTypes[r] === type && rooms[r].length < maxPlayers) {
                room = r;
                break;
            }
        }
    }

    if (!room) {
        if (type === 'tournament' && name) {
            room = name;
        } else {
            room = `room-${roomCounter++}`;
        }
        rooms[room] = [];
        roomsTypes[room] = type;
    }

    return room;
}


export function findRoomForSocket(client, roomsid) {
    for (const room in roomsid) {
        if (roomsid[room].includes(client)) {
            return room;
        }
    }
    return null;
}
