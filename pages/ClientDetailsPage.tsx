import React, { useState, useMemo, useEffect } from 'react';
import { useEvents, useClients } from '../../App';
import { useAuth, useUserPermissions } from '../../contexts/AuthContext';
import { Event, Client, EventState, StateChangeHistoryEntry, PermissionLevel } from '../types';
import MenuCreator from '../features/menu-creator/MenuCreator';
import { Plus, Edit, Trash2, Copy, Save, UserCheck, Check } from 'lucide-react';
import Modal from '../components/Modal';
import { EventCard } from '../components/EventCard';
import { primaryButton, dangerButton, secondaryButton, inputStyle } from '../components/common/styles';
import { ClientForm } from '../components/forms/ClientForm';
import { EventForm } from '../components/forms/EventForm';
import { LiveCounterSelectorPage } from '../features/live-counters/LiveCounterSelectorPage';
import { FinanceManager } from '../features/finance/FinanceManager';
import { ServicePlannerPage } from '../features/service-planning/ServicePlannerPage';
import { KitchenPlanPage } from '../features/kitchen-plan/KitchenPlanPage';
import { yyyyMMDDToDate } from '../lib/utils';

interface ClientDetailsPageProps {
  clientId: string;
  onBack: () => void;
  eventIdToOpen?: string | null;
  eventToEditId?: string | null;
}

export const ClientDetailsPage: React.FC<ClientDetailsPageProps> = ({ clientId, onBack, eventIdToOpen, eventToEditId }) => {
    const { clients, updateClient, deleteClient } = useClients();
    const { events, addEvent, updateEvent, deleteEvent, duplicateEvent } = useEvents();
    const { currentUser } = useAuth();
    const permissions = useUserPermissions();
    
    type PageState = 'LIST' | 'MENU_CREATOR' | 'LIVE_COUNTER_SELECTOR' | 'FINANCE' | 'SERVICE_PLANNER' | 'KITCHEN_PLAN';
    const [pageState, setPageState] = useState<PageState>('LIST');
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const canModify = permissions?.clientsAndEvents === 'modify';
    const canAccessFinances = useMemo(() => {
        if (!permissions) return false;
        return permissions.financeCore !== 'none' || permissions.financeCharges !== 'none' || permissions.financePayments !== 'none' || permissions.financeExpenses !== 'none';
    }, [permissions]);

    const client = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);
    const clientEvents = useMemo(() => events.filter(e => e.clientId === clientId).sort((a, b) => yyyyMMDDToDate(b.date).getTime() - yyyyMMDDToDate(a.date).getTime()), [events, clientId]);

    useEffect(() => {
        if (eventIdToOpen) {
            const event = events.find(e => e.id === eventIdToOpen);
            if (event) {
                setSelectedEvent(event);
                setPageState('MENU_CREATOR');
            }
        }
    }, [eventIdToOpen, events]);

    useEffect(() => {
        if (eventToEditId) {
            const event = events.find(e => e.id === eventToEditId);
            if (event) {
                setSelectedEvent(event);
                setIsEventModalOpen(true);
            }
        }
    }, [eventToEditId, events]);
    
    useEffect(() => {
        // This effect ensures that if the event data changes in the global context
        // (e.g., after a save), the local state `selectedEvent` is updated.
        // This is crucial for keeping the UI in sync without navigating away.
        if (selectedEvent) {
            const updatedEventFromGlobalState = events.find(e => e.id === selectedEvent.id);
            if (updatedEventFromGlobalState) {
                // Basic deep comparison to prevent unnecessary re-renders and potential loops
                if (JSON.stringify(updatedEventFromGlobalState) !== JSON.stringify(selectedEvent)) {
                    setSelectedEvent(updatedEventFromGlobalState);
                }
            }
        }
    }, [events, selectedEvent]);


    if (!client) {
        return (
            <div className="text-center p-8">
                <h2 className="text-2xl font-bold">Client not found</h2>
                <p>The client you are looking for does not exist or could not be loaded.</p>
                <button onClick={onBack} className={`${secondaryButton} mt-4`}>Go Back</button>
            </div>
        );
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
        if (!canModify) return;
        setSelectedEvent(eventToCancel);
        setIsCancelModalOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (selectedEvent && cancelReason.trim() && canModify) {
            await handleStateChange(selectedEvent, 'cancelled', cancelReason);
            setIsCancelModalOpen(false);
            setCancelReason('');
            setSelectedEvent(null);
        } else {
            alert('A reason is required to cancel the event.');
        }
    };

    const handleSaveEvent = async (eventData: Omit<Event, 'id'> | Event) => {
        try {
            if ('id' in eventData) {
                await updateEvent(eventData);
            } else {
                await addEvent(eventData);
            }
            setIsEventModalOpen(false);
            setSelectedEvent(null);
        } catch (error) {
            console.error(error);
            alert(`Failed to save event: ${error}`);
        }
    };
    
    const handleDeleteEvent = async (event: Event) => {
        if (window.confirm(`Are you sure you want to delete the event "${event.eventType}"? This cannot be undone.`)) {
            try {
                await deleteEvent(event);
            } catch(e) {
                console.error(e);
                alert(`Failed to delete event: ${e}`);
            }
        }
    }

    const handleDuplicateEvent = async (event: Event) => {
        if (window.confirm(`Are you sure you want to duplicate the event "${event.eventType}"? A new lead will be created.`)) {
            try {
                await duplicateEvent(event);
            } catch(e) {
                console.error(e);
                alert(`Failed to duplicate event: ${e}`);
            }
        }
    };
    
    const handleSaveMenu = (updatedEvent: Event) => {
        updateEvent(updatedEvent);
        setPageState('LIST');
        setSelectedEvent(null);
    }
    
    const handleSaveLiveCounters = (event: Event, updatedCounters: Record<string, string[]>) => {
        updateEvent({ ...event, liveCounters: updatedCounters });
        setPageState('LIST');
        setSelectedEvent(null);
    }
    
    const handleSaveFinance = (updatedEvent: Event) => {
        // Only update the event data. Do not navigate away.
        // The useEffect above will handle updating the local state to reflect the change.
        updateEvent(updatedEvent);
    }

    const handleSaveServicePlan = (updatedEvent: Event) => {
        updateEvent(updatedEvent);
        setPageState('LIST');
        setSelectedEvent(null);
    };

    const handleBackFromKitchenPlan = () => {
        setPageState('LIST');
        setSelectedEvent(null);
    };
    
    const copyClientLink = () => {
        const url = `${window.location.origin}?clientId=${client.id}`;
        navigator.clipboard.writeText(url).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleSaveClient = async (clientData: Client) => {
        try {
            await updateClient(clientData);
            setIsClientModalOpen(false);
        } catch (error) {
            console.error("Failed to update client:", error);
            alert(`Failed to update client: ${error}`);
        }
    };
    
    const handleDeleteClient = () => {
        if (window.confirm(`Are you sure you want to delete ${client.name}? This will also delete all associated events and their user accounts. This action CANNOT be undone.`)) {
            deleteClient(client.id);
            onBack();
        }
    };
    
    const renderPageContent = () => {
        switch (pageState) {
            case 'MENU_CREATOR':
                return selectedEvent && client && <MenuCreator initialEvent={selectedEvent} client={client} onSave={handleSaveMenu} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} />;
            case 'LIVE_COUNTER_SELECTOR':
                return selectedEvent && <LiveCounterSelectorPage event={selectedEvent} onSave={handleSaveLiveCounters} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} canModify={canModify} />;
            case 'FINANCE':
                return selectedEvent && permissions && <FinanceManager 
                    event={selectedEvent} 
                    onSave={handleSaveFinance} 
                    onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} 
                    permissionCore={permissions.financeCore}
                    permissionCharges={permissions.financeCharges}
                    permissionPayments={permissions.financePayments}
                    permissionExpenses={permissions.financeExpenses}
                />;
            case 'SERVICE_PLANNER':
                return selectedEvent && <ServicePlannerPage event={selectedEvent} onSave={handleSaveServicePlan} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} canModify={canModify}/>;
            case 'KITCHEN_PLAN':
                return selectedEvent && <KitchenPlanPage event={selectedEvent} onCancel={handleBackFromKitchenPlan}/>
            case 'LIST':
            default:
                return (
                    <div>
                         <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400">Events</h3>
                            {canModify && 
                                <button onClick={() => { setSelectedEvent(null); setIsEventModalOpen(true); }} className={primaryButton}>
                                    <Plus size={16} /> <span className="hidden sm:inline">Add Event</span>
                                </button>
                            }
                        </div>
                        {clientEvents.length > 0 ? (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {clientEvents.map(event => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        onEdit={() => { setSelectedEvent(event); setIsEventModalOpen(true); }}
                                        onDelete={() => handleDeleteEvent(event)}
                                        onDuplicate={() => handleDuplicateEvent(event)}
                                        onNavigate={(state) => {
                                            setSelectedEvent(event);
                                            setPageState(state);
                                        }}
                                        canModify={canModify}
                                        canAccessFinances={canAccessFinances}
                                        onStateChange={handleStateChange}
                                        onRequestCancel={handleRequestCancel}
                                    />
                                ))}
                            </div>
                        ) : (
                             <div className="text-center py-16">
                                <p className="text-warm-gray-500">This client has no events yet.</p>
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div>
            {isEventModalOpen && (
                <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title={selectedEvent ? 'Edit Event' : 'Add Event'}>
                    <EventForm 
                        onSave={handleSaveEvent} 
                        onCancel={() => setIsEventModalOpen(false)} 
                        event={selectedEvent} 
                        clientId={client.id}
                        isReadOnly={selectedEvent?.state === 'lost' || selectedEvent?.state === 'cancelled'}
                    />
                </Modal>
            )}
             {isCancelModalOpen && (
                <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Event">
                    <div>
                        <p className="text-sm mb-4">Please provide a reason for cancelling the event: "{selectedEvent?.eventType}".</p>
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
            {isClientModalOpen && (
                 <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Edit Client Details">
                    <ClientForm onSave={(c) => handleSaveClient(c as Client)} onCancel={() => setIsClientModalOpen(false)} client={client} />
                </Modal>
            )}
            <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">{client.name}</h2>
                        <p className="text-warm-gray-500">{client.phone}</p>
                        {client.hasSystemAccess && (
                            <button onClick={copyClientLink} className="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-2">
                                {isCopied ? <Check size={16} className="text-green-500"/> : <UserCheck size={16}/>}
                                {isCopied ? 'Link Copied!' : 'Copy Client Access Link'}
                            </button>
                        )}
                    </div>
                    {canModify && (
                        <div className="flex-shrink-0 flex items-center gap-2">
                            <button onClick={() => setIsClientModalOpen(true)} className={secondaryButton}>Edit Client</button>
                            <button onClick={handleDeleteClient} className={dangerButton}>Delete Client</button>
                        </div>
                    )}
                </div>
            </div>

            {renderPageContent()}
        </div>
    );
};