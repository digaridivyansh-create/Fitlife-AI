import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bot,
  Plus,
  Send,
  Trash2,
  MessageCircle,
  Sparkles,
  UserRound,
  LoaderCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { chatService } from '../services/chatService'
import FeatureSidebar from '../components/FeatureSidebar.jsx'
import './Chatbot.css'

const SUGGESTIONS = [
  'Create a beginner-friendly workout plan.',
  'How can I improve my daily protein intake?',
  'What should I eat before a workout?',
  'How can I stay consistent with fitness?',
]

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function Chatbot() {
  const { token } = useAuth()

  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const pendingMessageIdRef = useRef(0)

  const loadConversations = useCallback(async () => {
    if (!token) return

    setLoadingConversations(true)
    setError('')

    try {
      const response = await chatService.getConversations(token)
      const items = response.conversations || []
      setConversations(items)

      setSelectedId((current) => {
        if (current && items.some((item) => item.id === current)) {
          return current
        }
        return items[0]?.id ?? null
      })
    } catch (err) {
      setError(err.message || 'Could not load your conversations.')
    } finally {
      setLoadingConversations(false)
    }
  }, [token])

  useEffect(() => {
    let active = true

    Promise.resolve().then(() => {
      if (active) loadConversations()
    })

    return () => {
      active = false
    }
  }, [loadConversations])

  useEffect(() => {
    let active = true

    const loadMessages = async () => {
      if (!token || !selectedId) {
        setMessages([])
        setLoadingMessages(false)
        return
      }

      setLoadingMessages(true)
      setError('')

      try {
        const response = await chatService.getMessages(token, selectedId)
        if (active) setMessages(response.messages || [])
      } catch (err) {
        if (active) {
          setError(err.message || 'Could not load this conversation.')
        }
      } finally {
        if (active) setLoadingMessages(false)
      }
    }

    Promise.resolve().then(() => {
      if (active) return loadMessages()
      return undefined
    })

    return () => {
      active = false
    }
  }, [token, selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  const startNewConversation = async () => {
    if (!token || creating) return

    setCreating(true)
    setError('')
    setNotice('')

    try {
      const response = await chatService.createConversation(token)
      const conversation = response.conversation

      if (!conversation?.id) {
        throw new Error('The server did not return a conversation ID.')
      }

      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ])
      setSelectedId(conversation.id)
      setMessages([])
      setDraft('')
      textareaRef.current?.focus()
    } catch (err) {
      setError(err.message || 'Could not start a new conversation.')
    } finally {
      setCreating(false)
    }
  }

  const sendMessage = async (value = draft) => {
    const message = value.trim()

    if (!message || !token || sending || message.length > 4000) return

    setError('')
    setNotice('')
    setDraft('')
    setSending(true)

    let conversationId = selectedId

    try {
      if (!conversationId) {
        const created = await chatService.createConversation(token)
        conversationId = created.conversation?.id

        if (!conversationId) {
          throw new Error('Could not create a conversation.')
        }

        setSelectedId(conversationId)
        setConversations((current) => [
          created.conversation,
          ...current,
        ])
      }

      const temporaryMessage = {
        id: `pending-${++pendingMessageIdRef.current}`,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      }

      setMessages((current) => [...current, temporaryMessage])

      const response = await chatService.sendMessage(
        token,
        conversationId,
        message,
      )

      setMessages((current) => [
        ...current.filter((item) => !String(item.id).startsWith('pending-')),
        response.user_message,
        response.assistant_message,
      ].filter(Boolean))

      await loadConversations()
    } catch (err) {
      setError(err.message || 'Your message could not be sent.')
      setDraft(message)
      if (conversationId) {
        try {
          const response = await chatService.getMessages(token, conversationId)
          setMessages(response.messages || [])
        } catch {
          // Keep the current messages visible if history reload also fails.
        }
      }
    } finally {
      setSending(false)
    }
  }

  const deleteConversation = async (conversationId) => {
    if (!token || deletingId) return

    const confirmed = window.confirm(
      'Delete this conversation permanently? This cannot be undone.',
    )
    if (!confirmed) return

    setDeletingId(conversationId)
    setError('')
    setNotice('')

    try {
      await chatService.deleteConversation(token, conversationId)

      const remaining = conversations.filter(
        (item) => item.id !== conversationId,
      )

      setConversations(remaining)

      if (selectedId === conversationId) {
        setSelectedId(remaining[0]?.id ?? null)
        setMessages([])
      }

      setNotice('Conversation deleted.')
    } catch (err) {
      setError(err.message || 'Could not delete this conversation.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    sendMessage()
  }

  const handleTextareaKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="auth-page chatbot-page">
      <div className="auth-background-glow" />

      <main className="chatbot-shell">
        <header className="chatbot-page-heading">
          <div>
            <span className="auth-eyebrow">
              <Sparkles size={14} /> YOUR PERSONAL FITNESS ASSISTANT
            </span>
            <h1>Fitness AI <span>Chatbot</span></h1>
            <p>
              Ask questions about workouts, nutrition, recovery, and healthy
              habits. Your assistant can use your available FitLife profile
              and activity context.
            </p>
          </div>
          <div className="chatbot-heading-icon">
            <Bot size={32} />
          </div>
        </header>

        <div className="feature-workspace-layout chatbot-workspace">
          <FeatureSidebar />

          <section className="chatbot-main" aria-label="Fitness AI chat">
            <aside className="chatbot-history">
              <div className="chatbot-history-heading">
                <div>
                  <span className="chatbot-section-label">YOUR HISTORY</span>
                  <h2>Conversations</h2>
                </div>
                <button
                  className="chatbot-new-button"
                  type="button"
                  onClick={startNewConversation}
                  disabled={creating}
                  aria-label="Start a new conversation"
                  title="New conversation"
                >
                  {creating
                    ? <LoaderCircle size={17} className="chatbot-spin" />
                    : <Plus size={18} />}
                </button>
              </div>

              <button
                className="chatbot-new-chat"
                type="button"
                onClick={startNewConversation}
                disabled={creating}
              >
                <Plus size={16} />
                New conversation
              </button>

              <div className="chatbot-history-list">
                {loadingConversations ? (
                  <div className="chatbot-history-empty">
                    <LoaderCircle size={17} className="chatbot-spin" />
                    Loading history...
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="chatbot-history-empty">
                    <MessageCircle size={20} />
                    <span>Your conversations will appear here.</span>
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      className={`chatbot-history-item${selectedId === conversation.id ? ' selected' : ''}`}
                      key={conversation.id}
                    >
                      <button
                        type="button"
                        className="chatbot-history-select"
                        onClick={() => {
                          setSelectedId(conversation.id)
                          setNotice('')
                        }}
                      >
                        <MessageCircle size={16} />
                        <span>
                          <strong>{conversation.title || 'New conversation'}</strong>
                          <small>{formatDate(conversation.updated_at || conversation.created_at)}</small>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="chatbot-delete-button"
                        onClick={() => deleteConversation(conversation.id)}
                        disabled={deletingId === conversation.id}
                        aria-label="Delete conversation"
                        title="Delete conversation"
                      >
                        {deletingId === conversation.id
                          ? <LoaderCircle size={15} className="chatbot-spin" />
                          : <Trash2 size={15} />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </aside>

            <div className="chatbot-panel">
              <div className="chatbot-panel-topbar">
                <div className="chatbot-assistant-identity">
                  <span className="chatbot-assistant-avatar"><Bot size={19} /></span>
                  <span>
                    <strong>FitLife AI Assistant</strong>
                    <small><i /> Ready to help</small>
                  </span>
                </div>
                <span className="chatbot-secure-label">PRIVATE SESSION</span>
              </div>

              {error && (
                <div className="chatbot-alert chatbot-alert-error" role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
                </div>
              )}

              {notice && (
                <div className="chatbot-alert chatbot-alert-success" role="status">
                  {notice}
                </div>
              )}

              <div className="chatbot-messages" aria-live="polite">
                {loadingMessages ? (
                  <div className="chatbot-loading">
                    <LoaderCircle size={22} className="chatbot-spin" />
                    Loading conversation...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chatbot-welcome">
                    <div className="chatbot-welcome-icon"><Sparkles size={25} /></div>
                    <span className="chatbot-section-label">LET'S GET STARTED</span>
                    <h2>Your fitness journey,<br /><span>with an AI partner.</span></h2>
                    <p>
                      Ask me about training, nutrition, recovery, or building
                      habits. I’ll help you make informed, practical choices.
                    </p>
                    <div className="chatbot-suggestions">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          type="button"
                          key={suggestion}
                          onClick={() => sendMessage(suggestion)}
                          disabled={sending || loadingMessages}
                        >
                          <Sparkles size={14} />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="chatbot-message-list">
                    {messages.map((message) => {
                      const isAssistant = message.role === 'assistant'

                      return (
                        <article
                          className={`chatbot-message${isAssistant ? ' assistant' : ' user'}`}
                          key={message.id}
                        >
                          <span className="chatbot-message-avatar">
                            {isAssistant ? <Bot size={17} /> : <UserRound size={17} />}
                          </span>
                          <div className="chatbot-message-content">
                            <div className="chatbot-message-meta">
                              <strong>{isAssistant ? 'FitLife AI' : 'You'}</strong>
                              <time>{formatDate(message.created_at)}</time>
                            </div>
                            <p>{message.content}</p>
                          </div>
                        </article>
                      )
                    })}
                    {sending && (
                      <div className="chatbot-typing">
                        <span /><span /><span />
                        FitLife AI is thinking...
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <form className="chatbot-composer" onSubmit={handleSubmit}>
                <div className="chatbot-input-wrap">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Ask your fitness question..."
                    rows={2}
                    maxLength={4000}
                    disabled={sending || loadingMessages}
                    aria-label="Your message"
                  />
                  <div className="chatbot-composer-footer">
                    <span>{draft.length}/4000 · Enter to send, Shift + Enter for a new line</span>
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending || loadingMessages}
                      aria-label="Send message"
                    >
                      {sending
                        ? <LoaderCircle size={17} className="chatbot-spin" />
                        : <Send size={17} />}
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </form>
              <p className="chatbot-disclaimer">
                AI responses can be imperfect. For medical concerns, consult a qualified healthcare professional.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}



