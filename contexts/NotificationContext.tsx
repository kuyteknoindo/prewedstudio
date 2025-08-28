import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { Toast, ModalOptions } from '../types';
import ToastContainer from '../components/common/Toast';
import Modal from '../components/common/Modal';

interface NotificationContextType {
    addToast: (toast: Omit<Toast, 'id'>) => void;
    showModal: (options: ModalOptions) => void;
    hideModal: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [modalOptions, setModalOptions] = useState<ModalOptions | null>(null);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, ...toast }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showModal = useCallback((options: ModalOptions) => {
        setModalOptions(options);
    }, []);

    const hideModal = useCallback(() => {
        if (modalOptions?.onClose) {
            modalOptions.onClose();
        }
        setModalOptions(null);
    }, [modalOptions]);

    return (
        <NotificationContext.Provider value={{ addToast, showModal, hideModal }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            {modalOptions && <Modal options={modalOptions} onClose={hideModal} />}
        </NotificationContext.Provider>
    );
};

export const useNotification = (): NotificationContextType => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};