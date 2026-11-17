import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../session/auth';
import { homePath } from '../features/navigation/navigation';

/**
 * Callback for "no permission is a redirect, never a raw 403 on screen" (R2).
 * A screen that receives a `403` from the backend calls it instead of rendering
 * the rejection.
 */
export function useGoHome(): () => void {
  const { user } = useAuth();
  const navigate = useNavigate();

  return useCallback(() => {
    if (user) {
      navigate(homePath(user.roles), { replace: true });
    }
  }, [navigate, user]);
}
