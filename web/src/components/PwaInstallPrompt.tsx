import { useEffect, useRef, useState } from "react";

const DISMISS_KEY = "pwa_prompt_dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isDismissed(): boolean {
  try {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (!stored) return false;
    return Date.now() - parseInt(stored, 10) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  } catch {
    // localStorage unavailable
  }
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isInStandaloneMode() || isDismissed()) return;

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  async function handleInstall() {
    if (!promptRef.current) return;
    await promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    promptRef.current = null;
  }

  function handleDismiss() {
    dismiss();
    setShow(false);
  }

  if (isInStandaloneMode() || isDismissed() || !show) return null;

  return (
    <div className="pwa-install-banner" role="alert">
      <span className="pwa-install-text">Add Fallen Sparrow to your home screen for quick access.</span>
      <div className="pwa-install-actions">
        <button type="button" className="btn-amber" onClick={() => void handleInstall()}>
          Install
        </button>
        <button type="button" className="btn-ghost" onClick={handleDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
