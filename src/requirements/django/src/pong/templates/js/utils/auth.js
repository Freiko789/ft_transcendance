export async function checkAuthentication() {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        return false;
    }

    try {
        const response = await fetch('/api/verify-token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (response.ok) {
            return true;
        } else {
            sessionStorage.removeItem('accessToken');
            return false;
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
        return false;
    }
}
