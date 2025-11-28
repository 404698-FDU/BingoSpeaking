import React, { useState, useEffect, useRef } from 'react';
import { 
  AppStatus, 
  TestPaper, 
  TestSectionType, 
  SectionScore, 
  EvaluationResult 
} from './types';
import { generateTestPaper, playTextAsSpeech, evaluateAudio } from './services/geminiService';
import AudioRecorder, { AudioRecorderHandle } from './components/AudioRecorder';
import TestResult from './components/TestResult';

// Utility for simple delays
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const App: React.FC = () => {
  // State
  const [status, setStatus] = useState<AppStatus>(AppStatus.Idle);
  const [testPaper, setTestPaper] = useState<TestPaper | null>(null);
  
  // Test Progress State
  const [currentSection, setCurrentSection] = useState<TestSectionType>(TestSectionType.ReadingAloud);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [phase, setPhase] = useState<'instruction' | 'playing' | 'prep' | 'recording' | 'processing'>('instruction');
  const [instructionText, setInstructionText] = useState("");
  const [timer, setTimer] = useState(0);

  // Scores
  const [scores, setScores] = useState<SectionScore[]>([]);
  
  const recorderRef = useRef<AudioRecorderHandle>(null);

  // --- Actions ---

  const startGeneration = async () => {
    setStatus(AppStatus.GeneratingTest);
    try {
      const paper = await generateTestPaper();
      setTestPaper(paper);
      setScores([]);
      setStatus(AppStatus.TestReady);
    } catch (e) {
      console.error(e);
      alert("Failed to generate test. Please check API Key and try again.");
      setStatus(AppStatus.Idle);
    }
  };

  const startTest = () => {
    setStatus(AppStatus.InProgress);
    setCurrentSection(TestSectionType.ReadingAloud);
    setCurrentItemIndex(0);
    runSectionFlow(TestSectionType.ReadingAloud, 0);
  };

  // --- Test Flow Orchestrator ---

  const runSectionFlow = async (sectionType: TestSectionType, index: number) => {
    if (!testPaper) return;

    setPhase('instruction');
    
    switch (sectionType) {
      case TestSectionType.ReadingAloud:
        setInstructionText("Reading Aloud: Read the text aloud after the preparation time.");
        await delay(2000);
        
        setInstructionText("Preparation Time");
        setPhase('prep');
        await runTimer(testPaper.readingSection.prepTime);
        
        setInstructionText("Start Recording Now!");
        setPhase('recording');
        // Recording handled by AudioRecorder triggering onComplete
        break;

      case TestSectionType.RepeatSentence:
        setInstructionText(`Repeat Sentence ${index + 1}/${testPaper.repeatSection.sentences.length}`);
        setPhase('playing');
        await playTextAsSpeech(testPaper.repeatSection.sentences[index]);
        
        setInstructionText("Repeat now!");
        setPhase('recording');
        break;

      case TestSectionType.QuestionAnswer:
        if (index === 0) {
            setInstructionText("Listening to the dialogue...");
            setPhase('playing');
            await playTextAsSpeech(testPaper.qaSection.dialogue, 'Puck'); // Use different voice for context
        }
        
        setInstructionText(`Question ${index + 1}`);
        setPhase('playing');
        await playTextAsSpeech(testPaper.qaSection.questions[index].question);
        
        setInstructionText("Answer now!");
        setPhase('recording');
        break;

      case TestSectionType.FreeSpeech:
        setInstructionText("Free Speech: Read the topic and prepare.");
        await delay(2000);
        
        setInstructionText("Preparation Time");
        setPhase('prep');
        await runTimer(testPaper.speechSection.prepTime);
        
        setInstructionText("Start Speaking Now!");
        setPhase('recording');
        break;
    }
  };

  const runTimer = (seconds: number) => {
    return new Promise<void>((resolve) => {
      setTimer(seconds);
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            resolve();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setPhase('processing');
    setInstructionText("Evaluating response...");
    
    if (!testPaper) return;

    let referenceText = "";
    let context = "";

    // Determine reference text based on current section
    switch (currentSection) {
      case TestSectionType.ReadingAloud:
        referenceText = testPaper.readingSection.text;
        break;
      case TestSectionType.RepeatSentence:
        referenceText = testPaper.repeatSection.sentences[currentItemIndex];
        break;
      case TestSectionType.QuestionAnswer:
        referenceText = testPaper.qaSection.questions[currentItemIndex].answerHint;
        context = `Question was: ${testPaper.qaSection.questions[currentItemIndex].question}. Context Dialogue: ${testPaper.qaSection.dialogue}`;
        break;
      case TestSectionType.FreeSpeech:
        referenceText = "N/A (Free Speech)";
        context = `Topic: ${testPaper.speechSection.topic}. Prompt: ${testPaper.speechSection.prompt}`;
        break;
    }

    try {
      const evaluation = await evaluateAudio(audioBlob, referenceText, currentSection, context);
      
      // Save Score
      setScores(prev => {
        const newScores = [...prev];
        const sectionIdx = newScores.findIndex(s => s.sectionType === currentSection);
        if (sectionIdx === -1) {
          newScores.push({ sectionType: currentSection, items: [evaluation] });
        } else {
          newScores[sectionIdx].items.push(evaluation);
        }
        return newScores;
      });

      // Navigate to Next Item or Section
      moveToNextStep();

    } catch (error) {
      console.error("Evaluation failed", error);
      alert("Error evaluating audio. Moving to next.");
      moveToNextStep();
    }
  };

  const moveToNextStep = () => {
    if (!testPaper) return;

    if (currentSection === TestSectionType.ReadingAloud) {
      setCurrentSection(TestSectionType.RepeatSentence);
      setCurrentItemIndex(0);
      runSectionFlow(TestSectionType.RepeatSentence, 0);
    } 
    else if (currentSection === TestSectionType.RepeatSentence) {
      if (currentItemIndex < testPaper.repeatSection.sentences.length - 1) {
        setCurrentItemIndex(prev => prev + 1);
        runSectionFlow(TestSectionType.RepeatSentence, currentItemIndex + 1);
      } else {
        setCurrentSection(TestSectionType.QuestionAnswer);
        setCurrentItemIndex(0);
        runSectionFlow(TestSectionType.QuestionAnswer, 0);
      }
    } 
    else if (currentSection === TestSectionType.QuestionAnswer) {
      if (currentItemIndex < testPaper.qaSection.questions.length - 1) {
        setCurrentItemIndex(prev => prev + 1);
        runSectionFlow(TestSectionType.QuestionAnswer, currentItemIndex + 1);
      } else {
        setCurrentSection(TestSectionType.FreeSpeech);
        setCurrentItemIndex(0);
        runSectionFlow(TestSectionType.FreeSpeech, 0);
      }
    } 
    else if (currentSection === TestSectionType.FreeSpeech) {
      setStatus(AppStatus.Review);
    }
  };

  // --- Render Helpers ---

  const renderContent = () => {
    if (!testPaper) return null;

    if (currentSection === TestSectionType.ReadingAloud) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl w-full">
           <h3 className="text-xl font-bold mb-4 border-b pb-2">Reading Aloud</h3>
           <p className="text-lg leading-relaxed text-slate-800 font-serif">{testPaper.readingSection.text}</p>
        </div>
      );
    }

    if (currentSection === TestSectionType.RepeatSentence) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl w-full text-center">
          <h3 className="text-xl font-bold mb-8">Repeat Sentence</h3>
          <div className="text-6xl text-blue-200 mb-8">
            <i className="fas fa-headphones"></i>
          </div>
          <p className="text-slate-500">Listen carefully and repeat exactly what you hear.</p>
          <div className="mt-4 flex justify-center space-x-2">
             {testPaper.repeatSection.sentences.map((_, idx) => (
                <div key={idx} className={`w-3 h-3 rounded-full ${idx === currentItemIndex ? 'bg-blue-600' : idx < currentItemIndex ? 'bg-green-400' : 'bg-slate-200'}`}></div>
             ))}
          </div>
        </div>
      );
    }

    if (currentSection === TestSectionType.QuestionAnswer) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl w-full text-center">
          <h3 className="text-xl font-bold mb-4">Question & Answer</h3>
          <p className="text-slate-600 mb-6">Listen to the question related to the dialogue and answer briefly.</p>
          <div className="mt-4 flex justify-center space-x-2">
             {testPaper.qaSection.questions.map((_, idx) => (
                <div key={idx} className={`w-3 h-3 rounded-full ${idx === currentItemIndex ? 'bg-blue-600' : idx < currentItemIndex ? 'bg-green-400' : 'bg-slate-200'}`}></div>
             ))}
          </div>
        </div>
      );
    }

    if (currentSection === TestSectionType.FreeSpeech) {
      return (
         <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl w-full">
           <h3 className="text-xl font-bold mb-4 border-b pb-2">Free Speech</h3>
           <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-4">
             <h4 className="font-semibold text-blue-800 mb-1">Topic: {testPaper.speechSection.topic}</h4>
             <p className="text-blue-900">{testPaper.speechSection.prompt}</p>
           </div>
        </div>
      );
    }
  };

  const getRecordDuration = () => {
    if (!testPaper) return 10;
    switch (currentSection) {
        case TestSectionType.ReadingAloud: return testPaper.readingSection.recordTime;
        case TestSectionType.RepeatSentence: return testPaper.repeatSection.recordTime;
        case TestSectionType.QuestionAnswer: return testPaper.qaSection.recordTime;
        case TestSectionType.FreeSpeech: return testPaper.speechSection.recordTime;
        default: return 10;
    }
  };

  // --- Main View ---

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">SH</div>
          <h1 className="text-xl font-bold text-slate-800">English Oral Test Sim</h1>
        </div>
        {status !== AppStatus.Idle && status !== AppStatus.Review && (
             <div className="text-sm font-medium px-3 py-1 bg-slate-100 rounded-full text-slate-600">
               {currentSection.replace(/([A-Z])/g, ' $1').trim()}
             </div>
        )}
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-6 relative">
        
        {/* IDLE STATE */}
        {status === AppStatus.Idle && (
          <div className="text-center space-y-6 max-w-lg">
            <div className="bg-blue-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Shanghai GaoKao Simulator</h2>
            <p className="text-lg text-slate-600">
              Generate a unique, AI-powered exam paper consisting of Reading, Repeating, Q&A, and Free Speech sections. Get instant AI grading and feedback.
            </p>
            <button 
              onClick={startGeneration}
              className="bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold px-8 py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-1 w-full sm:w-auto"
            >
              Generate New Test
            </button>
          </div>
        )}

        {/* GENERATING STATE */}
        {status === AppStatus.GeneratingTest && (
           <div className="flex flex-col items-center space-y-4">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
             <p className="text-slate-600 font-medium animate-pulse">Designing your exam paper...</p>
           </div>
        )}

        {/* READY STATE */}
        {status === AppStatus.TestReady && testPaper && (
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">
            <div className="space-y-2">
               <h3 className="text-2xl font-bold text-slate-800">Test Generated</h3>
               <p className="text-slate-500">Paper ID: {testPaper.id.substring(0,8)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-left bg-slate-50 p-4 rounded-lg">
                <div>Reading: <span className="font-semibold">1 Part</span></div>
                <div>Repeat: <span className="font-semibold">{testPaper.repeatSection.sentences.length} Sentences</span></div>
                <div>Q&A: <span className="font-semibold">{testPaper.qaSection.questions.length} Questions</span></div>
                <div>Speech: <span className="font-semibold">1 Topic</span></div>
            </div>
            <button 
              onClick={startTest}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow transition"
            >
              Start Exam
            </button>
          </div>
        )}

        {/* IN PROGRESS STATE */}
        {status === AppStatus.InProgress && (
          <div className="w-full max-w-4xl flex flex-col items-center space-y-8">
            
            {/* Status Bar / Instruction */}
            <div className={`text-center transition-all duration-300 ${phase === 'recording' ? 'scale-110' : ''}`}>
               <h2 className="text-2xl font-bold text-slate-800 mb-2">{instructionText}</h2>
               {phase === 'prep' && (
                 <div className="text-4xl font-mono text-orange-500 font-bold">{timer}s</div>
               )}
            </div>

            {/* Content Area */}
            {renderContent()}

            {/* Recorder Area */}
            {phase === 'recording' && (
              <div className="w-full flex justify-center">
                 <AudioRecorder 
                   ref={recorderRef}
                   maxDuration={getRecordDuration()}
                   onRecordingComplete={handleRecordingComplete}
                   autoStart={true}
                 />
              </div>
            )}

             {/* Processing Indicator */}
             {phase === 'processing' && (
               <div className="flex flex-col items-center text-blue-600">
                  <div className="flex space-x-1 mb-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-sm font-medium">AI Evaluator is listening...</span>
               </div>
             )}
          </div>
        )}

        {/* REVIEW STATE */}
        {status === AppStatus.Review && (
          <TestResult 
            scores={scores} 
            onRestart={() => setStatus(AppStatus.Idle)} 
          />
        )}

      </main>
    </div>
  );
};

export default App;