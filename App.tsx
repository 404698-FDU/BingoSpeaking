
import React, { useState, useEffect, useRef } from 'react';
import { 
  AppStatus, 
  TestPaper, 
  TestSectionType, 
  SectionScore, 
  UserResponse 
} from './types';
import { generateTestPaper, generateImage, playTextAsSpeech, evaluateAudio } from './services/geminiService';
import AudioRecorder, { AudioRecorderHandle } from './components/AudioRecorder';
import TestResult from './components/TestResult';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const App: React.FC = () => {
  // --- State ---
  const [status, setStatus] = useState<AppStatus>(AppStatus.Idle);
  const [testPaper, setTestPaper] = useState<TestPaper | null>(null);
  
  // Flow Control
  const [currentSection, setCurrentSection] = useState<TestSectionType>(TestSectionType.SpeakingA);
  const [itemIndex, setItemIndex] = useState(0); 
  const [subItemIndex, setSubItemIndex] = useState(0); 
  
  // UI Display State
  const [phase, setPhase] = useState<'instruction' | 'playing' | 'prep' | 'recording' | 'processing' | 'rest'>('instruction');
  const [instructionText, setInstructionText] = useState("");
  const [timer, setTimer] = useState(0);
  const [displayContent, setDisplayContent] = useState<React.ReactNode>(null);

  // Data
  const [userResponses, setUserResponses] = useState<UserResponse[]>([]);
  const [scores, setScores] = useState<SectionScore[]>([]);
  const [scoringProgress, setScoringProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  
  const recorderRef = useRef<AudioRecorderHandle>(null);

  // --- Actions ---

  const startGeneration = async () => {
    setStatus(AppStatus.GeneratingTest);
    try {
      const paper = await generateTestPaper();
      
      // Generate Image for Speaking D
      if (paper.speakingD && paper.speakingD.imageDescription) {
        try {
          const imageBase64 = await generateImage(paper.speakingD.imageDescription);
          paper.speakingD.imageUrl = imageBase64;
        } catch (imgErr) {
          console.error("Failed to generate image", imgErr);
        }
      }

      setTestPaper(paper);
      setScores([]);
      setUserResponses([]);
      setStatus(AppStatus.TestReady);
    } catch (e) {
      console.error(e);
      alert("Failed to generate test. Please try again.");
      setStatus(AppStatus.Idle);
    }
  };

  const startTest = () => {
    setStatus(AppStatus.InProgress);
    setUserResponses([]);
    // Start with Speaking A
    setCurrentSection(TestSectionType.SpeakingA);
    setItemIndex(0);
    setSubItemIndex(0);
    runSpeakingA(0);
  };

  // --- Timer Helper ---
  const runTimer = async (seconds: number) => {
    setTimer(seconds);
    for (let i = seconds; i > 0; i--) {
      setTimer(i);
      await delay(1000);
    }
    setTimer(0);
  };

  // --- Section Flows ---

  // 1. Speaking A: Reading Sentences (2 items) - Prep 30s, Read 15s
  const runSpeakingA = async (index: number) => {
    if (!testPaper) return;
    const items = testPaper.speakingA.items;
    
    setPhase('instruction');
    setCurrentSection(TestSectionType.SpeakingA);
    setInstructionText(`Section A: Read Sentence ${index + 1}`);
    setDisplayContent(<div className="text-2xl font-serif text-center mt-10 p-6">{items[index]}</div>);
    await delay(1500);

    setPhase('prep');
    setInstructionText("Preparation Time (30s)");
    await runTimer(30);

    setPhase('recording');
    setInstructionText("Start Reading (15s)");
  };

  // 2. Speaking B: Reading Passage (1 item) - Prep 60s, Read 30s
  const runSpeakingB = async () => {
    if (!testPaper) return;
    
    setPhase('instruction');
    setCurrentSection(TestSectionType.SpeakingB);
    setInstructionText("Section B: Read the Passage");
    setDisplayContent(<div className="text-lg leading-relaxed font-serif p-6 bg-white rounded shadow">{testPaper.speakingB.text}</div>);
    await delay(1500);

    setPhase('prep');
    setInstructionText("Preparation Time (60s)");
    await runTimer(60);

    setPhase('recording');
    setInstructionText("Start Reading (30s)");
  };

  // 3. Speaking C: Situational Questions (2 situations) - Answer 20s total per situation
  const runSpeakingC = async (idx: number) => {
    if (!testPaper) return;
    const situations = testPaper.speakingC.items;
    const situation = situations[idx];

    setCurrentSection(TestSectionType.SpeakingC);
    setInstructionText(`Section C: Situation ${idx + 1}`);
    setDisplayContent(
      <div className="text-lg text-center p-6">
          <h3 className="font-bold mb-4">Situation:</h3>
          <p>{situation.situation}</p>
          <div className="mt-6 bg-blue-50 p-4 rounded text-blue-800 text-sm">
             <p className="font-bold">Task:</p>
             <p>Ask two questions about the situation.</p>
             <p>(At least one must be a special question)</p>
          </div>
      </div>
    );

    // Play the situation audio
    setPhase('instruction');
    setInstructionText("Listen to the Situation");
    setPhase('playing');
    await delay(100); // UI Render Delay
    await playTextAsSpeech(situation.situation);
    
    // Short pause after audio before recording
    await delay(1000);

    setPhase('recording');
    setInstructionText("Ask Two Questions (20s)");
  };

  // 4. Speaking D: Picture Talk - Prep 60s, Talk 60s
  const runSpeakingD = async () => {
    if (!testPaper) return;

    setPhase('instruction');
    setCurrentSection(TestSectionType.SpeakingD);
    setInstructionText("Section D: Picture Talk");
    setDisplayContent(
      <div className="p-4 flex flex-col items-center">
        {testPaper.speakingD.imageUrl ? (
          <img src={testPaper.speakingD.imageUrl} alt="Comic Strip" className="w-full max-w-2xl rounded-lg shadow border border-slate-300 mb-4" />
        ) : (
          <div className="w-full h-64 bg-slate-200 flex items-center justify-center text-slate-500 mb-4 rounded-lg">
             {testPaper.speakingD.imageDescription ? "Image Loading Error" : "No Image Description"}
          </div>
        )}
        <div className="bg-blue-50 p-4 rounded border border-blue-200 w-full text-center">
            <span className="font-bold text-blue-800">Start with: </span>
            <span className="text-blue-900 italic">{testPaper.speakingD.givenSentence}</span>
        </div>
      </div>
    );
    await delay(2000);

    setPhase('prep');
    setInstructionText("Preparation Time (60s)");
    await runTimer(60);

    setPhase('recording');
    setInstructionText("Describe the pictures (60s)");
  };

  // 5. Listening A: Fast Response (4 items) - Ans 5s
  const runListeningA = async (index: number) => {
    if (!testPaper) return;
    const questions = testPaper.listeningA.questions;

    setPhase('instruction');
    setCurrentSection(TestSectionType.ListeningA);
    setInstructionText(`Fast Response ${index + 1}/${questions.length}`);
    setDisplayContent(<div className="text-center text-slate-500 mt-10">Listen and respond immediately.</div>);
    
    setPhase('playing');
    await delay(100); // UI Render Delay
    await playTextAsSpeech(questions[index]);
    
    setPhase('recording');
    setInstructionText("Answer Now (5s)");
  };

  // 6. Listening B: Passage Q&A (1 passage, 2 questions)
  const runListeningB = async (qIndex: number) => {
    if (!testPaper) return;
    const section = testPaper.listeningB;

    setCurrentSection(TestSectionType.ListeningB);

    // If start of section, play passage twice
    if (qIndex === 0) {
      setPhase('instruction');
      setInstructionText("Listening Passage");
      setDisplayContent(<div className="text-center text-slate-500 mt-10">Listen to the passage (Read twice).</div>);
      
      setPhase('playing');
      await delay(100); // UI Render Delay
      await playTextAsSpeech(section.passage);
      await delay(2000);
      await playTextAsSpeech(section.passage);
    }

    const q = section.questions[qIndex];
    setPhase('instruction');
    setInstructionText(`Question ${qIndex + 1}`);
    setDisplayContent(<div className="text-xl text-center p-6 font-medium">{q.question}</div>);
    
    setPhase('playing');
    await delay(100); // UI Render Delay
    await playTextAsSpeech(q.question);

    setPhase('prep');
    setInstructionText(`Preparation Time (${q.prepTime}s)`);
    await runTimer(q.prepTime); 

    setPhase('recording');
    setInstructionText(`Answer Now (${q.recordTime}s)`);
  };

  // --- Transitions ---

  const handleSectionRest = async () => {
    setPhase('rest');
    setInstructionText("Next Section in 10s...");
    setDisplayContent(<div className="text-center text-slate-400 mt-10">Take a breath.</div>);
    await runTimer(10);
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!testPaper) return;

    // Capture current context
    const resp: UserResponse = {
      sectionType: currentSection,
      audioBlob,
      referenceText: "",
      context: "",
      itemIndex,
      subIndex: subItemIndex
    };

    // Determine reference data
    if (currentSection === TestSectionType.SpeakingA) {
      resp.referenceText = testPaper.speakingA.items[itemIndex];
    } else if (currentSection === TestSectionType.SpeakingB) {
      resp.referenceText = testPaper.speakingB.text;
    } else if (currentSection === TestSectionType.SpeakingC) {
      resp.context = testPaper.speakingC.items[itemIndex].situation;
      resp.referenceText = "The student must ask TWO relevant questions about the situation. One special (wh-) question is required.";
    } else if (currentSection === TestSectionType.SpeakingD) {
      resp.context = testPaper.speakingD.imageDescription;
      resp.referenceText = `Story starting with: ${testPaper.speakingD.givenSentence}`;
    } else if (currentSection === TestSectionType.ListeningA) {
      resp.context = `Prompt: ${testPaper.listeningA.questions[itemIndex]}`;
      resp.referenceText = "Appropriate response to the prompt.";
    } else if (currentSection === TestSectionType.ListeningB) {
      const q = testPaper.listeningB.questions[itemIndex];
      resp.context = `Passage: ${testPaper.listeningB.passage}. Question: ${q.question}`;
      // Use the Answer Key generated by Gemini
      resp.referenceText = q.answerKey || (q.type === 'fact' ? "Factual answer from text" : "Opinionated answer");
    }

    setUserResponses(prev => [...prev, resp]);

    // --- State Machine Logic ---
    
    // Speaking A (2 items) -> Rest -> Speaking B
    if (currentSection === TestSectionType.SpeakingA) {
      if (itemIndex < testPaper.speakingA.items.length - 1) {
        setItemIndex(prev => {
           const next = prev + 1;
           runSpeakingA(next);
           return next;
        });
      } else {
        await handleSectionRest();
        setCurrentSection(TestSectionType.SpeakingB);
        setItemIndex(0);
        runSpeakingB();
      }
    }
    // Speaking B (1 item) -> Rest -> Speaking C
    else if (currentSection === TestSectionType.SpeakingB) {
      await handleSectionRest();
      setCurrentSection(TestSectionType.SpeakingC);
      setItemIndex(0);
      setSubItemIndex(0);
      runSpeakingC(0);
    }
    // Speaking C (2 items) -> Rest -> Speaking D
    else if (currentSection === TestSectionType.SpeakingC) {
      if (itemIndex < testPaper.speakingC.items.length - 1) {
         setItemIndex(prev => {
           const next = prev + 1;
           runSpeakingC(next);
           return next;
         });
      } else {
         await handleSectionRest();
         setCurrentSection(TestSectionType.SpeakingD);
         setItemIndex(0);
         runSpeakingD();
      }
    }
    // Speaking D (1 item) -> Rest -> Listening A
    else if (currentSection === TestSectionType.SpeakingD) {
       await handleSectionRest();
       setCurrentSection(TestSectionType.ListeningA);
       setItemIndex(0);
       runListeningA(0);
    }
    // Listening A (4 items) -> Rest -> Listening B
    else if (currentSection === TestSectionType.ListeningA) {
       if (itemIndex < testPaper.listeningA.questions.length - 1) {
         setItemIndex(prev => {
           const next = prev + 1;
           runListeningA(next);
           return next;
         });
       } else {
         await handleSectionRest();
         setCurrentSection(TestSectionType.ListeningB);
         setItemIndex(0);
         runListeningB(0);
       }
    }
    // Listening B (2 items) -> Finish
    else if (currentSection === TestSectionType.ListeningB) {
       if (itemIndex < testPaper.listeningB.questions.length - 1) {
         setItemIndex(prev => {
           const next = prev + 1;
           runListeningB(next);
           return next;
         });
       } else {
         setStatus(AppStatus.Scoring);
       }
    }
  };

  // --- Scoring & Duration Logic ---

  const getRecordDuration = () => {
    if (!testPaper) return 10;
    switch (currentSection) {
      case TestSectionType.SpeakingA: return 15;
      case TestSectionType.SpeakingB: return 30;
      case TestSectionType.SpeakingC: return 20; // Modified to 20s for combined questions
      case TestSectionType.SpeakingD: return 60;
      case TestSectionType.ListeningA: return 5;
      case TestSectionType.ListeningB: return testPaper.listeningB.questions[itemIndex]?.recordTime || 30;
      default: return 10;
    }
  };

  useEffect(() => {
    if (status === AppStatus.Scoring) {
      processExamResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const processExamResults = async () => {
    const newScores: SectionScore[] = [];
    const getOrAddSection = (type: TestSectionType) => {
        let section = newScores.find(s => s.sectionType === type);
        if (!section) {
            section = { sectionType: type, items: [] };
            newScores.push(section);
        }
        return section;
    };

    for (let i = 0; i < userResponses.length; i++) {
        setScoringProgress({ current: i + 1, total: userResponses.length });
        const resp = userResponses[i];
        
        try {
            const result = await evaluateAudio(resp.audioBlob, resp.referenceText, resp.sectionType, resp.context);
            const section = getOrAddSection(resp.sectionType);
            section.items.push(result);
        } catch (error) {
            console.error("Evaluation failed", error);
        }
    }
    setScores(newScores);
    setStatus(AppStatus.Review);
  };

  // --- Rendering ---

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">SH</div>
          <h1 className="text-xl font-bold text-slate-800">Shanghai Oral English Test</h1>
        </div>
        {status === AppStatus.InProgress && (
          <div className="text-sm font-medium px-4 py-1 bg-slate-100 rounded-full text-slate-600 border border-slate-200">
             Part {currentSection.includes('Speaking') ? 'II' : 'III'} - {currentSection.replace(/([A-Z])/g, ' $1')}
          </div>
        )}
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-6 w-full max-w-5xl mx-auto">
        
        {/* IDLE */}
        {status === AppStatus.Idle && (
           <div className="text-center space-y-8 animate-fade-in">
             <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-32 h-32 rounded-3xl flex items-center justify-center mx-auto shadow-xl rotate-3">
               <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
               </svg>
             </div>
             <div>
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Shanghai College Entrance Simulator</h2>
                <p className="text-lg text-slate-600 max-w-xl mx-auto">
                  Strict adherence to Part II & III. Includes all section timings and the 10-second interval rule.
                </p>
             </div>
             <button onClick={startGeneration} className="bg-slate-900 text-white text-lg font-semibold px-10 py-4 rounded-xl shadow-2xl hover:bg-slate-800 hover:scale-105 transition-all">
               Start Examination
             </button>
           </div>
        )}

        {/* LOADING */}
        {status === AppStatus.GeneratingTest && (
           <div className="flex flex-col items-center space-y-4">
             <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
             <p className="text-slate-600 font-medium">Generating Exam Paper (Shanghai Standard)...</p>
             <p className="text-xs text-slate-400">Creating content and images with Gemini...</p>
           </div>
        )}

        {/* READY */}
        {status === AppStatus.TestReady && (
           <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg w-full text-center space-y-8">
             <div>
               <h3 className="text-3xl font-bold text-slate-800 mb-2">Paper Ready</h3>
               <p className="text-slate-500">Includes all standard sections and rest intervals.</p>
             </div>
             <div className="space-y-3 text-left bg-slate-50 p-6 rounded-xl border border-slate-100">
                <div className="flex justify-between"><span>Part II. Speaking</span><span className="font-bold text-slate-700">A, B, C, D</span></div>
                <div className="flex justify-between"><span>Part III. Listening</span><span className="font-bold text-slate-700">A, B</span></div>
             </div>
             <button onClick={startTest} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition">Begin Test</button>
           </div>
        )}

        {/* IN PROGRESS */}
        {status === AppStatus.InProgress && (
          <div className="w-full max-w-4xl flex flex-col items-center space-y-10">
            {/* Instruction / Timer */}
            <div className="text-center space-y-2">
               <h2 className={`text-3xl font-bold text-slate-800 transition-colors ${phase === 'recording' ? 'text-red-600' : ''}`}>
                 {instructionText}
               </h2>
               {(phase === 'prep' || phase === 'rest') && <div className="text-6xl font-mono font-bold text-orange-500">{timer}s</div>}
               {phase === 'playing' && <div className="text-blue-500 animate-pulse font-medium tracking-widest">LISTENING...</div>}
            </div>

            {/* Content Display */}
            <div className="w-full bg-white rounded-2xl shadow-md min-h-[200px] flex items-center justify-center border border-slate-100">
               {displayContent}
            </div>

            {/* Recorder */}
            {phase === 'recording' && (
              <AudioRecorder 
                ref={recorderRef}
                maxDuration={getRecordDuration()}
                onRecordingComplete={handleRecordingComplete}
                autoStart={true}
              />
            )}
          </div>
        )}

        {/* SCORING */}
        {status === AppStatus.Scoring && (
          <div className="text-center space-y-6">
             <h2 className="text-2xl font-bold text-slate-800">Calculating Score</h2>
             <div className="w-64 h-4 bg-slate-200 rounded-full overflow-hidden mx-auto">
               <div className="bg-blue-600 h-full transition-all duration-500" style={{width: `${(scoringProgress.current / scoringProgress.total) * 100}%`}}></div>
             </div>
             <p className="text-slate-500">Analyzing {scoringProgress.current}/{scoringProgress.total} responses...</p>
          </div>
        )}

        {/* RESULT */}
        {status === AppStatus.Review && (
          <TestResult scores={scores} onRestart={() => setStatus(AppStatus.Idle)} testPaper={testPaper} />
        )}

      </main>
    </div>
  );
};

export default App;
