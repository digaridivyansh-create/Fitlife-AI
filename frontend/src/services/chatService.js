const API_BASE = '/api/chat'

async function request(endpoint, options = {}) {
  const { token, body, headers = {}, ...rest } = options

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    body,
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
      `Chat request failed (${response.status})`,
    )

    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export const chatService = {
  createConversation(token, title) {
    return request('/conversations', {
      method: 'POST',
      token,
      body: JSON.stringify(
        title ? { title } : {},
      ),
    })
  },

  getConversations(token, limit = 20, offset = 0) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })

    return request(`/conversations?${params.toString()}`, {
      method: 'GET',
      token,
    })
  },

  getMessages(token, conversationId, limit = 50, offset = 0) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })

    return request(
      `/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`,
      {
        method: 'GET',
        token,
      },
    )
  },

  sendMessage(token, conversationId, message) {
    return request(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        token,
        body: JSON.stringify({ message }),
      },
    )
  },

  deleteConversation(token, conversationId) {
    return request(
      `/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: 'DELETE',
        token,
      },
    )
  },
}
