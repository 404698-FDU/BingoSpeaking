import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TestPaper, EvaluationResult, TestSectionType } from "../types";
import { blobToBase64, decodeAudioData } from "./audioUtils";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// --- 1. Generate Test Paper ---
export const generateTestPaper = async (): Promise<TestPaper> => {
  const model = "gemini-2.5-flash";
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      readingSection: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "A paragraph of about 100-120 words." },
          prepTime: { type: Type.NUMBER },
          recordTime: { type: Type.NUMBER },
        },
        required: ["text", "prepTime", "recordTime"]
      },
      repeatSection: {
        type: Type.OBJECT,
        properties: {
          sentences: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "5 sentences of increasing difficulty." 
          },
          recordTime: { type: Type.NUMBER },
        },
        required: ["sentences", "recordTime"]
      },
      qaSection: {
        type: Type.OBJECT,
        properties: {
          dialogue: { type: Type.STRING, description: "A dialogue between two people." },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answerHint: { type: Type.STRING }
              }
            },
            description: "3 questions based on the dialogue."
          },
          recordTime: { type: Type.NUMBER },
        },
        required: ["dialogue", "questions", "recordTime"]
      },
      speechSection: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          prompt: { type: Type.STRING, description: "Description or prompt for the speech." },
          prepTime: { type: Type.NUMBER },
          recordTime: { type: Type.NUMBER },
        },
        required: ["topic", "prompt", "prepTime", "recordTime"]
      }
    },
    required: ["readingSection", "repeatSection", "qaSection", "speechSection"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: "Generate a Shanghai College Entrance Examination English Listening and Speaking Test simulation paper.",
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      systemInstruction: "You are an expert English test creator for the Shanghai GaoKao. Create realistic, challenging, but appropriate content for high school students.",
    }
  });

  return JSON.parse(response.text || '{}') as TestPaper;
};

// --- 2. Text to Speech ---
export const playTextAsSpeech = async (text: string, voice: 'Kore' | 'Puck' | 'Fenrir' = 'Kore'): Promise<void> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 24000 });
      const buffer = await decodeAudioData(base64Audio, audioContext, 24000);
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
      
      // Return a promise that resolves when audio finishes
      return new Promise((resolve) => {
        source.onended = () => {
            audioContext.close();
            resolve();
        };
      });
    }
  } catch (error) {
    console.error("Error generating speech:", error);
  }
};

// --- 3. Evaluate Audio ---
export const evaluateAudio = async (
  audioBlob: Blob, 
  referenceText: string, 
  type: TestSectionType,
  context?: string
): Promise<EvaluationResult> => {
  const base64Audio = await blobToBase64(audioBlob);
  const model = "gemini-2.5-flash"; // Capable of multimodal understanding

  const prompt = `
    Task: Evaluate the student's oral English performance.
    Context/Reference Text: "${referenceText}"
    ${context ? `Additional Context: ${context}` : ''}
    Section Type: ${type}

    Please analyze the audio recording provided. 
    1. Transcribe what you heard.
    2. Score Accuracy (0-10): How closely does it match the reference or answer the question?
    3. Score Pronunciation (0-10): Native-like accent and clear articulation.
    4. Score Fluency (0-10): Smoothness, speed, and lack of hesitation.
    5. Calculate Overall Score (0-10) based on weighted average suitable for GaoKao.
    6. Provide brief constructive feedback (max 2 sentences).
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER },
      accuracy: { type: Type.NUMBER },
      pronunciation: { type: Type.NUMBER },
      fluency: { type: Type.NUMBER },
      feedback: { type: Type.STRING },
      transcription: { type: Type.STRING },
    }
  };

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType: audioBlob.type || 'audio/webm', data: base64Audio } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  return JSON.parse(response.text || '{}') as EvaluationResult;
};