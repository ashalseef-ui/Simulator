import React, { useState } from 'react';
import {
  X,
  Sparkles,
  HelpCircle,
  Lightbulb,
  Send,
  Loader2,
  BookOpen,
  CheckCircle,
} from 'lucide-react';

interface SocraticMentorModalProps {
  isOpen: boolean;
  onClose: () => void;
  topologyContext?: any;
}

interface ChatMessage {
  role: 'user' | 'mentor';
  reply: string;
  hints?: string[];
  time: string;
}

export const SocraticMentorModal: React.FC<SocraticMentorModalProps> = ({
  isOpen,
  onClose,
  topologyContext,
}) => {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'mentor',
      reply: 'Hello! I am your AI Socratic Troubleshooting Mentor. I am here to help you master networking by guiding you through critical thinking, packet flow analysis, and protocol behavior rather than just giving away answers. What network troubleshooting challenge are you working on today?',
      hints: ['Ask about routing, OSPF, STP, or VLANs', 'Paste an error message or ping failure'],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  if (!isOpen) return null;

  const handleAsk = async (queryText?: string) => {
    const textToSend = queryText || question;
    if (!textToSend.trim() || isAsking) return;

    const userMsg: ChatMessage = {
      role: 'user',
      reply: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setQuestion('');
    setIsAsking(true);

    try {
      const res = await fetch('/api/ai/socratic-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: textToSend,
          topologyContext,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const mentorMsg: ChatMessage = {
          role: 'mentor',
          reply: data.reply || 'Let us break this down step-by-step. What do your routing tables show?',
          hints: data.hints || [],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, mentorMsg]);
      } else {
        throw new Error(data.error || 'Failed to get mentor response');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'mentor',
          reply: 'I encountered a temporary connection issue. In the meantime, ask yourself: have you verified Layer 1 connectivity and subnet mask alignment?',
          hints: ['Check interface status', 'Verify IP and mask'],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  AI Socratic Troubleshooting Mentor
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  GUIDED LEARNING
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Master CCNA networking concepts through interactive Socratic questioning, protocol analysis, and conceptual hints
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Question Chips */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-mono text-slate-400 shrink-0">Common Labs:</span>
          {[
            'Why is ping failing between two different VLAN subnets?',
            'How do I troubleshoot OSPF neighbor stuck in ExStart state?',
            'Why is my switch port showing amber/blocked in STP?',
            'What causes an ARP request to fail across a router?',
          ].map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => handleAsk(promptText)}
              className="text-[11px] text-purple-200 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 px-3 py-1.5 rounded-lg border border-purple-500/30 shrink-0 cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <HelpCircle className="w-3 h-3 text-purple-400" />
              {promptText}
            </button>
          ))}
        </div>

        {/* Conversation Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/30">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-sky-600 text-white rounded-br-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800/80">
                  {msg.role === 'mentor' ? (
                    <div className="flex items-center gap-1.5 text-purple-400 font-bold font-mono">
                      <BookOpen className="w-3.5 h-3.5" />
                      Socratic CCIE Mentor
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sky-200 font-bold font-mono">
                      Student Engineer
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono ml-auto">{msg.time}</span>
                </div>

                <div className="whitespace-pre-wrap font-medium space-y-2">
                  {msg.reply}
                </div>

                {msg.hints && msg.hints.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" />
                      Targeted Conceptual Hints
                    </div>
                    {msg.hints.map((hint, hIdx) => (
                      <div key={hIdx} className="flex items-start gap-2 text-slate-300 text-[11px] bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                        <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{hint}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isAsking && (
            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono bg-slate-900 border border-slate-800 p-3 rounded-2xl w-fit">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              Socratic Mentor is analyzing your problem and formulating guiding questions...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-3">
          <input
            type="text"
            placeholder="Ask the Socratic Mentor a troubleshooting question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-400 transition-colors"
          />
          <button
            onClick={() => handleAsk()}
            disabled={isAsking || !question.trim()}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Ask Mentor
          </button>
        </div>
      </div>
    </div>
  );
};
