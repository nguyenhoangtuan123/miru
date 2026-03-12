import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PwaProvider } from './contexts/PwaContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationRuntime } from './components/NotificationRuntime';
import { ProtectedRoute } from './components/ProtectedRoute';
import { TherapistGuard } from './components/TherapistGuard';
import { Layout } from './components/Layout';
import { TherapistLayout } from './components/TherapistLayout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Chat } from './pages/Chat';
import { Memories } from './pages/Memories';
import { Settings } from './pages/Settings';
import { Therapy } from './pages/Therapy';

// Therapist Pages
import { TherapistDashboard } from './pages/therapist/Dashboard';
import { TherapistClients } from './pages/therapist/Clients';
import { TherapistClientDetail } from './pages/therapist/ClientDetail';
import { TherapistAppointments } from './pages/therapist/Appointments';
import { TherapistMessages } from './pages/therapist/Messages';
import { TherapistSettings } from './pages/therapist/Settings';

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <PwaProvider>
          <AuthProvider>
            <NotificationRuntime />
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Layout><Home /></Layout>} />
            <Route path="/auth/login" element={<Layout><Login /></Layout>} />
            <Route path="/auth/callback" element={<Layout><AuthCallback /></Layout>} />
            
            {/* Client Routes */}
            <Route path="/chat" element={
              <ProtectedRoute>
                <Layout><Chat /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/memories" element={
              <ProtectedRoute>
                <Layout><Memories /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/therapy" element={
              <ProtectedRoute>
                <Layout><Therapy /></Layout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            } />

            {/* Therapist Routes */}
            <Route path="/therapist" element={
              <TherapistGuard>
                <TherapistLayout />
              </TherapistGuard>
            }>
              <Route index element={<TherapistDashboard />} />
              <Route path="clients" element={<TherapistClients />} />
              <Route path="clients/:id" element={<TherapistClientDetail />} />
              <Route path="appointments" element={<TherapistAppointments />} />
              <Route path="messages" element={<TherapistMessages />} />
              <Route path="settings" element={<TherapistSettings />} />
            </Route>
            </Routes>
          </AuthProvider>
        </PwaProvider>
      </ThemeProvider>
    </Router>
  );
}
