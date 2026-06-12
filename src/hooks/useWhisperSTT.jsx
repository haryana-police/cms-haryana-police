import { useState, useRef } from 'react';
import { message } from 'antd';

export function useWhisperSTT({ 
  onStart, 
  onInterim, 
  onTranscribing, 
  onSuccess, 
  onFailure, 
  defaultLanguage = 'hi' 
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const activeContextRef = useRef(null);
  const speechTranscriptRef = useRef('');
  const latestTranscriptRef = useRef('');

  const startRecording = async (context = null) => {
    audioChunksRef.current = [];
    activeContextRef.current = context;
    speechTranscriptRef.current = '';
    latestTranscriptRef.current = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine standard container & mimeType supported by browser
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsTranscribing(true);
        const currentContext = activeContextRef.current;
        if (onTranscribing) {
          onTranscribing(currentContext);
        }

        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        // Check if we have a high-quality local transcript from webkitSpeechRecognition
        if (latestTranscriptRef.current && latestTranscriptRef.current.trim()) {
          setTimeout(() => {
            onSuccess(latestTranscriptRef.current.trim(), currentContext);
            setIsTranscribing(false);
          }, 200);
          return;
        }

        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        await transcribeAudio(audioBlob, extension, currentContext);
      };

      mediaRecorder.start();
      setIsRecording(true);
      if (onStart) {
        onStart(context);
      }

      // Start browser SpeechRecognition in parallel for real-time preview
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = defaultLanguage === 'hi' ? 'hi-IN' : 'en-US';

        rec.onresult = (event) => {
          let finalTranscript = '';
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          if (finalTranscript) {
            speechTranscriptRef.current += (speechTranscriptRef.current ? ' ' : '') + finalTranscript;
          }
          
          const totalText = (speechTranscriptRef.current + (interimTranscript ? ' ' + interimTranscript : '')).trim();
          latestTranscriptRef.current = totalText;

          if (onInterim && totalText) {
            onInterim(totalText, activeContextRef.current);
          }
        };

        rec.onerror = (e) => {
          console.warn('Browser SpeechRecognition error:', e);
        };

        rec.onend = () => {
          console.log('Browser SpeechRecognition ended');
        };

        recognitionRef.current = rec;
        rec.start();
      }

      message.info("Listening... Click to stop when you're done speaking.");
    } catch (err) {
      console.error('Microphone access or recorder creation failed:', err);
      message.error('Microphone access denied or not supported.');
      if (onFailure) {
        onFailure(context);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Failed to stop speech recognition:', err);
      }
      recognitionRef.current = null;
    }
  };

  const stopAndRestart = async (newContext) => {
    // 1. Stop current MediaRecorder (this will trigger its onstop and transcribe)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Failed to stop speech recognition:', err);
      }
      recognitionRef.current = null;
    }

    // 2. Start a new recording session with the new context after a tiny delay
    setTimeout(() => {
      startRecording(newContext);
    }, 150);
  };

  const toggleRecording = (context = null) => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(context);
    }
  };

  const transcribeAudio = async (audioBlob, extension, context) => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      message.error('Groq API key is not set in environment variables.');
      setIsTranscribing(false);
      if (onFailure) {
        onFailure(context);
      }
      return;
    }

    const hideLoading = message.loading('Transcribing audio with Groq Whisper...', 0);

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, `recording.${extension}`);
      formData.append('model', 'whisper-large-v3');
      formData.append(
        'prompt',
        'हरियाणा पुलिस केस मैनेजमेंट सिस्टम। शिकायत, एफआईआर, जांच, गवाह, साक्ष्य डायरी, चालान।'
      );
      if (defaultLanguage) {
        formData.append('language', defaultLanguage);
      }

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!res.ok) {
        let errMsg = 'Failed to transcribe';
        try {
          const errData = await res.json();
          errMsg = errData.error?.message || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.text && data.text.trim()) {
        onSuccess(data.text.trim(), context);
        message.success('Speech transcribed successfully!');
      } else {
        message.warning('No speech detected. Please try again.');
        if (onFailure) {
          onFailure(context);
        }
      }
    } catch (err) {
      console.error('Groq Whisper Transcription error:', err);
      message.error(`Transcription error: ${err.message}`);
      if (onFailure) {
        onFailure(context);
      }
    } finally {
      setIsTranscribing(false);
      hideLoading();
    }
  };

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    stopAndRestart,
    toggleRecording,
  };
}

