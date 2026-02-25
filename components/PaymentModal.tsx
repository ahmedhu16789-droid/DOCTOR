import React, { useState } from 'react';
import { Appointment, PaymentEntry, PaymentMethod, Transaction } from '../types';
import { X, Printer, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { repositories } from '../services/repositories';

interface PaymentModalProps {
  appointment: Appointment;
  onClose: () => void;
  onProcessPayment: (aptId: string, payments: PaymentEntry[]) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ appointment, onClose, onProcessPayment }) => {
  const { t } = useTranslation();
  const billing = appointment.billing;
  const [clinicName, setClinicName] = useState<string>(t('clinic_name'));
  const dueAmount = billing.total - billing.paidAmount;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const settings = await repositories.settings.getClinicSettings();
        if (isMounted && settings?.name) {
          setClinicName(settings.name);
        }
      } catch {
        // Fallback to translation
      }
    })();
    return () => { isMounted = false; };
  }, [t]);

  const [cashAmount, setCashAmount] = useState('0');
  const [cardAmount, setCardAmount] = useState(dueAmount.toString());
  const method = parseFloat(cashAmount) > 0 && parseFloat(cardAmount) > 0
    ? 'mixed'
    : parseFloat(cashAmount) > 0
      ? PaymentMethod.CASH
      : PaymentMethod.CARD;
  const [step, setStep] = useState<'INPUT' | 'RECEIPT'>('INPUT');
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(cashAmount) || 0;
    const card = parseFloat(cardAmount) || 0;
    const amount = cash + card;
    if (amount <= 0 || amount > dueAmount) return;

    const payments: PaymentEntry[] = [];
    if (cash > 0) payments.push({ amount: cash, method: PaymentMethod.CASH });
    if (card > 0) payments.push({ amount: card, method: PaymentMethod.CARD });
    if (!payments.length) return;

    onProcessPayment(appointment.id, payments);

    // Create temp tx object for display
    setReceiptTx({
      id: Math.random().toString(),
      amount: amount,
      method: cash > 0 ? PaymentMethod.CASH : PaymentMethod.CARD,
      timestamp: new Date().toISOString(),
      recordedBy: 'Current User',
      reference: `REC-${Math.floor(Math.random() * 10000)}`,
      type: 'PAYMENT'
    });
    setStep('RECEIPT');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:hidden">
          <h2 className="text-lg font-bold text-gray-900">
            {step === 'INPUT' ? t('process_payment') : t('payment_success')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {step === 'INPUT' && (
            <div className="space-y-6">
              {/* Invoice Summary */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">{t('invoice_summary')}</h3>
                <div className="space-y-2 mb-4">
                  {billing.items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                      <span className="font-medium">{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between items-center font-bold text-lg">
                  <span>{t('total_due')}</span>
                  <span>{dueAmount.toFixed(2)} {t('currency_egp')}</span>
                </div>
              </div>

              {/* Payment Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('payment_method')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border rounded-xl p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold mb-2"><Banknote className="w-4 h-4" /> {t('payment_method_cash')}</div>
                      <input
                        type="number"
                        min="0"
                        max={dueAmount}
                        step="0.01"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        className="block w-full text-xl font-bold p-2 border border-gray-300 rounded-lg text-right"
                      />
                    </div>
                    <div className="border rounded-xl p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold mb-2"><CreditCard className="w-4 h-4" /> {t('payment_method_card')}</div>
                      <input
                        type="number"
                        min="0"
                        max={dueAmount}
                        step="0.01"
                        value={cardAmount}
                        onChange={(e) => setCardAmount(e.target.value)}
                        className="block w-full text-xl font-bold p-2 border border-gray-300 rounded-lg text-right"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{t('paid_total')}: {(Number(cashAmount || 0) + Number(cardAmount || 0)).toFixed(2)} {t('currency_egp')}</p>
                </div>

                <button
                  type="submit"
                  disabled={(parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0) <= 0}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200 transition-all disabled:opacity-50"
                >
                  {t('process_payment')}
                </button>
              </form>
            </div>
          )}

          {step === 'RECEIPT' && receiptTx && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 print:hidden">
                <ShieldCheck className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1 print:hidden">{t('payment_successful')}</h3>
              <p className="text-gray-500 mb-6 print:hidden">{t('transaction_recorded_successfully')}</p>

              {/* Printable Receipt Area */}
              <div className="bg-white border-2 border-dashed border-gray-300 p-6 rounded-xl text-left font-mono text-sm mb-6 print:border-none print:p-0">
                <div className="text-center border-b border-gray-300 pb-4 mb-4">
                  <h2 className="font-bold text-xl uppercase">{t('receipt_header_clinic_name', { clinicName })}</h2>
                  <p>{t('receipt_number', { reference: receiptTx.reference })}</p>
                  <p>{new Date().toLocaleString()}</p>
                </div>

                <div className="mb-4">
                  <p>{t('receipt_patient', { patientName: appointment.patientName })}</p>
                  <p>{t('receipt_doctor', { doctorName: appointment.doctorName })}</p>
                </div>

                <div className="space-y-1 mb-4 border-b border-gray-300 pb-4">
                  {billing.items.map(item => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.name}</span>
                      <span>{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between font-bold text-lg mb-2">
                  <span>{t('receipt_total')}</span>
                  <span>{billing.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t('receipt_paid', { method: method === 'mixed' ? `${t('payment_method_cash')} + ${t('payment_method_card')}` : t(`payment_method_${String(method).toLowerCase()}`) })}</span>
                  <span>{receiptTx.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t('receipt_remaining')}</span>
                  <span>{(billing.total - (billing.paidAmount + receiptTx.amount)).toFixed(2)}</span>
                </div>

                <div className="mt-8 text-center text-xs text-gray-400">
                  {t('receipt_thank_you_message', { clinicName })}
                </div>
              </div>

              <div className="flex gap-3 print:hidden">
                <button onClick={onClose} className="flex-1 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50">{t('close')}</button>
                <button onClick={handlePrint} className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 flex items-center justify-center gap-2">
                  <Printer className="w-4 h-4" /> {t('print_receipt')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
