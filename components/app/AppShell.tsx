import React from 'react';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { Toast } from '../common/Toast';

interface AppShellProps {
  toast: { type: 'success' | 'error'; message: string } | null;
  children: React.ReactNode;
}

export function AppShell({ toast, children }: AppShellProps) {
  return (
    <LanguageProvider>
      <Toast toast={toast} />
      {children}
    </LanguageProvider>
  );
}
