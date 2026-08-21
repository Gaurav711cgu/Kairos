import React, { useState } from 'react';
import { BookOpen, Search, Sparkles, X, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';

interface SOPAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SOPAssistantModal: React.FC<SOPAssistantModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('What is the protocol for NH-10 landslide evacuation and traffic diversion?');
  const [result, setResult] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);

  const presetQuestions = [
    'What is the protocol for NH-10 landslide evacuation and traffic diversion?',
    'What are the guidelines for field officer 3-tap rapid slope verification?',
    'What is the GLOF downstream siren alert protocol for South Lhonak?',
    'What are the multilingual broadcast standards for disaster alerts?'
  ];

  async function handleSearch(qToSearch?: string) {
    const q = qToSearch || query;
    setSearching(true);
    try {
      const res = await api.querySOP(q);
      setResult(res);
    } catch (e) {
      console.warn(e);
    }
    setSearching(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tactical-900 border-2 border-telemetry-600/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 font-mono text-xs glow-cyan">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-tactical-800 pb-3">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-telemetry-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                NDMA & SDMA STANDARD OPERATING PROCEDURE (SOP) RAG ASSISTANT
              </h3>
              <p className="text-[11px] text-tactical-400">
                Contextual retrieval over official Himalayan disaster response and evacuation SOP manuals
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-tactical-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask any question on landslide SOPs, evacuation routing, or field protocols..."
            className="flex-1 p-2.5 bg-tactical-950 border border-tactical-700 rounded-lg text-slate-200 focus:outline-none focus:border-telemetry-500 text-xs"
          />
          <button
            onClick={() => handleSearch()}
            disabled={searching}
            className="px-4 py-2 bg-telemetry-600 hover:bg-telemetry-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-md"
          >
            <Search className="w-4 h-4" />
            <span>Search SOP</span>
          </button>
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-tactical-400 uppercase tracking-wider">Suggested Operational Queries:</span>
          <div className="flex flex-wrap gap-1.5">
            {presetQuestions.map((pq, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(pq);
                  handleSearch(pq);
                }}
                className="px-2.5 py-1 bg-tactical-950 hover:bg-tactical-800 border border-tactical-800 hover:border-tactical-700 text-slate-300 rounded text-[11px] text-left transition-colors"
              >
                {pq}
              </button>
            ))}
          </div>
        </div>

        {/* Search Result */}
        {result && (
          <div className="bg-tactical-950 p-4 rounded-xl border border-tactical-800 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-tactical-800/80">
              <span className="text-telemetry-400 font-bold flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {result.matched_sop_id}: {result.matched_title}
              </span>
              <span className="text-[10px] bg-telemetry-950 text-telemetry-400 px-2 py-0.5 rounded border border-telemetry-800">
                Relevance: {result.relevance_score}
              </span>
            </div>

            <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
              {result.answer_markdown}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-tactical-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-tactical-800 hover:bg-tactical-700 text-tactical-300 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
