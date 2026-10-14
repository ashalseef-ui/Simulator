import React from 'react';

interface WireCraftLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const WireCraftLogo: React.FC<WireCraftLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
}) => {
  const sizeMap = {
    xs: { icon: 20, width: showText ? 90 : 20, height: showText ? 24 : 20 },
    sm: { icon: 26, width: showText ? 120 : 26, height: showText ? 30 : 26 },
    md: { icon: 34, width: showText ? 150 : 34, height: showText ? 42 : 34 },
    lg: { icon: 54, width: showText ? 220 : 54, height: showText ? 68 : 54 },
    xl: { icon: 96, width: showText ? 280 : 96, height: showText ? 130 : 96 },
  };

  const dims = sizeMap[size];

  if (!showText) {
    return (
      <svg
        width={dims.icon}
        height={dims.icon}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 select-none ${className}`}
      >
        <defs>
          <linearGradient id="wc-border-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2fe" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="wc-node-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <filter id="wc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Dark Background plate */}
        <rect x="18" y="18" width="164" height="164" rx="10" fill="#050814" />

        {/* Outer Square Gradient Frame */}
        <rect
          x="18"
          y="18"
          width="164"
          height="164"
          rx="10"
          stroke="url(#wc-border-grad)"
          strokeWidth="6"
        />

        {/* Inner geometric circuit traces */}
        {/* Cardinal Axis Lines */}
        <line x1="100" y1="84" x2="100" y2="40" stroke="url(#wc-border-grad)" strokeWidth="3.5" />
        <line x1="100" y1="116" x2="100" y2="160" stroke="url(#wc-border-grad)" strokeWidth="3.5" />
        <line x1="84" y1="100" x2="40" y2="100" stroke="url(#wc-border-grad)" strokeWidth="3.5" />
        <line x1="116" y1="100" x2="160" y2="100" stroke="url(#wc-border-grad)" strokeWidth="3.5" />

        {/* Diagonal Ray Lines */}
        <line x1="88" y1="88" x2="52" y2="52" stroke="url(#wc-border-grad)" strokeWidth="3" />
        <line x1="112" y1="88" x2="148" y2="52" stroke="url(#wc-border-grad)" strokeWidth="3" />
        <line x1="88" y1="112" x2="52" y2="148" stroke="url(#wc-border-grad)" strokeWidth="3" />
        <line x1="112" y1="112" x2="148" y2="148" stroke="url(#wc-border-grad)" strokeWidth="3" />

        {/* Circuit Symmetrical Corner Dogleg Traces */}
        {/* Top Left */}
        <path d="M 68 34 L 80 50 L 80 82" stroke="url(#wc-border-grad)" strokeWidth="2.5" fill="none" opacity="0.9" />
        <path d="M 34 68 L 50 80 L 82 80" stroke="url(#wc-border-grad)" strokeWidth="2.5" fill="none" opacity="0.9" />

        {/* Top Right */}
        <path d="M 132 34 L 120 50 L 120 82" stroke="url(#wc-border-grad)" strokeWidth="2.5" fill="none" opacity="0.9" />
        <path d="M 166 68 L 150 80 L 118 80" stroke="url(#wc-border-grad)" strokeWidth="2.5" fill="none" opacity="0.9" />

        {/* Bottom Left */}
        <path d="M 68 166 L 80 150 L 80 118" stroke="url(#wc-border-grad)" strokeWidth="2.5" fill="none" opacity="0.9" />
        <path d="M 34 132 L 50 120 L 82 120" stroke="url(#wc-border-grad)" strokeWidth="2.5" fill="none" opacity="0.9" />

        {/* Bottom Right */}
        <path d="M 132 166 L 120 150 L 120 118" stroke="url(#wc-border-grad)" strokeWidth="2.5" fill="none" opacity="0.9" />
        <path d="M 166 132 L 150 120 L 118 120" stroke="url(#wc-border-grad)" strokeWidth="2.5" fill="none" opacity="0.9" />

        {/* 4 Cardinal Nodes */}
        <circle cx="100" cy="36" r="7.5" fill="#00f2fe" filter="url(#wc-glow)" />
        <circle cx="100" cy="164" r="7.5" fill="#6366f1" filter="url(#wc-glow)" />
        <circle cx="36" cy="100" r="7.5" fill="#00f2fe" filter="url(#wc-glow)" />
        <circle cx="164" cy="100" r="7.5" fill="#6366f1" filter="url(#wc-glow)" />

        {/* 4 Diagonal Corner Nodes */}
        <circle cx="48" cy="48" r="6" stroke="#38bdf8" strokeWidth="2" fill="#070d1e" />
        <circle cx="152" cy="48" r="6" stroke="#38bdf8" strokeWidth="2" fill="#070d1e" />
        <circle cx="48" cy="152" r="6" stroke="#818cf8" strokeWidth="2" fill="#070d1e" />
        <circle cx="152" cy="152" r="6" stroke="#818cf8" strokeWidth="2" fill="#070d1e" />

        {/* Center Node (Core Switch/Router Fabric) */}
        <circle cx="100" cy="100" r="16" fill="#070d1e" stroke="url(#wc-border-grad)" strokeWidth="3" />
        <circle cx="100" cy="100" r="7" fill="url(#wc-border-grad)" filter="url(#wc-glow)" />
      </svg>
    );
  }

  // Full Mode with Symbol and "WIRECRAFT" Typography matching the brand asset
  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <svg
        width={dims.icon}
        height={dims.icon}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="wc-border-grad-full" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2fe" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <filter id="wc-glow-full" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Dark Background plate */}
        <rect x="18" y="18" width="164" height="164" rx="10" fill="#050814" />

        {/* Outer Square Gradient Frame */}
        <rect
          x="18"
          y="18"
          width="164"
          height="164"
          rx="10"
          stroke="url(#wc-border-grad-full)"
          strokeWidth="6"
        />

        {/* Inner geometric circuit traces */}
        <line x1="100" y1="84" x2="100" y2="40" stroke="url(#wc-border-grad-full)" strokeWidth="3.5" />
        <line x1="100" y1="116" x2="100" y2="160" stroke="url(#wc-border-grad-full)" strokeWidth="3.5" />
        <line x1="84" y1="100" x2="40" y2="100" stroke="url(#wc-border-grad-full)" strokeWidth="3.5" />
        <line x1="116" y1="100" x2="160" y2="100" stroke="url(#wc-border-grad-full)" strokeWidth="3.5" />

        <line x1="88" y1="88" x2="52" y2="52" stroke="url(#wc-border-grad-full)" strokeWidth="3" />
        <line x1="112" y1="88" x2="148" y2="52" stroke="url(#wc-border-grad-full)" strokeWidth="3" />
        <line x1="88" y1="112" x2="52" y2="148" stroke="url(#wc-border-grad-full)" strokeWidth="3" />
        <line x1="112" y1="112" x2="148" y2="148" stroke="url(#wc-border-grad-full)" strokeWidth="3" />

        {/* Circuit Symmetrical Corner Dogleg Traces */}
        <path d="M 68 34 L 80 50 L 80 82" stroke="url(#wc-border-grad-full)" strokeWidth="2.5" fill="none" opacity="0.9" />
        <path d="M 34 68 L 50 80 L 82 80" stroke="url(#wc-border-grad-full)" strokeWidth="2.5" fill="none" opacity="0.9" />

        <path d="M 132 34 L 120 50 L 120 82" stroke="url(#wc-border-grad-full)" strokeWidth="2.5" fill="none" opacity="0.9" />
        <path d="M 166 68 L 150 80 L 118 80" stroke="url(#wc-border-grad-full)" strokeWidth="2.5" fill="none" opacity="0.9" />

        <path d="M 68 166 L 80 150 L 80 118" stroke="url(#wc-border-grad-full)" strokeWidth="2.5" fill="none" opacity="0.9" />
        <path d="M 34 132 L 50 120 L 82 120" stroke="url(#wc-border-grad-full)" strokeWidth="2.5" fill="none" opacity="0.9" />

        <path d="M 132 166 L 120 150 L 120 118" stroke="url(#wc-border-grad-full)" strokeWidth="2.5" fill="none" opacity="0.9" />
        <path d="M 166 132 L 150 120 L 118 120" stroke="url(#wc-border-grad-full)" strokeWidth="2.5" fill="none" opacity="0.9" />

        {/* 4 Cardinal Nodes */}
        <circle cx="100" cy="36" r="7.5" fill="#00f2fe" filter="url(#wc-glow-full)" />
        <circle cx="100" cy="164" r="7.5" fill="#6366f1" filter="url(#wc-glow-full)" />
        <circle cx="36" cy="100" r="7.5" fill="#00f2fe" filter="url(#wc-glow-full)" />
        <circle cx="164" cy="100" r="7.5" fill="#6366f1" filter="url(#wc-glow-full)" />

        {/* 4 Diagonal Corner Nodes */}
        <circle cx="48" cy="48" r="6" stroke="#38bdf8" strokeWidth="2" fill="#070d1e" />
        <circle cx="152" cy="48" r="6" stroke="#38bdf8" strokeWidth="2" fill="#070d1e" />
        <circle cx="48" cy="152" r="6" stroke="#818cf8" strokeWidth="2" fill="#070d1e" />
        <circle cx="152" cy="152" r="6" stroke="#818cf8" strokeWidth="2" fill="#070d1e" />

        {/* Center Node */}
        <circle cx="100" cy="100" r="16" fill="#070d1e" stroke="url(#wc-border-grad-full)" strokeWidth="3" />
        <circle cx="100" cy="100" r="7" fill="url(#wc-border-grad-full)" filter="url(#wc-glow-full)" />
      </svg>

      {/* Styled Brand Wordmark */}
      <span className="mt-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 font-extrabold tracking-[0.25em] text-center uppercase font-mono">
        WIRECRAFT
      </span>
    </div>
  );
};
