import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { boot } from './store';
import { App } from './ui/App';
import { setupSW } from './pwa';

boot();

function Root() {
  const [ready, setReady] = useState(false);
  const [apply, setApply] = useState<() => void>(() => () => {});
  useEffect(() => {
    if (import.meta.env.PROD) {
      const up = setupSW(() => setReady(true));
      setApply(() => up);
    }
  }, []);
  return <App updateReady={ready} applyUpdate={apply} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
