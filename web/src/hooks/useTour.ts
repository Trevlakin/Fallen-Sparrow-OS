import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  startMainTour,
  TOUR_COMPLETED_KEY,
  TOUR_FORCE_START_KEY,
} from "@/tours/mainTour";

const DESKTOP_MIN_WIDTH = 768;
const AUTO_START_DELAY_MS = 1200;
const REPLAY_START_DELAY_MS = 400;

function isDesktopViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth >= DESKTOP_MIN_WIDTH;
}

export function useTour(enabled = true) {
  const navigate = useNavigate();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!enabled || !isDesktopViewport()) {
      setShouldShow(false);
      return;
    }

    const forceStart = sessionStorage.getItem(TOUR_FORCE_START_KEY) === "1";
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY) === "true";

    if (!forceStart && completed) {
      setShouldShow(false);
      return;
    }

    const delay = forceStart ? REPLAY_START_DELAY_MS : AUTO_START_DELAY_MS;
    const timer = window.setTimeout(() => {
      if (isDesktopViewport()) {
        setShouldShow(true);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [enabled]);

  const startTour = useCallback(() => {
    if (!isDesktopViewport()) return;
    startMainTour();
    setShouldShow(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    sessionStorage.setItem(TOUR_FORCE_START_KEY, "1");
    navigate("/");
  }, [navigate]);

  const replayTour = useCallback(() => {
    resetTour();
  }, [resetTour]);

  return { shouldShow, startTour, resetTour, replayTour };
}
