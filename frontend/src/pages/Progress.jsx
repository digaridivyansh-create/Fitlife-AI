import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, BrainCircuit, CalendarDays, Dumbbell,
  CheckCircle2, Clock3, Droplets, Footprints, HeartPulse, LoaderCircle,
  Moon, Plus, RefreshCw, Sparkles, Target, TrendingUp, Weight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { progressService } from '../services/progressService'
import FeatureSidebar from '../components/FeatureSidebar.jsx'
import './Progress.css'

const PERIODS = [7, 30, 90]

function localDateValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function formatDate(value, options = { day: 'numeric', month: 'short' }) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', options).format(date)
}

function formatDuration(minutes = 0) {
  const value = Number(minutes) || 0
  const hours = Math.floor(value / 60)
  const remaining = value % 60
  if (hours && remaining) return `${hours}h ${remaining}m`
  if (hours) return `${hours}h`
  return `${remaining}m`
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="progress-metric-card">
      <span className="progress-metric-icon"><Icon size={19} /></span>
      <span className="progress-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function EmptyState({ title, detail }) {
  return (
    <div className="progress-empty-state">
      <Activity size={22} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

function WeightChart({ measurements }) {
  const points = useMemo(() => {
    return [...(measurements || [])]
      .filter((item) => Number.isFinite(Number(item.weight_kg)))
      .sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at))
  }, [measurements])

  if (points.length < 2) {
    return (
      <EmptyState
        title={points.length ? 'One measurement recorded' : 'Your weight trend starts here'}
        detail={points.length
          ? 'Add another measurement to see how your weight changes over time.'
          : 'Log at least two weight measurements to unlock your trend chart.'}
      />
    )
  }

  const values = points.map((item) => Number(item.weight_kg))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const chartPoints = values.map((value, index) => ({
    x: 30 + (index / (values.length - 1)) * 540,
    y: 145 - ((value - min) / range) * 112,
  }))
  const line = chartPoints.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `30,155 ${line} 570,155`

  return (
    <div className="progress-chart-wrap">
      <div className="progress-chart-summary">
        <span>{min.toFixed(1)} kg <small>lowest</small></span>
        <span>{max.toFixed(1)} kg <small>highest</small></span>
      </div>
      <svg className="progress-weight-chart" viewBox="0 0 600 180" role="img" aria-label="Weight measurements over time">
        <defs>
          <linearGradient id="weightArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c5f36a" stopOpacity=".24" />
            <stop offset="100%" stopColor="#c5f36a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 90, 145].map((y) => (
          <line key={y} x1="30" x2="570" y1={y} y2={y} className="progress-chart-gridline" />
        ))}
        <polygon points={area} fill="url(#weightArea)" />
        <polyline points={line} className="progress-chart-line" />
        {chartPoints.map((point, index) => (
          <circle key={`${points[index].id}-${index}`} cx={point.x} cy={point.y} r="4.5" className="progress-chart-point">
            <title>{`${Number(points[index].weight_kg).toFixed(1)} kg — ${formatDate(points[index].measured_at)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="progress-chart-dates">
        <span>{formatDate(points[0].measured_at)}</span>
        <span>{formatDate(points[points.length - 1].measured_at)}</span>
      </div>
    </div>
  )
}

function renderInsightItem(item) {
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item)
  }

  if (item && typeof item === 'object') {
    const title = typeof item.title === 'string' ? item.title : ''
    const detail = typeof item.detail === 'string' ? item.detail : ''
    const category = typeof item.category === 'string' ? item.category : ''

    return (
      <div className="progress-insight-item">
        {category && <span className="progress-insight-category">{category}</span>}
        {title && <strong>{title}</strong>}
        {detail && <p>{detail}</p>}
        {!title && !detail && !category && <p>Insight details unavailable.</p>}
      </div>
    )
  }

  return item == null ? '' : String(item)
}
export default function Progress() {
  const { user, token, logout } = useAuth()
  const [period, setPeriod] = useState(30)
  const [summary, setSummary] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [saving, setSaving] = useState('')
  const [notice, setNotice] = useState('')
  const [insights, setInsights] = useState(null)
  const [insightsError, setInsightsError] = useState('')
  const [insightsLoading, setInsightsLoading] = useState(false)

  const [weightForm, setWeightForm] = useState({
    weight_kg: '',
    measured_at: localDateValue(),
    notes: '',
  })
  const [workoutForm, setWorkoutForm] = useState({
    workout_name: '',
    duration_minutes: '',
    perceived_effort: '',
    completed_at: localDateValue(),
  })
  const [dailyForm, setDailyForm] = useState({
    progress_date: localDateValue(),
    steps: '',
    water_ml: '',
    sleep_hours: '',
    calorie_target: '',
    protein_target_g: '',
  })

  const loadProgress = useCallback(async () => {
    setLoading(true)
    setPageError('')

    try {
      const [summaryResponse, workoutResponse] = await Promise.all([
        progressService.getSummary(token, period),
        progressService.getWorkouts(token, 8, 0),
      ])
      setSummary(summaryResponse)
      setWorkouts(workoutResponse.workouts || [])
    } catch (error) {
      if (error.status === 401) {
        logout()
        return
      }
      setPageError(error.message || 'Could not load your progress.')
    } finally {
      setLoading(false)
    }
  }, [token, period, logout])

  useEffect(() => {
    let cancelled = false

    async function fetchProgress() {
      try {
        const [summaryResponse, workoutResponse] = await Promise.all([
          progressService.getSummary(token, period),
          progressService.getWorkouts(token, 8, 0),
        ])

        if (cancelled) return

        setSummary(summaryResponse)
        setWorkouts(workoutResponse.workouts || [])
        setPageError('')
      } catch (error) {
        if (cancelled) return

        if (error.status === 401) {
          logout()
          return
        }

        setPageError(error.message || 'Could not load your progress.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchProgress()

    return () => {
      cancelled = true
    }
  }, [token, period, logout])

  const weightMeasurements = useMemo(() => summary?.weight?.measurements || [], [summary])
  const workoutSummary = summary?.workouts || {}
  const dailyEntries = summary?.daily_tracking?.entries || []
  const latestDaily = dailyEntries[0]
  const recordedDays = summary?.daily_tracking?.recorded_days || 0
  const completedWorkouts = workoutSummary.completed_workouts || 0
  const totalMinutes = workoutSummary.total_duration_minutes || 0

  const weightChange = useMemo(() => {
    const ordered = [...weightMeasurements]
      .sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at))
    if (ordered.length < 2) return null
    return Number(ordered[ordered.length - 1].weight_kg) - Number(ordered[0].weight_kg)
  }, [weightMeasurements])

  async function submitForm(event, kind, payload) {
    event.preventDefault()
    setSaving(kind)
    setNotice('')
    setPageError('')

    try {
      if (kind === 'weight') {
        await progressService.addWeight(token, {
          weight_kg: Number(payload.weight_kg),
          measured_at: new Date(`${payload.measured_at}T12:00:00+05:30`).toISOString(),
          notes: payload.notes.trim() || null,
        })
        setWeightForm({ weight_kg: '', measured_at: localDateValue(), notes: '' })
        setNotice('Weight measurement saved.')
      } else if (kind === 'workout') {
        await progressService.addWorkout(token, {
          workout_name: payload.workout_name.trim(),
          duration_minutes: Number(payload.duration_minutes),
          completed_at: new Date(`${payload.completed_at}T12:00:00+05:30`).toISOString(),
          ...(payload.perceived_effort
            ? { perceived_effort: Number(payload.perceived_effort) }
            : {}),
        })
        setWorkoutForm({
          workout_name: '',
          duration_minutes: '',
          perceived_effort: '',
          completed_at: localDateValue(),
        })
        setNotice('Workout logged successfully.')
      } else {
        const dailyPayload = { progress_date: payload.progress_date }
        ;['steps', 'water_ml', 'sleep_hours', 'calorie_target', 'protein_target_g'].forEach((field) => {
          if (payload[field] !== '') dailyPayload[field] = Number(payload[field])
        })
        await progressService.updateDaily(token, dailyPayload)
        setNotice('Daily tracking updated.')
      }

      await loadProgress()
    } catch (error) {
      if (error.status === 401) {
        logout()
        return
      }
      setPageError(error.message || 'Could not save this entry.')
    } finally {
      setSaving('')
    }
  }

  async function loadInsights() {
    setInsightsLoading(true)
    setInsightsError('')
    try {
      const response = await progressService.getInsights(token, period)
      setInsights(response.insights || null)
    } catch (error) {
      if (error.status === 401) {
        logout()
        return
      }
      setInsightsError(
        error.status === 503
          ? 'The AI service is temporarily unavailable. Your progress data is still available; try again later.'
          : error.message || 'Could not generate insights. Please try again.',
      )
    } finally {
      setInsightsLoading(false)
    }
  }

  function handlePeriodChange(days) {
    if (days === period) return

    setInsights(null)
    setInsightsError('')
    setInsightsLoading(false)
    setLoading(true)
    setPageError('')
    setPeriod(days)
  }

  const displayName = user?.full_name?.trim()?.split(/\s+/)[0] || 'there'

  return (
    <main className="auth-page progress-page">
      <div className="auth-background-glow" />
      <header className="dashboard-topbar progress-topbar">
        <Link className="auth-brand progress-brand" to="/dashboard">
          <span className="auth-brand-mark"><Activity size={21} /></span>
          <span>FitLife<span className="auth-brand-accent">AI</span></span>
        </Link>
        <div className="dashboard-top-actions">
          <span className="dashboard-user-email">{user?.email || ''}</span>
          <Link className="progress-back-link" to="/dashboard">Workout Studio</Link>
        </div>
      </header>

      <div className="feature-workspace-layout">
        <FeatureSidebar />
        <div className="feature-workspace-main">
          <div className="progress-shell">
            <section className="progress-heading">
              <div>
                <div className="progress-eyebrow"><Sparkles size={14} /> YOUR FITNESS JOURNEY</div>
                <h1>Progress <span>& Insights</span></h1>
                <p>Small steps add up. Track your habits, understand your trends, and keep moving forward, {displayName}.</p>
              </div>
              <div className="progress-period-control" aria-label="Select progress period">
                {PERIODS.map((days) => (
                  <button
                    type="button"
                    key={days}
                    className={period === days ? 'active' : ''}
                    onClick={() => handlePeriodChange(days)}
                    aria-pressed={period === days}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </section>

            {pageError && (
              <div className="progress-alert progress-alert-error" role="alert">
                {pageError}
                <button type="button" onClick={loadProgress}>Retry</button>
              </div>
            )}
            {notice && (
              <div className="progress-alert progress-alert-success" role="status">
                <CheckCircle2 size={16} /> {notice}
              </div>
            )}

            {loading ? (
              <div className="progress-loading"><LoaderCircle className="progress-spinner" size={28} /> Loading your progress...</div>
            ) : (
              <>
                <section className="progress-metrics-grid">
                  <MetricCard
                    icon={Weight}
                    label="WEIGHT CHANGE"
                    value={weightChange === null ? '—' : `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`}
                    detail={weightMeasurements.length >= 2
                      ? `${weightMeasurements.length} measurements in ${period} days`
                      : 'Log at least two measurements'}
                  />
                  <MetricCard
                    icon={Dumbbell}
                    label="WORKOUTS COMPLETED"
                    value={completedWorkouts}
                    detail={`${period}-day activity window`}
                  />
                  <MetricCard
                    icon={Clock3}
                    label="TOTAL TRAINING TIME"
                    value={formatDuration(totalMinutes)}
                    detail="From your completed workout logs"
                  />
                  <MetricCard
                    icon={CalendarDays}
                    label="TRACKED DAYS"
                    value={`${recordedDays}/${period}`}
                    detail="Days with habit entries"
                  />
                </section>

                <section className="progress-main-grid">
                  <article className="progress-panel progress-chart-panel">
                    <div className="progress-panel-heading">
                      <div>
                        <span className="progress-section-label">BODY METRICS</span>
                        <h2>Weight trend</h2>
                        <p>Your recorded measurements over the selected period.</p>
                      </div>
                      <span className="progress-panel-icon"><TrendingUp size={19} /></span>
                    </div>
                    <WeightChart measurements={weightMeasurements} />
                  </article>

                  <article className="progress-panel progress-habits-panel">
                    <div className="progress-panel-heading">
                      <div>
                        <span className="progress-section-label">LATEST CHECK-IN</span>
                        <h2>Daily habits</h2>
                        <p>{latestDaily ? formatDate(latestDaily.progress_date, { day: 'numeric', month: 'long', year: 'numeric' }) : 'No daily entry yet'}</p>
                      </div>
                      <span className="progress-panel-icon"><HeartPulse size={19} /></span>
                    </div>
                    {latestDaily ? (
                      <div className="progress-habit-list">
                        <div><Footprints size={17} /><span>Steps</span><strong>{latestDaily.steps ?? '—'}</strong></div>
                        <div><Droplets size={17} /><span>Water</span><strong>{latestDaily.water_ml == null ? '—' : `${latestDaily.water_ml} ml`}</strong></div>
                        <div><Moon size={17} /><span>Sleep</span><strong>{latestDaily.sleep_hours == null ? '—' : `${latestDaily.sleep_hours} h`}</strong></div>
                        <div><Target size={17} /><span>Calorie target</span><strong>{latestDaily.calorie_target ?? '—'}</strong></div>
                        <div><Activity size={17} /><span>Protein target</span><strong>{latestDaily.protein_target_g == null ? '—' : `${latestDaily.protein_target_g} g`}</strong></div>
                      </div>
                    ) : (
                      <EmptyState title="No habits logged yet" detail="Use the daily tracker below to record your first check-in." />
                    )}
                  </article>
                </section>

                <section className="progress-panel progress-ai-panel">
                  <div className="progress-panel-heading">
                    <div>
                      <span className="progress-section-label">PERSONALIZED ANALYSIS</span>
                      <h2><BrainCircuit size={21} /> AI progress insights</h2>
                      <p>Get observations and practical recommendations based on your recorded data.</p>
                    </div>
                    <button
                      className="progress-primary-button progress-insights-button"
                      type="button"
                      onClick={loadInsights}
                      disabled={insightsLoading}
                    >
                      {insightsLoading
                        ? <><LoaderCircle className="progress-spinner" size={16} /> Analyzing...</>
                        : <><Sparkles size={16} /> {insights ? 'Refresh insights' : 'Generate insights'}</>}
                    </button>
                  </div>
                  {insightsLoading && <p className="progress-ai-status">This can take up to two minutes while your progress is analyzed.</p>}
                  {insightsError && <div className="progress-alert progress-alert-error">{insightsError}</div>}
                  {insights && (
                    <div className="progress-insights-content">
                      <h3>{insights.headline}</h3>
                      <p>{insights.summary}</p>
                      <div className="progress-insight-columns">
                        <div>
                          <h4>Observations</h4>
                          {insights.observations?.length
                            ? <ul>{insights.observations.map((item, index) => <li key={index}>{renderInsightItem(item)}</li>)}</ul>
                            : <p>No observations returned.</p>}
                        </div>
                        <div>
                          <h4>Recommendations</h4>
                          {insights.recommendations?.length
                            ? <ul>{insights.recommendations.map((item, index) => <li key={index}>{renderInsightItem(item)}</li>)}</ul>
                            : <p>No recommendations returned.</p>}
                        </div>
                        {insights.data_gaps?.length > 0 && (
                          <div>
                            <h4>Data gaps</h4>
                            <ul>{insights.data_gaps.map((item, index) => <li key={index}>{renderInsightItem(item)}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {!insights && !insightsLoading && !insightsError && (
                    <div className="progress-ai-placeholder">
                      <BrainCircuit size={24} />
                      <span>Your AI analysis will appear here when you request it.</span>
                    </div>
                  )}
                </section>

                <section className="progress-forms-grid">
                  <article className="progress-panel">
                    <div className="progress-panel-heading">
                      <div>
                        <span className="progress-section-label">BODY METRICS</span>
                        <h2><Weight size={19} /> Log weight</h2>
                      </div>
                    </div>
                    <form className="progress-form" onSubmit={(event) => submitForm(event, 'weight', weightForm)}>
                      <label>Weight (kg)
                        <input type="number" min="20" max="500" step="0.1" required value={weightForm.weight_kg} onChange={(event) => setWeightForm({ ...weightForm, weight_kg: event.target.value })} placeholder="e.g. 72.5" />
                      </label>
                      <label>Measurement date
                        <input type="date" required value={weightForm.measured_at} onChange={(event) => setWeightForm({ ...weightForm, measured_at: event.target.value })} />
                      </label>
                      <label>Notes <span className="progress-optional">(optional)</span>
                        <input type="text" maxLength="500" value={weightForm.notes} onChange={(event) => setWeightForm({ ...weightForm, notes: event.target.value })} placeholder="How are you feeling?" />
                      </label>
                      <button className="progress-primary-button" type="submit" disabled={saving === 'weight'}>
                        {saving === 'weight' ? <LoaderCircle className="progress-spinner" size={16} /> : <Plus size={16} />} Save measurement
                      </button>
                    </form>
                  </article>

                  <article className="progress-panel">
                    <div className="progress-panel-heading">
                      <div>
                        <span className="progress-section-label">TRAINING HISTORY</span>
                        <h2><Dumbbell size={19} /> Log a workout</h2>
                      </div>
                    </div>
                    <form className="progress-form" onSubmit={(event) => submitForm(event, 'workout', workoutForm)}>
                      <label>Workout name
                        <input type="text" minLength="1" maxLength="120" required value={workoutForm.workout_name} onChange={(event) => setWorkoutForm({ ...workoutForm, workout_name: event.target.value })} placeholder="e.g. Upper body strength" />
                      </label>
                      <div className="progress-form-two">
                        <label>Duration (minutes)
                          <input type="number" min="1" max="600" step="1" required value={workoutForm.duration_minutes} onChange={(event) => setWorkoutForm({ ...workoutForm, duration_minutes: event.target.value })} placeholder="45" />
                        </label>
                        <label>Effort (1–10) <span className="progress-optional">(optional)</span>
                          <input type="number" min="1" max="10" step="1" value={workoutForm.perceived_effort} onChange={(event) => setWorkoutForm({ ...workoutForm, perceived_effort: event.target.value })} placeholder="7" />
                        </label>
                      </div>
                      <label>Completion date
                        <input type="date" required value={workoutForm.completed_at} onChange={(event) => setWorkoutForm({ ...workoutForm, completed_at: event.target.value })} />
                      </label>
                      <button className="progress-primary-button" type="submit" disabled={saving === 'workout'}>
                        {saving === 'workout' ? <LoaderCircle className="progress-spinner" size={16} /> : <Plus size={16} />} Save workout
                      </button>
                    </form>
                  </article>

                  <article className="progress-panel progress-daily-form-panel">
                    <div className="progress-panel-heading">
                      <div>
                        <span className="progress-section-label">CONSISTENCY BUILDS RESULTS</span>
                        <h2><CalendarDays size={19} /> Daily habit tracker</h2>
                        <p>Update any fields you measured. Empty fields are left unchanged.</p>
                      </div>
                    </div>
                    <form className="progress-form" onSubmit={(event) => submitForm(event, 'daily', dailyForm)}>
                      <label>Tracking date
                        <input type="date" required value={dailyForm.progress_date} onChange={(event) => setDailyForm({ ...dailyForm, progress_date: event.target.value })} />
                      </label>
                      <div className="progress-form-three">
                        <label>Steps
                          <input type="number" min="0" max="200000" step="1" value={dailyForm.steps} onChange={(event) => setDailyForm({ ...dailyForm, steps: event.target.value })} placeholder="8500" />
                        </label>
                        <label>Water (ml)
                          <input type="number" min="0" max="20000" step="1" value={dailyForm.water_ml} onChange={(event) => setDailyForm({ ...dailyForm, water_ml: event.target.value })} placeholder="2500" />
                        </label>
                        <label>Sleep (hours)
                          <input type="number" min="0" max="24" step="0.1" value={dailyForm.sleep_hours} onChange={(event) => setDailyForm({ ...dailyForm, sleep_hours: event.target.value })} placeholder="7.5" />
                        </label>
                      </div>
                      <div className="progress-form-two">
                        <label>Calorie target
                          <input type="number" min="500" max="15000" step="1" value={dailyForm.calorie_target} onChange={(event) => setDailyForm({ ...dailyForm, calorie_target: event.target.value })} placeholder="2000" />
                        </label>
                        <label>Protein target (g)
                          <input type="number" min="0" max="1000" step="1" value={dailyForm.protein_target_g} onChange={(event) => setDailyForm({ ...dailyForm, protein_target_g: event.target.value })} placeholder="120" />
                        </label>
                      </div>
                      <button className="progress-primary-button" type="submit" disabled={saving === 'daily' || !Object.entries(dailyForm).some(([key, value]) => key !== 'progress_date' && value !== '')}>
                        {saving === 'daily' ? <LoaderCircle className="progress-spinner" size={16} /> : <Plus size={16} />} Save daily check-in
                      </button>
                    </form>
                  </article>
                </section>

                <section className="progress-panel progress-history-panel">
                  <div className="progress-panel-heading">
                    <div>
                      <span className="progress-section-label">YOUR TRAINING</span>
                      <h2>Recent workouts</h2>
                      <p>Your latest completed workout entries.</p>
                    </div>
                    <button className="progress-icon-button" type="button" onClick={loadProgress} aria-label="Refresh progress" title="Refresh progress">
                      <RefreshCw size={17} />
                    </button>
                  </div>
                  {workouts.length ? (
                    <div className="progress-workout-list">
                      {workouts.map((workout) => (
                        <div className="progress-workout-row" key={workout.id}>
                          <span className="progress-workout-icon"><Dumbbell size={18} /></span>
                          <div className="progress-workout-name">
                            <strong>{workout.workout_name}</strong>
                            <small>{formatDate(workout.completed_at, { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                          </div>
                          <span>{formatDuration(workout.duration_minutes)}</span>
                          <span>{workout.perceived_effort == null ? 'Effort —' : `Effort ${workout.perceived_effort}/10`}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No completed workouts yet" detail="Log a completed workout above to start building your training history." />
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}


