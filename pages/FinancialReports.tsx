import React, { useMemo } from 'react';
import { KPICard } from '../components/dashboard/KPICard';
import { DollarSign, TrendingUp, PieChart, Download, Building2 } from 'lucide-react';
import { MOCK_APPOINTMENTS } from '../services/mockData';

export const FinancialReports: React.FC = () => {
  // Mock Aggregation Logic based on available appointments
  const stats = useMemo(() => {
    let totalRev = 0;
    let pendingRev = 0;
    let cash = 0;
    const branchRev: Record<string, number> = {};
    const doctorRev: Record<string, number> = {};

    MOCK_APPOINTMENTS.forEach(apt => {
        const amount = apt.billing.total;
        totalRev += amount;
        pendingRev += (amount - apt.billing.paidAmount);

        // Payment Methods
        apt.billing.transactions.forEach(tx => {
            if (tx.method === 'CASH') cash += tx.amount;
        });

        // Branch Grouping
        branchRev[apt.branchId] = (branchRev[apt.branchId] || 0) + amount;
        
        // Doctor Grouping
        doctorRev[apt.doctorName] = (doctorRev[apt.doctorName] || 0) + amount;
    });

    return { totalRev, pendingRev, cash, branchRev, doctorRev };
  }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
            <p className="text-sm text-gray-500">Real-time revenue analysis and earnings report.</p>
        </div>
        <button className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors">
            <Download className="w-4 h-4 mr-2" /> Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard 
            title="Total Revenue" 
            value={`${stats.totalRev.toLocaleString()} EGP`} 
            icon={DollarSign} 
            color="green" 
            trend="12%" 
            trendUp={true} 
          />
          <KPICard 
            title="Cash Collected" 
            value={`${stats.cash.toLocaleString()} EGP`} 
            icon={DollarSign} 
            color="blue" 
          />
           <KPICard 
            title="Outstanding" 
            value={`${stats.pendingRev.toLocaleString()} EGP`} 
            icon={TrendingUp} 
            color="amber" 
            subtitle="Pending payments"
          />
           <KPICard 
            title="Avg. Ticket" 
            value={`${Math.round(stats.totalRev / (MOCK_APPOINTMENTS.length || 1)).toLocaleString()} EGP`} 
            icon={PieChart} 
            color="purple" 
          />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Doctor */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-6">Doctor Earnings Performance</h3>
              <div className="space-y-5">
                  {Object.entries(stats.doctorRev).map(([doc, amount]: [string, number]) => (
                      <div key={doc}>
                          <div className="flex justify-between text-sm mb-1.5">
                              <span className="font-semibold text-gray-700">{doc}</span>
                              <span className="font-bold text-gray-900">{amount.toLocaleString()} EGP</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="bg-primary-600 h-2 rounded-full" style={{ width: `${(amount / stats.totalRev) * 100}%` }}></div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          {/* Revenue by Branch */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-6">Revenue by Branch</h3>
              <div className="flex flex-col space-y-4">
                 {Object.entries(stats.branchRev).map(([branchId, amount]) => (
                     <div key={branchId} className="flex items-center p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                         <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mr-4 border border-indigo-100">
                             <Building2 className="w-6 h-6" />
                         </div>
                         <div className="flex-1">
                             <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Branch {branchId}</div>
                             <div className="text-xl font-bold text-gray-900">{amount.toLocaleString()} EGP</div>
                         </div>
                     </div>
                 ))}
              </div>
          </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ref</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {MOCK_APPOINTMENTS.flatMap(a => a.billing.transactions.map(t => ({...t, patient: a.patientName}))).map(tx => (
                        <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{tx.reference}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{tx.patient}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(tx.timestamp).toLocaleDateString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700 uppercase tracking-wide">
                                    {tx.method}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-emerald-600">
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
