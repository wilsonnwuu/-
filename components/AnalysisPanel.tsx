
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CalculationResult, AnalysisStatus } from '../types';
import { Loader2, AlertTriangle, CheckCircle, XCircle, BrainCircuit, Ruler, Calculator, Activity, Table } from 'lucide-react';

interface AnalysisPanelProps {
  results: CalculationResult;
  aiResponse: string | null;
  status: AnalysisStatus;
  onAnalyze: () => void;
}

const SafetyBadge = ({ label, value, threshold, type = 'min' }: { label: string, value: number, threshold: number, type?: 'min' | 'max' }) => {
  const isSafe = type === 'min' ? value >= threshold : value <= threshold;
  return (
    <div className={`flex flex-col p-3 rounded-lg border ${isSafe ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
      <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{label}</span>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold font-mono ${isSafe ? 'text-emerald-700' : 'text-red-700'}`}>
          {value > 100 && type === 'min' ? '>100' : value.toFixed(2)}
        </span>
        <span className="text-xs text-slate-400 mb-1">{type === 'min' ? '>' : '<'} {threshold}</span>
      </div>
      <div className="flex items-center gap-1 mt-2">
        {isSafe ? <CheckCircle className="w-4 h-4 text-emerald-500"/> : <XCircle className="w-4 h-4 text-red-500"/>}
        <span className={`text-xs font-medium ${isSafe ? 'text-emerald-600' : 'text-red-600'}`}>
          {isSafe ? 'Safe' : 'Unsafe'}
        </span>
      </div>
    </div>
  );
};

const BearingBadge = ({ qMax, qAll, e, B }: { qMax: number, qAll: number, e: number, B: number }) => {
    const isBearingSafe = qMax <= qAll;
    const isEccentricitySafe = Math.abs(e) <= B/6;
    
    return (
        <div className="flex flex-col p-3 rounded-lg border bg-slate-50 border-slate-200 col-span-2 lg:col-span-1">
             <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Bearing & Eccentricity</span>
             <div className="flex flex-col gap-1 mt-1">
                 <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-600">q_max: {qMax.toFixed(0)} kPa</span>
                     <span className={`${isBearingSafe ? 'text-emerald-600' : 'text-red-600'} text-xs font-bold`}>
                        {isBearingSafe ? '≤' : '>'} {qAll.toFixed(0)}
                     </span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-600">e: {e.toFixed(2)} m</span>
                     <span className={`${isEccentricitySafe ? 'text-emerald-600' : 'text-red-600'} text-xs font-bold`}>
                        {Math.abs(e) <= B/6 ? '≤' : '>'} {(B/6).toFixed(2)} (B/6)
                     </span>
                 </div>
             </div>
             <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-200">
                {(isBearingSafe && isEccentricitySafe) ? <CheckCircle className="w-4 h-4 text-emerald-500"/> : <XCircle className="w-4 h-4 text-red-500"/>}
                <span className={`text-xs font-medium ${(isBearingSafe && isEccentricitySafe) ? 'text-emerald-600' : 'text-red-600'}`}>
                  {(isBearingSafe && isEccentricitySafe) ? 'Foundation OK' : 'Check Foundation'}
                </span>
             </div>
        </div>
    );
};

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ results, aiResponse, status, onAnalyze }) => {
    // Determine B from calculation if available implicitly or passed? 
    // We can infer B/6 limit from the results object if we pass B. 
    // Actually results.details has B/6 implicit in formulas, but easier to pass B check.
    // Let's rely on stored result flags or deduce.
    // Since we don't pass 'dims' here, we can infer B roughly from "Allowable (q_all)" vs "q_max".
    // Actually, calculateStability computes e and checks it.
    // Let's assume B/6 threshold is visible in e comparison.
    // We need B for display "e <= 0.XX".
    // Let's parse it from results details or calculate backwards? 
    // Easier: Just display the values.
    
    // Find allowable bearing from details to display limit
    const qAllRow = results.details.find(d => d.item === 'Allowable (q_all)');
    const qAll = qAllRow ? parseFloat(qAllRow.value) : 200;
    
    // Find B for eccentricity display
    // e = B/2 - x_bar => B/2 = e + x_bar => B = 2(e + x_bar)
    const xBarRow = results.details.find(d => d.item === 'Resultant Loc (x̄)');
    const xBar = xBarRow ? parseFloat(xBarRow.value) : 0;
    const B_est = 2 * (results.eccentricity + xBar);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-indigo-500" />
          工程分析與設計 (Analysis)
        </h2>
        <button
          onClick={onAnalyze}
          disabled={status === AnalysisStatus.LOADING}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {status === AnalysisStatus.LOADING ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <BrainCircuit className="w-4 h-4" />
          )}
          {status === AnalysisStatus.LOADING ? '設計運算中...' : '生成最佳設計方案'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <SafetyBadge label="FS Overturning" value={results.fsOverturning} threshold={2.0} />
          <SafetyBadge label="FS Sliding" value={results.fsSliding} threshold={1.5} />
          <BearingBadge qMax={results.qMax} qAll={qAll} e={results.eccentricity} B={B_est} />
        </div>

        {/* AI Output Section */}
        {status === AnalysisStatus.ERROR && (
           <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 border border-red-100">
             <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
             <div>
               <p className="font-medium">分析失敗</p>
               <p className="text-sm">無法連接至 AI 設計引擎，請檢查網路或 API Key。</p>
             </div>
           </div>
        )}

        {aiResponse && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-indigo-100 p-1 rounded-md">
                <BrainCircuit className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-slate-800">AI 大地工程師設計建議</h3>
            </div>
            <div className="prose prose-slate prose-sm max-w-none bg-white p-5 rounded-xl border border-indigo-100 shadow-sm ring-4 ring-indigo-50/50">
               <ReactMarkdown>{aiResponse}</ReactMarkdown>
            </div>
          </div>
        )}
        
        {/* Detailed Calculation Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                <Table className="w-4 h-4 text-slate-500" />
                <h3 className="font-semibold text-sm text-slate-700">Detailed Calculation Steps</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-4 py-2 w-1/4">Item</th>
                            <th className="px-4 py-2 w-1/3">Formula / Method</th>
                            <th className="px-4 py-2 text-right">Value</th>
                            <th className="px-4 py-2 text-slate-400 w-16">Unit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {results.details.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-700">{row.item}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.formula}</td>
                                <td className="px-4 py-3 text-right font-mono text-indigo-600 font-medium">
                                  {row.value}
                                  {/* Add tons conversion if unit is kN or kN-m or kN/m */}
                                  {(row.unit === 'kN' || row.unit === 'kN/m' || row.unit === 'kN-m/m') && (
                                    <span className="block text-xs text-slate-400">
                                      ({(parseFloat(row.value) / 9.81).toFixed(2)} {row.unit.replace('kN', 't')})
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-400 text-xs">{row.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

      </div>
    </div>
  );
};

export default AnalysisPanel;
