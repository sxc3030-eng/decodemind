import { SpikePage } from '@/spike/SpikePage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AdCarousel } from '@/components/AdCarousel';

export default function App() {
  return (
    <ErrorBoundary>
      <AdCarousel />
      <SpikePage />
    </ErrorBoundary>
  );
}
