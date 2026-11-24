const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function getToken() {
  return localStorage.getItem('formflow_auth_token') || sessionStorage.getItem('formflow_auth_token') || '';
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('formflow:unauthorized'));
    }
    const err = new Error(payload.message || 'Workspace request failed.');
    err.status = res.status;
    throw err;
  }

  return payload;
}

export const workspaceApi = {
  getBusinesses: () => apiRequest('/api/businesses'),
  getBusiness: (id) => apiRequest(`/api/businesses/${id}`),
  getDeletedBusinesses: () => apiRequest('/api/businesses/recycle-bin'),
  createBusiness: (data) =>
    apiRequest('/api/businesses', { method: 'POST', body: JSON.stringify(data) }),
  updateBusiness: (id, data) =>
    apiRequest(`/api/businesses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  archiveBusiness: (id) =>
    apiRequest(`/api/businesses/${id}/archive`, { method: 'POST' }),
  restoreBusiness: (id) =>
    apiRequest(`/api/businesses/${id}/restore`, { method: 'POST' }),
  deleteBusiness: (id) =>
    apiRequest(`/api/businesses/${id}`, { method: 'DELETE' }),
  permanentDeleteBusiness: (id) =>
    apiRequest(`/api/businesses/${id}/permanent`, { method: 'DELETE' }),

  getRecords: () => apiRequest('/api/records'),
  getRecycleBin: () => apiRequest('/api/records/recycle-bin'),
  createRecord: (data) =>
    apiRequest('/api/records', { method: 'POST', body: JSON.stringify(data) }),
  updateRecord: (id, data) =>
    apiRequest(`/api/records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecord: (id) =>
    apiRequest(`/api/records/${id}`, { method: 'DELETE' }),
  restoreRecord: (id) =>
    apiRequest(`/api/records/${id}/restore`, { method: 'POST' }),
  permanentDeleteRecord: (id) =>
    apiRequest(`/api/records/${id}/permanent`, { method: 'DELETE' }),

  getProfile: () => apiRequest('/api/profile'),
  updateProfile: (data) =>
    apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data) =>
    apiRequest('/api/profile/change-password', { method: 'POST', body: JSON.stringify(data) }),

  getSettings: () => apiRequest('/api/settings'),
  updateSettings: (data) =>
    apiRequest('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  backupNow: () =>
    apiRequest('/api/settings/backup-now', { method: 'POST' }),

  getTickets: () => apiRequest('/api/tickets'),
  createTicket: (data) =>
    apiRequest('/api/tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateTicketStatus: (id, status) =>
    apiRequest(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  globalSearch: (query) =>
    apiRequest(`/api/search?q=${encodeURIComponent(query)}`),

  getTableRecordsReport: ({
    businessId,
    tableField = '',
    q = '',
    startDate = '',
    endDate = '',
    page = 1,
    pageSize = 25,
    signal,
  } = {}) => {
    const params = new URLSearchParams();
    if (businessId !== undefined && businessId !== null && businessId !== '') {
      params.set('businessId', String(businessId));
    }
    if (tableField) params.set('tableField', String(tableField));
    if (q) params.set('q', String(q));
    if (startDate) params.set('startDate', String(startDate));
    if (endDate) params.set('endDate', String(endDate));
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return apiRequest(`/api/reports/table-records?${params.toString()}`, { signal });
  },

  getReportsOverview: ({
    businessId = 'all',
    startDate = '',
    endDate = '',
    paymentMethod = 'all',
    q = '',
    page = 1,
    pageSize = 25,
    signal,
  } = {}) => {
    const params = new URLSearchParams();
    params.set('businessId', String(businessId || 'all'));
    if (startDate) params.set('startDate', String(startDate));
    if (endDate) params.set('endDate', String(endDate));
    if (paymentMethod && paymentMethod !== 'all') params.set('paymentMethod', String(paymentMethod));
    if (q) params.set('q', String(q));
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return apiRequest(`/api/reports/overview?${params.toString()}`, { signal });
  },
};
