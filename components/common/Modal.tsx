import React from 'react';
import { ModalOptions } from '../../types';

interface ModalProps {
    options: ModalOptions;
    onClose: () => void;
}

const getIcon = (type: ModalOptions['type']) => {
    switch (type) {
        case 'delete':
            return {
                icon: <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>,
                bg: 'bg-red-100',
            };
        case 'release':
             return {
                icon: <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v3m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7a2 2 0 002 2z"></path></svg>,
                bg: 'bg-amber-100',
            };
        case 'info':
        case 'custom':
        default:
             return {
                icon: <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
                bg: 'bg-blue-100',
            };
    }
}

const Modal: React.FC<ModalProps> = ({ options, onClose }) => {
    const { title, message, actions, type, showCopyInput } = options;
    const { icon, bg } = getIcon(type);

    return (
        <div className="modal-backdrop show" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-sm ${bg}`}>
                            {icon}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                    </div>
                    <div className="text-sm text-slate-600 mb-8 leading-relaxed text-center px-2">
                        {message}
                    </div>

                    {showCopyInput && (
                        <div className="mb-6">
                            <input
                                type="text"
                                readOnly
                                value={showCopyInput}
                                className="w-full bg-slate-100 border border-slate-300 rounded-lg p-3 text-sm font-mono text-center"
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                    )}

                    <div className="flex gap-3 justify-center">
                        {actions.map((action, index) => (
                            <button
                                key={index}
                                onClick={action.onClick}
                                className={`font-semibold py-3 px-8 rounded-lg text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${action.className}`}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Modal;