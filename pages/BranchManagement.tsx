import React, { useEffect, useState } from 'react';
import { BRANCHES } from '../constants';
import { BranchForm } from '../components/forms/BranchForm';
import { BranchSettingsForm } from '../components/forms/BranchSettingsForm';
import { Building2, Plus, MapPin, Phone, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { repositories } from '../services/repositories';
import { Branch, BranchOperationalSettings } from '../types';

export const BranchManagement: React.FC = () => {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [settingsBranch, setSettingsBranch] = useState<Branch | null>(null);
  const [branchSettings, setBranchSettings] = useState<BranchOperationalSettings | null>(null);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    repositories.branches.getBranches()
      .then(setBranches)
      .catch(() => setBranches(BRANCHES));
  }, []);

  const closeModal = () => {
    setIsCreatingBranch(false);
    setEditingBranch(null);
    setSettingsBranch(null);
    setBranchSettings(null);
    setFormError(null);
  };

  const openSettings = async (branch: Branch) => {
    setSettingsBranch(branch);
    const response = await repositories.branches.getBranchSettings(branch.id);
    setBranchSettings(response.effective);
  };

  const handleSaveBranch = async (formData: Omit<Branch, 'id'>) => {
    setFormError(null);
    setFormSaving(true);
    try {
      if (isCreatingBranch) {
        const saved = await repositories.branches.createBranch(formData);
        setBranches((prev) => [...prev, saved]);
        closeModal();
        return;
      }

      if (!editingBranch) return;

      const saved = await repositories.branches.updateBranch({
        ...editingBranch,
        ...formData,
      });

      setBranches((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save branch';
      setFormError(message.includes('limit') ? t('branch.limit_reached') : message);
    } finally {
      setFormSaving(false);
    }
  };

  const removeBranch = async (id: string) => {
    if (!window.confirm(t('delete_branch_confirm'))) return;

    const previous = [...branches];
    setBranches((prev) => prev.filter((branch) => branch.id !== id));

    try {
      await repositories.branches.deleteBranch(id);
    } catch {
      setBranches(previous);
      alert(t('branch.delete_failed_api'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('branch_mgmt')}</h1>
          <p className="text-sm text-gray-500">{t('branch_desc')}</p>
        </div>
        <button
          onClick={() => setIsCreatingBranch(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" /> {t('add_new_branch')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => (
          <div key={branch.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-primary-50 rounded-lg text-primary-600">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-bold ${branch.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {branch.isActive ? t('active') : t('inactive')}
                </div>
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-1">{branch.name}</h4>
              <p className="text-sm text-gray-500 flex items-center mb-1">
                <MapPin className="w-4 h-4 mr-1 rtl:ml-1 rtl:mr-0" /> {branch.location}
              </p>
              <p className="text-sm text-gray-500 flex items-center">
                <Phone className="w-4 h-4 mr-1 rtl:ml-1 rtl:mr-0" /> {branch.contactPhone}
              </p>
            </div>
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-400">{t('id')}: {branch.id}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingBranch(branch)}
                  className="text-sm font-medium text-gray-600 hover:text-primary-600"
                >
                  {t('edit')}
                </button>
                <button
                  onClick={() => removeBranch(branch.id)}
                  className="text-sm font-medium text-red-400 hover:text-red-600"
                >
                  {t('delete')}
                </button>
                <button
                  onClick={() => openSettings(branch)}
                  className="text-sm font-medium text-indigo-500 hover:text-indigo-700"
                >
                  Settings
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(editingBranch || isCreatingBranch) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg h-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">
                {isCreatingBranch ? t('add_new_branch') : t('edit_branch_details')}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-200 rounded-full">
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            {formError && (
              <div className="mx-4 mt-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
                <span className="font-bold shrink-0">⚠</span>
                <span>{formError}</span>
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <BranchForm
                initialData={editingBranch || undefined}
                onSave={handleSaveBranch}
                onCancel={closeModal}
              />
            </div>
          </div>
        </div>
      )}

      {settingsBranch && branchSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl h-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Branch settings · {settingsBranch.name}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-200 rounded-full">
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <BranchSettingsForm
              initialData={branchSettings}
              onCancel={closeModal}
              onSave={async (settings) => {
                const updated = await repositories.branches.updateBranchSettings(settingsBranch.id, settings);
                setBranches((prev) => prev.map((item) => item.id === settingsBranch.id ? { ...item, settings: updated } : item));
                closeModal();
              }}
              onReset={async () => {
                const updated = await repositories.branches.resetBranchSettings(settingsBranch.id);
                setBranches((prev) => prev.map((item) => item.id === settingsBranch.id ? { ...item, settings: updated } : item));
                closeModal();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
