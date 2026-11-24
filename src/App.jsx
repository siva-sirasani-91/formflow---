import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { WorkspaceProvider } from './context/WorkspaceContext.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import AppLayout from './components/workspace/AppLayout.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import DashboardView from './pages/dashboard/DashboardView.jsx';
import BusinessView from './pages/dashboard/BusinessView.jsx';
import CustomersView from './pages/dashboard/CustomersView.jsx';
import RecordsView from './pages/dashboard/RecordsView.jsx';
import ReportsView from './pages/dashboard/ReportsView.jsx';
import ProfileView from './pages/dashboard/ProfileView.jsx';
import SettingsView from './pages/dashboard/SettingsView.jsx';
import HelpView from './pages/dashboard/HelpView.jsx';

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardView /> },
      { path: 'businesses', element: <BusinessView /> },
      { path: 'customers', element: <CustomersView /> },
      { path: 'records', element: <RecordsView /> },
      { path: 'reports', element: <ReportsView /> },
      { path: 'profile', element: <ProfileView /> },
      { path: 'settings', element: <SettingsView /> },
      { path: 'help', element: <HelpView /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <RouterProvider router={router} />
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
