import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { authService } from '../services/authService'

const AuthContext = createContext(null)
const TOKEN_KEY = 'fitlife_auth_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState(null)
  const [sessionCheckKey, setSessionCheckKey] = useState(0)

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setSessionError(null)
    setLoading(false)
  }, [])

  const establishSession = useCallback((authResponse) => {
    if (!authResponse?.token || !authResponse?.user) {
      throw new Error('The server returned an invalid authentication response.')
    }

    sessionStorage.setItem(TOKEN_KEY, authResponse.token)
    setToken(authResponse.token)
    setUser(authResponse.user)
    setSessionError(null)
    setLoading(false)

    return authResponse.user
  }, [])

  const login = useCallback(async (credentials) => {
    const response = await authService.login(credentials)
    establishSession(response)
    return response.user
  }, [establishSession])

  const register = useCallback(async (details) => {
    const response = await authService.register(details)
    establishSession(response)
    return response.user
  }, [establishSession])

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null)
      return null
    }

    try {
      const response = await authService.getCurrentUser(token)
      setUser(response.user)
      setSessionError(null)
      return response.user
    } catch (error) {
      if (error.status === 401 || error.status === 404) {
        logout()
      } else {
        setSessionError('Unable to verify your session. Check your connection and try again.')
      }

      throw error
    }
  }, [token, logout])

  const retrySession = useCallback(() => {
    setSessionError(null)
    setLoading(true)
    setSessionCheckKey((current) => current + 1)
  }, [])

  useEffect(() => {
    let active = true

    async function verifySession() {
      if (!token) {
        if (active) {
          setUser(null)
          setSessionError(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setSessionError(null)

      try {
        const response = await authService.getCurrentUser(token)

        if (active) {
          setUser(response.user)
        }
      } catch (error) {
        if (active) {
          if (error.status === 401 || error.status === 404) {
            sessionStorage.removeItem(TOKEN_KEY)
            setToken(null)
            setUser(null)
          } else {
            setSessionError(
              'Unable to verify your session. Check your connection and try again.',
            )
          }
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    verifySession()

    return () => {
      active = false
    }
  }, [token, sessionCheckKey])

  const value = useMemo(() => ({
    user,
    token,
    loading,
    sessionError,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    refreshUser,
    retrySession,
  }), [
    user,
    token,
    loading,
    sessionError,
    login,
    register,
    logout,
    refreshUser,
    retrySession,
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// This custom hook is intentionally exported beside AuthProvider.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.')
  }

  return context
}
