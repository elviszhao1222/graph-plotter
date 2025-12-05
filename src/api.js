// API client for backend communication

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

let authToken = localStorage.getItem('auth_token') || null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken() {
  return authToken || localStorage.getItem('auth_token');
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      setAuthToken(null);
      throw new Error('Authentication required');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      throw new Error('Cannot connect to server. Make sure backend is running.');
    }
    throw error;
  }
}

// Auth API
export const authAPI = {
  async register(email, password) {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async login(email, password) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async getCurrentUser() {
    return await apiRequest('/auth/me');
  },

  logout() {
    setAuthToken(null);
  },
};

// Graphs API
export const graphsAPI = {
  async getAll() {
    const data = await apiRequest('/graphs');
    return data.graphs;
  },

  async getById(id) {
    return await apiRequest(`/graphs/${id}`);
  },

  async create(name, config) {
    return await apiRequest('/graphs', {
      method: 'POST',
      body: JSON.stringify({ name, config }),
    });
  },

  async update(id, updates) {
    return await apiRequest(`/graphs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async delete(id) {
    return await apiRequest(`/graphs/${id}`, {
      method: 'DELETE',
    });
  },

  async shareWithUser(graphId, email) {
    return await apiRequest(`/graphs/${graphId}/share`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async getShareLink(graphId) {
    return await apiRequest(`/graphs/${graphId}/share-link`);
  },

  async getByShareToken(token) {
    return await apiRequest(`/graphs/share/${token}`);
  },
};

