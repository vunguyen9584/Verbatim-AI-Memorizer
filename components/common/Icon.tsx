
import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {}

export const BrainCircuitIcon: React.FC<IconProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 5a3 3 0 1 0-5.993 1.003c.005.02.01.04.015.06.132.555.285 1.12.455 1.684A6.995 6.995 0 0 0 12 15a6.995 6.995 0 0 0 5.522-2.253c.17-.564.323-1.13.455-1.684.005-.02.01-.04.015-.06A3 3 0 1 0 12 5Z" />
    <path d="M12 15v1" />
    <path d="M12 20v1" />
    <path d="M15 13.3a6.983 6.983 0 0 1-1.588 3.21" />
    <path d="M9 13.3a6.983 6.983 0 0 0 1.588 3.21" />
    <path d="M5 10.3a6.98 6.98 0 0 1 2.383-3.49" />
    <path d="M19 10.3a6.98 6.98 0 0 0-2.383-3.49" />
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

export const XCircleIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
);

export const LightbulbIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
    </svg>
);

export const BugIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14 12a2 2 0 1 0-4 0"/>
        <path d="M12 17.5a3.5 3.5 0 0 0 3.5-3.5h-7a3.5 3.5 0 0 0 3.5 3.5Z"/>
        <path d="M12 21a6.5 6.5 0 0 0 6.5-6.5H5.5A6.5 6.5 0 0 0 12 21Z"/>
        <path d="M12 3v1"/>
        <path d="m16.5 4.2-1 1.7"/>
        <path d="m7.5 4.2 1 1.7"/>
        <path d="M6 8h-3"/>
        <path d="M18 8h3"/>
    </svg>
);
