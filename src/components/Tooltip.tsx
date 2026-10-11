import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [show, setShow] = useState(false);

  return (
    <div 
      className="relative flex items-center justify-center" 
      onMouseEnter={() => setShow(true)} 
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute top-full mt-1.5 z-[1000] px-2.5 py-1 bg-slate-950 text-white text-[10px] font-bold rounded-lg border border-slate-700 shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          {content}
        </div>
      )}
    </div>
  );
};
