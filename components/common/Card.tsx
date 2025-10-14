
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-gray-700/50 ${className}`}>
      {children}
    </div>
  );
};

export default Card;
