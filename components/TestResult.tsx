import React from 'react';
import { SectionScore, TestSectionType } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface TestResultProps {
  scores: SectionScore[];
  onRestart: () => void;
}

const TestResult: React.FC<TestResultProps> = ({ scores, onRestart }) => {
  // Calculate aggregated stats
  const totalScore = scores.reduce((acc, section) => {
    const sectionAvg = section.items.reduce((s, item) => s + item.score, 0) / (section.items.length || 1);
    return acc + sectionAvg;
  }, 0) / (scores.length || 1);

  const radarData = [
    { subject: 'Pronunciation', A: scores.reduce((acc, s) => acc + (s.items.reduce((i, x) => i + x.pronunciation, 0) / s.items.length), 0) / scores.length, fullMark: 10 },
    { subject: 'Fluency', A: scores.reduce((acc, s) => acc + (s.items.reduce((i, x) => i + x.fluency, 0) / s.items.length), 0) / scores.length, fullMark: 10 },
    { subject: 'Accuracy', A: scores.reduce((acc, s) => acc + (s.items.reduce((i, x) => i + x.accuracy, 0) / s.items.length), 0) / scores.length, fullMark: 10 },
  ];

  const getSectionTitle = (type: TestSectionType) => {
    switch (type) {
        case TestSectionType.ReadingAloud: return "Reading Aloud";
        case TestSectionType.RepeatSentence: return "Repeating Sentences";
        case TestSectionType.QuestionAnswer: return "Q & A";
        case TestSectionType.FreeSpeech: return "Free Speech";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">Test Complete</h2>
        <p className="text-slate-500">Here is your comprehensive performance report.</p>
        <div className="inline-block p-6 rounded-full bg-blue-50 border-4 border-blue-100 mt-4">
           <span className="text-5xl font-bold text-blue-600">{totalScore.toFixed(1)}</span>
           <span className="text-xl text-blue-400 font-medium">/10</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h3 className="text-lg font-semibold mb-4">Skill Breakdown</h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                 <PolarGrid />
                 <PolarAngleAxis dataKey="subject" />
                 <PolarRadiusAxis angle={30} domain={[0, 10]} />
                 <Radar name="Student" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.6} />
                 <Tooltip />
               </RadarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 overflow-y-auto max-h-[400px]">
           <h3 className="text-lg font-semibold mb-4">Detailed Feedback</h3>
           <div className="space-y-4">
             {scores.map((section, idx) => (
               <div key={idx} className="border-b border-slate-100 last:border-0 pb-4">
                 <h4 className="font-medium text-slate-800">{getSectionTitle(section.sectionType)}</h4>
                 <div className="mt-2 space-y-3">
                   {section.items.map((item, i) => (
                     <div key={i} className="text-sm bg-slate-50 p-3 rounded-md">
                       <div className="flex justify-between mb-1">
                          <span className="font-semibold text-slate-600">Item {i + 1}</span>
                          <span className="font-bold text-blue-600">{item.score.toFixed(1)}</span>
                       </div>
                       <p className="text-slate-500 italic mb-2">"{item.transcription}"</p>
                       <p className="text-slate-700">{item.feedback}</p>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <button 
          onClick={onRestart}
          className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition transform hover:-translate-y-1"
        >
          Take Another Test
        </button>
      </div>
    </div>
  );
};

export default TestResult;