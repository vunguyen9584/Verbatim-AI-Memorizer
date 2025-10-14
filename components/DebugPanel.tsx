
import React, { useState, useEffect } from 'react';
import { logger } from '../utils/debugLogger';
import { XCircleIcon } from './common/Icon';
import Button from './common/Button';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState(logger.getLogs());

  useEffect(() => {
    if (isOpen) {
        setLogs(logger.getLogs()); // Sync logs when opening
    }
    const unsubscribe = logger.subscribe(setLogs);
    return () => unsubscribe();
  }, [isOpen]);

  const handleClearLogs = () => {
    logger.clear();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[600px] max-w-[90vw] h-[400px] max-h-[60vh] bg-gray-900/80 backdrop-blur-md border border-teal-500/30 rounded-lg shadow-2xl z-50 flex flex-col animate-fade-in-up">
      <header className="flex items-center justify-between p-3 border-b border-gray-700 flex-shrink-0">
        <h3 className="font-bold text-teal-400">AI Debug Panel</h3>
        <div className="flex items-center gap-2">
            <Button onClick={handleClearLogs} variant="ghost" className="px-2 py-1 text-xs">Clear</Button>
            <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close Debug Panel">
                <XCircleIcon className="w-6 h-6" />
            </button>
        </div>
      </header>
      <div className="flex-grow p-3 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-gray-500 text-center mt-4">No logs yet. Interact with the app to see AI calls.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {logs.slice().reverse().map((log, index) => (
              <li key={index} className="bg-gray-800/50 p-2 rounded-md border border-gray-700">
                <div className="flex justify-between items-center text-gray-400 mb-1">
                  <span className="font-semibold text-teal-300">{log.type}</span>
                  <span className="text-xs">{log.timestamp.toLocaleTimeString()}</span>
                </div>
                <pre className="whitespace-pre-wrap break-all text-gray-200 bg-black/20 p-2 rounded text-xs max-h-48 overflow-auto">
                  <code>{JSON.stringify(log.payload, null, 2)}</code>
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;

