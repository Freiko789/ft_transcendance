export class Client {
    constructor(socket, socketId, playerName, accessToken) {
        this.socket = socket;
        this.socketId = socketId;
        this.playerName = playerName;
        this.accessToken = accessToken;
        this.score = 0;
        this.room = null;
        this.initGame = false;
    }

    setReady(){
        this.initGame = true;
    }

    setRoom(room) {
        this.room = room;
    }

    delRoom(room) {
        if (this.room === room)
            this.room = null;
    }

    getReady(){
        return this.initGame;
    }

    getName() {
        return this.playerName;
    }

    getRoom() {
        return this.room;
    }

    getToken() {
        return this.accessToken;
    }
    
    resetScore() {
        this.score = 0;
    }

    incrementScore() {
        this.score++;
    }

    getSocket() {
        return this.socket;
    }

    getSocketId() {
        return this.socketId;
    }

    getPlayerName() {
        return this.playerName;
    }
}
