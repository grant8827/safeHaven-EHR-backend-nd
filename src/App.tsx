import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Components
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout/Layout';

// Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ChangePassword from './pages/Auth/ChangePassword';
import CompleteRegistration from './pages/Auth/CompleteRegistration';
import AdminDashboard from './pages/AdminDashboard';
import TherapistDashboard from './pages/Therapist/TherapistDashboard';
import ClientDashboard from './pages/Client/ClientDashboard';
import Documents from './pages/Client/Documents';
import Settings from './pages/Client/Settings';
import TherapistSettings from './pages/Therapist/TherapistSettings';
import AdminSettings from './pages/Admin/AdminSettings';
import PatientManagement from './pages/Patients/PatientManagement';
import AdminPatientManagement from './pages/Admin/AdminPatientManagement';
import AppointmentScheduling from './pages/Appointments/AppointmentScheduling';
import BillingManagement from './pages/BillingManagement';
import PatientBilling from './pages/PatientBilling';
import Messages from './pages/Messages/Messages';
import SOAPNotes from './pages/SOAPNotes/SOAPNotes';
import Telehealth from './pages/Telehealth/Telehealth';
import TelehealthDashboard from './pages/Telehealth/TelehealthDashboard';
import TelehealthTranscripts from './pages/Telehealth/TelehealthTranscripts';
import VideoSession from './pages/Telehealth/VideoSessionSimple';
import JoinSession from './pages/Telehealth/JoinSession';
import Reports from './pages/Reports/Reports';

// Components
import { DashboardRedirect } from './components/DashboardRedirect';
import { Unauthorized } from './components/Unauthorized';

// Styles
import { theme } from './utils/theme';

// Helper component to pass user to AdminDashboard
function AdminRoutes() {
  const { state } = useAuth();
  
  return (
    <Routes>
      <Route index element={<AdminDashboard user={state.user!} />} />
      <Route path="billing" element={<BillingManagement />} />
      <Route path="patients" element={<AdminPatientManagement />} />
      <Route path="appointments" element={<AppointmentScheduling />} />
      <Route path="soap-notes" element={<SOAPNotes />} />
      <Route path="messages" element={<Messages />} />
      <Route path="staff" element={<div>Staff Management</div>} />
      <Route path="reports" element={<Reports />} />
      <Route path="settings" element={<AdminSettings />} />
      <Route path="profile" element={<AdminSettings />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AuthProvider>
          <NotificationProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/admin/login" element={<Navigate to="/login" replace />} />
                <Route path="/register" element={<Register />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/complete-registration/:token" element={<CompleteRegistration />} />
                
                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  {/* Admin Routes */}
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <AdminRoutes />
                      </ProtectedRoute>
                    }
                  />

                  {/* Therapist/Staff Routes */}
                  <Route
                    path="/therapist/*"
                    element={
                      <ProtectedRoute requiredRole={["therapist", "staff"]}>
                        <Routes>
                          <Route index element={<TherapistDashboard />} />
                          <Route path="patients" element={<PatientManagement />} />
                          <Route path="appointments" element={<AppointmentScheduling />} />
                          <Route path="soap-notes" element={<SOAPNotes />} />
                          <Route path="messages" element={<Messages />} />
                          <Route path="telehealth" element={<Telehealth />} />
                          <Route path="billing" element={<BillingManagement />} />
                          <Route path="reports" element={<Reports />} />
                          <Route path="settings" element={<TherapistSettings />} />
                          <Route path="profile" element={<TherapistSettings />} />
                        </Routes>
                      </ProtectedRoute>
                    }
                  />

                  {/* Staff Routes (aliased to therapist routes) */}
                  <Route
                    path="/staff/*"
                    element={
                      <ProtectedRoute requiredRole={["therapist", "staff"]}>
                        <Routes>
                          <Route index element={<TherapistDashboard />} />
                          <Route path="patients" element={<PatientManagement />} />
                          <Route path="appointments" element={<AppointmentScheduling />} />
                          <Route path="soap-notes" element={<SOAPNotes />} />
                          <Route path="messages" element={<Messages />} />
                          <Route path="telehealth" element={<Telehealth />} />
                          <Route path="billing" element={<BillingManagement />} />
                          <Route path="reports" element={<Reports />} />
                          <Route path="settings" element={<TherapistSettings />} />
                          <Route path="profile" element={<TherapistSettings />} />
                        </Routes>
                      </ProtectedRoute>
                    }
                  />

                  {/* Client Routes */}
                  <Route
                    path="/client/*"
                    element={
                      <ProtectedRoute requiredRole={["patient", "client"]}>
                        <Routes>
                          <Route index element={<ClientDashboard />} />
                          <Route path="appointments" element={<AppointmentScheduling />} />
                          <Route path="messages" element={<Messages />} />
                          <Route path="telehealth" element={<Telehealth />} />
                          <Route path="documents" element={<Documents />} />
                          <Route path="billing" element={<PatientBilling />} />
                          <Route path="settings" element={<Settings />} />
                        </Routes>
                      </ProtectedRoute>
                    }
                  />

                  {/* Shared Routes */}
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/appointments" element={<AppointmentScheduling />} />
                  <Route path="/telehealth" element={<Telehealth />} />
                  <Route path="/telehealth/dashboard" element={<TelehealthDashboard />} />
                  <Route
                    path="/telehealth/transcripts"
                    element={
                      <ProtectedRoute requiredRole={["admin", "therapist"]}>
                        <TelehealthTranscripts />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/telehealth/session/:sessionId" element={<VideoSession />} />
                  <Route path="/telehealth/join/:roomId" element={<JoinSession />} />
                  
                  {/* Smart Dashboard Redirect */}
                  <Route index element={<DashboardRedirect />} />
                  <Route path="/dashboard" element={<DashboardRedirect />} />
                </Route>

                {/* Unauthorized Access */}
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* 404 - Redirect to login */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Router>
          </NotificationProvider>
        </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;