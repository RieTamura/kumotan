/**
 * useSpeech Hook
 * Provides text-to-speech functionality using expo-speech
 */

import { useState, useCallback, useEffect } from 'react';
import * as Speech from 'expo-speech';

export interface SpeechOptions {
  language?: string;
  rate?: number;
}

export interface UseSpeechReturn {
  speak: (text: string, options?: SpeechOptions) => void;
  stop: () => void;
  isSpeaking: boolean;
}

/**
 * Custom hook for text-to-speech
 *
 * - Uses device-native TTS engine (no external API required)
 * - Automatically stops on component unmount
 * - Tracks speaking state via Speech callbacks
 */
export function useSpeech(): UseSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback((text: string, options?: SpeechOptions) => {
    Speech.stop();
    Speech.speak(text, {
      language: options?.language ?? 'en-US',
      rate: options?.rate ?? 0.9,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, []);

  const stop = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  return { speak, stop, isSpeaking };
}

export default useSpeech;
