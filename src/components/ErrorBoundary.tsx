import { Component, type ReactNode, type ErrorInfo } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('DecodeMind React error:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-3xl mx-auto p-6 m-6 bg-brand-card rounded-lg border border-brand-danger">
          <h1 className="text-xl font-bold text-brand-danger mb-2">Something went wrong</h1>
          <p className="text-sm text-brand-muted mb-2">
            DecodeMind hit an unexpected error. The details below should help diagnose; please copy
            them into a GitHub issue.
          </p>
          <pre className="text-xs font-mono bg-brand-surface p-3 rounded overflow-x-auto mb-4">
            {this.state.error.name}: {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="bg-brand-primary hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-brand-card border border-brand-muted hover:border-brand-accent text-white text-sm px-3 py-1.5 rounded"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
