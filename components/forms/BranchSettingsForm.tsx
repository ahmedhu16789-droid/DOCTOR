import React, { useState } from 'react';
import { BranchOperationalSettings } from '../../types';

interface BranchSettingsFormProps {
  initialData: BranchOperationalSettings;
  onSave: (data: BranchOperationalSettings) => Promise<void>;
  onReset: () => Promise<void>;
  onCancel: () => void;
}

export const BranchSettingsForm: React.FC<BranchSettingsFormProps> = ({ initialData, onSave, onReset, onCancel }) => {
  const [formData, setFormData] = useState<BranchOperationalSettings>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateDays = (input: string) => {
    const days = input.split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));
    setFormData((prev) => ({ ...prev, workingHours: { ...prev.workingHours, days } }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-6">
      <label className="block text-sm">Default slot duration (minutes)
        <input type="number" min={5} max={180} value={formData.defaultSlotDurationMinutes} onChange={(e) => setFormData((p) => ({ ...p, defaultSlotDurationMinutes: Number(e.target.value) }))} className="mt-1 w-full rounded-md border border-gray-300 p-2" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">Working hours start
          <input type="time" value={formData.workingHours.start} onChange={(e) => setFormData((p) => ({ ...p, workingHours: { ...p.workingHours, start: e.target.value } }))} className="mt-1 w-full rounded-md border border-gray-300 p-2" />
        </label>
        <label className="block text-sm">Working hours end
          <input type="time" value={formData.workingHours.end} onChange={(e) => setFormData((p) => ({ ...p, workingHours: { ...p.workingHours, end: e.target.value } }))} className="mt-1 w-full rounded-md border border-gray-300 p-2" />
        </label>
      </div>
      <label className="block text-sm">Working days (0=Sun..6=Sat)
        <input type="text" value={formData.workingHours.days.join(',')} onChange={(e) => updateDays(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 p-2" />
      </label>
      <label className="block text-sm">Queue max waiting patients
        <input type="number" min={1} max={1000} value={formData.queueRules.maxWaitingPatients} onChange={(e) => setFormData((p) => ({ ...p, queueRules: { ...p.queueRules, maxWaitingPatients: Number(e.target.value) } }))} className="mt-1 w-full rounded-md border border-gray-300 p-2" />
      </label>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label><input type="checkbox" checked={formData.queueRules.allowOverbooking} onChange={(e) => setFormData((p) => ({ ...p, queueRules: { ...p.queueRules, allowOverbooking: e.target.checked } }))} className="mr-2" />Allow overbooking</label>
        <label><input type="checkbox" checked={formData.queueRules.autoCallEnabled} onChange={(e) => setFormData((p) => ({ ...p, queueRules: { ...p.queueRules, autoCallEnabled: e.target.checked } }))} className="mr-2" />Auto call queue</label>
        <label><input type="checkbox" checked={formData.operationalFlags.allowWalkIns} onChange={(e) => setFormData((p) => ({ ...p, operationalFlags: { ...p.operationalFlags, allowWalkIns: e.target.checked } }))} className="mr-2" />Allow walk-ins</label>
        <label><input type="checkbox" checked={formData.operationalFlags.enableTelehealth} onChange={(e) => setFormData((p) => ({ ...p, operationalFlags: { ...p.operationalFlags, enableTelehealth: e.target.checked } }))} className="mr-2" />Enable telehealth</label>
        <label><input type="checkbox" checked={formData.operationalFlags.requirePrepayment} onChange={(e) => setFormData((p) => ({ ...p, operationalFlags: { ...p.operationalFlags, requirePrepayment: e.target.checked } }))} className="mr-2" />Require prepayment</label>
      </div>

      <div className="flex justify-between border-t border-gray-200 pt-4">
        <button type="button" onClick={onReset} className="rounded-lg border border-amber-300 px-3 py-2 text-amber-700">Reset to clinic defaults</button>
        <div className="space-x-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-3 py-2">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary-600 px-4 py-2 text-white">Save settings</button>
        </div>
      </div>
    </form>
  );
};
