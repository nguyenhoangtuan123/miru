import { BrowserRouter as Router, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ConsentProvider } from './contexts/ConsentContext';
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
import { Consent } from './pages/Consent';
import { Chat } from './pages/Chat';
import { Memories } from './pages/Memories';
import { Settings } from './pages/Settings';
import { ProfilePage } from './pages/Profile';
import { TherapistsDirectory } from './pages/Therapists';
import { TherapistPublicProfilePage } from './pages/TherapistPublicProfile';
import { Therapy } from './pages/Therapy';

// Therapist Pages
import { TherapistDashboard } from './pages/therapist/Dashboard';
import { TherapistClients } from './pages/therapist/Clients';
import { TherapistClientDetail } from './pages/therapist/ClientDetail';
import { TherapistClientProfilesPage } from './pages/therapist/ClientProfiles';
import { TherapistClientProfileDetailPage } from './pages/therapist/ClientProfileDetail';
import { TherapistAppointments } from './pages/therapist/Appointments';
import { TherapistMessages } from './pages/therapist/Messages';
import { TherapistProfilePage } from './pages/therapist/Profile';
import { TherapistSettings } from './pages/therapist/Settings';

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <PwaProvider>
          <AuthProvider>
            <ConsentProvider>
              <NotificationRuntime />
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/therapists" element={<TherapistsDirectory />} />
                  <Route path="/therapists/:therapistId" element={<TherapistPublicProfilePage />} />
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />

                  <Route
                    element={
                      <ProtectedRoute>
                        <Outlet />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/consent" element={<Consent />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/memories" element={<Memories />} />
                    <Route path="/therapy" element={<Therapy />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/profile" element={<ProfilePage />} />
                  </Route>
                </Route>

                <Route
                  path="/therapist"
                  element={
                    <TherapistGuard>
                      <TherapistLayout />
                    </TherapistGuard>
                  }
                >
                  <Route index element={<TherapistDashboard />} />
                  <Route path="clients" element={<TherapistClients />} />
                  <Route path="clients/:id" element={<TherapistClientDetail />} />
                  <Route path="profile" element={<TherapistProfilePage />} />
                  <Route path="client-profiles" element={<TherapistClientProfilesPage />} />
                  <Route path="client-profiles/:clientId" element={<TherapistClientProfileDetailPage />} />
                  <Route path="appointments" element={<TherapistAppointments />} />
                  <Route path="messages" element={<TherapistMessages />} />
                  <Route path="settings" element={<TherapistSettings />} />
                </Route>
              </Routes>
            </ConsentProvider>
          </AuthProvider>
        </PwaProvider>
      </ThemeProvider>
    </Router>
  );
}
