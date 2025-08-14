import React, { useMemo, useState } from 'react';
import { useClients, useLocations, usePaymentModes } from '../../App';
import { Event } from '../../types';
import { primaryButton, secondaryButton, inputStyle } from '../../components/common/styles';
import { exportReportToPdf, exportReportToExcel } from '../../lib/export';
import { IncomeReport } from './IncomeReport';
import { ExpenseReport } from './ExpenseReport';
import { ProfitabilityReport } from './ProfitabilityReport';
import { SalesReport } from './SalesReport';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { AdditionalPaxReport } from './AdditionalPaxReport';
import { yyyyMMDDToDate, formatYYYYMMDD } from '../../lib/utils';

export const ReportsManager = ({ managedEvents }: { managedEvents: Event[]}) => {
    const { clients } = useClients();
    const { locations } = useLocations();
    const { settings: paymentModes } = usePaymentModes();
    
    const [activeReport, setActiveReport] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        location: '',
        paymentType: '',
    });
    const [generatedData, setGeneratedData] = useState<any[] | null>(null);
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);


    const reportTypes: Record<string, {name: string, component: React.FC<any>, requiredFilters: string[]}> = {
        income: { name: "Income Report", component: IncomeReport, requiredFilters: ['startDate', 'endDate']},
        expense: { name: "Expense Report", component: ExpenseReport, requiredFilters: ['startDate', 'endDate']},
        profitability: { name: "Event Profitability", component: ProfitabilityReport, requiredFilters: []},
        sales: { name: "Monthly Sales Report", component: SalesReport, requiredFilters: [] },
        additionalPax: { name: "Additional PAX Report", component: AdditionalPaxReport, requiredFilters: ['startDate', 'endDate'] },
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setGeneratedData(null);
    };

    const generateReportData = () => {
        if (!activeReport) return;
        
        let data: any[] = [];
        
        if (activeReport === 'income') {
            let allIncome: any[] = [];
            managedEvents.forEach(event => {
                const eventIncomes = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted);
                eventIncomes.forEach(income => {
                    allIncome.push({
                        client: clientMap.get(event.clientId) || 'N/A',
                        event: event.eventType,
                        eventDate: formatYYYYMMDD(event.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
                        paymentDate: formatYYYYMMDD(income.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
                        paymentMode: income.paymentMode,
                        notes: income.notes,
                        amount: income.amount,
                        eventFullDate: yyyyMMDDToDate(event.date),
                        paymentFullDate: yyyyMMDDToDate(income.date),
                        location: event.location,
                    });
                });
            });
            data = allIncome.filter(row => {
                const { startDate, endDate, location, paymentType } = filters;
                if (startDate && row.paymentFullDate < yyyyMMDDToDate(startDate)) return false;
                if (endDate && row.paymentFullDate > yyyyMMDDToDate(endDate)) return false;
                if (location && row.location !== location) return false;
                if (paymentType && row.paymentMode !== paymentType) return false;
                return true;
            }).sort((a,b) => a.paymentFullDate.getTime() - b.paymentFullDate.getTime());
        }
        else if (activeReport === 'expense') {
            let allExpenses: any[] = [];
            managedEvents.forEach(event => {
                const eventExpenses = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted);
                eventExpenses.forEach(expense => {
                    allExpenses.push({
                        event: event.eventType,
                        expenseDate: formatYYYYMMDD(expense.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
                        category: expense.category,
                        notes: expense.notes,
                        amount: expense.amount,
                        expenseFullDate: yyyyMMDDToDate(expense.date),
                        location: event.location,
                    });
                });
            });
            data = allExpenses.filter(row => {
                const { startDate, endDate, location } = filters;
                if (startDate && row.expenseFullDate < yyyyMMDDToDate(startDate)) return false;
                if (endDate && row.expenseFullDate > yyyyMMDDToDate(endDate)) return false;
                if (location && row.location !== location) return false;
                return true;
            }).sort((a,b) => a.expenseFullDate.getTime() - b.expenseFullDate.getTime());
        }
        else if (activeReport === 'profitability') {
            data = managedEvents.map(event => {
                const baseCost = (() => {
                    const model = event.pricingModel || 'variable';
                    const pax = event.pax || 0;
                    const perPax = event.perPaxPrice || 0;
                    const rent = event.rent || 0;
                    if (model === 'variable') return pax * perPax;
                    if (model === 'flat') return rent;
                    if (model === 'mix') return rent + (pax * perPax);
                    return 0;
                })();

                const totalCharges = (event.charges || []).filter(c => !c.isDeleted).reduce((sum, charge) => sum + charge.amount, 0);
                const totalBill = baseCost + totalCharges;
                const totalExpenses = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted).reduce((sum, expense) => sum + expense.amount, 0);
                const profit = totalBill - totalExpenses;
                
                return {
                    client: clientMap.get(event.clientId) || 'N/A',
                    event: event.eventType,
                    eventFullDate: yyyyMMDDToDate(event.date),
                    location: event.location,
                    totalBill,
                    totalExpenses,
                    profit
                };
            }).filter(row => {
                 const { startDate, endDate, location } = filters;
                if (startDate && row.eventFullDate < yyyyMMDDToDate(startDate)) return false;
                if (endDate && row.eventFullDate > yyyyMMDDToDate(endDate)) return false;
                if (location && row.location !== location) return false;
                return true;
            }).sort((a,b) => b.profit - a.profit);
        } else if (activeReport === 'sales') {
            const today = new Date();
            const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            const threeMonthsHence = new Date(today.getFullYear(), today.getMonth() + 4, 0);

            const eventsInRange = managedEvents.filter(e => {
                const eventDate = yyyyMMDDToDate(e.date);
                return eventDate >= threeMonthsAgo && eventDate <= threeMonthsHence;
            });
            
            const groupedByMonth: { [key: string]: { monthName: string, events: any[] } } = {};

            eventsInRange.forEach(event => {
                const eventDate = yyyyMMDDToDate(event.date);
                const baseCost = (() => {
                    const model = event.pricingModel || 'variable';
                    const pax = event.pax || 0;
                    const perPax = event.perPaxPrice || 0;
                    const rent = event.rent || 0;
                    if (model === 'variable') return pax * perPax;
                    if (model === 'flat') return rent;
                    if (model === 'mix') return rent + (pax * perPax);
                    return 0;
                })();
                const totalCharges = (event.charges || []).filter(c => !c.isDeleted).reduce((sum, charge) => sum + charge.amount, 0);
                const totalBill = baseCost + totalCharges;
                const collectedAmount = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted).reduce((sum, p) => sum + p.amount, 0);

                const eventRow = {
                    client: clientMap.get(event.clientId) || 'N/A',
                    event: event.eventType,
                    date: formatYYYYMMDD(event.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
                    rawDate: eventDate,
                    saleAmount: totalBill,
                    collectedAmount: collectedAmount,
                    dueAmount: totalBill - collectedAmount
                };
                
                const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
                const monthName = eventDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                
                if (!groupedByMonth[monthKey]) {
                    groupedByMonth[monthKey] = { monthName, events: [] };
                }
                groupedByMonth[monthKey].events.push(eventRow);
            });

            data = Object.entries(groupedByMonth)
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort by YYYY-MM key
                .map(([monthKey, {monthName, events}]) => {
                    const totals = events.reduce((acc, curr) => ({
                        saleAmount: acc.saleAmount + curr.saleAmount,
                        collectedAmount: acc.collectedAmount + curr.collectedAmount,
                        dueAmount: acc.dueAmount + curr.dueAmount,
                    }), { saleAmount: 0, collectedAmount: 0, dueAmount: 0 });
                    
                    return {
                        monthName,
                        events: events.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime()),
                        totals,
                    };
                });
        } else if (activeReport === 'additionalPax') {
            const reportData: any[] = [];
            managedEvents.forEach(event => {
                const additionalPaxCharges = (event.charges || []).filter(c => c.type === 'Additional PAX' && !c.isDeleted);

                if (additionalPaxCharges.length > 0) {
                    additionalPaxCharges.forEach(charge => {
                        reportData.push({
                            client: clientMap.get(event.clientId) || 'N/A',
                            event: event.eventType,
                            eventDate: formatYYYYMMDD(event.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
                            eventFullDate: yyyyMMDDToDate(event.date),
                            initialPax: event.pax || 0,
                            perPaxRate: event.perPaxPrice || 0,
                            additionalPax: charge.additionalPaxCount || 0,
                            discount: charge.discountAmount || 0,
                            chargeAmount: charge.amount,
                            notes: charge.notes || '',
                            location: event.location,
                        });
                    });
                }
            });
            data = reportData.filter(row => {
                const { startDate, endDate, location } = filters;
                if (startDate && row.eventFullDate < yyyyMMDDToDate(startDate)) return false;
                if (endDate && row.eventFullDate > yyyyMMDDToDate(endDate)) return false;
                if (location && row.location !== location) return false;
                return true;
            }).sort((a,b) => a.eventFullDate.getTime() - b.eventFullDate.getTime());
        }

        setGeneratedData(data);
    };

    const handleExport = (format: 'pdf' | 'excel', headers: string[], data: any[][]) => {
        const fileName = `${activeReport}_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        const activeFilters = {
            'Date Range': filters.startDate && filters.endDate ? `${filters.startDate} to ${filters.endDate}` : '',
            'Location': filters.location,
            'Payment Type': filters.paymentType,
        };
        
        if (format === 'pdf') {
            exportReportToPdf(reportTypes[activeReport!].name, headers, data, activeFilters, fileName);
        } else {
            const jsonData = data.map(row => 
                headers.reduce((obj, header, index) => {
                    obj[header] = row[index];
                    return obj;
                }, {} as Record<string, any>)
            );
            exportReportToExcel(jsonData, fileName, activeReport!);
        }
    };
    
    if (activeReport) {
        const ReportComponent = reportTypes[activeReport].component;
        const areFiltersHidden = activeReport === 'sales';

        return (
             <div>
                 <div className="flex justify-between items-center pb-4 border-b mb-4">
                    <h3 className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400">{reportTypes[activeReport].name}</h3>
                    <button onClick={() => { setActiveReport(null); setGeneratedData(null); }} className={secondaryButton}><ArrowLeft size={16}/> Back to Reports List</button>
                 </div>
                 {!areFiltersHidden && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg">
                        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className={inputStyle} title="Start Date"/>
                        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className={inputStyle} title="End Date"/>
                        <select name="location" value={filters.location} onChange={handleFilterChange} className={inputStyle}>
                            <option value="">All Locations</option>
                            {locations.slice().sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)).map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                        </select>
                        <select name="paymentType" value={filters.paymentType} onChange={handleFilterChange} className={inputStyle} disabled={activeReport !== 'income'}>
                            <option value="">All Payment Types</option>
                            {paymentModes.slice().sort((a,b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                    </div>
                 )}
                 <div className="flex justify-center my-4">
                    <button onClick={generateReportData} className={primaryButton}>
                        <RefreshCw size={16} /> Generate Report
                    </button>
                 </div>
                <ReportComponent data={generatedData} onExport={handleExport} />
            </div>
        )
    }

    return (
        <div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                 {Object.entries(reportTypes).sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([key, {name}]) => (
                     <div key={key} onClick={() => setActiveReport(key)} className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all">
                        <h4 className="font-bold text-lg">{name}</h4>
                     </div>
                 ))}
            </div>
        </div>
    )
}