import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Download,
  Image as ImageIcon,
  Edit3,
  Wand2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface AiDiagramModalProps {
  onClose: () => void;
}

export const AiDiagramModal: React.FC<AiDiagramModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');

  // Generation State (gemini-3-pro-image-preview)
  const [prompt, setPrompt] = useState(
    'Cisco Enterprise 3-Tier Campus Network with Core 3650 Switches, Distribution Layer, and Access Switches with 802.1Q Trunks'
  );
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1'>('16:9');

  // Edit State (gemini-3.1-flash-image-preview)
  const [editPrompt, setEditPrompt] = useState(
    'Highlight the redundant links in bright emerald green and add a DMZ perimeter firewall zone'
  );

  // Results State
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const presetPrompts = [
    'Cisco Enterprise Data Center Spine-Leaf Fabric with Nexus switches and redundant 100G uplinks',
    'High-Availability Campus LAN with Dual Cisco 3650 Core Switches, SVIs, and Spanning Tree loop-free topology',
    'Cisco ASA 5506-X Perimeter Security Architecture with DMZ Web Server and Inside LAN',
    'Router-on-a-stick Inter-VLAN routing diagram with 802.1Q subinterfaces and Cisco 2960 switch',
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/ai/generate-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          imageSize,
          aspectRatio,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate diagram image');
      }

      setCurrentImage(data.imageUrl);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with Gemini model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editPrompt.trim()) return;
    if (!currentImage) {
      setErrorMessage('Please generate or provide an initial diagram first before editing.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/ai/edit-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: editPrompt,
          base64Image: currentImage,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to edit diagram');
      }

      if (data.imageUrl) {
        setCurrentImage(data.imageUrl);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with Gemini model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!currentImage) return;
    const a = document.createElement('a');
    a.href = currentImage;
    a.download = `netcraft-diagram-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[88vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                AI Network Diagram & Topology Studio
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  Gemini 3 Pro & 3.1 Flash Image
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Generate high-resolution Cisco architecture schematics (1K, 2K, 4K) & edit with natural language
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('generate')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
                  activeTab === 'generate'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                Generate (3 Pro)
              </button>
              <button
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
                  activeTab === 'edit'
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit (3.1 Flash)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body: Split View (Controls Left, Image Preview Right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Controls Panel */}
          <div className="w-88 border-r border-slate-800 bg-slate-950/70 p-5 overflow-y-auto space-y-4 custom-scrollbar text-xs">
            {activeTab === 'generate' ? (
              <>
                {/* Image Size Affordance (1K, 2K, 4K) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Resolution Size
                    </label>
                    <span className="text-[10px] text-sky-400 font-mono font-bold">
                      gemini-3-pro-image-preview
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['1K', '2K', '4K'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setImageSize(size)}
                        className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                          imageSize === size
                            ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['16:9', '4:3', '1:1'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                          aspectRatio === ratio
                            ? 'bg-slate-800 text-sky-400 border-sky-500/60 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Prompt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Diagram Prompt
                  </label>
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your Cisco network topology architecture..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-sky-400 custom-scrollbar"
                  />
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block">
                    Inspiration Presets
                  </span>
                  <div className="space-y-1.5">
                    {presetPrompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPrompt(p)}
                        className="w-full text-left p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-600 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Action Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !prompt.trim()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Rendering High-Quality {imageSize}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate {imageSize} Diagram
                    </>
                  )}
                </button>
              </>
            ) : (
              /* EDIT MODE (gemini-3.1-flash-image-preview) */
              <>
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-300 space-y-1">
                  <span className="font-bold text-xs block">
                    Interactive Image Editing
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    Powered by <code className="font-mono text-white">gemini-3.1-flash-image-preview</code>. Prompt modifications to adjust colors, add equipment, or enhance topology annotations.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Edit Instructions
                  </label>
                  <textarea
                    rows={4}
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="e.g. Add a red dashed firewall perimeter around the DMZ servers..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-indigo-400 custom-scrollbar"
                  />
                </div>

                <button
                  onClick={handleEdit}
                  disabled={isLoading || !editPrompt.trim() || !currentImage}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Applying AI Edits...
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-4 h-4" />
                      Apply AI Diagram Edits
                    </>
                  )}
                </button>
              </>
            )}

            {/* Error Message if any */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="text-[11px]">{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Right Preview Viewport */}
          <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {currentImage ? (
              <div className="relative max-w-full max-h-full flex flex-col items-center group">
                <img
                  src={currentImage}
                  alt="Generated Cisco Topology Diagram"
                  className="max-h-[62vh] max-w-full object-contain rounded-xl border border-slate-800 shadow-2xl"
                />

                {/* Floating Image Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download Full PNG
                  </button>
                  <button
                    onClick={() => setActiveTab('edit')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit with Gemini 3.1 Flash
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-3 max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <div className="text-sm font-bold text-slate-300">
                  No Diagram Generated Yet
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Select your desired resolution (1K, 2K, or 4K), enter your architectural description, and generate production-ready Cisco network diagrams.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
