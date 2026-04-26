
// Subida de archivos (multipart/form-data) — no establece Content-Type para que el navegador añada el boundary
async function apiUpload(url, formData) {
    const headers = { 'X-CSRF-Token': getCsrfToken() ?? '' };
    try {
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: formData,
        });
        if (res.status === 401) {
            window.location.href = 'login.html';
            return { success: false };
        }
        const text = await res.text();
        if (!text) return { success: res.ok };
        try { return JSON.parse(text); } catch { return { success: false, message: 'Respuesta inválida' }; }
    } catch {
        showToast('Error de conexión');
        return { success: false };
    }
}

async function api(url, methodOrOptions = 'GET', data = null) {
    const isOptionsObject = typeof methodOrOptions === 'object' && methodOrOptions !== null;
    const method = isOptionsObject ? (methodOrOptions.method || 'GET') : methodOrOptions;
    const payload = isOptionsObject ? (methodOrOptions.data ?? data) : data;

    const options = {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
    };

    if (isOptionsObject && methodOrOptions.headers) {
        options.headers = { ...options.headers, ...methodOrOptions.headers };
    }

    // Adjuntar token CSRF en toda petición de escritura
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
        options.headers['X-CSRF-Token'] = getCsrfToken() ?? '';
    }

    if (isOptionsObject && Object.prototype.hasOwnProperty.call(methodOrOptions, 'body')) {
        options.body = methodOrOptions.body;
    } else if (payload != null) {
        options.body = JSON.stringify(payload);
    }

    try {
        const res = await fetch(url, options);

        // Sesión expirada: redirigir sin mostrar error de conexión
        if (res.status === 401) {
            window.location.href = 'login.html';
            return { success: false, data: [] };
        }

        const text = await res.text();

        if (!text) {
            return { success: res.ok, data: [] };
        }

        try {
            return JSON.parse(text);
        } catch (e) {
            return {
                success: false,
                message: 'La respuesta del servidor no es JSON válido',
                raw: text,
            };
        }
    } catch (e) {
        showToast('Error de conexión');
        return { success: false, data: [] };
    }
}
