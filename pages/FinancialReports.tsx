import React, { useEffect, useMemo, useState } from 'react';
import { KPICard } from '../components/dashboard/KPICard';
import { Select } from '../components/common/Select';
import { DollarSign, TrendingUp, PieChart, Download, Building2, UserX } from 'lucide-react';
import { FinancialReportPayload, ReconciliationSummaryRecord } from '../services/api';
import { repositories } from '../services/repositories';
import { useTranslation } from 'react-i18next';
import { Branch } from '../types';

export const FinancialReports: React.FC = () => {
    const { t } = useTranslation();
    const [report, setReport] = useState<FinancialReportPayload | null>(null);
    const [reconciliationRows, setReconciliationRows] = useState<ReconciliationSummaryRecord[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [selectedFromDate, setSelectedFromDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
    const [selectedToDate, setSelectedToDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const loadBranches = async () => {
            try {
                const branchRows = await repositories.branches.getBranches();
                setBranches(branchRows);
            } catch (error) {
                console.error('Failed to load branches', error);
            }
        };

        loadBranches();
    }, []);

    useEffect(() => {
        const loadReport = async () => {
            try {
                setIsLoading(true);
                const payload = await repositories.reports.getFinancialReport({
                    branchId: selectedBranchId || undefined,
                    from: selectedFromDate || undefined,
                    to: selectedToDate || undefined,
                });
                setReport(payload);
                setErrorMessage('');
            } catch (error) {
                console.error('Failed to load financial report', error);
                setErrorMessage('Failed to load financial report');
            } finally {
                setIsLoading(false);
            }
        };

        loadReport();
    }, [selectedBranchId, selectedFromDate, selectedToDate]);

    useEffect(() => {
        const loadReconciliation = async () => {
            try {
                const rows = await repositories.reports.getReconciliationReport({
                    branchId: selectedBranchId || undefined,
                    date: selectedDate,
                });
                setReconciliationRows(rows);
            } catch (error) {
                console.error('Failed to load reconciliation report', error);
            }
        };

        loadReconciliation();
    }, [selectedBranchId, selectedDate]);

    const stats = useMemo(() => {
        if (!report) {
            return {
                totalRevenue: 0,
                cashCollected: 0,
                outstandingRevenue: 0,
                averageTicket: 0,
                noShowRevenue: 0,
                noShowCount: 0,
                doctorRevenue: [],
                branchRevenue: [],
                recentTransactions: [],
            };
        }

        return {
            ...report.summary,
            doctorRevenue: report.doctorRevenue,
            branchRevenue: report.branchRevenue,
            recentTransactions: report.recentTransactions,
        };
    }, [report]);



    const handleExportCsv = async () => {
        try {
            setIsExporting(true);
            setErrorMessage('');

            const { blob, filename } = await repositories.reports.exportFinancialReportCsv({
                branchId: selectedBranchId || undefined,
                from: selectedFromDate || undefined,
                to: selectedToDate || undefined,
            });

            const branchContext = selectedBranchId ? `branch-${selectedBranchId}` : 'all-branches';
            const dateContext = `${selectedFromDate || 'start'}_to_${selectedToDate || 'today'}`;
            const expectedFilename = `financial-report_${branchContext}_${dateContext}.csv`;

            if (filename !== expectedFilename) {
                throw new Error(`Unexpected export filename: ${filename}`);
            }

            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error('Failed to export financial report', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to export financial report');
        } finally {
            setIsExporting(false);
        }
    };

    const selectedBranchName = useMemo(() => {
        if (!selectedBranchId) {
            return 'All branches';
        }

        const branch = branches.find((row) => row.id === selectedBranchId);
        return branch ? `${branch.name} (${branch.id})` : `Branch ${selectedBranchId}`;
    }, [branches, selectedBranchId]);

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('financial_reports')}</h1>
                    <p className="text-sm text-gray-500">{t('financial_desc')}</p>
                    <p className="text-xs text-gray-500 mt-1">Scope: {selectedBranchName}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-48">
                        <Select
                            value={selectedBranchId}
                            onChange={(val) => setSelectedBranchId(val)}
                            options={[
                                { value: '', label: 'All branches' },
                                ...branches.map((branch) => ({ value: branch.id, label: branch.name }))
                            ]}
                        />
                    </div>
                    <input
                        type="date"
                        value={selectedFromDate}
                        onChange={(event) => setSelectedFromDate(event.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                        aria-label="Financial report start date"
                    />
                    <input
                        type="date"
                        value={selectedToDate}
                        onChange={(event) => setSelectedToDate(event.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                        aria-label="Financial report end date"
                    />
                    <button
                        onClick={handleExportCsv}
                        disabled={isExporting}
                        className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" /> {isExporting ? `${t('export_csv')}...` : t('export_csv')}
                    </button>
                </div>
            </div>

            {isLoading && <div className="text-sm text-gray-500">{t('financial_loading')}</div>}
            {errorMessage && <div className="text-sm text-red-600">{errorMessage}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard
                    title={t('total_revenue')}
                    value={`${stats.totalRevenue.toLocaleString()} EGP`}
                    icon={DollarSign}
                    color="green"
                />
                <KPICard
                    title={t('cash_collected')}
                    value={`${stats.cashCollected.toLocaleString()} EGP`}
                    icon={DollarSign}
                    color="blue"
                />
                <KPICard
                    title={t('outstanding')}
                    value={`${stats.outstandingRevenue.toLocaleString()} EGP`}
                    icon={TrendingUp}
                    color="amber"
                    subtitle={t('pending_payments')}
                />
                <KPICard
                    title={t('avg_ticket')}
                    value={`${Math.round(stats.averageTicket).toLocaleString()} EGP`}
                    icon={PieChart}
                    color="purple"
                />
                {(stats.noShowRevenue > 0 || stats.noShowCount > 0) && (
                    <KPICard
                        title={t('financial.no_show_losses_title')}
                        value={`${stats.noShowRevenue.toLocaleString()} EGP`}
                        icon={UserX}
                        color="red"
                        subtitle={t('financial.no_show_losses_subtitle', { count: stats.noShowCount })}
                    />
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-6">{t('doctor_earnings')}</h3>
                    <div className="space-y-5">
                        {stats.doctorRevenue.map(({ doctorName, amount }) => (
                            <div key={doctorName}>
                                <div className="flex justify-between text-sm mb-1.5">
                                    <span className="font-semibold text-gray-700">{doctorName}</span>
                                    <span className="font-bold text-gray-900">{amount.toLocaleString()} EGP</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-primary-600 h-2 rounded-full" style={{ width: `${stats.totalRevenue > 0 ? (amount / stats.totalRevenue) * 100 : 0}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-6">{t('revenue_by_branch')}</h3>
                    <div className="flex flex-col space-y-4">
                        {stats.branchRevenue.map(({ branchId, branchName, amount }) => (
                            <div key={branchId} className="flex items-center p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mr-4 rtl:ml-4 rtl:mr-0 border border-indigo-100">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{branchName} ({branchId})</div>
                                    <div className="text-xl font-bold text-gray-900">{amount.toLocaleString()} EGP</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                    <h3 className="font-bold text-gray-900">Branch/day cash reconciliation</h3>
                    <div className="flex gap-2">
                        <div className="w-48">
                            <Select
                                value={selectedBranchId}
                                onChange={(val) => setSelectedBranchId(val)}
                                options={[
                                    { value: '', label: 'All branches' },
                                    ...branches.map((branch) => ({ value: branch.id, label: branch.name }))
                                ]}
                            />
                        </div>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(event) => setSelectedDate(event.target.value)}
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Branch</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Opening</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Expected</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Collected</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Variance</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reconciliationRows.map((row) => (
                                <tr key={row.id}>
                                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.branchName}</td>
                                    <td className="px-6 py-4 text-sm text-right">{row.openingBalance.toLocaleString()} EGP</td>
                                    <td className="px-6 py-4 text-sm text-right">{row.expectedCash.toLocaleString()} EGP</td>
                                    <td className="px-6 py-4 text-sm text-right">{row.collectedCash.toLocaleString()} EGP</td>
                                    <td className={`px-6 py-4 text-sm text-right font-semibold ${row.variance === 0 ? 'text-gray-700' : row.variance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{row.variance.toLocaleString()} EGP</td>
                                </tr>
                            ))}
                            {reconciliationRows.length === 0 && (
                                <tr>
                                    <td className="px-6 py-6 text-sm text-gray-500" colSpan={5}>No reconciliation rows found for the selected filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <h3 className="font-bold text-gray-900">{t('recent_transactions')}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left rtl:text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('ref')}</th>
                                <th className="px-6 py-3 text-left rtl:text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('patient')}</th>
                                <th className="px-6 py-3 text-left rtl:text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('date')}</th>
                                <th className="px-6 py-3 text-left rtl:text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('method')}</th>
                                <th className="px-6 py-3 text-right rtl:text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('amount')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stats.recentTransactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{tx.reference}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{tx.patientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tx.date ? new Date(tx.date).toLocaleDateString() : '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700 uppercase tracking-wide">
                                            {tx.method}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right rtl:text-left text-sm font-bold text-emerald-600">
                                        +{tx.amount} EGP
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
