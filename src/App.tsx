import { SpikePage } from '@/spike/SpikePage';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <SpikePage />
    </ErrorBoundary>
  );
}
