import { motion } from 'motion/react'
import {
  ArrowDown,
  ArrowRight,
  Activity,
  Brain,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Menu,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react'
import { useState } from 'react'
import './App.css'

const features = [
  {
    number: '01',
    icon: Dumbbell,
    title: 'AI Workout Planner',
    description: 'Training plans shaped around your goals, experience, schedule and fitness level.',
    tag: 'PERSONALIZED TRAINING',
  },
  {
    number: '02',
    icon: Utensils,
    title: 'Smart Nutrition',
    description: 'Analyze food photos and understand calories and nutrition in your meals.',
    tag: 'FOOD INTELLIGENCE',
  },
  {
    number: '03',
    icon: Brain,
    title: 'Fitness AI Coach',
    description: 'Ask questions, get guidance and make informed decisions throughout your journey.',
    tag: 'AI ASSISTANT',
  },
  {
    number: '04',
    icon: ChartNoAxesCombined,
    title: 'Progress & Insights',
    description: 'Track your fitness journey and understand meaningful changes over time.',
    tag: 'YOUR PROGRESS',
  },
  {
    number: '05',
    icon: Activity,
    title: 'Exercise Form Analysis',
    description: 'Use video-based movement analysis to understand your exercise technique.',
    tag: 'MOVEMENT ANALYSIS',
  },
  {
    number: '06',
    icon: Sparkles,
    title: 'Generative Workout Coach',
    description: 'Explore AI-generated workout suggestions and review them before approval.',
    tag: 'ADAPTIVE COACHING',
  },
]

const benefits = [
  'Plans built around your goals',
  'Nutrition insights from food photos',
  'Progress tracking with AI insights',
  'Exercise technique analysis',
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="site-shell">
      <div className="announcement">
        <Sparkles size={14} />
        <span>Your fitness journey, powered by intelligence.</span>
        <a href="#features">Explore FitLife AI <ArrowRight size={13} /></a>
      </div>

      <header className="navbar">
        <a className="brand" href="#home" aria-label="FitLife AI home">
          <span className="brand-mark"><Activity size={22} strokeWidth={2.6} /></span>
          <span>fitlife<span className="brand-accent">.</span><small>AI</small></span>
        </a>

        <nav className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
          <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#approach" onClick={() => setMenuOpen(false)}>Our approach</a>
          <a href="#journey" onClick={() => setMenuOpen(false)}>Your journey</a>
          <div className="mobile-nav-actions">
            <a className="nav-login" href="/login">Log in</a>
            <a className="button button-primary" href="/register">Get started <ArrowRight size={16} /></a>
          </div>
        </nav>

        <div className="nav-actions">
          <a className="nav-login" href="/login">Log in</a>
          <a className="button button-primary nav-cta" href="/register">Get started <ArrowRight size={16} /></a>
        </div>

        <button
          className="mobile-menu"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </header>

      <section className="hero-section" id="home">
        <div className="hero-copy">
          <motion.div
            className="eyebrow"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="eyebrow-dot" />
            YOUR PERSONAL AI FITNESS COMPANION
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.1 }}
          >
            Stronger every day.
            <br />
            <span>Smarter every step.</span>
          </motion.h1>

          <motion.p
            className="hero-description"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Meet a more intelligent way to get fit. Personalized workouts,
            nutrition insights and AI coaching â€” brought together in one place.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <a href="/register" className="button button-primary button-large">
              Start your journey <ArrowRight size={18} />
            </a>
            <a href="#features" className="button button-outline button-large">
              Discover features <ArrowDown size={17} />
            </a>
          </motion.div>

          <motion.div
            className="hero-proof"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="proof-icon"><HeartPulse size={19} /></div>
            <div>
              <strong>Built around you</strong>
              <span>Your goals. Your pace. Your progress.</span>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.94, x: 25 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
        >
          <div className="hero-image-wrap">
            <img
              src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1100&q=85"
              alt="Modern gym with strength training equipment"
              className="hero-image"
            />
            <div className="image-shade" />
            <div className="image-label">
              <span className="live-dot" /> BUILT FOR YOUR NEXT LEVEL
            </div>
          </div>

          <motion.div
            className="floating-card workout-card"
            animate={{ y: [0, -9, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="floating-icon"><Dumbbell size={19} /></div>
            <div>
              <span>YOUR TRAINING</span>
              <strong>Made personal.</strong>
            </div>
            <ChevronRight size={18} className="floating-arrow" />
          </motion.div>

          <motion.div
            className="floating-card ai-card"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="ai-card-icon"><Sparkles size={16} /></span>
            <div>
              <span>INTELLIGENCE MEETS FITNESS</span>
              <strong>Your AI fitness companion</strong>
            </div>
          </motion.div>

          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
        </motion.div>
      </section>

      <section className="trust-strip" id="approach">
        <div className="trust-heading">ONE CONNECTED FITNESS EXPERIENCE</div>
        <div className="trust-items">
          <span><Check size={15} /> Personalized</span>
          <span><Check size={15} /> Data-informed</span>
          <span><Check size={15} /> Goal-focused</span>
          <span><Check size={15} /> Built for progress</span>
        </div>
      </section>

      <section className="features-section section-pad" id="features">
        <div className="section-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> THE FITLIFE ECOSYSTEM</div>
            <h2>Everything you need.<br /><span>One intelligent platform.</span></h2>
          </div>
          <p>
            From your first workout to your next milestone, FitLife AI connects
            the tools that help you train, eat and progress with purpose.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.article
                className="feature-card"
                key={feature.number}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: index * 0.07 }}
                whileHover={{ y: -7 }}
              >
                <div className="feature-top">
                  <div className="feature-icon"><Icon size={22} /></div>
                  <span>{feature.number}</span>
                </div>
                <div className="feature-tag">{feature.tag}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <div className="feature-bottom"><span>Explore capability</span><ArrowRight size={16} /></div>
              </motion.article>
            )
          })}
        </div>
      </section>

      <section className="gallery-section section-pad" id="fitness-gallery">
        <div className="section-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> FIND YOUR MOVEMENT</div>
            <h2>Every move has a<br /><span>purpose.</span></h2>
          </div>
          <p>
            Strength, endurance, mobility and recovery. Build a balanced
            routine that works for your body and your goals.
          </p>
        </div>

        <div className="fitness-gallery">
          {[
            { title: 'Strength training', type: 'BUILD YOUR STRENGTH', image: 'photo-1583454110551-21f2fa2afe61' },
            { title: 'Cardio & endurance', type: 'PUSH YOUR LIMITS', image: 'photo-1538805060514-97d9cc17730c' },
            { title: 'Yoga & mobility', type: 'FIND YOUR BALANCE', image: 'photo-1544367567-0f2fcb009e0b' },
            { title: 'Personal training', type: 'TRAIN WITH PURPOSE', image: 'photo-1517836357463-d25dfeac3438' },
          ].map((item, index) => (
            <motion.article
              className={`gallery-card gallery-card-${index + 1}`}
              key={item.title}
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.65, delay: index * 0.12 }}
              whileHover={{ y: -8 }}
            >
              <img
                src={`https://images.unsplash.com/${item.image}?auto=format&fit=crop&w=900&q=85`}
                alt={item.title}
                loading="lazy"
              />
              <div className="gallery-overlay">
                <span>{item.type}</span>
                <h3>{item.title}</h3>
                <ArrowRight size={19} />
              </div>
            </motion.article>
          ))}
        </div>
      </section>
      <section className="journey-section section-pad" id="journey">
        <div className="journey-image">
          <img
            src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1000&q=85"
            alt="Athlete training with weights"
            loading="lazy"
          />
          <div className="journey-image-caption">
            <span>CONSISTENCY OVER PERFECTION</span>
            <strong>Progress is built one day at a time.</strong>
          </div>
        </div>

        <div className="journey-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> A BETTER WAY TO MOVE FORWARD</div>
          <h2>Your goals.<br /><span>Your plan.</span><br />Your progress.</h2>
          <p>
            Fitness isn't one-size-fits-all. FitLife AI brings your workouts,
            nutrition, movement and progress into a connected experience
            designed to support your individual journey.
          </p>
          <ul className="benefit-list">
            {benefits.map((benefit) => (
              <li key={benefit}><span><Check size={14} /></span>{benefit}</li>
            ))}
          </ul>
          <a href="/register" className="button button-primary button-large">
            Begin with FitLife AI <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <section className="quotes-section section-pad">
        <motion.div
          className="quote-card"
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
        >
          <div className="quote-mark">"</div>
          <blockquote>
            The secret of getting ahead is getting started.
          </blockquote>
          <span>— MARK TWAIN</span>
          <div className="quote-decoration"><Activity size={36} /></div>
        </motion.div>

        <motion.div
          className="quote-card"
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <div className="quote-mark">"</div>
          <blockquote>
            It never gets easier. You just get stronger.
          </blockquote>
          <span>— GREG LEMOND</span>
          <div className="quote-decoration"><Dumbbell size={36} /></div>
        </motion.div>
      </section>

      <section className="final-cta">
        <div className="final-cta-glow" />
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT CHAPTER STARTS HERE</div>
        <h2>Ready to make<br /><span>your move?</span></h2>
        <p>Build better habits. Train with purpose. See what progress feels like.</p>
        <a href="/register" className="button button-primary button-large">
          Get started with FitLife AI <ArrowRight size={18} />
        </a>
        <span className="cta-note">Your journey. Your pace. One step at a time.</span>
      </section>

      <footer className="footer">
        <a className="brand" href="#home">
          <span className="brand-mark"><Activity size={21} strokeWidth={2.6} /></span>
          <span>fitlife<span className="brand-accent">.</span><small>AI</small></span>
        </a>
        <span className="footer-copy">Â© {new Date().getFullYear()} FitLife AI. Built for your journey.</span>
        <div className="footer-links">
          <a href="#features">Features</a>
          <a href="/login">Log in</a>
          <a href="/register">Get started</a>
        </div>
      </footer>
    </main>
  )
}

export default App

