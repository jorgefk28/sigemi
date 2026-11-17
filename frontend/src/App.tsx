import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './session/auth';
import { RequireAuth } from './routes/RequireAuth';
import { useGoHome } from './routes/useGoHome';
import { Shell } from './features/shell/Shell';
import { LoginPage } from './features/auth/LoginPage';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SessionUnavailable } from './components/SessionUnavailable';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { PlaceholderPage } from './features/placeholder/PlaceholderPage';
import { ChangePasswordPage } from './features/profile/ChangePasswordPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { PacienteDetallePage } from './features/recepcion/PacienteDetallePage';
import { PacienteFormPage } from './features/recepcion/PacienteFormPage';
import { PacientesListPage } from './features/recepcion/PacientesListPage';
import { CatalogosPage } from './features/catalogos/CatalogosPage';
import { ListaEsperaPage } from './features/recepcion/ListaEsperaPage';
import { IndicacionesListPage } from './features/recepcion/IndicacionesListPage';
import { IndicacionFormPage } from './features/recepcion/IndicacionFormPage';
import { AuditoriaPage } from './features/seguridad/AuditoriaPage';
import { UsuariosPage } from './features/seguridad/UsuariosPage';
import { homePath } from './features/navigation/navigation';

/**
 * `/login` (SEG-U01) is the only anonymous entry point. A signed-in user that
 * reaches it is sent to its landing page instead of seeing the form again, and a
 * stored token the server could not verify shows the retry panel rather than
 * credentials the user does not need.
 */
function LoginRoute() {
  const { status, user, reload } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'unavailable') {
    return <SessionUnavailable onRetry={reload} />;
  }

  if (status === 'authenticated' && user) {
    return <Navigate to={homePath(user.roles)} replace />;
  }

  return <LoginPage />;
}

/** Landing of the authenticated area for the current roles. */
function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homePath(user.roles) : '/login'} replace />;
}

/** SEG-U02 + SEG-U03: no permission is a redirect, never a raw 403 (R2). */
function UsuariosRoute() {
  const goHome = useGoHome();
  return <UsuariosPage onForbidden={goHome} />;
}

/** SEG-U04 + SEG-U05: same rule as the user listing. */
function AuditoriaRoute() {
  const goHome = useGoHome();
  return <AuditoriaPage onForbidden={goHome} />;
}

/**
 * Router tree.
 *
 * Every screen owns its URL: a reload, a deep link and the browser back button
 * land on the same place. `Shell` is the layout route; it resolves the active
 * page from the URL and redirects a path the roles cannot see. A path that
 * matches no screen falls to the splat route and goes home.
 *
 * The screens of subsystems without a specification are not implemented: their
 * route renders the explicit placeholder, never invented content.
 */
export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />

          <Route
            element={
              <RequireAuth>
                <Shell />
              </RequireAuth>
            }
          >
            <Route path="/panel-control" element={<DashboardPage />} />
            <Route path="/agenda" element={<PlaceholderPage title="Agenda y Turnos" />} />
            <Route path="/analisis" element={<PlaceholderPage title="Análisis" />} />
            <Route path="/resultados" element={<PlaceholderPage title="Resultados" />} />
            <Route path="/insumos" element={<PlaceholderPage title="Insumos y Stock" />} />
            <Route path="/residuos" element={<PlaceholderPage title="Control de Residuos" />} />
            <Route path="/reportes" element={<PlaceholderPage title="Reportes y Estadísticas" />} />

            {/* REC-U06, REC-U05, REC-U07, REC-U11 */}
            <Route path="/pacientes" element={<PacientesListPage />} />
            <Route path="/pacientes/nuevo" element={<PacienteFormPage />} />
            <Route path="/pacientes/:pacienteId" element={<PacienteDetallePage />} />
            <Route path="/pacientes/:pacienteId/editar" element={<PacienteFormPage />} />
            <Route path="/lista-espera" element={<ListaEsperaPage />} />

            {/* REC-U08, REC-U09 */}
            <Route path="/indicaciones" element={<IndicacionesListPage />} />
            <Route path="/indicaciones/nueva" element={<IndicacionFormPage />} />
            <Route path="/indicaciones/:indicacionId/editar" element={<IndicacionFormPage />} />

            {/* SEG-U02..U05 */}
            <Route path="/usuarios" element={<UsuariosRoute />} />
            <Route path="/auditoria" element={<AuditoriaRoute />} />

            {/* DIAG-U06 */}
            <Route path="/catalogos" element={<CatalogosPage />} />

            {/* SEG-U08, SEG-U09 */}
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/perfil/contrasena" element={<ChangePasswordPage />} />

            <Route path="*" element={<HomeRedirect />} />
          </Route>
        </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
