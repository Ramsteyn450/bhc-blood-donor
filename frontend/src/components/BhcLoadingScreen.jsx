import React, { useEffect, useState } from 'react';
import BhcCrestLogo from './BhcCrestLogo';

export default function BhcLoadingScreen({ onFinished, minDuration = 1800 }) {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / minDuration) * 100));
      setProgress(pct);

      if (elapsed >= minDuration) {
        clearInterval(interval);
        setFadingOut(true);
        setTimeout(() => {
          if (onFinished) onFinished();
        }, 500); // 500ms fade transition
      }
    }, 30);

    return () => clearInterval(interval);
  }, [minDuration, onFinished]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070d1e] text-white transition-opacity duration-500 select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center max-w-sm px-6 text-center space-y-6 animate-fade-in">

        {/* Circular Golden Crest Ring matching input_file_0.png */}
        <div className="relative w-44 h-44 rounded-full flex items-center justify-center bg-[#0a1428] border-2 border-[#d4af37]/60 shadow-[0_0_35px_rgba(212,175,55,0.25)] group">
          {/* Animated Outer Golden Pulse Ring */}
          <div className="absolute inset-0 rounded-full border border-[#d4af37]/30 animate-ping opacity-25" />

          {/* Logo vector */}
          <BhcCrestLogo className="w-24 h-28 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" />
        </div>

        {/* Typography matching input_file_0.png */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-widest text-white font-serif uppercase">
            BISHOP HEBER COLLEGE
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="h-[1px] w-6 bg-[#d4af37]" />
            <span className="text-[11px] font-black tracking-[0.25em] text-[#d4af37] uppercase">
              AUTONOMOUS · TIRUCHIRAPPALLI
            </span>
            <div className="h-[1px] w-6 bg-[#d4af37]" />
          </div>
          <div className="text-xs font-bold text-slate-300 pt-1 tracking-wide">
            BHC Blood Donor Emergency Network
          </div>
        </div>

        {/* Golden Animated Progress Line matching input_file_0.png */}
        <div className="w-64 space-y-2 pt-4">
          <div className="w-full h-1.5 bg-[#162447] rounded-full overflow-hidden border border-[#d4af37]/20 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#fbbf24] rounded-full transition-all duration-75 shadow-[0_0_10px_#d4af37]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 font-mono tracking-wider">
            INITIALIZING SECURE PORTAL · {progress}%
          </div>
        </div>

      </div>
    </div>
  );
}
