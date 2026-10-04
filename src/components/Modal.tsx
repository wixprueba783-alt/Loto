import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ title, onClose, children, size = 'md' }: ModalProps) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card w-full ${widths[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-[#F5EDE6]">
          <h2 className="text-lg font-semibold text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
          <button className="btn-ghost p-1.5 rounded-lg" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
