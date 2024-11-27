import { navigateTo } from '../app.js';
import { logout } from '../utils/token.js';
import { getSocket, initializeSocket, isSocketConnected } from '../utils/socketManager.js';
import { sendFriendRequest, fetchFriendRequests, acceptFriendRequest, rejectFriendRequest } from '../utils/friendManager.js';
import { getCookie } from './settingsv.js';
import { removeLoginEventListeners } from './login.js';
import { checkAuthentication } from '../utils/auth.js';
import { showToast } from '../utils/unmask.js';
import { checkFriendshipStatus } from './profile.js';
import { sendFriendRequestSocket } from '../utils/socketManager.js';

let socket;
const privateChatLogs = new Map();
const privateMessages = new Map();
let blockedUsers = new Set();
let activePrivateChat = null;

export async function dashboard(player_name) {
    const isAuthenticated = await checkAuthentication();
    if (!isAuthenticated) {
        navigateTo('/login');
        return;
    }

    removeLoginEventListeners();

    const displayName = sessionStorage.getItem('display_name');
    let avatarUrl = sessionStorage.getItem('avatar_url');

    let existingSocket = getSocket(displayName);
    if (!existingSocket || !existingSocket.connected) {
        socket = initializeSocket(displayName);
        if (socket) {
            setupChatListeners(socket);
        }
    }

    await loadBlockedUsers();

    if (!displayName) {
        navigateTo('/login');
        return;
    }

    if (avatarUrl) {
        avatarUrl = avatarUrl.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    }

    document.getElementById('ft_transcendence').innerHTML = `
    <div class="dashboard-container">
        <div class="header">
            <a class="navbar-brand" href="#">
                <img src="${staticUrl}content/logo2.png" id="pongonlineLink" alt="Logo" class="logo">
            </a>
            <span class="nav-item" style="font-size: 2.5em; font-weight: bold; color: #ff7043;">${displayName}</span>
            <div class="profile-container">
                <img src="${avatarUrl}" class="profile-icon" alt="Profile Picture" id="img_profile_pic" style="
    cursor: pointer;
">
            </div>
        </div>

        <div class="content">
            <div class="sidebar">
                <div class="friends-tabs">
                    <button class="tab-button active" data-tab="online">Friends</button>
                    <button class="tab-button" data-tab="pending">Pending Requests</button>
                    <button class="tab-button" data-tab="blocked">Blocked Users</button>
                </div>
                <div class="friends-content">
                    <div id="online" class="tab-content active">
                        <ul id="online-friends" class="list-group">
                        </ul>
                    </div>
                    <div id="pending" class="tab-content">
                        <ul id="pending-friends" class="list-group">
                        </ul>
                    </div>
                    <div id="blocked" class="tab-content">
                        <ul id="blocked-friends" class="list-group">
                        </ul>
                    </div>
                </div>
                <div id="friendDropdown" class="dropdown-menu" style="display: none;">
                    <a class="dropdown-item" href="#" id="sendMessagePrivate">Send Private Message</a>
                    <a class="dropdown-item" href="#" id="startGame">Start a Game</a>
                    <a class="dropdown-item" href="#" id="viewProfile">View Profile</a>
                </div>
                <div id="friendDropdown_chat" class="dropdown-menu_chat" style="display: none;">
                    <a class="dropdown-item" href="#" id="addToFriend">Add To Friend</a>
                    <a class="dropdown-item" href="#" id="blockUser">Block User</a>
                    <a class="dropdown-item" href="#" id="viewProfile">View Profile</a>
                </div>
            </div>

                <div class="game-container">
                    <iframe id="pong" title="Pong" src="https://c1r4p6.42nice.fr:8080/game_server"></iframe>
                </div>

            <div class="chat-container">
                <h2 class="title-chat">Chat</h2>
                <div class="chat-log" id="chat-log"></div>
                <div class="input-container">
                    <input id="message-input" placeholder="Type your message..." rows="1"></input>
                    <button id="send-button">►</button>
                </div>
            </div>
        </div>
        <div id="profileDropdown" class="dropdown-menu" style="display: none;">
            <a class="dropdown-item" href="#" id="viewmyProfile">My Profile</a>
            <a class="dropdown-item" href="#" id="settings">Settings</a>
            <a class="dropdown-item" href="#" id="logoutLink">Logout</a>
        </div>
        <div class="offcanvas offcanvas-end" data-bs-scroll="true" tabindex="-1" id="chatbox" aria-labelledby="chatboxLabel">
            <div class="offcanvas-header">
                <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
            </div>
            <div class="offcanvas-body">
                <div id="private-chats-container"></div>
            </div>
        </div>

        <div class="toast-container position-fixed bottom-0 end-0 p-3">
            <div id="blockUserToast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <strong class="me-auto">Block User</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    User blocked successfully!
                </div>
            </div>
        </div>

        <footer id="footer-dashboard">© 2024 42Company, Inc</footer>
    </div>`;
    const iframe = document.getElementById('pong');
    iframe.onload = function () {
        const displayName = sessionStorage.getItem('display_name');
        const token = sessionStorage.getItem('accessToken');
        const csrfToken = getCookie('csrftoken');
        // console.log(sessionStorage);
        const avatar = sessionStorage.getItem('avatar_url');
        iframe.contentWindow.postMessage({ username: displayName, token: token, csrfToken: csrfToken, avatar: avatar }, 'https://c1r4p6.42nice.fr:8080/game_server');
    };

	setupDashboardEvents(navigateTo, displayName);
	setupTabSystem();
    fetchAndDisplayFriends();
    loadGeneralChatMessages();
}

function setupChatListeners(socket) {
    if (socket) {
        const displayName = sessionStorage.getItem('display_name');
        // console.log('=== Setting up chat listeners ===');
        // console.log('Socket state:', {
        //     id: socket.id,
        //     connected: socket.connected,
        //     displayName: socket.displayName
        // });

        // Suppression des anciens écouteurs pour éviter les doublons
        socket.off('private message');
        socket.off('chat message');

        // Écoute des messages de chat général
        socket.on('chat message', (msg) => {
            receiveMessage(msg);
        });

        socket.on('private message', (msg) => {
            // console.log('Private message received:', msg);
            if (!msg.from || !msg.message) {
                console.error('Invalid message format:', msg);
                return;
            }

            const currentUser = sessionStorage.getItem('display_name');

            // Nouvelle logique pour déterminer le chatPartner
            let chatPartner;
            if (msg.isSelf) {
                chatPartner = activePrivateChat;
            } else {
                chatPartner = msg.from;
            }

            if (!chatPartner) {
                console.error('Cannot determine chat partner:', msg);
                return;
            }

            // console.log('Chat partner determined:', chatPartner);

            // S'assurer que le chat privé est configuré
            if (!privateChatLogs.has(chatPartner)) {
                setupPrivateChat(chatPartner);
            }

            // Stocker le message
            if (!privateMessages.has(chatPartner)) {
                privateMessages.set(chatPartner, []);
            }
            privateMessages.get(chatPartner).push({
                sender: msg.from,
                content: msg.message,
                isSelf: msg.isSelf
            });

            // Afficher le message
            const senderDisplay = msg.isSelf ? 'Vous' : msg.from;
            displayPrivateMessage(chatPartner, senderDisplay, msg.message);

            // Notification si nécessaire
            if (!msg.isSelf && msg.from !== currentUser && !blockedUsers.has(msg.from)) {
                const offcanvas = document.querySelector('.offcanvas.offcanvas-end.show');
                if (!offcanvas) {
                    showToast(`Nouveau message de ${msg.from}`, 'info');
                }
            }
        });

        socket.on('friend_request_received', (data) => {
            // console.log('Friend request received:', data);
            // Vérifier si on a déjà traité cette requête
            const existingRequest = document.querySelector(`[data-request-id="${data.requestId}"]`);
            if (existingRequest) {
                // console.log('Request already displayed, skipping');
                return;
            }

            const pendingFriendsList = document.getElementById('pending-friends');
            if (pendingFriendsList) {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center pending-request';
                li.setAttribute('data-request-id', data.requestId);
                li.innerHTML = `
                    <span>${data.from}</span>
                    <div class="pending-actions">
                        <button class="accept-btn" data-request-id="${data.requestId}">✓</button>
                        <button class="reject-btn" data-request-id="${data.requestId}">✗</button>
                    </div>
                `;
                pendingFriendsList.appendChild(li);

                // Add event listeners for accept/reject buttons
                const acceptBtn = li.querySelector('.accept-btn');
                const rejectBtn = li.querySelector('.reject-btn');

                acceptBtn.addEventListener('click', async () => {
                    try {
                        await acceptFriendRequest(data.requestId);
                        li.remove();
                        fetchAndDisplayFriends();
                        const friendsTab = document.querySelector('[data-tab="online"]');
                        if (friendsTab) friendsTab.click();
                    } catch (error) {
                        console.error('Error accepting friend request:', error);
                    }
                });

                rejectBtn.addEventListener('click', async () => {
                    try {
                        await rejectFriendRequest(data.requestId);
                        li.remove();
                    } catch (error) {
                        console.error('Error rejecting friend request:', error);
                    }
                });

                // Activer automatiquement l'onglet "Pending"
                const pendingTab = document.querySelector('[data-tab="pending"]');
                if (pendingTab) {
                    pendingTab.click();
                }
            }
        });

        socket.on('friend_request_updated', (data) => {
            // console.log('Friend request updated:', data);
            const message = data.response === 'accepted'
                ? `${data.from} a accepté votre demande d'ami!`
                : `${data.from} a refusé votre demande d'ami.`;
            showToast(message, data.response === 'accepted' ? 'success' : 'info');
            fetchAndDisplayFriends();
        });

        socket.on('friend_status_change', (data) => {
            // console.log('Friend status changed:', data);
            fetchAndDisplayFriends();
        });

    }
}

function openPrivateChat(friendName) {
	let chatLog = privateChatLogs.get(friendName);
	if (!chatLog) {
		chatLog = document.createElement('div');
		chatLog.id = `chat-log-${friendName}`;
		chatLog.className = 'chat-log';
		privateChatLogs.set(friendName, chatLog);
	}

	const chatContainer = document.getElementById('private-chats-container');
	chatContainer.innerHTML = '';
	chatContainer.appendChild(chatLog);

	const inputContainer = document.createElement('div');
	inputContainer.className = 'input-container';
	inputContainer.innerHTML = `
		<input type="text" id="message-input-${friendName}" placeholder="Type your message...">
		<button id="send-button-${friendName}">Send</button>
	`;
	chatContainer.appendChild(inputContainer);

	document.getElementById(`send-button-${friendName}`).addEventListener('click', () => sendPrivateMessage(friendName));
}

function setupDashboardEvents(navigateTo, username) {
    // setupAnimations();
    //Logout
	document.getElementById('logoutLink').addEventListener('click', handleLogout);

	// Friend menu
	document.querySelectorAll('#friends .list-group-item').forEach(item => {
		item.addEventListener('click', handleFriendClick);
	});

	// Profile picture dropdown
	document.getElementById('img_profile_pic').addEventListener('click', handleProfilePictureClick);

	// Hide the dropdown menu when clicking outside of it
	document.addEventListener('click', hideDropdowns);

	// Prevent the dropdown menu from closing when clicking inside it
	document.getElementById('friendDropdown').addEventListener('click', (event) => event.stopPropagation());
	document.getElementById('friendDropdown_chat').addEventListener('click', (event) => event.stopPropagation());
	document.getElementById('profileDropdown').addEventListener('click', (event) => event.stopPropagation());
    const displayName = sessionStorage.getItem('display_name');
    document.getElementById('viewmyProfile').addEventListener('click', (event) => { event.preventDefault(); navigateTo(`/profile/${displayName}`); });

	// Dropdown actions
	document.getElementById('sendMessagePrivate').addEventListener('click', showChatbox);
	document.getElementById('startGame').addEventListener('click', startGame);
	document.getElementById('settings').addEventListener('click', goTosettings);

	// Chat functionnalitis
	document.getElementById('send-button').addEventListener('click', sendMessage);

	// Send message when pressing Enter key
	document.addEventListener("keydown", handleEnterKey);

	//View profile
	document.getElementById('friendDropdown').querySelector('#viewProfile').addEventListener('click', viewProfile);
	document.getElementById('friendDropdown_chat').querySelector('#viewProfile').addEventListener('click', viewProfile);

	// Friend actions
	document.getElementById('friendDropdown_chat').querySelector('#addToFriend').addEventListener('click', addFriend);
	document.getElementById('friendDropdown_chat').querySelector('#blockUser').addEventListener('click', blockUser);

	// Ajouter un intervalle pour rafraîchir périodiquement la liste d'amis
	window.fetchFriendsInterval = setInterval(() => {
		fetchAndDisplayFriends();
	}, 3000); // Rafraîchir toutes les 30 secondes
}

function handleProfilePictureClick(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('profileDropdown');

    // Masquer tous les dropdowns visibles
    const visibleDropdowns = document.querySelectorAll('.dropdown-menu, .dropdown-menu_chat');
    visibleDropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });

    // Afficher le dropdown pour le calculer ses dimensions
    dropdown.style.display = 'block';

    // Obtenir les dimensions de la fenêtre et du dropdown
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const dropdownRect = dropdown.getBoundingClientRect();

    // Calculer la position optimale
    let top = event.clientY;
    let left = event.clientX;

    // Ajuster la position verticale si nécessaire
    if (top + dropdownRect.height > windowHeight) {
        top = windowHeight - dropdownRect.height;
    }

    // Ajuster la position horizontale si nécessaire
    if (left + dropdownRect.width > windowWidth) {
        left = windowWidth - dropdownRect.width;
    }

    // Appliquer la nouvelle position
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
}

function handleFriendClick(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('friendDropdown');
    const friendName = this.getAttribute('data-friend');

    // Hide all visible dropdowns
    const visibleDropdowns = document.querySelectorAll('.dropdown-menu, .dropdown-menu_chat');
    visibleDropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });

    // Position the dropdown near the clicked friend item
    dropdown.style.top = `${event.clientY}px`;
    dropdown.style.left = `${event.clientX}px`;
    dropdown.style.display = 'block';

    // Store the clicked friend's name
    dropdown.setAttribute('data-friend', friendName);
}

function hideDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu, .dropdown-menu_chat');
    dropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });
}

function showChatbox(event) {
    event.preventDefault();
    const dropdown = event.target.closest('.dropdown-menu, .dropdown-menu_chat');
    if (dropdown) {
        const friendName = dropdown.getAttribute('data-friend');
        if (friendName) {
            const chatContainer = document.getElementById('private-chats-container');
            
            // Vérifier si un chat existe déjà pour cet ami
            if (privateChatLogs.has(friendName)) {
                // Réutiliser le chat existant
                chatContainer.innerHTML = `
                    <h5 class="offcanvas-title" id="chatboxLabel">Private message with ${friendName}</h5>
                    <div class="chat-container2">
                        <div class="chat-log2" id="chat-log-${friendName}"></div>
                    </div>
                    <div class="input-container2">
                        <input type="text" id="message-input-${friendName}" placeholder="Type your message...">
                        <button id="send-button-${friendName}">►</button>
                    </div>
                `;
                
                // Restaurer les messages précédents
                const chatLog = document.getElementById(`chat-log-${friendName}`);
                if (privateMessages.has(friendName)) {
                    const messages = privateMessages.get(friendName);
                    messages.forEach(msg => {
                        const senderDisplay = msg.isSelf ? 'Vous' : msg.sender;
                        displayPrivateMessage(friendName, senderDisplay, msg.content);
                    });
                }
                
                // Réattacher l'événement d'envoi
                const sendButton = document.getElementById(`send-button-${friendName}`);
                if (sendButton) {
                    sendButton.addEventListener('click', () => sendPrivateMessage(friendName));
                }
            } else {
                // Créer un nouveau chat
                setupPrivateChat(friendName);
            }
            
            activePrivateChat = friendName;
            var chatbox = new bootstrap.Offcanvas(document.getElementById('chatbox'));
            chatbox.show();
        } else {
            console.error('Friend name not found');
        }
    } else {
        console.error('Dropdown not found');
    }
    document.getElementById('friendDropdown').style.display = 'none';
}

function setupPrivateChat(friendName) {
    if (!friendName) {
        console.error('Invalid friend name for private chat setup');
        return;
    }

    if (privateChatLogs.has(friendName)) {
        // console.log(`Private chat already configured for ${friendName}`);
        return;
    }

    const privateChatContainer = document.getElementById('private-chats-container');
    privateChatContainer.innerHTML = `
        <h5 class="offcanvas-title" id="chatboxLabel">Private message with ${friendName}</h5>
        <div class="chat-container2">
            <div class="chat-log2" id="chat-log-${friendName}"></div>
        </div>
        <div class="input-container2">
            <input type="text" id="message-input-${friendName}" placeholder="Type your message...">
            <button id="send-button-${friendName}">►</button>
        </div>
    `;

    // Créer et stocker le chat log
    const chatLog = document.getElementById(`chat-log-${friendName}`);
    privateChatLogs.set(friendName, chatLog);

    // Restaurer les messages précédents
    if (privateMessages.has(friendName)) {
        const messages = privateMessages.get(friendName);
        messages.forEach(msg => {
            displayPrivateMessage(friendName, msg.sender, msg.content);
        });
    }

    const sendButton = document.getElementById(`send-button-${friendName}`);
    sendButton.addEventListener('click', () => {
        sendPrivateMessage(friendName);
    });

    // console.log(`Setup private chat for ${friendName} and ${sessionStorage.getItem('display_name')}`);
    activePrivateChat = friendName;
}

function sendPrivateMessage(friendName) {
    const input = document.getElementById(`message-input-${friendName}`);
    if (!input) {
        console.error(`Input element not found for friend: ${friendName}`);
        return;
    }

    const message = input.value.trim();
    const currentUser = sessionStorage.getItem('display_name');
    const socket = getSocket(currentUser);

    if (message && socket && socket.connected) {
        if (!privateChatLogs.has(friendName)) {
            setupPrivateChat(friendName);
        }

        socket.emit('private message', {
            to: friendName,
            from: currentUser,
            message: sanitizeHTML(message)
        });

        input.value = '';
    } else {
        console.error('Cannot send message:', {
            hasMessage: !!message,
            hasSocket: !!socket,
            socketConnected: socket?.connected
        });
        displayPrivateMessage(friendName, 'System', 'Friend is disconnected', true);
    }
}

// Fonction de sanitization
function sanitizeHTML(str) {
    var temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function displayPrivateMessage(friendName, sender, message, isSystem = false) {
    message = message.replace(/[^a-zA-Z0-9 ]/g, "");

    const chatLog = document.getElementById(`chat-log-${friendName}`);
    if (chatLog) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message-container');

        if (isSystem) {
            messageElement.classList.add('system-message');
            messageElement.innerHTML = `
                <span class="system-text">${sanitizeHTML(message)}</span>
            `;
        } else {
            const usernameElement = document.createElement('span');
            usernameElement.classList.add('username-link');
            if (sender === 'Vous') {
                usernameElement.style.color = '#ff7043';
                usernameElement.textContent = '[Me] ';
            } else {
                usernameElement.textContent = `[${sanitizeHTML(friendName)}]`;
            }

            const messageTextElement = document.createElement('span');
            messageTextElement.classList.add('message-text');
            messageTextElement.textContent = sanitizeHTML(message);

            messageElement.appendChild(usernameElement);
            messageElement.appendChild(document.createTextNode(': '));
            messageElement.appendChild(messageTextElement);
        }

        chatLog.appendChild(messageElement);
        chatLog.scrollTop = chatLog.scrollHeight;
    }
}

function startGame(event) {
    event.preventDefault()
    const friendName = document.getElementById('friendDropdown').getAttribute('data-friend');

    const displayName = sessionStorage.getItem('display_name')
    const invitationData = {
        to: friendName,
        from: displayName,
        type: 'gameInvitation'
    };

    const iframe = document.getElementById('pong');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(invitationData, 'https://c1r4p6.42nice.fr:8080/game_server');

        showToast(`Invite send to ${friendName}`, 'success');
    } else {
        console.error('Iframe cible non trouvée ou inaccessible.');
        showToast('Imposible to send invite', 'error');
    }
    document.getElementById('friendDropdown').style.display = 'none';
    iframe.focus();
}

function goTosettings(event) {
	event.preventDefault();
	// console.log('Go to settings');
	navigateTo('/settings');
}

function sendMessage(event) {
    event.preventDefault();
    const displayName = sessionStorage.getItem('display_name');
    let socket = getSocket(displayName);

    // Si le socket n'existe pas ou n'est pas connecté, essayer de le réinitialiser
    if (!socket || !socket.connected) {
        socket = initializeSocket(displayName);
        if (!socket) {
            showToast('Connection lost. Please refresh the page.', 'error');
            return;
        }
    }

    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    if (message !== '' && socket.connected) {
        socket.emit('chat message', { name: displayName, message: message });
        messageInput.value = '';
    } else if (!socket.connected) {
        showToast('Connection lost. Trying to reconnect...', 'warning');
    }
}

function receiveMessage(msg) {
    // console.log('Fonction receive Message appelée avec:', msg);
    // console.log('Blocked users:', Array.from(blockedUsers));

    // Vérifier si l'expéditeur est bloqué en utilisant le display_name
    if (blockedUsers.has(msg.name)) {
        // console.log(`Message ignoré de ${msg.name} car il est bloqué.`);
        return;
    }

    const chatLog = document.getElementById('chat-log');
    if (!chatLog) {
        console.error("L'élément chat-log n'existe pas dans le DOM");
        return;
    }
    const messageElement = document.createElement('div');

    const usernameElement = document.createElement('span');
    usernameElement.classList.add('username-link');
    usernameElement.dataset.friend = msg.name;

    const currentUsername = sessionStorage.getItem('display_name');
    if (msg.name === currentUsername) {
        usernameElement.style.color = '#ff7043';
        usernameElement.innerText = `[${msg.name}]`;
    } else {
        usernameElement.innerText = `[${msg.name}]`;
    }

    usernameElement.style.cursor = 'pointer';

    saveMessage(msg.name, msg.message);

    usernameElement.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        const isOwnUsername = msg.name === currentUsername;
        const dropdown = isOwnUsername ? document.getElementById('profileDropdown') : document.getElementById('friendDropdown_chat');
        const friendName = this.dataset.friend;
        usernameElement.classList.add('username-link', 'bold-username');

        // Masquer tous les menus déroulants visibles
        const visibleDropdowns = document.querySelectorAll('.dropdown-menu, .dropdown-menu_chat');
        visibleDropdowns.forEach(dropdown => {
            dropdown.style.display = 'none';
        });

        if (dropdown) {
            dropdown.style.position = 'fixed';
            dropdown.style.display = 'block';

            // Vérifier si le dropdown dépasse la fenêtre
            const rect = dropdown.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            if (event.clientY + rect.height > windowHeight) {
                dropdown.style.top = `${event.clientY - rect.height}px`;
            } else {
                dropdown.style.top = `${event.clientY}px`;
            }

            if (event.clientX + rect.width > windowWidth) {
                dropdown.style.left = `${event.clientX - rect.width}px`;
            } else {
                dropdown.style.left = `${event.clientX}px`;
            }

            dropdown.dataset.friend = friendName;
        }
        // console.log('Message reçu:', msg);
    });

    const messageTextElement = document.createElement('span');
    messageTextElement.innerText = ` : ${msg.message}`;

    messageElement.appendChild(usernameElement);
    messageElement.appendChild(messageTextElement);

    chatLog.appendChild(messageElement);

    chatLog.scrollTop = chatLog.scrollHeight;
}

function handleEnterKey(event) {
    if (event.key === "Enter") {
        const offcanvas = document.querySelector('.offcanvas.offcanvas-end.show');
        if (offcanvas) {
            const chatboxLabel = offcanvas.querySelector('#chatboxLabel');
            if (chatboxLabel) {
                const friendName = chatboxLabel.textContent.replace('Private message with ', '');
                const messageInput = document.getElementById(`message-input-${friendName}`);

                if (messageInput && document.activeElement === messageInput) {
                    event.preventDefault(); // Empêcher le saut de ligne
                    const sendButton = document.getElementById(`send-button-${friendName}`);
                    if (sendButton) {
                        sendButton.click();
                    }
                }
            }
        } else {
            const messageInput = document.getElementById('message-input');
            if (messageInput && document.activeElement === messageInput) {
                event.preventDefault(); // Empêcher le saut de ligne
                sendMessage(event);
            }
        }
    }
}

function addFriend(event) {
    event.preventDefault();
    const dropdown = event.target.closest('.dropdown-menu, .dropdown-menu_chat');
    const friendName = dropdown ? dropdown.getAttribute('data-friend') : null;
    if (!friendName) {
        console.error("Unable to determine friend's name");
        return;
    }

    checkFriendshipStatus(friendName)
        .then(({ isFriend, requestSent }) => {
            if (isFriend) {
                showToast('Already friends', 'info');
                return;
            }
            if (requestSent) {
                showToast('Friend request already sent', 'info');
                return;
            }

            sendFriendRequest(friendName)
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.message || `Erreur HTTP: ${response.status}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    // console.log('Friend request sent successfully', data);
                    showToast('Friend request sent successfully', 'success');
                    sendFriendRequestSocket(friendName, data.request_id);
                })
                .catch(error => {
                    console.error('Error sending friend request:', error);
                    showToast(error.message, 'error');
                });
        })
        .catch(error => {
            console.error('Error checking friendship status:', error);
            showToast('Error checking friendship status', 'error');
        });
}


function blockUser(event) {
    event.preventDefault();
    const dropdown = event.target.closest('.dropdown-menu_chat');
    const username = dropdown.getAttribute('data-friend');

    if (!username) {
        console.error("Username not found");
        return;
    }

    fetch('/api/block-user/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ display_name: username })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Ajouter au Set des utilisateurs bloqués
            blockedUsers.add(username);

            // Nettoyer les messages existants de l'utilisateur bloqué
            const chatLog = document.getElementById('chat-log');
            if (chatLog) {
                const messages = chatLog.getElementsByTagName('div');
                Array.from(messages).forEach(message => {
                    const usernameElement = message.querySelector('.username-link');
                    if (usernameElement && usernameElement.dataset.friend === username) {
                        message.remove();
                    }
                });
            }

            showToast('User blocked successfully', 'success');

            // Fermer le chat privé si ouvert
            if (privateChatLogs.has(username)) {
                privateChatLogs.delete(username);
                const chatbox = document.getElementById('chatbox');
                if (chatbox) {
                    const bsOffcanvas = bootstrap.Offcanvas.getInstance(chatbox);
                    if (bsOffcanvas) {
                        bsOffcanvas.hide();
                    }
                }
            }

            fetchAndDisplayFriends();
        } else {
            showToast(data.message || 'Failed to block user', 'error');
        }
    })
    .catch(error => {
        console.error('Error blocking user:', error);
        showToast('An error occurred while blocking the user', 'error');
    });
}

function viewProfile(event) {
    event.preventDefault();
    const dropdown = event.target.closest('.dropdown-menu, .dropdown-menu_chat');
    const friendName = dropdown ? dropdown.getAttribute('data-friend') : null;
    if (friendName) {
        // console.log(`View profile of ${friendName}`);
        navigateTo(`/profile/${encodeURIComponent(friendName)}`);
    } else {
        console.error("Unable to determine friend's name");
    }
}

function saveMessage(friendName, message) {
    let messages = JSON.parse(sessionStorage.getItem('general_chat_messages')) || [];

    messages.push({ friendName, message, timestamp: new Date().toISOString() });
    // console.log('Message saved:', messages);
    // console.log('From:', friendName);

    if (messages.length > 15) {
        messages = messages.slice(-15);
    }

    sessionStorage.setItem('general_chat_messages', JSON.stringify(messages));
}

function loadGeneralChatMessages() {
    const chatLog = document.getElementById('chat-log');
    if (!chatLog) {
        console.error("L'élément chat-log n'existe pas dans le DOM");
        return;
    }

    const messagesString = sessionStorage.getItem('general_chat_messages');
    if (!messagesString) {
        return;
    }

    try {
        // Parse les messages correctement
        const messages = JSON.parse(messagesString);

        chatLog.innerHTML = ''; // Effacer les messages précédents

        messages.forEach(msg => {
            const messageElement = document.createElement('div');

            const usernameElement = document.createElement('span');
            usernameElement.classList.add('username-link');
            usernameElement.dataset.friend = msg.friendName;
            usernameElement.innerText = `[${msg.friendName}]`;
            usernameElement.style.cursor = "pointer";
            usernameElement.classList.add('bold-username');

            // Ajouter l'écouteur d'événements pour le clic sur le nom d'utilisateur
            usernameElement.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                handleUsernameClick(event, msg.friendName);
            });

            const messageTextElement = document.createElement('span');
            messageTextElement.innerText = ` : ${msg.message}`;

            messageElement.appendChild(usernameElement);
            messageElement.appendChild(messageTextElement);

            chatLog.appendChild(messageElement);
        });

        chatLog.scrollTop = chatLog.scrollHeight;
    } catch (error) {
        console.error('Erreur lors du chargement des messages:', error);
    }
}

function handleUsernameClick(event, username) {
    const currentUsername = sessionStorage.getItem('username');
    const isOwnUsername = username === currentUsername;
    const dropdown = isOwnUsername ? document.getElementById('profileDropdown') : document.getElementById('friendDropdown_chat');

    // Masquer tous les menus déroulants visibles
    const visibleDropdowns = document.querySelectorAll('.dropdown-menu, .dropdown-menu_chat');
    visibleDropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });

    if (dropdown) {
        dropdown.style.position = 'fixed';
        dropdown.style.display = 'block';

        // Vérifier si le dropdown dépasse la fenêtre
        const rect = dropdown.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (event.clientY + rect.height > windowHeight) {
            dropdown.style.top = `${event.clientY - rect.height}px`;
        } else {
            dropdown.style.top = `${event.clientY}px`;
        }

        if (event.clientX + rect.width > windowWidth) {
            dropdown.style.left = `${event.clientX - rect.width}px`;
        } else {
            dropdown.style.left = `${event.clientX}px`;
        }

        dropdown.dataset.friend = username;
    }
}


function showFriendRequestToast(fromUsername, requestId) {
    const toastHtml = `
        <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header" style="background-color: #FF8C00;">
                <strong class="me-auto" style="color: #ff5722; background-color: white;">Friend Request</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body" style="color: black; background-color: white;">
                ${fromUsername} wants to add you as a friend.
                <div class="mt-2 pt-2 border-top">
                    <button type="button" class="btn btn-primary btn-sm accept-friend-request" data-request-id="${requestId}" style="background-color: #FF8C00;">Accept</button>
                    <button type="button" class="btn btn-primary btn-sm reject-friend-request" data-request-id="${requestId}" style="background-color: #FF8C00;">Reject</button>
                </div>
            </div>
        </div>
    `;

    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 start-50 translate-middle-x p-3';
    toastContainer.innerHTML = toastHtml;
    document.body.appendChild(toastContainer);

    const toastElement = toastContainer.querySelector('.toast');
    const toast = new bootstrap.Toast(toastElement);

    // Ajoutez les écouteurs d'événements pour les boutons
    toastElement.querySelector('.accept-friend-request').addEventListener('click', function() {
        acceptFriendRequest(this.dataset.requestId)
            .then(() => {
                toast.hide();
                fetchAndDisplayFriends();
            })
            .catch(error => console.error('Erreur lors de l\'acceptation de la demande d\'ami:', error));
    });

    toastElement.querySelector('.reject-friend-request').addEventListener('click', function() {
        rejectFriendRequest(this.dataset.requestId)
            .then(() => {
                toast.hide();
            })
            .catch(error => console.error('Erreur lors du rejet de la demande d\'ami:', error));
    });    toast.show();
}

export async function fetchAndDisplayFriends() {
    const onlineFriendsList = document.getElementById('online-friends');
    const pendingFriendsList = document.getElementById('pending-friends');
    const blockedFriendsList = document.getElementById('blocked-friends');

    if (onlineFriendsList && pendingFriendsList && blockedFriendsList) {
        try {
            const [friendsResponse, pendingResponse, blockedResponse] = await Promise.all([
                fetch('/api/friends/', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                        'Content-Type': 'application/json'
                    }
                }),
                fetch('/api/get-friend-requests/', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                        'Content-Type': 'application/json'
                    }
                }),
                fetch('/api/blocked-users/', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                        'Content-Type': 'application/json'
                    }
                })
            ]);

            const [friendsData, pendingData, blockedData] = await Promise.all([
                friendsResponse.json(),
                pendingResponse.json(),
                blockedResponse.json()
            ]);

            // Mettre à jour le Set des utilisateurs bloqués
            blockedUsers.clear();
            if (blockedData.success && blockedData.blocked_users) {
                blockedData.blocked_users.forEach(displayName => {
                    blockedUsers.add(displayName);
                });
            }

            // Clear all lists
            onlineFriendsList.innerHTML = '';
            pendingFriendsList.innerHTML = '';
            blockedFriendsList.innerHTML = '';

            // Display ALL friends (not just online ones)
            friendsData.friends.forEach(friend => {
                if (!blockedUsers.has(friend.display_name)) {
                    createFriendListItem(friend, onlineFriendsList);
                }
            });

            // Display pending requests
            if (pendingData.success && pendingData.friend_requests) {
                pendingData.friend_requests.forEach(request => {
                    if (!blockedUsers.has(request.from_username)) {
                        const li = document.createElement('li');
                        li.className = 'list-group-item d-flex justify-content-between align-items-center pending-request';
                        li.setAttribute('data-request-id', request.id);
                        li.innerHTML = `
                            <span>${request.from_username}</span>
                            <div class="pending-actions">
                                <button class="accept-btn" data-request-id="${request.id}">✓</button>
                                <button class="reject-btn" data-request-id="${request.id}">✗</button>
                            </div>
                        `;
                        pendingFriendsList.appendChild(li);

                        // Add event listeners with removal functionality
                        li.querySelector('.accept-btn').addEventListener('click', async () => {
                            await acceptFriendRequest(request.id);
                            li.remove(); // Remove the request from the list
                            fetchAndDisplayFriends(); // Refresh friends list
                            const friendsTab = document.querySelector('[data-tab="online"]');
                            if (friendsTab) friendsTab.click();
                        });

                        li.querySelector('.reject-btn').addEventListener('click', async () => {
                            await rejectFriendRequest(request.id);
                            li.remove(); // Remove the request from the list
                            const friendsTab = document.querySelector('[data-tab="online"]');
                            if (friendsTab) friendsTab.click();
                        });
                    }
                });
            }

            // Display blocked users
            if (blockedData.success && blockedData.blocked_users) {
                blockedData.blocked_users.forEach(displayName => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center blocked-user';
                    li.innerHTML = `
                        <span>${displayName}</span>
                        <button class="unblock-btn" data-display-name="${displayName}">Unblock</button>
                    `;
                    blockedFriendsList.appendChild(li);

                    li.querySelector('.unblock-btn').addEventListener('click', () => unblockUser(displayName));
                });
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }
}

// Nouvelle fonction helper pour créer les éléments de la liste d'amis
function createFriendListItem(friend, listElement) {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    li.setAttribute('data-friend', friend.display_name);

    const statusDot = document.createElement('span');
    statusDot.className = `status-dot ${friend.is_online ? 'online' : 'offline'}`;
    statusDot.style.backgroundColor = friend.is_online ? '#4CAF50' : '#f44336'; // Vert si en ligne, rouge si hors ligne

    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = friend.display_name;

    li.appendChild(statusDot);
    li.appendChild(usernameSpan);

    li.addEventListener('click', handleFriendClick);

    listElement.appendChild(li);

    if (friend.is_online && !privateChatLogs.has(friend.display_name)) {
        setupPrivateChat(friend.display_name);
    }
}

// Nouvelle fonction pour débloquer un utilisateur
async function unblockUser(username) {
    try {
        const response = await fetch('/api/unblock-user/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ display_name: username })
        });

        const data = await response.json();
        if (data.success) {
            showToast('User unblocked successfully', 'success');
            fetchAndDisplayFriends(); // Refresh the lists
        } else {
            showToast(data.message || 'Failed to unblock user', 'error');
        }
    } catch (error) {
        console.error('Error unblocking user:', error);
        showToast('An error occurred while unblocking the user', 'error');
    }
}

// Ajouter un écouteur pour les mouvements de souris et les frappes au clavier
document.addEventListener('mousemove', resetActivityTimer);
document.addEventListener('keypress', resetActivityTimer);

function resetActivityTimer() {
    const displayName = sessionStorage.getItem('display_name');
    if (displayName) {
        getSocket(displayName); // Utiliser displayName
    }
}


export function removeDashboardEventListeners() {
    // Remove logout listener
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.removeEventListener('click', handleLogout);
    }

    // Remove friend item listeners
    const friendItems = document.querySelectorAll('#friends .list-group-item');
    friendItems.forEach(item => {
        item.removeEventListener('click', handleFriendClick);
    });

    // Remove profile picture listener
    const profilePic = document.getElementById('img_profile_pic');
    if (profilePic) {
        profilePic.removeEventListener('click', handleProfilePictureClick);
    }

    // Remove other listeners
    document.removeEventListener('click', hideDropdowns);
    document.removeEventListener('keydown', handleEnterKey);

    // Clear intervals
    clearInterval(window.fetchFriendsInterval);
    clearInterval(window.checkFriendRequestsInterval);

    // Remove socket listeners and disconnect
    const displayName = sessionStorage.getItem('display_name');
    const socket = getSocket(displayName);
    if (socket) {
        socket.off('chat message');
        socket.off('private message');
        socket.off('force_disconnect');
        socket.off('user_disconnected');
        socket.disconnect();
    }
    // console.log('removeDashboardEventListeners');

    // Nettoyer l'intervalle de reconnexion
    if (window.reconnectInterval) {
        clearInterval(window.reconnectInterval);
    }

    // Arrêter les intervalles de vérification
    if (window.fetchFriendsInterval) {
        clearInterval(window.fetchFriendsInterval);
    }
    if (window.checkFriendRequestsInterval) {
        clearInterval(window.checkFriendRequestsInterval);
    }
    if (window.reconnectInterval) {
        clearInterval(window.reconnectInterval);
    }

    // Nettoyer les maps et sets
    privateChatLogs.clear();
    privateMessages.clear();
    blockedUsers.clear();

    // Supprimer les écouteurs d'événements de la souris et du clavier
    document.removeEventListener('mousemove', resetActivityTimer);
    document.removeEventListener('keypress', resetActivityTimer);

    // console.log('All dashboard event listeners and intervals removed');
}

// Modify the existing logout function
function handleLogout(event) {
    event.preventDefault();
    const displayName = sessionStorage.getItem('display_name');
    const socket = getSocket(displayName);
    if (socket) {
        socket.disconnect();
    }
    removeDashboardEventListeners();
    sessionStorage.removeItem('general_chat_messages');
    logout();
}

function setupTabSystem() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button
            button.classList.add('active');

            // Show corresponding content
            const tabId = button.getAttribute('data-tab');
            const content = document.getElementById(tabId);
            if (content) {
                content.classList.add('active');
            }
        });
    });
}

// 1. Ajouter une fonction pour charger les utilisateurs bloqués
async function loadBlockedUsers() {
    try {
        const response = await fetch('/api/blocked-users/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch blocked users');
        }

        const data = await response.json();
        if (data.success) {
            // Mettre à jour le Set des utilisateurs bloqués
            blockedUsers.clear();
            data.blocked_users.forEach(displayName => {
                blockedUsers.add(displayName);
            });
            // console.log('All blocked users:', Array.from(blockedUsers));
            // console.log('Total number of blocked users:', blockedUsers.size);
        }
    } catch (error) {
        console.error('Error loading blocked users:', error);
    }
}

// Modifier la fonction setupAutoReconnect pour éviter les reconnexions inutiles
function setupAutoReconnect() {
    const displayName = sessionStorage.getItem('display_name');

    // Nettoyer l'intervalle existant s'il y en a un
    if (window.reconnectInterval) {
        clearInterval(window.reconnectInterval);
    }

    window.reconnectInterval = setInterval(() => {
        const socket = getSocket(displayName);
        if (!socket || !socket.connected) {
            // console.log('Socket déconnecté, tentative de reconnexion...');
            const newSocket = initializeSocket(displayName);
            if (newSocket) {
                setupChatListeners(newSocket);
            }
        }
    }, 30000); // Vérification toutes les 30 secondes
}

// Ajouter dans setupDashboardEvents
function setupAnimations() {
    // Animation des halos
    const container = document.querySelector('.dashboard-container');
    if (container) {
        container.style.opacity = '0';
        setTimeout(() => {
            container.style.transition = 'opacity 0.5s ease';
            container.style.opacity = '1';
        }, 100);
    }

    // Animation des éléments au chargement
    const elements = document.querySelectorAll('.sidebar, .chat-container, .game-container');
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'all 0.5s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 200 + index * 100);
    });
}

// Ajouter une fonction pour nettoyer lors de la fermeture du chat
function closePrivateChat() {
    activePrivateChat = null;
    // Autre logique de nettoyage si nécessaire
}
