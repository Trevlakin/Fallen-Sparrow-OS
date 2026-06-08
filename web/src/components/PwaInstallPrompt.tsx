import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("pwa_prompt_dismissed");
    if (dismissed) return;

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
    sessionStorage.setItem("pwa_prompt_dismissed", "1");
    setShow(false);
  }

  if (!show) return null;

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
