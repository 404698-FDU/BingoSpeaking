
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
      speakingA: {
        type: Type.OBJECT,
        properties: {
          items: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2 distinct sentences for reading aloud (Shanghai GaoKao level). The first sentence is shorter and the second is longer." }
        },
        required: ["items"]
      },
      speakingB: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "A reading passage of about 120 words. Academic or narrative style." }
        },
        required: ["text"]
      },
      speakingC: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                situation: { type: Type.STRING, description: "A situation description (e.g., 'Your friend is sick...'). Explicitly state that the student needs to ask two questions, and at least one must be a special question (Wh-question)." }
              },
              required: ["situation"]
            },
            description: "Exactly 2 distinct situations."
          }
        },
        required: ["items"]
      },
      speakingD: {
        type: Type.OBJECT,
        properties: {
          imageDescription: { type: Type.STRING, description: "Visual description of a 4-panel comic strip story involving students or daily life. Explicitly mention that the main character (e.g., Xiao Wang) should be labeled or easily identifiable." },
          givenSentence: { type: Type.STRING, description: "The mandatory starting sentence for the story." }
        },
        required: ["imageDescription", "givenSentence"]
      },
      listeningA: {
        type: Type.OBJECT,
        properties: {
          questions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 short conversational sentences/questions for fast response." }
        },
        required: ["questions"]
      },
      listeningB: {
        type: Type.OBJECT,
        properties: {
          passage: { type: Type.STRING, description: "A narrative or expository passage (~150 words) for listening comprehension." },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answerKey: { type: Type.STRING, description: "The correct factual answer or key points expected for the opinion question." },
                type: { type: Type.STRING, enum: ["fact", "opinion"] },
                prepTime: { type: Type.NUMBER },
                recordTime: { type: Type.NUMBER }
              },
              required: ["question", "answerKey", "type", "prepTime", "recordTime"]
            },
            description: "Exactly 2 questions. Q1 is factual (30s prep/30s answer). Q2 is opinion/comment (60s prep/60s answer)."
          }
        },
        required: ["passage", "questions"]
      }
    },
    required: ["speakingA", "speakingB", "speakingC", "speakingD", "listeningA", "listeningB"]
  };

  const response = await ai.models.generateContent({
    model,
    contents: "Generate a simulation paper for the Shanghai College Entrance Examination English Listening and Speaking Test. \n\nStructure:\nPart II Speaking:\n- Section A: Reading Sentences (2 items)\n- Section B: Reading Passage (1 item)\n- Section C: Situational Questions (2 situations). Ensure each situation explicitly prompts for 2 questions, one of which implies a 'special' (Wh-) question.\n- Section D: Picture Talk (1 item). Provide a description for a 4-panel comic. \n\nPart III Listening and Speaking:\n- Section A: Fast Response (4 items)\n- Section B: Listening Passage (1 passage, 2 questions)\n\nEnsure difficulty matches the Shanghai GaoKao standards.",
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      systemInstruction: "You are an expert English test creator for the Shanghai GaoKao. Create realistic, challenging content.",
    }
  });

  return JSON.parse(response.text || '{}') as TestPaper;
};

// --- 2. Generate Image (Section D) ---
export const generateImage = async (description: string): Promise<string> => {
  const model = "gemini-2.5-flash-image";
  try {
      const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [{ text: `Create a simple black and white line-drawing style 4-panel comic strip based on this description: ${description}. The image should look like a test booklet illustration. The panels should be arranged in a grid. IMPORTANT: Include the character's name (e.g. 'Xiao Wang') written clearly in the drawing near the character.` }]
        },
        config: {
           // Standard config for generation
        }
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
              return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
      }
      return "";
  } catch (e) {
      console.error("Image generation failed", e);
      return "";
  }
};

// --- 3. Text to Speech ---
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
      
      return new Promise((resolve) => {
        source.onended = () => {
            audioContext.close();
            resolve();
        };
      });
    }
  } catch (error) {
    console.error("Error generating speech:", error);
    // Fallback: immediate resolve if TTS fails so test doesn't hang
    return Promise.resolve();
  }
};

// --- 4. Evaluate Audio ---
export const evaluateAudio = async (
  audioBlob: Blob, 
  referenceText: string, 
  type: TestSectionType,
  context?: string
): Promise<EvaluationResult> => {
  const base64Audio = await blobToBase64(audioBlob);
  const model = "gemini-2.5-flash"; 

  let rubric = "";
  switch (type) {
    case TestSectionType.SpeakingA: // Reading Sentences (0.5 pts)
      rubric = `
        Max Score: 0.5.
        - 0.5: Fluent, clear pronunciation, correct stress/intonation, correct pausing.
        - 0.25: Basic reading, some errors in pronunciation/intonation but understandable.
        - 0.0: Serious errors, unintelligible, or no answer.
      `;
      break;
    case TestSectionType.SpeakingB: // Reading Passage (1.0 pts)
      rubric = `
        Max Score: 1.0.
        **IMPORTANT:** The student has a 30-second time limit. If the recording cuts off before the end of the text, **do NOT deduct points for the missing part**. Evaluate only the portion that was read. 
        
        - 1.0: Clear, accurate, natural intonation, logical pausing, fluent.
        - 0.75: Mostly clear, minor errors, generally fluent.
        - 0.5: Some unclear pronunciation/intonation, not fluent.
        - 0.25: Inaccurate, many errors, hard to understand.
        - 0.0: Unintelligible.
      `;
      break;
    case TestSectionType.SpeakingC: // Situational Questions (2 Questions, Max 1.0 pts total)
      rubric = `
        Max Score: 1.0 (0.5 per question).
        The audio contains TWO questions asked by the student based on the situation. Evaluate both.
        
        For EACH of the two questions:
        - 0.5: Appropriate question, complete structure, correct grammar.
        - 0.25: Relevant but has minor errors.
        - 0.0: Irrelevant, repetition, or Asking two Yes/No questions (the second Yes/No question gets 0).
        
        Final Score is the sum of both (e.g., 0.5 + 0.5 = 1.0).
        Check if at least one question is a Special Question (Wh-question).
      `;
      break;
    case TestSectionType.SpeakingD: // Picture Talk (1.5 pts)
      rubric = `
        Max Score: 1.5.
        - 1.5: Coherent, complete story matching pictures, clear expression, fluent, correct grammar/vocab.
        - 1.0: Mostly coherent, matches pictures, some grammar/vocab errors but meaning clear.
        - 0.5: Unclear main idea, incoherent, disconnected from pictures, serious errors.
        - 0.0: No answer or irrelevant.
      `;
      break;
    case TestSectionType.ListeningA: // Fast Response (0.5 pts)
      rubric = `
        Max Score: 0.5.
        - 0.5: Accurate and reasonable response, correct phonetics/grammar.
        - 0.25: Reasonably accurate, basic phonetics correct, minor errors.
        - 0.0: Inaccurate, unreasonable, or no response.
      `;
      break;
    case TestSectionType.ListeningB: // Listening Passage (Q1: 1.0, Q2: 1.5)
      rubric = `
        If Factual Question (Q1): Max Score 1.0.
        - 1.0: Clear, comprehensive, correct answer.
        - 0.5: Partial answer, incomplete, minor errors.
        - 0.0: Incorrect or irrelevant.
        
        If Opinion Question (Q2): Max Score 1.5.
        - 1.5: Coherent, fluent, relevant, correct language.
        - 1.0: Basic coherence, relevant, able to talk.
        - 0.5: Incoherent, off-topic, serious errors.
        - 0.0: No answer.
      `;
      break;
  }

  const prompt = `
    Task: Evaluate the student's oral English performance for the Shanghai GaoKao.
    Section Type: ${type}
    Context/Prompt: "${context || 'N/A'}"
    Reference Answer / Content: "${referenceText}"

    Rubric:
    ${rubric}

    Instructions:
    1. Assign a 'score' strictly based on the rubric above (e.g., 0.5, 0.25, 0.0, 1.0, 1.5).
    2. Also provide breakdown ratings (0-10 scale) for:
       - Accuracy: Relevance and correctness.
       - Pronunciation: Intonation, stress, clarity.
       - Fluency: Flow and speed.
    3. Transcribe the audio.
    4. Provide the 'feedback' text in **Simplified Chinese (简体中文)**.
    
    Provide JSON output.
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER, description: "The exam score based on the rubric (e.g. 0.5, 1.0)" },
      accuracy: { type: Type.NUMBER, description: "0-10 scale" },
      pronunciation: { type: Type.NUMBER, description: "0-10 scale" },
      fluency: { type: Type.NUMBER, description: "0-10 scale" },
      feedback: { type: Type.STRING, description: "Feedback in Simplified Chinese" },
      transcription: { type: Type.STRING },
    }
  };

  try {
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
  } catch (e) {
    console.error("Scoring failed", e);
    return { score: 0, accuracy: 0, pronunciation: 0, fluency: 0, feedback: "Evaluation failed", transcription: "" };
  }
};
