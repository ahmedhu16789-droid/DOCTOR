import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Wallet, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { KPICard } from '../components/dashboard/KPICard';
import { Select } from '../components/common/Select';
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
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState<DoctorPayrollReportFilters>(defaultFilters);
  const [reportRows, setReportRows] = useState<DoctorPayrollReportRecord[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [settlementRow, setSettlementRow] = useState<DoctorPayrollReportRecord | null>(null);
  const [detailsRow, setDetailsRow] = useState<DoctorPayrollReportRecord | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');

  const loadReport = async (nextFilters?: DoctorPayrollReportFilters) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const payload = await getDoctorPayrollReportFromApi(nextFilters ?? filters);
      setReportRows(payload);
    } catch (error) {
      console.error('Failed to load doctor payroll report', error);
      setErrorMessage(t('doctor_payroll.error_load_report'));
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
      setErrorMessage(t('doctor_payroll.error_close_month'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const onOpenSettlementModal = (row: DoctorPayrollReportRecord) => {
    const remainingAmount = Math.max(row.totalEarned + row.totalAdjustments - row.totalSettled, 0);
    if (remainingAmount <= 0 || !row.canSettle) return;

    setErrorMessage('');
    setDetailsRow(null);
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
        setErrorMessage(t('doctor_payroll.error_invalid_amount'));
        return;
      }

      if (amount > remainingAmount) {
        setErrorMessage(t('doctor_payroll.error_exceeds_remaining'));
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
      setErrorMessage(t('doctor_payroll.error_settlement_failed'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const closeSettlementModal = () => {
    setSettlementRow(null);
    setSettlementAmount('');
  };


  const onOpenDetailsModal = (row: DoctorPayrollReportRecord) => {
    setErrorMessage('');
    setDetailsRow(row);
  };

  const closeDetailsModal = () => {
    setDetailsRow(null);
  };

  const onSettleFromDetails = (row: DoctorPayrollReportRecord) => {
    setDetailsRow(null);
    onOpenSettlementModal(row);
  };

  const settlementRemaining = settlementRow
    ? Math.max(settlementRow.totalEarned + settlementRow.totalAdjustments - settlementRow.totalSettled, 0)
    : 0;

  const locale = i18n.resolvedLanguage || i18n.language || 'ar-EG';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const percentFormatter = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EGP',
        maximumFractionDigits: 2,
      }),
    [locale],
  );
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);

  const formatMonth = (value: string) => {
    if (!value) return '-';
    const date = new Date(`${value}-01T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : monthFormatter.format(date);
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('doctor_payroll.title')}</h1>
        <p className="text-sm text-gray-500">{t('doctor_payroll.subtitle')}</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Select
            value={filters.doctorId}
            onChange={(val) => handleFilterChange('doctorId', val)}
            options={[
              { value: '', label: t('doctor_payroll.filters.doctor') },
              ...doctors.map((doctor) => ({ value: doctor.id, label: doctor.name }))
            ]}
          />

          <Select
            value={filters.branchId}
            onChange={(val) => handleFilterChange('branchId', val)}
            options={[
              { value: '', label: t('doctor_payroll.filters.branch') },
              ...branches.map((branch) => ({ value: branch.id, label: branch.name }))
            ]}
          />

          <input
            type="month"
            value={filters.periodMonth}
            onChange={(e) => handleFilterChange('periodMonth', e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm"
          />

          <Select
            value={filters.status}
            onChange={(val) => handleFilterChange('status', val)}
            options={[
              { value: '', label: t('doctor_payroll.filters.status') },
              { value: 'OPEN', label: t('doctor_payroll.status.open') },
              { value: 'CLOSED', label: t('doctor_payroll.status.closed') },
              { value: 'SETTLED', label: t('doctor_payroll.status.settled') }
            ]}
          />
        </div>
      </div>

      {errorMessage && <div className="text-sm text-red-600">{errorMessage}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title={t('doctor_payroll.kpi.total_entitlement')} value={currencyFormatter.format(totals.totalEntitlement)} icon={Wallet} color="blue" />
        <KPICard title={t('doctor_payroll.kpi.total_settled')} value={currencyFormatter.format(totals.totalSettled)} icon={CheckCircle2} color="green" />
        <KPICard title={t('doctor_payroll.kpi.total_remaining')} value={currencyFormatter.format(totals.totalRemaining)} icon={Lock} color="amber" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{t('doctor_payroll.ledger_title')}</h3>
          {isLoading && <span className="text-xs text-gray-500">{t('doctor_payroll.loading')}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.table.doctor')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.table.month')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.table.consultation_commission')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.table.services_commission')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.table.adjustments')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.table.total')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.table.reference')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.table.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportRows.map((row) => {
                const baseEarned = row.totalEarned;
                const remaining = Math.max(baseEarned + row.totalAdjustments - row.totalSettled, 0);

                return (
                  <tr key={row.periodId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() => onOpenDetailsModal(row)}
                        className="font-semibold text-primary-700 hover:text-primary-800 hover:underline"
                      >
                        {row.doctorName || '-'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatMonth(row.periodMonth)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {currencyFormatter.format(row.commissionDetails?.consultationAmount ?? 0)}
                      <div className="text-xs text-gray-400">
                        {t('doctor_payroll.table.basis_rate', {
                          basis: numberFormatter.format(row.commissionDetails?.consultationBasis ?? 0),
                          rate: percentFormatter.format(row.commissionDetails?.consultationRate ?? 0),
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {currencyFormatter.format(row.commissionDetails?.servicesAmount ?? 0)}
                      <div className="text-xs text-gray-400">
                        {t('doctor_payroll.table.basis_rate', {
                          basis: numberFormatter.format(row.commissionDetails?.servicesBasis ?? 0),
                          rate: percentFormatter.format(row.commissionDetails?.servicesRate ?? 0),
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{currencyFormatter.format(row.totalAdjustments)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{currencyFormatter.format(baseEarned + row.totalAdjustments)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">PERIOD-{row.periodId}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => onCloseMonth(row.periodId)}
                          disabled={actionLoadingId === row.periodId || row.status === 'SETTLED'}
                          className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-50"
                        >
                          {t('doctor_payroll.actions.close_month')}
                        </button>
                        <button
                          onClick={() => onOpenSettlementModal(row)}
                          disabled={actionLoadingId === row.periodId || remaining <= 0 || !row.canSettle}
                          className="px-3 py-1.5 rounded-md bg-primary-600 text-white disabled:opacity-50"
                        >
                          {t('doctor_payroll.actions.partial_or_final_settlement')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!isLoading && reportRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">{t('doctor_payroll.empty_state')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {detailsRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{t('doctor_payroll.details.title')}</h3>
              <button onClick={closeDetailsModal} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>{t('doctor_payroll.details.doctor')}: <span className="font-semibold text-gray-900">{detailsRow.doctorName}</span></div>
                <div>{t('doctor_payroll.details.month')}: <span className="font-semibold text-gray-900">{formatMonth(detailsRow.periodMonth)}</span></div>
                <div>
                  {t('doctor_payroll.details.current_remaining')}:{' '}
                  <span className="font-semibold text-gray-900">
                    {currencyFormatter.format(Math.max(detailsRow.totalEarned + detailsRow.totalAdjustments - detailsRow.totalSettled, 0))}
                  </span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.details.table.date')}</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.details.table.kind')}</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.details.table.method')}</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.details.table.amount')}</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{t('doctor_payroll.details.table.reference')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {(detailsRow.settlements ?? []).map((settlement) => (
                      <tr key={settlement.id}>
                        <td className="px-3 py-2 text-sm text-gray-600">{formatDate(settlement.settlementDate)}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">{settlement.settlementKind === 'FINAL' ? t('doctor_payroll.details.kind.final') : t('doctor_payroll.details.kind.partial')}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">{settlement.method}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900">{currencyFormatter.format(settlement.amount)}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{settlement.reference || '-'}</td>
                      </tr>
                    ))}
                    {(detailsRow.settlements ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">{t('doctor_payroll.details.empty_settlements')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={closeDetailsModal}
                className="flex-1 h-10 rounded-lg border border-gray-300 text-gray-700"
              >
                {t('doctor_payroll.actions.close')}
              </button>
              <button
                type="button"
                onClick={() => onSettleFromDetails(detailsRow)}
                disabled={actionLoadingId === detailsRow.periodId || Math.max(detailsRow.totalEarned + detailsRow.totalAdjustments - detailsRow.totalSettled, 0) <= 0 || !detailsRow.canSettle}
                className="flex-1 h-10 rounded-lg bg-primary-600 text-white disabled:opacity-50"
              >
                {t('doctor_payroll.actions.new_settlement')}
              </button>
            </div>
          </div>
        </div>
      )}

      {settlementRow && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{t('doctor_payroll.settlement.title')}</h3>
              <button onClick={closeSettlementModal} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600">
                <div>{t('doctor_payroll.settlement.doctor')}: <span className="font-semibold text-gray-900">{settlementRow.doctorName}</span></div>
                <div>{t('doctor_payroll.settlement.month')}: <span className="font-semibold text-gray-900">{formatMonth(settlementRow.periodMonth)}</span></div>
                <div>{t('doctor_payroll.settlement.current_remaining')}: <span className="font-semibold text-gray-900">{currencyFormatter.format(settlementRemaining)}</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('doctor_payroll.settlement.amount_label')}</label>
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
                {t('doctor_payroll.settlement.settle_all')}
              </button>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={closeSettlementModal}
                className="flex-1 h-10 rounded-lg border border-gray-300 text-gray-700"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirmSettlement}
                disabled={actionLoadingId === settlementRow.periodId}
                className="flex-1 h-10 rounded-lg bg-primary-600 text-white disabled:opacity-50"
              >
                {t('doctor_payroll.actions.confirm_settlement')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
