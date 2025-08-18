import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Recipe, RecipeRawMaterial, RawMaterial } from '../types';
import { useRawMaterials, useUnits } from '../contexts/AppContexts';
import { primaryButton, secondaryButton, inputStyle } from '../components/common/styles';
import { Save, ArrowLeft, Plus, Trash2, Scale } from 'lucide-react';

const NewRawMaterialModal = ({ onClose, onRawMaterialAdded }: { onClose: () => void, onRawMaterialAdded: (newRawMaterial: RawMaterial) => void }) => {
    const { addRawMaterial } = useRawMaterials();
    const { settings: units } = useUnits();
    const [name, setName] = useState('');
    const [unit, setUnit] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !unit.trim()) {
            alert('Name and unit are required.');
            return;
        }
        setIsLoading(true);
        try {
            const newId = await addRawMaterial({ name, unit });
            onRawMaterialAdded({ id: newId, name, unit });
        } catch (error) {
            console.error("Failed to add raw material", error);
            alert("Could not add raw material.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-warm-gray-900 bg-opacity-75 z-[60] flex items-center justify-center" onClick={onClose}>
            <div className="bg-ivory dark:bg-warm-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-display font-bold mb-4">Add New Raw Material</h3>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Raw Material Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Standard Unit</label>
                         <select value={unit} onChange={e => setUnit(e.target.value)} required className={inputStyle}>
                            <option value="">-- Select Unit --</option>
                            {units.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                         </select>
                    </div>
                     <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
                        <button type="submit" className={primaryButton} disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Raw Material'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const RecipeEditorPage = ({ recipe: initialRecipe, onSave, onBack }: {
    recipe: Recipe | null,
    onSave: (data: Omit<Recipe, 'id'> | Recipe) => void,
    onBack: () => void
}) => {
    const { rawMaterials: allRawMaterials } = useRawMaterials();
    
    const [tempAddedRawMaterials, setTempAddedRawMaterials] = useState<RawMaterial[]>([]);

    const availableRawMaterials = useMemo(() => {
        const combined = [...allRawMaterials, ...tempAddedRawMaterials];
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        return unique.sort((a, b) => a.name.localeCompare(b.name));
    }, [allRawMaterials, tempAddedRawMaterials]);

    const rawMaterialsMap = useMemo(() => new Map(availableRawMaterials.map(i => [i.id, i])), [availableRawMaterials]);

    const [name, setName] = useState(initialRecipe?.name || '');
    const [instructions, setInstructions] = useState(initialRecipe?.instructions || '');
    const [outputKg, setOutputKg] = useState(initialRecipe?.outputKg || 0);
    const [outputLitres, setOutputLitres] = useState(initialRecipe?.outputLitres || 0);
    const [recipeRawMaterials, setRecipeRawMaterials] = useState<(RecipeRawMaterial & { tempId: string })[]>(
        (initialRecipe?.rawMaterials || []).map(ing => ({ ...ing, tempId: uuidv4() }))
    );

    const [isNewRawMaterialModalOpen, setIsNewRawMaterialModalOpen] = useState(false);
    const [newRawMaterialTargetIndex, setNewRawMaterialTargetIndex] = useState<number | null>(null);

    const handleAddRawMaterialRow = () => {
        setRecipeRawMaterials([...recipeRawMaterials, { rawMaterialId: '', quantity: 0, tempId: uuidv4() }]);
    };

    const handleRemoveRawMaterialRow = (tempId: string) => {
        setRecipeRawMaterials(recipeRawMaterials.filter(ing => ing.tempId !== tempId));
    };

    const handleRawMaterialChange = (tempId: string, field: 'rawMaterialId' | 'quantity', value: any) => {
        const index = recipeRawMaterials.findIndex(ing => ing.tempId === tempId);
        if (index === -1) return;

        if (field === 'rawMaterialId' && value === 'ADD_NEW') {
            setNewRawMaterialTargetIndex(index);
            setIsNewRawMaterialModalOpen(true);
            return;
        }

        const updatedRawMaterials = [...recipeRawMaterials];
        const newValue = field === 'quantity' ? (Number(value) < 0 ? 0 : Number(value)) : value;
        updatedRawMaterials[index] = { ...updatedRawMaterials[index], [field]: newValue };
        setRecipeRawMaterials(updatedRawMaterials);
    };
    
    const handleNewRawMaterialAdded = (newRawMaterial: RawMaterial) => {
        setTempAddedRawMaterials(prev => [...prev, newRawMaterial]);

        if (newRawMaterialTargetIndex !== null) {
            const updatedRawMaterials = [...recipeRawMaterials];
            updatedRawMaterials[newRawMaterialTargetIndex].rawMaterialId = newRawMaterial.id;
            setRecipeRawMaterials(updatedRawMaterials);
        }
        setIsNewRawMaterialModalOpen(false);
        setNewRawMaterialTargetIndex(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (outputKg <= 0 && outputLitres <= 0) {
            alert('Recipe yield is mandatory. Please provide a value greater than 0 for either Kgs or Litres.');
            return;
        }

        const finalRawMaterials = recipeRawMaterials
            .filter(ing => ing.rawMaterialId && ing.quantity > 0)
            .map(({ tempId, ...rest }) => rest);
            
        const recipeData = { name, instructions, outputKg, outputLitres, rawMaterials: finalRawMaterials };
        if (initialRecipe) {
            onSave({ ...initialRecipe, ...recipeData });
        } else {
            onSave(recipeData);
        }
    };

    return (
        <div>
            {isNewRawMaterialModalOpen && <NewRawMaterialModal onClose={() => setIsNewRawMaterialModalOpen(false)} onRawMaterialAdded={handleNewRawMaterialAdded} />}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                    <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                        {initialRecipe ? "Edit Recipe" : "Create New Recipe"}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onBack} className={secondaryButton}>
                            <ArrowLeft size={16}/> Back
                        </button>
                        <button type="submit" className={primaryButton}>
                            <Save size={18} /> Save Recipe
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="p-6 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md space-y-4">
                            <h3 className="font-bold text-lg">Recipe Details</h3>
                            <div>
                                <label className="block text-sm font-medium">Recipe Name</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Instructions</label>
                                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={5} className={inputStyle} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Base Recipe Yield</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2">
                                        <input type="number" placeholder="0.00" value={outputKg} onChange={e => setOutputKg(Number(e.target.value))} min="0" step="0.01" className={`${inputStyle} text-right flex-1`} />
                                        <span className="font-medium text-warm-gray-500">Kgs</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" placeholder="0.00" value={outputLitres} onChange={e => setOutputLitres(Number(e.target.value))} min="0" step="0.01" className={`${inputStyle} text-right flex-1`} />
                                        <span className="font-medium text-warm-gray-500">Litres</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                        <h3 className="font-bold text-lg mb-4">Base Recipe Raw Materials</h3>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {recipeRawMaterials.map((ing) => {
                                const selectedRawMaterial = rawMaterialsMap.get(ing.rawMaterialId);
                                return (
                                    <div key={ing.tempId} className="flex items-center gap-2">
                                        <select value={ing.rawMaterialId} onChange={e => handleRawMaterialChange(ing.tempId, 'rawMaterialId', e.target.value)} className={inputStyle + " flex-grow"}>
                                            <option value="">-- Select Raw Material --</option>
                                            <option value="ADD_NEW" className="font-bold text-primary-600">+ Add New Raw Material</option>
                                            {availableRawMaterials.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                        </select>
                                        <input type="number" placeholder="Qty" value={ing.quantity || ''} onChange={e => handleRawMaterialChange(ing.tempId, 'quantity', e.target.value)} className={inputStyle + " w-24"} min="0" step="any"/>
                                        <span className="w-16 text-sm text-gray-500">{selectedRawMaterial?.unit}</span>
                                        <button type="button" onClick={() => handleRemoveRawMaterialRow(ing.tempId)} className="text-accent-500 p-2 rounded-full hover:bg-accent-100"><Trash2 size={16}/></button>
                                    </div>
                                );
                            })}
                        </div>
                        <button type="button" onClick={handleAddRawMaterialRow} className={`${secondaryButton} mt-4`}>
                            <Plus size={16}/> Add Raw Material
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};
