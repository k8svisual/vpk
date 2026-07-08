import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render/commit-phase errors thrown by its subtree and renders `fallback` instead of letting the
 *  error propagate up and unmount the entire app — React has no hook equivalent for this, only class
 *  components support getDerivedStateFromError/componentDidCatch. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  override render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}
