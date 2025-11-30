
export enum TestSectionType {
  SpeakingA = 'SpeakingA', // Reading Sentences
  SpeakingB = 'SpeakingB', // Reading Paragraph
  SpeakingC = 'SpeakingC', // Situational Questions (Combined recording)
  SpeakingD = 'SpeakingD', // Picture Talk
  ListeningA = 'ListeningA', // Fast Response
  ListeningB = 'ListeningB', // Listening Passage & Q&A
}

export interface TestPaper {
  id: string;
  // Part II Speaking
  speakingA: {
    items: string[]; // 2 sentences
  };
  speakingB: {
    text: string; // 1 passage
  };
  speakingC: {
    items: {
      situation: string; 
    }[]; // 2 situations
  };
  speakingD: {
    imageDescription: string; // Text description of the 4-panel comic
    givenSentence: string;
    imageUrl?: string; // Generated image data
  };
  
  // Part III Listening & Speaking
  listeningA: {
    questions: string[]; // 4 sentences to respond to
  };
  listeningB: {
    passage: string; // Read twice
    questions: {
      question: string;
      answerKey: string; // The correct answer or key points
      type: 'fact' | 'opinion';
      prepTime: number;
      recordTime: number;
    }[]; // 2 questions
  };
}

export interface EvaluationResult {
  score: number; // Actual exam score (e.g. 0.5, 1.0)
  accuracy: number; // 0-10 for radar chart
  pronunciation: number; // 0-10 for radar chart
  fluency: number; // 0-10 for radar chart
  feedback: string;
  transcription: string;
}

export interface SectionScore {
  sectionType: TestSectionType;
  items: EvaluationResult[];
}

export interface UserResponse {
  sectionType: TestSectionType;
  audioBlob: Blob;
  referenceText: string; // For AI to judge against
  context?: string;      // Extra context (e.g., the question asked)
  itemIndex: number;
  subIndex?: number;     // For multi-part questions like Listening B
}

export enum AppStatus {
  Idle,
  GeneratingTest,
  TestReady,
  InProgress,
  Scoring,
  Review,
}
