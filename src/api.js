// API client for backend communication

const API_BASE = 'http://localhost:3000/api';

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

async function apiRequest(endpoint, method = 'GET', body = null, authRequired = true) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (authRequired && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (response.status === 401) {
      setAuthToken(null);
      throw new Error('Authentication required');
    }
    
    if (response.status === 403) {
      setAuthToken(null);
      throw new Error('Invalid or expired token');
    }

    // Get response text first (can only be read once)
    const text = await response.text();
    const contentType = response.headers.get('content-type');
    
    // Check response status first - for successful responses, be lenient with Content-Type
    if (response.ok) {
      if (!text || text.trim() === '') {
        // Empty successful response
        return {};
      }
      // Try to parse as JSON regardless of Content-Type for successful responses
      // Many servers omit Content-Type or return it incorrectly
      try {
        return JSON.parse(text);
      } catch (parseError) {
        // If it's not JSON but response is OK, it might be plain text success message
        // Log warning but don't fail - return empty object as fallback
        console.warn('Response is not JSON but status is OK:', text.substring(0, 100));
        return {};
      }
    } else {
      // For error responses, parse based on Content-Type or try JSON
      let data;
      if (contentType && contentType.includes('application/json')) {
        if (!text || text.trim() === '') {
          throw new Error(`Request failed with status ${response.status}`);
        }
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('JSON parse error:', parseError, 'Response text:', text);
          throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
        }
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      } else {
        // Non-JSON error response - use text directly
        throw new Error(text || `Request failed with status ${response.status}`);
      }
    }
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      throw new Error('Cannot connect to server. Make sure backend is running.');
    }
    if (error.message.includes('JSON')) {
      throw new Error(`Server response error: ${error.message}`);
    }
    throw error;
  }
}

// Auth API
export const authAPI = {
  async register(email, password) {
    const data = await apiRequest('/auth/register', 'POST', { email, password }, false);
    setAuthToken(data.token);
    return data;
  },

  async login(email, password) {
    const data = await apiRequest('/auth/login', 'POST', { email, password }, false);
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
    return Array.isArray(data) ? data : (data.graphs || []);
  },

  async getById(id) {
    return await apiRequest(`/graphs/${id}`);
  },

  async create(name, config) {
    return await apiRequest('/graphs', 'POST', { name, config });
  },

  async update(id, updates) {
    return await apiRequest(`/graphs/${id}`, 'PUT', updates);
  },

  async delete(id) {
    return await apiRequest(`/graphs/${id}`, 'DELETE');
  },

  async shareWithUser(graphId, email) {
    return await apiRequest(`/graphs/${graphId}/share`, 'POST', { email });
  },

  async getShareLink(graphId) {
    return await apiRequest(`/graphs/${graphId}/share-link`, 'POST');
  },

  async getByShareToken(token) {
    return await apiRequest(`/graphs/share/${token}`, 'GET', null, false);
  },
};

