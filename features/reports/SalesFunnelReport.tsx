import React from 'react';
import { secondaryButton } from '../../components/common/styles';
import { FileDown, Sheet, TrendingDown, CheckCircle, XCircle, Ban } from 'lucide-react';

interface FunnelStageData {
    name: string;
    count: number;
    value: number;
    conversionRate?: number;
}

interface SalesFunnelData {
    totalLeads: FunnelStageData;
    confirmed: FunnelStageData;
    lost: FunnelStageData;
    cancelled: FunnelStageData;
}

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FunnelStage = ({ name, count, value, conversionRate, color, icon: Icon, isTop = false }: {
    name: string;
    count: number;
    value: number;
    conversionRate?: number;
    color: string;
    icon: React.ElementType;
    isTop?: boolean;
}) => {
    return (
        <div className={`p-6 rounded-lg shadow-md flex items-start gap-4 ${color}`}>
            <Icon size={32} className="mt-1 flex-shrink-0" />
            <div className="flex-grow">
                <p className="font-bold text-lg">{name}</p>
                <div className="flex justify-between items-baseline">
                    <p className="text-3xl font-bold">{count}</p>
                    <p className="text-xl font-semibold">{formatCurrency(value)}</p>
                </div>
                {!isTop && (
                     <p className="text-sm font-semibold opacity-80 mt-1">
                        {conversionRate?.toFixed(1)}% conversion rate
                    </p>
                )}
            </div>
        </div>
    );
};


export const SalesFunnelReport = ({ data, onExport }: { data: SalesFunnelData | null, onExport: (format: 'pdf' | 'excel', h: string[], d: any[][]) => void }) => {
    
    if (data === null) {
        return <div className="text-center p-8 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg text-warm-gray-500">Select filters and click "Generate Report" to view data.</div>
    }

    const { totalLeads, confirmed, lost, cancelled } = data;

    const handleExport = (format: 'pdf' | 'excel') => {
        const headers = ['Stage', 'Event Count', 'Total Value', 'Conversion Rate'];
        const exportData = [
            ['Total Leads', totalLeads.count, totalLeads.value, '100.0%'],
            ['Confirmed', confirmed.count, confirmed.value, `${confirmed.conversionRate?.toFixed(1) ?? 0}%`],
            ['Lost', lost.count, lost.value, `${lost.conversionRate?.toFixed(1) ?? 0}%`],
            ['Cancelled', cancelled.count, cancelled.value, `${cancelled.conversionRate?.toFixed(1) ?? 0}%`],
        ];
        onExport(format, headers, exportData);
    };
    
    return (
        <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex justify-end gap-2 mb-4">
                <button onClick={() => handleExport('pdf')} className={secondaryButton}><FileDown size={16}/> PDF</button>
                <button onClick={() => handleExport('excel')} className={secondaryButton}><Sheet size={16}/> Excel</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Main Funnel */}
                <div className="space-y-4">
                     <h3 className="text-xl font-bold text-center">Sales Funnel</h3>
                    <div className="relative flex flex-col items-center space-y-2">
                        <div className="w-full">
                           <FunnelStage {...totalLeads} color="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300" icon={TrendingDown} isTop={true} name="Total Leads Created" />
                        </div>
                        <div className="w-[90%]">
                            <FunnelStage {...confirmed} color="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" icon={CheckCircle} name="Confirmed Events" />
                        </div>
                    </div>
                </div>

                {/* Leakage */}
                <div className="space-y-4">
                     <h3 className="text-xl font-bold text-center">Funnel Leakage</h3>
                     <div className="space-y-4">
                        <FunnelStage {...lost} color="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300" icon={XCircle} name="Lost Leads" />
                        <FunnelStage {...cancelled} color="bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200" icon={Ban} name="Cancelled Events" />
                     </div>
                </div>

            </div>
        </div>
    )
}