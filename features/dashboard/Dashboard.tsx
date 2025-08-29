import React, { useMemo, useState, useEffect } from 'react';
import { useEvents, useClients, useCompetitionSettings, useLostReasonSettings } from '../../contexts/AppContexts';
import { useAuth, useUserPermissions, useManagedLocations } from '../../contexts/AuthContext';
import { Event, EventSession, EventState, StateChangeHistoryEntry, PermissionLevel, UserRole, Client } from '../../types';
import { EventCard } from '../../components/EventCard';
import MenuCreator from '../menu-creator/MenuCreator';
import { FinanceManager } from '../finance/FinanceManager';
import { StatCard } from './StatCard';
import { CalendarView } from './CalendarView';
import { secondaryButton, dangerButton, inputStyle, iconButton } from '../../components/common/styles';
import { LayoutGrid, Calendar as CalendarIcon, ArrowLeft, X, CalendarDays, BadgeHelp, FileSignature, CircleDollarSign } from 'lucide-react';
import { ServicePlannerPage } from '../service-planning/ServicePlannerPage';
import { KitchenPlanPage } from '../kitchen-plan/KitchenPlanPage';
import Modal from '../../components/Modal';
import { formatYYYYMMDD, yyyyMMDDToDate } from '../../lib/utils';
import { EventForm } from '../../components/forms/EventForm';

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

type EventFilter = 'upcoming' | 'leads' | 'finalize' | 'collect' | null;

export const Dashboard = ({ onNavigate, managedEvents, onNavigateToMenu, showStats = true, eventsFilter, dashboardState, setDashboardState, clients }: {
    onNavigate: (clientId: string) => void,
    managedEvents: Event[],
    onNavigateToMenu?: (event: Event, state: 'MENU_CREATOR' | 'FINANCE' | 'SERVICE_PLANNER' | 'KITCHEN_PLAN') => void,
    showStats?: boolean;
    eventsFilter?: (events: Event[]) => Event[];
    dashboardState: { view: 'grid' | 'calendar', dateFilter: string | null, activeFilter: EventFilter, selectedLocations: string[] },
    setDashboardState: React.Dispatch<React.SetStateAction<{ view: 'grid' | 'calendar', dateFilter: string | null, activeFilter: EventFilter, selectedLocations: string[] }>>,
    clients: Client[],
}) => {
    const { updateEvent, deleteEvent, duplicateEvent } = useEvents();
    const { currentUser } = useAuth();
    const permissions = useUserPermissions();
    const { settings: competitionSettings } = useCompetitionSettings();
    const { settings: lostReasonSettings } = useLostReasonSettings();
    const managedLocations = useManagedLocations();

    const { view, dateFilter, activeFilter, selectedLocations } = dashboardState;
    const setView = (newView: 'grid' | 'calendar') => setDashboardState(prev => ({...prev, view: newView, dateFilter: null}));
    const setActiveFilter = (newFilter: EventFilter) => setDashboardState(prev => ({...prev, activeFilter: newFilter, dateFilter: null}));
    const handleLocationChange = (newLocations: string[]) => {
        setDashboardState(prev => ({ ...prev, selectedLocations: newLocations }));
    };

    type PageState = 'LIST' | 'MENU_CREATOR' | 'FINANCE' | 'SERVICE_PLANNER' | 'KITCHEN_PLAN';
    const [pageState, setPageState] = useState<PageState>('LIST');
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [eventToCancel, setEventToCancel] = useState<Event | null>(null);
    
    const [isLostModalOpen, setIsLostModalOpen] = useState(false);
    const [lostReasonId, setLostReasonId] = useState('');
    const [competitionId, setCompetitionId] = useState('');
    const [lostNotes, setLostNotes] = useState('');
    const [eventToMarkAsLost, setEventToMarkAsLost] = useState<Event | null>(null);
    
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

    useEffect(() => {
        // Clean up selectedLocations if they are no longer managed by the current user
        if (currentUser && currentUser.role !== 'admin') {
            const managedLocationNames = new Set(managedLocations.map(l => l.name));
            setDashboardState(prev => {
                const newSelected = prev.selectedLocations.filter(locName => managedLocationNames.has(locName));
                if (newSelected.length !== prev.selectedLocations.length) {
                    return { ...prev, selectedLocations: newSelected };
                }
                return prev;
            });
        }
    }, [managedLocations, currentUser, setDashboardState]);

    const eventsToDisplay = useMemo(() => {
        return eventsFilter ? eventsFilter(managedEvents) : managedEvents;
    }, [managedEvents, eventsFilter]);

    const stats = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Start of today for comparison

        const upcomingEvents = eventsToDisplay.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'confirmed');
        const activeLeads = eventsToDisplay.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'lead');
        const menusToFinalize = eventsToDisplay.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'confirmed' && e.status === 'draft' && e.templateId !== 'NO_FOOD');
        
        const paymentsToCollect = eventsToDisplay.filter(e => {
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
    }, [eventsToDisplay]);

    const filteredEvents = useMemo(() => {
        if (dateFilter) {
            return eventsToDisplay.filter(event => {
                const start = yyyyMMDDToDate(event.startDate);
                const end = event.endDate ? yyyyMMDDToDate(event.endDate) : start;
                const filterDate = yyyyMMDDToDate(dateFilter);
                return filterDate >= start && filterDate <= end;
            });
        }
        
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (activeFilter === 'upcoming') {
            return eventsToDisplay.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'confirmed');
        }
        if (activeFilter === 'leads') {
            return eventsToDisplay.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'lead');
        }
        if (activeFilter === 'finalize') {
            return eventsToDisplay.filter(e => yyyyMMDDToDate(e.endDate || e.startDate) >= now && e.state === 'confirmed' && e.status === 'draft' && e.templateId !== 'NO_FOOD');
        }
        if (activeFilter === 'collect') {
            return eventsToDisplay.filter(e => {
                if (e.state !== 'confirmed') return false;
                
                const { balanceDue } = calculateFinancials(e);
                
                return balanceDue > 0;
            });
        }
        // Default (null filter) shows all upcoming leads and confirmed events for non-kitchen users, or just the pre-filtered events for kitchen users
        return eventsFilter ? eventsToDisplay : eventsToDisplay.filter(e => (e.state === 'confirmed' || e.state === 'lead') && yyyyMMDDToDate(e.endDate || e.startDate) >= now);
    }, [activeFilter, eventsToDisplay, dateFilter, eventsFilter]);
    
    const filterTitles: Record<string, string> = {
        upcoming: "Upcoming Confirmed Events",
        leads: "Active Leads",
        finalize: "Menus to Finalize",
        collect: "Events with Payments Due"
    };
    
    const handleBackToCalendar = () => {
        setView('calendar');
    }
    
    const handleEditEvent = (event: Event) => {
        setEventToEdit(event);
        setIsEventModalOpen(true);
    };

    const handleSaveEvent = async (eventData: Omit<Event, 'id'> | Event) => {
        if ('id' in eventData) {
            await updateEvent(eventData);
        }
        setIsEventModalOpen(false);
        setEventToEdit(null);
    };

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
            stateHistory: [...(eventToUpdate.stateHistory || []), historyEntry]
        };
        
        if (newState !== 'lost') {
            delete updatedEvent.lostReasonId;
            delete updatedEvent.lostToCompetitionId;
            delete updatedEvent.lostNotes;
        }
        
        if (newState === 'lost' || newState === 'cancelled') {
            updatedEvent.status = 'finalized'; // Lock the menu
        }
        
        await updateEvent(updatedEvent);
    };

    const handleRequestCancel = (eventToCancel: Event) => {
        setEventToCancel(eventToCancel);
        setIsCancelModalOpen(true);
    };

    const handleRequestLost = (event: Event) => {
        setEventToMarkAsLost(event);
        setLostReasonId('');
        setCompetitionId('');
        setLostNotes('');
        setIsLostModalOpen(true);
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

    const handleConfirmLost = async () => {
        if (!eventToMarkAsLost || !lostReasonId) {
            alert('A reason is required to mark the event as lost.');
            return;
        }

        const selectedReason = lostReasonSettings.find(r => r.id === lostReasonId);
        if (!selectedReason) {
            alert('Invalid reason selected.');
            return;
        }

        let reasonForHistory = `Reason: ${selectedReason.name}.`;
        let finalCompetitionId: string | undefined = undefined;

        if (selectedReason.isCompetitionReason) {
            if (!competitionId) {
                alert('Please select a competitor.');
                return;
            }
            const competitor = competitionSettings.find(c => c.id === competitionId);
            if (competitor) {
                reasonForHistory += ` Lost to: ${competitor.name}.`;
                finalCompetitionId = competitor.id;
            } else {
                alert('Invalid competitor selected.');
                return;
            }
        }
        
        if (lostNotes.trim()) {
            reasonForHistory += ` Notes: ${lostNotes.trim()}`;
        }
        
        const eventWithLostInfo: Event = {
            ...eventToMarkAsLost,
            lostReasonId,
            lostToCompetitionId: finalCompetitionId,
            lostNotes: lostNotes.trim() || undefined,
        };
        
        await handleStateChange(eventWithLostInfo, 'lost', reasonForHistory);

        setIsLostModalOpen(false);
        setLostReasonId('');
        setCompetitionId('');
        setLostNotes('');
        setEventToMarkAsLost(null);
    };

    const handleEditorSave = (updatedEvent: Event) => {
        setSelectedEvent(updatedEvent);
        updateEvent(updatedEvent);
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
        : activeFilter ? filterTitles[activeFilter] : (eventsFilter ? "Upcoming Confirmed Events" : "Upcoming Events");

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
        return <MenuCreator initialEvent={selectedEvent} client={client} onSave={handleEditorSave} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} />;
    }
    if (pageState === 'FINANCE' && selectedEvent && permissions) {
        return <FinanceManager 
            event={selectedEvent} 
            onSave={handleEditorSave} 
            onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} 
            permissionCore={permissions.financeCore}
            permissionCharges={permissions.financeCharges}
            permissionPayments={permissions.financePayments}
            permissionExpenses={permissions.financeExpenses}
        />;
    }
     if (pageState === 'SERVICE_PLANNER' && selectedEvent) {
        return <ServicePlannerPage event={selectedEvent} onSave={handleEditorSave} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} canModify={canModify} />;
    }
    if (pageState === 'KITCHEN_PLAN' && selectedEvent) {
       return <KitchenPlanPage event={selectedEvent} onCancel={handleBackFromKitchenPlan} />;
    }
    
    // Default to list view if not in an editor state
    return (
        <div>
            {isEventModalOpen && eventToEdit && (
                <Modal isOpen={true} onClose={() => setIsEventModalOpen(false)} title="Edit Event">
                    <EventForm 
                        onSave={handleSaveEvent} 
                        onCancel={() => setIsEventModalOpen(false)} 
                        event={eventToEdit} 
                        clientId={eventToEdit.clientId} 
                        isReadOnly={!canModify} 
                    />
                </Modal>
            )}
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
            {isLostModalOpen && (
                <Modal isOpen={isLostModalOpen} onClose={() => setIsLostModalOpen(false)} title="Mark Event as Lost">
                     <div className="space-y-4">
                        <p className="mb-2">Please provide details about why this lead was lost: "{eventToMarkAsLost?.eventType}".</p>
                        <div>
                            <label className="block text-sm font-medium">Reason</label>
                            <select value={lostReasonId} onChange={e => setLostReasonId(e.target.value)} required className={inputStyle}>
                                <option value="">-- Select Reason --</option>
                                {lostReasonSettings.sort((a,b)=>a.name.localeCompare(b.name)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        {lostReasonSettings.find(r => r.id === lostReasonId)?.isCompetitionReason && (
                             <div>
                                <label className="block text-sm font-medium">Competitor</label>
                                <select value={competitionId} onChange={e => setCompetitionId(e.target.value)} required className={inputStyle}>
                                    <option value="">-- Select Competitor --</option>
                                    {competitionSettings.sort((a,b)=>a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium">Notes (Optional)</label>
                            <textarea value={lostNotes} onChange={e => setLostNotes(e.target.value)} className={inputStyle} rows={3} placeholder="Add any additional details..."/>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setIsLostModalOpen(false)} className={secondaryButton}>Back</button>
                            <button type="button" onClick={handleConfirmLost} className={dangerButton} disabled={!lostReasonId || (!!lostReasonSettings.find(r => r.id === lostReasonId)?.isCompetitionReason && !competitionId)}>Confirm Lost</button>
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
            
             {showStats && view === 'grid' && !dateFilter && (
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
                                <div className="flex items-center gap-4">
                                    {dateFilter && (
                                        <button onClick={handleBackToCalendar} className={iconButton('hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700')}>
                                            <ArrowLeft size={20}/>
                                        </button>
                                    )}
                                    <h4 className="text-xl font-bold">{displayTitle}</h4>
                                </div>
                                {activeFilter && !dateFilter && (
                                    <button onClick={() => setActiveFilter(null)} className={secondaryButton}>
                                        <X size={16} className="text-accent-500"/> Clear Filter
                                    </button>
                                )}
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
                                                        onEdit={() => handleEditEvent(event)}
                                                        onDelete={() => handleDeleteEvent(event)}
                                                        onDuplicate={() => handleDuplicateEvent(event)}
                                                        onNavigate={(state) => {
                                                            if (onNavigateToMenu) {
                                                                onNavigateToMenu(event, state);
                                                            } else {
                                                                setSelectedEvent(event);
                                                                setPageState(state);
                                                            }
                                                        }}
                                                        canModify={canModify}
                                                        canAccessFinances={canAccessFinances}
                                                        showClientName={true}
                                                        userRole={currentUser?.role}
                                                        onClientClick={() => onNavigate(event.clientId)}
                                                        onStateChange={handleStateChange}
                                                        onRequestCancel={handleRequestCancel}
                                                        onRequestLost={handleRequestLost}
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
                        events={eventsToDisplay} 
                        clients={clients}
                        onDateSelect={(date) => { setDashboardState(prev => ({ ...prev, view: 'grid', dateFilter: date, activeFilter: null })); }}
                        selectedLocations={selectedLocations}
                        onLocationChange={handleLocationChange}
                      />
                }
            </div>
        </div>
    );
};
