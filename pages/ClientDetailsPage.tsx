import React, { useState, useMemo, useEffect } from 'react';
import { useEvents, useClients, useCompetitionSettings, useLostReasonSettings } from '../contexts/AppContexts';
import { useAuth } from '../contexts/AuthContext';
import { useUserPermissions } from '../hooks/usePermissions';
import { Event, Client, EventState, StateChangeHistoryEntry, FinancialHistoryEntry } from '../types';
import MenuCreator from '../features/menu-creator/MenuCreator';
import { Plus, Edit, Trash2, Copy, Building, Phone, Mail, Map as MapIcon, Briefcase, Copy as CopyIcon, ArrowLeft, Banknote } from 'lucide-react';
import Modal from '../components/Modal';
import { primaryButton, dangerButton, secondaryButton, inputStyle, iconButton } from '../components/common/styles';
import { ClientForm } from '../components/forms/ClientForm';
import { EventForm } from '../components/forms/EventForm';
import { FinanceManager } from '../features/finance/FinanceManager';
import { ClientFinanceManager } from '../features/finance/ClientFinanceManager';
import { ServicePlannerPage } from '../features/service-planning/ServicePlannerPage';
import { KitchenPlanPage } from '../features/kitchen-plan/KitchenPlanPage';
import { EventsTab } from '../features/clients/tabs/EventsTab';
import { TasksTab } from '../features/clients/tabs/TasksTab';
import { ActivitiesTab } from '../features/clients/tabs/ActivitiesTab';
import { HistoryTab } from '../features/clients/tabs/HistoryTab';

interface ClientDetailsPageProps {
  clientId: string;
  onBack: () => void;
  eventIdToOpen?: string | null;
  eventToEditId?: string | null;
}

type PageState = 'LIST' | 'MENU_CREATOR' | 'FINANCE' | 'SERVICE_PLANNER' | 'KITCHEN_PLAN' | 'CLIENT_FINANCE';
type TabName = 'events' | 'tasks' | 'activities' | 'history';

const generateChanges = (oldData: any, newData: any, fields: string[]): { field: string, from: any, to: any }[] => {
    const changes: { field: string, from: any, to: any }[] = [];
    for (const field of fields) {
        const oldValue = oldData[field] ?? '';
        const newValue = newData[field] ?? '';
        if (oldValue !== newValue) {
            changes.push({ field, from: oldValue, to: newValue });
        }
    }
    return changes;
};


export const ClientDetailsPage: React.FC<ClientDetailsPageProps> = ({
  clientId,
  onBack,
}) => {
    // Hooks
    const { clients, updateClient, deleteClient } = useClients();
    const { events, addEvent, updateEvent, deleteEvent, duplicateEvent } = useEvents();
    const permissions = useUserPermissions();
    const { currentUser } = useAuth();
    const { settings: competitionSettings } = useCompetitionSettings();
    const { settings: lostReasonSettings } = useLostReasonSettings();

    // Page state
    const [pageState, setPageState] = useState<PageState>('LIST');
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [activeTab, setActiveTab] = useState<TabName>('events');

    // Modal states
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [eventToCancel, setEventToCancel] = useState<Event | null>(null);
    const [isLostModalOpen, setIsLostModalOpen] = useState(false);
    const [lostReasonId, setLostReasonId] = useState('');
    const [competitionId, setCompetitionId] = useState('');
    const [lostNotes, setLostNotes] = useState('');
    const [eventToMarkAsLost, setEventToMarkAsLost] = useState<Event | null>(null);

    // Memos
    const client = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);
    const clientEvents = useMemo(() => events.filter(e => e.clientId === clientId).sort((a, b) => b.startDate.localeCompare(a.startDate)), [events, clientId]);

    // Handlers
    const handleSaveClient = async (clientData: Client | Omit<Client, 'id'>) => {
        if (!currentUser || !client) return;

        const phone = (clientData as Client).phone?.trim();
        if (phone) {
            const existingClient = clients.find(c => c.phone === phone && c.id !== client.id);
            if (existingClient) {
                alert(`Error: Another client (${existingClient.name}) already exists with this phone number.`);
                return; // Prevent saving
            }
        }

        const oldClient = { ...client };
        const updatedClient = { ...oldClient, ...clientData, id: client.id };

        const changes = generateChanges(oldClient, updatedClient, ['name', 'phone', 'email', 'company', 'address', 'referredBy', 'status']);
        if (changes.length > 0) {
            const reason = window.prompt("Please provide a reason for these changes:");
            if (!reason) return;
            const historyEntry: FinancialHistoryEntry = {
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
                username: currentUser.username,
                action: 'updated',
                reason,
                changes
            };
            updatedClient.history = [...(client.history || []), historyEntry];
        }
        await updateClient(updatedClient);
        setIsClientModalOpen(false);
    };

    const handleSaveEvent = async (eventData: Omit<Event, 'id'> | Event) => {
        if ('id' in eventData) {
            await updateEvent(eventData);
        } else {
            await addEvent(eventData);
        }
        setIsEventModalOpen(false);
        setEventToEdit(null);
    };
    
    const handleNavigateToPage = (event: Event | null, state: PageState) => {
        setSelectedEvent(event);
        setPageState(state);
    };

    const handleStateChange = async (eventToUpdate: Event, newState: EventState, reason?: string) => {
        if (!currentUser) return alert("Authentication error. Please log in again.");
        const historyEntry: StateChangeHistoryEntry = {
            timestamp: new Date().toISOString(), userId: currentUser.id, username: currentUser.username,
            fromState: eventToUpdate.state, toState: newState, reason: reason,
        };
        const updatedEvent: Event = { ...eventToUpdate, state: newState, stateHistory: [...(eventToUpdate.stateHistory || []), historyEntry]};
        if (newState !== 'lost') {
            delete updatedEvent.lostReasonId;
            delete updatedEvent.lostToCompetitionId;
            delete updatedEvent.lostNotes;
        }
        if (newState === 'lost' || newState === 'cancelled') updatedEvent.status = 'finalized';
        await updateEvent(updatedEvent);
    };

    const handleRequestCancel = (event: Event) => { setEventToCancel(event); setIsCancelModalOpen(true); };
    const handleRequestLost = (event: Event) => { setEventToMarkAsLost(event); setIsLostModalOpen(true); };

    const handleConfirmCancel = async () => {
        if (eventToCancel && cancelReason.trim()) {
            await handleStateChange(eventToCancel, 'cancelled', cancelReason);
            setIsCancelModalOpen(false); setCancelReason(''); setEventToCancel(null);
        } else { alert('A reason is required to cancel the event.'); }
    };
    
    const handleConfirmLost = async () => {
        if (!eventToMarkAsLost || !lostReasonId) return alert('A reason is required to mark the event as lost.');
        const selectedReason = lostReasonSettings.find(r => r.id === lostReasonId);
        if (!selectedReason) return alert('Invalid reason selected.');
        let reasonForHistory = `Reason: ${selectedReason.name}.`;
        let finalCompetitionId: string | undefined = undefined;
        if (selectedReason.isCompetitionReason) {
            if (!competitionId) return alert('Please select a competitor.');
            const competitor = competitionSettings.find(c => c.id === competitionId);
            if (competitor) { reasonForHistory += ` Lost to: ${competitor.name}.`; finalCompetitionId = competitor.id; }
            else return alert('Invalid competitor selected.');
        }
        if (lostNotes.trim()) reasonForHistory += ` Notes: ${lostNotes.trim()}`;
        const eventWithLostInfo: Event = { ...eventToMarkAsLost, lostReasonId, lostToCompetitionId: finalCompetitionId, lostNotes: lostNotes.trim() || undefined, };
        await handleStateChange(eventWithLostInfo, 'lost', reasonForHistory);
        setIsLostModalOpen(false); setLostReasonId(''); setCompetitionId(''); setLostNotes(''); setEventToMarkAsLost(null);
    };

    const handleDeleteEvent = (event: Event) => { if (window.confirm("Are you sure?")) deleteEvent(event); };
    const handleDuplicateEvent = (event: Event) => { if (window.confirm("Duplicate this event as a new lead?")) duplicateEvent(event); };

    const handleDeleteClient = async () => {
        if (!client) return;
        if (window.confirm(`ARE YOU SURE you want to delete client "${client.name}"? This will also delete all their associated events and cannot be undone.`)) {
            try {
                await deleteClient(client.id);
                onBack(); // Go back after deletion
            } catch (error) {
                console.error("Failed to delete client:", error);
                alert(`An error occurred: ${error}`);
            }
        }
    };

    const handleCopyCredentials = () => {
        if (client) {
            navigator.clipboard.writeText(`Username: ${client.phone}\nPassword: ${client.phone}`);
            alert('Credentials copied to clipboard!');
        }
    };

    const handleEditorSave = async (updatedEvent: Event) => {
        setSelectedEvent(updatedEvent);
        await updateEvent(updatedEvent);
    };

    if (!client) return <div className="text-center p-8"><p>Loading client...</p></div>;

    if (pageState !== 'LIST') {
        switch (pageState) {
            case 'MENU_CREATOR': return <MenuCreator initialEvent={selectedEvent!} client={client} onSave={handleEditorSave} onCancel={() => setPageState('LIST')} />;
            case 'FINANCE': return <FinanceManager 
                event={selectedEvent!} 
                onSave={handleEditorSave} 
                onCancel={() => setPageState('LIST')} 
                permissionCore={permissions?.financeCore || 'none'} 
                permissionCharges={permissions?.financeCharges || 'none'} 
                permissionPayments={permissions?.financePayments || 'none'} 
                permissionExpenses={permissions?.financeExpenses || 'none'} />;
            case 'SERVICE_PLANNER': return <ServicePlannerPage event={selectedEvent!} onSave={handleEditorSave} onCancel={() => setPageState('LIST')} canModify={permissions?.clientsAndEvents === 'modify'} />;
            case 'KITCHEN_PLAN': return <KitchenPlanPage event={selectedEvent!} onCancel={() => setPageState('LIST')} />;
            case 'CLIENT_FINANCE': return <ClientFinanceManager client={client} clientEvents={clientEvents} onSave={updateClient} onCancel={() => setPageState('LIST')} />;
        }
    }

    const canModify = permissions?.clientsAndEvents === 'modify';
    const canAccessFinances = permissions?.financeCore !== 'none' || permissions?.financeCharges !== 'none' || permissions?.financePayments !== 'none' || permissions?.financeExpenses !== 'none';
    const isRegularUser = currentUser?.role === 'regular';

    return (
        <div>
            {isClientModalOpen && <Modal isOpen={true} onClose={() => setIsClientModalOpen(false)} title="Edit Client"><ClientForm onSave={handleSaveClient} onCancel={() => setIsClientModalOpen(false)} client={client} /></Modal>}
            {isEventModalOpen && <Modal isOpen={true} onClose={() => setIsEventModalOpen(false)} title={eventToEdit ? "Edit Event" : "Add Event"}><EventForm onSave={handleSaveEvent} onCancel={() => setIsEventModalOpen(false)} event={eventToEdit} clientId={clientId} isReadOnly={!canModify} /></Modal>}
            {isCancelModalOpen && <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Event"><textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} required className={inputStyle} rows={3} placeholder="e.g., Client postponed, duplicate entry, etc."/><div className="flex justify-end gap-3 pt-4"><button onClick={() => setIsCancelModalOpen(false)} className={secondaryButton}>Back</button><button onClick={handleConfirmCancel} className={dangerButton} disabled={!cancelReason.trim()}>Confirm Cancellation</button></div></Modal>}
            {isLostModalOpen && <Modal isOpen={isLostModalOpen} onClose={() => setIsLostModalOpen(false)} title="Mark Event as Lost"><div className="space-y-4"><select value={lostReasonId} onChange={e => setLostReasonId(e.target.value)} required className={inputStyle}><option value="">-- Select Reason --</option>{lostReasonSettings.sort((a,b)=>a.name.localeCompare(b.name)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>{lostReasonSettings.find(r => r.id === lostReasonId)?.isCompetitionReason && (<select value={competitionId} onChange={e => setCompetitionId(e.target.value)} required className={inputStyle}><option value="">-- Select Competitor --</option>{competitionSettings.sort((a,b)=>a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}<textarea value={lostNotes} onChange={e => setLostNotes(e.target.value)} className={inputStyle} rows={3} placeholder="Add any additional details..."/><div className="flex justify-end gap-3 pt-4"><button onClick={() => setIsLostModalOpen(false)} className={secondaryButton}>Back</button><button onClick={handleConfirmLost} className={dangerButton} disabled={!lostReasonId || (!!lostReasonSettings.find(r => r.id === lostReasonId)?.isCompetitionReason && !competitionId)}>Confirm Lost</button></div></div></Modal>}

            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                    {!isRegularUser && <button onClick={onBack} className={iconButton('hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700')}><ArrowLeft size={20}/></button>}
                    <div>
                        <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100 flex items-center gap-2">{client.name} {client.status === 'inactive' && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warm-gray-200 text-warm-gray-600 dark:bg-warm-gray-600 dark:text-warm-gray-200">Inactive</span>}</h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-warm-gray-500 mt-1">
                            {client.company && <span className="flex items-center gap-1.5"><Briefcase size={14}/> {client.company}</span>}
                            {client.phone && <span className="flex items-center gap-1.5"><Phone size={14}/> {client.phone}</span>}
                            {client.email && <span className="flex items-center gap-1.5"><Mail size={14}/> {client.email}</span>}
                            {client.address && <span className="flex items-center gap-1.5"><MapIcon size={14}/> {client.address}</span>}
                             {client.hasSystemAccess && !isRegularUser && (
                                <button onClick={handleCopyCredentials} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                                    <CopyIcon size={14}/> Copy Credentials
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    {client.isAdvanceClient && !isRegularUser && (
                        <button onClick={() => handleNavigateToPage(null, 'CLIENT_FINANCE')} className={secondaryButton}>
                            <Banknote size={16}/> Finances
                        </button>
                    )}
                    {!isRegularUser && canModify && <button onClick={() => setIsClientModalOpen(true)} className={secondaryButton}><Edit size={16}/> Edit Client</button>}
                    {!isRegularUser && currentUser?.role === 'admin' && (
                        <button onClick={handleDeleteClient} className={dangerButton}>
                            <Trash2 size={16}/> Delete Client
                        </button>
                    )}
                </div>
            </div>

            {!isRegularUser && (
                <div className="border-b border-warm-gray-200 dark:border-warm-gray-700 mb-6">
                    <nav className="-mb-px flex space-x-8 overflow-x-auto">
                        <button onClick={() => setActiveTab('events')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'events' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>Events</button>
                        <button onClick={() => setActiveTab('tasks')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'tasks' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>Tasks</button>
                        <button onClick={() => setActiveTab('activities')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'activities' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>Activities</button>
                        <button onClick={() => setActiveTab('history')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'history' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>History</button>
                    </nav>
                </div>
            )}
            
            <div>
                {activeTab === 'events' && <EventsTab clientEvents={clientEvents} canModify={canModify} canAccessFinances={canAccessFinances} onAddEvent={() => { setEventToEdit(null); setIsEventModalOpen(true); }} onEditEvent={(e) => { setEventToEdit(e); setIsEventModalOpen(true); }} onDeleteEvent={handleDeleteEvent} onDuplicateEvent={handleDuplicateEvent} onNavigate={(e, s) => handleNavigateToPage(e,s)} onStateChange={handleStateChange} onRequestCancel={handleRequestCancel} onRequestLost={handleRequestLost} />}
                {activeTab === 'tasks' && <TasksTab client={client} />}
                {activeTab === 'activities' && <ActivitiesTab client={client} />}
                {activeTab === 'history' && <HistoryTab client={client} />}
            </div>
        </div>
    );
};
