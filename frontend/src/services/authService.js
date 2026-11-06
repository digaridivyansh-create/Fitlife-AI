const API_BASE = '/api/auth'

async function request(endpoint, options = {}) {
  const { token, headers, ...rest } = options

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: {
      ...(rest.body !== undefined && rest.body !== null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(
      data.error || data.message || `Request failed (${response.status})`,
    )
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export const authService = {
  register: ({ email, password }) =>
    request('/register', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    }),

  login: ({ email, password }) =>
    request('/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    }),

  getCurrentUser: (token) =>
    request('/me', { method: 'GET', token }),

  getProfile: (token) =>
    request('/profile', { method: 'GET', token }),

  updateProfile: (token, profile) =>
    request('/profile', {
      method: 'PUT',
      token,
      body: JSON.stringify(profile),
    }),
}
