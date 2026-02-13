import React from 'react';
import { MOCK_USERS } from '../constants';
import { User } from '../types';
import { Building2, Globe, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';

interface LoginProps {
  onLogin: (user: User) => void;
  onPublicAccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onPublicAccess }) => {
  const { t } = useTranslation();
  const { direction, toggleLanguage, language } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      
      {/* Language Toggle */}
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
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {t('login_title')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('login_subtitle')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200/50 sm:rounded-lg sm:px-10 space-y-6">
          
          {/* Public Portal Button */}
          <button
            onClick={onPublicAccess}
            className="w-full flex items-center justify-center px-4 py-3 border-2 border-primary-100 shadow-sm text-sm font-bold rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 hover:border-primary-200 transition-all mb-6 group"
          >
             <Globe className="w-5 h-5 me-2 group-hover:scale-110 transition-transform" />
             {t('book_online')}
          </button>

          <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {t('or_staff_login')}
                </span>
              </div>
            </div>

          <div className="space-y-3">
            {MOCK_USERS.map(user => (
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