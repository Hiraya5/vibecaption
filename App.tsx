
import React, { useState, useRef, useEffect } from 'react';
import { generateCaptions } from './services/geminiService';
import { ImageAnalysis, CaptionResults } from './types';
import { UploadIcon, LoaderIcon, HistoryIcon, CameraIcon, ShareIcon, VibeCaptionLogo, TrashIcon } from './components/Icons';
import CaptionItem from './components/CaptionItem';

const LOADING_MESSAGES = [
  "Neural network initializing...",
  "Scanning visual architecture...",
  "Extracting semantic features...",
  "Interpreting lighting & color...",
  "Analyzing spatial relationships...",
  "Synthesizing creative vibe...",
  "Generating multi-length options..."
];

const App: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CaptionResults | null>(null);
  const [history, setHistory] = useState<ImageAnalysis[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('vibecaption_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('vibecaption_history', JSON.stringify(history.slice(0, 15)));
  }, [history]);

  useEffect(() => {
    let msgInterval: any;
    let progressInterval: any;
    if (isLoading) {
      msgInterval = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 1500);
      
      // Simulate realistic progress
      setLoadingProgress(0);
      progressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 95) return prev;
          const inc = Math.random() * 5;
          return Math.min(prev + inc, 95);
        });
      }, 400);
    } else {
      setLoadingMsgIndex(0);
      setLoadingProgress(0);
    }
    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError("Please upload an image file.");
      return;
    }
    setError(null);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setSelectedImage(base64);
      analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setError("Unable to access camera. Please check permissions.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        setSelectedImage(base64);
        stopCamera();
        analyzeImage(base64);
      }
    }
  };

  const analyzeImage = async (base64: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const captions = await generateCaptions(base64);
      setResults(captions);
      const newEntry: ImageAnalysis = {
        id: Date.now().toString(),
        imageData: base64,
        captions,
        timestamp: Date.now(),
      };
      setHistory(prev => [newEntry, ...prev]);
    } catch (err: any) {
      setError(err.message || "Something went wrong during analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setSelectedImage(null);
    setResults(null);
    setError(null);
    setIsCameraActive(false);
    setShareStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectFromHistory = (item: ImageAnalysis) => {
    setSelectedImage(item.imageData);
    setResults(item.captions);
    setError(null);
    setIsCameraActive(false);
    setShareStatus('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteFromHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Remove this scan from history?")) {
      setHistory(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleUpdateCaption = (type: keyof CaptionResults, newText: string) => {
    if (!results) return;
    const updatedResults = { ...results, [type]: newText };
    setResults(updatedResults);
    setHistory(prev => prev.map(item => 
      item.imageData === selectedImage 
        ? { ...item, captions: updatedResults } 
        : item
    ));
  };

  const handleShare = async () => {
    if (!results) return;
    const textToShare = `AI Captions by VibeCaption:\n\n🔥 ${results.short}\n\n📝 ${results.medium}\n\n♿ ${results.detailed}`;
    try {
      await navigator.clipboard.writeText(textToShare);
      if (navigator.share) {
        await navigator.share({
          title: 'VibeCaption AI',
          text: textToShare,
        }).catch(() => {});
      }
      setShareStatus('success');
    } catch (err) {
      setShareStatus('error');
    } finally {
      setTimeout(() => setShareStatus('idle'), 2500);
    }
  };

  return (
    <div className="min-h-screen pb-12 overflow-x-hidden selection:bg-cyan-500/30">
      <canvas ref={canvasRef} className="hidden" />

      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer" onClick={reset}>
            <VibeCaptionLogo className="w-9 h-9 sm:w-11 sm:h-11 transition-transform group-hover:scale-105" />
            <div className="flex flex-col -space-y-1">
              <div className="flex items-baseline">
                <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">Vibe</span>
                <span className="text-xl sm:text-2xl font-light text-cyan-400">Caption</span>
              </div>
              <span className="text-[7px] sm:text-[9px] font-medium text-slate-500 uppercase tracking-[0.2em] hidden xs:block">
                AI Image Caption Generators
              </span>
            </div>
          </div>
          <button onClick={reset} className="text-sm font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700">New Scan</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-6 sm:mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10 items-start">
          
          <section className="space-y-6 w-full">
            <div 
              className={`relative aspect-square w-full rounded-2xl sm:rounded-[2rem] border-2 border-dashed transition-all duration-300 overflow-hidden flex items-center justify-center group
                ${isDragging ? 'border-cyan-500 bg-cyan-500/5' : 'border-slate-700 bg-slate-800/20'}
                ${selectedImage || isCameraActive ? 'border-transparent shadow-2xl shadow-blue-500/10' : 'hover:border-slate-500'}
              `}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
            >
              {isCameraActive ? (
                <div className="relative w-full h-full bg-black">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 flex justify-center items-center gap-4 px-6">
                    <button onClick={stopCamera} className="px-5 py-2 bg-slate-900/80 backdrop-blur-md text-white rounded-full font-medium border border-slate-700 hover:bg-slate-800 transition-colors text-sm">Cancel</button>
                    <button onClick={capturePhoto} className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full border-4 border-slate-400/50 shadow-2xl flex items-center justify-center group active:scale-90 transition-transform">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full border-2 border-slate-900" />
                    </button>
                    <div className="w-14 sm:w-16 invisible" />
                  </div>
                </div>
              ) : selectedImage ? (
                <div className="relative w-full h-full bg-slate-950">
                  <img src={selectedImage} alt="Preview" className={`w-full h-full object-contain transition-all duration-700 ease-out ${isLoading ? 'blur-[8px] scale-[1.02] opacity-40 brightness-50' : 'group-hover:scale-105'}`} />
                  
                  {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8">
                      {/* Laser Scan Overlay */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_20px_#22d3ee] animate-[scan_2.5s_linear_infinite]"></div>
                      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{backgroundImage: 'linear-gradient(rgba(34,211,238,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                      
                      <div className="flex flex-col items-center">
                         <div className="relative mb-6">
                            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse"></div>
                            <LoaderIcon className="w-16 h-16 text-cyan-400 relative z-10" />
                         </div>
                         <div className="px-5 py-2.5 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-cyan-500/30 shadow-2xl">
                            <span className="text-cyan-400 font-black text-xs tracking-[0.2em] uppercase">
                               Vision Core Processing
                            </span>
                         </div>
                      </div>
                    </div>
                  )}

                  {!isLoading && (
                    <div className="absolute top-4 right-4 flex gap-2 sm:gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      <button onClick={startCamera} className="p-2.5 bg-slate-900/80 backdrop-blur-md rounded-full text-white hover:bg-slate-800 transition-all border border-slate-700 shadow-xl active:scale-90" title="Open Camera"><CameraIcon className="w-5 h-5" /></button>
                      <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-slate-900/80 backdrop-blur-md rounded-full text-white hover:bg-slate-800 transition-all border border-slate-700 shadow-xl active:scale-90" title="Upload New"><UploadIcon className="w-5 h-5" /></button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 px-6 text-center py-10 sm:py-0">
                  <div className="w-20 h-20 bg-slate-800/80 rounded-full flex items-center justify-center text-slate-400 mb-2 border border-slate-700 shadow-xl transform group-hover:scale-110 transition-transform">
                    <UploadIcon className="w-10 h-10" />
                  </div>
                  <div className="max-w-[280px] sm:max-w-none">
                    <h3 className="text-2xl font-bold text-white tracking-tight">Capture the Vibe</h3>
                    <p className="text-slate-400 mt-1 text-sm sm:text-base">Upload a photo or snap one live to begin</p>
                  </div>
                  <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3 w-full sm:w-auto">
                    <button onClick={startCamera} className="px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border border-slate-700 active:scale-95 shadow-lg group/btn">
                      <CameraIcon className="w-5 h-5 group-hover/btn:text-cyan-400 transition-colors" /> Camera
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-cyan-500/20 active:scale-95">
                      Select Image
                    </button>
                  </div>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </div>
          </section>

          <section className="space-y-6 w-full">
            {!selectedImage && !isLoading && !isCameraActive && (
              <div className="bg-slate-800/10 rounded-3xl p-6 sm:p-10 border border-slate-800/50 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] text-center group">
                <VibeCaptionLogo className="w-16 h-16 sm:w-20 sm:h-20 opacity-20 mb-6 grayscale group-hover:opacity-40 transition-all duration-700" />
                <h2 className="text-xl sm:text-2xl font-bold text-slate-300 mb-2 tracking-tight">AI Narrative Engine</h2>
                <p className="text-slate-500 max-w-xs mx-auto text-sm sm:text-base leading-relaxed">
                  Advanced multimodal analysis to capture the perfect description for any media.
                </p>
              </div>
            )}

            {isLoading && (
              <div className="bg-slate-900/40 rounded-3xl p-6 sm:p-10 border border-slate-800 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] text-center overflow-hidden relative group">
                {/* Dynamic Neural Background */}
                <div className="absolute inset-0 opacity-10">
                   <div className="absolute inset-0 animate-[pulse_4s_ease-in-out_infinite]" style={{backgroundImage: 'radial-gradient(circle at 50% 50%, #22d3ee 1px, transparent 1px)', backgroundSize: '32px 32px'}}></div>
                </div>
                
                <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
                   {/* Multistage Progress Bar */}
                   <div className="w-full h-1.5 bg-slate-800/50 rounded-full mb-10 overflow-hidden backdrop-blur-sm border border-slate-800">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-600 to-blue-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                        style={{width: `${loadingProgress}%`}}
                      ></div>
                   </div>
                   
                   <div className="h-24 flex flex-col items-center justify-center">
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-500" key={loadingMsgIndex}>
                         {LOADING_MESSAGES[loadingMsgIndex]}
                      </h2>
                      
                      <div className="flex gap-2">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className="w-2 h-2 rounded-full bg-cyan-500/40 animate-pulse" style={{animationDelay: `${i * 0.2}s`}}></div>
                        ))}
                      </div>
                   </div>
                   
                   <div className="mt-12 flex flex-col items-center gap-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500/60 flex items-center gap-3">
                         <span className="w-8 h-[1px] bg-cyan-500/20"></span>
                         Syncing with Gemini
                         <span className="w-8 h-[1px] bg-cyan-500/20"></span>
                      </div>
                      <span className="text-slate-600 text-[10px] font-bold">{Math.round(loadingProgress)}% COMPLETION</span>
                   </div>
                </div>
              </div>
            )}

            {results && !isLoading && !error && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-left-4 duration-700">
                  <div className="w-2 h-8 bg-gradient-to-b from-cyan-500 to-blue-400 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.6)]"></div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Results Generated</h2>
                </div>
                
                <div className="space-y-4">
                  <CaptionItem label="Short & Catchy" text={results.short} delay={100} onSave={(val) => handleUpdateCaption('short', val)} />
                  <CaptionItem label="Standard Description" text={results.medium} delay={250} onSave={(val) => handleUpdateCaption('medium', val)} />
                  <CaptionItem label="Accessibility Alt" text={results.detailed} delay={400} onSave={(val) => handleUpdateCaption('detailed', val)} />
                </div>

                <div className="pt-8 border-t border-slate-800 mt-8 flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both">
                  <button 
                    onClick={handleShare}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border active:scale-95 relative overflow-hidden ${
                      shareStatus === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 
                      shareStatus === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                      'bg-slate-800/50 hover:bg-slate-700 text-white border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <ShareIcon className={`w-5 h-5 ${shareStatus === 'success' ? 'text-emerald-400' : shareStatus === 'error' ? 'text-red-400' : 'text-cyan-400'}`} />
                    <span>{shareStatus === 'success' ? 'Captions Copied!' : shareStatus === 'error' ? 'Failed to Share' : 'Share Results'}</span>
                  </button>
                  <button onClick={reset} className="flex-1 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-cyan-600/30 active:scale-95">
                    <span>New Scan</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/5 rounded-3xl p-8 border border-red-500/20 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] text-center animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6 font-bold text-2xl border border-red-500/20 shadow-xl shadow-red-500/5">!</div>
                <h2 className="text-xl font-bold text-red-400 mb-2">Analysis Failed</h2>
                <p className="text-red-400/80 mb-8 text-sm max-w-xs">{error}</p>
                <button 
                  onClick={() => selectedImage && analyzeImage(selectedImage)}
                  className="px-8 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-xl font-bold transition-all border border-red-500/30 active:scale-95"
                >
                  Retry Analysis
                </button>
              </div>
            )}
          </section>
        </div>

        {history.length > 0 && (
          <section className="mt-16 sm:mt-24 pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-3"><HistoryIcon className="w-6 h-6 text-cyan-500" /> Recent History</h2>
              <button onClick={() => { if (confirm("Clear all history entries?")) { setHistory([]); localStorage.removeItem('vibecaption_history'); } }} className="text-sm font-semibold text-slate-500 hover:text-red-400 transition-colors px-4 py-2 bg-slate-800/40 rounded-xl hover:bg-slate-800 border border-slate-700/50">Clear All</button>
            </div>
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {history.map((item, index) => (
                <div 
                  key={item.id} 
                  onClick={() => selectFromHistory(item)} 
                  style={{ animationDelay: `${index * 50}ms` }} 
                  className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer bg-slate-800/20 border border-slate-800 hover:border-cyan-500/50 transition-all shadow-xl animate-in fade-in zoom-in-95 duration-500"
                >
                  <img src={item.imageData} alt="Past scan" loading="lazy" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500 grayscale-[40%] group-hover:grayscale-0 transform group-hover:scale-110" />
                  
                  <button 
                    onClick={(e) => deleteFromHistory(e, item.id)}
                    className="absolute top-2 right-2 p-2 bg-slate-900/60 backdrop-blur-md rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-all opacity-0 group-hover:opacity-100 translate-y-[-10px] group-hover:translate-y-0 active:scale-90"
                    title="Remove item"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/20 to-transparent opacity-0 sm:opacity-70 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                    <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.2em] mb-1">{new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                    <p className="text-[11px] text-white font-semibold line-clamp-2 leading-tight">{item.captions.short}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-16 border-t border-slate-800/50 pt-12 pb-16 text-center">
        <div className="max-w-xs mx-auto flex flex-col items-center">
          <VibeCaptionLogo className="w-8 h-8 mb-6 opacity-40 hover:opacity-100 transition-opacity" />
          <p className="text-slate-500 text-xs sm:text-sm font-semibold tracking-wide">VibeCaption v1.8 • Intelligent AI Narrator</p>
          <div className="mt-6 flex justify-center gap-6 text-slate-600 text-[9px] font-black uppercase tracking-[0.3em]">
            <span className="hover:text-cyan-500 transition-colors cursor-default">Gemini AI</span>
            <span className="hover:text-cyan-500 transition-colors cursor-default">Privacy Secure</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default App;
