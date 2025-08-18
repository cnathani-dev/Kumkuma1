

import React, { useMemo, useState, useEffect } from 'react';
import { Client, Event, EventState, FinancialHistoryEntry } from '../../types';
import { useClients, useClientTasks, useEvents } from '../../contexts/AppContexts';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/Modal';
import { ClientForm } from '../../components/forms/ClientForm';
import { EventForm } from '../../components/forms/EventForm';
import { primaryButton, inputStyle, secondaryButton } from '../../components/common/styles';
import { Plus, Building, Phone, UserCheck, BellDot, Filter, X } from 'lucide-react';
import { dateToYYYYMMDD, yyyyMMDDToDate } from '../../lib/utils';

type FilterShape = { 
    name: string;
    phone: string;
    status: 'active' | 'inactive' | 'all';
    eventState: 'all' | 'lead' | 'confirmed' | 'lost';
    tasks: 'all' | 'overdue';
    startDate: string;
    endDate: string;
    creationStartDate: string;
    creationEndDate: string;
};

const defaultFilters: Omit<FilterShape, 'name' | 'phone'> = {
    status: 'active',
    eventState: 'all',
    tasks: 'all',
    startDate: '',
    endDate: '',
    creationStartDate: '',
    creationEndDate: '',
};

const ActiveFilterPill = ({ label, onRemove }: { label: string, onRemove: () => void }) => (
    <span className="flex items-center gap-1.5 bg-primary-100 text-primary-800 text-xs font-semibold px-2 py-1 rounded-full dark:bg-primary-500/20 dark:text-primary-300">
        {label}
        <button onClick={onRemove} className="rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5">
            <X size={12} />
        </button>
    </span>
);

const AddEventStep = ({ client, onSave, onSkip }: {
    client: Client;
    onSave: (event: Omit<Event, 'id'>) => void;
    onSkip: () => void;
}) => {
    return (
        <div>
            <h4 className="font-bold text-lg mb-4">
                Add an initial event for <span className="text-primary-600">{client.name}</span>?
            </h4>
            <EventForm 
                onSave={onSave}
                onCancel={onSkip}
                event={null}
                clientId={client.id}
                isReadOnly={false}
            />
        </div>
    );
};


export const ClientList = ({ clients, events, onNavigate, filters, setFilters }: { 
    clients: Client[],
    events: Event[],
    onNavigate: (page: 'clients' | 'dashboard', clientId: string) => void,
    filters: FilterShape,
    setFilters: React.Dispatch<React.SetStateAction<FilterShape>>
}) => {
    const [wizardStep, setWizardStep] = useState<'closed' | 'client' | 'event'>('closed');
    const [newlyCreatedClient, setNewlyCreatedClient] = useState<Client | null>(null);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const { addClient } = useClients();
    const { addEvent } = useEvents();
    const { currentUser } = useAuth();
    const { tasks } = useClientTasks();
    
    const overdueTasksByClient = useMemo(() => {
        const map = new Map<string, boolean>();
        const today = dateToYYYYMMDD(new Date());
        tasks.forEach(task => {
            if (!task.isCompleted && task.dueDate && today > task.dueDate) {
                map.set(task.clientId, true);
            }
        });
        return map;
    }, [tasks]);

    const dateFilteredClientIds = useMemo(() => {
        const { startDate, endDate } = filters;
        if (!startDate && !endDate) {
            return null;
        }

        const clientIds = new Set<string>();
        const filterStart = startDate ? yyyyMMDDToDate(startDate) : null;
        const filterEnd = endDate ? yyyyMMDDToDate(endDate) : null;

        events.forEach(event => {
            const eventStart = yyyyMMDDToDate(event.startDate);
            const eventEnd = event.endDate ? yyyyMMDDToDate(event.endDate) : eventStart;
            
            const overlaps = 
                (!filterStart || eventEnd >= filterStart) && 
                (!filterEnd || eventStart <= filterEnd);

            if (overlaps) {
                clientIds.add(event.clientId);
            }
        });
        return clientIds;
    }, [events, filters.startDate, filters.endDate]);

    const filteredClients = useMemo(() => {
        const clientEventStates = new Map<string, Set<EventState>>();
        events.forEach(event => {
            if (!clientEventStates.has(event.clientId)) {
                clientEventStates.set(event.clientId, new Set());
            }
            clientEventStates.get(event.clientId)!.add(event.state);
        });
    
        return clients.filter(client => {
            const nameMatch = client.name.toLowerCase().includes(filters.name.toLowerCase());
            const phoneMatch = client.phone.toLowerCase().includes(filters.phone.toLowerCase());
            const statusMatch = (filters.status === 'all') || ((client.status || 'active') === filters.status);
            
            if (!nameMatch || !phoneMatch || !statusMatch) {
                return false;
            }
    
            if (filters.eventState !== 'all') {
                const clientStates = clientEventStates.get(client.id);
                if (!clientStates || !clientStates.has(filters.eventState)) {
                    return false;
                }
            }

            if (filters.tasks === 'overdue') {
                if (!overdueTasksByClient.has(client.id)) {
                    return false;
                }
            }
            
            if (dateFilteredClientIds !== null && !dateFilteredClientIds.has(client.id)) {
                return false;
            }

            const { creationStartDate, creationEndDate } = filters;
            if (creationStartDate || creationEndDate) {
                const creationEntry = client.history?.find(h => h.action === 'created');
                if (!creationEntry) return false;
                
                const creationDate = new Date(creationEntry.timestamp);
                creationDate.setHours(0,0,0,0);
                
                if (creationStartDate) {
                    const filterStart = yyyyMMDDToDate(creationStartDate);
                    if (creationDate < filterStart) return false;
                }
                if (creationEndDate) {
                    const filterEnd = yyyyMMDDToDate(creationEndDate);
                    if (creationDate > filterEnd) return false;
                }
            }
    
            return true;
        });
    }, [clients, events, filters, overdueTasksByClient, dateFilteredClientIds]);

    const handleOpenWizard = () => {
        setNewlyCreatedClient(null);
        setWizardStep('client');
    };

    const handleCloseWizard = () => {
        setWizardStep('closed');
        setNewlyCreatedClient(null);
    };

    const handleClientStepSave = async (clientData: Omit<Client, 'id'>) => {
        if (!currentUser) return alert("Authentication error.");

        try {
            const historyEntry: FinancialHistoryEntry = {
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
                username: currentUser.username,
                action: 'created',
                reason: 'Client Created',
            };
            const clientWithHistory = { ...clientData, history: [historyEntry] };
            const newClientId = await addClient(clientWithHistory);
            const newClientWithId: Client = { ...clientWithHistory, id: newClientId };

            setNewlyCreatedClient(newClientWithId);
            setWizardStep('event');
        } catch (error) {
            console.error("Failed to add client:", error);
            alert("An error occurred while adding the client.");
        }
    };

    const handleEventStepSave = async (eventData: Omit<Event, 'id'>) => {
        try {
            await addEvent(eventData);
            handleCloseWizard();
        } catch (error) {
            console.error("Failed to add event:", error);
            alert("An error occurred while adding the event.");
        }
    };

    const handleClearAdvancedFilters = () => {
        setFilters(prev => ({
            ...prev,
            ...defaultFilters,
        }));
    };
    
    const handleRemoveFilter = (key: keyof typeof defaultFilters) => {
        setFilters(prev => ({
            ...prev,
            [key]: defaultFilters[key]
        }));
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({...prev, [name]: value}));
    };

    const renderActiveFilterPills = () => {
        const pills = [];
        if(filters.status !== defaultFilters.status) pills.push(<ActiveFilterPill key="status" label={`Status: ${filters.status}`} onRemove={() => handleRemoveFilter('status')} />);
        if(filters.eventState !== defaultFilters.eventState) pills.push(<ActiveFilterPill key="eventState" label={`Event: ${filters.eventState}`} onRemove={() => handleRemoveFilter('eventState')} />);
        if(filters.tasks !== defaultFilters.tasks) pills.push(<ActiveFilterPill key="tasks" label={`Tasks: ${filters.tasks}`} onRemove={() => handleRemoveFilter('tasks')} />);
        if(filters.startDate) pills.push(<ActiveFilterPill key="startDate" label={`Event From: ${filters.startDate}`} onRemove={() => handleRemoveFilter('startDate')} />);
        if(filters.endDate) pills.push(<ActiveFilterPill key="endDate" label={`Event To: ${filters.endDate}`} onRemove={() => handleRemoveFilter('endDate')} />);
        if(filters.creationStartDate) pills.push(<ActiveFilterPill key="creationStartDate" label={`Created From: ${filters.creationStartDate}`} onRemove={() => handleRemoveFilter('creationStartDate')} />);
        if(filters.creationEndDate) pills.push(<ActiveFilterPill key="creationEndDate" label={`Created To: ${filters.creationEndDate}`} onRemove={() => handleRemoveFilter('creationEndDate')} />);
        return pills;
    };
    
    return (
        <div>
             <Modal 
                isOpen={wizardStep !== 'closed'} 
                onClose={handleCloseWizard} 
                title={wizardStep === 'client' ? 'Add New Client (Step 1 of 2)' : 'Create Event (Step 2 of 2)'}
            >
                {wizardStep === 'client' && (
                    <ClientForm 
                        onSave={handleClientStepSave}
                        onCancel={handleCloseWizard}
                        saveButtonText="Next"
                    />
                )}
                {wizardStep === 'event' && newlyCreatedClient && (
                    <AddEventStep
                        client={newlyCreatedClient}
                        onSave={handleEventStepSave}
                        onSkip={handleCloseWizard}
                    />
                )}
            </Modal>

            <div className="flex justify-between items-center pb-4">
                <h3 className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400">Clients</h3>
                <button onClick={handleOpenWizard} className={`${primaryButton} text-nowrap`}>
                    <Plus size={16} /> <span className="hidden sm:inline">Add Client</span>
                </button>
            </div>

             <div className="mb-6 p-4 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Search by name..." name="name" value={filters.name} onChange={handleFilterChange} className={inputStyle} />
                    <input type="text" placeholder="Search by phone..." name="phone" value={filters.phone} onChange={handleFilterChange} className={inputStyle} />
                </div>
                
                <div>
                    <button onClick={() => setShowAdvancedFilters(prev => !prev)} className="text-sm font-semibold text-primary-600 hover:underline">
                        {showAdvancedFilters ? 'Hide Filters' : 'More Filters'}
                    </button>
                </div>
                
                {showAdvancedFilters && (
                    <div className="pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700/50 space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Client Status</label>
                                <select name="status" value={filters.status} onChange={handleFilterChange} className={inputStyle}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="all">All</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Event Status</label>
                                <select name="eventState" value={filters.eventState} onChange={handleFilterChange} className={inputStyle}>
                                    <option value="all">All</option>
                                    <option value="lead">Lead</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="lost">Lost</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Tasks</label>
                                <select name="tasks" value={filters.tasks} onChange={handleFilterChange} className={inputStyle}>
                                    <option value="all">All</option>
                                    <option value="overdue">Has Overdue</option>
                                </select>
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Event Start Date</label>
                                <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Event End Date</label>
                                <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className={inputStyle} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium">Client Creation Start Date</label>
                                <input type="date" name="creationStartDate" value={filters.creationStartDate} onChange={handleFilterChange} className={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Client Creation End Date</label>
                                <input type="date" name="creationEndDate" value={filters.creationEndDate} onChange={handleFilterChange} className={inputStyle} />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button onClick={handleClearAdvancedFilters} className={secondaryButton}>Clear Advanced Filters</button>
                        </div>
                    </div>
                )}
                
                <div className="pt-2 flex flex-wrap gap-2 empty:hidden">
                    {renderActiveFilterPills()}
                </div>
            </div>

            {filteredClients.length === 0 ? (
                 <div className="text-center py-16">
                    <p className="text-warm-gray-500">No clients match the current filters.</p>
                </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {filteredClients.sort((a,b) => a.name.localeCompare(b.name)).map(client => {
                    const hasOverdueTask = overdueTasksByClient.has(client.id);
                    return (
                        <div key={client.id} onClick={() => onNavigate('clients', client.id)} className="bg-white dark:bg-warm-gray-800 rounded-lg shadow-md p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all">
                            <div className="flex items-center justify-between">
                                <h5 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200 flex items-center gap-2">
                                   {hasOverdueTask && <span title="Overdue tasks"><BellDot size={16} className="text-accent-500 flex-shrink-0" /></span>}
                                   <Building size={16} className="text-primary-600 flex-shrink-0"/>
                                   <span className="truncate">{client.name}</span>
                                    {client.hasSystemAccess && (
                                        <span title="Has System Access">
                                            <UserCheck size={16} className="text-green-500" />
                                        </span>
                                    )}
                                </h5>
                                {client.status === 'inactive' && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warm-gray-200 text-warm-gray-600 dark:bg-warm-gray-600 dark:text-warm-gray-200">
                                        Inactive
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-warm-gray-500 mt-2 flex items-center gap-2"><Phone size={14}/> {client.phone || 'N/A'}</p>
                        </div>
                    );
                })}
            </div>
            )}
        </div>
    );
};