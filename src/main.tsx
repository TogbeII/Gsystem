import React, { ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application Runtime Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '40px auto', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#e11d48', margin: '0 0 12px' }}>System Notice</h2>
          <p style={{ color: '#475569', fontSize: 14, marginBottom: 12 }}>An error occurred while loading the view:</p>
          <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto', border: '1px solid #cbd5e1', color: '#334155' }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

