

import React, { useMemo, useState } from 'react';
import { useEvents, useClients } from '../../contexts/AppContexts';
import { useAuth, useUserPermissions } from '../../contexts/AuthContext';
import { Event, EventSession, EventState, StateChangeHistoryEntry, PermissionLevel } from '../../types';
import { EventCard } from '../../components/EventCard';
import MenuCreator from '../menu-creator/MenuCreator';
import { LiveCounterSelectorPage } from '../live-counters/LiveCounterSelectorPage';
import { FinanceManager } from '../finance/FinanceManager';
import { StatCard } from './StatCard';
import { CalendarView } from './CalendarView';
import { secondaryButton, dangerButton, inputStyle } from '../../components/common/styles';
import { LayoutGrid, Calendar as CalendarIcon, ArrowLeft, X, CalendarDays, BadgeHelp, FileSignature, CircleDollarSign } from 'lucide-react';
import { ServicePlannerPage } from '../service-planning/ServicePlannerPage';
import { KitchenPlanPage } from '../kitchen-plan/KitchenPlanPage';
import Modal from '../../components/Modal';
import { formatYYYYMMDD, yyyyMMDDToDate } from '../../lib/utils';

const calculateFinancials = (event: Event) => {
    const model = event.pricingModel || 'variable';
    const pax = event.pax || 0;
    const perPax = event.perPaxPrice || 0;
    const rent = event.rent || 0;
    
    let baseCost = 0;
    if (model === 'variable') baseCost = pax * perPax;
    else if (model === 'flat') baseCost = rent;
    else if (model === 'mix') baseCost = rent + (pax * perPax);

    const totalCharges = (event.charges || []).filter(c => !c.isDeleted).reduce((sum, charge) => sum + charge.amount, 0);
    const totalPayments = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted).reduce((sum, payment) => sum + payment.amount, 0);
    const totalExpenses = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted).reduce((sum, expense) => sum + expense.amount, 0);

    const totalBill = baseCost + totalCharges;
    const balanceDue = totalBill - totalPayments;
    const profit = totalBill - totalExpenses;

    return { totalBill, totalPayments, totalExpenses, balanceDue, profit };
};

export const Dashboard = ({ onNavigate, managedEvents }: {
    onNavigate: (page: 'clients' | 'dashboard', clientId?: string, eventId?: string, action?: 'editEvent' | 'viewMenu') => void,
    managedEvents: Event[],
}) => {
    const { updateEvent, deleteEvent, duplicateEvent } = useEvents();
    const { clients } = useClients();
    const { currentUser } = useAuth();
    const permissions = useUserPermissions();

    const [view, setView] = useState<'grid' | 'calendar'>('calendar');
    type EventFilter = 'upcoming' | 'leads' | 'finalize' | 'collect' | null;
    const [activeFilter, setActiveFilter] = useState<EventFilter>('upcoming');
    const [dateFilter, setDateFilter] = useState<string | null>(null);

    type PageState = 'LIST' | 'MENU_CREATOR' | 'LIVE_COUNTER_SELECTOR' | 'FINANCE' | 'SERVICE_PLANNER' | 'KITCHEN_PLAN';
    const [pageState, setPageState] = useState<PageState>('LIST');
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [eventToCancel, setEventToCancel] = useState<Event | null>(null);

    const stats = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today for comparison

        const upcomingEvents = managedEvents.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'confirmed');
        const activeLeads = managedEvents.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'lead');
        const menusToFinalize = managedEvents.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'confirmed' && e.status === 'draft' && e.templateId !== 'NO_FOOD');
        
        const paymentsToCollect = managedEvents.filter(e => {
            if (e.state !== 'confirmed') return false;
            
            const { balanceDue } = calculateFinancials(e);
            
            return balanceDue > 0;
        }).length;

        return {
            upcomingEvents: upcomingEvents.length,
            activeLeads: activeLeads.length,
            menusToFinalize: menusToFinalize.length,
            paymentsToCollect,
        };
    }, [managedEvents]);

    const filteredEvents = useMemo(() => {
        if (dateFilter) {
            return managedEvents.filter(event => {
                const start = yyyyMMDDToDate(event.startDate);
                const end = event.endDate ? yyyyMMDDToDate(event.endDate) : start;
                const filterDate = yyyyMMDDToDate(dateFilter);
                return filterDate >= start && filterDate <= end;
            });
        }
        
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (activeFilter === 'upcoming') {
            return managedEvents.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'confirmed');
        }
        if (activeFilter === 'leads') {
            return managedEvents.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'lead');
        }
        if (activeFilter === 'finalize') {
            return managedEvents.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'confirmed' && e.status === 'draft' && e.templateId !== 'NO_FOOD');
        }
        if (activeFilter === 'collect') {
            return managedEvents.filter(e => {
                if (e.state !== 'confirmed') return false;
                
                const { balanceDue } = calculateFinancials(e);
                
                return balanceDue > 0;
            });
        }
        // Default (null filter) shows all upcoming leads and confirmed events
        return managedEvents.filter(e => (e.state === 'confirmed' || e.state === 'lead') && yyyyMMDDToDate(e.endDate || e.startDate) >= now);
    }, [activeFilter, managedEvents, dateFilter]);
    
    const filterTitles: Record<string, string> = {
        upcoming: "Upcoming Confirmed Events",
        leads: "Active Leads",
        finalize: "Menus to Finalize",
        collect: "Events with Payments Due"
    };
    
    const handleBackToCalendar = () => {
        setDateFilter(null);
        setView('calendar');
    }

    const handleStateChange = async (eventToUpdate: Event, newState: EventState, reason?: string) => {
        if (!currentUser) {
            alert("Authentication error. Please log in again.");
            return;
        }
        const historyEntry: StateChangeHistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
            fromState: eventToUpdate.state,
            toState: newState,
            reason: reason,
        };
        
        const updatedEvent: Event = {
            ...eventToUpdate,
            state: newState,
            stateHistory: [...(eventToUpdate.stateHistory || []), historyEntry],
        };
        
        if (newState === 'lost' || newState === 'cancelled') {
            updatedEvent.status = 'finalized'; // Lock the menu
        }
        
        await updateEvent(updatedEvent);
    };

    const handleRequestCancel = (eventToCancel: Event) => {
        setEventToCancel(eventToCancel);
        setIsCancelModalOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (eventToCancel && cancelReason.trim()) {
            await handleStateChange(eventToCancel, 'cancelled', cancelReason);
            setIsCancelModalOpen(false);
            setCancelReason('');
            setEventToCancel(null);
        } else {
            alert('A reason is required to cancel the event.');
        }
    };

    const handleSaveMenu = (updatedEvent: Event) => {
        updateEvent(updatedEvent);
        setPageState('LIST');
        setSelectedEvent(null);
    };
    const handleSaveLiveCounters = (event: Event, updatedCounters: Record<string, string[]>) => {
        updateEvent({ ...event, liveCounters: updatedCounters });
        setPageState('LIST');
        setSelectedEvent(null);
    };
    const handleSaveFinance = (updatedEvent: Event) => {
        updateEvent(updatedEvent);
        setPageState('LIST');
        setSelectedEvent(null);
    };
    const handleSaveServicePlan = (updatedEvent: Event) => {
        updateEvent(updatedEvent);
        setPageState('LIST');
        setSelectedEvent(null);
    };
    const handleBackFromKitchenPlan = () => {
        setPageState('LIST');
        setSelectedEvent(null);
    };
    const handleDeleteEvent = async (event: Event) => {
        if (window.confirm(`Are you sure you want to delete the event "${event.eventType}"? This cannot be undone.`)) {
            await deleteEvent(event);
        }
    };
    const handleDuplicateEvent = async (event: Event) => {
        if (window.confirm(`Are you sure you want to duplicate the event "${event.eventType}"? A new lead will be created.`)) {
            await duplicateEvent(event);
        }
    };
    
    const canModify = permissions?.clientsAndEvents === 'modify';
    const canAccessFinances = useMemo(() => {
        if (!permissions) return false;
        return permissions.financeCore !== 'none' || permissions.financeCharges !== 'none' || permissions.financePayments !== 'none' || permissions.financeExpenses !== 'none';
    }, [permissions]);
    
    const displayTitle = dateFilter 
        ? `Events for ${formatYYYYMMDD(dateFilter)}` 
        : activeFilter ? filterTitles[activeFilter] : "Upcoming Events";

    const groupedAndSortedEvents = useMemo(() => {
        const sorted = filteredEvents.sort((a, b) => a.startDate.localeCompare(b.startDate));
        const groups: { [key: string]: { monthName: string, events: Event[] } } = {};
        
        sorted.forEach(event => {
            const eventDate = yyyyMMDDToDate(event.startDate);
            const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
            const monthName = eventDate.toLocaleString('default', { month: 'long', year: 'numeric' });

            if (!groups[monthKey]) {
                groups[monthKey] = { monthName, events: [] };
            }
            groups[monthKey].events.push(event);
        });
        
        return Object.keys(groups).sort().map(key => groups[key]);

    }, [filteredEvents]);

    // --- RENDER LOGIC ---
    if (pageState === 'MENU_CREATOR' && selectedEvent) {
        const client = clients.find(c => c.id === selectedEvent.clientId);
        if (!client) {
            return (
                <div className="text-center p-8">
                    <h2 className="text-2xl font-bold">Error</h2>
                    <p>Could not find the client associated with this event.</p>
                    <button onClick={() => { setPageState('LIST'); setSelectedEvent(null); }} className={`${secondaryButton} mt-4`}>Go Back</button>
                </div>
            );
        }
        return <MenuCreator initialEvent={selectedEvent} client={client} onSave={handleSaveMenu} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} />;
    }
    if (pageState === 'LIVE_COUNTER_SELECTOR' && selectedEvent) {
        return <LiveCounterSelectorPage event={selectedEvent} onSave={handleSaveLiveCounters} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} canModify={canModify} />;
    }
    if (pageState === 'FINANCE' && selectedEvent && permissions) {
        return <FinanceManager 
            event={selectedEvent} 
            onSave={handleSaveFinance} 
            onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} 
            permissionCore={permissions.financeCore}
            permissionCharges={permissions.financeCharges}
            permissionPayments={permissions.financePayments}
            permissionExpenses={permissions.financeExpenses}
        />;
    }
     if (pageState === 'SERVICE_PLANNER' && selectedEvent) {
        return <ServicePlannerPage event={selectedEvent} onSave={handleSaveServicePlan} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} canModify={canModify} />;
    }
    if (pageState === 'KITCHEN_PLAN' && selectedEvent) {
       return <KitchenPlanPage event={selectedEvent} onCancel={handleBackFromKitchenPlan} />;
    }
    
    // Default to list view if not in an editor state
    return (
        <div>
             {isCancelModalOpen && (
                <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Event">
                    <div>
                        <p className="text-sm mb-4">Please provide a reason for cancelling the event: "{eventToCancel?.eventType}".</p>
                        <textarea
                            value={cancelReason}
                            onChange={e => setCancelReason(e.target.value)}
                            required
                            className={inputStyle}
                            rows={3}
                            placeholder="e.g., Client postponed, duplicate entry, etc."
                        />
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setIsCancelModalOpen(false)} className={secondaryButton}>Back</button>
                            <button type="button" onClick={handleConfirmCancel} className={dangerButton} disabled={!cancelReason.trim()}>Confirm Cancellation</button>
                        </div>
                    </div>
                </Modal>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pb-4">
                <div className="flex items-center gap-1 bg-warm-gray-200 dark:bg-warm-gray-700 p-1 rounded-lg">
                    <button onClick={() => setView('grid')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'grid' ? 'bg-white dark:bg-warm-gray-900 text-primary-600 shadow-sm' : 'text-warm-gray-600 dark:text-warm-gray-300'}`}>
                        <LayoutGrid size={16} className="inline mr-1" /> Grid
                    </button>
                    <button onClick={() => setView('calendar')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${view === 'calendar' ? 'bg-white dark:bg-warm-gray-900 text-primary-600 shadow-sm' : 'text-warm-gray-600 dark:text-warm-gray-300'}`}>
                       <CalendarIcon size={16} className="inline mr-1"/> Calendar
                    </button>
                </div>
            </div>
            
             {view === 'grid' && !dateFilter && (
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6 my-6">
                        <StatCard title="Active Leads" value={stats.activeLeads} icon={BadgeHelp} color="text-yellow-500" isActive={activeFilter === 'leads'} onClick={() => setActiveFilter(activeFilter === 'leads' ? null : 'leads')}/>
                        <StatCard title="Upcoming Events" value={stats.upcomingEvents} icon={CalendarDays} color="text-green-500" isActive={activeFilter === 'upcoming'} onClick={() => setActiveFilter(activeFilter === 'upcoming' ? null : 'upcoming')}/>
                        <StatCard title="Menus to Finalize" value={stats.menusToFinalize} icon={FileSignature} color="text-sky-500" isActive={activeFilter === 'finalize'} onClick={() => setActiveFilter(activeFilter === 'finalize' ? null : 'finalize')}/>
                        <StatCard title="Payments to Collect" value={stats.paymentsToCollect} icon={CircleDollarSign} color="text-blue-500" isActive={activeFilter === 'collect'} onClick={() => setActiveFilter(activeFilter === 'collect' ? null : 'collect')}/>
                </div>
             )}


            <div className="mt-4">
                {view === 'grid' 
                    ? (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xl font-bold">{displayTitle}</h4>
                                {dateFilter 
                                    ? <button onClick={handleBackToCalendar} className={secondaryButton}><ArrowLeft size={16}/> Back to Calendar</button>
                                    : (activeFilter && <button onClick={() => setActiveFilter(null)} className={secondaryButton}><X size={16} className="text-accent-500"/> Clear Filter</button>)
                                }
                            </div>
                            {groupedAndSortedEvents.length === 0 ? (
                                <p className="text-center py-8 text-warm-gray-500">No events match the current filter.</p>
                            ) : (
                                <div className="space-y-8">
                                    {groupedAndSortedEvents.map(({ monthName, events }) => (
                                        <div key={monthName}>
                                            <h3 className="font-bold text-lg mb-4 text-primary-600 dark:text-primary-400">{monthName}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {events.map(event => (
                                                    <EventCard
                                                        key={event.id}
                                                        event={event}
                                                        onEdit={() => onNavigate('clients', event.clientId, event.id, 'editEvent')}
                                                        onDelete={() => handleDeleteEvent(event)}
                                                        onDuplicate={() => handleDuplicateEvent(event)}
                                                        onNavigate={(state) => {
                                                            setSelectedEvent(event);
                                                            setPageState(state);
                                                        }}
                                                        canModify={canModify}
                                                        canAccessFinances={canAccessFinances}
                                                        showClientName={true}
                                                        onClientClick={() => onNavigate('clients', event.clientId)}
                                                        onStateChange={handleStateChange}
                                                        onRequestCancel={handleRequestCancel}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                    : <CalendarView 
                        events={managedEvents} 
                        clients={clients}
                        onDateSelect={(date) => { setDateFilter(date); setView('grid'); }}
                      />
                }
            </div>
        </div>
    );
};