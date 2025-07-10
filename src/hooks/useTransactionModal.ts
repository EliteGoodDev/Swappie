import { useState, useCallback } from 'react';

export type TransactionStatus = 'pending' | 'success' | 'error';

export interface TransactionModalState {
  isOpen: boolean;
  status: TransactionStatus;
  hash?: string;
  message?: string;
}

export const useTransactionModal = () => {
  const [modalState, setModalState] = useState<TransactionModalState>({
    isOpen: false,
    status: 'pending'
  });

  const showPending = useCallback((message?: string) => {
    setModalState({
      isOpen: true,
      status: 'pending',
      message
    });
  }, []);

  const showSuccess = useCallback((hash?: string, message?: string) => {
    setModalState({
      isOpen: true,
      status: 'success',
      hash,
      message
    });
  }, []);

  const showError = useCallback((message?: string) => {
    setModalState({
      isOpen: true,
      status: 'error',
      message
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return {
    modalState,
    showPending,
    showSuccess,
    showError,
    closeModal
  };
}; 