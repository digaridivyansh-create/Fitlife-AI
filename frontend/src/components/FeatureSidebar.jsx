import { NavLink } from 'react-router-dom'
import {
  Activity,
  Apple,
  Dumbbell,
  MessageCircle,
  ChartNoAxesCombined,
  ScanLine,
  LockKeyhole,
} from 'lucide-react'
import './FeatureSidebar.css'

const activeFeatures = [
  {
    label: 'Workout Studio',
    description: 'Planner & AI Coach',
    path: '/dashboard',
    icon: Dumbbell,
  },
  {
    label: 'Nutrition Analyzer',
    description: 'Food & calorie tracking',
    path: '/nutrition',
    icon: Apple,
  },
  {
    label: 'Fitness AI Chatbot',
    description: 'Your fitness assistant',
    path: '/chatbot',
    icon: MessageCircle,
  },
  {
    label: 'Progress & Insights',
    description: 'Your performance analytics',
    path: '/progress',
    icon: ChartNoAxesCombined,
  },
  {
    label: 'Exercise Form Analysis',
    description: 'Movement feedback',
    path: '/form-analysis',
    icon: ScanLine,
  },
]

const upcomingFeatures = []

export default function FeatureSidebar() {
  return (
    <aside className="feature-sidebar">
      <div className="feature-sidebar-brand">
        <span className="feature-sidebar-brand-icon">
          <Activity size={21} />
        </span>
        <span>
          FitLife<span className="feature-sidebar-brand-accent">AI</span>
        </span>
      </div>

      <div className="feature-sidebar-label">YOUR WORKSPACE</div>
      <h2 className="feature-sidebar-title">Features</h2>

      <nav className="feature-sidebar-nav" aria-label="Fitness features">
        {activeFeatures.map((feature) => {
          const Icon = feature.icon

          return (
            <NavLink
              key={feature.path}
              to={feature.path}
              end
              className={({ isActive }) =>
                `feature-sidebar-link${isActive ? ' active' : ''}`
              }
            >
              <span className="feature-sidebar-link-icon">
                <Icon size={19} />
              </span>
              <span className="feature-sidebar-link-copy">
                <strong>{feature.label}</strong>
                <small>{feature.description}</small>
              </span>
            </NavLink>
          )
        })}
      </nav>

      {upcomingFeatures.length > 0 && (
        <>
          <div className="feature-sidebar-divider" />

          <div className="feature-sidebar-label">COMING SOON</div>

          <div className="feature-sidebar-upcoming">
            {upcomingFeatures.map((feature) => {
              const Icon = feature.icon

              return (
                <div className="feature-sidebar-link upcoming" key={feature.label}>
                  <span className="feature-sidebar-link-icon">
                    <Icon size={19} />
                  </span>
                  <span className="feature-sidebar-link-copy">
                    <strong>{feature.label}</strong>
                    <small>{feature.description}</small>
                  </span>
                  <LockKeyhole className="feature-sidebar-lock" size={13} />
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="feature-sidebar-footer">
        <span className="feature-sidebar-status-dot" />
        Your fitness journey, one step at a time.
      </div>
    </aside>
  )
}


