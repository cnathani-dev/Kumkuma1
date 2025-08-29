
import React, { useMemo } from 'react';
import { ClientTask } from '../../../types';
import { useClientTasks, useClients } from '../../../contexts/AppContexts';
import { useAuth } from '../../../contexts/AuthContext';
import Modal from '../../../components/Modal';
import { dateToYYYYMMDD, formatYYYYMMDD } from '../../../lib/utils';

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
