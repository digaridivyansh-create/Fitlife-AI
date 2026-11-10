# FitLife AI 🏋️‍♂️🤖
### Your AI-Powered Personal Fitness & Wellness Companion

FitLife AI is an intelligent fitness and wellness platform that combines Artificial Intelligence, computer vision, nutrition analysis, and personalized insights to help users make smarter health and fitness decisions.

The platform brings workout planning, food analysis, fitness conversations, progress tracking, and exercise form analysis together in one integrated application.

Our goal is to make personalized fitness guidance more accessible, interactive, and data-driven.
live link=https://fitlife-ai-frontend.vercel.app/

---

## 🚀 Key Features

### 1. AI Workout Planner
- Generates personalized workout plans.
- Uses user fitness information and goals to guide workout recommendations.
- Provides structured exercise routines.
- Helps users follow a consistent fitness schedule.

### 2. AI Food & Nutrition Analyzer
- Analyzes uploaded food photographs.
- Uses AI-powered image analysis to identify food.
- Provides estimated nutritional information.
- Helps users understand their food choices and nutrition intake.

### 3. AI Fitness Chatbot
- Provides an interactive fitness assistant.
- Answers fitness and workout-related questions.
- Offers guidance on nutrition and healthy habits.
- Makes fitness information easier to understand.

### 4. Progress Tracking & AI Insights
- Tracks body-weight records.
- Records completed workouts.
- Monitors daily fitness habits.
- Generates 7-day, 30-day, and 90-day progress summaries.
- Uses AI to generate insights from actual user progress data.

### 5. AI Exercise Form Analysis
- Uses computer vision to analyze exercise movements.
- Tracks body landmarks and posture.
- Provides exercise form feedback.
- Includes experimental repetition estimates where supported.
- Helps users become more aware of their exercise technique.

**Note:** Exercise analysis is an assistive feature, not a certified medical, physiotherapy, or professional coaching assessment. Repetition estimates and form scores may be unavailable or inaccurate.

---

## 🏗️ System Architecture

FitLife AI follows a modular architecture with separate frontend, backend, and AI service layers.

```text
                  FITLIFE AI
                      |
          +-----------+-----------+
          |                       |
     React Frontend          User Interface
          |
          v
     Node.js Backend
       (Fastify)
          |
     +----+----------------+
     |                     |
     v                     v
 PostgreSQL            Python AI Service
 Database                 (FastAPI)
                            |
               +------------+------------+
               |            |            |
               v            v            v
           Workout      Nutrition    Computer Vision
            Logic        Analysis     Form Analysis
               |            |            |
               +------------+------------+
                            |
                     AI-Powered Insights
```

### Architecture Components

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React | User interface and interactions |
| Main Backend | Node.js, Fastify | APIs, authentication, business logic |
| AI Service | Python, FastAPI | AI processing and analysis |
| Database | PostgreSQL | Persistent application data |
| Computer Vision | MediaPipe / ONNX-based components | Exercise movement and form analysis |
| AI Integration | Gemini and other configured AI components | AI-powered responses and insights |

---

## 🛠️ Technology Stack

**Frontend**
- React
- JavaScript
- HTML5
- CSS3
- Vite

**Backend**
- Node.js
- Fastify
- REST APIs
- JWT Authentication

**AI & Machine Learning**
- Python
- FastAPI
- Google Gemini integration
- Computer Vision
- MediaPipe
- ONNX Runtime

**Database**
- PostgreSQL

**Development Tools**
- Git
- GitHub
- npm
- Python Virtual Environment

---

## 📂 Project Structure

```text
FitLifeAI/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── src/
│   ├── tests/
│   ├── migrations/
│   ├── .env.example
│   └── package.json
│
├── ai-service/
│   ├── app/
│   │   └── form_analysis/
│   │       └── models/
│   ├── requirements.txt
│   └── .env.example
│
├── .gitignore
└── README.md
```

---

## ⚙️ Installation & Setup

### Prerequisites

Install the following before running the project:

- Node.js and npm
- Python
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/digaridivyansh-create/Fitlife-AI.git
```

```bash
cd Fitlife-AI
```

### 2. Configure the Backend

```bash
cd backend
npm install
```

Create your local environment file using the provided template:

```powershell
Copy-Item .env.example .env
```

Configure the required database credentials, authentication secrets, AI API keys, and service settings in `.env`.

Run the backend using the development command configured in `backend/package.json`.

### 3. Configure the Python AI Service

Open another terminal:

```bash
cd ai-service
```

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create the environment file:

```powershell
Copy-Item .env.example .env
```

Configure the required AI credentials and service settings.

Start the AI service using the FastAPI development command configured for the application.

### 4. Configure the Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create the required frontend environment configuration if specified by the frontend template.

Start the frontend using:

```bash
npm run dev
```

Open the local URL displayed by Vite in your terminal.

**Important:** Configure the frontend, Node.js backend, Python AI service, and PostgreSQL database with matching connection settings before using the complete application.

---

## 🧪 Testing & Validation

The project has undergone backend and frontend validation.

| Component | Validation |
|---|---|
| Node.js Backend | 93 automated tests passed |
| Frontend | Lint checks passed |
| Frontend | Production build passed |
| AI Service | Feature integration testing performed |
| Exercise Analysis | Frontend integration verified |

Run backend tests:

```bash
cd backend
npm test
```

The frontend production build and lint commands are available in the frontend package scripts.

---

## 🔐 Security & Privacy

FitLife AI follows security-conscious development practices:

- JWT-based authentication.
- User-scoped access to personal progress records.
- Input validation and error handling.
- Environment variables for sensitive credentials.
- Actual `.env` files excluded from Git.
- Separation of user data and application services.

Never commit API keys, passwords, database credentials, or private authentication secrets to GitHub.

---

## 🌟 What Makes FitLife AI Different?

Many fitness applications focus on individual functions such as workout tracking, calorie counting, or exercise demonstrations.

FitLife AI brings multiple fitness intelligence capabilities into one integrated platform.

| Capability | FitLife AI |
|---|---|
| Personalized workout planning | AI Workout Planner |
| Food photograph analysis | AI Nutrition Analyzer |
| Interactive fitness assistance | AI Fitness Chatbot |
| Historical progress analysis | AI Progress Insights |
| Exercise movement analysis | Computer Vision |

The combination of these capabilities creates a more connected fitness experience, helping users understand their workouts, food choices, exercise techniques, and progress.

---

## 🔮 Future Scope

Potential future improvements include:

- More advanced personalized workout recommendations.
- Improved food recognition and nutrition estimation.
- Expanded exercise libraries and movement support.
- More accurate exercise repetition tracking.
- Personalized long-term fitness recommendations.
- Wearable device integrations.
- Mobile application support.
- Enhanced analytics and progress visualizations.

---

## ⚠️ Disclaimer

FitLife AI is a fitness and wellness assistance platform. Its AI-generated recommendations, nutritional estimates, and exercise analyses are informational and may contain errors.

It does not replace professional medical advice, diagnosis, treatment, or qualified fitness supervision. Users should consult appropriate professionals before making significant changes to their diet or exercise routine.

---

## 👨‍💻 Project Information

**Project Name:** FitLife AI

**Category:** Artificial Intelligence | HealthTech | Fitness Technology

**GitHub Repository:**  
https://github.com/digaridivyansh-create/Fitlife-AI

**Development Approach:** Modular, AI-powered, full-stack application.

---

### Built with ❤️ using AI, Computer Vision, and Full-Stack Technology.

**FitLife AI — Train Smarter. Eat Better. Track Progress. Live Healthier.**
