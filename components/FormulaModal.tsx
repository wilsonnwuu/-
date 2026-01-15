import React from 'react';
import { X, Calculator } from 'lucide-react';
import { FormulaData } from '../types';

interface FormulaModalProps {
  data: FormulaData | null;
  onClose: () => void;
}

const FormulaModal: React.FC<FormulaModalProps> = ({ data, onClose }) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" />
            Calculation Formula
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{data.title}</h4>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-center text-lg overflow-x-auto shadow-inner">
               {data.tex}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Explanation</h4>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {data.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormulaModal;