
import React from 'react';
import { SectionScore, TestSectionType, TestPaper } from '../types';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';

interface TestResultProps {
  scores: SectionScore[];
  onRestart: () => void;
  testPaper: TestPaper | null;
}

const TestResult: React.FC<TestResultProps> = ({ scores, onRestart, testPaper }) => {
  // Sum of all individual item scores (Max 10)
  const totalScore = scores.reduce((acc, section) => {
    const sectionTotal = section.items.reduce((s, item) => s + item.score, 0);
    return acc + sectionTotal;
  }, 0);

  const radarData = [
    { subject: 'Pronunciation', A: calculateMetric(scores, 'pronunciation'), fullMark: 10 },
    { subject: 'Fluency', A: calculateMetric(scores, 'fluency'), fullMark: 10 },
    { subject: 'Accuracy', A: calculateMetric(scores, 'accuracy'), fullMark: 10 },
  ];

  function calculateMetric(scores: SectionScore[], metric: 'pronunciation' | 'fluency' | 'accuracy') {
    let total = 0;
    let count = 0;
    scores.forEach(s => {
      s.items.forEach(i => {
        total += i[metric];
        count++;
      });
    });
    return count === 0 ? 0 : total / count;
  }

  const getSectionTitle = (type: TestSectionType) => {
    switch (type) {
        case TestSectionType.SpeakingA: return "Part II Sec A: Reading Sentences";
        case TestSectionType.SpeakingB: return "Part II Sec B: Reading Passage";
        case TestSectionType.SpeakingC: return "Part II Sec C: Situational Qs";
        case TestSectionType.SpeakingD: return "Part II Sec D: Picture Talk";
        case TestSectionType.ListeningA: return "Part III Sec A: Fast Response";
        case TestSectionType.ListeningB: return "Part III Sec B: Listening Passage";
        default: return type;
    }
  };

  const handleDownloadReport = () => {
    if (!testPaper) return;

    let report = `# Shanghai Oral English Test Report\n\n`;
    report += `**Total Score:** ${totalScore.toFixed(2)} / 10\n`;
    report += `**Date:** ${new Date().toLocaleString()}\n\n`;

    scores.forEach((section) => {
        report += `## ${getSectionTitle(section.sectionType)}\n\n`;
        
        section.items.forEach((item, idx) => {
            report += `### Item ${idx + 1}\n`;
            
            // Add Context from Test Paper if possible
            if (section.sectionType === TestSectionType.SpeakingA && testPaper.speakingA.items[idx]) {
                report += `> **Text:** ${testPaper.speakingA.items[idx]}\n\n`;
            } else if (section.sectionType === TestSectionType.SpeakingB) {
                report += `> **Passage:** ${testPaper.speakingB.text.substring(0, 50)}...\n\n`;
            } else if (section.sectionType === TestSectionType.ListeningA && testPaper.listeningA.questions[idx]) {
                report += `> **Prompt:** ${testPaper.listeningA.questions[idx]}\n\n`;
            } else if (section.sectionType === TestSectionType.ListeningB && testPaper.listeningB.questions[idx]) {
                report += `> **Question:** ${testPaper.listeningB.questions[idx].question}\n`;
                report += `> **Answer Key:** ${testPaper.listeningB.questions[idx].answerKey}\n\n`;
            }

            report += `**Score:** ${item.score} \n`;
            report += `**Transcription:** "${item.transcription}"\n`;
            report += `**Feedback:** ${item.feedback}\n`;
            report += `---\n\n`;
        });
    });

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-10">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Examination Report</h2>
        <div className="flex items-center justify-center space-x-4 mt-6">
           <div className="text-center">
             <div className="text-5xl font-extrabold text-blue-600">{totalScore.toFixed(1)}</div>
             <div className="text-sm text-slate-500 uppercase tracking-wide font-semibold mt-1">Total Score (Max 10)</div>
           </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[300px]">
           <h3 className="text-lg font-bold text-slate-700 mb-4">Performance Analysis</h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                 <PolarGrid />
                 <PolarAngleAxis dataKey="subject" />
                 <PolarRadiusAxis angle={30} domain={[0, 10]} />
                 <Radar name="Student" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.5} />
                 <Tooltip />
               </RadarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-y-auto max-h-[500px]">
           <h3 className="text-lg font-bold text-slate-700 mb-4">Section Breakdown</h3>
           <div className="space-y-6">
             {scores.map((section, idx) => (
               <div key={idx} className="border-b border-slate-100 last:border-0 pb-4">
                 <h4 className="font-semibold text-slate-800 bg-slate-50 px-3 py-1 rounded inline-block">{getSectionTitle(section.sectionType)}</h4>
                 <div className="mt-3 space-y-3">
                   {section.items.map((item, i) => (
                     <div key={i} className="text-sm p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition">
                       <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-slate-600">Item {i + 1}</span>
                          <span className={`font-bold px-2 py-0.5 rounded ${item.score > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {item.score.toFixed(2)}
                          </span>
                       </div>
                       <div className="grid grid-cols-1 gap-1 text-slate-500 text-xs">
                         <p><span className="font-semibold">Transcript:</span> "{item.transcription}"</p>
                         <p><span className="font-semibold">Feedback:</span> {item.feedback}</p>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="flex justify-center gap-4 pt-4">
        <button 
          onClick={handleDownloadReport}
          className="px-8 py-4 bg-white text-slate-900 border border-slate-300 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition transform hover:-translate-y-1"
        >
          Download Report
        </button>
        <button 
          onClick={onRestart}
          className="px-8 py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition transform hover:-translate-y-1"
        >
          Take New Test
        </button>
      </div>
    </div>
  );
};

export default TestResult;
