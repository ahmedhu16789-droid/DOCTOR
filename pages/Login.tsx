import React from 'react';
import { MOCK_USERS } from '../constants';
import { User } from '../types';
import { Building2, Globe } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  onPublicAccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onPublicAccess }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Building2 className="w-10 h-10" />
            </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Al-Fath Clinic
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Advanced Multi-Branch Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200/50 sm:rounded-lg sm:px-10 space-y-6">
          
          {/* Public Portal Button */}
          <button
            onClick={onPublicAccess}
            className="w-full flex items-center justify-center px-4 py-3 border-2 border-primary-100 shadow-sm text-sm font-bold rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 hover:border-primary-200 transition-all mb-6 group"
          >
             <Globe className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
             Book Appointment Online (Patient Portal)
          </button>

          <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Or Staff Login
                </span>
              </div>
            </div>

          <div className="space-y-3">
            {MOCK_USERS.map(user => (
              <button
                key={user.id}
                onClick={() => onLogin(user)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center">
                  <img className="h-9 w-9 rounded-full bg-gray-200" src={user.avatarUrl} alt="" />
                  <div className="ml-3 text-left">
                    <p className="text-sm font-bold text-gray-900">{user.name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">{user.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className="text-gray-400">&rarr;</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};