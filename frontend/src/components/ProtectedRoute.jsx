import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const {
    isAuthenticated,
    loading,
    sessionError,
    retrySession,
  } = useAuth()

  const location = useLocation()

  if (loading) {
    return (
      <main className="auth-loading-screen" aria-live="polite">
        <div className="auth-loading-orb">
          <span />
        </div>
        <p>Verifying your FitLife session...</p>
      </main>
    )
  }

  if (sessionError) {
    return (
      <main className="auth-loading-screen" role="alert">
        <div className="auth-error-panel">
          <h1>Connection interrupted</h1>
          <p>{sessionError}</p>
          <button type="button" onClick={retrySession}>
            Try again
          </button>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  return <Outlet />
}
