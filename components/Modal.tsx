import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl'
};

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-warm-gray-900 bg-opacity-75 transition-opacity z-50 flex items-center justify-center p-4"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`relative transform overflow-hidden rounded-lg bg-ivory dark:bg-warm-gray-800 text-left shadow-2xl transition-all sm:my-8 sm:w-full ${sizeClasses[size]} border border-gold-400/20`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-ivory dark:bg-warm-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start w-full">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-2xl font-display font-bold leading-6 text-warm-gray-900 dark:text-gold-100" id="modal-title">
                {title}
              </h3>
            </div>
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-warm-gray-400 hover:text-warm-gray-600 dark:hover:text-warm-gray-200"
            >
                <X size={24} />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Modal;