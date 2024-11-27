import { navigateTo } from '../app.js';
import { getCookie } from '../views/settingsv.js';
import { removeDashboardEventListeners } from '../views/dashboard.js';
// Déclarez une variable globale pour stocker la référence au socket
let globalSocket;

// Fonction pour définir le socket global
export function setGlobalSocket(socket) {
    globalSocket = socket;
}

function refreshToken() {
    return fetch('/api/token/refresh/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            refresh: sessionStorage.getItem('refreshToken')
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.access) {
            sessionStorage.setItem('accessToken', data.access);
            return true;
        } else {
            return false;
        }
    })
    .catch(() => false);
}

export async function getCsrfToken() {
    const response = await fetch('/api/set-csrf-token/', {
        method: 'GET',
        credentials: 'include',
    });
    if (response.ok) {
        const data = await response.json();
        return data.csrfToken;
    }
    throw new Error('Failed to get CSRF token');
}

export function generateToken() {
    return fetch('/api/token/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: 'admin',
            password: 'admin',
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.access && data.refresh) {
            sessionStorage.setItem('accessToken', data.access);
            sessionStorage.setItem('refreshToken', data.refresh);
            return true;
        } else {
            return false;
        }
    })
    .catch(() => false);
}

export async function logout() {
    removeDashboardEventListeners();
    
    if (globalSocket && globalSocket.connected) {
        globalSocket.disconnect();
        // console.log('Utilisateur déconnecté du socket');
    }

    const accessToken = sessionStorage.getItem('accessToken');
    if (accessToken) {
        try {
            await fetch('/api/update-online-status/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ is_online: false }),
            });
        } catch (error) {
            console.error('Erreur lors de la mise à jour du statut en ligne:', error);
        }
    }

    sessionStorage.clear();
    document.cookie = '';
    
    navigateTo('/login');
}

export async function refreshAccessToken() {
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (!refreshToken) {
        // console.log('Aucun refresh token disponible.');
        logout();
        return false;
    }

    try {
        const response = await fetch('/api/token/refresh/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh: refreshToken }),
        });

        const data = await response.json();
        if (data.access) {
            sessionStorage.setItem('accessToken', data.access);
            return true;
        } else {
            logout();
            return false;
        }
    } catch (error) {
        console.error('Erreur lors du rafraîchissement du token :', error);
        logout();
        return false;
    }
}

setInterval(refreshAccessToken, 50 * 60 * 1000);
