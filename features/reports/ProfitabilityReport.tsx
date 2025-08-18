import React from 'react';
import { secondaryButton } from '../../components/common/styles';
import { FileDown, Sheet } from 'lucide-react';

export const ProfitabilityReport = ({ data, onExport }: { data: any[] | null, onExport: (format: 'pdf' | 'excel', h: string[], d: any[][]) => void }) => {
    const headers = ['Client', 'Event', 'Event Date', 'Total Bill', 'Total Expenses', 'Profit'];
    
    if (data === null) {
        return <div className="text-center p-8 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg text-warm-gray-500">Select filters and click "Generate Report" to view data.</div>
    }

    const dataForExport = data.map(r => [r.client, r.event, r.eventDate, r.totalBill, r.totalExpenses, r.profit]);

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex justify-end gap-2 mb-4">
                <button onClick={() => onExport('pdf', headers, dataForExport)} className={secondaryButton} disabled={!data.length}><FileDown size={16}/> PDF</button>
                <button onClick={() => onExport('excel', headers, dataForExport)} className={secondaryButton} disabled={!data.length}><Sheet size={16}/> Excel</button>
            </div>
            {data.length === 0 ? <p className="text-center py-4">No data found for the selected filters.</p> : (
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-warm-gray-100 dark:bg-warm-gray-700">
                        <tr>{headers.map(h => <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                        {data.map((row, i) => (
                            <tr key={i}>
                                <td className="px-4 py-2 whitespace-nowrap">{row.client}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{row.event}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{row.eventDate}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-right">₹{row.totalBill.toLocaleString('en-IN')}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-right">₹{row.totalExpenses.toLocaleString('en-IN')}</td>
                                <td className={`px-4 py-2 whitespace-nowrap text-right font-bold ${row.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ₹{row.profit.toLocaleString('en-IN')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}
        </div>
    )
}