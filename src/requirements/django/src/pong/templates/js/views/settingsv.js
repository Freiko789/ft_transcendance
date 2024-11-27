import { navigateTo } from '../app.js';

export function settings() {
    const displayName = sessionStorage.getItem('display_name');
    let avatarUrl = sessionStorage.getItem('avatar_url');
    if (avatarUrl) {
        avatarUrl = avatarUrl.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    }


    if (!displayName) {
        navigateTo('/login');
        return;
    }
    // console.log('settings view');

    document.getElementById('ft_transcendence').innerHTML = `
    <div class="dashboard-container">
        <ul class="nav justify-content-between align-items-center">
            <a class="navbar-brand" href="#">
                <img src="${staticUrl}content/logo2.png" id="pongonlineLink" alt="Logo" width="70" height="70">
            </a>
            <li class="nav-item">
                <span class="nav-item" style="font-size: 2.5em; font-weight: bold;">${displayName}</span>
            </li>
            <li class="nav-item">
                <img src="${avatarUrl}" class="img-thumbnail rounded-circle d-flex justify-content-center" alt="Photo de profil" style="width: 50px; height: 50px;padding: 0px; border: 2px solid #ff5722; object-fit: cover;flex-shrink: 0;">
            </li>
        </ul>

        <h3 id="header-dashboard" class="text-center settings-title">User Settings</h3>

        <div class="container mt-4 settings-form-container">
            <form id="settingsForm">
                <div class="mb-3">
                    <label for="displayName" class="form-label">Display Name</label>
                    <input type="text" class="form-control" id="displayName" name="displayName">
                </div>
                <div class="mb-3">
                    <label for="email" class="form-label">Email</label>
                    <input type="email" class="form-control" id="email" name="email">
                </div>
                <div class="mb-3">
                    <label for="avatar" class="form-label">Avatar</label>
                    <div class="d-flex align-items-center">
                        <img id="currentAvatar" src="${avatarUrl}" alt="Avatar actuel" class="img-thumbnail rounded-circle me-3 avatar-img" style="width: 100px; height: 100px;padding: 0px; border: 2px solid #ff5722;">
                        <input type="file" class="form-control" id="avatar" name="avatar" accept="image/jpeg,image/png,image/gif">
                    </div>
                    <small class="form-text text-muted">
                        <ul>
                            <li><i style="color: #ff5722">Accepted formats: JPG, PNG, GIF</i></li>
                            <li><i style="color: #ff5722;">Maximum size: 5 MB</i></li>
                            <li><i style="color: #ff5722;">Dimensions: between 100x100 and 1000x1000 pixels</i></li>
                        </ul>
                    </small>
                </div>
                <button type="submit" class="btn btn-primary">Save changes</button>
            </form>
            <button id="backToDashboard" class="btn btn-secondary">Back to Dashboard</button>
        </div>

        <footer class="footer py-3 my-4">
            <p class="text-center">© 2024 42 Company, Inc</p>
        </footer>

        <div class="toast-container position-fixed top-0 start-50 translate-middle-x p-3" style="z-index: 11;">
            <div id="saveSettingsToast" class="toast">
                <div class="toast-header">
                    <strong class="me-auto">Settings Saved!</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    Your profile settings have been successfully updated.
                </div>
            </div>
            <div id="savePasswordToast" class="toast">
                <div class="toast-header">
                    <strong class="me-auto">Password Saved!</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    Your password has been successfully updated.
                </div>
            </div>
        </div>
    </div>
`;

attachEventSettingsPage(navigateTo, displayName);
}

function attachEventSettingsPage(navigateTo, player_name) {
    const pongonlineLink = document.getElementById('pongonlineLink');
    const backToDashboard = document.getElementById('backToDashboard');
    const settingsForm = document.getElementById('settingsForm');
    const displayNameInput = document.getElementById('displayName').value;
    const emailInput = document.getElementById('email').value;
    const changePasswordForm = document.getElementById('changePasswordForm');
    const avatarInput = document.getElementById('avatar');


    pongonlineLink.addEventListener('click', (event) => {
        event.preventDefault();
        navigateTo('/dashboard');
    });

    backToDashboard.addEventListener('click', () => navigateTo('/dashboard'));

    settingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData();

        const displayName = document.getElementById('displayName').value;
        const email = document.getElementById('email').value;


        if (!isValidDisplayName(displayName)) {
            showToast('Display name must be between 3 and 15 characters and contain only letters and numbers.', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showToast('Invalid email address.', 'error');
            return;
        }

        formData.append('display_name', displayName);
        formData.append('email', email);

        const currentDisplayName = sessionStorage.getItem('display_name');
        if (currentDisplayName !== displayName) {
            const { cleanupAllSockets } = await import('../utils/socketManager.js');
            cleanupAllSockets();
        }

        const avatarInput = document.getElementById('avatar');
        if (avatarInput && avatarInput.files[0]) {
            formData.append('avatar', avatarInput.files[0]);
        }

        try {
            const csrftoken = getCookie('csrftoken');
            const response = await fetch('/api/update-user-settings/', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                    'X-CSRFToken': csrftoken,
                },
            });

            if (response.ok) {
                const data = await response.json();
                // console.log('Settings updated:', data);
                showUpdateProfileToast();
                
                if (data.avatar_url) {
                    sessionStorage.setItem('avatar_url', data.avatar_url);
                }
                
                if (data.display_name) {
                    sessionStorage.setItem('display_name', data.display_name);
                }
            } else {
                const errorData = await response.json();
                showToast(`Erreur : ${errorData.message}`, 'error');
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour des paramètres :', error);
            showToast('Une erreur est survenue lors de la mise à jour des paramètres.', 'error');
        }
    });

    avatarInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            // Vérification de la taille du fichier
            if (file.size > 5 * 1024 * 1024) {
                showToast('File is too large. Maximum size is 5 MB.', 'error');
                avatarInput.value = '';
                return;
            }

            // Vérification du type de fichier
            const acceptedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (!acceptedTypes.includes(file.type)) {
                showToast('File type not accepted. Please choose a JPG, PNG or GIF image.', 'error');
                avatarInput.value = '';
                return;
            }click

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    if (img.width < 100 || img.height < 100 || img.width > 1000 || img.height > 1000) {
                        showToast('Image dimensions must be between 100x100 and 1000x1000 pixels.', 'error');
                        avatarInput.value = '';
                    } else {
                        document.getElementById('currentAvatar').src = e.target.result;
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Pre-fill form fields
    const prefilledDisplayName = sessionStorage.getItem('display_name');
    const prefilEmail = 'newEmail@wanadoo.com';
    document.getElementById('displayName').value = prefilledDisplayName;
    document.getElementById('email').value = prefilEmail;
}

function showUpdateProfileToast() {
	const toastEl = document.getElementById('saveSettingsToast');
	const toast = new bootstrap.Toast(toastEl);
	toast.show();
}

function showsavePasswordToast() {
	const toastEl = document.getElementById('savePasswordToast');
	const toast = new bootstrap.Toast(toastEl);
	toast.show();
}

export function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function showToast(message, type = 'info') {
    const toastHtml = `
        <div class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;

    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed top-0 start-50 translate-middle-x p-3';
    toastContainer.innerHTML = toastHtml;
    document.body.appendChild(toastContainer);

    const toastElement = toastContainer.querySelector('.toast');
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
}

export function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

export function isValidDisplayName(displayName) {
    const displayNameRegex = /^[a-zA-Z0-9]{3,15}$/;
    return displayNameRegex.test(displayName);
}