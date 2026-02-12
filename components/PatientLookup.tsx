import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { Search, UserPlus, Phone, User, History } from 'lucide-react';

interface PatientLookupProps {
  patients: Patient[];
  onSelectPatient: (patient: Patient) => void;
  onAddNewPatient: (patient: Partial<Patient>) => void;
}

export const PatientLookup: React.FC<PatientLookupProps> = ({ patients, onSelectPatient, onAddNewPatient }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // New Patient Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = patients.filter(p => 
        p.phone.includes(searchQuery) || 
        p.name.toLowerCase().includes(lowerQuery)
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, [searchQuery, patients]);

  const startCreating = () => {
    setIsCreating(true);
    // Auto-fill logic: if mostly numeric, assume phone, else assume name
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

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddNewPatient({
      name: newName,
      phone: newPhone,
      age: parseInt(newAge),
      gender: newGender,
      medicalHistorySummary: 'New Patient'
    });
    setIsCreating(false);
    // Reset form
    setNewName('');
    setNewPhone('');
    setNewAge('');
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Patient Search</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-lg"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsCreating(false); 
            }}
            autoFocus
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">Enter name or phone to search existing files or create a new profile.</p>
      </div>

      {/* Results Area */}
      {!isCreating && (
        <div className="space-y-3">
          {results.length > 0 && (
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Found {results.length} profile{results.length !== 1 ? 's' : ''}
            </div>
          )}
          
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
                    <span>{patient.age} years</span>
                    <span>•</span>
                    <span className="capitalize">{patient.gender}</span>
                  </div>
                   <div className="flex items-center text-xs text-gray-400 mt-1">
                      <Phone className="w-3 h-3 mr-1" />
                      {patient.phone}
                   </div>
                  {patient.lastVisit && (
                    <div className="flex items-center text-xs text-gray-400 mt-2">
                      <History className="w-3 h-3 mr-1" />
                      Last visit: {patient.lastVisit}
                    </div>
                  )}
                </div>
              </button>
            ))}

            {/* Add New Profile Card (Always visible if query has length) */}
            {searchQuery.length > 1 && (
              <button
                onClick={startCreating}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-gray-500 hover:text-primary-600 h-full min-h-[100px]"
              >
                <UserPlus className="w-8 h-8 mb-2" />
                <span className="font-medium">Create New Profile</span>
                <span className="text-xs text-gray-400 mt-1">
                    {/^\d+$/.test(searchQuery.replace(/[\s\-\(\)]/g, '')) ? `Use number ${searchQuery}` : `Add "${searchQuery}"`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create New Profile Form */}
      {isCreating && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">New Patient Profile</h3>
            <span className="bg-primary-100 text-primary-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              Creating New Record
            </span>
          </div>
          
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                required
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Patient Full Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                required
                type="tel"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Age</label>
                <input
                  required
                  type="number"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2"
                  value={newAge}
                  onChange={(e) => setNewAge(e.target.value)}
                  placeholder="e.g. 30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border p-2"
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as 'Male' | 'Female')}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Create & Select
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};