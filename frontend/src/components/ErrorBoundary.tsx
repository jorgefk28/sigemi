import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Last line of defence for the authenticated area: a render crash shows an
 * actionable message instead of a blank page. It does not swallow the error —
 * it logs it, because a white screen with no console entry is undebuggable in a
 * laboratory with no developer on site.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error de render no controlado', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="mx-auto mt-10 max-w-md rounded-md border border-gray-200 bg-white p-4">
          <h1 className="text-base font-semibold text-gray-900">Se produjo un error inesperado</h1>
          <p className="mt-1 text-sm text-gray-700">
            La pantalla no se pudo mostrar. Volvé a cargar el sistema; si el problema persiste,
            avisá al administrador.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
