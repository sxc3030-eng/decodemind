import { SpikePage } from '@/spike/SpikePage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AdCarousel } from '@/components/AdCarousel';
import { PrivacyFooter } from '@/components/PrivacyFooter';

export default function App() {
  return (
    <ErrorBoundary>
      <AdCarousel />
      <SpikePage />
      <PrivacyFooter />
    </ErrorBoundary>
  );
}
