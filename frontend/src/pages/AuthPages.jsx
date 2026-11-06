import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

function AuthLayout({ children, title, subtitle, mode }) {
  return (
    <main className="auth-page">
      <div className="auth-background-glow" />
      <Link to="/" className="auth-brand">
        <span className="auth-brand-icon"><Activity size={22} /></span>
        <span>fitlife<span>.</span><small>AI</small></span>
      </Link>

      <div className="auth-layout">
        <section className="auth-story">
          <div className="auth-story-label"><Sparkles size={15} /> YOUR PERSONAL FITNESS JOURNEY</div>
          <h1>Small steps.<br /><span>Stronger you.</span></h1>
          <p>Your fitness journey deserves a smarter approach. Build consistency, understand your progress, and move forward with confidence.</p>
          <div className="auth-benefits">
            <div><ShieldCheck size={19} /><span>Your data stays private and secure</span></div>
            <div><Activity size={19} /><span>Personalized fitness intelligence</span></div>
            <div><Sparkles size={19} /><span>Progress built around your goals</span></div>
          </div>
          <div className="auth-story-orbit"><div /><div /><div /></div>
        </section>

        <motion.section
          className="auth-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="auth-card-heading">
            <span className="auth-eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'START YOUR JOURNEY'}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          {children}
        </motion.section>
      </div>
      <footer className="auth-footer">© {new Date().getFullYear()} FitLife AI · Built for your journey.</footer>
    </main>
  )
}

function AuthInput({ label, type = 'text', value, onChange, placeholder, autoComplete, icon: Icon, error, right }) {
  return (
    <div className="auth-field">
      <label>{label}</label>
      <div className={`auth-input-wrap ${error ? 'has-error' : ''}`}>
        <Icon size={18} />
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          aria-invalid={Boolean(error)}
        />
        {right}
      </div>
      {error && <span className="auth-field-error">{error}</span>}
    </div>
  )
}

function PasswordField({ label, value, onChange, autoComplete, error }) {
  const [visible, setVisible] = useState(false)
  return (
    <AuthInput
      label={label}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder="At least 8 characters"
      autoComplete={autoComplete}
      icon={LockKeyhole}
      error={error}
      right={
        <button
          className="auth-password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    />
  )
}

function AuthNotice({ message }) {
  if (!message) return null
  return <div className="auth-notice" role="alert">{message}</div>
}

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const normalizedEmail = email.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    setBusy(true)
    try {
      await login({ email: normalizedEmail, password })
      const destination = location.state?.from?.pathname || '/dashboard'
      navigate(destination, { replace: true })
    } catch (err) {
      if (err.status === 401) setError('Email or password is incorrect.')
      else if (err.status === 429) setError('Too many attempts. Please wait a minute and try again.')
      else if (!err.status) setError('Unable to reach FitLife AI. Check that the backend is running.')
      else setError(err.message || 'Login failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout mode="login" title="Welcome back." subtitle="Sign in to continue building your strongest self.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthNotice message={error} />
        <AuthInput label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" icon={Mail} />
        <PasswordField label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Signing you in...' : 'Sign in to your account'}
          {!busy && <ArrowRight size={18} />}
        </button>
      </form>
      <div className="auth-switch">New to FitLife AI? <Link to="/register">Create an account <ArrowRight size={15} /></Link></div>
      <div className="auth-secure-note"><LockKeyhole size={14} /> Secure authentication · Your account is protected</div>
    </AuthLayout>
  )
}

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const normalizedEmail = email.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 8 || password.length > 128) {
      setError('Password must contain between 8 and 128 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await register({ email: normalizedEmail, password })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err.status === 409) setError('An account with this email already exists. Please sign in instead.')
      else if (err.status === 429) setError('Too many registration attempts. Please wait a minute and try again.')
      else if (!err.status) setError('Unable to reach FitLife AI. Check that the backend is running.')
      else setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout mode="register" title="Create your account." subtitle="One account. A smarter way to work toward your goals.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthNotice message={error} />
        <AuthInput label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" icon={Mail} />
        <PasswordField label="Create password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <PasswordField label="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        <p className="auth-password-hint">Use 8–128 characters. Choose a password you don't use elsewhere.</p>
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Creating your account...' : 'Create my account'}
          {!busy && <ArrowRight size={18} />}
        </button>
      </form>
      <div className="auth-switch">Already have an account? <Link to="/login">Sign in <ArrowRight size={15} /></Link></div>
      <div className="auth-secure-note"><LockKeyhole size={14} /> Your password is securely hashed by our backend</div>
    </AuthLayout>
  )
}
