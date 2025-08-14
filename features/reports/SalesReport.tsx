import React from 'react';
import { secondaryButton } from '../../components/common/styles';
import { FileDown, Sheet } from 'lucide-react';

interface SalesReportData {
    monthName: string;
    events: {
        client: string;
        event: string;
        date: string;
        saleAmount: number;
        collectedAmount: number;
        dueAmount: number;
    }[];
    totals: {
        saleAmount: number;
        collectedAmount: number;
        dueAmount: number;
    };
}

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const SalesReport = ({ data, onExport }: { data: SalesReportData[] | null, onExport: (format: 'pdf' | 'excel', h: string[], d: any[][]) => void }) => {
    const headers = ['Client', 'Event', 'Event Date', 'Sale Amount', 'Collected Amount', 'Due Amount'];

    if (data === null) {
        return <div className="text-center p-8 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg text-warm-gray-500">Click "Generate Report" to view data.</div>;
    }

    const grandTotal = data.reduce((acc, month) => ({
        saleAmount: acc.saleAmount + month.totals.saleAmount,
        collectedAmount: acc.collectedAmount + month.totals.collectedAmount,
        dueAmount: acc.dueAmount + month.totals.dueAmount,
    }), { saleAmount: 0, collectedAmount: 0, dueAmount: 0 });

    const prepareExportData = (format: 'pdf' | 'excel') => {
        const flatData: any[][] = [];
        const headersForExport = format === 'pdf' ? headers : ['Month', ...headers];
        
        data.forEach(month => {
            if(format === 'pdf') flatData.push([{ content: month.monthName, colSpan: 6, styles: { fontStyle: 'bold' as const, fillColor: '#f5f5f5', textColor: '#171717' }}]);

            month.events.forEach(event => {
                const row = [event.client, event.event, event.date, event.saleAmount, event.collectedAmount, event.dueAmount];
                if(format === 'excel') flatData.push([month.monthName, ...row]);
                else flatData.push(row);
            });

            const subtotalRow = [
                { content: `Month Total`, colSpan: 3, styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
                { content: formatCurrency(month.totals.saleAmount), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
                { content: formatCurrency(month.totals.collectedAmount), styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
                { content: formatCurrency(month.totals.dueAmount), styles: { fontStyle: 'bold' as const, halign: 'right' as const } }
            ];
            if(format === 'pdf') flatData.push(subtotalRow);
            else flatData.push(['', '', 'Month Total', month.totals.saleAmount, month.totals.collectedAmount, month.totals.dueAmount]);
        });
        
        const grandTotalRow = [
            { content: `Grand Total`, colSpan: 3, styles: { fontStyle: 'bold' as const, halign: 'right' as const, fillColor: '#e5e5e5' } },
            { content: formatCurrency(grandTotal.saleAmount), styles: { fontStyle: 'bold' as const, halign: 'right' as const, fillColor: '#e5e5e5' } },
            { content: formatCurrency(grandTotal.collectedAmount), styles: { fontStyle: 'bold' as const, halign: 'right' as const, fillColor: '#e5e5e5' } },
            { content: formatCurrency(grandTotal.dueAmount), styles: { fontStyle: 'bold' as const, halign: 'right' as const, fillColor: '#e5e5e5' } }
        ];
        if(format === 'pdf') flatData.push(grandTotalRow);
        else flatData.push(['', '', 'Grand Total', grandTotal.saleAmount, grandTotal.collectedAmount, grandTotal.dueAmount]);


        onExport(format, headersForExport, flatData);
    };

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex justify-end gap-2 mb-4">
                <button onClick={() => prepareExportData('pdf')} className={secondaryButton} disabled={!data.length}><FileDown size={16}/> PDF</button>
                <button onClick={() => prepareExportData('excel')} className={secondaryButton} disabled={!data.length}><Sheet size={16}/> Excel</button>
            </div>
            {data.length === 0 ? <p className="text-center py-4">No data found for the selected period.</p> : (
            <div className="space-y-6">
                {data.map(month => (
                    <div key={month.monthName} className="overflow-x-auto">
                        <h4 className="font-bold text-lg mb-2 bg-warm-gray-100 dark:bg-warm-gray-700 p-2 rounded-md">{month.monthName}</h4>
                        <table className="min-w-full">
                            <thead>
                                <tr>{headers.map(h => <th key={h} className="px-4 py-2 text-left text-sm font-semibold">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                                {month.events.map((row, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-2 whitespace-nowrap">{row.client}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{row.event}</td>
                                        <td className="px-4 py-2 whitespace-nowrap">{row.date}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right">{formatCurrency(row.saleAmount)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right">{formatCurrency(row.collectedAmount)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right">{formatCurrency(row.dueAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold bg-warm-gray-100 dark:bg-warm-gray-700">
                                    <td colSpan={3} className="px-4 py-2 text-right">Month Total</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(month.totals.saleAmount)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(month.totals.collectedAmount)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(month.totals.dueAmount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ))}
                <div className="pt-4 border-t-2 border-black dark:border-white">
                    <table className="min-w-full">
                        <tbody className="font-bold text-lg">
                            <tr>
                                <td colSpan={3} className="px-4 py-2 text-right">Grand Total</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(grandTotal.saleAmount)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(grandTotal.collectedAmount)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(grandTotal.dueAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            )}
        </div>
    )
}