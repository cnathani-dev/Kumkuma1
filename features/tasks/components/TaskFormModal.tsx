
import React, { useState, useMemo, useEffect } from 'react';
import { ClientTask } from '../../../types';
import { useUsers } from '../../../contexts/AppContexts';
import { useAuth } from '../../../contexts/AuthContext';
import Modal from '../../../components/Modal';
import { primaryButton, secondaryButton, inputStyle } from '../../../components/common/styles';
import { Save } from 'lucide-react';

export const TaskFormModal = ({ isOpen, onClose, onSave, taskToEdit, clientId }: {
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
