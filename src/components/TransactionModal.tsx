import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'pending' | 'success' | 'error';
  hash?: string;
  message?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export const TransactionModal = ({
  isOpen,
  onClose,
  status,
  hash,
  message,
  autoClose = true,
  autoCloseDelay = 10000
}: TransactionModalProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      
      // Auto close for success/error states
      if (autoClose && (status === 'success' || status === 'error')) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoCloseDelay);
        
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [isOpen, status, autoClose, autoCloseDelay]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 200); // Allow animation to complete
  };

  if (!isOpen) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: '⏳',
          title: 'Transaction Pending',
          message: message || 'Your transaction is being processed...',
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500/50',
          textColor: 'text-blue-400'
        };
      case 'success':
        return {
          icon: '✅',
          title: 'Transaction Successful',
          message: message || 'Your transaction has been completed successfully!',
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500/50',
          textColor: 'text-green-400'
        };
      case 'error':
        return {
          icon: '❌',
          title: 'Transaction Failed',
          message: message || 'Your transaction has failed. Please try again.',
          bgColor: 'bg-red-500/20',
          borderColor: 'border-red-500/50',
          textColor: 'text-red-400'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative glass border ${config.borderColor} rounded-2xl p-6 max-w-md w-full mx-4 transform transition-all duration-200 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 cursor-pointer"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="text-center">
          {/* Icon */}
          <div className={`text-4xl mb-4 ${config.textColor}`}>
            {config.icon}
          </div>

          {/* Title */}
          <h3 className={`text-xl font-semibold mb-2 ${config.textColor}`}>
            {config.title}
          </h3>

          {/* Message */}
          <p className="text-gray-300 mb-4">
            {config.message}
          </p>

          {/* Transaction Hash */}
          {hash && (
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">Transaction Hash:</p>
              <div className="glass rounded-lg p-3 break-all text-xs font-mono text-gray-300">
                {hash}
              </div>
            </div>
          )}

          {/* Action Button */}
          {status === 'error' && (
            <button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer"
            >
              Try Again
            </button>
          )}

          {status === 'success' && (
            <button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer"
            >
              Close
            </button>
          )}
        </div>

        {/* Progress bar for pending state */}
        {status === 'pending' && (
          <div className="mt-4">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full animate-pulse"></div>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Processing...</p>
          </div>
        )}
      </div>
    </div>
  );
}; 