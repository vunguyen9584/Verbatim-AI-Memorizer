import React, { useEffect } from 'react';
import Button from './Button';
import { XCircleIcon, TrashIcon } from './Icon';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  showIcon?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  showIcon = true,
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-5 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex items-start gap-3 text-gray-200">
          {showIcon && <TrashIcon className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />}
          <div className="text-sm leading-6">{message}</div>
        </div>

        <div className="shrink-0 p-4 sm:p-5 border-t border-gray-700 bg-gray-800">
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant="primary"
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
