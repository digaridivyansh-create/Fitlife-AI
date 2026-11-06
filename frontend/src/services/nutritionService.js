const API_BASE = '/api/nutrition'

async function request(endpoint, options = {}) {
  const { token, body, headers = {}, ...rest } = options
  const isFormData = body instanceof FormData

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    body,
    headers: {
      ...(!isFormData && body != null
        ? { 'Content-Type': 'application/json' }
        : {}),
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
      `Nutrition request failed (${response.status})`,
    )

    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export const nutritionService = {
  analyze(token, imageFile) {
    const formData = new FormData()
    formData.append('image', imageFile)

    return request('/analyze', {
      method: 'POST',
      token,
      body: formData,
    })
  },

  confirm(token, payload) {
    return request('/confirm', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    })
  },

  getHistory(token, page = 1, limit = 10) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })

    return request(`/history?${params.toString()}`, {
      method: 'GET',
      token,
    })
  },

  getMeal(token, id) {
    return request(`/history/${encodeURIComponent(id)}`, {
      method: 'GET',
      token,
    })
  },
}
