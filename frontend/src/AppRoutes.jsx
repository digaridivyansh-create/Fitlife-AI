import { Navigate, Route, Routes } from 'react-router-dom'
import App from './App.jsx'
import { Login, Register } from './pages/AuthPages.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Nutrition from './pages/Nutrition.jsx'
import Chatbot from './pages/Chatbot.jsx'
import Progress from './pages/Progress.jsx'
import FormAnalysis from './pages/FormAnalysis.jsx'
import GuestRoute from './components/GuestRoute.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />

      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/chatbot" element={<Chatbot />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/form-analysis" element={<FormAnalysis />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}


