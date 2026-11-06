const API_BASE = '/api/progress'

async function request(endpoint, options = {}) {
  const { token, body, headers = {}, ...rest } = options

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    ...(body !== undefined ? { body } : {}),
    headers: {
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(
      data.error ||
      data.message ||
      data.detail ||
      `Progress request failed (${response.status})`,
    )

    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

function queryString(params) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const progressService = {
  // Weight measurements
  addWeight(token, payload) {
    return request('/weight', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
  },

  getWeight(token, limit = 30, offset = 0) {
    return request(`/weight${queryString({ limit, offset })}`, {
      method: 'GET',
      token,
    })
  },

  // Completed workouts
  addWorkout(token, payload) {
    return request('/workouts', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
  },

  getWorkouts(token, limit = 30, offset = 0) {
    return request(`/workouts${queryString({ limit, offset })}`, {
      method: 'GET',
      token,
    })
  },

  // Daily habit tracking
  updateDaily(token, payload) {
    return request('/daily', {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    })
  },

  getDaily(token, params = {}) {
    return request(`/daily${queryString(params)}`, {
      method: 'GET',
      token,
    })
  },

  // Aggregated progress summary
  getSummary(token, days = 30) {
    return request(`/summary${queryString({ days })}`, {
      method: 'GET',
      token,
    })
  },

  // AI-generated progress insights
  getInsights(token, days = 30) {
    return request(`/insights${queryString({ days })}`, {
      method: 'GET',
      token,
    })
  },
}
