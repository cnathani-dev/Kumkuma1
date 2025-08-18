import React, { useState, useMemo, useEffect } from 'react';
import { useEvents, useClients, useClientTasks, useUsers } from '../contexts/AppContexts';
import { useUserPermissions, useAuth } from '../contexts/AuthContext';
import { Event, Client, EventState, StateChangeHistoryEntry, ClientTask, User, FinancialHistoryEntry, Transaction, Charge } from '../types';
import MenuCreator from '../features/menu-creator/MenuCreator';
import { Plus, Edit, Trash2, Copy, Save, UserCheck, Check, Building, Phone, Mail, Map as MapIcon, Briefcase, ListChecks, Calendar, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import Modal from '../components/Modal';
import { EventCard } from '../components/EventCard';
import { primaryButton, dangerButton, secondaryButton, inputStyle, iconButton } from '../components/common/styles';
import { ClientForm } from '../components/forms/ClientForm';
import { EventForm } from '../components/forms/EventForm';
import { LiveCounterSelectorPage } from '../features/live-counters/LiveCounterSelectorPage';
import { FinanceManager } from '../features/finance/FinanceManager';
import { ServicePlannerPage } from '../features/service-planning/ServicePlannerPage';
import { KitchenPlanPage } from '../features/kitchen-plan/KitchenPlanPage';
import { yyyyMMDDToDate, dateToYYYYMMDD, formatYYYYMMDD } from '../lib/utils';

const TaskFormModal = ({ isOpen, onClose, onSave, taskToEdit, clientId }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (taskData: Omit<ClientTask, 'id'> | ClientTask) => void;
    taskToEdit: ClientTask | null; // null for new task
    clientId: string;
}) => {
    const [title, setTitle] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [assignedToUserId, setAssignedToUserId] = useState('');

    const { users } = useUsers();
    const { currentUser } = useAuth();

    const staffAndAdmins = useMemo(() =>
        users.filter(u => u.role === 'staff' || u.role === 'admin').sort((a, b) => a.username.localeCompare(b.username)),
    [users]);

    useEffect(() => {
        if (taskToEdit) {
            setTitle(taskToEdit.title);
            setDueDate(taskToEdit.dueDate || '');
            setAssignedToUserId(taskToEdit.assignedToUserId || '');
        } else {
            setTitle('');
            setDueDate('');
            setAssignedToUserId(currentUser?.id || ''); // Default to self
        }
    }, [taskToEdit, currentUser]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !currentUser) return;
        
        const selectedUser = users.find(u => u.id === assignedToUserId);

        const commonData = {
            clientId,
            title: title.trim(),
            dueDate: dueDate || undefined,
            assignedToUserId: assignedToUserId || undefined,
            assignedToUsername: selectedUser?.username || undefined,
        };

        if (taskToEdit) {
            onSave({
                ...taskToEdit,
                ...commonData,
            });
        } else {
            onSave({
                ...commonData,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                userId: currentUser.id,
                username: currentUser.username,
            });
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={taskToEdit ? 'Edit Task' : 'Add Task'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Task Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className={inputStyle} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Due Date</label>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputStyle} />
                </div>
                <div>
                    <label className="block text-sm font-medium">Assign To</label>
                    <select value={assignedToUserId} onChange={e => setAssignedToUserId(e.target.value)} className={inputStyle}>
                        <option value="">-- Unassigned --</option>
                        {staffAndAdmins.map(user => (
                            <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                    </select>
                </div>
                 <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
                    <button type="submit" className={primaryButton}><Save size={18}/> Save Task</button>
                </div>
            </form>
        </Modal>
    );
};

export const MyTasksModal = ({ isOpen, onClose, onNavigateToClient }: {
    isOpen: boolean;
    onClose: () => void;
    onNavigateToClient: (clientId: string) => void;
}) => {
    const { tasks, updateTask } = useClientTasks();
    const { clients } = useClients();
    const { currentUser } = useAuth();

    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    const myTasks = useMemo(() => {
        if (!currentUser) return [];
        return tasks.filter(t => t.assignedToUserId === currentUser.id);
    }, [tasks, currentUser]);

    const { overdue, upcoming, completed } = useMemo(() => {
        const today = dateToYYYYMMDD(new Date());
        const overdueTasks: ClientTask[] = [];
        const upcomingTasks: ClientTask[] = [];
        const completedTasks: ClientTask[] = [];

        myTasks.forEach(task => {
            if (task.isCompleted) {
                completedTasks.push(task);
            } else if (task.dueDate && task.dueDate < today) {
                overdueTasks.push(task);
            } else {
                upcomingTasks.push(task);
            }
        });

        // Sort them
        overdueTasks.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        upcomingTasks.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
        completedTasks.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

        return { overdue: overdueTasks, upcoming: upcomingTasks, completed: completedTasks.slice(0, 15) };
    }, [myTasks]);

    const handleToggleComplete = (task: ClientTask) => {
        updateTask({ ...task, isCompleted: !task.isCompleted, completedAt: !task.isCompleted ? new Date().toISOString() : undefined });
    };
    
    const TaskItem = ({ task }: { task: ClientTask }) => {
        const isOverdue = !task.isCompleted && task.dueDate && dateToYYYYMMDD(new Date()) > task.dueDate;
        return (
            <li className="flex items-start gap-3 p-2 rounded-md hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50">
                <input 
                    type="checkbox" 
                    checked={task.isCompleted} 
                    onChange={() => handleToggleComplete(task)}
                    className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-0.5 flex-shrink-0"
                />
                <div className={`flex-grow ${task.isCompleted ? 'line-through text-warm-gray-400' : ''}`}>
                    <p className="font-semibold">{task.title}</p>
                    <div className="text-xs text-warm-gray-400 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                        <button onClick={() => onNavigateToClient(task.clientId)} className="hover:underline text-left">
                            Client: {clientMap.get(task.clientId) || 'Unknown'}
                        </button>
                        {task.dueDate && <span className={isOverdue ? 'text-red-500 font-semibold' : ''}>Due: {formatYYYYMMDD(task.dueDate)}</span>}
                        <span>Created by: {task.username}</span>
                    </div>
                </div>
            </li>
        );
    }

    const TaskSection = ({ title, tasks, emptyText }: { title: string, tasks: ClientTask[], emptyText: string }) => (
         <div>
            <h4 className="font-bold text-lg mb-2 text-primary-600 dark:text-primary-400">{title}</h4>
            {tasks.length > 0 ? (
                <ul className="space-y-1">{tasks.map(task => <TaskItem key={task.id} task={task}/>)}</ul>
            ) : (
                <p className="text-sm text-warm-gray-500">{emptyText}</p>
            )}
        </div>
    );
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="My Tasks" size="lg">
            <div className="max-h-[70vh] overflow-y-auto space-y-6 p-1">
                <TaskSection title="Overdue" tasks={overdue} emptyText="No overdue tasks. Great job!"/>
                <TaskSection title="Upcoming" tasks={upcoming} emptyText="No upcoming tasks."/>
                <TaskSection title="Recently Completed" tasks={completed} emptyText="No tasks completed recently."/>
            </div>
        </Modal>
    );
};

interface ClientDetailsPageProps {
  clientId: string;
  onBack: () => void;
  eventIdToOpen?: string | null;
  eventToEditId?: string | null;
}

type PageState = 'LIST' | 'MENU_CREATOR' | 'LIVE_COUNTER_SELECTOR' | 'FINANCE' | 'SERVICE_PLANNER' | 'KITCHEN_PLAN';

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

const EventsTab: React.FC<{
    clientEvents: Event[];
    canModify: boolean;
    canAccessFinances: boolean;
    onAddEvent: () => void;
    onEditEvent: (e: Event) => void;
    onDeleteEvent: (e: Event) => void;
    onDuplicateEvent: (e: Event) => void;
    onNavigate: (e: Event, state: PageState) => void;
    onStateChange: (event: Event, newState: EventState) => void;
    onRequestCancel: (event: Event) => void;
}> = ({ clientEvents, canModify, canAccessFinances, onAddEvent, onEditEvent, onDeleteEvent, onDuplicateEvent, onNavigate, onStateChange, onRequestCancel }) => {
    return (
        <div>
            <div className="flex justify-end mb-4">
                {canModify && (
                    <button onClick={onAddEvent} className={primaryButton}>
                        <Plus size={16} /> Add Event
                    </button>
                )}
            </div>
            {clientEvents.length === 0 ? (
                <p className="text-center text-warm-gray-500 py-8">No events found for this client.</p>
            ) : (
                <div className="space-y-4">
                    {clientEvents.map(event => (
                        <EventCard
                            key={event.id}
                            event={event}
                            onEdit={() => onEditEvent(event)}
                            onDelete={() => onDeleteEvent(event)}
                            onDuplicate={() => onDuplicateEvent(event)}
                            onNavigate={(pageState) => onNavigate(event, pageState)}
                            canModify={canModify}
                            canAccessFinances={canAccessFinances}
                            onStateChange={onStateChange}
                            onRequestCancel={onRequestCancel}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const TasksTab: React.FC<{ client: Client }> = ({ client }) => {
    const { tasks, addTask, updateTask, deleteTask } = useClientTasks();
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<ClientTask | null>(null);

    const clientTasks = useMemo(() =>
        tasks.filter(t => t.clientId === client.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [tasks, client.id]);

    const handleSaveTask = async (taskData: Omit<ClientTask, 'id'> | ClientTask) => {
        try {
            if ('id' in taskData) {
                await updateTask(taskData);
            } else {
                await addTask(taskData);
            }
            setIsTaskModalOpen(false);
            setTaskToEdit(null);
        } catch (error) {
            console.error(error);
            alert(`Failed to save task: ${error}`);
        }
    };

    const handleToggleComplete = (task: ClientTask) => {
        updateTask({ ...task, isCompleted: !task.isCompleted, completedAt: !task.isCompleted ? new Date().toISOString() : undefined });
    };

    const handleDeleteTask = (taskId: string) => {
        if (window.confirm('Are you sure you want to delete this task?')) {
            deleteTask(taskId);
        }
    }

    return (
        <div>
            {isTaskModalOpen && (
                <TaskFormModal
                    isOpen={isTaskModalOpen}
                    onClose={() => { setIsTaskModalOpen(false); setTaskToEdit(null); }}
                    onSave={handleSaveTask}
                    taskToEdit={taskToEdit}
                    clientId={client.id}
                />
            )}
            <div className="flex justify-end mb-4">
                <button onClick={() => { setTaskToEdit(null); setIsTaskModalOpen(true); }} className={primaryButton}>
                    <Plus size={16}/> Add Task
                </button>
            </div>

            {clientTasks.length === 0 ? (
                <p className="text-center text-warm-gray-500 py-8">No tasks for this client.</p>
            ) : (
                <ul className="space-y-3">
                    {clientTasks.map(task => {
                        const isOverdue = !task.isCompleted && task.dueDate && dateToYYYYMMDD(new Date()) > task.dueDate;
                        return (
                            <li key={task.id} className="p-3 bg-white dark:bg-warm-gray-800 rounded-lg shadow-sm flex items-start gap-3">
                                <input 
                                    type="checkbox" 
                                    checked={task.isCompleted} 
                                    onChange={() => handleToggleComplete(task)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-0.5 flex-shrink-0"
                                />
                                <div className={`flex-grow ${task.isCompleted ? 'line-through text-warm-gray-400' : ''}`}>
                                    <p className="font-semibold">{task.title}</p>
                                    <div className="text-xs text-warm-gray-400 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                                        <span>Assigned to: {task.assignedToUsername || 'Unassigned'}</span>
                                        {task.dueDate && <span className={isOverdue ? 'text-red-500 font-semibold' : ''}>Due: {formatYYYYMMDD(task.dueDate)}</span>}
                                        <span>Created by: {task.username}</span>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-1">
                                    <button onClick={() => { setTaskToEdit(task); setIsTaskModalOpen(true); }} className={iconButton('hover:bg-primary-100')}>
                                        <Edit size={16} className="text-primary-600"/>
                                    </button>
                                    <button onClick={() => handleDeleteTask(task.id)} className={iconButton('hover:bg-accent-100')}>
                                        <Trash2 size={16} className="text-accent-500"/>
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

const HistoryTab: React.FC<{ client: Client, events: Event[] }> = ({ client, events }) => {
    const allHistory = useMemo(() => {
        let history: any[] = [];
        
        if (client.history) {
            history.push(...client.history.map(h => ({ ...h, type: 'client', details: `Client: ${client.name}` })));
        }

        events.forEach(event => {
            if (event.history) {
                history.push(...event.history.map(h => ({ ...h, type: 'event_finance', details: `Event: ${event.eventType}` })));
            }
            if (event.stateHistory) {
                history.push(...event.stateHistory.map(h => ({ ...h, type: 'event_state', details: `Event: ${event.eventType}` })));
            }
            if(event.charges) {
                event.charges.forEach(charge => {
                    if (charge.history) {
                        history.push(...charge.history.map(h => ({ ...h, type: 'charge', details: `Charge on ${event.eventType}: ${charge.type}` })));
                    }
                });
            }
            if(event.transactions) {
                event.transactions.forEach(tx => {
                    if(tx.history) {
                        history.push(...tx.history.map(h => ({ ...h, type: tx.type, details: `${tx.type === 'income' ? 'Payment' : 'Expense'} on ${event.eventType}` })));
                    }
                })
            }
        });

        return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [client, events]);

    const formatValue = (value: any) => {
        if (value === null || value === undefined || value === '') return 'N/A';
        return String(value);
    };

    const renderHistoryItem = (item: any, index: number) => {
        const date = new Date(item.timestamp).toLocaleString();
        
        let content;
        if (item.type === 'event_state') {
            content = `State changed from ${item.fromState || 'creation'} to ${item.toState}. ${item.reason ? `Reason: ${item.reason}` : ''}`;
        } else {
            content = `${item.action.charAt(0).toUpperCase() + item.action.slice(1)}: ${item.reason}.`;
        }

        return (
            <li key={index} className="p-3 bg-white dark:bg-warm-gray-800 rounded-lg shadow-sm">
                <p className="text-sm font-semibold">{item.details}</p>
                <p className="text-xs text-warm-gray-400">{date} by {item.username}</p>
                <p className="mt-1">{content}</p>
                {item.changes && item.changes.length > 0 && (
                    <ul className="mt-1 text-xs list-disc pl-5">
                        {item.changes.map((change: any, i: number) => (
                            <li key={i}>
                                <strong>{change.field}:</strong> changed from "{formatValue(change.from)}" to "{formatValue(change.to)}"
                            </li>
                        ))}
                    </ul>
                )}
            </li>
        );
    }

    return (
        <div>
            {allHistory.length === 0 ? (
                <p className="text-center text-warm-gray-500 py-8">No history recorded for this client or their events.</p>
            ) : (
                <ul className="space-y-3">
                    {allHistory.map(renderHistoryItem)}
                </ul>
            )}
        </div>
    );
};


export const ClientDetailsPage: React.FC<ClientDetailsPageProps> = ({ clientId, onBack, eventIdToOpen, eventToEditId }) => {
    const { clients, updateClient, deleteClient } = useClients();
    const { events, addEvent, updateEvent, deleteEvent, duplicateEvent } = useEvents();
    const { currentUser } = useAuth();
    const permissions = useUserPermissions();
    
    type ActiveTab = 'events' | 'tasks' | 'history';

    const [pageState, setPageState] = useState<PageState>('LIST');
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('events');

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
    const clientEvents = useMemo(() => events.filter(e => e.clientId === clientId).sort((a, b) => b.startDate.localeCompare(a.startDate)), [events, clientId]);

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
        if (selectedEvent) {
            const updatedEventFromGlobalState = events.find(e => e.id === selectedEvent.id);
            if (updatedEventFromGlobalState && JSON.stringify(updatedEventFromGlobalState) !== JSON.stringify(selectedEvent)) {
                setSelectedEvent(updatedEventFromGlobalState);
            }
        }
    }, [events, selectedEvent]);


    if (!client) {
        return (
            <div className="text-center p-8">
                <h2 className="text-2xl font-bold">Client not found</h2>
                <p>The client you are looking for does not exist or could not be loaded.</p>
                <button onClick={() => onBack()} className={`${secondaryButton} mt-4`}>Go Back</button>
            </div>
        );
    }
    
    // --- Event Handlers ---
    const handleStateChange = async (eventToUpdate: Event, newState: EventState, reason?: string) => {
        if (!currentUser) { alert("Authentication error. Please log in again."); return; }
        const historyEntry: StateChangeHistoryEntry = { timestamp: new Date().toISOString(), userId: currentUser.id, username: currentUser.username, fromState: eventToUpdate.state, toState: newState, reason: reason };
        const updatedEvent: Event = { ...eventToUpdate, state: newState, stateHistory: [...(eventToUpdate.stateHistory || []), historyEntry] };
        if (newState === 'lost' || newState === 'cancelled') updatedEvent.status = 'finalized';
        await updateEvent(updatedEvent);
    };

    const handleRequestCancel = (eventToCancel: Event) => {
        if (!canModify) return;
        setSelectedEvent(eventToCancel); setIsCancelModalOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (selectedEvent && cancelReason.trim() && canModify) {
            await handleStateChange(selectedEvent, 'cancelled', cancelReason);
            setIsCancelModalOpen(false); setCancelReason(''); setSelectedEvent(null);
        } else { alert('A reason is required to cancel the event.'); }
    };

    const handleSaveEvent = async (eventData: Omit<Event, 'id'> | Event) => {
        if (!currentUser) return;
        try {
            if ('id' in eventData) { // UPDATE
                const originalEvent = events.find(e => e.id === eventData.id);
                if (!originalEvent) throw new Error("Original event not found for update logging.");

                const eventFieldsToTrack = ['eventType', 'startDate', 'endDate', 'location', 'session', 'pax', 'notes'];
                const changes = generateChanges(originalEvent, eventData, eventFieldsToTrack);
                
                let updatedEvent = { ...eventData };
                if (changes.length > 0) {
                    const historyEntry: FinancialHistoryEntry = {
                        timestamp: new Date().toISOString(), userId: currentUser.id, username: currentUser.username,
                        action: 'updated', reason: 'Event details updated', changes
                    };
                    updatedEvent.history = [...(originalEvent.history || []), historyEntry];
                }
                await updateEvent(updatedEvent as Event);

            } else { // CREATE
                const historyEntry: FinancialHistoryEntry = {
                    timestamp: new Date().toISOString(), userId: currentUser.id, username: currentUser.username,
                    action: 'created', reason: 'Event Created'
                };
                const eventWithHistory = { ...eventData, history: [historyEntry] };
                await addEvent(eventWithHistory);
            }
            setIsEventModalOpen(false); setSelectedEvent(null);
        } catch (error) { console.error(error); alert(`Failed to save event: ${error}`); }
    };
    
    const handleDeleteEvent = async (event: Event) => {
        if (window.confirm(`Are you sure you want to delete the event "${event.eventType}"? This cannot be undone.`)) {
            try { await deleteEvent(event); } catch(e) { console.error(e); alert(`Failed to delete event: ${e}`); }
        }
    }

    const handleDuplicateEvent = async (event: Event) => {
        if (window.confirm(`Are you sure you want to duplicate the event "${event.eventType}"? A new lead will be created.`)) {
            try { await duplicateEvent(event); } catch(e) { console.error(e); alert(`Failed to duplicate event: ${e}`); }
        }
    };
    
    const handleSaveMenu = (updatedEvent: Event) => { updateEvent(updatedEvent); setPageState('LIST'); setSelectedEvent(null); }
    const handleSaveLiveCounters = (event: Event, updatedCounters: Record<string, string[]>) => { updateEvent({ ...event, liveCounters: updatedCounters }); setPageState('LIST'); setSelectedEvent(null); }
    const handleSaveFinance = (updatedEvent: Event) => { updateEvent(updatedEvent); }
    const handleSaveServicePlan = (updatedEvent: Event) => { updateEvent(updatedEvent); setPageState('LIST'); setSelectedEvent(null); };
    const handleBackFromKitchenPlan = () => { setPageState('LIST'); setSelectedEvent(null); };
    
    const copyClientLink = () => {
        const url = `${window.location.origin}?clientId=${client.id}`;
        navigator.clipboard.writeText(url).then(() => { setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); });
    };

    const handleSaveClient = async (clientData: Client | Omit<Client, 'id'>) => {
        if (!currentUser) return;
        try {
            const clientFieldsToTrack = ['name', 'phone', 'email', 'company', 'address', 'referredBy', 'status', 'hasSystemAccess'];
            const changes = generateChanges(client, clientData, clientFieldsToTrack);
            let clientToSave = { ...clientData };

            if (changes.length > 0) {
                const historyEntry: FinancialHistoryEntry = {
                    timestamp: new Date().toISOString(), userId: currentUser.id, username: currentUser.username,
                    action: 'updated', reason: 'Client details updated', changes
                };
                clientToSave.history = [...(client.history || []), historyEntry];
            }
            await updateClient(clientToSave as Client); 
            setIsClientModalOpen(false); 
        } catch (error) { console.error("Failed to update client:", error); alert(`Failed to update client: ${error}`); }
    };
    
    const handleDeleteClient = () => {
        if (window.confirm(`Are you sure you want to delete ${client.name}? This will also delete all associated events and their user accounts. This action CANNOT be undone.`)) {
            deleteClient(client.id); onBack();
        }
    };

    const renderPageContent = () => {
        if (pageState !== 'LIST') {
            switch (pageState) {
                case 'MENU_CREATOR': return selectedEvent && client && <MenuCreator initialEvent={selectedEvent} client={client} onSave={handleSaveMenu} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} />;
                case 'LIVE_COUNTER_SELECTOR': return selectedEvent && <LiveCounterSelectorPage event={selectedEvent} onSave={handleSaveLiveCounters} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} canModify={canModify} />;
                case 'FINANCE': return selectedEvent && permissions && <FinanceManager event={selectedEvent} onSave={handleSaveFinance} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} permissionCore={permissions.financeCore} permissionCharges={permissions.financeCharges} permissionPayments={permissions.financePayments} permissionExpenses={permissions.financeExpenses} />;
                case 'SERVICE_PLANNER': return selectedEvent && <ServicePlannerPage event={selectedEvent} onSave={handleSaveServicePlan} onCancel={() => { setPageState('LIST'); setSelectedEvent(null); }} canModify={canModify}/>;
                case 'KITCHEN_PLAN': return selectedEvent && <KitchenPlanPage event={selectedEvent} onCancel={handleBackFromKitchenPlan}/>
            }
        }
        return (
            <div>
                 <div className="border-b border-warm-gray-200 dark:border-warm-gray-700 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        {(['events', 'tasks', 'history'] as ActiveTab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors capitalize ${activeTab === tab
                                    ? 'border-primary-500 text-primary-600'
                                    : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700 hover:border-warm-gray-300'
                                }`}
                            >{tab}</button>
                        ))}
                    </nav>
                </div>
                <div>
                    {activeTab === 'events' && <EventsTab clientEvents={clientEvents} canModify={canModify} canAccessFinances={canAccessFinances} onAddEvent={() => { setSelectedEvent(null); setIsEventModalOpen(true); }} onEditEvent={(e) => { setSelectedEvent(e); setIsEventModalOpen(true); }} onDeleteEvent={handleDeleteEvent} onDuplicateEvent={handleDuplicateEvent} onNavigate={(e, state) => { setSelectedEvent(e); setPageState(state); }} onStateChange={handleStateChange} onRequestCancel={handleRequestCancel} />}
                    {activeTab === 'tasks' && <TasksTab client={client} />}
                    {activeTab === 'history' && <HistoryTab client={client} events={clientEvents} />}
                </div>
            </div>
        )
    };
    
    return (
        <div className="space-y-6">
            {isEventModalOpen && (
                <Modal isOpen={isEventModalOpen} onClose={() => { setIsEventModalOpen(false); setSelectedEvent(null); }} title={selectedEvent ? 'Edit Event' : 'Add Event'}>
                    <EventForm
                        onSave={handleSaveEvent}
                        onCancel={() => { setIsEventModalOpen(false); setSelectedEvent(null); }}
                        event={selectedEvent}
                        clientId={client.id}
                        isReadOnly={!canModify}
                    />
                </Modal>
            )}
            {isClientModalOpen && (
                <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Edit Client">
                    <ClientForm
                        onSave={handleSaveClient}
                        onCancel={() => setIsClientModalOpen(false)}
                        client={client}
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

            <div className="p-6 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                    <div>
                        <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">{client.name}</h2>
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-warm-gray-500 mt-2">
                             {client.company && <span className="flex items-center gap-1.5"><Briefcase size={14}/> {client.company}</span>}
                             <span className="flex items-center gap-1.5"><Phone size={14}/> {client.phone}</span>
                             {client.email && <span className="flex items-center gap-1.5"><Mail size={14}/> {client.email}</span>}
                             {client.address && <span className="flex items-center gap-1.5"><MapIcon size={14}/> {client.address}</span>}
                         </div>
                    </div>
                     <div className="flex items-center gap-2 flex-shrink-0">
                         {client.hasSystemAccess && (
                             <button onClick={copyClientLink} className={secondaryButton}>
                                 {isCopied ? <Check size={16}/> : <UserCheck size={16}/>}
                                 {isCopied ? 'Link Copied!' : 'Copy Client Link'}
                             </button>
                         )}
                         {canModify && <button onClick={() => setIsClientModalOpen(true)} className={secondaryButton}><Edit size={16}/> Edit Client</button>}
                         {currentUser?.role === 'admin' && <button onClick={handleDeleteClient} className={dangerButton}><Trash2 size={16}/> Delete</button>}
                    </div>
                </div>
            </div>

            {renderPageContent()}
        </div>
    );
};
