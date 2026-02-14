import React, { useState } from 'react';
import { MOCK_USERS } from '../constants';
import { User } from '../types';
import { Building2, Globe, ArrowRight, ArrowLeft, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { consumeAccessLinkViaApi, loginWithApi } from '../services/api';

interface LoginProps {
  onLogin: (user: User) => void;
  onPublicAccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onPublicAccess }) => {
  const { t } = useTranslation();
  const { direction, toggleLanguage, language } = useLanguage();
  const [email, setEmail] = useState('owner@alfath-clinic.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('accessToken');
    if (token) {
      setResetToken(token);
    }
  }, []);

  const handleApiLogin = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await loginWithApi(email, password);
      onLogin(user);
    } catch (err) {
      const localUser = authenticateWithLocalCredentials(email, password);
      if (localUser) {
        onLogin(localUser);
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setResetMessage(null);

    if (!resetToken) {
      setError(t('access_link_invalid'));
      return;
    }

    try {
      await consumeAccessLinkViaApi({
        token: resetToken,
        email,
        password: newPassword,
      });
      setResetMessage(t('access_link_success'));
      setPassword(newPassword);
      setResetToken(null);
      setNewPassword('');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('access_link_invalid'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleLanguage}
          className="text-sm font-bold text-gray-500 hover:text-primary-600 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200"
        >
          {language === 'en' ? 'العربية' : 'English'}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Building2 className="w-10 h-10" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">{t('login_title')}</h2>
        <p className="mt-2 text-center text-sm text-gray-600">{t('login_subtitle')}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200/50 sm:rounded-lg sm:px-10 space-y-6">
          <button
            onClick={onPublicAccess}
            className="w-full flex items-center justify-center px-4 py-3 border-2 border-primary-100 shadow-sm text-sm font-bold rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 hover:border-primary-200 transition-all mb-6 group"
          >
            <Globe className="w-5 h-5 me-2 group-hover:scale-110 transition-transform" />
            {t('book_online')}
          </button>

          {resetToken ? (
            <form onSubmit={handleSetPassword} className="space-y-3">
              <p className="text-sm text-gray-700 font-medium">{t('access_link_title')}</p>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="********"
                minLength={6}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-primary-600 text-white text-sm font-bold hover:bg-primary-700"
              >
                {t('set_new_password')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleApiLogin} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 disabled:opacity-70"
              >
                {loading ? <LoaderCircle className="w-4 h-4 animate-spin mx-auto" /> : t('login_action')}
              </button>
            </form>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {resetMessage && <p className="text-xs text-green-600">{resetMessage}</p>}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">{t('or_staff_login')}</span>
            </div>
          </div>

          <div className="space-y-3">
            {MOCK_USERS.map((user) => (
              <button
                key={user.id}
                onClick={() => onLogin(user)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors group"
              >
                <div className="flex items-center">
                  <img className="h-9 w-9 rounded-full bg-gray-200 object-cover" src={user.avatarUrl} alt="" />
                  <div className="ms-3 text-start">
                    <p className="text-sm font-bold text-gray-900">{user.name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{t(user.role as any)}</p>
                  </div>
                </div>
                <span className="text-gray-400 group-hover:text-primary-600 transition-colors">
                  {direction === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
