import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileVideo,
  LoaderCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formAnalysisService } from '../services/formAnalysisService'
import FeatureSidebar from '../components/FeatureSidebar.jsx'
import './FormAnalysis.css'

const MAX_VIDEO_BYTES = 50 * 1024 * 1024

const EXERCISE_LABELS = {
  squat: 'Squat',
  push_up: 'Push-up',
  bicep_curl: 'Bicep curl',
  shoulder_press: 'Shoulder press',
  lunge: 'Lunge',
  unknown: 'Exercise not identified',
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function FeedbackItem({ item }) {
  const severity = ['info', 'warning', 'critical'].includes(item?.severity)
    ? item.severity
    : 'info'

  return (
    <article className={`form-feedback-item form-feedback-${severity}`}>
      <span className="form-feedback-icon">
        {severity === 'critical'
          ? <AlertCircle size={17} />
          : severity === 'warning'
            ? <AlertTriangle size={17} />
            : <Activity size={17} />}
      </span>
      <div>
        <strong>{item?.category || 'Observation'}</strong>
        <p>{item?.message || 'No additional detail was provided.'}</p>
      </div>
      <span className="form-feedback-severity">{severity}</span>
    </article>
  )
}

export default function FormAnalysis() {
  const { user, token, logout } = useAuth()
  const [videoFile, setVideoFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileError, setFileError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    if (!previewUrl) return undefined

    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  function selectVideo(file) {
    setFileError('')
    setRequestError('')
    setAnalysis(null)
    setPreviewUrl('')

    if (!file) {
      setVideoFile(null)
      return
    }

    if (file.type !== 'video/mp4') {
      setVideoFile(null)
      setFileError('Please select an MP4 video file.')
      return
    }

    if (file.size <= 0) {
      setVideoFile(null)
      setFileError('The selected video is empty. Please choose another file.')
      return
    }

    if (file.size > MAX_VIDEO_BYTES) {
      setVideoFile(null)
      setFileError('The video exceeds the 50 MB upload limit.')
      return
    }

    setVideoFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleAnalyze(event) {
    event.preventDefault()
    setRequestError('')
    setAnalysis(null)

    if (!videoFile) {
      setFileError('Choose an MP4 video before starting the analysis.')
      return
    }

    setAnalyzing(true)

    try {
      const response = await formAnalysisService.analyzeVideo(token, videoFile)
      setAnalysis(response.analysis || null)

      if (!response.analysis) {
        setRequestError('The service returned an unexpected response. Please try again.')
      }
    } catch (error) {
      if (error.status === 401) {
        logout()
        return
      }

      setRequestError(error.message || 'Video analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  function clearVideo() {
    if (analyzing) return
    setVideoFile(null)
    setAnalysis(null)
    setFileError('')
    setRequestError('')
  }

  const feedback = Array.isArray(analysis?.feedback) ? analysis.feedback : []
  const warnings = Array.isArray(analysis?.safety_warnings)
    ? analysis.safety_warnings
    : []
  const isCompleted = analysis?.analysis_status === 'completed'
  const displayName = user?.full_name?.trim()?.split(/\s+/)[0] || 'there'

  return (
    <main className="auth-page form-analysis-page">
      <div className="auth-background-glow" />

      <header className="dashboard-topbar form-analysis-topbar">
        <Link className="auth-brand form-analysis-brand" to="/dashboard">
          <span className="auth-brand-mark"><Activity size={21} /></span>
          <span>FitLife<span className="auth-brand-accent">AI</span></span>
        </Link>

        <div className="dashboard-top-actions">
          <span className="dashboard-user-email">{user?.email || ''}</span>
          <Link className="form-analysis-back-link" to="/dashboard">Workout Studio</Link>
        </div>
      </header>

      <div className="feature-workspace-layout">
        <FeatureSidebar />

        <div className="feature-workspace-main">
          <div className="form-analysis-shell">
            <section className="form-analysis-heading">
              <div>
                <div className="form-analysis-eyebrow">
                  <Sparkles size={14} /> MOVEMENT REVIEW
                </div>
                <h1>Exercise Form <span>Analysis</span></h1>
                <p>
                  Upload a short workout clip and get AI-assisted movement observations.
                  Start with a clear, full-body recording, {displayName}.
                </p>
              </div>
              <div className="form-analysis-heading-icon">
                <ScanLine size={29} />
              </div>
            </section>

            <section className="form-analysis-info-strip">
              <div>
                <Video size={18} />
                <span><strong>MP4 video</strong><small>Accepted format</small></span>
              </div>
              <div>
                <Upload size={18} />
                <span><strong>50 MB maximum</strong><small>Upload size limit</small></span>
              </div>
              <div>
                <Clock3 size={18} />
                <span><strong>AI processing</strong><small>May take a few minutes</small></span>
              </div>
            </section>

            <div className="form-analysis-content-grid">
              <section className="form-analysis-panel form-analysis-upload-panel">
                <div className="form-analysis-panel-heading">
                  <div>
                    <span className="form-analysis-section-label">01 / VIDEO INPUT</span>
                    <h2>Upload your exercise video</h2>
                    <p>Keep your body visible throughout the movement for better frame analysis.</p>
                  </div>
                  <span className="form-analysis-panel-icon"><FileVideo size={20} /></span>
                </div>

                <form onSubmit={handleAnalyze} className="form-analysis-upload-form">
                  {!videoFile ? (
                    <label className="form-analysis-dropzone">
                      <input
                        type="file"
                        accept="video/mp4,.mp4"
                        onChange={(event) => selectVideo(event.target.files?.[0])}
                        disabled={analyzing}
                      />
                      <span className="form-analysis-upload-icon"><Upload size={25} /></span>
                      <strong>Choose an MP4 video</strong>
                      <span>Browse files from your device</span>
                      <small>MP4 only · Maximum 50 MB</small>
                    </label>
                  ) : (
                    <div className="form-analysis-video-card">
                      <div className="form-analysis-video-preview">
                        {previewUrl && (
                          <video
                            src={previewUrl}
                            controls
                            playsInline
                            preload="metadata"
                            aria-label="Selected exercise video preview"
                          />
                        )}
                      </div>
                      <div className="form-analysis-file-details">
                        <span className="form-analysis-file-icon"><FileVideo size={19} /></span>
                        <div>
                          <strong title={videoFile.name}>{videoFile.name}</strong>
                          <small>{formatBytes(videoFile.size)} · MP4 video</small>
                        </div>
                        <button
                          type="button"
                          className="form-analysis-clear-button"
                          onClick={clearVideo}
                          disabled={analyzing}
                          aria-label="Remove selected video"
                          title="Remove video"
                        >
                          <X size={17} />
                        </button>
                      </div>
                    </div>
                  )}

                  {fileError && (
                    <div className="form-analysis-alert form-analysis-alert-error" role="alert">
                      <AlertCircle size={16} /> {fileError}
                    </div>
                  )}

                  {requestError && (
                    <div className="form-analysis-alert form-analysis-alert-error" role="alert">
                      <AlertCircle size={16} /> {requestError}
                    </div>
                  )}

                  <button
                    className="form-analysis-submit"
                    type="submit"
                    disabled={!videoFile || analyzing}
                  >
                    {analyzing
                      ? <><LoaderCircle className="form-analysis-spinner" size={17} /> Analyzing video...</>
                      : <>Analyze exercise <ArrowUpRight size={17} /></>}
                  </button>

                  {analyzing && (
                    <div className="form-analysis-processing" role="status">
                      <span className="form-analysis-processing-dot" />
                      <div>
                        <strong>Your video is being processed</strong>
                        <p>Pose analysis and AI observations can take several minutes. Keep this page open.</p>
                      </div>
                    </div>
                  )}
                </form>
              </section>

              <aside className="form-analysis-panel form-analysis-guide-panel">
                <span className="form-analysis-section-label">RECORDING GUIDE</span>
                <h2>Get a clearer analysis</h2>
                <div className="form-analysis-guide-list">
                  <div>
                    <span>01</span>
                    <p><strong>Show your full body</strong>Keep your head, torso and limbs in the frame.</p>
                  </div>
                  <div>
                    <span>02</span>
                    <p><strong>Use a stable camera</strong>Place your device where it will not move.</p>
                  </div>
                  <div>
                    <span>03</span>
                    <p><strong>Use good lighting</strong>Avoid shadows and objects blocking your movement.</p>
                  </div>
                  <div>
                    <span>04</span>
                    <p><strong>Record one exercise</strong>A focused clip makes movement observations easier.</p>
                  </div>
                </div>
                <div className="form-analysis-supported">
                  <CheckCircle2 size={16} />
                  <p><strong>Repetition counter support</strong>Squats and bicep curls currently have supported repetition counting.</p>
                </div>
              </aside>
            </div>

            {analysis && (
              <section className="form-analysis-results" aria-live="polite">
                <div className="form-analysis-results-heading">
                  <div>
                    <span className="form-analysis-section-label">02 / ANALYSIS OUTPUT</span>
                    <h2>Your movement report</h2>
                    <p>Review the observations returned for this video.</p>
                  </div>
                  <span className={`form-analysis-status ${isCompleted ? 'is-complete' : 'is-incomplete'}`}>
                    {isCompleted ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {isCompleted ? 'Completed' : 'Insufficient data'}
                  </span>
                </div>

                <div className="form-analysis-metrics">
                  <article className="form-analysis-metric">
                    <span>EXERCISE</span>
                    <strong>{EXERCISE_LABELS[analysis.exercise] || 'Not identified'}</strong>
                    <small>Detected exercise</small>
                  </article>
                  <article className="form-analysis-metric">
                    <span>REPETITIONS</span>
                    <strong>{Number.isFinite(analysis.repetitions) ? analysis.repetitions : '—'}</strong>
                    <small>Experimental estimate</small>
                  </article>
                  <article className="form-analysis-metric">
                    <span>FORM SCORE</span>
                    <strong>{analysis.form_score == null ? '—' : `${analysis.form_score}/100`}</strong>
                    <small>{analysis.form_score == null ? 'Not validated / unavailable' : 'AI-provided value'}</small>
                  </article>
                  <article className="form-analysis-metric">
                    <span>FRAMES</span>
                    <strong>{Number.isFinite(analysis.frames_analyzed) ? analysis.frames_analyzed : '—'}</strong>
                    <small>Frames analyzed</small>
                  </article>
                </div>

                <article className="form-analysis-result-panel">
                  <div className="form-analysis-result-panel-heading">
                    <Sparkles size={18} />
                    <h3>Analysis summary</h3>
                  </div>
                  <p>{analysis.summary || 'No summary was returned for this video.'}</p>
                </article>

                <article className="form-analysis-result-panel">
                  <div className="form-analysis-result-panel-heading">
                    <Activity size={18} />
                    <h3>Movement feedback</h3>
                  </div>
                  {feedback.length ? (
                    <div className="form-analysis-feedback-list">
                      {feedback.map((item, index) => (
                        <FeedbackItem key={`${item.category || 'feedback'}-${index}`} item={item} />
                      ))}
                    </div>
                  ) : (
                    <p className="form-analysis-muted">No movement feedback entries were returned for this analysis.</p>
                  )}
                </article>

                <article className="form-analysis-result-panel">
                  <div className="form-analysis-result-panel-heading">
                    <ShieldCheck size={18} />
                    <h3>Safety notes</h3>
                  </div>
                  {warnings.length ? (
                    <ul className="form-analysis-warning-list">
                      {warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
                    </ul>
                  ) : (
                    <p className="form-analysis-muted">
                      No safety warnings were returned. This does not mean the exercise has been certified as safe.
                    </p>
                  )}
                </article>

                <div className="form-analysis-disclaimer">
                  <AlertTriangle size={17} />
                  <p>
                    AI-assisted estimates are experimental and are not a medical diagnosis
                    or a certified coaching assessment. Repetition counts may be inaccurate.
                    Stop exercising if you feel pain, dizziness or discomfort.
                  </p>
                </div>
              </section>
            )}

            {!analysis && (
              <section className="form-analysis-empty-results">
                <span><ScanLine size={22} /></span>
                <div>
                  <strong>Your analysis will appear here</strong>
                  <p>Upload an MP4 clip and start the analysis to see detected exercise details, estimated repetitions and movement feedback.</p>
                </div>
              </section>
            )}

            <div className="form-analysis-footer-note">
              <ShieldCheck size={15} />
              Your video is submitted to the FitLife AI analysis service for processing.
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

