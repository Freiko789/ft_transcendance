import { navigateTo } from '../app.js';

export function notFound() {
    const content = `
        <div class="d-flex flex-column align-items-center justify-content-center vh-100">
            <div class="alert alert-danger text-center" role="alert" style="background-color: #FF8C00; color: white;">
                <h4 class="alert-heading">404: Page Not Found</h4>
                <p>The page you are looking for does not exist.</p>
            </div>
            <div class="mt-3">
                <button id="backToLogin" style="width: 200px; background-color: #FF8C00;" class="btn btn-primary">Back to Login</button>
            </div>
        </div>
    `;

    document.getElementById('ft_transcendence').innerHTML = content;

    document.getElementById('backToLogin').addEventListener('click', () => {
        navigateTo('/login');
    });
}
