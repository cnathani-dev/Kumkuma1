
import React, { useState, useMemo, useEffect } from 'react';
import { Client, ClientTask } from '../../../types';
import { useClientTasks, useUsers } from '../../../contexts/AppContexts';
import { useAuth } from '../../../contexts/AuthContext';
import { primaryButton, inputStyle, iconButton } from '../../../components/common/styles';
import { dateToYYYYMMDD, formatYYYYMMDD } from '../../../lib/utils';
import { Edit, Trash2 } from 'lucide-react';
import { TaskFormModal } from '../../tasks/components/TaskFormModal';

export const TasksTab: React.FC<{ client: Client }> = ({ client }) => {
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
