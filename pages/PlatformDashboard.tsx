import React, { useEffect, useMemo, useState } from 'react';
import {
  getPlatformClinicTimelineFromApi,
  getPlatformClinicsFromApi,
  PlatformClinic,
  PlatformSubscriptionTimeline,
  recordPlatformClinicPaymentViaApi,
  updatePlatformClinicStatusViaApi,
} from '../services/api';

export const PlatformDashboard: React.FC = () => {
  const [clinics, setClinics] = useState<PlatformClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingClinicId, setSavingClinicId] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<PlatformSubscriptionTimeline[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

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
      if (!selectedClinicId && data.length > 0) {
        setSelectedClinicId(data[0].id);
      }
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

    try {
      await recordPlatformClinicPaymentViaApi(selectedClinicId, paymentForm);
      await loadTimeline(selectedClinicId);
    } catch (err) {
      console.error(err);
      setError('Failed to record payment');
    }
  };

  if (loading) {
    return <div className="p-6">Loading platform clinics...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Platform Dashboard</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Clinic</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Effective</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {clinics.map((clinic) => (
              <tr key={clinic.id} className={`border-t border-gray-100 ${selectedClinicId === clinic.id ? 'bg-blue-50' : ''}`} onClick={() => setSelectedClinicId(clinic.id)}>
                <td className="px-4 py-3">{clinic.name}</td>
                <td className="px-4 py-3">
                  <select
                    className="border border-gray-300 rounded-md px-2 py-1"
                    value={clinic.subscriptionStatus}
                    disabled={savingClinicId === clinic.id}
                    onChange={(event) => onStatusChange(clinic.id, event.target.value)}
                  >
                    <option value="active">active</option>
                    <option value="grace">grace</option>
                    <option value="suspended">suspended</option>
                    <option value="expired">expired</option>
                  </select>
                </td>
                <td className="px-4 py-3">{clinic.effectiveStatus ?? '-'}</td>
                <td className="px-4 py-3">{clinic.createdAt ? new Date(clinic.createdAt).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Subscription & Payment Timeline {selectedClinic ? `- ${selectedClinic.name}` : ''}</h2>
        {timelineLoading && <p className="text-sm text-gray-500">Loading timeline...</p>}

        <div className="grid grid-cols-6 gap-2 items-end">
          <select className="border rounded p-2" value={paymentForm.clinic_subscription_id} onChange={(e) => setPaymentForm((prev) => ({ ...prev, clinic_subscription_id: e.target.value }))}>
            <option value="">Subscription</option>
            {timeline.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
          </select>
          <select className="border rounded p-2" value={paymentForm.payment_kind} onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_kind: e.target.value as 'LICENSE' | 'HOSTING' }))}>
            <option value="LICENSE">LICENSE</option>
            <option value="HOSTING">HOSTING</option>
          </select>
          <input className="border rounded p-2" type="number" min={1} value={paymentForm.period_years} onChange={(e) => setPaymentForm((prev) => ({ ...prev, period_years: Number(e.target.value) }))} />
          <input className="border rounded p-2" type="number" min={0} value={paymentForm.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: Number(e.target.value) }))} />
          <input className="border rounded p-2" type="date" value={paymentForm.paid_at} onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid_at: e.target.value }))} />
          <button className="bg-blue-600 text-white px-3 py-2 rounded" onClick={onRecordPayment}>Record Payment</button>
        </div>

        {timeline.map((sub) => (
          <div key={sub.id} className="border rounded-lg p-3">
            <p className="font-medium">Subscription #{sub.id} · {sub.license.type} · {sub.effectiveStatus}</p>
            <p className="text-xs text-gray-600">License: {sub.license.startsAt ?? '-'} → {sub.license.endsAt ?? 'lifetime'} | Hosting: {sub.hosting.startsAt ?? '-'} → {sub.hosting.endsAt ?? '-'}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {sub.payments.map((payment) => (
                <li key={payment.id} className="border-t pt-1">{payment.paidAt?.slice(0, 10)} · {payment.paymentKind} · {payment.periodYears}y · {payment.amount}</li>
              ))}
              {sub.payments.length === 0 && <li className="text-gray-500">No payments yet.</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
