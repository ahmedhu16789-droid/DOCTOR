import React, { useState, useEffect } from 'react';
import { Wallet, CheckCircle2, AlertCircle, Clock, Building2 } from 'lucide-react';
import { getBranchesFromApi, openCashSessionFromApi, closeCashSessionFromApi, getActiveCashSessionFromApi, CashSessionData } from '../services/api';
import { Branch, User, UserRole } from '../types';

interface CashSessionPageProps {
    currentUser: User;
    activeBranchId: string;
    branches: Branch[];
}

export const CashSession: React.FC<CashSessionPageProps> = ({ currentUser, activeBranchId, branches }) => {
    const [activeSession, setActiveSession] = useState<CashSessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [openingBalance, setOpeningBalance] = useState('0');
    const [collectedCash, setCollectedCash] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [selectedBranchId, setSelectedBranchId] = useState(activeBranchId || '');

    const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.BRANCH_MANAGER;

    const checkActiveSession = async (branchId: string) => {
        if (!branchId) return;
        setLoading(true);
        setActiveSession(null);
        try {
            const data = await getActiveCashSessionFromApi(branchId);
            if (data) {
                setActiveSession(data);
            }
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setSelectedBranchId(activeBranchId);
        checkActiveSession(activeBranchId);
    }, [activeBranchId]);

    const handleOpen = async () => {
        if (!selectedBranchId) {
            setMessage({ type: 'error', text: 'يرجى اختيار الفرع أولاً.' });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            const data = await openCashSessionFromApi(selectedBranchId, parseFloat(openingBalance) || 0);
            setActiveSession(data);
            setMessage({ type: 'success', text: 'تم فتح جلسة الكاش بنجاح.' });
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'فشل فتح جلسة الكاش.' });
        } finally {
            setSaving(false);
        }
    };

    const handleClose = async () => {
        if (!activeSession) return;
        if (!collectedCash) {
            setMessage({ type: 'error', text: 'يرجى إدخال النقد المحصّل.' });
            return;
        }
        if (!window.confirm(`هل أنت متأكد من إغلاق جلسة الكاش؟ النقد المحصّل: ${collectedCash} EGP`)) return;
        setSaving(true);
        setMessage(null);
        try {
            const data = await closeCashSessionFromApi(activeSession.id, parseFloat(collectedCash));
            setActiveSession(null);
            setCollectedCash('');
            const variance = (data.variance ?? 0);
            setMessage({
                type: variance === 0 ? 'success' : 'error',
                text: `تم إغلاق الجلسة. الفرق: ${variance >= 0 ? '+' : ''}${variance} EGP`,
            });
        } catch (err) {
            setMessage({ type: 'error', text: err instanceof Error ? err.message : 'فشل إغلاق جلسة الكاش.' });
        } finally {
            setSaving(false);
        }
    };

    const branchName = branches.find(b => b.id === selectedBranchId)?.name ?? selectedBranchId;

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                    <Wallet className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">جلسة الكاش</h1>
                    <p className="text-sm text-gray-500">فتح وإغلاق جلسات الكاش اليومية وتسوية الإيرادات</p>
                </div>
            </div>

            {/* Branch Selector */}
            {isAdmin && branches.length > 1 && (
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <label className="block text-sm font-medium text-gray-700 mb-2">اختر الفرع</label>
                    <select
                        value={selectedBranchId}
                        onChange={(e) => { setSelectedBranchId(e.target.value); checkActiveSession(e.target.value); }}
                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                    >
                        <option value="">-- اختر فرعاً --</option>
                        {branches.filter(b => b.isActive).map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Message Banner */}
            {message && (
                <div className={`flex items-center gap-2 p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <span className="text-sm font-medium">{message.text}</span>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
                </div>
            ) : activeSession ? (
                /* Active Session Card */
                <div className="bg-white rounded-xl border-2 border-emerald-300 shadow-sm overflow-hidden">
                    <div className="bg-emerald-50 px-6 py-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-emerald-600" />
                        <h2 className="font-bold text-emerald-800">جلسة كاش مفتوحة</h2>
                        <span className="ms-auto text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">OPEN</span>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">الفرع</p>
                                <p className="font-bold text-gray-900 flex items-center gap-1"><Building2 className="w-4 h-4" /> {branchName}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">الرصيد الافتتاحي</p>
                                <p className="font-bold text-gray-900">{activeSession.openingBalance.toLocaleString()} EGP</p>
                            </div>
                            <div>
                                <p className="text-gray-500">النقد المتوقع</p>
                                <p className="font-bold text-gray-900">{activeSession.expectedCash.toLocaleString()} EGP</p>
                            </div>
                            <div>
                                <p className="text-gray-500">وقت الفتح</p>
                                <p className="font-bold text-gray-900">{new Date(activeSession.openedAt).toLocaleTimeString('ar-EG')}</p>
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">النقد المحصّل فعلياً</label>
                            <input
                                type="number"
                                min="0"
                                value={collectedCash}
                                onChange={(e) => setCollectedCash(e.target.value)}
                                placeholder="أدخل المبلغ المحصّل"
                                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>

                        <button
                            onClick={handleClose}
                            disabled={saving}
                            className="w-full py-3 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 disabled:opacity-60 transition-colors"
                        >
                            {saving ? 'جاري الإغلاق...' : '🔒 إغلاق جلسة الكاش'}
                        </button>
                    </div>
                </div>
            ) : (
                /* Open New Session Card */
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h2 className="font-bold text-gray-900">فتح جلسة كاش جديدة</h2>
                        <p className="text-sm text-gray-500 mt-0.5">سيتم تسجيل جميع إيرادات اليوم تحت هذه الجلسة</p>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">الرصيد الافتتاحي (النقد الموجود في الدرج)</label>
                            <input
                                type="number"
                                min="0"
                                value={openingBalance}
                                onChange={(e) => setOpeningBalance(e.target.value)}
                                placeholder="0"
                                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>

                        <button
                            onClick={handleOpen}
                            disabled={saving || !selectedBranchId}
                            className="w-full py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-60 transition-colors"
                        >
                            {saving ? 'جاري الفتح...' : '🟢 فتح جلسة الكاش'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
