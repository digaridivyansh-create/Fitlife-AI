const API_BASE = '/api/form-analysis'

async function request(endpoint, options = {}) {
  const { token, body, headers = {}, ...rest } = options
  const isFormData = body instanceof FormData

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    ...(body !== undefined ? { body } : {}),
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
      `Form analysis request failed (${response.status})`,
    )

    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export const formAnalysisService = {
  analyzeVideo(token, videoFile) {
    const formData = new FormData()
    formData.append('video', videoFile)

    return request('/analyze-video', {
      method: 'POST',
      token,
      body: formData,
    })
  },
}
