
import React from 'react';

interface LoaderProps {
  text?: string;
}

const Loader: React.FC<LoaderProps> = ({ text = "Thinking..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mb-4"></div>
      <p className="text-teal-300 font-semibold">{text}</p>
    </div>
  );
};

export default Loader;
