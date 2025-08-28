export interface GeneratedImage {
  id: string;
  url: string;
}

export interface ModalState {
  error: string | null;
  download: boolean;
  lightbox: string | null;
}

export interface ReferenceFile {
    base64: string;
    mimeType: string;
}

export type ActiveTab = 'prompt' | 'reference';

// --- Notification System Types ---

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}

export interface ModalAction {
  label: string;
  onClick: () => void;
  className?: string;
}

export interface ModalOptions {
  type: 'delete' | 'release' | 'info' | 'custom';
  title: string;
  message: React.ReactNode;
  actions: ModalAction[];
  onClose?: () => void;
  showCopyInput?: string; // For the manual copy modal
}