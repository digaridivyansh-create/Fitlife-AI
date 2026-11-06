import { useCallback, useEffect, useState } from 'react'
import {
  Sparkles, Send, CheckCircle2, XCircle, Clock3,
  Dumbbell, CalendarDays, RefreshCw, Target,
} from 'lucide-react'
import { workoutService } from '../services/workoutService'
import './WorkoutCoach.css'

function formatLabel(value) {
  return String(value || '').replaceAll('_', ' ')
}

function PlanPreview({ plan }) {
  if (!plan) return null

  return (
    <div className="coach-plan-preview">
      <div className="coach-plan-meta">
        <span><Target size={14} /> {formatLabel(plan.goal)}</span>
        <span><Clock3 size={14} /> {plan.session_duration_minutes} min</span>
        <span><Dumbbell size={14} /> {formatLabel(plan.workout_location)}</span>
      </div>

      {(plan.weekly_schedule || []).map((day) => (
        <article className="coach-day" key={day.day}>
          <div className="coach-day-heading">
            <div>
              <span>DAY {day.day}</span>
              <h4>{day.title}</h4>
              <p>{day.focus}</p>
            </div>
            <span className="coach-day-duration">
              {day.estimated_duration_minutes || '—'} min
            </span>
          </div>

          <div className="coach-exercises">
            {(day.exercises || []).map((exercise, index) => (
              <div className="coach-exercise" key={`${exercise.name}-${index}`}>
                <strong>{exercise.name}</strong>
                <span>{exercise.sets} × {exercise.reps}</span>
                <small>Rest {exercise.rest_seconds}s</small>
              </div>
            ))}
          </div>
        </article>
      ))}

      {plan.rest_days?.length > 0 && (
        <p className="coach-rest-days">
          <CalendarDays size={15} />
          Rest days: {plan.rest_days.join(', ')}
        </p>
      )}

      {plan.progression_guidance && (
        <div className="coach-guidance">
          <strong>Progression guidance</strong>
          <p>{plan.progression_guidance}</p>
        </div>
      )}

      {plan.safety_note && (
        <div className="coach-safety">
          <strong>Training note</strong>
          <p>{plan.safety_note}</p>
        </div>
      )}
    </div>
  )
}

export default function WorkoutCoach({ token, onUnauthorized, onPlanApproved }) {
  const [plans, setPlans] = useState([])
  const [proposals, setProposals] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [changeRequest, setChangeRequest] = useState('')
  const [activeProposal, setActiveProposal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [planResponse, proposalResponse] = await Promise.all([
        workoutService.getPlans(token, 50, 0),
        workoutService.getProposals(token, 50, 0),
      ])

      const savedPlans = planResponse.plans || []
      const savedProposals = proposalResponse.proposals || []

      setPlans(savedPlans)
      setProposals(savedProposals)

      setSelectedPlanId((current) => {
        if (current && savedPlans.some((plan) => String(plan.id) === String(current))) {
          return current
        }
        return savedPlans[0] ? String(savedPlans[0].id) : ''
      })

      setActiveProposal((current) => {
        if (!current) return null
        return savedProposals.find((item) => String(item.id) === String(current.id)) || current
      })
    } catch (err) {
      if (err.status === 401) onUnauthorized()
      else setError(err.message || 'Could not load your workout coach data.')
    } finally {
      setLoading(false)
    }
  }, [token, onUnauthorized])

  useEffect(() => {
    let active = true

    async function fetchInitialData() {
      try {
        const [planResponse, proposalResponse] = await Promise.all([
          workoutService.getPlans(token, 50, 0),
          workoutService.getProposals(token, 50, 0),
        ])

        if (!active) return

        const savedPlans = planResponse.plans || []
        const savedProposals = proposalResponse.proposals || []

        setPlans(savedPlans)
        setProposals(savedProposals)

        setSelectedPlanId((current) => {
          if (current && savedPlans.some((plan) => String(plan.id) === String(current))) {
            return current
          }
          return savedPlans[0] ? String(savedPlans[0].id) : ''
        })

        setActiveProposal((current) => {
          if (!current) return null
          return savedProposals.find((item) => String(item.id) === String(current.id)) || current
        })
      } catch (err) {
        if (!active) return
        if (err.status === 401) onUnauthorized()
        else setError(err.message || 'Could not load your workout coach data.')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchInitialData()

    return () => {
      active = false
    }
  }, [token, onUnauthorized])

  async function handleCreateProposal(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!selectedPlanId) {
      setError('Generate or select a saved workout plan first.')
      return
    }

    if (changeRequest.trim().length < 5 || changeRequest.trim().length > 2000) {
      setError('Describe your requested changes using 5 to 2000 characters.')
      return
    }

    setGenerating(true)

    try {
      const response = await workoutService.createProposal(
        token,
        selectedPlanId,
        changeRequest.trim(),
      )

      const proposal = response.proposal
      setActiveProposal(proposal)
      setChangeRequest('')
      setNotice(response.message || 'Your AI workout proposal is ready.')
      await loadData()
      setActiveProposal(proposal)
    } catch (err) {
      if (err.status === 401) {
        onUnauthorized()
      } else if (err.status === 503 || err.status === 504 || err.status === 502) {
        setError(err.message || 'The AI workout coach is temporarily unavailable. Please try again.')
      } else {
        setError(err.message || 'Could not create your workout proposal.')
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleProposalAction(proposal, action) {
    setError('')
    setNotice('')
    setActionId(proposal.id)

    try {
      if (action === 'approve') {
        const response = await workoutService.approveProposal(token, proposal.id)
        setNotice(response.message || 'Proposal approved. A new workout plan was saved.')
        setActiveProposal(null)
        await loadData()
        if (response.workout_plan) onPlanApproved?.(response.workout_plan)
      } else {
        const response = await workoutService.rejectProposal(token, proposal.id)
        setNotice(response.message || 'Proposal rejected. Your original plan remains unchanged.')
        setActiveProposal(null)
        await loadData()
      }
    } catch (err) {
      if (err.status === 401) onUnauthorized()
      else setError(err.message || `Could not ${action} this proposal.`)
    } finally {
      setActionId(null)
    }
  }

  function openProposal(proposal) {
    setActiveProposal(proposal)
    setError('')
    setNotice('')
  }

  const previewPlan = activeProposal?.proposed_plan ||
    activeProposal?.proposed_plan_data || null

  const pendingProposals = proposals.filter((item) => item.status === 'pending')

  return (
    <section className="dashboard-panel workout-coach-panel" id="workout-coach">
      <div className="coach-heading">
        <div>
          <span className="auth-eyebrow"><Sparkles size={14} /> GENERATIVE AI WORKOUT COACH</span>
          <h2>Train smarter with your AI coach</h2>
          <p>Describe what you want to change. Review the proposed workout before deciding whether to save it.</p>
        </div>
        <div className="coach-heading-icon"><Sparkles size={25} /></div>
      </div>

      {error && <div className="auth-notice coach-notice" role="alert">{error}</div>}
      {notice && <div className="coach-success" role="status"><CheckCircle2 size={16} /> {notice}</div>}

      {loading ? (
        <div className="coach-empty">
          <RefreshCw className="workout-spin" size={20} />
          <p>Loading your workout coach...</p>
        </div>
      ) : (
        <>
          <form className="coach-request-form" onSubmit={handleCreateProposal}>
            <label className="workout-field">
              <span>Select a saved workout to modify</span>
              <select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                disabled={plans.length === 0 || generating}
              >
                {plans.length === 0 ? (
                  <option value="">No saved workout plans available</option>
                ) : (
                  plans.map((plan) => (
                    <option key={plan.id} value={String(plan.id)}>
                      {formatLabel(plan.fitness_goal)} · {plan.training_days_per_week} days · {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : 'Saved plan'}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="workout-field">
              <span>What would you like your AI coach to change?</span>
              <textarea
                value={changeRequest}
                onChange={(event) => setChangeRequest(event.target.value)}
                placeholder="Example: Replace exercises that require a bench with bodyweight alternatives. Keep my sessions within 30 minutes."
                minLength={5}
                maxLength={2000}
                rows={4}
                disabled={generating || plans.length === 0}
              />
              <small>{changeRequest.length}/2000 characters</small>
            </label>

            <button
              className="auth-submit coach-submit"
              type="submit"
              disabled={generating || plans.length === 0 || changeRequest.trim().length < 5}
            >
              {generating ? 'Generating your proposal...' : 'Generate AI workout proposal'}
              {generating ? <RefreshCw className="workout-spin" size={17} /> : <Send size={17} />}
            </button>
          </form>

          {plans.length === 0 && (
            <div className="coach-empty">
              <Dumbbell size={22} />
              <p>Generate your first workout plan in the AI Workout Planner. You can then ask the coach to modify it.</p>
            </div>
          )}

          {activeProposal && (
            <div className="coach-proposal">
              <div className="coach-proposal-heading">
                <div>
                  <span className="auth-eyebrow"><Sparkles size={13} /> AI-GENERATED PROPOSAL</span>
                  <h3>Review your proposed changes</h3>
                </div>
                <span className={`coach-status coach-status-${activeProposal.status || 'pending'}`}>
                  {formatLabel(activeProposal.status || 'pending')}
                </span>
              </div>

              {activeProposal.summary && (
                <div className="coach-summary">
                  <strong>Coach's explanation</strong>
                  <p>{activeProposal.summary}</p>
                </div>
              )}

              {activeProposal.changes?.length > 0 && (
                <div className="coach-changes">
                  <strong>What will change</strong>
                  <ul>
                    {activeProposal.changes.map((change, index) => (
                      <li key={`${index}-${change}`}>{change}</li>
                    ))}
                  </ul>
                </div>
              )}

              <PlanPreview plan={previewPlan} />

              {activeProposal.status === 'pending' && (
                <div className="coach-decision-actions">
                  <button
                    type="button"
                    className="coach-approve-button"
                    disabled={actionId !== null}
                    onClick={() => handleProposalAction(activeProposal, 'approve')}
                  >
                    <CheckCircle2 size={17} />
                    {actionId === activeProposal.id ? 'Processing...' : 'Approve and save new plan'}
                  </button>
                  <button
                    type="button"
                    className="coach-reject-button"
                    disabled={actionId !== null}
                    onClick={() => handleProposalAction(activeProposal, 'reject')}
                  >
                    <XCircle size={17} /> Reject proposal
                  </button>
                </div>
              )}

              {activeProposal.status && activeProposal.status !== 'pending' && (
                <p className="coach-final-status">
                  This proposal is {formatLabel(activeProposal.status)}.
                </p>
              )}
            </div>
          )}

          <div className="coach-history">
            <div className="coach-history-heading">
              <div>
                <span className="auth-eyebrow">YOUR AI COACH ACTIVITY</span>
                <h3>Proposal history</h3>
              </div>
              <button type="button" onClick={loadData} disabled={loading || actionId !== null} aria-label="Refresh proposal history">
                <RefreshCw size={16} />
              </button>
            </div>

            {proposals.length === 0 ? (
              <p className="coach-history-empty">Your AI workout proposals will appear here.</p>
            ) : (
              <div className="coach-history-list">
                {proposals.map((proposal) => (
                  <button
                    type="button"
                    className={`coach-history-item ${String(activeProposal?.id) === String(proposal.id) ? 'active' : ''}`}
                    key={proposal.id}
                    onClick={() => openProposal(proposal)}
                  >
                    <span className="coach-history-icon"><Sparkles size={16} /></span>
                    <span className="coach-history-info">
                      <strong>Workout modification</strong>
                      <small>{proposal.created_at ? new Date(proposal.created_at).toLocaleString() : 'Saved proposal'}</small>
                    </span>
                    <span className={`coach-status coach-status-${proposal.status}`}>
                      {formatLabel(proposal.status)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {pendingProposals.length > 0 && (
              <p className="coach-pending-note">
                {pendingProposals.length} proposal{pendingProposals.length === 1 ? '' : 's'} awaiting your decision.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
