import React, { useState } from 'react';
import { Appointment, BillingDetails, PaymentMethod, PaymentStatus, Transaction } from '../types';
import { X, Printer, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PaymentModalProps {
  appointment: Appointment;
  onClose: () => void;
  onProcessPayment: (aptId: string, amount: number, method: PaymentMethod) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ appointment, onClose, onProcessPayment }) => {
  const { t } = useTranslation();
  const billing = appointment.billing;
  const clinicName = t('clinic_name');
  const dueAmount = billing.total - billing.paidAmount;
  
  const [paymentAmount, setPaymentAmount] = useState(dueAmount.toString());
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [step, setStep] = useState<'INPUT' | 'RECEIPT'>('INPUT');
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (amount <= 0 || amount > dueAmount) return;

    onProcessPayment(appointment.id, amount, method);
    
    // Create temp tx object for display
    setReceiptTx({
        id: Math.random().toString(),
        amount: amount,
        method: method,
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
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: PaymentMethod.CASH, label: t('payment_method_cash'), icon: Banknote },
                                { id: PaymentMethod.CARD, label: t('payment_method_card'), icon: CreditCard },
                                { id: PaymentMethod.INSURANCE, label: t('payment_method_insurance'), icon: ShieldCheck },
                            ].map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMethod(m.id)}
                                    className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-all ${
                                        method === m.id 
                                        ? 'bg-primary-50 border-primary-500 text-primary-700 ring-1 ring-primary-500' 
                                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                                    }`}
                                >
                                    <m.icon className="w-6 h-6 mb-1" />
                                    <span className="text-xs font-bold">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('amount_tendered_egp')}</label>
                        <input 
                            type="number"
                            min="1"
                            max={dueAmount}
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="block w-full text-3xl font-bold p-3 border border-gray-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 text-right"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={parseFloat(paymentAmount) <= 0}
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
                          <span>{t('receipt_paid', { method: t(`payment_method_${method.toLowerCase()}`) })}</span>
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
