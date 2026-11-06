import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, CalendarDays, Check,
  ClipboardList, Dumbbell, HeartPulse, LogOut, Ruler,
  Save, Sparkles, Target, UserRound, Weight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services/authService'
import WorkoutPlanner from '../components/WorkoutPlanner'
import WorkoutCoach from '../components/WorkoutCoach'
import './Auth.css'
import FeatureSidebar from '../components/FeatureSidebar.jsx'

const EMPTY_PROFILE = {
  full_name: '',
  date_of_birth: '',
  height_cm: '',
  weight_kg: '',
  fitness_goal: '',
  activity_level: '',
}

const GOALS = [
  { value: 'weight_loss', label: 'Weight loss', description: 'Build sustainable healthy habits.' },
  { value: 'muscle_gain', label: 'Muscle gain', description: 'Build strength and muscle.' },
  { value: 'endurance', label: 'Improve endurance', description: 'Increase stamina and fitness.' },
  { value: 'general_fitness', label: 'General fitness', description: 'Improve overall wellbeing.' },
]

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', description: 'Mostly sitting, little exercise.' },
  { value: 'lightly_active', label: 'Lightly active', description: 'Light exercise 1â€“3 days/week.' },
  { value: 'moderately_active', label: 'Moderately active', description: 'Exercise 3â€“5 days/week.' },
  { value: 'very_active', label: 'Very active', description: 'Hard exercise 6â€“7 days/week.' },
  { value: 'extra_active', label: 'Extra active', description: 'Very intense training or physical work.' },
]

function toDateInput(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null

  const birth = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())

  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

function Field({ label, icon: Icon, children, hint }) {
  return (
    <div className="profile-field">
      <label>{label}</label>
      <div className="profile-field-control">
        {Icon && <Icon size={17} />}
        {children}
      </div>
      {hint && <small>{hint}</small>}
    </div>
  )
}

export default function Dashboard() {
  const { user, token, logout, refreshUser } = useAuth()

  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editMode, setEditMode] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    setError('')

    try {
      const response = await authService.getProfile(token)
      const saved = response.profile || {}

      setProfile({
        full_name: saved.full_name || '',
        date_of_birth: toDateInput(saved.date_of_birth),
        height_cm: saved.height_cm ?? '',
        weight_kg: saved.weight_kg ?? '',
        fitness_goal: saved.fitness_goal || '',
        activity_level: saved.activity_level || '',
      })
    } catch (err) {
      if (err.status === 401) {
        logout()
        return
      }
      setError(err.message || 'Could not load your profile. Please try again.')
    } finally {
      setLoadingProfile(false)
    }
  }, [token, logout])

  useEffect(() => {
    let active = true

    async function fetchInitialProfile() {
      try {
        const response = await authService.getProfile(token)
        if (!active) return

        const saved = response.profile || {}

        setProfile({
          full_name: saved.full_name || '',
          date_of_birth: toDateInput(saved.date_of_birth),
          height_cm: saved.height_cm ?? '',
          weight_kg: saved.weight_kg ?? '',
          fitness_goal: saved.fitness_goal || '',
          activity_level: saved.activity_level || '',
        })
      } catch (err) {
        if (!active) return
        if (err.status === 401) {
          logout()
          return
        }
        setError(err.message || 'Could not load your profile. Please try again.')
      } finally {
        if (active) setLoadingProfile(false)
      }
    }

    fetchInitialProfile()

    return () => {
      active = false
    }
  }, [token, logout])

  const completion = useMemo(() => {
    const fields = [
      profile.full_name,
      profile.date_of_birth,
      profile.height_cm,
      profile.weight_kg,
      profile.fitness_goal,
      profile.activity_level,
    ]
    return Math.round((fields.filter((value) => value !== '' && value !== null).length / 6) * 100)
  }, [profile])

  const bmi = useMemo(() => {
    const height = Number(profile.height_cm)
    const weight = Number(profile.weight_kg)

    if (!height || !weight || height < 50 || height > 300 || weight < 10 || weight > 500) {
      return null
    }

    return (weight / ((height / 100) ** 2)).toFixed(1)
  }, [profile.height_cm, profile.weight_kg])

  const age = calculateAge(profile.date_of_birth)

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }))
    setError('')
    setSuccess('')
  }

  function validate() {
    if (profile.full_name.trim().length < 2 || profile.full_name.trim().length > 120) {
      return 'Full name must contain between 2 and 120 characters.'
    }

    if (!profile.date_of_birth) return 'Please enter your date of birth.'

    const birth = new Date(`${profile.date_of_birth}T00:00:00.000Z`)
    if (
      Number.isNaN(birth.getTime()) ||
      birth.toISOString().slice(0, 10) !== profile.date_of_birth ||
      birth >= new Date()
    ) {
      return 'Please enter a valid date of birth in the past.'
    }

    const height = Number(profile.height_cm)
    if (profile.height_cm === '' || !Number.isFinite(height) || height < 50 || height > 300) {
      return 'Height must be between 50 and 300 cm.'
    }

    const weight = Number(profile.weight_kg)
    if (profile.weight_kg === '' || !Number.isFinite(weight) || weight < 10 || weight > 500) {
      return 'Weight must be between 10 and 500 kg.'
    }

    if (!GOALS.some((goal) => goal.value === profile.fitness_goal)) {
      return 'Please choose your fitness goal.'
    }

    if (!ACTIVITY_LEVELS.some((level) => level.value === profile.activity_level)) {
      return 'Please choose your activity level.'
    }

    return null
  }

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    const payload = {
      full_name: profile.full_name.trim(),
      date_of_birth: profile.date_of_birth,
      height_cm: Number(profile.height_cm),
      weight_kg: Number(profile.weight_kg),
      fitness_goal: profile.fitness_goal,
      activity_level: profile.activity_level,
    }

    try {
      const response = await authService.updateProfile(token, payload)
      const saved = response.profile || payload

      setProfile({
        full_name: saved.full_name || '',
        date_of_birth: toDateInput(saved.date_of_birth),
        height_cm: saved.height_cm ?? '',
        weight_kg: saved.weight_kg ?? '',
        fitness_goal: saved.fitness_goal || '',
        activity_level: saved.activity_level || '',
      })

      await refreshUser().catch(() => {})
      setEditMode(false)
      setSuccess('Your profile has been saved successfully.')
    } catch (err) {
      if (err.status === 401) {
        logout()
        return
      }
      if (err.status === 429) {
        setError('Too many requests. Please wait a moment and try again.')
      } else if (!err.status) {
        setError('Unable to reach FitLife AI. Check your connection and try again.')
      } else {
        setError(err.message || 'Could not save your profile.')
      }
    } finally {
      setSaving(false)
    }
  }

  const selectedGoal = GOALS.find((goal) => goal.value === profile.fitness_goal)
  const selectedActivity = ACTIVITY_LEVELS.find((level) => level.value === profile.activity_level)
  const displayName = profile.full_name || user?.email?.split('@')[0] || 'there'

  return (
    <main className="auth-page dashboard-page">
      <div className="auth-background-glow" />

      <header className="dashboard-topbar">
        <Link to="/" className="auth-brand">
          <span className="auth-brand-icon"><Activity size={22} /></span>
          <span>fitlife<span>.</span><small>AI</small></span>
        </Link>
        <div className="dashboard-top-actions">
          <span className="dashboard-user-email">{user?.email}</span>
          <button className="dashboard-logout" type="button" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <div className="feature-workspace-layout">
        <FeatureSidebar />
        <div className="feature-workspace-main">
          <div className="dashboard-shell">
        <section className="dashboard-heading">
          <div>
            <div className="auth-story-label"><Sparkles size={15} /> YOUR PERSONAL FITNESS SPACE</div>
            <h1>Good to see you,<br /><span>{displayName}.</span></h1>
            <p>Your goals. Your pace. Your progress. Letâ€™s make every step count.</p>
          </div>
          <div className="dashboard-heading-mark"><Activity size={39} /></div>
        </section>

        {error && <div className="auth-notice dashboard-notice" role="alert">{error}</div>}
        {success && <div className="dashboard-success" role="status"><Check size={17} /> {success}</div>}

        {loadingProfile ? (
          <div className="dashboard-loading">
            <div className="auth-loading-orb"><span /></div>
            <p>Loading your personal profile...</p>
          </div>
        ) : (
          <>
            <section className="dashboard-stats-grid">
              <article className="dashboard-stat-card">
                <div className="dashboard-stat-icon"><ClipboardList size={20} /></div>
                <span>PROFILE COMPLETION</span>
                <strong>{completion}%</strong>
                <div className="dashboard-progress-track">
                  <div style={{ width: `${completion}%` }} />
                </div>
                <small>{completion === 100 ? 'Profile complete' : 'Complete your profile to personalize your experience'}</small>
              </article>

              <article className="dashboard-stat-card">
                <div className="dashboard-stat-icon"><CalendarDays size={20} /></div>
                <span>YOUR AGE</span>
                <strong>{age === null ? 'â€”' : `${age} years`}</strong>
                <small>{age === null ? 'Add your date of birth' : 'Based on your date of birth'}</small>
              </article>

              <article className="dashboard-stat-card">
                <div className="dashboard-stat-icon"><HeartPulse size={20} /></div>
                <span>BODY MASS INDEX</span>
                <strong>{bmi || 'â€”'}</strong>
                <small>{bmi ? 'A general height-to-weight measure' : 'Add height and weight to calculate'}</small>
              </article>
            </section>

            <section className="dashboard-content-grid">
              <article className="dashboard-panel dashboard-profile-panel">
                <div className="dashboard-panel-heading">
                  <div>
                    <span className="auth-eyebrow">YOUR FOUNDATION</span>
                    <h2>Personal profile</h2>
                    <p>Help FitLife AI understand your starting point.</p>
                  </div>
                  {!editMode && (
                    <button className="dashboard-edit-button" type="button" onClick={() => { setEditMode(true); setSuccess('') }}>
                      {completion === 100 ? 'Edit profile' : 'Complete profile'}
                    </button>
                  )}
                </div>

                {editMode || completion < 100 ? (
                  <form className="dashboard-profile-form" onSubmit={handleSave}>
                    <Field label="Full name" icon={UserRound}>
                      <input value={profile.full_name} onChange={(e) => updateField('full_name', e.target.value)} placeholder="Your full name" maxLength={120} />
                    </Field>

                    <Field label="Date of birth" icon={CalendarDays}>
                      <input type="date" value={profile.date_of_birth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => updateField('date_of_birth', e.target.value)} />
                    </Field>

                    <div className="dashboard-two-fields">
                      <Field label="Height (cm)" icon={Ruler} hint="Between 50 and 300 cm">
                        <input type="number" min="50" max="300" step="0.1" value={profile.height_cm} onChange={(e) => updateField('height_cm', e.target.value)} placeholder="e.g. 175" />
                      </Field>
                      <Field label="Weight (kg)" icon={Weight} hint="Between 10 and 500 kg">
                        <input type="number" min="10" max="500" step="0.1" value={profile.weight_kg} onChange={(e) => updateField('weight_kg', e.target.value)} placeholder="e.g. 70" />
                      </Field>
                    </div>

                    <Field label="Fitness goal" icon={Target}>
                      <select value={profile.fitness_goal} onChange={(e) => updateField('fitness_goal', e.target.value)}>
                        <option value="">Choose your primary goal</option>
                        {GOALS.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}
                      </select>
                    </Field>

                    <Field label="Activity level" icon={Dumbbell}>
                      <select value={profile.activity_level} onChange={(e) => updateField('activity_level', e.target.value)}>
                        <option value="">Choose your current activity level</option>
                        {ACTIVITY_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                      </select>
                    </Field>

                    <div className="dashboard-form-actions">
                      <button className="auth-submit" type="submit" disabled={saving}>
                        {saving ? 'Saving your profile...' : 'Save my profile'}
                        {!saving && <Save size={17} />}
                      </button>
                      {completion > 0 && (
                        <button className="dashboard-cancel-button" type="button" onClick={() => { loadProfile(); setEditMode(false) }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  <div className="dashboard-profile-summary">
                    <div><span>FULL NAME</span><strong>{profile.full_name}</strong></div>
                    <div><span>DATE OF BIRTH</span><strong>{profile.date_of_birth}</strong></div>
                    <div><span>HEIGHT</span><strong>{profile.height_cm} cm</strong></div>
                    <div><span>WEIGHT</span><strong>{profile.weight_kg} kg</strong></div>
                    <div><span>FITNESS GOAL</span><strong>{selectedGoal?.label}</strong></div>
                    <div><span>ACTIVITY LEVEL</span><strong>{selectedActivity?.label}</strong></div>
                  </div>
                )}
              </article>

              <aside className="dashboard-side-column">
                <article className="dashboard-panel dashboard-goal-panel">
                  <div className="dashboard-side-icon"><Target size={22} /></div>
                  <span className="auth-eyebrow">YOUR DIRECTION</span>
                  <h2>{selectedGoal?.label || 'Choose your goal'}</h2>
                  <p>{selectedGoal?.description || 'Your primary fitness goal will help personalize your FitLife AI experience.'}</p>
                  {selectedActivity && <div className="dashboard-activity-chip"><Activity size={14} /> {selectedActivity.label}</div>}
                </article>

                <article className="dashboard-panel dashboard-next-panel">
                  <div className="dashboard-side-icon"><Sparkles size={22} /></div>
                  <span className="auth-eyebrow">COMING TO YOUR SPACE</span>
                  <h2>Your fitness toolkit</h2>
                  <ul>
                    <li><Check size={15} /> AI workout planning</li>
                    <li><Check size={15} /> Food photo nutrition analysis</li>
                    <li><Check size={15} /> Progress tracking and insights</li>
                    <li><Check size={15} /> Personalized AI guidance</li>
                  </ul>
                  <p>Your food photo nutrition analyzer is ready. Upload a meal image, review the food matches, and confirm its nutrition using USDA data.</p>
                  <Link to="/nutrition" className="dashboard-edit-button">
                    Open Nutrition Analyzer
                  </Link>
                </article>
              </aside>
            </section>

            <WorkoutPlanner
              token={token}
              profile={profile}
              onUnauthorized={logout}
            />
            <WorkoutCoach
              token={token}
              onUnauthorized={logout}
            />
          </>
        )}
      </div>
        </div>
      </div>
    </main>
  )
}



