export async function speakResponse(text: string): Promise<void> {
  const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

  if (elevenLabsKey && voiceId) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        },
      );
      if (!response.ok) {
        throw new Error("ElevenLabs request failed");
      }
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
      audio.addEventListener("ended", () => URL.revokeObjectURL(audioUrl));
      return;
    } catch {
      // Fall through to browser TTS
    }
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  window.speechSynthesis.cancel();
}
