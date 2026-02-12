import React, { useState } from 'react';
import { Appointment, Patient, UserRole, Medication, VitalSigns, ServiceItem } from '../types';
import { Activity, FileText, Pill, Clock, Save, Printer, ArrowLeft, AlertTriangle, PlusCircle, Trash2, DollarSign } from 'lucide-react';
import { MOCK_MEDICATIONS, MOCK_SERVICES } from '../services/mockData';

interface DoctorWorkspaceProps {
  appointment: Appointment;
  patient: Patient;
  userRole: UserRole;
  onClose: () => void;
  onComplete: () => void;
  onAddService: (aptId: string, service: ServiceItem) => void;
  onRemoveService: (aptId: string, itemId: string) => void;
}

export const DoctorWorkspace: React.FC<DoctorWorkspaceProps> = ({ appointment, patient, userRole, onClose, onComplete, onAddService, onRemoveService }) => {
  const [activeTab, setActiveTab] = useState<'VITALS' | 'NOTES' | 'RX' | 'SERVICES'>('VITALS');
  
  // Clinical State
  const [vitals, setVitals] = useState<VitalSigns>({ recordedBy: 'u1', timestamp: new Date().toISOString() });
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState<Medication[]>([]);
  
  // Rx Builder State
  const [rxSearch, setRxSearch] = useState('');
  const [newMed, setNewMed] = useState<Partial<Medication>>({ dosage: '', frequency: '', duration: '' });

  const isNurse = userRole === UserRole.NURSE;

  const handleAddMedication = () => {
    if (rxSearch && newMed.dosage) {
        setPrescription([...prescription, { 
            id: Math.random().toString(), 
            name: rxSearch, 
            dosage: newMed.dosage || '', 
            frequency: newMed.frequency || '', 
            duration: newMed.duration || '' 
        }]);
        setRxSearch('');
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
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-xl font-bold text-gray-900">{patient.name}</h1>
                <p className="text-xs text-gray-500">{patient.age}yo {patient.gender} • ID: {patient.id}</p>
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
        <div className="flex gap-3">
             <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                 <Save className="w-4 h-4" /> Save Draft
             </button>
             {!isNurse && (
                 <button onClick={onComplete} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
                    Finalize Visit
                 </button>
             )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
         {/* Sidebar: History */}
         <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto hidden lg:block print:hidden">
            <div className="p-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 mb-2">Patient History</h3>
                <div className="text-sm text-gray-600 leading-relaxed">
                    {patient.medicalHistorySummary}
                </div>
            </div>
            <div className="p-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Previous Visits</h4>
                <div className="space-y-4">
                    {[1,2,3].map(i => (
                        <div key={i} className="relative pl-4 border-l-2 border-gray-200 pb-2">
                            <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-gray-300"></div>
                            <div className="text-sm font-bold text-gray-800">Oct 1{i}, 2023</div>
                            <div className="text-xs text-gray-500 mb-1">Dr. Sarah Ahmed • Cardiology</div>
                            <div className="text-sm text-gray-600">Follow up on hypertension. Adjusted meds.</div>
                        </div>
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
                    <Activity className="w-4 h-4" /> Vitals & Triage
                </button>
                <button 
                   onClick={() => setActiveTab('NOTES')}
                   className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'NOTES' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <FileText className="w-4 h-4" /> Exam & Diagnosis
                </button>
                <button 
                   onClick={() => setActiveTab('RX')}
                   disabled={isNurse}
                   className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'RX' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 disabled:opacity-50'}`}
                >
                    <Pill className="w-4 h-4" /> Prescription
                </button>
                <button 
                   onClick={() => setActiveTab('SERVICES')}
                   className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'SERVICES' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <DollarSign className="w-4 h-4" /> Services & Billing
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 print:p-0">
                
                {activeTab === 'VITALS' && (
                    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-900"><Activity className="w-5 h-5 text-primary-600" /> Vital Signs</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" placeholder="120" className="w-full p-2 border border-gray-300 rounded-md" />
                                    <span className="text-gray-400">/</span>
                                    <input type="number" placeholder="80" className="w-full p-2 border border-gray-300 rounded-md" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate (BPM)</label>
                                <input type="number" placeholder="72" className="w-full p-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Temp (°C)</label>
                                <input type="number" placeholder="36.5" className="w-full p-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                                <input type="number" placeholder="70" className="w-full p-2 border border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">O2 Saturation (%)</label>
                                <input type="number" placeholder="98" className="w-full p-2 border border-gray-300 rounded-md" />
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-gray-100">
                             <label className="block text-sm font-medium text-gray-700 mb-2">Chief Complaint / Triage Notes</label>
                             <textarea 
                                className="w-full p-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-primary-500 focus:border-transparent" 
                                placeholder="Patient complains of..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                )}

                {activeTab === 'NOTES' && (
                     <div className="max-w-3xl mx-auto space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                             <h3 className="font-bold text-gray-900 mb-4">Examination Findings</h3>
                             <textarea className="w-full p-3 border border-gray-300 rounded-lg h-40" placeholder="Chest clear, heart sounds normal..."></textarea>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                             <h3 className="font-bold text-gray-900 mb-4">Diagnosis (ICD-10)</h3>
                             <input 
                                type="text" 
                                className="w-full p-3 border border-gray-300 rounded-lg" 
                                placeholder="e.g. Essential Hypertension"
                                value={diagnosis}
                                onChange={e => setDiagnosis(e.target.value)}
                             />
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                             <h3 className="font-bold text-gray-900 mb-4">Plan & Follow-up</h3>
                             <textarea className="w-full p-3 border border-gray-300 rounded-lg h-24" placeholder="Rest for 3 days, return if fever persists..."></textarea>
                        </div>
                     </div>
                )}

                {activeTab === 'RX' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 print:hidden">
                            <h3 className="font-bold text-gray-900 mb-4">Prescription Builder</h3>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Medication</label>
                                    <input 
                                        type="text" 
                                        list="meds" 
                                        className="w-full p-2 border border-gray-300 rounded" 
                                        placeholder="Search drug..." 
                                        value={rxSearch}
                                        onChange={e => setRxSearch(e.target.value)}
                                    />
                                    <datalist id="meds">
                                        {MOCK_MEDICATIONS.map(m => <option key={m.id} value={m.name} />)}
                                    </datalist>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dosage</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-gray-300 rounded" 
                                        placeholder="e.g. 500mg" 
                                        value={newMed.dosage}
                                        onChange={e => setNewMed({...newMed, dosage: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Frequency</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-gray-300 rounded" 
                                        placeholder="e.g. 3 times daily" 
                                        value={newMed.frequency}
                                        onChange={e => setNewMed({...newMed, frequency: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Duration</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-gray-300 rounded" 
                                        placeholder="e.g. 5 days" 
                                        value={newMed.duration}
                                        onChange={e => setNewMed({...newMed, duration: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <button onClick={handleAddMedication} className="w-full p-2 bg-primary-600 text-white rounded font-bold hover:bg-primary-700">+</button>
                                </div>
                            </div>
                        </div>

                        {/* Prescription Preview / Print Area */}
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[600px] print:shadow-none print:border-none print:p-0">
                            {/* Header for Print */}
                            <div className="hidden print:flex justify-between items-start mb-8 border-b-2 border-gray-900 pb-6">
                                <div>
                                    <h1 className="text-3xl font-serif font-bold text-gray-900">Al-Fath Clinic</h1>
                                    <p className="text-gray-600">Downtown Branch • 123 Main St, Cairo</p>
                                    <p className="text-gray-600">Tel: +20 123 456 7890</p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-xl font-bold">Dr. Sarah Ahmed</h2>
                                    <p className="text-gray-600">Cardiology Specialist</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <div className="flex gap-8 mb-2">
                                        <p><span className="font-bold text-gray-900">Patient:</span> {patient.name}</p>
                                        <p><span className="font-bold text-gray-900">Age:</span> {patient.age}</p>
                                    </div>
                                    <p><span className="font-bold text-gray-900">Date:</span> {new Date().toLocaleDateString()}</p>
                                </div>
                                <button onClick={handlePrintRx} className="print:hidden flex items-center gap-2 text-gray-500 hover:text-primary-600">
                                    <Printer className="w-5 h-5" /> Print Prescription
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="text-4xl font-serif text-gray-900 italic mb-4">Rx</div>
                                {prescription.length === 0 ? (
                                    <p className="text-gray-400 italic print:hidden">No medications added yet.</p>
                                ) : (
                                    <ul className="space-y-6">
                                        {prescription.map((med, idx) => (
                                            <li key={med.id} className="border-b border-gray-100 pb-4 last:border-0">
                                                <div className="flex justify-between">
                                                    <div>
                                                        <span className="font-bold text-lg text-gray-900">{idx + 1}. {med.name}</span>
                                                        <span className="text-gray-600 ml-2">{med.dosage}</span>
                                                    </div>
                                                    <button onClick={() => setPrescription(prescription.filter(m => m.id !== med.id))} className="text-red-400 hover:text-red-600 print:hidden text-sm">Remove</button>
                                                </div>
                                                <div className="text-gray-700 mt-1 pl-4">
                                                    {med.frequency} for {med.duration}
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
                                        <p>Diagnosis: {diagnosis}</p>
                                        <p>Generated by Al-Fath System</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="h-16 border-b border-gray-400 w-48 mb-2"></div>
                                        <p className="text-sm font-bold">Doctor's Signature</p>
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
                            <h3 className="font-bold text-gray-900 mb-4">Add Services / Procedures</h3>
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
                                <span>Current Visit Invoice</span>
                                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-mono">
                                    Total: {appointment.billing.total.toFixed(2)} EGP
                                </span>
                            </h3>
                            
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {appointment.billing.items.map(item => (
                                            <tr key={item.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unitPrice}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{item.total}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    {item.serviceId.startsWith('srv_cns') ? (
                                                        <span className="text-gray-400 text-xs italic">Base Fee</span>
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
    </div>
  );
};