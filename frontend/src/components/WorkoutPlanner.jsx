import { useCallback, useEffect, useState } from 'react'
import {
  Activity, CalendarDays, CheckCircle2, ChevronDown, Clock3,
  Dumbbell, Home, MapPin, RefreshCw, Sparkles, Target,
} from 'lucide-react'
import { workoutService } from '../services/workoutService'

const EQUIPMENT = [
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bench', label: 'Workout bench' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'resistance_bands', label: 'Resistance bands' },
  { value: 'lat_pulldown_machine', label: 'Lat pulldown machine' },
  { value: 'leg_press_machine', label: 'Leg press machine' },
  { value: 'stationary_bike', label: 'Stationary bike' },
]

const INITIAL_FORM = {
  experience_level: 'beginner',
  training_days_per_week: 3,
  session_duration_minutes: 45,
  workout_location: 'home',
  equipment: [],
}

export default function WorkoutPlanner({ token, profile, onUnauthorized }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [generating, setGenerating] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState(null)
  const [plans, setPlans] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const response = await workoutService.getPlans(token)
      setPlans(response.plans || [])
    } catch (err) {
      if (err.status === 401) onUnauthorized()
      else setError(err.message || 'Could not load workout history.')
    } finally {
      setLoadingHistory(false)
    }
  }, [token, onUnauthorized])

  useEffect(() => {
    let active = true

    async function fetchInitialHistory() {
      try {
        const response = await workoutService.getPlans(token)
        if (active) setPlans(response.plans || [])
      } catch (err) {
        if (!active) return
        if (err.status === 401) onUnauthorized()
        else setError(err.message || 'Could not load workout history.')
      } finally {
        if (active) setLoadingHistory(false)
      }
    }

    fetchInitialHistory()

    return () => {
      active = false
    }
  }, [token, onUnauthorized])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  function toggleEquipment(value) {
    setForm((current) => ({
      ...current,
      equipment: current.equipment.includes(value)
        ? current.equipment.filter((item) => item !== value)
        : [...current.equipment, value],
    }))
  }

  async function handleGenerate(event) {
    event.preventDefault()
    setError('')
    setPlan(null)
    setSelectedId(null)

    if (!profile?.fitness_goal || !profile?.activity_level) {
      setError('Complete your fitness goal and activity level in Personal Profile before generating a workout.')
      return
    }

    if (form.workout_location === 'gym' && form.equipment.length === 0) {
      setError('Select at least one available gym equipment option.')
      return
    }

    setGenerating(true)
    try {
      const response = await workoutService.generate(token, {
        ...form,
        training_days_per_week: Number(form.training_days_per_week),
        session_duration_minutes: Number(form.session_duration_minutes),
      })
      setPlan(response.workout)
      setSelectedId(response.plan_id)
      await loadHistory()
    } catch (err) {
      if (err.status === 401) {
        onUnauthorized()
      } else if (err.status === 503 || err.status === 504) {
        setError('The AI workout service is temporarily unavailable. Please try again shortly.')
      } else {
        setError(err.message || 'Could not generate your workout plan.')
      }
    } finally {
      setGenerating(false)
    }
  }

  async function openSavedPlan(id) {
    setError('')
    setSelectedId(id)
    try {
      const response = await workoutService.getPlan(token, id)
      setPlan(response.plan?.plan_data || null)
      if (!response.plan?.plan_data) {
        setError('The saved workout plan has no plan data.')
      }
    } catch (err) {
      if (err.status === 401) onUnauthorized()
      else setError(err.message || 'Could not open this saved workout.')
    }
  }

  const canGenerate = Boolean(profile?.fitness_goal && profile?.activity_level)

  return (
    <section className="dashboard-panel workout-planner-panel" id="workout-planner">
      <div className="workout-heading">
        <div>
          <span className="auth-eyebrow"><Sparkles size={14} /> YOUR AI FITNESS TOOLKIT</span>
          <h2>AI workout planner</h2>
          <p>Build a weekly training plan around your goals, experience and available equipment.</p>
        </div>
        <div className="workout-heading-icon"><Dumbbell size={25} /></div>
      </div>

      <div className="workout-profile-context">
        <div><Target size={17} /><span>Your saved goal</span><strong>{profile?.fitness_goal?.replaceAll('_', ' ') || 'Not set'}</strong></div>
        <div><Activity size={17} /><span>Activity level</span><strong>{profile?.activity_level?.replaceAll('_', ' ') || 'Not set'}</strong></div>
      </div>

      {!canGenerate && (
        <div className="workout-inline-warning">
          Complete your fitness goal and activity level in Personal Profile to unlock workout generation.
        </div>
      )}

      <form className="workout-form" onSubmit={handleGenerate}>
        <div className="workout-form-grid">
          <label className="workout-field">
            <span>Experience level</span>
            <select value={form.experience_level} onChange={(e) => updateForm('experience_level', e.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <label className="workout-field">
            <span>Training days per week</span>
            <select value={form.training_days_per_week} onChange={(e) => updateForm('training_days_per_week', e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((day) => <option key={day} value={day}>{day} days</option>)}
            </select>
          </label>

          <label className="workout-field">
            <span>Session duration</span>
            <select value={form.session_duration_minutes} onChange={(e) => updateForm('session_duration_minutes', e.target.value)}>
              {[15, 20, 30, 45, 60, 75, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
            </select>
          </label>

          <label className="workout-field">
            <span>Workout location</span>
            <select value={form.workout_location} onChange={(e) => updateForm('workout_location', e.target.value)}>
              <option value="home">Home</option>
              <option value="gym">Gym</option>
            </select>
          </label>
        </div>

        <div className="workout-equipment-section">
          <div className="workout-equipment-title">
            <div><Dumbbell size={18} /><strong>Available equipment</strong></div>
            <span>{form.workout_location === 'home' ? 'Optional for home workouts' : 'Choose at least one for gym workouts'}</span>
          </div>

          {form.workout_location === 'home' && (
            <div className="workout-bodyweight-note"><Home size={15} /> Bodyweight exercises are included automatically for home workouts.</div>
          )}

          <div className="workout-equipment-grid">
            {EQUIPMENT.map((item) => (
              <label className={`workout-equipment-option ${form.equipment.includes(item.value) ? 'selected' : ''}`} key={item.value}>
                <input
                  type="checkbox"
                  checked={form.equipment.includes(item.value)}
                  onChange={() => toggleEquipment(item.value)}
                />
                <span className="workout-equipment-check"><CheckCircle2 size={15} /></span>
                {item.label}
              </label>
            ))}
          </div>
        </div>

        {error && <div className="auth-notice workout-error" role="alert">{error}</div>}

        <button className="auth-submit workout-generate-button" type="submit" disabled={generating || !canGenerate}>
          {generating ? 'Building your workout plan...' : 'Generate my workout plan'}
          {generating ? <RefreshCw className="workout-spin" size={18} /> : <Sparkles size={18} />}
        </button>
      </form>

      {plan && (
        <div className="workout-result">
          <div className="workout-result-heading">
            <div>
              <span className="auth-eyebrow"><CheckCircle2 size={14} /> {selectedId ? 'SAVED WORKOUT PLAN' : 'YOUR WORKOUT PLAN'}</span>
              <h3>Your weekly schedule</h3>
            </div>
            <span className="workout-result-badge">{plan.training_days_per_week} training days</span>
          </div>

          <div className="workout-plan-meta">
            <span><Target size={15} /> {plan.goal?.replaceAll('_', ' ')}</span>
            <span><Clock3 size={15} /> {plan.session_duration_minutes} min sessions</span>
            <span><MapPin size={15} /> {plan.workout_location}</span>
          </div>

          <div className="workout-days">
            {(plan.weekly_schedule || []).map((day) => (
              <article className="workout-day-card" key={day.day}>
                <div className="workout-day-top">
                  <span>DAY {day.day}</span>
                  <span><Clock3 size={13} /> {day.estimated_duration_minutes} min</span>
                </div>
                <h4>{day.title}</h4>
                <p className="workout-day-focus">{day.focus}</p>
                <div className="workout-exercises">
                  {(day.exercises || []).map((exercise, index) => (
                    <div className="workout-exercise" key={`${exercise.name}-${index}`}>
                      <div>
                        <strong>{exercise.name}</strong>
                        <small>{(exercise.muscle_groups || []).join(' · ')}</small>
                      </div>
                      <span>{exercise.sets} × {exercise.reps}</span>
                      <small className="workout-rest">Rest {exercise.rest_seconds}s</small>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {plan.rest_days?.length > 0 && (
            <p className="workout-rest-days"><CalendarDays size={16} /> Rest days: {plan.rest_days.join(', ')}</p>
          )}

          {plan.progression_guidance && (
            <div className="workout-guidance"><strong>Progression guidance</strong><p>{plan.progression_guidance}</p></div>
          )}
          {plan.safety_note && (
            <div className="workout-safety"><strong>Training note</strong><p>{plan.safety_note}</p></div>
          )}
        </div>
      )}

      <div className="workout-history">
        <div className="workout-history-heading">
          <div><span className="auth-eyebrow">YOUR SAVED PLANS</span><h3>Workout history</h3></div>
          <button type="button" onClick={loadHistory} disabled={loadingHistory} aria-label="Refresh workout history">
            <RefreshCw size={16} className={loadingHistory ? 'workout-spin' : ''} />
          </button>
        </div>

        {loadingHistory ? (
          <p className="workout-history-empty">Loading saved plans...</p>
        ) : plans.length === 0 ? (
          <p className="workout-history-empty">Your saved workout plans will appear here after you generate your first plan.</p>
        ) : (
          <div className="workout-history-list">
            {plans.map((item) => (
              <button
                className={`workout-history-item ${String(selectedId) === String(item.id) ? 'active' : ''}`}
                type="button"
                key={item.id}
                onClick={() => openSavedPlan(item.id)}
              >
                <span className="workout-history-icon"><Dumbbell size={17} /></span>
                <span className="workout-history-info">
                  <strong>{item.fitness_goal?.replaceAll('_', ' ') || 'Workout plan'}</strong>
                  <small>{item.experience_level} · {item.training_days_per_week} days · {item.session_duration_minutes} min</small>
                </span>
                <span className="workout-history-date">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
                <ChevronDown className="workout-history-arrow" size={16} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
