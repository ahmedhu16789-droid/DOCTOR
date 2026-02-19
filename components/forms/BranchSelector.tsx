import React, { useState } from 'react';
import { Branch } from '../../types';
import { Search, MapPin, Check, Building2, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface BranchSelectorProps {
  branches: Branch[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({ branches, selectedIds = [], onChange, error }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleBranch = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(bid => bid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (filteredBranches.length === 0) return;
    
    // If all filtered are already selected, deselect them
    const allFilteredSelected = filteredBranches.every(b => selectedIds.includes(b.id));
    
    if (allFilteredSelected) {
      const idsToKeep = selectedIds.filter(id => !filteredBranches.find(b => b.id === id));
      onChange(idsToKeep);
    } else {
      // Add all filtered that aren't already selected
      const newIds = [...selectedIds];
      filteredBranches.forEach(b => {
        if (!newIds.includes(b.id)) newIds.push(b.id);
      });
      onChange(newIds);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">{t('branch_selector_assigned_branches')}</label>
        <span className="text-xs text-gray-500">
          {t('branch_selector_selected_count', { count: selectedIds.length })}
        </span>
      </div>

      <div className={clsx(
        "bg-white border rounded-lg overflow-hidden transition-all",
        error ? "border-red-300 ring-1 ring-red-100" : "border-gray-300 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
      )}>
        {/* Search Header */}
        <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 ml-1" />
          <input 
            type="text" 
            placeholder={t('branch_selector_search_placeholder')}
            className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-medium text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-white transition-colors"
            >
              {t('branch_selector_toggle_visible')}
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredBranches.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
              {t('branch_selector_no_results', { query: searchQuery })}
            </div>
          ) : (
            filteredBranches.map(branch => {
              const isSelected = selectedIds.includes(branch.id);
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => toggleBranch(branch.id)}
                  className={clsx(
                    "w-full flex items-start text-left p-3 rounded-md transition-all border",
                    isSelected 
                      ? "bg-primary-50 border-primary-200" 
                      : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
                  )}
                >
                  <div className={clsx(
                    "w-5 h-5 rounded border flex items-center justify-center mt-0.5 mr-3 transition-colors",
                    isSelected 
                      ? "bg-primary-600 border-primary-600 text-white" 
                      : "bg-white border-gray-300"
                  )}>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className={clsx("text-sm font-medium", isSelected ? "text-primary-900" : "text-gray-900")}>
                      {branch.name}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mt-0.5">
                      <MapPin className="w-3 h-3 mr-1 opacity-70" />
                      {branch.location}
                    </div>
                    {!branch.isActive && (
                      <div className="flex items-center text-[10px] text-amber-600 mt-1 font-medium bg-amber-50 inline-flex px-1.5 py-0.5 rounded">
                        <Info className="w-3 h-3 mr-1" /> {t('branch_selector_inactive_branch')}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
        
        {/* Footer Summary */}
        <div className="bg-gray-50 p-2 text-xs text-gray-400 border-t border-gray-100 flex justify-between items-center">
             <span>{t('branch_selector_showing_count', { shown: filteredBranches.length, total: branches.length })}</span>
             {selectedIds.length === 0 && <span className="text-red-400 font-medium">{t('branch_selector_selection_required')}</span>}
        </div>
      </div>
      
      {error && (
        <p className="text-xs text-red-600 mt-1 flex items-center">
           <Info className="w-3 h-3 mr-1" /> {error}
        </p>
      )}
    </div>
  );
};
