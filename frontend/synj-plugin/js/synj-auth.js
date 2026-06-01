// SYNJ — Auth global (chargé sur toutes les pages)

// 1. Si PHP vient d'injecter de nouveaux tokens → les sauvegarder en sessionStorage
if (window.__SYNJ_ACCESS_TOKEN__) {
    sessionStorage.setItem('synj_access',  window.__SYNJ_ACCESS_TOKEN__);
    sessionStorage.setItem('synj_refresh', window.__SYNJ_REFRESH_TOKEN__);
    delete window.__SYNJ_ACCESS_TOKEN__;
    delete window.__SYNJ_REFRESH_TOKEN__;
}

// 2. Proxy sur sessionStorage — survit aux changements de page dans le même onglet
window.__synj = {
    get accessToken()   { return sessionStorage.getItem('synj_access');  },
    get refreshToken()  { return sessionStorage.getItem('synj_refresh'); },
    set accessToken(v)  { sessionStorage.setItem('synj_access', v);  },
    set refreshToken(v) { sessionStorage.setItem('synj_refresh', v); },
    clear() {
        sessionStorage.removeItem('synj_access');
        sessionStorage.removeItem('synj_refresh');
    },
    get isLoggedIn() { return !!sessionStorage.getItem('synj_access'); },
};

// 3. Refresh tokens
async function refreshTokens() {
    const res = await fetch(window.__SYNJ_API_BASE + '/auth/refresh', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: window.__synj.refreshToken }),
    });
    const data = await res.json();
    if (data.accessToken) {
        window.__synj.accessToken  = data.accessToken;
        window.__synj.refreshToken = data.refreshToken;
        return true;
    }
    window.__synj.clear();
    window.location.href = '/connexion';
    return false;
}

// 4. Fonction centralisée pour les appels aux routes protégées
async function apiCall(method, path, body = null) {
    const res = await fetch(window.__SYNJ_API_BASE + path, {
        method,
        headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + window.__synj.accessToken,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
        const data = await res.json();
        if (data.error?.code === 'TOKEN_INVALID') {
            const refreshed = await refreshTokens();
            if (!refreshed) return null;
            return apiCall(method, path, body);
        }
    }

    return res.json();
}
