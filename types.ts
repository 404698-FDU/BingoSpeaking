export enum TestSectionType {
  ReadingAloud = 'ReadingAloud',
  RepeatSentence = 'RepeatSentence',
  QuestionAnswer = 'QuestionAnswer',
  FreeSpeech = 'FreeSpeech',
}

export interface TestPaper {
  id: string;
  readingSection: {
    text: string;
    prepTime: number;
    recordTime: number;
  };
  repeatSection: {
    sentences: string[];
    recordTime: number;
  };
  qaSection: {
    dialogue: string; // The context dialogue (user listens to this)
    questions: {
      question: string;
      answerHint: string;
    }[];
    recordTime: number;
  };
  speechSection: {
    topic: string;
    prompt: string;
    prepTime: number;
    recordTime: number;
  };
}

export interface EvaluationResult {
  score: number; // 0-10 or 0-100
  accuracy: number;
  pronunciation: number;
  fluency: number;
  feedback: string;
  transcription: string;
}

export interface SectionScore {
  sectionType: TestSectionType;
  items: EvaluationResult[];
}

export enum AppStatus {
  Idle,
  GeneratingTest,
  TestReady,
  InProgress,
  Scoring,
  Review,
}

export interface AudioConfig {
  sampleRate: number;
}