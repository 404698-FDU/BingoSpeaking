
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration: number; // seconds
  autoStart?: boolean;
}

export interface AudioRecorderHandle {
  startRecording: () => void;
  stopRecording: () => void;
}

const AudioRecorder = forwardRef<AudioRecorderHandle, AudioRecorderProps>(({ 
  onRecordingComplete, 
  maxDuration,
  autoStart = false
}, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const [volume, setVolume] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useImperativeHandle(ref, () => ({
    startRecording: start,
    stopRecording: stop
  }));

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup Audio Context for Visualization
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      visualize();

      // Setup Media Recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(audioBlob);
        cleanup();
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start Timer
      setTimeLeft(maxDuration);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stop();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required.");
    }
  };

  const stop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
       audioContextRef.current.close();
    }
    setVolume(0);
  };

  const visualize = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Simple average volume
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setVolume(average); // 0-255

    animationFrameRef.current = requestAnimationFrame(visualize);
  };

  useEffect(() => {
    if (autoStart) start();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPercentage = ((maxDuration - timeLeft) / maxDuration) * 100;

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center space-y-4">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {isRecording && (
           <div 
             className="absolute inset-0 rounded-full bg-red-100 animate-pulse-ring" 
             style={{ transform: `scale(${1 + volume / 100})` }}
           />
        )}
        <div className={`z-10 w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300 ${isRecording ? 'bg-red-500' : 'bg-slate-300'}`}>
          {isRecording ? (
             <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <rect x="6" y="6" width="12" height="12" rx="1" />
             </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </div>
      </div>
      
      <div className="w-full space-y-1">
        <div className="flex justify-between text-sm font-medium text-slate-600">
           <span>{isRecording ? 'Recording...' : 'Waiting'}</span>
           <span className={`${timeLeft < 5 ? 'text-red-500' : ''}`}>{timeLeft}s</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-linear" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {!autoStart && !isRecording && (
        <button 
          onClick={start}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Start Recording
        </button>
      )}
      
      {isRecording && (
        <button 
          onClick={stop}
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
        >
          Stop Early
        </button>
      )}
    </div>
  );
});

export default AudioRecorder;
