// Gestion de l'installation PWA et du service worker.
import { registerSW } from 'virtual:pwa-register';

let deferred: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
});

export function canInstall(): boolean {
  return !!deferred;
}

export async function installApp(): Promise<void> {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
}

export function setupSW(onUpdate: () => void): () => void {
  const update = registerSW({
    immediate: true,
    onNeedRefresh: onUpdate,
  });
  return () => void update(true);
}
