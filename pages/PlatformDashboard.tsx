import React, { useEffect, useMemo, useState } from 'react';
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

  const loadClinics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPlatformClinicsFromApi();
      setClinics(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load clinics');
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
      setError('Failed to load timeline');
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
      setError('Failed to update clinic status');
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
      setError('Failed to record payment');
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
      setError('Failed to create subscription');
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
      alert('Failed to load expiring clinics');
    } finally {
      setExpiringLoading(false);
    }
  };

  const onSaveNewClinic = async () => {
    if (!newClinicForm.clinic_name || !newClinicForm.admin_name || !newClinicForm.admin_phone) {
      setClinicCreateError('مطلوب اسم العيادة واسم المدير ورقم هاتفه.');
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
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء العيادة';
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
            <h1 className="text-2xl font-bold text-gray-800">العيادات المشتركة</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={onLoadExpiring}
                className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-medium hover:bg-orange-200 transition shadow-sm border border-orange-200"
              >
                العيادات المنتهية قريباً
              </button>
              <button
                onClick={() => { setCreatingClinic(true); setClinicCreateError(null); setClinicCreateSuccess(null); }}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-700 transition shadow-sm"
              >
                + إنشاء عيادة جديدة
              </button>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-right" dir="rtl">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">اسم العيادة</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">الحالة</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">نوع الاشتراك</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider">رقم الهاتف الأساسي</th>
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
                        {clinic.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {clinic.subscriptionType === 'LIFETIME' ? 'شراء لمرة واحدة (مدى الحياة)' : 'اشتراك سنوي'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono">
                      {(clinic.settings as any)?.phone || (clinic.settings as any)?.main_phone || (clinic.settings as any)?.contactPhone || 'غير مسجل'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clinics.length === 0 && (
              <div className="p-8 text-center text-gray-500">لا توجد عيادات مسجلة حالياً.</div>
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
              &rarr; العودة للقائمة
            </button>
            <h1 className="text-2xl font-bold text-gray-800">تفاصيل العيادة: <span className="text-primary-600">{selectedClinic?.name}</span></h1>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admin User Card */}
            {selectedClinic?.adminUser && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
                <h2 className="text-lg font-bold text-gray-800 border-b pb-2">مدير العيادة</h2>
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
                        alert('تم نسخ رابط دخول المدير!');
                      } catch (err) {
                        const message = err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الرابط';
                        alert(message);
                      }
                    }}
                    className="w-full mt-1 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                  >
                    إنشاء رابط إعادة كلمة المرور
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 italic">لا يوجد بريد إلكتروني — لا يمكن إنشاء رابط دخول بدونه</p>
                )}
              </div>
            )}

            {/* Status Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-2">الحالة والإعدادات</h2>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">حالة الاشتراك</span>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-500"
                  value={selectedClinic?.subscriptionStatus}
                  disabled={savingClinicId === selectedClinic?.id}
                  onChange={(event) => onStatusChange(selectedClinic!.id, event.target.value)}
                >
                  <option value="active">Active (فعال)</option>
                  <option value="grace">Grace (فترة سماح)</option>
                  <option value="suspended">Suspended (معلق)</option>
                  <option value="expired">Expired (منتهي)</option>
                </select>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-gray-500">الحالة الفعالة:</span>
                <span className="font-semibold">{selectedClinic?.effectiveStatus ?? '-'}</span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-gray-500">تاريخ الإنشاء:</span>
                <span className="font-medium text-gray-700">{selectedClinic?.createdAt ? new Date(selectedClinic.createdAt).toLocaleDateString() : '-'}</span>
              </div>
            </div>

            {/* Entitlements Card */}
            {selectedClinic?.entitlements ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-bold text-gray-800 border-b pb-2 flex-1">حدود العيادة والاستخدام</h2>
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
                      تعديل الحدود
                    </button>
                  )}
                </div>

                {editingLimits ? (
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">الحد الأقصى للفروع</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                          value={limitsForm.max_branches}
                          onChange={(e) => setLimitsForm({ ...limitsForm, max_branches: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">الحد الأقصى للأطباء</label>
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
                        إلغاء
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await import('../services/api').then(m => m.updatePlatformClinicEntitlementsViaApi(selectedClinic.id, limitsForm.max_branches, limitsForm.max_doctors));
                            await loadClinics();
                            setEditingLimits(false);
                          } catch (e) {
                            alert('Failed to update limits');
                          }
                        }}
                        className="px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
                      >
                        حفظ التعديلات
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center">
                      <span className="text-gray-500 font-medium mb-1">الفروع</span>
                      <div className="text-2xl font-bold text-gray-800">
                        <span className={selectedClinic.entitlements.current_branches > selectedClinic.entitlements.max_branches ? 'text-red-500' : 'text-green-600'}>
                          {selectedClinic.entitlements.current_branches}
                        </span>
                        <span className="text-gray-400 text-lg mx-1">/</span>
                        {selectedClinic.entitlements.max_branches}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center">
                      <span className="text-gray-500 font-medium mb-1">الأطباء</span>
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
                لم يتم تعيين حدود للعيادة (تأكد من وجود اشتراك نشط)
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gray-50 p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">الاشتراكات والمدفوعات</h2>
            </div>
            <div className="p-5 space-y-6">
              {timelineLoading && <p className="text-sm text-gray-500">جاري التحميل...</p>}

              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1">الاشتراك</label>
                  <select className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white" value={paymentForm.clinic_subscription_id} onChange={(e) => setPaymentForm((prev) => ({ ...prev, clinic_subscription_id: e.target.value }))}>
                    <option value="">اختر...</option>
                    {timeline.map((s) => <option key={s.id} value={s.id}>#{s.id} ({s.license.type})</option>)}
                  </select>
                </div>

                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1">النوع</label>
                  <select className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white" value={paymentForm.payment_kind} onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_kind: e.target.value as 'LICENSE' | 'HOSTING' }))}>
                    {selectedClinic?.subscriptionType === 'LIFETIME' ? (
                      <>
                        <option value="LICENSE">ترخيص لمرة واحدة</option>
                        <option value="HOSTING">تجديد استضافة</option>
                      </>
                    ) : (
                      <option value="LICENSE">اشتراك سنوي (شامل الاستضافة)</option>
                    )}
                  </select>
                </div>

                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1">السنوات</label>
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
                  <label className="text-xs font-semibold text-gray-600 mb-1">المبلغ</label>
                  <input className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white disabled:bg-gray-100" type="number" min={0} disabled={!paymentForm.clinic_subscription_id} value={paymentForm.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: Number(e.target.value) }))} />
                </div>

                <div className="flex flex-col md:col-span-1">
                  <label className="text-xs font-semibold text-gray-600 mb-1">التاريخ</label>
                  <input className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white disabled:bg-gray-100" type="date" disabled={!paymentForm.clinic_subscription_id} value={paymentForm.paid_at} onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid_at: e.target.value }))} />
                </div>

                <button disabled={!paymentForm.clinic_subscription_id} className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors md:col-span-1 shadow-sm" onClick={onRecordPayment}>
                  تسجيل دفعة
                </button>
              </div>

              {!timelineLoading && timeline.length === 0 && !creatingSubscription && (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  <p className="text-gray-500 mb-4 font-medium">لا توجد سجلات اشتراك لهذه العيادة.</p>
                  <button
                    onClick={() => setCreatingSubscription(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm"
                  >
                    إنشاء اشتراك جديد
                  </button>
                </div>
              )}

              {creatingSubscription && (
                <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">إنشاء اشتراك جديد للعيادة</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الاشتراك الأساسي</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        value={newSubscriptionForm.type}
                        onChange={(e) => setNewSubscriptionForm(prev => ({ ...prev, type: e.target.value as 'LIFETIME' | 'ANNUAL' }))}
                      >
                        <option value="ANNUAL">اشتراك سنوي (Annual)</option>
                        <option value="LIFETIME">شراء لمرة واحدة (Lifetime)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ بداية الاشتراك</label>
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
                      إلغاء
                    </button>
                    <button
                      onClick={onCreateSubscription}
                      className="px-6 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
                    >
                      تأكيد إنشاء الاشتراك
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {timeline.map((sub) => (
                  <div key={sub.id} className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
                      <div className="font-bold text-gray-800">الاشتراك #{sub.id} <span className="text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded-md border ml-2">{sub.license.type}</span></div>
                      <div>
                        {sub.effectiveStatus === 'active' && <span className="text-green-700 bg-green-100 px-2 py-1 text-xs rounded-full font-bold">نشط</span>}
                        {sub.effectiveStatus !== 'active' && <span className="text-yellow-700 bg-yellow-100 px-2 py-1 text-xs rounded-full font-bold">{sub.effectiveStatus}</span>}
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      {sub.license.type === 'LIFETIME' ? (
                        <>
                          <div>
                            <span className="font-semibold block mb-1">الرخصة لمرة واحدة:</span>
                            <div className="bg-gray-50 border rounded p-2">
                              {sub.license.startsAt ? new Date(sub.license.startsAt).toLocaleDateString() : '-'} &rarr; {sub.license.endsAt ? new Date(sub.license.endsAt).toLocaleDateString() : 'مدى الحياة'}
                            </div>
                          </div>
                          <div>
                            <span className="font-semibold block mb-1">الاستضافة:</span>
                            <div className="bg-gray-50 border rounded p-2">
                              {sub.hosting.startsAt ? new Date(sub.hosting.startsAt).toLocaleDateString() : '-'} &rarr; {sub.hosting.endsAt ? new Date(sub.hosting.endsAt).toLocaleDateString() : 'غير مسددة'}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="md:col-span-2">
                          <span className="font-semibold block mb-1">فترة الاشتراك السنوي الشامل:</span>
                          <div className="bg-gray-50 border rounded p-2">
                            {sub.license.startsAt ? new Date(sub.license.startsAt).toLocaleDateString() : '-'} &rarr; {sub.license.endsAt ? new Date(sub.license.endsAt).toLocaleDateString() : 'لم يبدأ / منتهي'}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-4 pb-4">
                      <h4 className="font-bold text-sm mb-2 text-gray-800">المدفوعات السابقة</h4>
                      <ul className="space-y-2 text-sm">
                        {sub.payments.map((payment) => (
                          <li key={payment.id} className="border rounded-lg p-2.5 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors">
                            <span className="font-medium text-gray-700">{new Date(payment.paidAt).toLocaleDateString()}</span>
                            <span className="text-blue-700 font-semibold bg-blue-100 px-2 rounded">
                              {sub.license.type === 'LIFETIME'
                                ? (payment.paymentKind === 'LICENSE' ? 'رخصة مدى الحياة' : 'تجديد استضافة')
                                : 'تجديد اشتراك مجمع'}
                            </span>
                            <span className="text-gray-600">
                              {payment.periodYears === 1 ? 'سنة واحدة' : (payment.periodYears === 2 ? 'سنتين' : `${payment.periodYears} سنوات`)}
                            </span>
                            <span className="font-bold text-green-700">{payment.amount} ج.م</span>
                          </li>
                        ))}
                        {sub.payments.length === 0 && <li className="text-gray-400 text-sm border-t pt-2">لا توجد مدفوعات مسجلة لهذا الاشتراك.</li>}
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
              <h2 className="text-xl font-bold text-gray-800">المركز التنبيهي: اشتراكات/استضافات تقترب من الانتهاء (أقل من 30 يوم)</h2>
              <button
                onClick={() => setExpiringModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-gray-50" dir="rtl">
              {expiringLoading ? (
                <div className="flex justify-center items-center py-12 text-gray-500 font-medium">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 ml-3"></div>
                  جاري التحميل...
                </div>
              ) : expiringClinics.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed text-lg">
                  لا توجد عيادات اقترب موعد انتهاء استضافتها أو رسومها.
                </div>
              ) : (
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-orange-50 text-orange-900 border-b border-orange-100">
                      <tr>
                        <th className="px-6 py-4 font-bold">اسم العيادة</th>
                        <th className="px-6 py-4 font-bold">خطة الاشتراك</th>
                        <th className="px-6 py-4 font-bold">نهاية الترخيص</th>
                        <th className="px-6 py-4 font-bold">نهاية الاستضافة</th>
                        <th className="px-6 py-4 font-bold"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {expiringClinics.map((clinic) => (
                        <tr key={clinic.id} className="hover:bg-orange-50/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900">{clinic.name}</td>
                          <td className="px-6 py-4 font-medium text-gray-600">
                            {clinic.subscriptionType === 'LIFETIME' ? 'مدى الحياة' : 'سنوي'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-md text-xs font-bold ${clinic.subscriptionEndsAt && new Date(clinic.subscriptionEndsAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'bg-red-100 text-red-700' : 'text-gray-600'}`}>
                              {clinic.subscriptionEndsAt ? new Date(clinic.subscriptionEndsAt).toLocaleDateString() : 'مدى الحياة'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-md text-xs font-bold ${clinic.hostingEndsAt && new Date(clinic.hostingEndsAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'bg-orange-100 text-orange-800' : 'text-gray-600'}`}>
                              {clinic.hostingEndsAt ? new Date(clinic.hostingEndsAt).toLocaleDateString() : 'مدى الحياة'}
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
                              إدارة ودفع
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
              <h2 className="text-xl font-bold text-gray-800">إنشاء عيادة جديدة</h2>
              <button onClick={() => { setCreatingClinic(false); setClinicCreateSuccess(null); setClinicCreateError(null); }} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            {clinicCreateSuccess ? (
              <div className="p-6 space-y-4 text-center">
                <div className="text-5xl">🎉</div>
                <h3 className="text-xl font-bold text-green-700">تم إنشاء العيادة بنجاح!</h3>
                {clinicCreateSuccess.link ? (
                  <>
                    <p className="text-gray-600 text-sm">انسخ هذا الرابط وأرسله لمدير العيادة ليقوم بوضع كلمة مروره الخاصة:</p>
                    <div className="bg-gray-100 rounded-xl p-3 text-xs text-gray-700 break-all font-mono border">{clinicCreateSuccess.link}</div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(clinicCreateSuccess.link); alert('تم نسخ الرابط!'); }}
                      className="bg-primary-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-700 transition"
                    >
                      نسخ الرابط
                    </button>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">تم إنشاء العيادة ولكن فشل إنشاء رابط الدخول. يمكنك إنشاءه منصفحة الأطباء يدوياً.</p>
                )}
                <button
                  onClick={() => { setCreatingClinic(false); setClinicCreateSuccess(null); }}
                  className="mt-2 text-gray-500 hover:text-gray-700 text-sm underline"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {clinicCreateError && (
                  <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm">⚠ {clinicCreateError}</div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">اسم العيادة *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                    value={newClinicForm.clinic_name}
                    onChange={(e) => setNewClinicForm(p => ({ ...p, clinic_name: e.target.value }))}
                    placeholder="عيادة الفتح"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">اسم مدير العيادة *</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                      value={newClinicForm.admin_name}
                      onChange={(e) => setNewClinicForm(p => ({ ...p, admin_name: e.target.value }))}
                      placeholder="محمد فلان"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">رقم هاتف المدير *</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                      value={newClinicForm.admin_phone}
                      onChange={(e) => setNewClinicForm(p => ({ ...p, admin_phone: e.target.value }))}
                      placeholder="01012345678"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">بريد المدير الإلكتروني (اختياري)</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                    type="email"
                    value={newClinicForm.admin_email}
                    onChange={(e) => setNewClinicForm(p => ({ ...p, admin_email: e.target.value }))}
                    placeholder="admin@clinic.com"
                  />
                </div>

                <div className="border-t border-gray-200 pt-4 mt-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">خطة الاشتراك والقيود</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">نوع الاشتراك *</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500"
                        value={newClinicForm.subscription_type}
                        onChange={(e) => setNewClinicForm(p => ({ ...p, subscription_type: e.target.value as 'LIFETIME' | 'ANNUAL' }))}
                      >
                        <option value="ANNUAL">سنوي (Annual)</option>
                        <option value="LIFETIME">مدى الحياة (Lifetime)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">تاريخ بداية الاشتراك *</label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                        value={newClinicForm.starts_at}
                        onChange={(e) => setNewClinicForm(p => ({ ...p, starts_at: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">الحد الأقصى للفروع *</label>
                      <input
                        type="number" min={1}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                        value={newClinicForm.max_branches}
                        onChange={(e) => setNewClinicForm(p => ({ ...p, max_branches: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">الحد الأقصى للأطباء *</label>
                      <input
                        type="number" min={1}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500"
                        value={newClinicForm.max_doctors}
                        onChange={(e) => setNewClinicForm(p => ({ ...p, max_doctors: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">الحد الأقصى للموظفين</label>
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
                    إلغاء
                  </button>
                  <button
                    onClick={onSaveNewClinic}
                    disabled={clinicCreateSaving}
                    className="px-6 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition shadow-sm"
                  >
                    {clinicCreateSaving ? 'جاري الإنشاء...' : 'إنشاء العيادة'}
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
