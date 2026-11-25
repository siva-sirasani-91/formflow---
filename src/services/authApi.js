const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (networkErr) {
    if (networkErr?.name === 'AbortError') {
      throw networkErr;
    }
    const error = new Error(
      'Unable to connect to the backend server. Please verify Spring Boot and MySQL are running.'
    );
    error.status = 0;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const error = new Error(
      'Unable to connect to the Spring Boot backend. Please verify Spring Boot and MySQL are running.'
    );
    error.status = response.status === 200 ? 503 : response.status;
    throw error;
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.message || 'Request failed. Please try again.');
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const authApi = {
  login(credentials) {
    return requestJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  register(data) {
    return requestJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  logout(token) {
    return requestJson('/api/auth/logout', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
  forgotPassword(email) {
    return requestJson('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  resetPassword({ token, newPassword }) {
    return requestJson('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },
  getCurrentUser(token) {
    return requestJson('/api/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
};
