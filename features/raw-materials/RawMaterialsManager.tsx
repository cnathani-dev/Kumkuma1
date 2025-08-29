
import React, { useMemo, useState } from 'react';
import { RawMaterial } from '../../types';
import { useRawMaterials } from '../../contexts/AppContexts';
import Modal from '../../components/Modal';
import { RawMaterialForm } from './components/RawMaterialForm';
import { iconButton, inputStyle, primaryButton } from '../../components/common/styles';
import { Plus, Edit, Trash2 } from 'lucide-react';

export const RawMaterialsManager: React.FC<{}> = () => {
    const { rawMaterials, addRawMaterial, updateRawMaterial, deleteRawMaterial } = useRawMaterials();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<RawMaterial | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleSave = async (data: Omit<RawMaterial, 'id'> | RawMaterial) => {
        if ('id' in data) await updateRawMaterial(data);
        else await addRawMaterial(data);
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => window.confirm("Are you sure?") && deleteRawMaterial(id);

    const filteredRawMaterials = useMemo(() => {
        return rawMaterials
            .filter(material => material.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rawMaterials, searchTerm]);

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            {isModalOpen && <Modal isOpen={true} onClose={() => setIsModalOpen(false)} title={editing ? "Edit Raw Material" : "Add Raw Material"}>
                <RawMaterialForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} material={editing} />
            </Modal>}
            <div className="flex justify-end items-center mb-4">
                <button onClick={() => { setEditing(null); setIsModalOpen(true); }} className={primaryButton}><Plus size={16}/> Add Material</button>
            </div>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search raw materials..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={inputStyle}
                />
            </div>
             <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {filteredRawMaterials.map(mat => (
                    <li key={mat.id} className="py-2 flex justify-between items-center">
                        <span>{mat.name} <span className="text-sm text-warm-gray-500">({mat.unit})</span></span>
                        <div className="flex gap-1">
                            <button onClick={() => { setEditing(mat); setIsModalOpen(true); }} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                            <button onClick={() => handleDelete(mat.id)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};
