import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { Search, UserPlus, Phone, User, History } from 'lucide-react';

import { useTranslation } from 'react-i18next';

interface PatientLookupProps {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onAddNewPatient: (patient: Partial<Patient>) => Promise<Patient | void> | Patient | void;
  onSearchByPhone?: (phone: string, name?: string) => Promise<Patient[]>;
}

export const PatientLookup: React.FC<PatientLookupProps> = ({ patients, onSelectPatient, onAddNewPatient, onSearchByPhone }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // New Patient Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }

      if (onSearchByPhone && /^\d+$/.test(searchQuery.replace(/[\s\-\(\)]/g, ''))) {
        setIsSearching(true);
        try {
          const remoteResults = await onSearchByPhone(searchQuery);
          setResults(remoteResults);
          return;
        } finally {
          setIsSearching(false);
        }
      }

      const lowerQuery = searchQuery.toLowerCase();
      const filtered = patients.filter(p =>
        p.phone.includes(searchQuery) ||
        p.name.toLowerCase().includes(lowerQuery)
      );
      setResults(filtered);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchQuery, patients, onSearchByPhone]);

  const startCreating = () => {
    setIsCreating(true);
    const cleanQuery = searchQuery.replace(/[\s\-\(\)]/g, '');
    const isNumeric = /^\d+$/.test(cleanQuery);

    if (isNumeric && cleanQuery.length > 3) {
      setNewPhone(searchQuery);
      setNewName('');
    } else {
      setNewName(searchQuery);
      setNewPhone('');
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (onSearchByPhone) {
        const candidates = await onSearchByPhone(newPhone, newName);
        const duplicateCandidates = candidates.filter((candidate) => {
          if (!candidate.duplicateHint) return false;
          return candidate.duplicateHint.phoneExact && candidate.duplicateHint.confidence !== 'low';
        });

        if (duplicateCandidates.length > 0) {
          const duplicateSummary = duplicateCandidates
            .slice(0, 3)
            .map((candidate) => `• ${candidate.name} (${candidate.phone}) — ${candidate.duplicateHint?.reason ?? 'possible duplicate'}`)
            .join('\n');

          const shouldCreateDuplicate = window.confirm(
            `Potential duplicate patient found:\n\n${duplicateSummary}\n\nCreate a new patient anyway?`
          );

          if (!shouldCreateDuplicate) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      const created = await onAddNewPatient({
        name: newName,
        phone: newPhone,
        age: Number.parseInt(newAge, 10),
        gender: newGender,
        medicalHistorySummary: 'New Patient'
      });

      if (created) {
        onSelectPatient(created);
      }

      setIsCreating(false);
      setNewName('');
      setNewPhone('');
      setNewAge('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('patient_search')}</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-lg"
            placeholder={t('search_placeholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsCreating(false);
            }}
            autoFocus
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">{t('search_hint')}</p>
      </div>

      {!isCreating && (
        <div className="space-y-3">
          {results.length > 0 && (
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              {t('found_profiles', { count: results.length })}
            </div>
          )}

          {isSearching && <div className="text-xs text-gray-400">{t('loading_profiles')}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map(patient => (
              <button
                key={patient.id}
                onClick={() => onSelectPatient(patient)}
                className="flex items-start p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-primary-500 hover:ring-1 hover:ring-primary-500 transition-all text-left group"
              >
                <div className={`p-3 rounded-full mr-4 ${patient.gender === 'Male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                    {patient.name}
                  </h4>
                  <div className="flex items-center text-sm text-gray-500 mt-1 space-x-3">
                    <span>{patient.age} {t('years')}</span>
                    <span>•</span>
                    <span className="capitalize">{t(patient.gender.toLowerCase())}</span>
                  </div>
                  <div className="flex items-center text-xs text-gray-400 mt-1">
                    <Phone className="w-3 h-3 mr-1" />
                    {patient.phone}
                  </div>
                  {patient.lastVisit && (
                    <div className="flex items-center text-xs text-gray-400 mt-2">
                      <History className="w-3 h-3 mr-1" />
                      {t('last_visit')}: {patient.lastVisit}
                    </div>
                  )}
                </div>
              </button>
            ))}

            {searchQuery.length > 1 && (
              <button
                onClick={startCreating}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-gray-500 hover:text-primary-600 h-full min-h-[100px]"
              >
                <UserPlus className="w-8 h-8 mb-2" />
                <span className="font-medium">{t('create_new_profile')}</span>
                <span className="text-xs text-gray-400 mt-1">
                  {/^\d+$/.test(searchQuery.replace(/[\s\-\(\)]/g, '')) ? t('use_number', { number: searchQuery }) : t('add_name', { name: searchQuery })}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {isCreating && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">{t('new_patient_profile')}</h3>
            <span className="bg-primary-100 text-primary-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              {t('creating_record')}
            </span>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('full_name')}</label>
              <input required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('patient_full_name')} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t('phone_number')}</label>
              <input required type="tel" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder={t('phone_placeholder')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('age')}</label>
                <input required type="number" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2" value={newAge} onChange={(e) => setNewAge(e.target.value)} placeholder="e.g. 30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('gender')}</label>
                <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2" value={newGender} onChange={(e) => setNewGender(e.target.value as 'Male' | 'Female')}>
                  <option value="Male">{t('male')}</option>
                  <option value="Female">{t('female')}</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setIsCreating(false);
                  setNewName('');
                  setNewPhone('');
                  setNewAge('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 flex justify-center items-center"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  t('create_select')
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
