export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper for Google TTS raw PCM decoding
export const decodeAudioData = async (
  base64String: string,
  audioContext: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> => {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Convert raw PCM 16-bit LE to Float32
  const dataInt16 = new Int16Array(bytes.buffer);
  const float32Data = new Float32Array(dataInt16.length);
  for (let i = 0; i < dataInt16.length; i++) {
    float32Data[i] = dataInt16[i] / 32768.0;
  }

  const buffer = audioContext.createBuffer(1, float32Data.length, sampleRate);
  buffer.getChannelData(0).set(float32Data);
  return buffer;
};

export const playAudioBuffer = (audioContext: AudioContext, buffer: AudioBuffer): void => {
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
};