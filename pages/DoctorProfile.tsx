import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DoctorProfilePayload, getDoctorProfileFromApi, updateDoctorProfileFromApi } from '../services/api';

const DEFAULT_EXAM_TEMPLATES = [
  'Conscious, oriented, cooperative',
  'Chest: clear to auscultation bilaterally, no wheezes or crackles',
  'Abdomen: soft, non-tender, no organomegaly',
  'Throat: hyperemic, tonsils not enlarged',
  'Skin: no rash, no jaundice',
  'Neurological: intact, no focal deficit',
  'CVS: S1 S2 heard, no murmurs',
  'Lymph nodes: not enlarged',
];

const DEFAULT_DIAGNOSIS_TEMPLATES = [
  'J06.9 – Upper Respiratory Infection',
  'I10 – Essential Hypertension',
  'E11.9 – Type 2 Diabetes Mellitus',
  'R05 – Cough',
  'N39.0 – Urinary Tract Infection',
];

const DEFAULT_PLAN_TEMPLATES = [
  'Rest for 3 days, plenty of fluids',
  'Follow up in 1 week if not improved',
  'Labs ordered, result follow-up',
  'Patient educated about medication compliance',
];

const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];

type TemplateSectionProps = {
  title: string;
  placeholder: string;
  items: string[];
  draftValue: string;
  setDraftValue: React.Dispatch<React.SetStateAction<string>>;
  onAdd: () => void;
  onRemove: (value: string) => void;
  disabled: boolean;
};

const TemplateSection: React.FC<TemplateSectionProps> = ({
  title,
  placeholder,
  items,
  draftValue,
  setDraftValue,
  onAdd,
  onRemove,
  disabled,
}) => {
  const canAdd = useMemo(() => {
    const value = draftValue.trim();
    return value.length >= 2 && !items.includes(value);
  }, [draftValue, items]);

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="font-bold text-gray-900">{title}</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canAdd && !disabled) {
              event.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-500"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd || disabled}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item} className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 border border-gray-200 text-sm text-gray-700">
            <span>{item}</span>
            <button type="button" onClick={() => onRemove(item)} className="text-gray-500 hover:text-red-600" disabled={disabled}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <span className="text-xs text-gray-400">{items.length} templates</span>
    </div>
  );
};

export const DoctorProfile: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [examTemplates, setExamTemplates] = useState<string[]>([]);
  const [diagnosisTemplates, setDiagnosisTemplates] = useState<string[]>([]);
  const [planTemplates, setPlanTemplates] = useState<string[]>([]);

  const [newExamTemplate, setNewExamTemplate] = useState('');
  const [newDiagnosisTemplate, setNewDiagnosisTemplate] = useState('');
  const [newPlanTemplate, setNewPlanTemplate] = useState('');

  const fallbackProfile: DoctorProfilePayload = {
    examFindingTemplates: DEFAULT_EXAM_TEMPLATES,
    diagnosisTemplates: DEFAULT_DIAGNOSIS_TEMPLATES,
    planTemplates: DEFAULT_PLAN_TEMPLATES,
  };

  const normalizeProfile = (payload?: Partial<DoctorProfilePayload>): DoctorProfilePayload => ({
    examFindingTemplates: unique(payload?.examFindingTemplates?.length ? payload.examFindingTemplates : fallbackProfile.examFindingTemplates),
    diagnosisTemplates: unique(payload?.diagnosisTemplates?.length ? payload.diagnosisTemplates : fallbackProfile.diagnosisTemplates),
    planTemplates: unique(payload?.planTemplates?.length ? payload.planTemplates : fallbackProfile.planTemplates),
  });

  const syncProfile = async (next: DoctorProfilePayload) => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await updateDoctorProfileFromApi(next);
      const normalized = normalizeProfile(saved);
      setExamTemplates(normalized.examFindingTemplates);
      setDiagnosisTemplates(normalized.diagnosisTemplates);
      setPlanTemplates(normalized.planTemplates);
      setMessage('تم الحفظ تلقائياً.');
    } catch {
      setMessage('تعذر الحفظ حالياً، حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const payload = await getDoctorProfileFromApi();
        const normalized = normalizeProfile(payload);
        setExamTemplates(normalized.examFindingTemplates);
        setDiagnosisTemplates(normalized.diagnosisTemplates);
        setPlanTemplates(normalized.planTemplates);
      } catch {
        setExamTemplates(fallbackProfile.examFindingTemplates);
        setDiagnosisTemplates(fallbackProfile.diagnosisTemplates);
        setPlanTemplates(fallbackProfile.planTemplates);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div className="bg-white p-6 rounded-xl border border-gray-200 text-sm text-gray-500">Loading doctor profile...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Doctor Profile</h1>
        <p className="text-sm text-gray-500">إدخال يدوي لقوالب الفحص والتشخيص وخطة المتابعة. زر الإضافة يحفظ مباشرة.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <TemplateSection
          title="Examination Findings"
          placeholder="اكتب جملة فحص متكررة..."
          items={examTemplates}
          draftValue={newExamTemplate}
          setDraftValue={setNewExamTemplate}
          disabled={saving}
          onAdd={() => {
            const value = newExamTemplate.trim();
            if (!value || examTemplates.includes(value)) return;
            setNewExamTemplate('');
            syncProfile({ examFindingTemplates: unique([...examTemplates, value]), diagnosisTemplates, planTemplates });
          }}
          onRemove={(value) => {
            syncProfile({ examFindingTemplates: examTemplates.filter((item) => item !== value), diagnosisTemplates, planTemplates });
          }}
        />

        <TemplateSection
          title="Diagnosis (ICD-10)"
          placeholder="اكتب كود/جملة تشخيص، مثال: I10 – Essential Hypertension"
          items={diagnosisTemplates}
          draftValue={newDiagnosisTemplate}
          setDraftValue={setNewDiagnosisTemplate}
          disabled={saving}
          onAdd={() => {
            const value = newDiagnosisTemplate.trim();
            if (!value || diagnosisTemplates.includes(value)) return;
            setNewDiagnosisTemplate('');
            syncProfile({ examFindingTemplates: examTemplates, diagnosisTemplates: unique([...diagnosisTemplates, value]), planTemplates });
          }}
          onRemove={(value) => {
            syncProfile({ examFindingTemplates: examTemplates, diagnosisTemplates: diagnosisTemplates.filter((item) => item !== value), planTemplates });
          }}
        />

        <TemplateSection
          title="Plan & Follow-up"
          placeholder="اكتب جملة خطة/متابعة متكررة..."
          items={planTemplates}
          draftValue={newPlanTemplate}
          setDraftValue={setNewPlanTemplate}
          disabled={saving}
          onAdd={() => {
            const value = newPlanTemplate.trim();
            if (!value || planTemplates.includes(value)) return;
            setNewPlanTemplate('');
            syncProfile({ examFindingTemplates: examTemplates, diagnosisTemplates, planTemplates: unique([...planTemplates, value]) });
          }}
          onRemove={(value) => {
            syncProfile({ examFindingTemplates: examTemplates, diagnosisTemplates, planTemplates: planTemplates.filter((item) => item !== value) });
          }}
        />

        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
};
