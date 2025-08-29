import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useClients, useLocations, usePaymentModes } from '../../contexts/AppContexts';
import { Event, AppPermissions, UserRole } from '../../types';
import { primaryButton, secondaryButton, inputStyle } from '../../components/common/styles';
import { exportReportToPdf, exportReportToExcel } from '../../lib/export';
import { IncomeReport } from './IncomeReport';
import { ExpenseReport } from './ExpenseReport';
import { ProfitabilityReport } from './ProfitabilityReport';
import { SalesReport } from './SalesReport';
import { ArrowLeft, RefreshCw, ChevronDown } from 'lucide-react';
import { AdditionalPaxReport } from './AdditionalPaxReport';
import { yyyyMMDDToDate, formatYYYYMMDD, formatDateRange, dateToYYYYMMDD } from '../../lib/utils';
import { SalesFunnelReport } from './SalesFunnelReport';

interface ReportsManagerProps {
    managedEvents: Event[];
    permissions: AppPermissions;
    userRole: UserRole;
}

export const ReportsManager: React.FC<ReportsManagerProps> = ({ managedEvents, permissions, userRole }) => {
    const { clients } = useClients();
    const { locations } = useLocations();
    const { settings: paymentModes } = usePaymentModes();
    
    const [activeReport, setActiveReport] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        location: [] as string[],
        paymentType: '',
    });
    const [generatedData, setGeneratedData] = useState<any[] | null>(null);
    const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
    const locationFilterRef = useRef<HTMLDivElement>(null);

    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (locationFilterRef.current && !locationFilterRef.current.contains(event.target as Node)) {
                setIsLocationDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    const allReportTypes: Record<string, {name: string, component: React.FC<any>, requiredFilters: string[]}> = {
        income: { name: "Income Report", component: IncomeReport, requiredFilters: ['startDate', 'endDate']},
        expense: { name: "Expense Report", component: ExpenseReport, requiredFilters: ['startDate', 'endDate']},
        profitability: { name: "Event Profitability", component: ProfitabilityReport, requiredFilters: []},
        sales: { name: "Monthly Sales Report", component: SalesReport, requiredFilters: [] },
        additionalPax: { name: "Additional PAX Report", component: AdditionalPaxReport, requiredFilters: ['startDate', 'endDate'] },
        salesFunnel: { name: "Sales Funnel Report", component: SalesFunnelReport, requiredFilters: ['startDate', 'endDate'] },
    };

    const visibleReportTypes = useMemo(() => {
        if (userRole === 'admin') {
            return allReportTypes;
        }
        const visibleKeys = permissions.visibleReports || [];
        return Object.entries(allReportTypes)
            .filter(([key]) => visibleKeys.includes(key))
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {} as typeof allReportTypes);
    }, [userRole, permissions, allReportTypes]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setGeneratedData(null);
    };

    const handleLocationCheckboxChange = (locationName: string) => {
        setFilters(prev => {
            const newLocations = new Set(prev.location);
            if (newLocations.has(locationName)) {
                newLocations.delete(locationName);
            } else {
                newLocations.add(locationName);
            }
            return { ...prev, location: Array.from(newLocations) };
        });
        setGeneratedData(null);
    };

    const generateReportData = () => {
        if (!activeReport) return;

        let data: any[] = [];

        const { startDate, endDate, location, paymentType } = filters;
        const filterStart = startDate ? yyyyMMDDToDate(startDate) : null;
        const filterEnd = endDate ? yyyyMMDDToDate(endDate) : null;

        if (activeReport === 'income') {
            let allIncome: any[] = [];
            managedEvents.filter(event => event.state === 'confirmed').forEach(event => {
                const eventIncomes = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted);
                eventIncomes.forEach(income => {
                    allIncome.push({
                        client: clientMap.get(event.clientId) || 'N/A',
                        event: event.eventType,
                        eventDate: formatDateRange(event.startDate, event.endDate),
                        paymentDate: formatYYYYMMDD(income.date, { day: '2-digit', month: '2-digit', year: 'numeric' }),
                        paymentMode: income.paymentMode,
                        notes: income.notes,
                        amount: income.amount,
                        paymentFullDate: yyyyMMDDToDate(income.date),
                        location: event.location,
                    });
                });
            });
            data = allIncome.filter(row => {
                if (filterStart && row.paymentFullDate < filterStart) return false;
                if (filterEnd && row.paymentFullDate > filterEnd) return false;
                if (location.length > 0 && !location.includes(row.location)) return false;
                if (paymentType && row.paymentMode !== paymentType) return false;
                return true;
            }).sort((a, b) => a.paymentFullDate.getTime() - b.paymentFullDate.getTime());
        }
        else if (activeReport === 'expense') {
            let allExpenses: any[] = [];
            managedEvents.filter(event => event.state === 'confirmed').forEach(event => {
                const eventExpenses = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted);
                eventExpenses.forEach(expense => {
                    allExpenses.push({
                        client: clientMap.get(event.clientId) || 'N/A',
                        event: event.eventType,
                        eventDate: formatDateRange(event.startDate, event.endDate),
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
                if (filterStart && row.expenseFullDate < filterStart) return false;
                if (filterEnd && row.expenseFullDate > filterEnd) return false;
                if (location.length > 0 && !location.includes(row.location)) return false;
                return true;
            }).sort((a, b) => a.expenseFullDate.getTime() - b.expenseFullDate.getTime());
        } else if (activeReport === 'salesFunnel') {
            if (!filterStart || !filterEnd) {
                alert("Please select both a Start and End date for this report.");
                setGeneratedData([]);
                return;
            }

            const filteredEvents = managedEvents.filter(event => {
                if (!event.createdAt) return false;
                const creationDate = new Date(event.createdAt);
                creationDate.setHours(0,0,0,0);
                return creationDate >= filterStart && creationDate <= filterEnd;
            });

            const calculateEventValue = (event: Event) => {
                const model = event.pricingModel || 'variable';
                const pax = event.pax || 0;
                const perPax = event.perPaxPrice || 0;
                const rent = event.rent || 0;
                let baseCost = 0;
                if (model === 'variable') baseCost = pax * perPax;
                else if (model === 'flat') baseCost = rent;
                else if (model === 'mix') baseCost = rent + (pax * perPax);
                const totalCharges = (event.charges || []).filter(c => !c.isDeleted).reduce((sum, charge) => sum + charge.amount, 0);
                return baseCost + totalCharges;
            };

            const funnel = {
                totalLeads: { name: 'Total Leads', count: 0, value: 0 },
                confirmed: { name: 'Confirmed', count: 0, value: 0, conversionRate: 0 },
                lost: { name: 'Lost', count: 0, value: 0, conversionRate: 0 },
                cancelled: { name: 'Cancelled', count: 0, value: 0, conversionRate: 0 },
            };

            filteredEvents.forEach(event => {
                const value = calculateEventValue(event);
                funnel.totalLeads.count++;
                funnel.totalLeads.value += value;

                switch(event.state) {
                    case 'confirmed':
                        funnel.confirmed.count++;
                        funnel.confirmed.value += value;
                        break;
                    case 'lost':
                        funnel.lost.count++;
                        funnel.lost.value += value;
                        break;
                    case 'cancelled':
                        funnel.cancelled.count++;
                        funnel.cancelled.value += value;
                        break;
                    case 'lead':
                        // Leads are part of the total but not a separate funnel stage below it in this model
                        break;
                }
            });

            if (funnel.totalLeads.count > 0) {
                funnel.confirmed.conversionRate = (funnel.confirmed.count / funnel.totalLeads.count) * 100;
                funnel.lost.conversionRate = (funnel.lost.count / funnel.totalLeads.count) * 100;
                funnel.cancelled.conversionRate = (funnel.cancelled.count / funnel.totalLeads.count) * 100;
            }
            // Use setGeneratedData directly with the single object, not an array
            setGeneratedData(funnel as any);
            return; // Exit early to avoid array logic below
        } else {
            const filteredEventsForReports = managedEvents.filter(event => {
                const eventStart = yyyyMMDDToDate(event.startDate);
                const eventEnd = event.endDate ? yyyyMMDDToDate(event.endDate) : eventStart;
                if (filterStart && eventEnd < filterStart) return false;
                if (filterEnd && eventStart > filterEnd) return false;
                if (location.length > 0 && !location.includes(event.location)) return false;
                return true;
            });

            if (activeReport === 'profitability') {
                const cutoffDateStr = filters.endDate || dateToYYYYMMDD(new Date());
                const cutoffDate = yyyyMMDDToDate(cutoffDateStr);

                const concludedEvents = filteredEventsForReports.filter(event => {
                    if (event.state !== 'confirmed') return false;
                    const eventEnd = yyyyMMDDToDate(event.endDate || event.startDate);
                    return eventEnd <= cutoffDate;
                });
                
                data = concludedEvents.map(event => {
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
                        eventDate: formatDateRange(event.startDate, event.endDate),
                        totalBill,
                        totalExpenses,
                        profit
                    };
                });
                data.sort((a, b) => b.profit - a.profit);
            } else if (activeReport === 'additionalPax') {
                data = filteredEventsForReports
                    .filter(event => event.state === 'confirmed')
                    .flatMap(event => {
                    const additionalPaxCharges = (event.charges || []).filter(c => c.type === 'Additional PAX' && !c.isDeleted);
                    return additionalPaxCharges.map(charge => ({
                        client: clientMap.get(event.clientId) || 'N/A',
                        event: event.eventType,
                        eventDate: formatDateRange(event.startDate, event.endDate),
                        initialPax: event.pax || 0,
                        perPaxRate: event.perPaxPrice || 0,
                        additionalPax: charge.additionalPaxCount || 0,
                        discount: charge.discountAmount || 0,
                        chargeAmount: charge.amount,
                        notes: charge.notes || '',
                    }));
                });
            }
        }

        if (activeReport === 'sales') {
            const today = new Date();
            const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
            const threeMonthsHence = new Date(today.getFullYear(), today.getMonth() + 4, 0);

            const locationFilteredEvents = location.length > 0
                ? managedEvents.filter(e => location.includes(e.location))
                : managedEvents;

            const eventsInRange = locationFilteredEvents.filter(e => {
                if (e.state !== 'confirmed') return false;
                const eventStart = yyyyMMDDToDate(e.startDate);
                return eventStart >= threeMonthsAgo && eventStart <= threeMonthsHence;
            });

            const groupedByMonth: { [key: string]: { monthName: string, events: any[] } } = {};

            eventsInRange.forEach(event => {
                const eventDate = yyyyMMDDToDate(event.startDate);
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
                    date: formatDateRange(event.startDate, event.endDate),
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
                .map(([monthKey, { monthName, events }]) => {
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
        }

        setGeneratedData(data);
    };

    const handleExport = (format: 'pdf' | 'excel', headers: string[], data: any[][]) => {
        const fileName = `${activeReport}_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        const activeFilters = {
            'Date Range': filters.startDate && filters.endDate ? `${filters.startDate} to ${filters.endDate}` : '',
            'Location': filters.location.join(', '),
            'Payment Type': filters.paymentType,
        };
        
        if (format === 'pdf') {
            exportReportToPdf(visibleReportTypes[activeReport!].name, headers, data, activeFilters, fileName);
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
        const ReportComponent = visibleReportTypes[activeReport].component;
        
        const showLocationFilter = ['income', 'expense', 'additionalPax', 'sales'].includes(activeReport);
        const showDateFilters = ['income', 'expense', 'additionalPax', 'salesFunnel'].includes(activeReport);
        const showPaymentFilter = activeReport === 'income';
        const showAnyFilter = showLocationFilter || showDateFilters || showPaymentFilter;

        return (
             <div>
                 <div className="flex justify-between items-center pb-4 border-b mb-4">
                    <h3 className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400">{visibleReportTypes[activeReport].name}</h3>
                    <button onClick={() => { setActiveReport(null); setGeneratedData(null); }} className={secondaryButton}><ArrowLeft size={16}/> Back to Reports List</button>
                 </div>
                 {showAnyFilter && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg">
                        {showDateFilters ? (
                            <>
                                <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className={inputStyle} title={activeReport === 'salesFunnel' ? "Creation Start Date" : "Start Date"}/>
                                <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className={inputStyle} title={activeReport === 'salesFunnel' ? "Creation End Date" : "End Date"}/>
                            </>
                        ) : <div className="hidden lg:block lg:col-span-2"></div>}
                        
                        {showLocationFilter ? (
                             <div className="relative lg:col-start-3" ref={locationFilterRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsLocationDropdownOpen(prev => !prev)}
                                    className={inputStyle + " flex justify-between items-center text-left w-full"}
                                >
                                    <span>
                                        {filters.location.length === 0
                                            ? "All Locations"
                                            : filters.location.length === 1
                                            ? filters.location[0]
                                            : `${filters.location.length} locations selected`}
                                    </span>
                                    <ChevronDown size={16} />
                                </button>
                                {isLocationDropdownOpen && (
                                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-warm-gray-700 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                        {locations.slice().sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)).map(l => (
                                            <label key={l.id} className="flex items-center gap-2 px-3 py-2 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-600 cursor-pointer w-full">
                                                <input
                                                    type="checkbox"
                                                    checked={filters.location.includes(l.name)}
                                                    onChange={() => handleLocationCheckboxChange(l.name)}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <span>{l.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : <div className="hidden lg:block"></div>}

                        {showPaymentFilter ? (
                             <select name="paymentType" value={filters.paymentType} onChange={handleFilterChange} className={inputStyle}>
                                <option value="">All Payment Types</option>
                                {paymentModes.slice().sort((a,b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                        ) : <div className="hidden lg:block"></div>}
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
                 {Object.entries(visibleReportTypes).sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([key, {name}]) => (
                     <div key={key} onClick={() => setActiveReport(key)} className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all">
                        <h4 className="font-bold text-lg">{name}</h4>
                     </div>
                 ))}
            </div>
        </div>
    )
}