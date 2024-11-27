import { fetchWithToken } from './api.js';
import { fetchAndDisplayFriends } from '../views/dashboard.js';
import { showToast } from './unmask.js';
import { acceptFriendRequest, rejectFriendRequest } from '../utils/friendManager.js';
import { logout } from '../utils/token.js';

let sockets = new Map();
let activityTimers = new Map();

export function initializeSocket(displayName) {

    cleanupAllSockets();

    const existingSocket = sockets.get(displayName);
    if (existingSocket && existingSocket.connected) {
        // console.log(`Socket existant trouvé pour ${displayName}`);
        return existingSocket;
    }

    disconnectSocket(displayName);

    const token = sessionStorage.getItem('accessToken');
    if (!displayName || !token) {
        console.error('Nom d\'utilisateur ou token non trouvé');
        return null;
    }

    const socket = io('https://c1r4p6.42nice.fr:8080', {
        transports: ['websocket'],
        path: '/c_socket.io',
        query: {
            username: displayName,
            token: token
        },
        reconnection: false
    });

    socket.displayName = displayName;

    socket.on('connect', () => {
        // console.log(`Connected to chat server for ${displayName}`);
        // console.log(`Socket ID: ${socket.id}`);
        socket.emit('register', {
            username: displayName,
            token: token
        });
        updateOnlineStatus(displayName, true);
        resetActivityTimer(displayName);
    });

    socket.on('disconnect', () => {
        // console.log(`Disconnected from chat server for ${displayName}`);
        sockets.delete(displayName);
        clearActivityTimer(displayName);
    });

    socket.on('connect_error', (error) => {
        console.error(`Connection error for ${displayName}:`, error);
    });

    socket.on('friend_request_updated', (data) => {
        // console.log('Friend request updated:', data);
        const message = data.response === 'accepted'
            ? `${data.from} a accepté votre demande d'ami!`
            : `${data.from} a refusé votre demande d'ami.`;
        showToast(message, data.response === 'accepted' ? 'success' : 'info');
        fetchAndDisplayFriends(); // Rafraîchir la liste des amis
    });

    socket.on('session_expired', (data) => {
        // console.log('Session expirée:', data.message);
        showToast(data.message, 'warning');
        disconnectSocket(displayName);
        logout();
    });

    socket.on('force_disconnect', (data) => {
        // console.log('Forced disconnect:', data.message);
        showToast(data.message, 'warning');
        disconnectSocket(displayName);
        logout();
    });

    sockets.set(displayName, socket);
    // console.log(`Socket: ${socket.id} linked to ${displayName}`);
    // resetActivityTimer(displayName);
    return socket;
}

function resetActivityTimer(username) {
    clearActivityTimer(username);
    activityTimers.set(username, setTimeout(async () => {
        // console.log(`Inactivité détectée pour ${username}`);
        await updateOnlineStatus(username, false);
        disconnectSocket(username);
    }, 600000)); //10 minutes in milliseconds (600000)
}

function clearActivityTimer(username) {
    if (activityTimers.has(username)) {
        clearTimeout(activityTimers.get(username));
        activityTimers.delete(username);
    }
}

export async function updateOnlineStatus(username, isOnline) {
    try {
        const response = await fetchWithToken('/api/update-online-status/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                is_online: isOnline,
                display_name: username
            }),
        });
        if (!response.ok) {
            throw new Error('Error updating online status');
        }
        // console.log(`Online status updated for ${username}: ${isOnline}`);
    } catch (error) {
        console.error('Error updating online status:', error);
    }
}

export function getSocket(username) {
    // resetActivityTimer(username);
    return sockets.get(username);
}

export function disconnectSocket(username) {
    const socket = sockets.get(username);
    if (socket) {
        socket.off('force_disconnect');
        socket.off('registration_success');
        socket.disconnect();
        sockets.delete(username);
        clearActivityTimer(username);
        updateOnlineStatus(username, false);
    }
}

export function sendFriendRequestSocket(to, requestId) {
    const username = sessionStorage.getItem('display_name');
    const socket = getSocket(username);
    if (socket) {
        socket.emit('friend_request', {
            from: username,
            to: to,
            requestId: requestId
        });
    }
}

export function sendFriendRequestResponse(to, response, requestId) {
    const username = sessionStorage.getItem('display_name');
    const socket = getSocket(username);
    if (socket) {
        socket.emit('friend_request_response', {
            from: to,
            to: username,
            response: response,
            requestId: requestId
        });
    }
}

function showFriendRequestToast(fromUsername, requestId) {
    const toastHtml = `
        <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header" style="background-color: #FFD700;">
                <strong class="me-auto" style="color: #ff5722; background-color: white;">Friend Request</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                <p>Friend request received from ${fromUsername}</p>
                <button class="btn btn-primary" onclick="acceptFriendRequest('${requestId}')">Accept</button>
                <button class="btn btn-secondary" onclick="rejectFriendRequest('${requestId}')">Reject</button>
            </div>
        </div>
    `;
    document.body.innerHTML += toastHtml;
}

export function isSocketConnected(displayName) {
    const socket = sockets.get(displayName);
    return socket && socket.connected;
}

export function handleDashboardPresence(username) {
    // updateOnlineStatus(username, true);
    // resetActivityTimer(username);

    const activityEvents = ['mousedown', 'keydown', 'mousemove', 'touchstart'];

    activityEvents.forEach(eventType => {
        document.addEventListener(eventType, () => {
            resetActivityTimer(username);
        });
    });

    window.addEventListener('beforeunload', () => {
        updateOnlineStatus(username, false);
        disconnectSocket(username);
    });
}

export function cleanupAllSockets() {
    // console.log('Cleaning up all sockets...');
    for (let [username, socket] of sockets) {
        // console.log(`Cleaning up socket for ${username}`);
        if (socket) {
            socket.off('chat message');
            socket.off('private message');
            socket.off('friend_request_received');
            socket.off('friend_request_updated');
            socket.off('friend_status_change');
            socket.off('session_expired');
            socket.off('force_disconnect');
            socket.disconnect();
            updateOnlineStatus(username, false);
        }
    }
    sockets.clear();
    activityTimers.forEach((timer) => clearTimeout(timer));
    activityTimers.clear();
}
