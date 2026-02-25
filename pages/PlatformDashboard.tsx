import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPlatformClinicTimelineFromApi,
  getPlatformClinicsFromApi,
  PlatformClinic,
  PlatformSubscriptionTimeline,
  recordPlatformClinicPaymentViaApi,
  updatePlatformClinicStatusViaApi,
  createPlatformClinicViaApi,
  createAccessLinkViaApi,
} from '../services/api';

export const PlatformDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [clinics, setClinics] = useState<PlatformClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingClinicId, setSavingClinicId] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<PlatformSubscriptionTimeline[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [expiringModalOpen, setExpiringModalOpen] = useState(false);
  const [expiringClinics, setExpiringClinics] = useState<PlatformClinic[]>([]);
  const [expiringLoading, setExpiringLoading] = useState(false);
  const [editingLimits, setEditingLimits] = useState(false);
  const [limitsForm, setLimitsForm] = useState({ max_branches: 0, max_doctors: 0 });
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [newSubscriptionForm, setNewSubscriptionForm] = useState({
    type: 'ANNUAL' as 'LIFETIME' | 'ANNUAL',
    starts_at: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // --- Create Clinic Modal State ---
  const [creatingClinic, setCreatingClinic] = useState(false);
  const [clinicCreateError, setClinicCreateError] = useState<string | null>(null);
  const [clinicCreateSaving, setClinicCreateSaving] = useState(false);
  const [clinicCreateSuccess, setClinicCreateSuccess] = useState<{ link: string } | null>(null);
  const [newClinicForm, setNewClinicForm] = useState({
    clinic_name: '',
    admin_name: '',
    admin_phone: '',
    admin_email: '',
    subscription_type: 'ANNUAL' as 'LIFETIME' | 'ANNUAL',
    starts_at: new Date().toISOString().slice(0, 10),
    max_branches: 1,
    max_doctors: 3,
    max_staff: 10,
  });

  const [paymentForm, setPaymentForm] = useState({
    clinic_subscription_id: '',
    payment_kind: 'HOSTING' as 'LICENSE' | 'HOSTING',
    period_years: 1,
    amount: 0,
    paid_at: new Date().toISOString().slice(0, 10),
    notes: '',
    receipt_ref: '',
  });

  const isArabic = i18n.language?.startsWith('ar');
  const textAlignClass = isArabic ? 'text-right' : 'text-left';

  const getSubscriptionStatusLabel = (status?: string | null) => {
    if (!status) return '-';
    return t(`admin.platform_dashboard.subscription_status.${status}`);
  };

  const getSubscriptionTypeLabel = (type: 'LIFETIME' | 'ANNUAL') => {
    return t(`admin.platform_dashboard.subscription_type.${type.toLowerCase()}`);
  };

  const loadClinics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPlatformClinicsFromApi();
      setClinics(data);
    } catch (err) {
      console.error(err);
      setError(t('admin.platform_dashboard.errors.load_clinics'));
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async (clinicId: string) => {
    try {
      setTimelineLoading(true);
      const rows = await getPlatformClinicTimelineFromApi(clinicId);
      setTimeline(rows);
      setPaymentForm((prev) => ({
        ...prev,
        clinic_subscription_id: rows[0]?.id ?? '',
      }));
    } catch (err) {
      console.error(err);
      setError(t('admin.platform_dashboard.errors.load_timeline'));
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    loadClinics();
  }, []);

  useEffect(() => {
    if (selectedClinicId) {
      setEditingLimits(false);
      loadTimeline(selectedClinicId);
    }
  }, [selectedClinicId]);

  const onStatusChange = async (clinicId: string, status: string) => {
    try {
      setSavingClinicId(clinicId);
      const updated = await updatePlatformClinicStatusViaApi(clinicId, status);
      setClinics((prev) => prev.map((clinic) => (clinic.id === clinicId ? updated : clinic)));
      if (clinicId === selectedClinicId) {
        loadTimeline(clinicId);
      }
    } catch (err) {
      console.error(err);
      setError(t('admin.platform_dashboard.errors.update_status'));
    } finally {
      setSavingClinicId(null);
    }
  };

  const selectedClinic = useMemo(() => clinics.find((clinic) => clinic.id === selectedClinicId) ?? null, [clinics, selectedClinicId]);

  const onRecordPayment = async () => {
    if (!selectedClinicId || !paymentForm.clinic_subscription_id) {
      return;
    }

    const payloadToSubmit = {
      ...paymentForm,
      payment_kind: selectedClinic?.subscriptionType === 'ANNUAL' ? 'LICENSE' : paymentForm.payment_kind,
      period_years: (selectedClinic?.subscriptionType === 'LIFETIME' && paymentForm.payment_kind === 'LICENSE') ? 1 : paymentForm.period_years
    };

    try {
      await recordPlatformClinicPaymentViaApi(selectedClinicId, payloadToSubmit);
      await loadTimeline(selectedClinicId);
      setPaymentForm(prev => ({ ...prev, amount: 0 }));
    } catch (err) {
      console.error(err);
      setError(t('admin.platform_dashboard.errors.record_payment'));
    }
  };

  const onCreateSubscription = async () => {
    if (!selectedClinicId) return;
    try {
      const { storePlatformClinicSubscriptionViaApi } = await import('../services/api');
      await storePlatformClinicSubscriptionViaApi(selectedClinicId, newSubscriptionForm);
      setCreatingSubscription(false);
      await loadTimeline(selectedClinicId);
      await loadClinics();
    } catch (err) {
      console.error(err);
      setError(t('admin.platform_dashboard.errors.create_subscription'));
    }
  };

  const onLoadExpiring = async () => {
    try {
      setExpiringModalOpen(true);
      setExpiringLoading(true);
      const { getExpiringPlatformClinicsFromApi } = await import('../services/api');
      const data = await getExpiringPlatformClinicsFromApi(30);
      setExpiringClinics(data);
    } catch (err) {
      console.error(err);
      alert(t('admin.platform_dashboard.errors.load_expiring'));
    } finally {
      setExpiringLoading(false);
    }
  };

  const onSaveNewClinic = async () => {
    if (!newClinicForm.clinic_name || !newClinicForm.admin_name || !newClinicForm.admin_phone) {
      setClinicCreateError(t('admin.platform_dashboard.errors.required_clinic_fields'));
      return;
    }
    try {
      setClinicCreateSaving(true);
      setClinicCreateError(null);
      const result = await createPlatformClinicViaApi(newClinicForm);
      await loadClinics();
      // Generate access link for the new admin
      try {
        const { token } = await createAccessLinkViaApi(String(result.admin_user_id));
        const link = `${window.location.origin}${window.location.pathname}?accessToken=${encodeURIComponent(token)}`;
        setClinicCreateSuccess({ link });
      } catch {
        // Even if link gen fails, creation succeeded
        setClinicCreateSuccess({ link: '' });
      }
      setNewClinicForm({ clinic_name: '', admin_name: '', admin_phone: '', admin_email: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('admin.platform_dashboard.errors.create_clinic');
      setClinicCreateError(message);
    } finally {
      setClinicCreateSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {!selectedClinicId ? (
        // --- LIST VIEW ---
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">{t('admin.platform_dashboard.title')}</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={onLoadExpiring}
                className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-medium hover:bg-orange-200 transition shadow-sm border border-orange-200"
              >
                {t('admin.platform_dashboard.expiring_soon')}
              </button>
              <button
                onClick={() => { setCreatingClinic(true); setClinicCreateError(null); setClinicCreateSuccess(null); }}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-700 transition shadow-sm"
              >
                {t('admin.platform_dashboard.create_clinic_cta')}
              </button>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className={`w-full text-sm ${textAlignClass}`}>
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">{t('admin.platform_dashboard.table.clinic_name')}</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">{t('admin.platform_dashboard.table.status')}</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">{t('admin.platform_dashboard.table.subscription_type')}</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">{t('admin.platform_dashboard.table.primary_phone')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clinics.map((clinic) => (
                  <tr
                    key={clinic.id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors group"
                    onClick={() => setSelectedClinicId(clinic.id)}
                  >
                    <td className="px-6 py-4 font-bold text-gray-900 group-hover:text-blue-700">{clinic.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${clinic.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                        clinic.subscriptionStatus === 'grace' ? 'bg-yellow-100 text-yellow-800' :
                          clinic.subscriptionStatus === 'suspended' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                        {getSubscriptionStatusLabel(clinic.subscriptionStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {getSubscriptionTypeLabel(clinic.subscriptionType)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono">
                      {(clinic.settings as any)?.phone || (clinic.settings as any)?.main_phone || (clinic.settings as any)?.contactPhone || t('admin.platform_dashboard.not_registered')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clinics.length === 0 && (
              <div className="p-8 text-center text-gray-500">{t('admin.platform_dashboard.empty_clinics')}</div>
            )}
          </div>
        </div>
      ) : (
        // --- DETAILS VIEW ---
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-4 border-b pb-4">
            <button
              onClick={() => setSelectedClinicId(null)}
              className="text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2 text-sm font-medium transition-colors"
            >
              {t('admin.platform_dashboard.back_to_list')}
            </button>
            <h1 className="text-2xl font-bold text-gray-800">{t('admin.platform_dashboard.clinic_details')}: <span className="text-primary-600">{selectedClinic?.name}</span></h1>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admin User Card */}
            {selectedClinic?.adminUser && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
                <h2 className="text-lg font-bold text-gray-800 border-b pb-2">{t('admin.platform_dashboard.clinic_admin')}</h2>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-lg shrink-0">
                    {selectedClinic.adminUser.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{selectedClinic.adminUser.name}</p>
                    {selectedClinic.adminUser.email && (
                      <p className="text-sm text-gray-500 truncate">{selectedClinic.adminUser.email}</p>
                    )}
                    {selectedClinic.adminUser.phone && (
                      <p className="text-sm text-gray-500">{selectedClinic.adminUser.phone}</p>
                    )}
                  </div>
                </div>
                {selectedClinic.adminUser.email ? (
                  <button
                    onClick={async () => {
                      try {
                        const { createAccessLinkViaApi } = await import('../services/api');
                        const { token } = await createAccessLinkViaApi(selectedClinic.adminUser!.id);
                        const link = `${window.location.origin}${window.location.pathname}?accessToken=${encodeURIComponent(token)}`;
                        await navigator.clipboard.writeText(link);
                        alert(t('admin.platform_dashboard.admin_link_copied'));
                      } catch (err) {
                        const message = err instanceof Error ? err.message : t('admin.platform_dashboard.errors.create_link');
                        alert(message);
                      }
                    }}
                    className="w-full mt-1 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                  >
                    {t('admin.platform_dashboard.create_reset_link')}
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 italic">{t('admin.platform_dashboard.no_email_no_link')}</p>
                )}
              </div>
            )}

            {/* Status Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-2">{t('admin.platform_dashboard.status_settings')}</h2>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{t('admin.platform_dashboard.subscription_status_label')}</span>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500"
                  value={selectedClinic?.subscriptionStatus}
                  disabled={savingClinicId === selectedClinic?.id}
                  onChange={(event) => onStatusChange(selectedClinic!.id, event.target.value)}
                >
                  <option value="active">{t('admin.platform_dashboard.subscription_status.active')}</option>
                  <option value="grace">{t('admin.platform_dashboard.subscription_status.grace')}</option>
                  <option value="suspended">{t('admin.platform_dashboard.subscription_status.suspended')}</option>
                  <option value="expired">{t('admin.platform_dashboard.subscription_status.expired')}</option>
                </select>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-gray-500">{t('admin.platform_dashboard.effective_status')}:</span>
                <span className="font-semibold">{selectedClinic?.effectiveStatus ? getSubscriptionStatusLabel(selectedClinic.effectiveStatus) : '-'}</span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-gray-500">{t('admin.platform_dashboard.created_at')}:</span>
                <span className="font-medium text-gray-700">{selectedClinic?.createdAt ? new Date(selectedClinic.createdAt).toLocaleDateString() : '-'}</span>
              </div>
            </div>

            {/* Entitlements Card */}
            {selectedClinic?.entitlements ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-bold text-gray-800 border-b pb-2 flex-1">{t('admin.platform_dashboard.entitlements')}</h2>
                  {!editingLimits && (
                    <button
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition"
                      onClick={() => {
                        setLimitsForm({
                          max_branches: selectedClinic.entitlements?.max_branches || 1,
                          max_doctors: selectedClinic.entitlements?.max_doctors || 1,
                        });
                        setEditingLimits(true);
                      }}
                    >
                      {t('admin.platform_dashboard.edit_limits')}
                    </button>
                  )}
                </div>

                {editingLimits ? (
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.max_branches')}</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                          value={limitsForm.max_branches}
                          onChange={(e) => setLimitsForm({ ...limitsForm, max_branches: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.max_doctors')}</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                          value={limitsForm.max_doctors}
                          onChange={(e) => setLimitsForm({ ...limitsForm, max_doctors: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setEditingLimits(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {t('admin.cancel')}
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await import('../services/api').then(m => m.updatePlatformClinicEntitlementsViaApi(selectedClinic.id, limitsForm.max_branches, limitsForm.max_doctors));
                            await loadClinics();
                            setEditingLimits(false);
                          } catch (e) {
                            alert(t('admin.platform_dashboard.errors.update_limits'));
                          }
                        }}
                        className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
                      >
                        {t('admin.platform_dashboard.save_changes')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center">
                      <span className="text-gray-500 font-medium mb-1">{t('admin.platform_dashboard.branches')}</span>
                      <div className="text-2xl font-bold text-gray-800">
                        <span className={selectedClinic.entitlements.current_branches > selectedClinic.entitlements.max_branches ? 'text-red-500' : 'text-green-600'}>
                          {selectedClinic.entitlements.current_branches}
                        </span>
                        <span className="text-gray-400 text-lg mx-1">/</span>
                        {selectedClinic.entitlements.max_branches}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center">
                      <span className="text-gray-500 font-medium mb-1">{t('admin.platform_dashboard.doctors')}</span>
                      <div className="text-2xl font-bold text-gray-800">
                        <span className={selectedClinic.entitlements.current_doctors > selectedClinic.entitlements.max_doctors ? 'text-red-500' : 'text-blue-600'}>
                          {selectedClinic.entitlements.current_doctors}
                        </span>
                        <span className="text-gray-400 text-lg mx-1">/</span>
                        {selectedClinic.entitlements.max_doctors}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-center text-gray-400">
                {t('admin.platform_dashboard.no_entitlements')}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gray-50 p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">{t('admin.platform_dashboard.subscriptions_payments')}</h2>
            </div>
            <div className="p-5 space-y-6">
              {timelineLoading && <p className="text-sm text-gray-500">{t('admin.platform_dashboard.loading')}</p>}

              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1">{t('admin.platform_dashboard.subscription')}</label>
                  <select className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white" value={paymentForm.clinic_subscription_id} onChange={(e) => setPaymentForm((prev) => ({ ...prev, clinic_subscription_id: e.target.value }))}>
                    <option value="">{t('admin.platform_dashboard.select')}</option>
                    {timeline.map((s) => <option key={s.id} value={s.id}>#{s.id} ({getSubscriptionTypeLabel(s.license.type)})</option>)}
                  </select>
                </div>

                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1">{t('admin.platform_dashboard.type')}</label>
                  <select className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white" value={paymentForm.payment_kind} onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_kind: e.target.value as 'LICENSE' | 'HOSTING' }))}>
                    {selectedClinic?.subscriptionType === 'LIFETIME' ? (
                      <>
                        <option value="LICENSE">{t('admin.platform_dashboard.payment_kind.license')}</option>
                        <option value="HOSTING">{t('admin.platform_dashboard.payment_kind.hosting')}</option>
                      </>
                    ) : (
                      <option value="LICENSE">{t('admin.platform_dashboard.payment_kind.annual_bundle')}</option>
                    )}
                  </select>
                </div>

                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1">{t('admin.platform_dashboard.years')}</label>
                  <input
                    className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500"
                    type="number"
                    min={1}
                    disabled={!paymentForm.clinic_subscription_id || (selectedClinic?.subscriptionType === 'LIFETIME' && paymentForm.payment_kind === 'LICENSE')}
                    value={selectedClinic?.subscriptionType === 'LIFETIME' && paymentForm.payment_kind === 'LICENSE' ? 1 : paymentForm.period_years}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, period_years: Number(e.target.value) }))}
                  />
                </div>

                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1">{t('admin.platform_dashboard.amount')}</label>
                  <input className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white disabled:bg-gray-100" type="number" min={0} disabled={!paymentForm.clinic_subscription_id} value={paymentForm.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: Number(e.target.value) }))} />
                </div>

                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1">{t('admin.platform_dashboard.date')}</label>
                  <input className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white disabled:bg-gray-100" type="date" disabled={!paymentForm.clinic_subscription_id} value={paymentForm.paid_at} onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid_at: e.target.value }))} />
                </div>

                <button disabled={!paymentForm.clinic_subscription_id} className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors md:col-span-1 shadow-sm" onClick={onRecordPayment}>
                  {t('admin.platform_dashboard.record_payment')}
                </button>
              </div>

              {!timelineLoading && timeline.length === 0 && !creatingSubscription && (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <p className="text-gray-500 mb-4 font-medium">{t('admin.platform_dashboard.no_subscription_records')}</p>
                  <button
                    onClick={() => setCreatingSubscription(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm"
                  >
                    {t('admin.platform_dashboard.create_subscription')}
                  </button>
                </div>
              )}

              {creatingSubscription && (
                <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">{t('admin.platform_dashboard.create_subscription_for_clinic')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.base_subscription_type')}</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={newSubscriptionForm.type}
                        onChange={(e) => setNewSubscriptionForm(prev => ({ ...prev, type: e.target.value as 'LIFETIME' | 'ANNUAL' }))}
                      >
                        <option value="ANNUAL">{t('admin.platform_dashboard.subscription_type.annual')}</option>
                        <option value="LIFETIME">{t('admin.platform_dashboard.subscription_type.lifetime')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.subscription_start_date')}</label>
                      <input
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        type="date"
                        value={newSubscriptionForm.starts_at}
                        onChange={(e) => setNewSubscriptionForm(prev => ({ ...prev, starts_at: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      onClick={() => setCreatingSubscription(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {t('admin.cancel')}
                    </button>
                    <button
                      onClick={onCreateSubscription}
                      className="px-6 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
                    >
                      {t('admin.platform_dashboard.confirm_create_subscription')}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {timeline.map((sub) => (
                  <div key={sub.id} className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
                      <div className="font-bold text-gray-800">{t('admin.platform_dashboard.subscription_number', { id: sub.id })} <span className="text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded-md border ml-2">{getSubscriptionTypeLabel(sub.license.type)}</span></div>
                      <div>
                        {sub.effectiveStatus === 'active' && <span className="text-green-700 bg-green-100 px-2 py-1 text-xs rounded-full font-bold">{getSubscriptionStatusLabel(sub.effectiveStatus)}</span>}
                        {sub.effectiveStatus !== 'active' && <span className="text-yellow-700 bg-yellow-100 px-2 py-1 text-xs rounded-full font-bold">{getSubscriptionStatusLabel(sub.effectiveStatus)}</span>}
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      {sub.license.type === 'LIFETIME' ? (
                        <>
                          <div>
                            <span className="font-semibold block mb-1">{t('admin.platform_dashboard.one_time_license')}:</span>
                            <div className="bg-gray-50 border rounded p-2">
                              {sub.license.startsAt ? new Date(sub.license.startsAt).toLocaleDateString() : '-'} &rarr; {sub.license.endsAt ? new Date(sub.license.endsAt).toLocaleDateString() : t('admin.platform_dashboard.lifetime')}
                            </div>
                          </div>
                          <div>
                            <span className="font-semibold block mb-1">{t('admin.platform_dashboard.hosting')}:</span>
                            <div className="bg-gray-50 border rounded p-2">
                              {sub.hosting.startsAt ? new Date(sub.hosting.startsAt).toLocaleDateString() : '-'} &rarr; {sub.hosting.endsAt ? new Date(sub.hosting.endsAt).toLocaleDateString() : t('admin.platform_dashboard.unpaid')}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="md:col-span-2">
                          <span className="font-semibold block mb-1">{t('admin.platform_dashboard.annual_period')}:</span>
                          <div className="bg-gray-50 border rounded p-2">
                            {sub.license.startsAt ? new Date(sub.license.startsAt).toLocaleDateString() : '-'} &rarr; {sub.license.endsAt ? new Date(sub.license.endsAt).toLocaleDateString() : t('admin.platform_dashboard.not_started_or_expired')}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-4 pb-4">
                      <h4 className="font-bold text-sm mb-2 text-gray-800">{t('admin.platform_dashboard.previous_payments')}</h4>
                      <ul className="space-y-2 text-sm">
                        {sub.payments.map((payment) => (
                          <li key={payment.id} className="border rounded-lg p-2.5 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors">
                            <span className="font-medium text-gray-700">{new Date(payment.paidAt).toLocaleDateString()}</span>
                            <span className="text-blue-700 font-semibold bg-blue-100 px-2 rounded">
                              {sub.license.type === 'LIFETIME'
                                ? (payment.paymentKind === 'LICENSE' ? t('admin.platform_dashboard.payment_label.lifetime_license') : t('admin.platform_dashboard.payment_label.hosting_renewal'))
                                : t('admin.platform_dashboard.payment_label.bundle_renewal')}
                            </span>
                            <span className="text-gray-600">
                              {payment.periodYears === 1 ? t('admin.platform_dashboard.duration.one_year') : (payment.periodYears === 2 ? t('admin.platform_dashboard.duration.two_years') : t('admin.platform_dashboard.duration.years', { count: payment.periodYears }))}
                            </span>
                            <span className="font-bold text-green-700">{payment.amount} {t('admin.platform_dashboard.currency')}</span>
                          </li>
                        ))}
                        {sub.payments.length === 0 && <li className="text-gray-400 text-sm border-t pt-2">{t('admin.platform_dashboard.no_payments')}</li>}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {expiringModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">{t('admin.platform_dashboard.expiring_center_title')}</h2>
              <button
                onClick={() => setExpiringModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
              {expiringLoading ? (
                <div className="flex justify-center items-center py-12 text-gray-500 font-medium">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 ml-3"></div>
                  {t('admin.platform_dashboard.loading')}
                </div>
              ) : expiringClinics.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed text-lg">
                  {t('admin.platform_dashboard.no_expiring_clinics')}
                </div>
              ) : (
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                  <table className={`w-full text-sm ${textAlignClass}`}>
                    <thead className="bg-orange-50 text-orange-900 border-b border-orange-100">
                      <tr>
                        <th className="px-6 py-4 font-bold">{t('admin.platform_dashboard.table.clinic_name')}</th>
                        <th className="px-6 py-4 font-bold">{t('admin.platform_dashboard.plan')}</th>
                        <th className="px-6 py-4 font-bold">{t('admin.platform_dashboard.license_end')}</th>
                        <th className="px-6 py-4 font-bold">{t('admin.platform_dashboard.hosting_end')}</th>
                        <th className="px-6 py-4 font-bold"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {expiringClinics.map((clinic) => (
                        <tr key={clinic.id} className="hover:bg-orange-50/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900">{clinic.name}</td>
                          <td className="px-6 py-4 font-medium text-gray-600">
                            {clinic.subscriptionType === 'LIFETIME' ? t('admin.platform_dashboard.lifetime') : t('admin.platform_dashboard.annual')}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-md text-xs font-bold ${clinic.subscriptionEndsAt && new Date(clinic.subscriptionEndsAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'bg-red-100 text-red-700' : 'text-gray-600'}`}>
                              {clinic.subscriptionEndsAt ? new Date(clinic.subscriptionEndsAt).toLocaleDateString() : t('admin.platform_dashboard.lifetime')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-md text-xs font-bold ${clinic.hostingEndsAt && new Date(clinic.hostingEndsAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'bg-orange-100 text-orange-800' : 'text-gray-600'}`}>
                              {clinic.hostingEndsAt ? new Date(clinic.hostingEndsAt).toLocaleDateString() : t('admin.platform_dashboard.lifetime')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-left">
                            <button
                              className="text-primary-600 hover:text-primary-800 font-bold bg-primary-50 px-3 py-1.5 rounded-lg transition"
                              onClick={() => {
                                setExpiringModalOpen(false);
                                setSelectedClinicId(clinic.id);
                              }}
                            >
                              {t('admin.platform_dashboard.manage_pay')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Clinic Modal */}
      {creatingClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">{t('admin.platform_dashboard.create_clinic_title')}</h2>
              <button onClick={() => { setCreatingClinic(false); setClinicCreateSuccess(null); setClinicCreateError(null); }} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            {clinicCreateSuccess ? (
              <div className="p-6 space-y-4 text-center">
                <div className="text-5xl">🎉</div>
                <h3 className="text-xl font-bold text-green-700">{t('admin.platform_dashboard.create_success_title')}</h3>
                {clinicCreateSuccess.link ? (
                  <>
                    <p className="text-gray-600 text-sm">{t('admin.platform_dashboard.create_success_desc')}</p>
                    <div className="bg-gray-100 rounded-xl p-3 text-xs text-gray-700 break-all font-mono border">{clinicCreateSuccess.link}</div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(clinicCreateSuccess.link); alert(t('admin.platform_dashboard.link_copied')); }}
                      className="bg-primary-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-700 transition"
                    >
                      {t('admin.platform_dashboard.copy_link')}
                    </button>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">{t('admin.platform_dashboard.create_success_no_link')}</p>
                )}
                <button
                  onClick={() => { setCreatingClinic(false); setClinicCreateSuccess(null); }}
                  className="mt-2 text-gray-500 hover:text-gray-700 text-sm underline"
                >
                  {t('admin.platform_dashboard.close')}
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {clinicCreateError && (
                  <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm">⚠ {clinicCreateError}</div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.form.clinic_name')} *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                    value={newClinicForm.clinic_name}
                    onChange={(e) => setNewClinicForm(p => ({ ...p, clinic_name: e.target.value }))}
                    placeholder={t('admin.platform_dashboard.form.clinic_name_placeholder')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.form.admin_name')} *</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                      value={newClinicForm.admin_name}
                      onChange={(e) => setNewClinicForm(p => ({ ...p, admin_name: e.target.value }))}
                      placeholder={t('admin.platform_dashboard.form.admin_name_placeholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.form.admin_phone')} *</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                      value={newClinicForm.admin_phone}
                      onChange={(e) => setNewClinicForm(p => ({ ...p, admin_phone: e.target.value }))}
                      placeholder={t('admin.platform_dashboard.form.admin_phone_placeholder')}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.form.admin_email_optional')}</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                    type="email"
                    value={newClinicForm.admin_email}
                    onChange={(e) => setNewClinicForm(p => ({ ...p, admin_email: e.target.value }))}
                    placeholder={t('admin.platform_dashboard.form.admin_email_placeholder')}
                  />
                </div>

                <div className="border-t border-gray-200 pt-4 mt-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t('admin.platform_dashboard.form.subscription_and_limits')}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.form.subscription_type')} *</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500"
                        value={newClinicForm.subscription_type}
                        onChange={(e) => setNewClinicForm(p => ({ ...p, subscription_type: e.target.value as 'LIFETIME' | 'ANNUAL' }))}
                      >
                        <option value="ANNUAL">{t('admin.platform_dashboard.annual')}</option>
                        <option value="LIFETIME">{t('admin.platform_dashboard.lifetime')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.form.subscription_start_date')} *</label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                        value={newClinicForm.starts_at}
                        onChange={(e) => setNewClinicForm(p => ({ ...p, starts_at: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.max_branches')} *</label>
                      <input
                        type="number" min={1}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                        value={newClinicForm.max_branches}
                        onChange={(e) => setNewClinicForm(p => ({ ...p, max_branches: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.max_doctors')} *</label>
                      <input
                        type="number" min={1}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                        value={newClinicForm.max_doctors}
                        onChange={(e) => setNewClinicForm(p => ({ ...p, max_doctors: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t('admin.platform_dashboard.form.max_staff')}</label>
                      <input
                        type="number" min={1}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                        value={newClinicForm.max_staff}
                        onChange={(e) => setNewClinicForm(p => ({ ...p, max_staff: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setCreatingClinic(false); setClinicCreateError(null); }}
                    className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                  >
                    {t('admin.cancel')}
                  </button>
                  <button
                    onClick={onSaveNewClinic}
                    disabled={clinicCreateSaving}
                    className="px-6 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition shadow-sm"
                  >
                    {clinicCreateSaving ? t('admin.platform_dashboard.creating') : t('admin.platform_dashboard.create_clinic')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
