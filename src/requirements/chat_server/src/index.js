const express = require('express');
const https = require('https');
const socketIo = require('socket.io');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');

const userConnections = new Map();
const userTokens = new Map();

const options = {
    key: fs.readFileSync('/app/ssl_certificates/chat_server.key'),
    cert: fs.readFileSync('/app/ssl_certificates/chat_server.crt'),
};

const app = express();
const server = https.createServer(options, app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Fonction pour formater la date
function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `[${day}/${month}/${year} ${hours}:${minutes}:${seconds}]`;
}

// Utiliser le middleware CORS
app.use(cors());

app.get('/', (req, res) => {
    res.send('Socket.io server is running');
});

const users = new Map();

io.on('connection', (socket) => {
    // console.log('Un utilisateur s\'est connecté:', socket.id);

    socket.on('register', (data) => {
        const { username, token } = data;
        if (username) {
            const existingConnection = userConnections.get(username);
            if (existingConnection && existingConnection.socketId !== socket.id) {
                const existingSocket = io.sockets.sockets.get(existingConnection.socketId);
                if (existingSocket) {
                    // console.log(`${formatDate(new Date())} Forçage de la déconnexion de l'ancienne session pour ${username}`);
                    existingSocket.emit('force_disconnect', {
                        message: 'Your account has been connected from another location'
                    });
                    existingSocket.disconnect(true);
                }
            }

            userTokens.set(username, token);
            userConnections.set(username, { socketId: socket.id, lastActivity: Date.now() });
            socket.username = username;
            users.set(username, socket.id);
            // console.log(`${formatDate(new Date())} Utilisateur enregistré: ${username}`);

            socket.emit('registration_success', {
                message: 'Successfully connected to chat server'
            });
        } else {
            console.error(`${formatDate(new Date())} Tentative d'enregistrement avec un nom d'utilisateur invalide`);
        }
    });

    socket.on('chat message', (msg) => {
        // console.log(`${formatDate(new Date())} Message reçu de ${msg.name}: ${msg.message}`);
        io.emit('chat message', msg);
        updateLastActivity(msg.name);
    });

    socket.on('private message', ({ to, message }) => {
        // console.log(`${formatDate(new Date())} Message privé de ${socket.displayName} à ${to}: ${message}`);
        const recipientSocketId = users.get(to);
        if (recipientSocketId) {
            // Send the message to the recipient and the sender
            io.to(recipientSocketId).emit('private message', {
                from: socket.username,
                message: message,
                time: Date.now()
            });
 
            // Send a confirmation to the sender
            socket.emit('private message', {
                from: socket.username,
                message: message,
                time: Date.now(),
                isSelf: true
            });
 
            // console.log(`${formatDate(new Date())} Message privé envoyé à ${to} via socket ${recipientSocketId}`);
        } else {
            socket.emit('error', { message: `${to} n'est pas en ligne.` });
            // console.log(`${formatDate(new Date())} Tentative d'envoi à ${to} mais l'utilisateur n'est pas en ligne.`);
        }
        updateLastActivity(socket.username);
    });

    // Gestion des erreurs globales
    socket.on('error', (data) => {
        console.error('Erreur serveur:', data.message);
    });

    socket.on('disconnect', async () => {
        // console.log(`${formatDate(new Date())} Un utilisateur s'est déconnecté: ${socket.id}`);
        const username = [...userConnections.entries()].find(([_, value]) => value.socketId === socket.id)?.[0];
        if (username) {
            userConnections.delete(username);
            users.delete(username);
            // console.log(`${formatDate(new Date())} Mise à jour du statut de ${username} à offline`);
            updateOnlineStatus(username, false);
        }
        updateLastActivity(socket.username);
    });

    socket.on('friend_request', (data) => {
        // console.log(`${formatDate(new Date())} Friend request from ${data.from} to ${data.to}`);
        const recipientSocketId = users.get(data.to);
        
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('friend_request_received', {
                from: data.from,
                requestId: data.requestId
            });
            // console.log(`${formatDate(new Date())} Friend request sent to socket ${recipientSocketId}`);
        } else {
            // console.log(`${formatDate(new Date())} User ${data.to} is not online`);
        }
    });

    socket.on('friend_request_response', (data) => {
        // console.log(`${formatDate(new Date())} Friend request response from ${data.to} to ${data.from}: ${data.response}`);
        const senderSocketId = users.get(data.from);
        
        if (senderSocketId) {
            io.to(senderSocketId).emit('friend_request_updated', {
                from: data.to,
                response: data.response,
                requestId: data.requestId
            });
            // console.log(`${formatDate(new Date())} Response sent to socket ${senderSocketId}`);
        } else {
            // console.log(`${formatDate(new Date())} User ${data.from} is not online`);
        }
    });
});

function updateLastActivity(username) {
    if (userConnections.has(username)) {
        userConnections.get(username).lastActivity = Date.now();
    }
}

server.listen(443, () => {
    // console.log(`${formatDate(new Date())} Serveur en écoute sur le port 443`);
});

const httpsAgent = new https.Agent({
    cert: fs.readFileSync('/app/ssl_certificates/chat_server.crt'),
    key: fs.readFileSync('/app/ssl_certificates/chat_server.key'),
    rejectUnauthorized: false
});

async function updateOnlineStatus(username, isOnline) {
    if (!username) {
        // console.log(`${formatDate(new Date())} Error: Missing username for status update`);
        return;
    }

    const token = userTokens.get(username);
    if (!token) {
        // console.log(`${formatDate(new Date())} Error: Missing token for user ${username}`);
        return;
    }

    try {
        // console.log(`${formatDate(new Date())} Updating status for ${username}: ${isOnline ? 'online' : 'offline'}`);
        const response = await fetch('https://django:443/api/update-online-status/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                is_online: isOnline,
                display_name: username
            }),
            agent: httpsAgent
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

    } catch (error) {
        console.error(`${formatDate(new Date())} Error updating status for ${username}:`, error.message);
    }
}