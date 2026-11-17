import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './session/auth';
import { RequireAuth } from './routes/RequireAuth';
import { Shell } from './features/shell/Shell';
import { LoginPage } from './features/auth/LoginPage';
import { LoadingScreen } from './components/LoadingScreen';
import { homePath } from './features/navigation/navigation';

/**
 * `/login` (SEG-U01) is the only anonymous entry point. A signed-in user that
 * reaches it is sent to its landing page instead of seeing the form again.
 */
function LoginRoute() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'authenticated' && user) {
    return <Navigate to={homePath(user.roles)} replace />;
  }

  return <LoginPage />;
}

/**
 * Router tree. The authenticated area is a single splat route: `Shell` owns the
 * module map and redirects an unknown or forbidden path to the landing page, so
 * adding a page never means editing two lists.
 */
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <Shell />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
