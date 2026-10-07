import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStore } from './store/store';
import './styles/app.css';
import './styles/additions.css';
import './styles/theme.css';
import '@/ext/ext.css'; // ext: the fork's styles, imported once

// Exposed only while developing, so views can be exercised against sample data
// without a real account. Vite strips this branch from production builds.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__store = useStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
