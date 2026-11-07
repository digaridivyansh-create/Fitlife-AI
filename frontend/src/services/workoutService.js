const API_BASE = '/api/workouts'

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
      data.error || data.message || data.detail || `Request failed (${response.status})`,
    )
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export const workoutService = {
  generate: (token, workoutRequest) =>
    request('/generate', {
      method: 'POST',
      token,
      body: JSON.stringify(workoutRequest),
    }),

  getPlans: (token, limit = 20, offset = 0) =>
    request(`?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      token,
    }),

  getPlan: (token, id) =>
    request(`/${encodeURIComponent(id)}`, {
      method: 'GET',
      token,
    }),

  // Generative AI Workout Coach
  createProposal: (token, planId, changeRequest) =>
    request(`/${encodeURIComponent(planId)}/proposals`, {
      method: 'POST',
      token,
      body: JSON.stringify({ change_request: changeRequest }),
    }),

  getProposals: (token, limit = 20, offset = 0) =>
    request(`/proposals?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      token,
    }),

  approveProposal: (token, proposalId) =>
    request(`/proposals/${encodeURIComponent(proposalId)}/approve`, {
      method: 'POST',
      token,
    }),

  rejectProposal: (token, proposalId) =>
    request(`/proposals/${encodeURIComponent(proposalId)}/reject`, {
      method: 'POST',
      token,
    }),
}
