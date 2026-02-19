import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DoctorProfilePayload, getDoctorProfileFromApi, updateDoctorProfileFromApi } from '../services/api';

const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];

type TemplateSectionProps = {
  title: string;
  placeholder: string;
  addLabel: string;
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
  addLabel,
  items,
  draftValue,
  setDraftValue,
  onAdd,
  onRemove,
  disabled,
}) => {
  const { t } = useTranslation();
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
          <Plus className="w-4 h-4" /> {addLabel}
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
      <span className="text-xs text-gray-400">{t('doctor_profile_templates_count', { count: items.length })}</span>
    </div>
  );
};

export const DoctorProfile: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [examTemplates, setExamTemplates] = useState<string[]>([]);
  const [diagnosisTemplates, setDiagnosisTemplates] = useState<string[]>([]);
  const [planTemplates, setPlanTemplates] = useState<string[]>([]);

  const [newExamTemplate, setNewExamTemplate] = useState('');
  const [newDiagnosisTemplate, setNewDiagnosisTemplate] = useState('');
  const [newPlanTemplate, setNewPlanTemplate] = useState('');

  const defaultExamTemplates = useMemo(
    () => [1, 2, 3, 4, 5, 6, 7, 8].map((index) => t(`doctor_profile_default_exam_${index}`)),
    [t],
  );
  const defaultDiagnosisTemplates = useMemo(
    () => [1, 2, 3, 4, 5].map((index) => t(`doctor_profile_default_diagnosis_${index}`)),
    [t],
  );
  const defaultPlanTemplates = useMemo(
    () => [1, 2, 3, 4].map((index) => t(`doctor_profile_default_plan_${index}`)),
    [t],
  );

  const fallbackProfile: DoctorProfilePayload = {
    examFindingTemplates: defaultExamTemplates,
    diagnosisTemplates: defaultDiagnosisTemplates,
    planTemplates: defaultPlanTemplates,
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
      setMessage(t('doctor_profile_auto_saved'));
    } catch {
      setMessage(t('doctor_profile_save_failed'));
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
    return <div className="bg-white p-6 rounded-xl border border-gray-200 text-sm text-gray-500">{t('doctor_profile_loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('doctor_profile_title')}</h1>
        <p className="text-sm text-gray-500">{t('doctor_profile_templates_desc')}</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <TemplateSection
          title={t('exam_findings')}
          placeholder={t('doctor_profile_exam_template_placeholder')}
          addLabel={t('add')}
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
          title={t('diagnosis')}
          placeholder={t('doctor_profile_diagnosis_template_placeholder')}
          addLabel={t('add')}
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
          title={t('plan')}
          placeholder={t('doctor_profile_plan_template_placeholder')}
          addLabel={t('add')}
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
