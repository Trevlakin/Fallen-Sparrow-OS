import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const SILENCE_MS = 2000;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access blocked. Allow the mic in browser settings and try again.";
    case "no-speech":
      return "No speech detected. Tap the mic and speak again.";
    case "audio-capture":
      return "No microphone found. Check your device settings.";
    case "network":
      return "Speech recognition needs a network connection in this browser.";
    case "aborted":
      return "";
    default:
      return "Voice input failed. Try again or type your message.";
  }
}

async function primeMicrophone(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return true;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export function useSpeechRecognition(
  onTranscript: (text: string) => void,
  onError?: (message: string) => void,
) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const listeningRef = useRef(false);
  const silenceTimerRef = useRef<number | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onError]);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const teardownRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onstart = null;
    try {
      recognition.abort();
    } catch {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    }
    recognitionRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    listeningRef.current = false;
    setListening(false);
    teardownRecognition();
  }, [clearSilenceTimer, teardownRecognition]);

  const scheduleSilenceStop = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      stopListening();
    }, SILENCE_MS);
  }, [clearSilenceTimer, stopListening]);

  const startListening = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.("Voice input is not supported in this browser. Use Chrome or Safari.");
      return;
    }

    if (listeningRef.current) {
      stopListening();
      return;
    }

    const micOk = await primeMicrophone();
    if (!micOk) {
      onErrorRef.current?.(
        "Microphone access denied. Allow the mic for this site in browser settings.",
      );
      return;
    }

    teardownRecognition();

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      listeningRef.current = true;
      setListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      onTranscriptRef.current(transcript);
      scheduleSilenceStop();
    };

    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
      clearSilenceTimer();
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };

    recognition.onerror = (event) => {
      const message = speechErrorMessage(event.error);
      if (message) {
        onErrorRef.current?.(message);
      }
      stopListening();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      stopListening();
      onErrorRef.current?.("Could not start voice input. Wait a moment and try again.");
    }
  }, [clearSilenceTimer, scheduleSilenceStop, stopListening, teardownRecognition]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      teardownRecognition();
      listeningRef.current = false;
    };
  }, [clearSilenceTimer, teardownRecognition]);

  return { supported, listening, startListening, stopListening };
}
