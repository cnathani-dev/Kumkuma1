import React from 'react';

export interface ChartData {
    label: string;
    value: number;
}

interface ChartRendererProps {
    type: string;
    title: string;
    data: ChartData[];
}

export const ChartRenderer = ({ type, title, data }: ChartRendererProps) => {
    switch (type) {
        case 'kpi':
            return <KpiChart title={title} data={data} />;
        case 'bar':
            return <BarChart title={title} data={data} />;
        default:
            return <div className="text-sm text-red-500">Unsupported chart type: {type}</div>;
    }
};

const KpiChart = ({ title, data }: { title: string, data: ChartData[] }) => {
    const value = data[0]?.value ?? 0;
    return (
        <div className="p-4 bg-white dark:bg-warm-gray-900 rounded-lg shadow-inner">
            <h4 className="text-sm font-semibold text-warm-gray-600 dark:text-warm-gray-400 text-center">{title}</h4>
            <p className="text-5xl font-bold text-center mt-2 text-primary-600 dark:text-primary-400">{value}</p>
        </div>
    );
};

const BarChart = ({ title, data }: { title: string, data: ChartData[] }) => {
    const maxValue = Math.max(...data.map(d => d.value), 0);
    return (
        <div className="p-4 bg-white dark:bg-warm-gray-900 rounded-lg shadow-inner">
            <h4 className="text-sm font-semibold text-warm-gray-600 dark:text-warm-gray-400 mb-4">{title}</h4>
            <div className="space-y-2">
                {data.map(item => (
                    <div key={item.label} className="grid grid-cols-3 gap-2 items-center">
                        <span className="text-xs text-warm-gray-500 truncate text-right pr-2">{item.label}</span>
                        <div className="col-span-2 flex items-center gap-2">
                            <div className="w-full bg-warm-gray-200 dark:bg-warm-gray-700 rounded-full h-4">
                                <div
                                    className="bg-primary-500 h-4 rounded-full"
                                    style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
                                ></div>
                            </div>
                            <span className="text-sm font-bold w-8 text-right">{item.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
