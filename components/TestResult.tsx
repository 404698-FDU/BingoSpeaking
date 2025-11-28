
import React from 'react';
import { SectionScore, TestSectionType } from '../types';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';

interface TestResultProps {
  scores: SectionScore[];
  onRestart: () => void;
}

const TestResult: React.FC<TestResultProps> = ({ scores, onRestart }) => {
  // Simple weighted average for demo purposes
  const totalScore = scores.reduce((acc, section) => {
    const sectionAvg = section.items.reduce((s, item) => s + item.score, 0) / (section.items.length || 1);
    return acc + sectionAvg;
  }, 0) / (scores.length || 1);

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

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-10">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Examination Report</h2>
        <div className="flex items-center justify-center space-x-4 mt-6">
           <div className="text-center">
             <div className="text-5xl font-extrabold text-blue-600">{totalScore.toFixed(1)}</div>
             <div className="text-sm text-slate-500 uppercase tracking-wide font-semibold mt-1">Total Score</div>
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
                          <span className={`font-bold px-2 py-0.5 rounded ${item.score >= 6 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {item.score.toFixed(1)}
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

      <div className="flex justify-center pt-4">
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
