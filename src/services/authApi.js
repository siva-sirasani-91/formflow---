const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

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
