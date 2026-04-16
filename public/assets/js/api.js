
async function api(url, method = 'GET', data = null) {
    const options = {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
    };

    // Adjuntar token CSRF en toda petición de escritura
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
        options.headers['X-CSRF-Token'] = getCsrfToken() ?? '';
    }

    if (data) options.body = JSON.stringify(data);

    try {
        const res = await fetch(url, options);

        // Sesión expirada: redirigir sin mostrar error de conexión
        if (res.status === 401) {
            window.location.href = 'login.html';
            return { success: false, data: [] };
        }

        return res.json();
    } catch (e) {
        showToast('Error de conexión');
        return { success: false, data: [] };
    }
}
