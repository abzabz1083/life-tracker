import { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';

import './pwa-support.css';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const installDismissedKey = 'life-tracker-pwa-install-dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isAppleMobile(): boolean {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function wasInstallPromptDismissed(): boolean {
  try {
    return window.localStorage.getItem(installDismissedKey) === 'yes';
  } catch {
    return false;
  }
}

export function PwaSupport() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [appleMobile, setAppleMobile] = useState(false);
  const [dismissed, setDismissed] = useState(wasInstallPromptDismissed);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const updateDisplayMode = () => setInstalled(isStandalone());
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!wasInstallPromptDismissed()) setInstallPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setDismissed(true);
    };

    setAppleMobile(isAppleMobile());
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    const displayMode = window.matchMedia('(display-mode: standalone)');
    displayMode.addEventListener('change', updateDisplayMode);

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      displayMode.removeEventListener('change', updateDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    const register = () => {
      void navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: 'none',
        })
        .catch((error: unknown) => {
          console.warn('Life Tracker offline shell could not be registered.', error);
        });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  const dismissInstall = () => {
    setDismissed(true);
    setInstallPrompt(null);
    try {
      window.localStorage.setItem(installDismissedKey, 'yes');
    } catch {
      // The prompt can still be dismissed when storage is unavailable.
    }
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      setDismissed(true);
      try {
        window.localStorage.setItem(installDismissedKey, 'yes');
      } catch {
        // Installation succeeded; no persistent dismissal is required.
      }
    } else {
      dismissInstall();
    }
  };

  const showInstallCard = !installed && !dismissed && (Boolean(installPrompt) || appleMobile);

  return (
    <>
      {!online && (
        <div className="pwa-offline-banner" role="status" aria-live="polite">
          <WifiOff size={16} aria-hidden="true" />
          <span>
            <strong>You’re offline.</strong> Reconnect to check your passcode and use online
            features.
          </span>
        </div>
      )}

      {showInstallCard && (
        <aside className="pwa-install-card" aria-label="Install Life Tracker">
          <img
            className="pwa-install-icon"
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            width="40"
            height="40"
          />
          <div className="pwa-install-copy">
            <strong>Keep Life Tracker close</strong>
            {installPrompt ? (
              <p>Install it for a focused, app-like shortcut.</p>
            ) : (
              <p>On iPhone or iPad, tap Share, then “Add to Home Screen”.</p>
            )}
          </div>
          {installPrompt && (
            <button className="pwa-install-button" type="button" onClick={() => void install()}>
              <Download size={15} aria-hidden="true" />
              Install
            </button>
          )}
          <button
            className="pwa-dismiss-button"
            type="button"
            aria-label="Dismiss install tip"
            onClick={dismissInstall}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </aside>
      )}
    </>
  );
}
