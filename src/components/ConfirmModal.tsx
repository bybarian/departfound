import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  type = 'warning',
  confirmText = '確定',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const Icon = type === 'danger' ? Trash2 : type === 'warning' ? AlertTriangle : HelpCircle;
  const iconColorClass = 
    type === 'danger' 
      ? 'bg-rose-50 text-rose-600 border-rose-100' 
      : type === 'warning'
      ? 'bg-amber-50 text-[#008236] border-emerald-100'
      : 'bg-blue-50 text-blue-600 border-blue-100';

  const confirmBtnClass =
    type === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold'
      : 'bg-[#008236] hover:bg-[#006a2c] text-white font-bold';

  return (
    <div id="custom-confirm-overlay" className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <div 
        id="custom-confirm-container"
        className="relative w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in-50 zoom-in-95 duration-200 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-50 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded border ${iconColorClass}`}>
              <Icon className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans">
              {title}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contents */}
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-slate-600 leading-relaxed font-sans pre-wrap whitespace-pre-line">
            {message}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex justify-end gap-2 text-xs">
          {cancelText && cancelText !== "" && (
            <button
              type="button"
              onClick={onCancel}
              className="geo-btn-outline px-4 py-2 font-bold cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`geo-btn-primary px-4 py-2 cursor-pointer ${confirmBtnClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
