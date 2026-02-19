import React from 'react';

interface ToastProps {
  toast: { type: 'success' | 'error'; message: string } | null;
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}
    >
      {toast.message}
    </div>
  );
}
