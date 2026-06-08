import { useEffect, useState } from "react";

const DISMISS_KEY = "fs_install_prompt_dismissed";

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (!isMobileDevice()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios =
      /iphone|ipad|ipod/.test(ua) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIos(ios);

    if (ios && !(window.navigator as Navigator & { standalone?: boolean }).standalone) {
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        {isIos ? (
          <p>
            Install Fallen Sparrow: tap Share, then &quot;Add to Home Screen&quot;
          </p>
        ) : (
          <>
            <p>Install Fallen Sparrow for quick access</p>
            <button type="button" className="btn-amber" onClick={() => void handleInstall()}>
              Install
            </button>
          </>
        )}
        <button type="button" className="install-dismiss" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
