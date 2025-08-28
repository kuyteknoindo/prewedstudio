import React, { useEffect, useState } from 'react';
import { Toast, ToastType } from '../../types';

interface ToastProps {
    toast: Toast;
    removeToast: (id: string) => void;
}

const getToastStyles = (type: ToastType) => {
    switch (type) {
        case 'success':
            return {
                bg: 'bg-green-50',
                border: 'border-green-200',
                text: 'text-green-800',
                icon: <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            };
        case 'error':
             return {
                bg: 'bg-red-50',
                border: 'border-red-200',
                text: 'text-red-800',
                icon: <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            };
        case 'warning':
             return {
                bg: 'bg-amber-50',
                border: 'border-amber-200',
                text: 'text-amber-800',
                icon: <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            };
        case 'info':
        default:
            return {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                text: 'text-blue-800',
                icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            };
    }
}

const ToastMessage: React.FC<ToastProps> = ({ toast, removeToast }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => removeToast(toast.id), 300); // Wait for exit animation
        }, 5000); // 5 seconds duration

        return () => {
            clearTimeout(timer);
        };
    }, [toast.id, removeToast]);
    
    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => removeToast(toast.id), 300);
    }

    const styles = getToastStyles(toast.type);

    return (
        <div className={`toast ${styles.bg} ${styles.border} ${styles.text} ${isExiting ? 'exiting' : ''}`}>
             <div className="flex-shrink-0">{styles.icon}</div>
             <div className="ml-3 w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                <p className="text-xs mt-1 opacity-90">{toast.message}</p>
            </div>
             <button onClick={handleClose} className="ml-4 flex-shrink-0 text-slate-400 hover:text-slate-600">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
    );
};

const ToastContainer: React.FC<{ toasts: Toast[], removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <ToastMessage key={toast.id} toast={toast} removeToast={removeToast} />
            ))}
        </div>
    );
};

export default ToastContainer;