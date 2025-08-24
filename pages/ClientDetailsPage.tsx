import React, { useState, useMemo, useEffect } from 'react';
import { useEvents, useClients, useClientTasks, useUsers, useCompetitionSettings, useLostReasonSettings, useClientActivities, useClientActivityTypeSettings } from '../../contexts/AppContexts';
import { useUserPermissions, useAuth } from '../../contexts/AuthContext';
import { Event, Client, EventState, StateChangeHistoryEntry, ClientTask, User, FinancialHistoryEntry, Transaction, Charge, ClientActivity } from '../../types';
import MenuCreator from '../features/menu-creator/MenuCreator';
import { Plus, Edit, Trash2, Copy, Save, UserCheck, Check, Building, Phone, Mail, Map as MapIcon, Briefcase, ListChecks, Calendar, DollarSign, Clock, CheckCircle2, MessageSquare, Send, HelpCircle, ArrowLeft, MoreVertical, FilePenLine } from 'lucide-react';
import * as icons from 'lucide-react';
import Modal from '../../components/Modal';
import { EventCard } from '../../components/EventCard';
import { primaryButton, dangerButton, secondaryButton, inputStyle, iconButton } from '../../components/common/styles';
import { ClientForm } from '../../components/forms/ClientForm';
import { EventForm } from '../../components/forms/EventForm';
import { FinanceManager } from '../features/finance/FinanceManager';
import { ServicePlannerPage } from '../features/service-planning/ServicePlannerPage';
import { KitchenPlanPage } from '../features/kitchen-plan/KitchenPlanPage';
import { yyyyMMDDToDate, dateToYYYYMMDD, formatYYYYMMDD } from '../../lib/utils';

const LucideIcon = ({ name, ...props }: { name: string;[key: string]: any }) => {
    const IconComponent = (icons as any)[name];
    if (!IconComponent) {
        return <HelpCircle {...props} />; // fallback icon
    }
    return <IconComponent {...props} />;
};


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

type PageState = 'LIST' | 'MENU_CREATOR' | 'FINANCE' | 'SERVICE_PLANNER' | 'KITCHEN_PLAN';

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
    onRequestLost: (event: Event) => void;
}> = ({ clientEvents, canModify, canAccessFinances, onAddEvent, onEditEvent, onDeleteEvent, onDuplicateEvent, onNavigate, onStateChange, onRequestCancel, onRequestLost }) => {
    const { currentUser } = useAuth();
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            onRequestLost={onRequestLost}
                            userRole={currentUser?.role}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const TasksTab: React.FC<{ client: Client }> = ({ client }) => {
    const { tasks, addTask, updateTask, deleteTask } = useClientTasks();
    const { users } = useUsers();
    const { currentUser } = useAuth();

    // Modal for editing
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<ClientTask | null>(null);
    
    // State for the inline "Add Task" form
    const [newTitle, setNewTitle] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [newAssignedToUserId, setNewAssignedToUserId] = useState('');
    
    const staffAndAdmins = useMemo(() =>
        users.filter(u => u.role === 'staff' || u.role === 'admin').sort((a, b) => a.username.localeCompare(b.username)),
    [users]);

    useEffect(() => {
        // Default assignment to current user for new tasks
        if (currentUser && !newAssignedToUserId) {
            setNewAssignedToUserId(currentUser.id);
        }
    }, [currentUser, newAssignedToUserId]);

    const clientTasks = useMemo(() =>
        tasks.filter(t => t.clientId === client.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [tasks, client.id]);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !currentUser) return;
        
        const selectedUser = users.find(u => u.id === newAssignedToUserId);
        
        const taskData: Omit<ClientTask, 'id'> = {
            clientId: client.id,
            title: newTitle.trim(),
            dueDate: newDueDate || undefined,
            assignedToUserId: newAssignedToUserId || undefined,
            assignedToUsername: selectedUser?.username || undefined,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
        };
        
        try {
            await addTask(taskData);
            // Reset form
            setNewTitle('');
            setNewDueDate('');
            setNewAssignedToUserId(currentUser?.id || '');
        } catch (error) {
            console.error(error);
            alert(`Failed to add task: ${error}`);
        }
    };
    
    const handleSaveEditedTask = async (taskData: ClientTask) => {
        try {
            await updateTask(taskData);
            setIsEditModalOpen(false);
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
            {isEditModalOpen && (
                <TaskFormModal
                    isOpen={isEditModalOpen}
                    onClose={() => { setIsEditModalOpen(false); setTaskToEdit(null); }}
                    onSave={handleSaveEditedTask as (taskData: Omit<ClientTask, 'id'> | ClientTask) => void}
                    taskToEdit={taskToEdit}
                    clientId={client.id}
                />
            )}
            
            <form onSubmit={handleAddTask} className="mb-6 p-4 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg space-y-3">
                <h4 className="font-bold">Add Task</h4>
                 <div className="space-y-2">
                    <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className={inputStyle} placeholder="Task Title"/>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className={inputStyle} />
                        <select value={newAssignedToUserId} onChange={e => setNewAssignedToUserId(e.target.value)} className={inputStyle}>
                            <option value="">-- Unassigned --</option>
                            {staffAndAdmins.map(user => <option key={user.id} value={user.id}>{user.username}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end">
                    <button type="submit" className={primaryButton}>Add Task</button>
                </div>
            </form>

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
                                <div className="flex-shrink-0">
                                    <button onClick={() => { setTaskToEdit(task); setIsEditModalOpen(true); }} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                                    <button onClick={() => handleDeleteTask(task.id)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

const ActivitiesTab: React.FC<{ client: Client }> = ({ client }) => {
    const { activities, addActivity } = useClientActivities();
    const { settings: activityTypes } = useClientActivityTypeSettings();
    const { currentUser } = useAuth();
    const [details, setDetails] = useState('');
    const [typeId, setTypeId] = useState('');

    useEffect(() => {
        if (activityTypes.length > 0 && !typeId) {
            setTypeId(activityTypes[0].id);
        }
    }, [activityTypes, typeId]);

    const clientActivities = useMemo(() =>
        activities.filter(a => a.clientId === client.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [activities, client.id]);

    const handleAddActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!details.trim() || !typeId || !currentUser) return;
        const typeName = activityTypes.find(t => t.id === typeId)?.name || 'Note';
        await addActivity({
            clientId: client.id,
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
            typeId,
            typeName,
            details: details.trim(),
        });
        setDetails('');
    };

    return (
        <div>
            <form onSubmit={handleAddActivity} className="mb-6 p-4 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg space-y-3">
                <h4 className="font-bold">Add Activity / Note</h4>
                <textarea value={details} onChange={e => setDetails(e.target.value)} required rows={3} className={inputStyle} placeholder="Record a phone call, meeting notes, etc..."></textarea>
                <div className="flex items-center justify-between">
                    <select value={typeId} onChange={e => setTypeId(e.target.value)} className={inputStyle + " w-auto"}>
                        {activityTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>
                    <button type="submit" className={primaryButton}>Add Activity</button>
                </div>
            </form>

            <div className="space-y-4">
                {clientActivities.length === 0 ? <p className="text-center text-warm-gray-500 py-8">No activities recorded for this client.</p> :
                    clientActivities.map(activity => (
                        <div key={activity.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                <span className="p-2 bg-primary-100 rounded-full dark:bg-primary-900/50">
                                    <LucideIcon name={activityTypes.find(t => t.id === activity.typeId)?.icon || 'MessageSquare'} size={20} className="text-primary-600 dark:text-primary-300"/>
                                </span>
                                <div className="flex-grow w-px bg-warm-gray-200 dark:bg-warm-gray-700"></div>
                            </div>
                            <div className="pb-4 flex-grow">
                                <p className="font-semibold">{activity.typeName} <span className="text-xs font-normal text-warm-gray-500">- by {activity.username} on {new Date(activity.timestamp).toLocaleDateString()}</span></p>
                                <p className="text-sm whitespace-pre-wrap">{activity.details}</p>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

const HistoryTab: React.FC<{ client: Client }> = ({ client }) => {
    const sortedHistory = useMemo(() =>
        (client.history || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [client.history]);

    if (!sortedHistory.length) {
        return <p className="text-center text-warm-gray-500 py-8">No client history recorded.</p>;
    }

    return (
        <div className="space-y-4">
            {sortedHistory.map((entry, index) => (
                <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                        <span className="p-2 bg-blue-100 rounded-full dark:bg-blue-900/50">
                            <FilePenLine size={20} className="text-blue-600 dark:text-blue-300"/>
                        </span>
                        {index < sortedHistory.length - 1 && <div className="flex-grow w-px bg-warm-gray-200 dark:bg-warm-gray-700"></div>}
                    </div>
                    <div className="pb-4 flex-grow">
                        <p className="font-semibold">{entry.action === 'created' ? 'Client Created' : 'Client Details Updated'}
                            <span className="text-xs font-normal text-warm-gray-500"> - by {entry.username} on {new Date(entry.timestamp).toLocaleString()}</span>
                        </p>
                        <p className="text-sm italic text-warm-gray-600 dark:text-warm-gray-400">Reason: {entry.reason}</p>
                        {entry.changes && entry.changes.length > 0 && (
                            <div className="mt-2 text-xs p-2 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-md">
                                <p className="font-semibold">Changes:</p>
                                <ul className="list-disc pl-5">
                                    {entry.changes.map((change, cIndex) => (
                                        <li key={cIndex}>
                                            <strong>{change.field}:</strong> "{change.from || 'empty'}" → "{change.to || 'empty'}"
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
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
    const [activeTab, setActiveTab] = useState<'events' | 'tasks' | 'activities' | 'history'>('events');

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
    
    const handleNavigateToPage = (event: Event, state: PageState) => {
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

    const handleFinanceSave = async (updatedEvent: Event) => {
        // By setting the local state *before* awaiting the database update,
        // we ensure the UI updates immediately and stays on the finance page.
        // This prevents a potential race condition where a top-down re-render
        // from the database snapshot listener could occur before the local state is updated.
        setSelectedEvent(updatedEvent);
        await updateEvent(updatedEvent);
    };

    if (pageState !== 'LIST' && selectedEvent && client) {
        switch (pageState) {
            case 'MENU_CREATOR': return <MenuCreator initialEvent={selectedEvent} client={client} onSave={(e) => { updateEvent(e); setPageState('LIST'); }} onCancel={() => setPageState('LIST')} />;
            case 'FINANCE': return <FinanceManager 
                event={selectedEvent} 
                onSave={handleFinanceSave} 
                onCancel={() => setPageState('LIST')} 
                permissionCore={permissions?.financeCore || 'none'} 
                permissionCharges={permissions?.financeCharges || 'none'} 
                permissionPayments={permissions?.financePayments || 'none'} 
                permissionExpenses={permissions?.financeExpenses || 'none'} />;
            case 'SERVICE_PLANNER': return <ServicePlannerPage event={selectedEvent} onSave={(e) => { updateEvent(e); setPageState('LIST'); }} onCancel={() => setPageState('LIST')} canModify={permissions?.clientsAndEvents === 'modify'} />;
            case 'KITCHEN_PLAN': return <KitchenPlanPage event={selectedEvent} onCancel={() => setPageState('LIST')} />;
        }
    }

    if (!client) return <div className="text-center p-8"><p>Loading client...</p></div>;

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
                                    <Copy size={14}/> Copy Credentials
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
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
                    <nav className="-mb-px flex space-x-8">
                        <button onClick={() => setActiveTab('events')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'events' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>Events</button>
                        <button onClick={() => setActiveTab('tasks')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'tasks' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>Tasks</button>
                        <button onClick={() => setActiveTab('activities')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'activities' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>Activities</button>
                        <button onClick={() => setActiveTab('history')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'history' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>History</button>
                    </nav>
                </div>
            )}
            
            <div>
                {activeTab === 'events' && <EventsTab clientEvents={clientEvents} canModify={canModify} canAccessFinances={canAccessFinances} onAddEvent={() => { setEventToEdit(null); setIsEventModalOpen(true); }} onEditEvent={(e) => { setEventToEdit(e); setIsEventModalOpen(true); }} onDeleteEvent={handleDeleteEvent} onDuplicateEvent={handleDuplicateEvent} onNavigate={handleNavigateToPage} onStateChange={handleStateChange} onRequestCancel={handleRequestCancel} onRequestLost={handleRequestLost} />}
                {activeTab === 'tasks' && <TasksTab client={client} />}
                {activeTab === 'activities' && <ActivitiesTab client={client} />}
                {activeTab === 'history' && <HistoryTab client={client} />}
            </div>
        </div>
    );
};