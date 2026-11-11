import { AuthProvider } from './session/auth';
import { RequireAuth } from './routes/RequireAuth';
import { Shell } from './features/shell/Shell';

export function App() {
  return (
    <AuthProvider>
      <RequireAuth>
        <Shell />
      </RequireAuth>
    </AuthProvider>
  );
}
