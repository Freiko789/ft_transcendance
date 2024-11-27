import { navigateTo } from '../app.js';
import { getCsrfToken } from '../utils/token.js';
import { removeDashboardEventListeners } from './dashboard.js';

export function login() {
    if (check42AuthParams()) {
        return;
    }

    removeDashboardEventListeners(); // Add this line
    // console.log('login view');
    document.getElementById('ft_transcendence').innerHTML = `
    <div class="container login-container">
        <img src="${staticUrl}content/logo_400_400.png" id="logo_pong_login" alt="Logo" width="200" height="200">
        <form id="loginForm">
            <p>
                <label for="username" style="color: #ff5722; margin-top:10px;">Account name</label>
                <input type="text" placeholder="Enter Account name" id="username">
            </p>
            <p>
                <label for="password" style="color: #ff5722;">Password</label>
                <div class="password-wrapper">
                    <input type="password" placeholder="Enter Password" id="password" class="password">
                    <button class="unmask" type="button" title="Mask/Unmask password to check content">
                        <i class="fas fa-lock"></i>
                    </button>
                </div>
            </p>
            <button type="submit" class="btn btn-primary" id="login_button" style="margin-top: 40px;">Login</button>
            <button type="submit" class="btn btn-primary" id="login_with_42" style="background-color: #FF8C00;">Login with 42</button>
            <div>
                <div class="text-center">
                    <button type="button" id="create_account" style="margin-top: 10px;" class="btn btn-outline-light">Create account</button>
                </div>
            </div>
        </form>
    </div>
    <div class="position-fixed top-0 start-50 translate-middle-x p-3" style="z-index: 11">
        <div id="loginToast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-danger text-white">
                <strong class="me-auto">Login Error</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                Invalid username or password
            </div>
        </div>
        <div id="successToast" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-success text-white">
                <strong class="me-auto">Success</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                Operation successful
            </div>
        </div>
    </div>
    <footer>
        <p>© 2024 42Company, Inc</p>
    </footer>
    `;

    // Utiliser setTimeout pour s'assurer que le DOM est complètement mis à jour
    setTimeout(() => {
        attachEventLoginPage();
    }, 0);
}

function attachEventLoginPage() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const createButton = document.getElementById('create_account');
    if (createButton) {
        createButton.addEventListener('click', function (event) {
            event.preventDefault();
            navigateTo('/register');
        });
    }

    // Remplacer l'ancien gestionnaire d'événements pour unmask
    const unmaskButtons = document.querySelectorAll('.unmask');
    unmaskButtons.forEach(button => {
        button.addEventListener('click', handleUnmaskPassword);
    });

    document.addEventListener("keydown", handleEnterKeyPress);

    document.getElementById('login_with_42').addEventListener('click', handle42Login);
}

function handleUnmaskPassword(event) {
    const button = event.currentTarget;
    const input = button.previousElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        button.querySelector('i').classList.remove('fa-lock');
        button.querySelector('i').classList.add('fa-lock-open');
    } else {
        input.type = 'password';
        button.querySelector('i').classList.remove('fa-lock-open');
        button.querySelector('i').classList.add('fa-lock');
    }
}

function handleEnterKeyPress(event) {
    if (event.key === "Enter") {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.dispatchEvent(new Event('submit'));
        }
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        const csrfToken = await getCsrfToken();
        // console.log("CSRF token obtenu :", csrfToken);
        const response = await fetch('/api/login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify({ username, password }),
            credentials: 'include',
        });
        const data = await response.json();
        if (data.success) {
            // console.log('Connexion réussie');
            sessionStorage.setItem('accessToken', data.access);
            sessionStorage.setItem('refreshToken', data.refresh);
            sessionStorage.setItem('username', data.username);
            sessionStorage.setItem('display_name', data.display_name);
            sessionStorage.setItem('avatar_url', data.avatar_url);
            navigateTo('/dashboard');
            // Mettez à jour le statut en ligne
            await fetch('/api/update-online-status/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.access}`,
                },
            });
        } else {
            console.error('Échec de la connexion :', data.message);
            showLoginToastErr(data.message);
        }
    } catch (error) {
        console.error('Erreur :', error);
        showLoginToastErr('Une erreur est survenue. Veuillez réessayer.');
    }
}

async function handle42Login(e) {
    e.preventDefault();
    window.location.href = '/api/auth/42/login/';
}

function check42AuthParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth_success');
    
    if (authSuccess === 'true') {
        // Stocker toutes les informations de l'utilisateur
        const access = urlParams.get('access');
        const refresh = urlParams.get('refresh');
        const username = urlParams.get('username');
        const display_name = urlParams.get('display_name');
        const avatar_url = urlParams.get('avatar_url');
        
        if (access && refresh && username) {
            // Stocker les informations dans la session
            sessionStorage.setItem('accessToken', access);
            sessionStorage.setItem('refreshToken', refresh);
            sessionStorage.setItem('username', username);
            sessionStorage.setItem('display_name', display_name);
            sessionStorage.setItem('avatar_url', avatar_url);
            
            // Nettoyer l'URL
            history.replaceState(null, '', '/login');
            
            // Rediriger vers le dashboard
            navigateTo('/dashboard');
            return true;
        }
    }
    return false;
}

function showLoginToastErr(message) {
    const toastEl = document.getElementById('loginToast');
    const toast = new bootstrap.Toast(toastEl);
    const toastBody = toastEl.querySelector('.toast-body');
    toastBody.textContent = message;
    toast.show();
}

function checkRegistrationSuccess() {
    const successMessage = sessionStorage.getItem('registrationSuccess');
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth_success');
    const data = urlParams.get('data');

    if (successMessage) {
        showSuccessToast(successMessage);
        sessionStorage.removeItem('registrationSuccess');
    } else if (authSuccess === 'true' && !data) {
        // Ne montrer le toast que si on n'a pas de données d'authentification
        showSuccessToast('42 registration successful. You can now log in.');
        history.replaceState(null, '', window.location.pathname);
    }
}

function showSuccessToast(message) {
    const toastEl = document.getElementById('successToast');
    const toastBody = toastEl.querySelector('.toast-body');
    toastBody.textContent = message;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

function showLoginToast(message) {
    const toastEl = document.getElementById('loginToast');
    const toastBody = toastEl.querySelector('.toast-body');
    toastBody.textContent = message;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

export function removeLoginEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.removeEventListener('submit', handleLogin);
    }

    const createButton = document.getElementById('create_account');
    if (createButton) {
        createButton.removeEventListener('click', navigateTo);
    }

    document.removeEventListener('click', handleUnmaskPassword);
    document.removeEventListener("keydown", handleEnterKeyPress);
}