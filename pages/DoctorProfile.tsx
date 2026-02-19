import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { getDoctorProfileFromApi, updateDoctorProfileFromApi } from '../services/api';

const DEFAULT_TEMPLATES = [
  'Conscious, oriented, cooperative',
  'Chest: clear to auscultation bilaterally, no wheezes or crackles',
  'Abdomen: soft, non-tender, no organomegaly',
  'Throat: hyperemic, tonsils not enlarged',
  'Skin: no rash, no jaundice',
  'Neurological: intact, no focal deficit',
  'CVS: S1 S2 heard, no murmurs',
  'Lymph nodes: not enlarged',
];

export const DoctorProfile: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<string[]>([]);
  const [newTemplate, setNewTemplate] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const payload = await getDoctorProfileFromApi();
        setTemplates(payload.examFindingTemplates?.length ? payload.examFindingTemplates : DEFAULT_TEMPLATES);
      } catch {
        setTemplates(DEFAULT_TEMPLATES);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const canAdd = useMemo(() => {
    const value = newTemplate.trim();
    return value.length >= 2 && !templates.includes(value);
  }, [newTemplate, templates]);

  const addTemplate = () => {
    if (!canAdd) return;
    setTemplates((prev) => [...prev, newTemplate.trim()]);
    setNewTemplate('');
  };

  const removeTemplate = (template: string) => {
    setTemplates((prev) => prev.filter((item) => item !== template));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateDoctorProfileFromApi({ examFindingTemplates: templates });
      setMessage('تم حفظ جمل التشخيص بنجاح.');
    } catch {
      setMessage('تعذر الحفظ حالياً، حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="bg-white p-6 rounded-xl border border-gray-200 text-sm text-gray-500">Loading doctor profile...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Doctor Profile</h1>
        <p className="text-sm text-gray-500">أضف جمل الفحص/التشخيص المتكررة لاستخدامها بسرعة داخل شاشة الكشف.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTemplate}
            onChange={(event) => setNewTemplate(event.target.value)}
            placeholder="اكتب جملة تشخيص متكررة..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
          />
          <button
            type="button"
            onClick={addTemplate}
            disabled={!canAdd}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> إضافة
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {templates.map((template) => (
            <div key={template} className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 border border-gray-200 text-sm text-gray-700">
              <span>{template}</span>
              <button type="button" onClick={() => removeTemplate(template)} className="text-gray-500 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{templates.length} templates</span>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'حفظ'}
          </button>
        </div>

        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
};
