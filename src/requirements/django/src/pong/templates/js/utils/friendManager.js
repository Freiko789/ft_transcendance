import { fetchWithToken } from './api.js';
import { getSocket } from './socketManager.js';

export function fetchFriendList() {
    return fetchWithToken('/api/friends/')
        .then(response => response.json())
        .catch(error => {
            console.error('Erreur lors de la récupération de la liste d\'amis:', error);
            throw error;
        });
}

// Fonction pour envoyer une demande d'ami
export function sendFriendRequest(toUsername) {
    return fetchWithToken('/api/send-friend-request/', {
        method: 'POST',
        body: JSON.stringify({ to_username: toUsername })
    });
}

// Fonction pour récupérer les demandes d'ami en attente
export function fetchFriendRequests() {
    return fetchWithToken('/api/get-friend-requests/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data.friend_requests;
            } else {
                throw new Error(data.message || 'Erreur lors de la récupération des demandes d\'ami');
            }
        });
}

// Fonction pour accepter une demande d'ami
export function acceptFriendRequest(requestId) {
    return fetchWithToken('/api/accept-friend-request/', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // console.log('Demande d\'ami acceptée');
            // Émettre l'événement socket pour notifier l'expéditeur
            const socket = getSocket(sessionStorage.getItem('display_name'));
            if (socket) {
                socket.emit('friend_request_response', {
                    from: data.from_user,
                    to: data.to_user,
                    response: 'accepted',
                    requestId: requestId
                });
            }
            return data;
        } else {
            throw new Error(data.message || 'Erreur lors de l\'acceptation de la demande d\'ami');
        }
    });
}

// Fonction pour rejeter une demande d'ami
export function rejectFriendRequest(requestId) {
    return fetchWithToken('/api/reject-friend-request/', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // console.log('Demande d\'ami rejetée');
            // Émettre l'événement socket pour notifier l'expéditeur
            const socket = getSocket(sessionStorage.getItem('display_name'));
            if (socket) {
                socket.emit('friend_request_response', {
                    from: data.from_user,
                    to: data.to_user,
                    response: 'rejected',
                    requestId: requestId
                });
            }
            return data;
        } else {
            throw new Error(data.message || 'Erreur lors du rejet de la demande d\'ami');
        }
    });
}
