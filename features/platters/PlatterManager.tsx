
import React from 'react';
import { Platter } from '../../types';
import { usePlatters } from '../../contexts/AppContexts';
import { iconButton, primaryButton } from '../../components/common/styles';
import { Plus, Edit, Trash2 } from 'lucide-react';

export const PlatterManager: React.FC<{ onAdd: () => void, onEdit: (platter: Platter) => void, onDelete: (id: string) => void }> = ({ onAdd, onEdit, onDelete }) => {
    const { platters } = usePlatters();
    return (
        <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex justify-end items-center mb-4">
                <button onClick={onAdd} className={primaryButton}><Plus size={16}/> Add Platter</button>
            </div>
            <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {platters.sort((a,b) => a.name.localeCompare(b.name)).map(platter => (
                    <li key={platter.id} className="py-2 flex justify-between items-center">
                        <span>{platter.name}</span>
                        <div className="flex gap-1">
                            <button onClick={() => onEdit(platter)} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                            <button onClick={() => onDelete(platter.id)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};
