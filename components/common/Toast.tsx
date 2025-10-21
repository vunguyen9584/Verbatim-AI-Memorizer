import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ToastMessage } from '../../types';
import { CheckCircleIcon, XCircleIcon, XIcon } from './Icon';

interface ToastContextType {
  showToast: (message: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString();
    const newToast: ToastMessage = {
      ...message,
      id,
      duration: message.duration ?? (message.persistent ? 0 : 5000)
    };

    setToasts(prev => [...prev, newToast]);

    if (!message.persistent && newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const { t } = useTranslation();

  const bgColor = toast.type === 'success' ? 'bg-green-900/90' : 'bg-red-900/90';
  const borderColor = toast.type === 'success' ? 'border-green-500' : 'border-red-500';
  const Icon = toast.type === 'success' ? CheckCircleIcon : XCircleIcon;

  return (
    <div
      className={`
        ${bgColor} ${borderColor}
        border rounded-lg p-4 shadow-lg text-white
        flex items-start gap-3 min-w-[300px] max-w-md
        animate-fade-in-up
      `}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-grow">
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 ml-2 text-gray-300 hover:text-white transition-colors"
        aria-label={t('toast.close')}
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
};