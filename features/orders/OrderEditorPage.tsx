import React, { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Order, Recipe, RawMaterial, Platter } from '../../types';
import { useRecipes, useRawMaterials, useRestaurants, useOrderTemplates, usePlatters } from '../../contexts/AppContexts';
import { primaryButton, secondaryButton, inputStyle, iconButton } from '../../components/common/styles';
import { Save, ArrowLeft, Plus, Trash2, AlertTriangle, Box } from 'lucide-react';
import { dateToYYYYMMDD } from '../../lib/utils';

interface OrderEditorPageProps {
    order: Order | null;
    onSave: (order: Omit<Order, 'id'> | Order) => void;
    onBack: () => void;
}

const ItemSearchInput = ({
    recipes,
    platters,
    onSelect,
}: {
    recipes: Recipe[];
    platters: Platter[];
    onSelect: (type: 'recipe' | 'platter', id: string) => void;
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const { filteredRecipes, filteredPlatters } = useMemo(() => {
        if (!searchTerm) return { filteredRecipes: [], filteredPlatters: [] };
        const lowerSearch = searchTerm.toLowerCase();
        return {
            filteredRecipes: recipes.filter(r => r.name.toLowerCase().includes(lowerSearch)),
            filteredPlatters: platters.filter(p => p.name.toLowerCase().includes(lowerSearch)),
        };
    }, [searchTerm, recipes, platters]);

    const handleSelect = (type: 'recipe' | 'platter', id: string) => {
        onSelect(type, id);
        setSearchTerm('');
        setIsOpen(false);
    };

    return (
        <div className="relative flex-grow" ref={wrapperRef}>
            <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
                className={inputStyle}
                placeholder="Search to add recipes or platters..."
            />
            {isOpen && (filteredRecipes.length > 0 || filteredPlatters.length > 0) && (
                <ul className="absolute z-50 w-full bg-white dark:bg-warm-gray-700 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                    {filteredPlatters.length > 0 && (
                        <>
                            <li className="px-3 py-1 font-bold text-sm text-warm-gray-500 bg-warm-gray-50 dark:bg-warm-gray-800">Platters</li>
                            {filteredPlatters.map(platter => (
                                <li
                                    key={`platter-${platter.id}`}
                                    onClick={() => handleSelect('platter', platter.id)}
                                    className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30"
                                >
                                    {platter.name}
                                </li>
                            ))}
                        </>
                    )}
                     {filteredRecipes.length > 0 && (
                        <>
                            <li className="px-3 py-1 font-bold text-sm text-warm-gray-500 bg-warm-gray-50 dark:bg-warm-gray-800">Recipes</li>
                             {filteredRecipes.map(recipe => (
                                <li
                                    key={`recipe-${recipe.id}`}
                                    onClick={() => handleSelect('recipe', recipe.id)}
                                    className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30"
                                >
                                    {recipe.name}
                                </li>
                            ))}
                        </>
                    )}
                </ul>
            )}
        </div>
    );
};

interface CalculatedRawMaterial {
    id: string;
    name: string;
    total: number;
    unit: string;
}

export const OrderEditorPage: React.FC<OrderEditorPageProps> = ({ order, onSave, onBack }) => {
    const { recipes: allRecipes } = useRecipes();
    const { rawMaterials: allRawMaterials } = useRawMaterials();
    const { restaurants } = useRestaurants();
    const { orderTemplates, addOrderTemplate } = useOrderTemplates();
    const { platters } = usePlatters();

    const recipeMap = useMemo(() => new Map(allRecipes.map(r => [r.id, r])), [allRecipes]);
    const platterMap = useMemo(() => new Map(platters.map(p => [p.id, p])), [platters]);
    const rawMaterialMap = useMemo(() => new Map(allRawMaterials.map(i => [i.id, i])), [allRawMaterials]);
    const sortedRestaurants = useMemo(() => restaurants.slice().sort((a,b) => a.name.localeCompare(b.name)), [restaurants]);
    
    const [date, setDate] = useState(order?.date || dateToYYYYMMDD(new Date()));
    const [session, setSession] = useState(order?.session || 'lunch');

    const [orderItems, setOrderItems] = useState<{ type: 'recipe' | 'platter', id: string }[]>(() => {
        const items: { type: 'recipe' | 'platter', id: string }[] = [];
        if (order?.recipeRequirements) {
            Object.keys(order.recipeRequirements).forEach(id => items.push({ type: 'recipe', id }));
        }
        if (order?.platterRequirements) {
             // Handle old and new schema. Old is Record<string, number>
            if (typeof Object.values(order.platterRequirements)[0] === 'number') {
                // This is the old format, just add the platters to the list
                Object.keys(order.platterRequirements).forEach(id => items.push({ type: 'platter', id }));
            } else {
                Object.keys(order.platterRequirements).forEach(id => items.push({ type: 'platter', id }));
            }
        }
        return items;
    });

    const [itemRequirements, setItemRequirements] = useState<Record<string, Record<string, number>>>(() => {
        let combinedReqs: Record<string, Record<string, number>> = { ...(order?.recipeRequirements || {}) };
        if (order?.platterRequirements) {
            // Handle old schema: Record<string, number> where number is total qty.
            // We can't know the breakdown, so we'll put it all in the first restaurant.
            const firstRestaurantId = sortedRestaurants[0]?.id;
            if (firstRestaurantId && typeof Object.values(order.platterRequirements)[0] === 'number') {
                for (const platterId in order.platterRequirements) {
                    combinedReqs[platterId] = { [firstRestaurantId]: (order.platterRequirements as any)[platterId] };
                }
            } else { // New schema
                 combinedReqs = { ...combinedReqs, ...(order.platterRequirements as any) };
            }
        }
        return combinedReqs;
    });
    
    const recipeTotals = useMemo(() => {
        const totals = new Map<string, number>();
        
        orderItems.forEach(item => {
            const requirements = itemRequirements[item.id] || {};
            const totalItemQty = Object.values(requirements).reduce((sum, qty) => sum + qty, 0);
            if (totalItemQty <= 0) return;

            if (item.type === 'recipe') {
                const currentTotal = totals.get(item.id) || 0;
                totals.set(item.id, currentTotal + totalItemQty);
            } else if (item.type === 'platter') {
                const platter = platterMap.get(item.id);
                if (!platter) return;

                platter.recipes.forEach(pRecipe => {
                    const recipe = recipeMap.get(pRecipe.recipeId);
                    if (!recipe) return;

                    const totalMlNeeded = pRecipe.quantityMl * totalItemQty;
                    const totalLitresNeeded = totalMlNeeded / 1000;

                    const baseOutputLitres = recipe.outputLitres > 0 ? recipe.outputLitres : recipe.outputKg;
                    const recipeOutputKg = recipe.outputKg > 0 ? recipe.outputKg : recipe.outputLitres;

                    if (baseOutputLitres > 0) {
                        const totalKgFromPlatter = (totalLitresNeeded / baseOutputLitres) * recipeOutputKg;
                        const currentTotal = totals.get(pRecipe.recipeId) || 0;
                        totals.set(pRecipe.recipeId, currentTotal + totalKgFromPlatter);
                    }
                });
            }
        });

        return totals;
    }, [orderItems, itemRequirements, platterMap, recipeMap]);

    const calculatedRawMaterials = useMemo((): CalculatedRawMaterial[] => {
        const totals = new Map<string, number>();
        
        recipeTotals.forEach((totalQty, recipeId) => {
            const recipe = recipeMap.get(recipeId);
            if (!recipe || !recipe.outputKg || recipe.outputKg <= 0) return;

            const ratio = totalQty / recipe.outputKg;

            (recipe.rawMaterials || []).forEach(ing => {
                const currentTotal = totals.get(ing.rawMaterialId) || 0;
                totals.set(ing.rawMaterialId, currentTotal + (ing.quantity * ratio));
            });
        });
        
        return Array.from(totals.entries())
            .map(([id, total]) => ({
                id,
                name: rawMaterialMap.get(id)?.name || 'Unknown',
                unit: rawMaterialMap.get(id)?.unit || '',
                total,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [recipeTotals, recipeMap, rawMaterialMap]);

    const handleRequirementChange = (itemId: string, restaurantId: string, value: string) => {
        const qty = Number(value);
        setItemRequirements(prev => {
            const newReqs = { ...prev };
            if (!newReqs[itemId]) newReqs[itemId] = {};
            newReqs[itemId][restaurantId] = qty >= 0 ? qty : 0;
            return newReqs;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const finalRecipeRequirements: Record<string, Record<string, number>> = {};
        const finalPlatterRequirements: Record<string, Record<string, number>> = {};

        orderItems.forEach(item => {
            const requirements = itemRequirements[item.id];
            if (!requirements) return;
            
            const finalRestaurantReqs: Record<string, number> = {};
            for (const restaurantId in requirements) {
                if (requirements[restaurantId] > 0) {
                    finalRestaurantReqs[restaurantId] = requirements[restaurantId];
                }
            }
            if (Object.keys(finalRestaurantReqs).length > 0) {
                 if (item.type === 'recipe') {
                    finalRecipeRequirements[item.id] = finalRestaurantReqs;
                } else {
                    finalPlatterRequirements[item.id] = finalRestaurantReqs;
                }
            }
        });
        
        const orderData: Omit<Order, 'id'> = { date, session, recipeRequirements: finalRecipeRequirements, platterRequirements: finalPlatterRequirements };
        
        if (order) {
            onSave({ ...order, ...orderData });
        } else {
            onSave(orderData);
        }
    };
    
    const handleTemplateSelect = (templateId: string) => {
        if (!templateId) {
            setOrderItems(prev => prev.filter(item => item.type !== 'recipe'));
            return;
        }
        const template = orderTemplates.find(t => t.id === templateId);
        if (template) {
            const newRecipeItems = template.recipeIds.map(id => ({ type: 'recipe', id } as const));
            // Keep existing platters, but replace recipes
            setOrderItems(prev => [...prev.filter(item => item.type === 'platter'), ...newRecipeItems]);
        }
    };

    const handleItemSelect = (type: 'recipe' | 'platter', id: string) => {
         if (id && !orderItems.some(item => item.id === id)) {
            setOrderItems(prev => [...prev, { type, id }]);
        }
    };

    const handleRemoveItem = (itemId: string) => {
        setOrderItems(prev => prev.filter(item => item.id !== itemId));
        setItemRequirements(prev => {
            const newReqs = {...prev};
            delete newReqs[itemId];
            return newReqs;
        });
    };

    const handleSaveAsTemplate = async () => {
        const recipeIds = orderItems.filter(item => item.type === 'recipe').map(item => item.id);
        if (recipeIds.length === 0) {
            alert("Please add at least one recipe to save as a template.");
            return;
        }
        const templateName = window.prompt("Enter a name for the new order template:");
        if (templateName && templateName.trim()) {
            try {
                await addOrderTemplate({
                    name: templateName.trim(),
                    recipeIds: recipeIds
                });
                alert(`Template "${templateName.trim()}" saved successfully!`);
            } catch (e) {
                console.error("Failed to save template", e);
                alert("An error occurred while saving the template.");
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                <h2 className="text-3xl font-display font-bold">{order ? 'Edit Order' : 'Create New Order'}</h2>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className={secondaryButton}><ArrowLeft size={16}/> Back</button>
                    <button type="submit" className={primaryButton}><Save size={18}/> Save Order</button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                    <h3 className="font-bold mb-2">Production Raw Materials Summary</h3>
                    <div className="overflow-auto max-h-[calc(100vh-20rem)]">
                         <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-warm-gray-100 dark:bg-warm-gray-700">
                                <tr>
                                    <th className="p-2 text-left font-semibold">Raw Material</th>
                                    <th className="p-2 text-right font-semibold">Total Required</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-warm-gray-200 dark:divide-warm-gray-600">
                                {calculatedRawMaterials.map(ing => (
                                    <tr key={ing.id}>
                                        <td className="p-2 font-semibold">{ing.name}</td>
                                        <td className="p-2 text-right">{ing.total.toFixed(2)} {ing.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                         {calculatedRawMaterials.length === 0 && <p className="text-center text-warm-gray-500 py-8">Enter requirements to see production totals.</p>}
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md lg:col-span-3">
                     <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium">Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={inputStyle} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Session</label>
                            <select value={session} onChange={e => setSession(e.target.value as any)} className={inputStyle}>
                                <option value="breakfast">Breakfast</option>
                                <option value="lunch">Lunch</option>
                                <option value="dinner">Dinner</option>
                                <option value="all-day">All-Day</option>
                            </select>
                        </div>
                    </div>
                     <div className="mb-4">
                        <label className="block text-sm font-medium">Start from Template (Optional)</label>
                        <select
                            onChange={e => handleTemplateSelect(e.target.value)}
                            className={inputStyle}
                        >
                            <option value="">-- Select a recipe template --</option>
                            {orderTemplates.sort((a,b) => a.name.localeCompare(b.name)).map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="overflow-auto max-h-[calc(100vh-28rem)]">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-warm-gray-100 dark:bg-warm-gray-700">
                                <tr>
                                    <th className="p-2 text-left font-semibold">Item</th>
                                    {sortedRestaurants.map(r => <th key={r.id} className="p-2 text-right font-semibold">{r.name}</th>)}
                                    <th className="p-2 text-right font-semibold">Total</th>
                                    <th className="p-2 text-right font-semibold"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-warm-gray-200 dark:divide-warm-gray-600">
                                {orderItems.map(item => {
                                    const details = item.type === 'recipe' ? recipeMap.get(item.id) : platterMap.get(item.id);
                                    if (!details) return null;
                                    
                                    const total = Object.values(itemRequirements[item.id] || {}).reduce((sum, q) => sum + q, 0);
                                    const unit = item.type === 'recipe' ? 'kg' : 'qty';

                                    return (
                                        <tr key={item.id}>
                                            <td className="p-2 font-semibold">
                                                {details.name}
                                                {item.type === 'platter' && <Box size={12} className="inline-block ml-2 text-blue-500" />}
                                            </td>
                                            {sortedRestaurants.map(r => (
                                                <td key={r.id} className="p-1 min-w-[80px]">
                                                    <input type="number" min="0" step={unit === 'kg' ? 'any' : '1'}
                                                        value={itemRequirements[item.id]?.[r.id] || ''}
                                                        onChange={e => handleRequirementChange(item.id, r.id, e.target.value)}
                                                        placeholder={unit}
                                                        className={inputStyle + " text-right text-sm p-1"}
                                                    />
                                                </td>
                                            ))}
                                            <td className="p-2 text-right font-bold">
                                                {total.toFixed(unit === 'kg' ? 2 : 0)} {unit}
                                            </td>
                                            <td className="p-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className={iconButton('hover:bg-accent-100')}
                                                    title={`Remove ${item.type}`}
                                                >
                                                    <Trash2 size={16} className="text-accent-500"/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                     <div className="mt-4 flex items-center gap-2">
                        <ItemSearchInput
                            recipes={allRecipes.filter(r => !orderItems.some(item => item.id === r.id))}
                            platters={platters.filter(p => !orderItems.some(item => item.id === p.id))}
                            onSelect={handleItemSelect}
                        />
                        <button type="button" onClick={handleSaveAsTemplate} className={secondaryButton}>
                            <Save size={16}/> Save as Template
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
};