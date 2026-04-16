
// Usuario y token CSRF en memoria — se cargan una sola vez al iniciar app.html
let _currentUser = null;
let _csrfToken   = null;

// Devuelve el usuario en memoria (disponible tras initAuth)
function getUser() { return _currentUser; }

// Devuelve el token CSRF en memoria (disponible tras initAuth)
function getCsrfToken() { return _csrfToken; }

/**
 * Verifica la sesión consultando el servidor.
 * - Si hay sesión activa: guarda el usuario en _currentUser y lo devuelve.
 * - Si no hay sesión: redirige a login.html y devuelve null.
 * Debe llamarse con await al inicio de app.html.
 */
async function initAuth() {
    try {
        const res = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'same-origin'
        });

        if (!res.ok) {
            window.location.href = 'login.html';
            return null;
        }

        const json = await res.json();

        if (!json.success) {
            window.location.href = 'login.html';
            return null;
        }

        _currentUser = json.data;
        _csrfToken   = json.csrf ?? null;
        return _currentUser;

    } catch (e) {
        window.location.href = 'login.html';
        return null;
    }
}

// Llamada desde login.html
async function login() {
    const dni      = document.getElementById('dni').value.trim();
    const password = document.getElementById('password').value;

    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('btnLogin').disabled = true;
    document.getElementById('error').innerText = '';

    try {
        const res  = await fetch('/api/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, password })
        });
        const json = await res.json();

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('btnLogin').disabled = false;

        if (json.success) {
            window.location.href = 'app.html';
        } else {
            document.getElementById('error').innerText = json.message;
        }
    } catch (e) {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('btnLogin').disabled = false;
        document.getElementById('error').innerText = 'Error de conexión';
    }
}

// Llamada desde app.html (botón / nav)
function logout() {
    fetch('/api/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': _csrfToken ?? '' }
    }).finally(() => {
        window.location.href = 'login.html';
    });
}
