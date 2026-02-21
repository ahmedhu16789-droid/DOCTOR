import React, { useEffect, useMemo, useState } from 'react';
import { Appointment, Patient, UserRole, Medication, VitalSigns, ServiceItem } from '../types';
import { Activity, FileText, Pill, Clock, Save, Printer, ArrowLeft, AlertTriangle, PlusCircle, Trash2, DollarSign, X } from 'lucide-react';
import { MOCK_SERVICES } from '../services/mockData';
import { getDoctorProfileFromApi, getMedicalEncounterFromApi, saveMedicalEncounterViaApi } from '../services/api';
import { fetchDosagesForDrug } from '../services/rxnormAutocomplete';
import { useTranslation } from 'react-i18next';
import { formatDateTo12Hour } from '../utils/time';

interface DoctorWorkspaceProps {
    appointment: Appointment;
    patient: Patient;
    userRole: UserRole;
    onClose: () => void;
    onComplete: (appointmentId: string) => void;
    onAddService: (aptId: string, service: ServiceItem) => void;
    onRemoveService: (aptId: string, itemId: string) => void;
}


type VisitHistoryItem = {
    id: string;
    date?: string;
    diagnosis?: string;
    plan?: string;
    nextVisitDate?: string;
    doctorId?: string;
    vitals?: VitalSigns;
    prescription?: Medication[];
};

export const DoctorWorkspace: React.FC<DoctorWorkspaceProps> = ({ appointment, patient, userRole, onClose, onComplete, onAddService, onRemoveService }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'VITALS' | 'NOTES' | 'RX' | 'SERVICES'>('VITALS');
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
    const [examTemplates, setExamTemplates] = useState<string[]>(defaultExamTemplates);
    const [diagnosisTemplates, setDiagnosisTemplates] = useState<string[]>(defaultDiagnosisTemplates);
    const [planTemplates, setPlanTemplates] = useState<string[]>(defaultPlanTemplates);

    // Clinical State
    const [vitals, setVitals] = useState<VitalSigns>({ recordedBy: 'u1', timestamp: new Date().toISOString() });
    const [diagnosis, setDiagnosis] = useState('');
    const [notes, setNotes] = useState('');
    const [plan, setPlan] = useState('');
    const [nextVisitDate, setNextVisitDate] = useState('');
    const [nextVisitType, setNextVisitType] = useState<string>('exact');
    const [nextVisitInterval, setNextVisitInterval] = useState<number>(1);
    const [prescription, setPrescription] = useState<Medication[]>([]);
    const [drugSuggestions, setDrugSuggestions] = useState<string[]>([]);
    const [selectedDrug, setSelectedDrug] = useState('');
    const [dosageOptions, setDosageOptions] = useState<string[]>([]);
    const [loadingDosages, setLoadingDosages] = useState(false);
    const [showDrugDropdown, setShowDrugDropdown] = useState(false);
    const drugSearchRef = React.useRef<HTMLDivElement | null>(null);
    const dosageMapRef = React.useRef<Record<string, string[]>>({});
    // keep legacy for any other code that references medicationOptions
    const medicationOptions: { id: string; name: string; activeIngredient?: string }[] = [];
    const [saving, setSaving] = useState(false);
    const [autoSaved, setAutoSaved] = useState<Date | null>(null);
    const hasDraftLoaded = React.useRef(false);
    // Refs to always hold latest values inside async setTimeout (avoids stale closure)
    const latestVitals = React.useRef(vitals);
    const latestNotes = React.useRef(notes);
    const latestDiagnosis = React.useRef(diagnosis);
    const latestPlan = React.useRef(plan);
    const latestNextVisitDate = React.useRef(nextVisitDate);
    const latestNextVisitType = React.useRef(nextVisitType);
    const latestNextVisitInterval = React.useRef(nextVisitInterval);
    const latestPrescription = React.useRef(prescription);
    const [history, setHistory] = useState<VisitHistoryItem[]>([]);
    const [selectedVisit, setSelectedVisit] = useState<VisitHistoryItem | null>(null);
    const [showPreviousVitals, setShowPreviousVitals] = useState(false);

    // Rx Builder State
    const [rxSearch, setRxSearch] = useState('');
    const [newMed, setNewMed] = useState<Partial<Medication>>({ dosage: '', frequency: '', duration: '' });

    const isNurse = userRole === UserRole.NURSE;

    const loadEncounter = async () => {
        const payload = await getMedicalEncounterFromApi(appointment.id);
        setHistory(payload.history ?? []);

        const data = payload.data;
        if (!data) {
            hasDraftLoaded.current = true; // nothing to load, allow auto-save immediately
            return;
        }

        setVitals({ ...data.vitals, recordedBy: data.vitals?.recordedBy ?? 'u1', timestamp: data.vitals?.timestamp ?? new Date().toISOString() });
        setNotes(data.examFindings ?? '');
        setDiagnosis(data.diagnosis ?? '');
        setPlan(data.plan ?? '');
        setNextVisitDate(data.nextVisitDate ?? '');
        setNextVisitType(data.nextVisitType ?? 'exact');
        setNextVisitInterval(data.nextVisitInterval ?? 1);
        setPrescription((data.prescription ?? []).map((medication) => ({
            id: medication.id,
            name: medication.name,
            activeIngredient: medication.activeIngredient,
            dosage: medication.dosage ?? '',
            frequency: medication.frequency ?? '',
            duration: medication.duration ?? '',
            instructions: medication.instructions,
        })));
        // Mark as loaded — subsequent changes will trigger auto-save
        setTimeout(() => { hasDraftLoaded.current = true; }, 200);
    };

    useEffect(() => {
        loadEncounter();
    }, [appointment.id]);

    useEffect(() => {
        getDoctorProfileFromApi()
            .then((payload) => {
                if (payload.examFindingTemplates?.length) setExamTemplates(payload.examFindingTemplates);
                if (payload.diagnosisTemplates?.length) setDiagnosisTemplates(payload.diagnosisTemplates);
                if (payload.planTemplates?.length) setPlanTemplates(payload.planTemplates);
            })
            .catch(() => {
                setExamTemplates(defaultExamTemplates);
                setDiagnosisTemplates(defaultDiagnosisTemplates);
                setPlanTemplates(defaultPlanTemplates);
            });
    }, [defaultDiagnosisTemplates, defaultExamTemplates, defaultPlanTemplates]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedVisit(null);
                setShowPreviousVitals(false);
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    // React drug name search — ClinicalTables API works from 2 chars, returns names + dosages together
    useEffect(() => {
        const query = typeof rxSearch === 'string' ? rxSearch : String(rxSearch ?? '');
        if (!query.trim() || query === selectedDrug) {
            setDrugSuggestions([]);
            setShowDrugDropdown(false);
            return;
        }
        if (query.trim().length < 2) {
            setDrugSuggestions([]);
            return;
        }
        let isCancelled = false;
        const timer = window.setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?ef=STRENGTHS_AND_FORMS&terms=${encodeURIComponent(query)}`
                );
                if (!res.ok) return;
                const data = await res.json();  // [count, null, {STRENGTHS_AND_FORMS: string[][]}, string[]]
                const names: string[] = data[3] ?? [];
                if (isCancelled) return;
                const strengthsArr: string[][] = data[2]?.STRENGTHS_AND_FORMS ?? [];
                // Cache dosages per drug name
                const map: Record<string, string[]> = {};
                names.forEach((name: string, i: number) => {
                    map[name] = [...new Set<string>(strengthsArr[i] ?? [])];
                });
                dosageMapRef.current = map;
                setDrugSuggestions(names.slice(0, 10));
                setShowDrugDropdown(names.length > 0);
            } catch { /* silent */ }
        }, 250);
        return () => {
            isCancelled = true;
            window.clearTimeout(timer);
        };
    }, [rxSearch, selectedDrug]);

    // Close drug dropdown when clicking outside of the search block
    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!drugSearchRef.current?.contains(target)) {
                setShowDrugDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Keep refs in sync with latest state (solves stale closure in auto-save timer)
    useEffect(() => { latestVitals.current = vitals; }, [vitals]);
    useEffect(() => { latestNotes.current = notes; }, [notes]);
    useEffect(() => { latestDiagnosis.current = diagnosis; }, [diagnosis]);
    useEffect(() => { latestPlan.current = plan; }, [plan]);
    useEffect(() => { latestNextVisitDate.current = nextVisitDate; }, [nextVisitDate]);
    useEffect(() => { latestNextVisitType.current = nextVisitType; }, [nextVisitType]);
    useEffect(() => { latestNextVisitInterval.current = nextVisitInterval; }, [nextVisitInterval]);
    useEffect(() => { latestPrescription.current = prescription; }, [prescription]);

    useEffect(() => {
        if (nextVisitType !== 'exact' && nextVisitInterval > 0) {
            const date = new Date();
            if (nextVisitType === 'days') date.setDate(date.getDate() + nextVisitInterval);
            else if (nextVisitType === 'weeks') date.setDate(date.getDate() + nextVisitInterval * 7);
            else if (nextVisitType === 'months') date.setMonth(date.getMonth() + nextVisitInterval);
            setNextVisitDate(date.toISOString().split('T')[0]);
        }
    }, [nextVisitType, nextVisitInterval]);

    // Auto-save DRAFT 1.5s after any clinical change — refs guarantee latest data
    useEffect(() => {
        if (!hasDraftLoaded.current) return;
        const timer = window.setTimeout(async () => {
            try {
                await saveMedicalEncounterViaApi(appointment.id, {
                    vitals: latestVitals.current,
                    examFindings: latestNotes.current,
                    diagnosis: latestDiagnosis.current,
                    plan: latestPlan.current,
                    nextVisitDate: latestNextVisitDate.current || undefined,
                    nextVisitType: latestNextVisitType.current,
                    nextVisitInterval: latestNextVisitInterval.current,
                    status: 'DRAFT',
                    prescription: latestPrescription.current,
                });
                setAutoSaved(new Date());
            } catch (err) {
                console.error('Auto-save failed:', err);
            }
        }, 1500);
        return () => window.clearTimeout(timer);
    }, [vitals, notes, diagnosis, plan, prescription, nextVisitDate, nextVisitType, nextVisitInterval]);


    const persistEncounter = async (status: 'DRAFT' | 'FINALIZED') => {
        setSaving(true);
        try {
            await saveMedicalEncounterViaApi(appointment.id, {
                vitals,
                examFindings: notes,
                diagnosis,
                plan,
                nextVisitDate: nextVisitDate || undefined,
                nextVisitType,
                nextVisitInterval,
                status,
                prescription,
            });

            if (status === 'FINALIZED') {
                onComplete(appointment.id);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleAddMedication = () => {
        const drugName = String(selectedDrug || rxSearch || '').trim();
        if (drugName && newMed.dosage) {
            setPrescription([...prescription, {
                id: Math.random().toString(),
                name: drugName,
                dosage: newMed.dosage || '',
                frequency: newMed.frequency || '',
                duration: newMed.duration || ''
            }]);
            setRxSearch('');
            setSelectedDrug('');
            setDrugSuggestions([]);
            setDosageOptions([]);
            setNewMed({ dosage: '', frequency: '', duration: '' });
        }
    };

    const handlePrintRx = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col overflow-hidden">
            {/* Top Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm print:hidden">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
                        <p className="text-xs text-gray-500">{t('doctor_workspace_patient_meta', { age: patient.age, gender: patient.gender, id: patient.id })}</p>
                    </div>
                    <div className="h-8 w-px bg-gray-200 mx-2"></div>
                    <div className="flex gap-2">
                        {patient.allergies?.map(a => (
                            <span key={a} className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-100 flex items-center">
                                <AlertTriangle className="w-3 h-3 mr-1" /> {a}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    {autoSaved && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                            {t('auto_saved')} {formatDateTo12Hour(autoSaved)}
                        </span>
                    )}
                    <button disabled={saving} onClick={() => persistEncounter('DRAFT')} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                        <Save className="w-4 h-4" /> {t('save_draft')}
                    </button>
                    {!isNurse && (
                        <button disabled={saving} onClick={() => persistEncounter('FINALIZED')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-60">
                            {t('finalize_visit')}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar: History */}
                <div className="w-80 bg-white border-r rtl:border-r-0 rtl:border-l border-gray-200 overflow-y-auto hidden lg:block print:hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900 mb-2">{t('patient_history')}</h3>
                        <div className="text-sm text-gray-600 leading-relaxed">
                            {patient.medicalHistorySummary}
                        </div>
                    </div>
                    <div className="p-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('previous_visits')}</h4>
                        <div className="space-y-4">
                            {history.length === 0 && (
                                <div className="text-sm text-gray-500">{t('no_previous_visits')}</div>
                            )}
                            {history.map((visit) => (
                                <button
                                    key={visit.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedVisit(visit);
                                        setShowPreviousVitals(false);
                                    }}
                                    className="w-full text-start relative pl-4 rtl:pl-0 rtl:pr-4 border-l-2 rtl:border-l-0 rtl:border-r-2 border-gray-200 pb-2 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300"
                                >
                                    <div className="absolute -left-[5px] rtl:-right-[5px] top-0 w-2.5 h-2.5 rounded-full bg-gray-300"></div>
                                    <div className="text-sm font-bold text-gray-800">{visit.date ?? '-'}</div>
                                    <div className="text-xs text-gray-500 mb-1">{visit.diagnosis ?? t('diagnosis')}</div>
                                    <div className="text-sm text-gray-600">{visit.plan ?? t('plan')}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Workspace */}
                <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden print:w-full print:bg-white">

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 bg-white px-6 print:hidden">
                        <button
                            onClick={() => setActiveTab('VITALS')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'VITALS' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            <Activity className="w-4 h-4" /> {t('tab_vitals')}
                        </button>
                        <button
                            onClick={() => setActiveTab('NOTES')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'NOTES' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            <FileText className="w-4 h-4" /> {t('tab_notes')}
                        </button>
                        <button
                            onClick={() => setActiveTab('RX')}
                            disabled={isNurse}
                            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'RX' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 disabled:opacity-50'}`}
                        >
                            <Pill className="w-4 h-4" /> {t('tab_rx')}
                        </button>
                        <button
                            onClick={() => setActiveTab('SERVICES')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'SERVICES' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            <DollarSign className="w-4 h-4" /> {t('tab_services')}
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 print:p-0">

                        {activeTab === 'VITALS' && (() => {
                            // Helpers: classify each value as normal/warning/danger
                            const bp = (vitals.bpSystolic ?? 120);
                            const hr = vitals.heartRate ?? 72;
                            const temp = vitals.temperature ?? 36.5;
                            const spo2 = vitals.oxygenSat ?? 98;

                            const bpStatus = bp < 90 ? 'low' : bp <= 120 ? 'ok' : bp <= 140 ? 'warn' : 'high';
                            const hrStatus = hr < 60 ? 'low' : hr <= 100 ? 'ok' : hr <= 120 ? 'warn' : 'high';
                            const tempStatus = temp < 36 ? 'low' : temp <= 37.5 ? 'ok' : temp <= 38.5 ? 'warn' : 'high';
                            const spo2Status = spo2 >= 95 ? 'ok' : spo2 >= 90 ? 'warn' : 'high';

                            const statusColor = (s: string) =>
                                s === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    : s === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-700'
                                        : s === 'low' ? 'border-blue-300 bg-blue-50 text-blue-700'
                                            : 'border-red-300 bg-red-50 text-red-700';

                            const statusLabel = (s: string) =>
                                s === 'ok' ? t('status_normal') : s === 'warn' ? t('status_elevated') : s === 'low' ? t('status_low') : t('status_high');

                            const VitalCard = ({ label, children, status, range }: { label: string; children: React.ReactNode; status: string; range: string }) => (
                                <div className={`rounded-xl border-2 p-5 transition-all ${statusColor(status)}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-semibold text-gray-700">{label}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(status)}`}>{statusLabel(status)}</span>
                                    </div>
                                    {children}
                                    <div className="text-xs mt-2 text-gray-400">{range}</div>
                                </div>
                            );

                            return (
                                <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-900">
                                        <Activity className="w-5 h-5 text-primary-600" /> {t('vitals_title')}
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                        {/* Blood Pressure */}
                                        <VitalCard label={t('blood_pressure')} status={bpStatus} range={t('bp_normal_range')}>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <div className="text-xs text-gray-500 mb-1">{t('systolic')}</div>
                                                    <input
                                                        type="number" min={60} max={220}
                                                        value={vitals.bpSystolic ?? ''}
                                                        onChange={e => setVitals({ ...vitals, bpSystolic: Number(e.target.value) || undefined })}
                                                        placeholder={t('bp_systolic_placeholder')}
                                                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-lg font-mono font-bold focus:outline-none focus:border-primary-400 bg-white"
                                                    />
                                                    <input type="range" min={60} max={220} value={vitals.bpSystolic ?? 120}
                                                        onChange={e => setVitals({ ...vitals, bpSystolic: Number(e.target.value) })}
                                                        className="w-full mt-1 accent-primary-500"
                                                    />
                                                </div>
                                                <span className="text-2xl text-gray-300 font-light">/</span>
                                                <div className="flex-1">
                                                    <div className="text-xs text-gray-500 mb-1">{t('diastolic')}</div>
                                                    <input
                                                        type="number" min={40} max={130}
                                                        value={vitals.bpDiastolic ?? ''}
                                                        onChange={e => setVitals({ ...vitals, bpDiastolic: Number(e.target.value) || undefined })}
                                                        placeholder={t('bp_diastolic_placeholder')}
                                                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-lg font-mono font-bold focus:outline-none focus:border-primary-400 bg-white"
                                                    />
                                                    <input type="range" min={40} max={130} value={vitals.bpDiastolic ?? 80}
                                                        onChange={e => setVitals({ ...vitals, bpDiastolic: Number(e.target.value) })}
                                                        className="w-full mt-1 accent-primary-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2 mt-3">
                                                {[[t('bp_preset_normal_value'), t('bp_preset_normal_label')], [t('bp_preset_low_value'), t('bp_preset_low_label')], [t('bp_preset_high_value'), t('bp_preset_high_label')]].map(([val, lbl]) => (
                                                    <button key={val} type="button"
                                                        onClick={() => { const [s, d] = val.split('/'); setVitals({ ...vitals, bpSystolic: +s, bpDiastolic: +d }); }}
                                                        className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-gray-600">{lbl}</button>
                                                ))}
                                            </div>
                                        </VitalCard>

                                        {/* Heart Rate */}
                                        <VitalCard label={`${t('heart_rate')} (BPM)`} status={hrStatus} range={t('hr_normal_range')}>
                                            <input
                                                type="number" min={30} max={250}
                                                value={vitals.heartRate ?? ''}
                                                onChange={e => setVitals({ ...vitals, heartRate: Number(e.target.value) || undefined })}
                                                placeholder="72"
                                                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-2xl font-mono font-bold focus:outline-none focus:border-primary-400 bg-white text-center"
                                            />
                                            <input type="range" min={30} max={200} value={vitals.heartRate ?? 72}
                                                onChange={e => setVitals({ ...vitals, heartRate: Number(e.target.value) })}
                                                className="w-full mt-2 accent-primary-500"
                                            />
                                            <div className="flex gap-2 mt-2">
                                                {[60, 80, 100, 120].map(v => (
                                                    <button key={v} type="button"
                                                        onClick={() => setVitals({ ...vitals, heartRate: v })}
                                                        className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 flex-1">{v}</button>
                                                ))}
                                            </div>
                                        </VitalCard>

                                        {/* Temperature */}
                                        <VitalCard label={`${t('temp')} (°C)`} status={tempStatus} range={t('temp_normal_range')}>
                                            <input
                                                type="number" step="0.1" min={34} max={42}
                                                value={vitals.temperature ?? ''}
                                                onChange={e => setVitals({ ...vitals, temperature: parseFloat(e.target.value) || undefined })}
                                                placeholder="36.5"
                                                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-2xl font-mono font-bold focus:outline-none focus:border-primary-400 bg-white text-center"
                                            />
                                            <input type="range" min={34} max={42} step={0.1} value={vitals.temperature ?? 36.5}
                                                onChange={e => setVitals({ ...vitals, temperature: parseFloat(e.target.value) })}
                                                className="w-full mt-2 accent-primary-500"
                                            />
                                            <div className="flex gap-2 mt-2">
                                                {[36.0, 36.5, 37.0, 38.0, 39.0].map(v => (
                                                    <button key={v} type="button"
                                                        onClick={() => setVitals({ ...vitals, temperature: v })}
                                                        className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 flex-1">{v}</button>
                                                ))}
                                            </div>
                                        </VitalCard>

                                        {/* O2 Saturation */}
                                        <VitalCard label={`${t('oxygen')} (%)`} status={spo2Status} range={t('oxygen_normal_range')}>
                                            <input
                                                type="number" min={70} max={100}
                                                value={vitals.oxygenSat ?? ''}
                                                onChange={e => setVitals({ ...vitals, oxygenSat: Number(e.target.value) || undefined })}
                                                placeholder="98"
                                                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-2xl font-mono font-bold focus:outline-none focus:border-primary-400 bg-white text-center"
                                            />
                                            <input type="range" min={70} max={100} value={vitals.oxygenSat ?? 98}
                                                onChange={e => setVitals({ ...vitals, oxygenSat: Number(e.target.value) })}
                                                className="w-full mt-2 accent-primary-500"
                                            />
                                            <div className="flex gap-2 mt-2">
                                                {[90, 93, 95, 97, 99].map(v => (
                                                    <button key={v} type="button"
                                                        onClick={() => setVitals({ ...vitals, oxygenSat: v })}
                                                        className="text-xs px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 flex-1">{v}%</button>
                                                ))}
                                            </div>
                                        </VitalCard>

                                        {/* Weight */}
                                        <div className="md:col-span-2 rounded-xl border-2 border-gray-200 bg-gray-50 p-5">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-sm font-semibold text-gray-700">{t('weight_with_unit')}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="number" min={1} max={300}
                                                    value={vitals.weight ?? ''}
                                                    onChange={e => setVitals({ ...vitals, weight: Number(e.target.value) || undefined })}
                                                    placeholder={t('weight_placeholder')}
                                                    className="w-32 px-3 py-2 border-2 border-gray-200 rounded-lg text-2xl font-mono font-bold focus:outline-none focus:border-primary-400 bg-white text-center"
                                                />
                                                <input type="range" min={1} max={200} value={vitals.weight ?? 70}
                                                    onChange={e => setVitals({ ...vitals, weight: Number(e.target.value) })}
                                                    className="flex-1 accent-primary-500"
                                                />
                                                <span className="text-gray-400 font-medium">{t('weight_unit')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chief Complaint / Triage Notes */}
                                    <div className="mt-6 pt-6 border-t border-gray-100">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('triage_notes')}</label>
                                        <textarea
                                            className="w-full p-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                            placeholder={t('triage_placeholder')}
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </div>
                                </div>
                            );
                        })()}


                        {activeTab === 'NOTES' && (() => {
                            const icdFiltered = diagnosisTemplates.filter((template) =>
                                diagnosis.length >= 1 && template.toLowerCase().includes(diagnosis.toLowerCase())
                            );

                            return (
                                <div className="max-w-3xl mx-auto space-y-5">

                                    {/* Examination Findings */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                        <h3 className="font-bold text-gray-900 mb-3">{t('exam_findings')}</h3>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {examTemplates.map(tmpl => (
                                                <button key={tmpl} type="button"
                                                    onClick={() => setNotes(p => p ? p + '\n' + tmpl : tmpl)}
                                                    className="text-xs px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-primary-50 hover:text-primary-700 border border-gray-200 text-gray-600 transition-colors"
                                                >
                                                    + {tmpl.length > 35 ? tmpl.slice(0, 35) + '…' : tmpl}
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            className="w-full p-3 border-2 border-gray-200 rounded-lg h-36 focus:outline-none focus:border-primary-400 resize-none text-sm"
                                            placeholder={t('exam_placeholder')}
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                        <div className="flex justify-end mt-1">
                                            <span className="text-xs text-gray-400">{t('character_count', { count: notes.length })}</span>
                                        </div>
                                    </div>

                                    {/* Diagnosis with ICD-10 autocomplete */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                        <h3 className="font-bold text-gray-900 mb-3">{t('diagnosis')} <span className="text-xs text-gray-400 font-normal ml-1">ICD-10</span></h3>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-400 text-sm"
                                                placeholder={t('diagnosis_search_placeholder')}
                                                value={diagnosis}
                                                onChange={e => setDiagnosis(e.target.value)}
                                            />
                                            {icdFiltered.length > 0 && (
                                                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                                                    {icdFiltered.map((template) => (
                                                        <button key={template} type="button"
                                                            onClick={() => setDiagnosis(template)}
                                                            className="w-full text-left px-4 py-2.5 hover:bg-primary-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
                                                        >
                                                            <span className="text-sm text-gray-800">{template}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {/* Common quick-pick chips */}
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {diagnosisTemplates.slice(0, 6).map((template) => (
                                                <button key={template} type="button"
                                                    onClick={() => setDiagnosis(template)}
                                                    className="text-xs px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-primary-50 hover:text-primary-700 border border-gray-200 text-gray-600 transition-colors"
                                                >
                                                    {template}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Plan & Follow-up */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                        <h3 className="font-bold text-gray-900 mb-3">{t('plan')}</h3>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {planTemplates.map(tmpl => (
                                                <button key={tmpl} type="button"
                                                    onClick={() => setPlan(p => p ? p + '\n' + tmpl : tmpl)}
                                                    className="text-xs px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 text-gray-600 transition-colors"
                                                >
                                                    + {tmpl}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mb-4 bg-gray-50 p-4 rounded-xl border border-gray-200/60">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-3">{t('next_visit_date')}</label>
                                            <div className="flex gap-4 items-center">
                                                <div className="w-1/3">
                                                    <select
                                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 text-sm bg-white font-medium text-gray-700 transition-all"
                                                        value={nextVisitType}
                                                        onChange={e => {
                                                            setNextVisitType(e.target.value);
                                                            if (e.target.value === 'exact') setNextVisitInterval(1);
                                                        }}
                                                    >
                                                        <option value="exact">{t('next_visit_type_exact')}</option>
                                                        <option value="days">{t('next_visit_type_days')}</option>
                                                        <option value="weeks">{t('next_visit_type_weeks')}</option>
                                                        <option value="months">{t('next_visit_type_months')}</option>
                                                    </select>
                                                </div>
                                                {nextVisitType === 'exact' ? (
                                                    <div className="w-2/3">
                                                        <input
                                                            type="date"
                                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 text-sm font-medium text-gray-700 transition-all"
                                                            value={nextVisitDate}
                                                            onChange={e => setNextVisitDate(e.target.value)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-2/3 flex items-center gap-3">
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className="w-24 p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 text-sm text-center font-bold text-gray-800 transition-all"
                                                                value={nextVisitInterval}
                                                                onChange={e => {
                                                                    const val = Number(e.target.value);
                                                                    setNextVisitInterval(val > 0 ? val : 1);
                                                                }}
                                                            />
                                                        </div>
                                                        {nextVisitDate && (
                                                            <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-2">
                                                                <span className="text-xs text-gray-400">{t('calculated_date')}</span>
                                                                <span className="text-sm font-bold text-primary-700">{nextVisitDate}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <textarea
                                            className="w-full p-3 border-2 border-gray-200 rounded-lg h-28 focus:outline-none focus:border-primary-400 resize-none text-sm"
                                            placeholder={t('plan_placeholder')}
                                            value={plan}
                                            onChange={e => setPlan(e.target.value)}
                                        />
                                    </div>
                                </div>
                            );
                        })()}



                        {activeTab === 'RX' && (
                            <div className="max-w-4xl mx-auto">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 print:hidden">
                                    <h3 className="font-bold text-gray-900 mb-4">{t('rx_builder')}</h3>
                                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">

                                        {/* Step 1: Drug Name with live autocomplete */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('medication')}</label>
                                                <div className="relative" ref={drugSearchRef}>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-gray-300 rounded"
                                                        placeholder={t('search_drug')}
                                                        value={rxSearch}
                                                        autoComplete="off"
                                                        onChange={e => {
                                                            setRxSearch(e.target.value);
                                                            setSelectedDrug('');
                                                            setDosageOptions([]);
                                                            setNewMed({ ...newMed, dosage: '' });
                                                        }}
                                                        onFocus={() => { if (drugSuggestions.length > 0) setShowDrugDropdown(true); }}
                                                        onBlur={() => setTimeout(() => setShowDrugDropdown(false), 150)}
                                                    />
                                                    {showDrugDropdown && drugSuggestions.length > 0 && (
                                                        <div className="absolute z-30 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                                                            {drugSuggestions.map((name, i) => (
                                                                <button key={i} type="button"
                                                                    onMouseDown={() => {
                                                                        setRxSearch(name);
                                                                        setSelectedDrug(name);
                                                                        setShowDrugDropdown(false);
                                                                        setDrugSuggestions([]);
                                                                        // Dosages already cached from the search response — no extra API call
                                                                        const cached = dosageMapRef.current[name] ?? [];
                                                                        setDosageOptions(cached);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 border-b border-gray-50 last:border-0 capitalize"
                                                                >
                                                                    {name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Dosage — suggestions from RxNorm but user can type freely */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                    {t('dosage')}
                                                    {loadingDosages && <span className="ml-2 text-gray-400 font-normal normal-case">{t('loading')}</span>}
                                                    {dosageOptions.length > 0 && !loadingDosages && (
                                                        <span className="ml-2 text-emerald-600 font-normal normal-case">{t('options_count', { count: dosageOptions.length })}</span>
                                                    )}
                                                </label>
                                                <input
                                                    type="text"
                                                    list="dosage-opts"
                                                    className="w-full p-2 border border-gray-300 rounded"
                                                    placeholder={t('dosage_placeholder')}
                                                    value={newMed.dosage}
                                                    onChange={e => setNewMed({ ...newMed, dosage: e.target.value })}
                                                />
                                                <datalist id="dosage-opts">
                                                    {dosageOptions.map((d, i) => <option key={i} value={d} />)}
                                                </datalist>
                                            </div>

                                        </div>

                                        {/* Frequency, Duration, Add */}
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                            <div className="md:col-span-5">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('frequency')}</label>
                                                <input
                                                    type="text"
                                                    list="freq-options"
                                                    className="w-full p-2 border border-gray-300 rounded"
                                                    placeholder={t('frequency_placeholder')}
                                                    value={newMed.frequency}
                                                    onChange={e => setNewMed({ ...newMed, frequency: e.target.value })}
                                                />
                                                <datalist id="freq-options">
                                                    {[t('frequency_once_daily'), t('frequency_twice_daily'), t('frequency_three_times_daily'), t('frequency_every_8_hours'), t('frequency_every_12_hours'), t('frequency_as_needed'), t('frequency_at_bedtime')].map(f => <option key={f} value={f} />)}
                                                </datalist>
                                            </div>
                                            <div className="md:col-span-4">
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('duration')}</label>
                                                <input
                                                    type="text"
                                                    list="dur-options"
                                                    className="w-full p-2 border border-gray-300 rounded"
                                                    placeholder={t('duration_placeholder')}
                                                    value={newMed.duration}
                                                    onChange={e => setNewMed({ ...newMed, duration: e.target.value })}
                                                />
                                                <datalist id="dur-options">
                                                    {[t('duration_3_days'), t('duration_5_days'), t('duration_7_days'), t('duration_10_days'), t('duration_14_days'), t('duration_1_month'), t('duration_ongoing')].map(d => <option key={d} value={d} />)}
                                                </datalist>
                                            </div>
                                            <div className="md:col-span-3">
                                                <button onClick={handleAddMedication} className="w-full p-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700">{t('add_with_plus')}</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Prescription Preview / Print Area */}
                                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[600px] print:shadow-none print:border-none print:p-0">
                                    {/* Header for Print */}
                                    <div className="hidden print:flex justify-between items-start mb-8 border-b-2 border-gray-900 pb-6">
                                        <div>
                                            <h1 className="text-3xl font-serif font-bold text-gray-900">{t('rx_header_title')}</h1>
                                            <p className="text-gray-600">{t('rx_header_subtitle')}</p>
                                            <p className="text-gray-600">{t('rx_phone')}</p>
                                        </div>
                                        <div className="text-right rtl:text-left">
                                            <h2 className="text-xl font-bold">{t('rx_doctor_name')}</h2>
                                            <p className="text-gray-600">{t('rx_doctor_specialty')}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end mb-6">
                                        <div>
                                            <div className="flex gap-8 mb-2">
                                                <p><span className="font-bold text-gray-900">{t('patient')}:</span> {patient.name}</p>
                                                <p><span className="font-bold text-gray-900">{t('age_label')}:</span> {patient.age}</p>
                                            </div>
                                            <p><span className="font-bold text-gray-900">{t('date')}:</span> {new Date().toLocaleDateString()}</p>
                                            {nextVisitDate && <p><span className="font-bold text-gray-900">{t('next_visit_date')}:</span> {nextVisitDate}</p>}
                                        </div>
                                        <button onClick={handlePrintRx} className="print:hidden flex items-center gap-2 text-gray-500 hover:text-primary-600">
                                            <Printer className="w-5 h-5" /> {t('print_rx')}
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="text-4xl font-serif text-gray-900 italic mb-4">{t('rx_mark')}</div>
                                        {prescription.length === 0 ? (
                                            <p className="text-gray-400 italic print:hidden">{t('no_meds')}</p>
                                        ) : (
                                            <ul className="space-y-6">
                                                {prescription.map((med, idx) => (
                                                    <li key={med.id} className="border-b border-gray-100 pb-4 last:border-0">
                                                        <div className="flex justify-between">
                                                            <div>
                                                                <span className="font-bold text-lg text-gray-900">{idx + 1}. {med.name}</span>
                                                                <span className="text-gray-600 ml-2 rtl:mr-2 rtl:ml-0">{med.dosage}</span>
                                                            </div>
                                                            <button onClick={() => setPrescription(prescription.filter(m => m.id !== med.id))} className="text-red-400 hover:text-red-600 print:hidden text-sm">{t('remove')}</button>
                                                        </div>
                                                        <div className="text-gray-700 mt-1 pl-4 rtl:pr-4 rtl:pl-0">
                                                            {t('medication_frequency_for_duration', { frequency: med.frequency, duration: med.duration })}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Footer for Print */}
                                    <div className="hidden print:block fixed bottom-0 w-full pb-8">
                                        <div className="flex justify-between items-end pt-4 border-t border-gray-300">
                                            <div className="text-sm text-gray-500">
                                                <p>{t('diagnosis')}: {diagnosis}</p>
                                                <p>{t('generated_by')}</p>
                                            </div>
                                            <div className="text-center">
                                                <div className="h-16 border-b border-gray-400 w-48 mb-2"></div>
                                                <p className="text-sm font-bold">{t('rx_doc_signature')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'SERVICES' && (
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* Service Catalog */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4">{t('add_services')}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {MOCK_SERVICES.map(service => (
                                            <button
                                                key={service.id}
                                                onClick={() => onAddService(appointment.id, service)}
                                                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-all text-left"
                                            >
                                                <div>
                                                    <div className="font-semibold text-gray-900">{service.name}</div>
                                                    <div className="text-xs text-gray-500">{service.category}</div>
                                                </div>
                                                <div className="text-primary-600 font-bold">
                                                    +{service.price}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Current Invoice View */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-4 flex justify-between items-center">
                                        <span>{t('invoice_title')}</span>
                                        <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-mono">
                                            {t('total')}: {appointment.billing.total.toFixed(2)} EGP
                                        </span>
                                    </h3>

                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase">{t('item')}</th>
                                                    <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase">{t('qty')}</th>
                                                    <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase">{t('price')}</th>
                                                    <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase">{t('total')}</th>
                                                    <th className="px-6 py-3 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase">{t('actions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {appointment.billing.items.map(item => (
                                                    <tr key={item.id}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unitPrice}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{item.total}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right rtl:text-left text-sm">
                                                            {item.serviceId.startsWith('srv_cns') ? (
                                                                <span className="text-gray-400 text-xs italic">{t('base_fee')}</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => onRemoveService(appointment.id, item.id)}
                                                                    className="text-red-500 hover:text-red-700"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedVisit && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print:hidden"
                    onClick={() => {
                        setSelectedVisit(null);
                        setShowPreviousVitals(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">{t('visit_details')}</h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedVisit(null);
                                    setShowPreviousVitals(false);
                                }}
                                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                aria-label={t('close')}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t('visit_date')}</p>
                                <p className="text-base text-gray-900 font-semibold">{selectedVisit.date ?? '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t('diagnosis')}</p>
                                <p className="text-sm text-gray-700">{selectedVisit.diagnosis ?? '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t('plan')}</p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedVisit.plan ?? '-'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t('next_visit_date')}</p>
                                <p className="text-sm text-gray-700">{selectedVisit.nextVisitDate ?? '-'}</p>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('previous_prescription')}</p>
                                </div>
                                {selectedVisit.prescription && selectedVisit.prescription.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedVisit.prescription.map((medication) => (
                                            <div key={medication.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                                                <p className="text-sm font-semibold text-gray-800">{medication.name}</p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {[medication.dosage, medication.frequency, medication.duration].filter(Boolean).join(' • ') || '-'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">{t('no_previous_prescription')}</p>
                                )}
                            </div>

                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowPreviousVitals((current) => !current)}
                                    className="px-3 py-2 text-sm font-medium rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 transition-colors"
                                >
                                    {showPreviousVitals ? t('hide_previous_vitals') : t('show_previous_vitals')}
                                </button>
                                {showPreviousVitals && (
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="rounded-lg border border-gray-200 p-2">
                                            <p className="text-xs text-gray-500">{t('blood_pressure')}</p>
                                            <p className="text-sm font-semibold text-gray-800">
                                                {selectedVisit.vitals?.bpSystolic ?? '-'} / {selectedVisit.vitals?.bpDiastolic ?? '-'}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 p-2">
                                            <p className="text-xs text-gray-500">{t('heart_rate')}</p>
                                            <p className="text-sm font-semibold text-gray-800">{selectedVisit.vitals?.heartRate ?? '-'}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 p-2">
                                            <p className="text-xs text-gray-500">{t('temp')}</p>
                                            <p className="text-sm font-semibold text-gray-800">{selectedVisit.vitals?.temperature ?? '-'}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 p-2">
                                            <p className="text-xs text-gray-500">{t('oxygen')}</p>
                                            <p className="text-sm font-semibold text-gray-800">{selectedVisit.vitals?.oxygenSat ?? '-'}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
