const CLOUD_API_KEY = import.meta.env.VITE_CLOUD_API_KEY || import.meta.env.VITE_MAPS_API_KEY;

/**
 * Native SpeechRecognition Loader
 * Leverages native Web Speech API for instant client-side translation
 */
export function startVoiceRecognition(onResult, onEnd, lang = 'en') {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (onResult) onResult(text);
    };

    recognition.onerror = (err) => {
      console.warn("Native SpeechRecognition warning:", err);
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    recognition.start();
    return {
      stop: () => recognition.stop()
    };
  }
  return null;
}

/**
 * Sends a recorded audio blob to Google Cloud Speech-to-Text REST API
 * Supports English and Hindi speech as a serverless fallback
 */
export async function cloudSpeechToText(audioBlob, lang = 'en') {
  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${CLOUD_API_KEY}`;
  
  // Convert blob to base64
  const reader = new FileReader();
  const base64Promise = new Promise((resolve) => {
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      resolve(base64data);
    };
    reader.readAsDataURL(audioBlob);
  });

  const base64Audio = await base64Promise;
  const languageCode = lang === 'hi' ? 'hi-IN' : 'en-IN';

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: languageCode,
          alternativeLanguageCodes: ["en-IN", "hi-IN"],
          enableAutomaticPunctuation: true
        },
        audio: {
          content: base64Audio
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.results?.[0]?.alternatives?.[0]?.transcript || "";
    }
  } catch (error) {
    console.error("GCP Speech-to-Text API Error:", error);
  }
  return "";
}

/**
 * Synthesizes text to natural speech using Google Cloud Text-to-Speech REST API.
 * Falls back automatically to local browser speechSynthesis synthesis to guarantee playback.
 */
export async function cloudTextToSpeech(text, lang = 'en') {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${CLOUD_API_KEY}`;
  const languageCode = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const voiceName = lang === 'hi' ? 'hi-IN-Neural2-Y' : 'en-IN-Neural2-F';

  // 1. Try Google Cloud Text-to-Speech API
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: text },
        voice: { languageCode: languageCode, name: voiceName },
        audioConfig: { audioEncoding: "MP3" }
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.audioContent) {
        const audioBytes = data.audioContent;
        const audioUrl = `data:audio/mp3;base64,${audioBytes}`;
        const audio = new Audio(audioUrl);
        audio.play();
        return true;
      }
    }
  } catch (error) {
    console.warn("GCP Text-to-Speech failed, using local browser Speech Synthesis fallback.", error);
  }

  // 2. Browser native text-to-speech fallback (guarantees voice output)
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel(); // Stop any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageCode;
      
      // Attempt to load regional voices
      const voices = window.speechSynthesis.getVoices();
      const matchVoice = voices.find(v => v.lang.includes(lang === 'hi' ? 'HI' : 'IN') || v.lang.includes(languageCode));
      if (matchVoice) {
        utterance.voice = matchVoice;
      }
      
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (e) {
      console.error("Local Web Speech Synthesis failed:", e);
    }
  }

  return false;
}
