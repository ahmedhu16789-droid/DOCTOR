import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Wallet, X } from 'lucide-react';
import { KPICard } from '../components/dashboard/KPICard';
import {
  DoctorPayrollReportFilters,
  DoctorPayrollReportRecord,
  getDoctorPayrollReportFromApi,
  closeDoctorPayrollPeriod,
  settleDoctorPayrollPeriod,
  getDoctorsFromApi,
  getBranchesFromApi,
} from '../services/api';

const defaultFilters: DoctorPayrollReportFilters = {
  doctorId: '',
  branchId: '',
  periodMonth: '',
  status: '',
};

export const DoctorPayrollReports: React.FC = () => {
  const [filters, setFilters] = useState<DoctorPayrollReportFilters>(defaultFilters);
  const [reportRows, setReportRows] = useState<DoctorPayrollReportRecord[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [settlementRow, setSettlementRow] = useState<DoctorPayrollReportRecord | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');

  const loadReport = async (nextFilters?: DoctorPayrollReportFilters) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const payload = await getDoctorPayrollReportFromApi(nextFilters ?? filters);
      setReportRows(payload);
    } catch (error) {
      console.error('Failed to load doctor payroll report', error);
      setErrorMessage('تعذّر تحميل تقرير Payroll الأطباء');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const preloadFilters = async () => {
      try {
        const [doctorList, branchList] = await Promise.all([getDoctorsFromApi(), getBranchesFromApi()]);
        setDoctors(doctorList.map((doctor) => ({ id: doctor.id, name: doctor.name })));
        setBranches(branchList.map((branch) => ({ id: branch.id, name: branch.name })));
      } catch (error) {
        console.error('Failed to preload doctors/branches for payroll filters', error);
      }
    };

    preloadFilters();
    loadReport(defaultFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const totalEntitlement = reportRows.reduce((sum, row) => sum + (row.totalEarned + row.totalAdjustments), 0);
    const totalSettled = reportRows.reduce((sum, row) => sum + row.totalSettled, 0);

    return {
      totalEntitlement,
      totalSettled,
      totalRemaining: Math.max(totalEntitlement - totalSettled, 0),
    };
  }, [reportRows]);

  const handleFilterChange = (field: keyof DoctorPayrollReportFilters, value: string) => {
    const nextFilters = { ...filters, [field]: value };
    setFilters(nextFilters);
    loadReport(nextFilters);
  };

  const onCloseMonth = async (periodId: string) => {
    try {
      setActionLoadingId(periodId);
      await closeDoctorPayrollPeriod(periodId);
      await loadReport();
    } catch (error) {
      console.error('Failed to close payroll period', error);
      setErrorMessage('تعذّر إقفال الشهر');
    } finally {
      setActionLoadingId(null);
    }
  };

  const onOpenSettlementModal = (row: DoctorPayrollReportRecord) => {
    const remainingAmount = Math.max(row.totalEarned + row.totalAdjustments - row.totalSettled, 0);
    if (remainingAmount <= 0 || !row.canSettle) return;

    setErrorMessage('');
    setSettlementRow(row);
    setSettlementAmount(String(remainingAmount));
  };

  const onConfirmSettlement = async () => {
    if (!settlementRow) return;

    try {
      setActionLoadingId(settlementRow.periodId);
      const remainingAmount = Math.max(settlementRow.totalEarned + settlementRow.totalAdjustments - settlementRow.totalSettled, 0);
      const amount = Number(settlementAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        setErrorMessage('برجاء إدخال مبلغ صحيح أكبر من صفر.');
        return;
      }

      if (amount > remainingAmount) {
        setErrorMessage('مبلغ التسوية لا يمكن أن يتجاوز المتبقي للطبيب.');
        return;
      }

      await settleDoctorPayrollPeriod(settlementRow.periodId, {
        settlement_date: new Date().toISOString().slice(0, 10),
        amount,
        method: 'cash',
        reference: `PAY-${settlementRow.periodMonth}`,
      });

      setSettlementRow(null);
      setSettlementAmount('');
      await loadReport();
    } catch (error) {
      console.error('Failed to settle payroll period', error);
      setErrorMessage('تعذّرت عملية التسوية');
    } finally {
      setActionLoadingId(null);
    }
  };

  const closeSettlementModal = () => {
    setSettlementRow(null);
    setSettlementAmount('');
  };

  const settlementRemaining = settlementRow
    ? Math.max(settlementRow.totalEarned + settlementRow.totalAdjustments - settlementRow.totalSettled, 0)
    : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payroll الأطباء</h1>
        <p className="text-sm text-gray-500">متابعة استحقاقات الأطباء مع صرف جزئي أو نهائي في أي وقت، بينما إقفال الشهر اختياري للأرشفة فقط.</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <select
            value={filters.doctorId}
            onChange={(e) => handleFilterChange('doctorId', e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
          >
            <option value="">الطبيب</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
            ))}
          </select>

          <select
            value={filters.branchId}
            onChange={(e) => handleFilterChange('branchId', e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
          >
            <option value="">الفرع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>

          <input
            type="month"
            value={filters.periodMonth}
            onChange={(e) => handleFilterChange('periodMonth', e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
          />

          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
          >
            <option value="">حالة التسوية</option>
            <option value="OPEN">OPEN</option>
            <option value="CLOSED">CLOSED</option>
            <option value="SETTLED">SETTLED</option>
          </select>
        </div>
      </div>

      {errorMessage && <div className="text-sm text-red-600">{errorMessage}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="إجمالي الاستحقاق" value={`${totals.totalEntitlement.toLocaleString()} EGP`} icon={Wallet} color="blue" />
        <KPICard title="المسدد" value={`${totals.totalSettled.toLocaleString()} EGP`} icon={CheckCircle2} color="green" />
        <KPICard title="المتبقي" value={`${totals.totalRemaining.toLocaleString()} EGP`} icon={Lock} color="amber" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">تفاصيل Ledger</h3>
          {isLoading && <span className="text-xs text-gray-500">جاري التحميل...</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الطبيب</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الشهر</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">عمولة الحجز</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">عمولة الخدمات</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">التعديلات</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">القيمة الإجمالية</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">المرجع</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">إجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportRows.map((row) => {
                const baseEarned = row.totalEarned;
                const remaining = Math.max(baseEarned + row.totalAdjustments - row.totalSettled, 0);

                return (
                  <tr key={row.periodId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.doctorName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.periodMonth}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(row.commissionDetails?.consultationAmount ?? 0).toLocaleString()} EGP
                      <div className="text-xs text-gray-400">
                        أساس {(row.commissionDetails?.consultationBasis ?? 0).toLocaleString()} × {(row.commissionDetails?.consultationRate ?? 0).toLocaleString()}%
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(row.commissionDetails?.servicesAmount ?? 0).toLocaleString()} EGP
                      <div className="text-xs text-gray-400">
                        أساس {(row.commissionDetails?.servicesBasis ?? 0).toLocaleString()} × {(row.commissionDetails?.servicesRate ?? 0).toLocaleString()}%
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.totalAdjustments.toLocaleString()} EGP</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{(baseEarned + row.totalAdjustments).toLocaleString()} EGP</td>
                    <td className="px-4 py-3 text-sm text-gray-500">PERIOD-{row.periodId}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => onCloseMonth(row.periodId)}
                          disabled={actionLoadingId === row.periodId || row.status === 'SETTLED'}
                          className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-50"
                        >
                          إقفال الشهر
                        </button>
                        <button
                          onClick={() => onOpenSettlementModal(row)}
                          disabled={actionLoadingId === row.periodId || remaining <= 0 || !row.canSettle}
                          className="px-3 py-1.5 rounded-md bg-primary-600 text-white disabled:opacity-50"
                        >
                          تسوية جزئية/نهائية
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!isLoading && reportRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">لا توجد بيانات للفلاتر الحالية.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {settlementRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">تسوية مستحقات الطبيب</h3>
              <button onClick={closeSettlementModal} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600">
                <div>الطبيب: <span className="font-semibold text-gray-900">{settlementRow.doctorName}</span></div>
                <div>الشهر: <span className="font-semibold text-gray-900">{settlementRow.periodMonth}</span></div>
                <div>المتبقي الحالي: <span className="font-semibold text-gray-900">{settlementRemaining.toLocaleString()} EGP</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">مبلغ الصرف</label>
                <input
                  type="number"
                  min="0"
                  max={settlementRemaining}
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={() => setSettlementAmount(String(settlementRemaining))}
                className="w-full h-10 rounded-lg border border-primary-300 text-primary-700 hover:bg-primary-50"
              >
                صرف الكل (تسوية نهائية للمتبقي الحالي)
              </button>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={closeSettlementModal}
                className="flex-1 h-10 rounded-lg border border-gray-300 text-gray-700"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={onConfirmSettlement}
                disabled={actionLoadingId === settlementRow.periodId}
                className="flex-1 h-10 rounded-lg bg-primary-600 text-white disabled:opacity-50"
              >
                تأكيد الصرف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
