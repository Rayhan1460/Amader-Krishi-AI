import { lazy, Suspense } from 'react';
import { AdminMarketPage, BuyerMarketPage } from './components/market/ProduceMarket.tsx';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { LanguageProvider } from './context/LanguageContext.tsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { WorkspacePage } from './pages/WorkspacePage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';

const ProjectDocsPage = lazy(() => import('./pages/ProjectDocsPage.tsx'));
const JudgePreviewPage = lazy(() => import('./pages/JudgePreviewPage.tsx'));
const ProjectDocsAdminPage = lazy(() => import('./pages/ProjectDocsAdminPage.tsx'));

export function App() {
  return (
    <LanguageProvider>
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

            <Route path="/docs" element={<Suspense fallback={<p role="status">Loading documentation…</p>}><ProjectDocsPage /></Suspense>} />
            <Route path="/judge-preview" element={<Suspense fallback={<p role="status">Loading judge preview…</p>}><JudgePreviewPage /></Suspense>} />
            <Route path="/docs/admin" element={<Suspense fallback={<p role="status">Loading documentation settings…</p>}><ProjectDocsAdminPage /></Suspense>} />

            {/* 404 Catch-All */}
            <Route path="/buyer" element={<BuyerMarketPage />} />
            <Route path="/admin" element={<AdminMarketPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
