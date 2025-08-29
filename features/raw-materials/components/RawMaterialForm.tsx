
import React, { useState } from 'react';
import { RawMaterial } from '../../../types';
import { useUnits } from '../../../contexts/AppContexts';
import { inputStyle, primaryButton, secondaryButton } from '../../../components/common/styles';
import { Save } from 'lucide-react';

export const RawMaterialForm = ({ onSave, onCancel, material }: { onSave: (data: Omit<RawMaterial, 'id'> | RawMaterial) => void, onCancel: () => void, material: RawMaterial | null }) => {
    const [name, setName] = useState(material?.name || '');
    const { settings: units } = useUnits();
    const [unit, setUnit] = useState(material?.unit || (units.length > 0 ? units[0].name : ''));
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (material) onSave({ id: material.id, name, unit });
        else onSave({ name, unit });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Material Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <select value={unit} onChange={e => setUnit(e.target.value)} required className={inputStyle}>
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    );
};
