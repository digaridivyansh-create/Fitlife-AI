import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { nutritionService } from '../services/nutritionService.js'
import './Nutrition.css'
import FeatureSidebar from '../components/FeatureSidebar.jsx'

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

function formatNumber(value, suffix = '') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return 'Unavailable'
  }

  return `${Number(value).toFixed(1)}${suffix}`
}

function formatDate(value) {
  if (!value) return 'Date unavailable'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getErrorMessage(error) {
  if (error.status === 401) return 'Your session has expired. Please sign in again.'
  if (error.status === 413) return 'This image is larger than the 10 MB upload limit.'
  if (error.status === 415) return 'Please upload a JPEG, PNG, WEBP, or AVIF image.'
  if (error.status === 503 || error.status === 504) {
    return 'The nutrition service is temporarily unavailable. Please try again shortly.'
  }

  return error.message || 'Something went wrong. Please try again.'
}

function MacroGrid({ totals }) {
  const macros = [
    { label: 'Calories', value: totals?.calories, unit: ' kcal' },
    { label: 'Protein', value: totals?.protein, unit: ' g' },
    { label: 'Carbohydrates', value: totals?.carbohydrates, unit: ' g' },
    { label: 'Fat', value: totals?.fat, unit: ' g' },
  ]

  return (
    <div className="nutrition-macro-grid">
      {macros.map((macro) => (
        <div className="nutrition-macro" key={macro.label}>
          <span>{macro.label}</span>
          <strong>{formatNumber(macro.value, macro.unit)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function Nutrition() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [mealName, setMealName] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [savedMeal, setSavedMeal] = useState(null)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!previewUrl) return undefined

    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    let active = true

    async function loadHistory() {
      setHistoryLoading(true)
      setHistoryError('')

      try {
        const result = await nutritionService.getHistory(token, 1, 10)

        if (!active) return

        setHistory(result.meals || [])
        setHistoryPage(1)
        setHasMoreHistory(Boolean(result.pagination?.has_next))
      } catch (requestError) {
        if (!active) return

        if (requestError.status === 401) {
          await logout()
          navigate('/login', { replace: true })
          return
        }

        setHistoryError(getErrorMessage(requestError))
      } finally {
        if (active) setHistoryLoading(false)
      }
    }

    if (token) loadHistory()

    return () => {
      active = false
    }
  }, [token, logout, navigate])

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    setError('')
    setNotice('')
    setAnalysis(null)
    setSavedMeal(null)
    setSelectedMeal(null)

    if (!file) {
      setSelectedFile(null)
      setPreviewUrl('')
      return
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setSelectedFile(null)
      setPreviewUrl('')
      setError('Unsupported image type. Choose a JPEG, PNG, WEBP, or AVIF image.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setSelectedFile(null)
      setPreviewUrl('')
      setError('The image must be 10 MB or smaller.')
      event.target.value = ''
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleAnalyze() {
    if (!selectedFile || !token) return

    setAnalyzing(true)
    setError('')
    setNotice('')
    setAnalysis(null)
    setSavedMeal(null)

    try {
      const result = await nutritionService.analyze(token, selectedFile)
      const response = result.analysis || result

      if (!Array.isArray(response.items) || response.items.length === 0) {
        throw new Error('The analysis did not identify any food items. Try a clearer image.')
      }

      setAnalysis({
        ...response,
        items: response.items.map((item) => ({
          ...item,
          food_name: item.food_name || '',
          serving_weight_g: String(item.estimated_weight_g ?? ''),
          selected_fdc_id: '',
        })),
      })

      setNotice('Review every detected food and choose the matching USDA entry before saving.')
    } catch (requestError) {
      if (requestError.status === 401) {
        await logout()
        navigate('/login', { replace: true })
        return
      }

      setError(getErrorMessage(requestError))
    } finally {
      setAnalyzing(false)
    }
  }

  function updateAnalysisItem(index, field, value) {
    setAnalysis((current) => {
      if (!current) return current

      return {
        ...current,
        items: current.items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item,
        ),
      }
    })
  }

  function removeAnalysisItem(index) {
    setAnalysis((current) => {
      if (!current) return current

      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index),
      }
    })
  }

  async function refreshHistory() {
    try {
      const result = await nutritionService.getHistory(token, 1, 10)
      setHistory(result.meals || [])
      setHistoryPage(1)
      setHasMoreHistory(Boolean(result.pagination?.has_next))
      setHistoryError('')
    } catch (requestError) {
      setHistoryError(getErrorMessage(requestError))
    }
  }

  async function loadMoreHistory() {
    const nextPage = historyPage + 1

    try {
      const result = await nutritionService.getHistory(token, nextPage, 10)
      setHistory((current) => [...current, ...(result.meals || [])])
      setHistoryPage(nextPage)
      setHasMoreHistory(Boolean(result.pagination?.has_next))
    } catch (requestError) {
      setHistoryError(getErrorMessage(requestError))
    }
  }

  async function handleConfirm() {
    if (!analysis || !token) return

    const validItems = analysis.items.every((item) => {
      const weight = Number(item.serving_weight_g)
      const fdcId = Number(item.selected_fdc_id)

      return (
        item.food_name.trim().length > 0 &&
        item.food_name.trim().length <= 200 &&
        Number.isSafeInteger(fdcId) &&
        fdcId > 0 &&
        Number.isFinite(weight) &&
        weight > 0 &&
        weight <= 5000
      )
    })

    if (analysis.items.length < 1 || analysis.items.length > 20) {
      setError('A meal must contain between 1 and 20 food items.')
      return
    }

    if (!validItems) {
      setError('Complete each food name, USDA selection, and serving weight before confirming.')
      return
    }

    setConfirming(true)
    setError('')
    setNotice('')

    const payload = {
      ...(mealName.trim() ? { meal_name: mealName.trim() } : {}),
      items: analysis.items.map((item) => ({
        food_name: item.food_name.trim(),
        fdc_id: Number(item.selected_fdc_id),
        serving_weight_g: Number(item.serving_weight_g),
      })),
    }

    try {
      const result = await nutritionService.confirm(token, payload)
      setSavedMeal(result)
      setAnalysis(null)
      setSelectedFile(null)
      setPreviewUrl('')
      setMealName('')
      setNotice('Your confirmed meal has been saved using USDA nutrition data.')
      await refreshHistory()
    } catch (requestError) {
      if (requestError.status === 401) {
        await logout()
        navigate('/login', { replace: true })
        return
      }

      setError(getErrorMessage(requestError))
    } finally {
      setConfirming(false)
    }
  }

  async function openMealDetails(mealId) {
    setDetailLoading(true)
    setSelectedMeal(null)
    setError('')

    try {
      const result = await nutritionService.getMeal(token, mealId)
      setSelectedMeal(result)
    } catch (requestError) {
      if (requestError.status === 401) {
        await logout()
        navigate('/login', { replace: true })
        return
      }

      setError(getErrorMessage(requestError))
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <main className="auth-page nutrition-page">
      <div className="auth-background-glow" />

      <header className="dashboard-topbar nutrition-topbar">
        <button
          className="auth-brand nutrition-brand"
          type="button"
          onClick={() => navigate('/dashboard')}
        >
          <span className="auth-brand-mark">F</span>
          <span>FitLife<span className="nutrition-brand-accent">AI</span></span>
        </button>

        <div className="dashboard-top-actions">
          <span className="dashboard-user-email">{user?.email || 'Your account'}</span>
          <button
            className="dashboard-logout"
            type="button"
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </button>
        </div>
      </header>

      <div className="feature-workspace-layout">
        <FeatureSidebar />
        <div className="feature-workspace-main">
          <div className="nutrition-container">
        <section className="nutrition-heading">
          <div>
            <p className="nutrition-eyebrow">AI-POWERED FOOD TRACKING</p>
            <h1>Nutrition Analyzer</h1>
            <p className="nutrition-subtitle">
              Photograph your meal, review the food matches, and confirm its nutrition
              using USDA FoodData Central.
            </p>
          </div>
          <div className="nutrition-heading-mark" aria-hidden="true">N</div>
        </section>

        {error && (
          <div className="nutrition-alert nutrition-alert-error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="nutrition-alert nutrition-alert-success" role="status">
            {notice}
          </div>
        )}

        <section className="nutrition-panel nutrition-upload-panel">
          <div className="nutrition-section-heading">
            <div>
              <span className="nutrition-step">01</span>
              <h2>Upload your meal</h2>
            </div>
            <span className="nutrition-muted-label">JPEG · PNG · WEBP · AVIF</span>
          </div>

          <label className="nutrition-upload-area">
            {previewUrl ? (
              <img className="nutrition-preview" src={previewUrl} alt="Selected meal preview" />
            ) : (
              <span className="nutrition-upload-placeholder">
                <span className="nutrition-upload-icon">＋</span>
                <strong>Choose a food photo</strong>
                <span>Clear images with visible portions work best</span>
                <span className="nutrition-upload-limit">Maximum file size: 10 MB</span>
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleFileChange}
              disabled={analyzing || confirming}
            />
          </label>

          {selectedFile && (
            <div className="nutrition-file-row">
              <span>{selectedFile.name}</span>
              <button
                type="button"
                className="nutrition-text-button"
                onClick={() => {
                  setSelectedFile(null)
                  setPreviewUrl('')
                }}
              >
                Remove image
              </button>
            </div>
          )}

          <button
            type="button"
            className="nutrition-primary-button"
            onClick={handleAnalyze}
            disabled={!selectedFile || analyzing || confirming}
          >
            {analyzing ? 'Analyzing meal…' : 'Analyze food image'}
          </button>
          <p className="nutrition-helper">
            AI estimates food identity and portion size. You will review the results
            before nutrition is calculated or saved.
          </p>
        </section>

        {analysis && (
          <section className="nutrition-panel">
            <div className="nutrition-section-heading">
              <div>
                <span className="nutrition-step">02</span>
                <h2>Review detected foods</h2>
              </div>
              <span className="nutrition-count">{analysis.items.length} item(s)</span>
            </div>

            {analysis.image_quality_warning && (
              <div className="nutrition-warning">
                Image quality note: {analysis.image_quality_warning}
              </div>
            )}

            {analysis.overall_notes?.length > 0 && (
              <ul className="nutrition-note-list">
                {analysis.overall_notes.map((note, index) => (
                  <li key={`${index}-${note}`}>{note}</li>
                ))}
              </ul>
            )}

            <label className="nutrition-field nutrition-meal-name">
              <span>Meal name <small>(optional)</small></span>
              <input
                type="text"
                value={mealName}
                maxLength={120}
                placeholder="e.g. Lunch"
                onChange={(event) => setMealName(event.target.value)}
              />
            </label>

            <div className="nutrition-food-list">
              {analysis.items.map((item, index) => (
                <article className="nutrition-food-card" key={`${item.item_number || index}-${index}`}>
                  <div className="nutrition-food-card-top">
                    <div>
                      <span className="nutrition-food-number">FOOD {index + 1}</span>
                      <h3>{item.food_name || 'Detected food'}</h3>
                    </div>
                    <button
                      type="button"
                      className="nutrition-text-button nutrition-remove-button"
                      onClick={() => removeAnalysisItem(index)}
                      disabled={analysis.items.length === 1}
                    >
                      Remove
                    </button>
                  </div>

                  <label className="nutrition-field">
                    <span>Food name</span>
                    <input
                      type="text"
                      value={item.food_name}
                      maxLength={200}
                      onChange={(event) =>
                        updateAnalysisItem(index, 'food_name', event.target.value)
                      }
                    />
                  </label>

                  <div className="nutrition-food-meta">
                    <span>AI confidence: {formatNumber(Number(item.confidence) * 100, '%')}</span>
                    <span>Estimated portion: {formatNumber(item.estimated_weight_g, ' g')}</span>
                  </div>

                  <label className="nutrition-field">
                    <span>Serving weight (grams)</span>
                    <input
                      type="number"
                      min="0.01"
                      max="5000"
                      step="0.1"
                      value={item.serving_weight_g}
                      onChange={(event) =>
                        updateAnalysisItem(index, 'serving_weight_g', event.target.value)
                      }
                    />
                  </label>

                  {item.uncertainty_notes?.length > 0 && (
                    <div className="nutrition-uncertainty">
                      <strong>Review notes</strong>
                      <ul>
                        {item.uncertainty_notes.map((note, noteIndex) => (
                          <li key={`${noteIndex}-${note}`}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <label className="nutrition-field">
                    <span>Choose the matching USDA food entry</span>
                    <select
                      value={item.selected_fdc_id}
                      onChange={(event) =>
                        updateAnalysisItem(index, 'selected_fdc_id', event.target.value)
                      }
                    >
                      <option value="">Select a USDA match</option>
                      {(item.usda_candidates || []).map((candidate) => (
                        <option
                          key={candidate.fdc_id}
                          value={String(candidate.fdc_id)}
                        >
                          {candidate.description} ({candidate.data_type || 'USDA'})
                        </option>
                      ))}
                    </select>
                  </label>

                  {item.usda_lookup_status === 'temporarily_unavailable' && (
                    <p className="nutrition-inline-warning">
                      USDA search is temporarily unavailable for this item. Please try again later.
                    </p>
                  )}

                  {(!item.usda_candidates || item.usda_candidates.length === 0) && (
                    <p className="nutrition-inline-warning">
                      No USDA matches were found for this item. Remove it to continue with
                      the other detected foods, or analyze another image.
                    </p>
                  )}
                </article>
              ))}
            </div>

            <button
              type="button"
              className="nutrition-primary-button"
              onClick={handleConfirm}
              disabled={confirming || analysis.items.length === 0}
            >
              {confirming ? 'Confirming with USDA…' : 'Confirm meal and calculate nutrition'}
            </button>

            <p className="nutrition-helper">
              Nutrition values are retrieved and calculated by the server after you confirm
              each USDA match and serving weight.
            </p>

            {analysis.disclaimer && (
              <p className="nutrition-disclaimer">{analysis.disclaimer}</p>
            )}
          </section>
        )}

        {savedMeal && (
          <section className="nutrition-panel nutrition-saved-panel">
            <div className="nutrition-section-heading">
              <div>
                <span className="nutrition-step">03</span>
                <h2>Meal saved</h2>
              </div>
              <span className="nutrition-saved-status">Confirmed</span>
            </div>

            <h3 className="nutrition-saved-title">
              {savedMeal.meal?.meal_name || 'Your meal'}
            </h3>
            <p className="nutrition-muted">
              {formatDate(savedMeal.meal?.consumed_at || savedMeal.meal?.created_at)}
            </p>
            <MacroGrid totals={savedMeal.meal_totals} />

            {savedMeal.items?.length > 0 && (
              <div className="nutrition-confirmed-items">
                {savedMeal.items.map((item, index) => (
                  <div className="nutrition-confirmed-item" key={`${item.fdc_id}-${index}`}>
                    <span>{item.food_name}</span>
                    <span>{formatNumber(item.serving_weight_g, ' g')}</span>
                  </div>
                ))}
              </div>
            )}

            {savedMeal.disclaimer && (
              <p className="nutrition-disclaimer">{savedMeal.disclaimer}</p>
            )}
          </section>
        )}

        <section className="nutrition-panel nutrition-history-panel">
          <div className="nutrition-section-heading">
            <div>
              <span className="nutrition-step">04</span>
              <h2>Meal history</h2>
            </div>
            <button
              type="button"
              className="nutrition-text-button"
              onClick={refreshHistory}
            >
              Refresh
            </button>
          </div>

          {historyLoading && <p className="nutrition-muted">Loading meal history…</p>}
          {historyError && <p className="nutrition-inline-warning">{historyError}</p>}

          {!historyLoading && history.length === 0 && !historyError && (
            <div className="nutrition-empty-state">
              <strong>No confirmed meals yet</strong>
              <span>Your saved meals and nutrition summaries will appear here.</span>
            </div>
          )}

          <div className="nutrition-history-list">
            {history.map((meal) => (
              <button
                type="button"
                className="nutrition-history-card"
                key={meal.id}
                onClick={() => openMealDetails(meal.id)}
              >
                <span className="nutrition-history-main">
                  <strong>{meal.meal_name || 'Meal'}</strong>
                  <small>{formatDate(meal.consumed_at || meal.created_at)}</small>
                </span>
                <span className="nutrition-history-calories">
                  {formatNumber(meal.meal_totals?.calories, ' kcal')}
                </span>
              </button>
            ))}
          </div>

          {hasMoreHistory && (
            <button
              type="button"
              className="nutrition-secondary-button"
              onClick={loadMoreHistory}
            >
              Load more meals
            </button>
          )}
        </section>

        {detailLoading && (
          <section className="nutrition-panel">
            <p className="nutrition-muted">Loading meal details…</p>
          </section>
        )}

        {selectedMeal && (
          <section className="nutrition-panel nutrition-detail-panel">
            <div className="nutrition-section-heading">
              <h2>{selectedMeal.meal?.meal_name || 'Meal details'}</h2>
              <button
                type="button"
                className="nutrition-text-button"
                onClick={() => setSelectedMeal(null)}
              >
                Close
              </button>
            </div>

            <p className="nutrition-muted">
              {formatDate(selectedMeal.meal?.consumed_at || selectedMeal.meal?.created_at)}
            </p>
            <MacroGrid totals={selectedMeal.meal_totals} />

            <div className="nutrition-confirmed-items">
              {(selectedMeal.items || []).map((item, index) => (
                <article className="nutrition-detail-item" key={`${item.fdc_id}-${index}`}>
                  <strong>{item.food_name}</strong>
                  <span>{item.usda_description}</span>
                  <small>
                    {formatNumber(item.serving_weight_g, ' g')} · {item.nutrition_source || 'Nutrition source unavailable'}
                  </small>
                  <p>
                    {formatNumber(item.calories, ' kcal')} ·
                    {' '}{formatNumber(item.protein_g, ' g')} protein ·
                    {' '}{formatNumber(item.carbohydrates_g, ' g')} carbs ·
                    {' '}{formatNumber(item.fat_g, ' g')} fat
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <p className="nutrition-footer-note">
          Nutrition estimates are informational and should not replace professional dietary advice.
        </p>
      </div>
        </div>
      </div>
    </main>
  )
}

