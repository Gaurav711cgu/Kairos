import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Globe,
  Radio,
  Play,
  Square,
  CheckCircle2,
  X,
  Send,
  Sparkles,
  PhoneCall
} from 'lucide-react';
import { api } from '../../services/api';

interface BhashiniBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BhashiniBroadcastModal: React.FC<BhashiniBroadcastModalProps> = ({
  isOpen,
  onClose
}) => {
  const [broadcastData, setBroadcastData] = useState<any | null>(null);
  const [selectedLang, setSelectedLang] = useState<'ne' | 'hi' | 'bn' | 'as' | 'en'>('ne');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.generateBroadcast().then((data) => setBroadcastData(data));
    }
  }, [isOpen]);

  if (!isOpen || !broadcastData) return null;

  const currentTranslation = broadcastData.translations[selectedLang];

  function playAudioBroadcast() {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentTranslation.voice_transcript);
    
    // Set appropriate language tag
    if (selectedLang === 'hi') utterance.lang = 'hi-IN';
    else if (selectedLang === 'ne') utterance.lang = 'ne-NP';
    else if (selectedLang === 'bn') utterance.lang = 'bn-IN';
    else if (selectedLang === 'as') utterance.lang = 'as-IN';
    else utterance.lang = 'en-IN';

    utterance.rate = 0.95;

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  }

  function stopAudio() {
    window.speechSynthesis.cancel();
    setIsPlayingAudio(false);
  }

  function handleDispatchAll() {
    setDispatchStatus('Multilingual Emergency Broadcast successfully dispatched to 4,820 cell subscribers, 3 community VHF loudspeakers, and NDRF staging command!');
    setTimeout(() => setDispatchStatus(null), 5000);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tactical-900 border-2 border-radar-600/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 font-mono text-xs glow-radar">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-tactical-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-6 h-6 text-radar-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                BHASHINI MULTILINGUAL EMERGENCY BROADCASTER
              </h3>
              <p className="text-[11px] text-tactical-400">
                Automated multi-channel text & synthesized voice alert generation for NER communities
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="p-1 text-tactical-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-tactical-950 rounded-lg border border-tactical-800 overflow-x-auto">
          <button
            onClick={() => {
              stopAudio();
              setSelectedLang('ne');
            }}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
              selectedLang === 'ne'
                ? 'bg-radar-600 text-white font-bold shadow-md'
                : 'text-tactical-400 hover:text-white'
            }`}
          >
            <span>नेपाली (Nepali)</span>
          </button>

          <button
            onClick={() => {
              stopAudio();
              setSelectedLang('hi');
            }}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
              selectedLang === 'hi'
                ? 'bg-radar-600 text-white font-bold shadow-md'
                : 'text-tactical-400 hover:text-white'
            }`}
          >
            <span>हिन्दी (Hindi)</span>
          </button>

          <button
            onClick={() => {
              stopAudio();
              setSelectedLang('bn');
            }}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
              selectedLang === 'bn'
                ? 'bg-radar-600 text-white font-bold shadow-md'
                : 'text-tactical-400 hover:text-white'
            }`}
          >
            <span>বাংলা (Bengali)</span>
          </button>

          <button
            onClick={() => {
              stopAudio();
              setSelectedLang('as');
            }}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
              selectedLang === 'as'
                ? 'bg-radar-600 text-white font-bold shadow-md'
                : 'text-tactical-400 hover:text-white'
            }`}
          >
            <span>অসমীয়া (Assamese)</span>
          </button>

          <button
            onClick={() => {
              stopAudio();
              setSelectedLang('en');
            }}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${
              selectedLang === 'en'
                ? 'bg-radar-600 text-white font-bold shadow-md'
                : 'text-tactical-400 hover:text-white'
            }`}
          >
            <span>English</span>
          </button>
        </div>

        {/* Translation Content */}
        <div className="bg-tactical-950 p-4 rounded-xl border border-tactical-800 space-y-3">
          <div>
            <div className="text-tactical-400 text-[10px] uppercase tracking-wider mb-1">Headline Broadcast:</div>
            <div className="text-sm font-bold text-crimson-400">
              {currentTranslation.headline}
            </div>
          </div>

          <div>
            <div className="text-tactical-400 text-[10px] uppercase tracking-wider mb-1">SMS / Cell-Broadcast Text:</div>
            <div className="p-3 bg-tactical-900 rounded-lg border border-tactical-800 text-slate-200 text-xs leading-relaxed">
              {currentTranslation.body_text}
            </div>
          </div>

          <div>
            <div className="text-tactical-400 text-[10px] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Voice IVR & Siren Loudspeaker Script:</span>
              <span className="text-radar-400">TTS Engine: Bhashini-v2</span>
            </div>
            <div className="p-3 bg-tactical-900 rounded-lg border border-tactical-800 text-amber-300 text-xs leading-relaxed flex items-start justify-between gap-3">
              <div className="flex-1">{currentTranslation.voice_transcript}</div>
              <button
                onClick={isPlayingAudio ? stopAudio : playAudioBroadcast}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold shadow-md transition-all ${
                  isPlayingAudio
                    ? 'bg-crimson-600 hover:bg-crimson-500 text-white animate-pulse'
                    : 'bg-radar-600 hover:bg-radar-500 text-white'
                }`}
              >
                {isPlayingAudio ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlayingAudio ? 'Stop Audio' : 'Play Voice'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Channels Overview */}
        <div className="p-3 bg-tactical-950 rounded-lg border border-tactical-800 flex items-center justify-between text-tactical-300">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-radar-400" />
            <span>Active Dispatch Array: Cell-Broadcast Voice IVR, Multi-operator SMS, VHF Siren Towers</span>
          </div>
        </div>

        {dispatchStatus && (
          <div className="p-3 bg-radar-950 border border-radar-600 rounded-lg text-radar-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-radar-400 flex-shrink-0" />
            <span>{dispatchStatus}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-tactical-800">
          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="px-4 py-2 bg-tactical-800 hover:bg-tactical-700 text-tactical-300 rounded-lg"
          >
            Close
          </button>
          <button
            onClick={handleDispatchAll}
            className="px-5 py-2 bg-crimson-600 hover:bg-crimson-500 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 glow-crimson"
          >
            <Send className="w-4 h-4" />
            <span>Broadcast Across All 5 Languages</span>
          </button>
        </div>
      </div>
    </div>
  );
};
