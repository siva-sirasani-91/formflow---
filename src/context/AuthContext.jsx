import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/authApi.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'formflow_auth_token';
const USER_KEY = 'formflow_auth_user';

function readStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
}

function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(() => Boolean(readStoredToken()));

  useEffect(() => {
    let active = true;
    const handleUnauthorized = () => {
      if (active) clearSession();
    };
    window.addEventListener('formflow:unauthorized', handleUnauthorized);

    const currentToken = readStoredToken();
    if (!currentToken) {
      setLoading(false);
      return () => {
        active = false;
        window.removeEventListener('formflow:unauthorized', handleUnauthorized);
      };
    }

    authApi
      .getCurrentUser(currentToken)
      .then((res) => {
        if (!active) return;
        updateUser(res.user);
      })
      .catch((err) => {
        if (!active) return;
        if (err?.status === 401 || err?.status === 403) {
          clearSession();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener('formflow:unauthorized', handleUnauthorized);
    };
  }, []);

  function saveSession(nextToken, nextUser, rememberMe = true) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, nextToken);
    storage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken('');
    setUser(null);
  }

  async function login(credentials) {
    const res = await authApi.login(credentials);
    saveSession(res.token, res.user, Boolean(credentials.rememberMe));
    return res;
  }

  async function register(payload) {
    const res = await authApi.register(payload);
    saveSession(res.token, res.user, true);
    return res;
  }

  function logout() {
    const currentToken = readStoredToken();
    if (currentToken) {
      authApi.logout(currentToken).catch(() => {});
    }
    clearSession();
  }

  function updateUser(nextUser) {
    setUser(nextUser);
    if (localStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else if (sessionStorage.getItem(TOKEN_KEY)) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    }
  }

  const value = {
    token,
    user,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
