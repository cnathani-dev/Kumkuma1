import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Recipe, RecipeRawMaterial, RawMaterial, RecipeConversion } from '../types';
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
    const { settings: units } = useUnits();
    
    const [tempAddedRawMaterials, setTempAddedRawMaterials] = useState<RawMaterial[]>([]);

    const availableRawMaterials = useMemo(() => {
        const combined = [...allRawMaterials, ...tempAddedRawMaterials];
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        return unique.sort((a, b) => a.name.localeCompare(b.name));
    }, [allRawMaterials, tempAddedRawMaterials]);

    const rawMaterialsMap = useMemo(() => new Map(availableRawMaterials.map(i => [i.id, i])), [availableRawMaterials]);

    // Form state
    const [name, setName] = useState('');
    const [instructions, setInstructions] = useState('');
    const [yieldQuantity, setYieldQuantity] = useState(0);
    const [yieldUnit, setYieldUnit] = useState('');
    const [conversions, setConversions] = useState<(RecipeConversion & { tempId: string })[]>([]);
    const [recipeRawMaterials, setRecipeRawMaterials] = useState<(RecipeRawMaterial & { tempId: string })[]>([]);
    const [defaultOrderingUnit, setDefaultOrderingUnit] = useState('');

    const [isNewRawMaterialModalOpen, setIsNewRawMaterialModalOpen] = useState(false);
    const [newRawMaterialTargetIndex, setNewRawMaterialTargetIndex] = useState<number | null>(null);

    // State for dirty checking
    const [initialState, setInitialState] = useState<string | null>(null);
    
    useEffect(() => {
        const recipeToLoad = initialRecipe as any;
        let loadedState: Omit<Recipe, 'id' | 'rawMaterials' | 'conversions'> & {
            rawMaterials: (RecipeRawMaterial & { tempId: string })[];
            conversions: (RecipeConversion & { tempId: string })[];
        };

        if (!recipeToLoad || !initialRecipe?.id) {
            const unitName = units.length > 0 ? units[0].name : '';
            loadedState = {
                name: '', instructions: '', yieldQuantity: 0, yieldUnit: unitName,
                conversions: [], rawMaterials: [], defaultOrderingUnit: unitName
            };
        } else if (recipeToLoad.yieldQuantity !== undefined && recipeToLoad.yieldUnit !== undefined) {
            // New format
            loadedState = {
                name: recipeToLoad.name || '',
                instructions: recipeToLoad.instructions || '',
                yieldQuantity: recipeToLoad.yieldQuantity || 0,
                yieldUnit: recipeToLoad.yieldUnit || '',
                conversions: (recipeToLoad.conversions || []).map((c: RecipeConversion) => ({ ...c, tempId: uuidv4() })),
                rawMaterials: (recipeToLoad.rawMaterials || []).map((ing: RecipeRawMaterial) => ({ ...ing, tempId: uuidv4() })),
                defaultOrderingUnit: recipeToLoad.defaultOrderingUnit || recipeToLoad.yieldUnit || ''
            };
        } else {
            // Old format, migrate
            let qty = 0;
            let unit = '';
            if (recipeToLoad.outputKg > 0) { qty = recipeToLoad.outputKg; unit = 'kg'; }
            else if (recipeToLoad.outputLitres > 0) { qty = recipeToLoad.outputLitres; unit = 'litres'; }
            else if (recipeToLoad.outputPieces > 0) { qty = recipeToLoad.outputPieces; unit = 'pieces'; }
            
            loadedState = {
                name: recipeToLoad.name || '',
                instructions: recipeToLoad.instructions || '',
                yieldQuantity: qty,
                yieldUnit: unit,
                conversions: [],
                rawMaterials: (recipeToLoad.rawMaterials || []).map((ing: RecipeRawMaterial) => ({ ...ing, tempId: uuidv4() })),
                defaultOrderingUnit: unit
            };
        }

        setName(loadedState.name);
        setInstructions(loadedState.instructions);
        setYieldQuantity(loadedState.yieldQuantity);
        setYieldUnit(loadedState.yieldUnit);
        setDefaultOrderingUnit(loadedState.defaultOrderingUnit);
        setConversions(loadedState.conversions);
        setRecipeRawMaterials(loadedState.rawMaterials);
        
        // Strip tempIds for stable comparison string
        setInitialState(JSON.stringify({
            name: loadedState.name,
            instructions: loadedState.instructions,
            yieldQuantity: loadedState.yieldQuantity,
            yieldUnit: loadedState.yieldUnit,
            conversions: loadedState.conversions.map(({ tempId, ...rest }) => rest),
            rawMaterials: loadedState.rawMaterials.map(({ tempId, ...rest }) => rest),
            defaultOrderingUnit: loadedState.defaultOrderingUnit
        }));
    }, [initialRecipe, units]);

    const isDirty = useMemo(() => {
        if (initialState === null) return false;
        const currentState = JSON.stringify({
            name, instructions, yieldQuantity, yieldUnit,
            conversions: conversions.map(({ tempId, ...rest }) => rest),
            rawMaterials: recipeRawMaterials.map(({ tempId, ...rest }) => rest),
            defaultOrderingUnit
        });
        return currentState !== initialState;
    }, [name, instructions, yieldQuantity, yieldUnit, conversions, recipeRawMaterials, defaultOrderingUnit, initialState]);

    const handleBack = () => {
        if (isDirty) {
            if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
                onBack();
            }
        } else {
            onBack();
        }
    };


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

    const handleAddConversion = () => {
        setConversions([...conversions, { unit: '', factor: 1, tempId: uuidv4() }]);
    };
    
    const handleRemoveConversion = (tempId: string) => {
        setConversions(conversions.filter(c => c.tempId !== tempId));
    };
    
    const handleConversionChange = (tempId: string, field: 'unit' | 'factor', value: string) => {
        setConversions(conversions.map(c => 
            c.tempId === tempId
                ? { ...c, [field]: field === 'factor' ? Number(value) : value }
                : c
        ));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (yieldQuantity <= 0 || !yieldUnit) {
            alert('Recipe yield is mandatory. Please provide a quantity and select a unit.');
            return;
        }

        const finalRawMaterials = recipeRawMaterials
            .filter(ing => ing.rawMaterialId && ing.quantity > 0)
            .map(({ tempId, ...rest }) => rest);
        
        const finalConversions = conversions
            .filter(c => c.unit && c.factor > 0)
            .map(({ tempId, ...rest }) => rest);
            
        const recipeData = { name, instructions, yieldQuantity, yieldUnit, rawMaterials: finalRawMaterials, conversions: finalConversions, defaultOrderingUnit };
        if (initialRecipe?.id) {
            onSave({ id: initialRecipe.id, ...recipeData });
        } else {
            onSave(recipeData);
        }
    };
    
    const orderingUnitOptions = useMemo(() => {
        const allUnits = new Set<string>();
        if(yieldUnit) allUnits.add(yieldUnit);
        conversions.forEach(c => {
            if (c.unit) allUnits.add(c.unit);
        });
        return Array.from(allUnits).sort((a,b) => a.localeCompare(b));
    }, [yieldUnit, conversions]);

    return (
        <div>
            {isNewRawMaterialModalOpen && <NewRawMaterialModal onClose={() => setIsNewRawMaterialModalOpen(false)} onRawMaterialAdded={handleNewRawMaterialAdded} />}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                    <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                        {initialRecipe ? "Edit Recipe" : "Create New Recipe"}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={handleBack} className={secondaryButton}>
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
                                    <input type="number" placeholder="e.g., 5" value={yieldQuantity || ''} onChange={e => setYieldQuantity(Number(e.target.value))} min="0" step="any" className={inputStyle} />
                                    <select value={yieldUnit} onChange={e => setYieldUnit(e.target.value)} required className={inputStyle}>
                                        <option value="">-- Select Unit --</option>
                                        {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                    </select>
                                </div>
                            </div>
                             <div className="mt-4 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
                                <h3 className="font-bold text-lg">Unit Conversions</h3>
                                <p className="text-sm text-warm-gray-500 mb-2">Define conversions from other units to your base yield unit.</p>
                                <div className="space-y-2">
                                    {conversions.map((conv) => (
                                        <div key={conv.tempId} className="flex items-center gap-2 text-sm p-2 bg-warm-gray-50 dark:bg-warm-gray-900/40 rounded-md">
                                            <span className="font-mono whitespace-nowrap">1</span>
                                            <select value={conv.unit} onChange={e => handleConversionChange(conv.tempId, 'unit', e.target.value)} className={inputStyle + " flex-grow py-1"}>
                                                <option value="">-- Select Unit --</option>
                                                {units
                                                    .filter(u => {
                                                        if (u.name === yieldUnit) return false; // Can't convert to itself
                                                        if (u.name === conv.unit) return true; // Always show the selected unit
                                                        const isUsedElsewhere = conversions.some(c => c.tempId !== conv.tempId && c.unit === u.name);
                                                        return !isUsedElsewhere;
                                                    })
                                                    .map(u => <option key={u.id} value={u.name}>{u.name}</option>)
                                                }
                                            </select>
                                            <span className="font-mono">=</span>
                                            <input type="number" value={conv.factor} onChange={e => handleConversionChange(conv.tempId, 'factor', e.target.value)} min="0" step="any" className={inputStyle + " w-24 py-1"} />
                                            <span className="font-mono">{yieldUnit || '?'}</span>
                                            <button type="button" onClick={() => handleRemoveConversion(conv.tempId)} className="text-accent-500 p-1 rounded-full hover:bg-accent-100"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={handleAddConversion} disabled={!yieldUnit} className={`${secondaryButton} mt-2`}>
                                    <Plus size={16}/> Add Conversion
                                </button>
                            </div>
                            <div className="mt-4 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
                                <h3 className="font-bold text-lg">Ordering</h3>
                                <p className="text-sm text-warm-gray-500 mb-2">Select the default unit to be used when adding this recipe to a production order.</p>
                                <div>
                                    <label className="block text-sm font-medium">Default Ordering Unit</label>
                                    <select value={defaultOrderingUnit} onChange={e => setDefaultOrderingUnit(e.target.value)} required className={inputStyle}>
                                        {orderingUnitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
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