import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { WorkspacePage } from './pages/WorkspacePage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

export function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Public Authentication Pages */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Workspace Route */}
          <Route element={<ProtectedRoute />}>
            <Route path="/workspace" element={<WorkspacePage />} />
          </Route>

          {/* Redirect /app to /workspace */}
          <Route path="/app" element={<Navigate to="/workspace" replace />} />

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
