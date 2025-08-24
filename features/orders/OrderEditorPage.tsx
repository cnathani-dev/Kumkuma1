import React, { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Order, Recipe, RawMaterial, Platter, RestaurantSetting, PlatterRecipe, EventSession } from '../../types';
import { useRecipes, useRawMaterials, useRestaurants, useOrderTemplates, usePlatters } from '../../contexts/AppContexts';
import { primaryButton, secondaryButton, inputStyle, iconButton } from '../../components/common/styles';
import { Save, ArrowLeft, Plus, Trash2, Box, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { dateToYYYYMMDD } from '../../lib/utils';
import { exportOrderToPdf } from '../../lib/export';

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

export const OrderEditorPage: React.FC<OrderEditorPageProps> = ({ order, onSave, onBack }) => {
    const { recipes: allRecipes } = useRecipes();
    const { rawMaterials: allRawMaterials } = useRawMaterials();
    const { restaurants } = useRestaurants();
    const { orderTemplates, addOrderTemplate } = useOrderTemplates();
    const { platters } = usePlatters();

    const recipeMap = useMemo(() => new Map(allRecipes.map(r => [r.id, r])), [allRecipes]);
    const platterMap = useMemo(() => new Map(platters.map(p => [p.id, p])), [platters]);
    const sortedRestaurants = useMemo(() => restaurants.slice().sort((a,b) => a.name.localeCompare(b.name)), [restaurants]);
    
    // Form state
    const [date, setDate] = useState('');
    const [session, setSession] = useState<EventSession>('lunch');
    const [expandedPlatters, setExpandedPlatters] = useState<Set<string>>(new Set());
    const [orderItems, setOrderItems] = useState<{ type: 'recipe' | 'platter', id: string }[]>([]);
    const [itemRequirements, setItemRequirements] = useState<Record<string, Record<string, number>>>({});
    const [adHocLocations, setAdHocLocations] = useState<{ id: string; name: string }[]>([]);
    const [newAdHocLocationName, setNewAdHocLocationName] = useState('');


    // State for dirty checking
    const [initialState, setInitialState] = useState<string | null>(null);

    useEffect(() => {
        const initialOrderItems: { type: 'recipe' | 'platter', id: string }[] = [];
        if (order?.recipeRequirements) {
            Object.keys(order.recipeRequirements).forEach(id => initialOrderItems.push({ type: 'recipe', id }));
        }
        if (order?.platterRequirements) {
             Object.keys(order.platterRequirements).forEach(id => initialOrderItems.push({ type: 'platter', id }));
        }

        const initialRequirements = { ...(order?.recipeRequirements || {}), ...(order?.platterRequirements || {}) };
        const initialDate = order?.date || dateToYYYYMMDD(new Date());
        const initialSession = order?.session || 'lunch';
        const initialAdHocLocations = order?.adHocLocations || [];

        setDate(initialDate);
        setSession(initialSession);
        setOrderItems(initialOrderItems);
        setItemRequirements(initialRequirements);
        setAdHocLocations(initialAdHocLocations);

        setInitialState(JSON.stringify({
            date: initialDate,
            session: initialSession,
            orderItems: initialOrderItems,
            itemRequirements: initialRequirements,
            adHocLocations: initialAdHocLocations,
        }));
    }, [order]);

    const isDirty = useMemo(() => {
        if (initialState === null) return false;
        const currentState = JSON.stringify({
            date,
            session,
            orderItems,
            itemRequirements,
            adHocLocations,
        });
        return currentState !== initialState;
    }, [date, session, orderItems, itemRequirements, adHocLocations, initialState]);

    const handleBack = () => {
        if (isDirty) {
            if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
                onBack();
            }
        } else {
            onBack();
        }
    };

    const handleRequirementChange = (itemId: string, restaurantId: string, value: string) => {
        // Let the input be empty, but store 0 in state.
        if (value === "") {
            setItemRequirements(prev => {
                const newReqs = { ...prev };
                if (!newReqs[itemId]) newReqs[itemId] = {};
                newReqs[itemId][restaurantId] = 0;
                return newReqs;
            });
            return;
        }
        
        // Check if the value is a valid number representation and non-negative.
        const num = Number(value);
        if (isFinite(num) && num >= 0) {
            setItemRequirements(prev => {
                const newReqs = { ...prev };
                if (!newReqs[itemId]) newReqs[itemId] = {};
                newReqs[itemId][restaurantId] = num;
                return newReqs;
            });
        }
        // If the input is not a valid number (e.g., contains letters), do nothing.
        // The input value will be controlled by React and revert to the previous valid state.
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
        
        const orderData: Omit<Order, 'id'> = { date, session, recipeRequirements: finalRecipeRequirements, platterRequirements: finalPlatterRequirements, adHocLocations };
        
        if (order?.id) {
            onSave({ ...order, ...orderData });
        } else {
            onSave(orderData);
        }
    };
    
    const handleTemplateSelect = (templateId: string) => {
        if (!templateId) {
            setOrderItems([]);
            return;
        }
        const template = orderTemplates.find(t => t.id === templateId);
        if (template) {
            const newRecipeItems = (template.recipeIds || []).map(id => ({ type: 'recipe', id } as const));
            const newPlatterItems = (template.platterIds || []).map(id => ({ type: 'platter', id } as const));
            setOrderItems([...newRecipeItems, ...newPlatterItems]);
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
        const platterIds = orderItems.filter(item => item.type === 'platter').map(item => item.id);
        if (recipeIds.length === 0 && platterIds.length === 0) {
            alert("Please add at least one recipe or platter to save as a template.");
            return;
        }
        const templateName = window.prompt("Enter a name for the new order template:");
        if (templateName && templateName.trim()) {
            try {
                await addOrderTemplate({
                    name: templateName.trim(),
                    recipeIds: recipeIds,
                    platterIds: platterIds,
                });
                alert(`Template "${templateName.trim()}" saved successfully!`);
            } catch (e) {
                console.error("Failed to save template", e);
                alert("An error occurred while saving the template.");
            }
        }
    };

    const togglePlatterExpansion = (platterId: string) => {
        setExpandedPlatters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(platterId)) {
                newSet.delete(platterId);
            } else {
                newSet.add(platterId);
            }
            return newSet;
        });
    };
    
    const handleAddAdHocLocation = () => {
        const trimmedName = newAdHocLocationName.trim();
        if (trimmedName) {
            setAdHocLocations(prev => [...prev, { id: uuidv4(), name: trimmedName }]);
            setNewAdHocLocationName('');
        }
    };

    const allDisplayLocations = useMemo(() => {
        return [
            ...sortedRestaurants,
            ...(adHocLocations || [])
        ];
    }, [sortedRestaurants, adHocLocations]);


    const handleDownloadPdf = () => {
        const currentOrderState: Order = {
            id: order?.id || 'new-order',
            date,
            session,
            recipeRequirements: Object.fromEntries(
                orderItems.filter(i => i.type === 'recipe').map(i => [i.id, itemRequirements[i.id] || {}])
            ),
            platterRequirements: Object.fromEntries(
                orderItems.filter(i => i.type === 'platter').map(i => [i.id, itemRequirements[i.id] || {}])
            ),
            adHocLocations,
        };
        exportOrderToPdf(currentOrderState, restaurants, allRecipes, allRawMaterials, platters);
    };
    
    const getConstituentRecipeQty = (platterPortions: number, pRecipe_any: any, recipeDetails: Recipe): { qty: number; unit: string } => {
        if (platterPortions <= 0) return { qty: 0, unit: '' };

        const pRecipeUnit = pRecipe_any.unit || 'ml';
        const pRecipeQty = pRecipe_any.quantity ?? pRecipe_any.quantityMl ?? 0;

        if (pRecipeQty <= 0) return { qty: 0, unit: '' };

        const totalOrderedInOrderingUnit = pRecipeQty * platterPortions;
        
        let totalOrderedInYieldUnit = 0;
        if (pRecipeUnit.toLowerCase() === recipeDetails.yieldUnit.toLowerCase()) {
            totalOrderedInYieldUnit = totalOrderedInOrderingUnit;
        } else {
            const conversion = (recipeDetails.conversions || []).find(c => c.unit.toLowerCase() === pRecipeUnit.toLowerCase());
            if (conversion && conversion.factor > 0) {
                totalOrderedInYieldUnit = totalOrderedInOrderingUnit * conversion.factor;
            } else {
                return { qty: 0, unit: 'N/A' };
            }
        }
        
        return { qty: totalOrderedInYieldUnit, unit: recipeDetails.yieldUnit };
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                <div className="flex items-center gap-4">
                    <button type="button" onClick={handleBack} className={iconButton('hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700')}><ArrowLeft size={20}/></button>
                    <h2 className="text-3xl font-display font-bold">{order ? 'Edit Order' : 'Create New Order'}</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={handleSaveAsTemplate} className={secondaryButton}>
                        <Save size={16}/> Save as Template
                    </button>
                    <button type="button" onClick={handleDownloadPdf} className={secondaryButton}>
                        <Download size={16}/> Download PDF
                    </button>
                    <button type="submit" className={primaryButton}><Save size={18}/> Save Order</button>
                </div>
            </div>
            
            <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
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
                     <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                        <label className="block text-sm font-medium">Add Ad-hoc Party Location</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                type="text"
                                value={newAdHocLocationName}
                                onChange={e => setNewAdHocLocationName(e.target.value)}
                                placeholder="e.g., Client's Residence"
                                className={inputStyle + " flex-grow"}
                            />
                            <button type="button" onClick={handleAddAdHocLocation} className={secondaryButton}>Add</button>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium">Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={inputStyle} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Session</label>
                            <select value={session} onChange={e => setSession(e.target.value as EventSession)} className={inputStyle}>
                                <option value="breakfast">Breakfast</option>
                                <option value="lunch">Lunch</option>
                                <option value="dinner">Dinner</option>
                                <option value="all-day">All-Day</option>
                            </select>
                        </div>
                    </div>
                    <div className="overflow-auto max-h-[calc(100vh-28rem)]">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-warm-gray-100 dark:bg-warm-gray-700">
                                <tr>
                                    <th className="p-2 text-left font-semibold">Item</th>
                                    {allDisplayLocations.map(r => <th key={r.id} className="p-2 text-right font-semibold">{r.name}</th>)}
                                    <th className="p-2 text-right font-semibold">Total</th>
                                    <th className="p-2 text-right font-semibold"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-warm-gray-200 dark:divide-warm-gray-600">
                                {orderItems.map(item => {
                                    const details = item.type === 'recipe' ? recipeMap.get(item.id) : platterMap.get(item.id);
                                    if (!details) return null;

                                    const isPlatter = item.type === 'platter';
                                    const isExpanded = isPlatter && expandedPlatters.has(item.id);
                                    
                                    const total = Object.values(itemRequirements[item.id] || {}).reduce((sum, q) => sum + q, 0);
                                    const unit = isPlatter ? 'portions' : (details as Recipe).defaultOrderingUnit || (details as Recipe).yieldUnit;

                                    const mainRow = (
                                        <tr key={item.id} className={isPlatter ? "bg-blue-50 dark:bg-blue-900/20" : ""}>
                                            <td className="p-2 font-semibold flex items-center">
                                                {isPlatter && (
                                                    <button type="button" onClick={() => togglePlatterExpansion(item.id)} className="mr-2 p-1 rounded-full hover:bg-black/10">
                                                        {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                                    </button>
                                                )}
                                                {details.name}
                                                {isPlatter && <span title="Platter"><Box size={12} className="inline-block ml-2 text-blue-500 flex-shrink-0" /></span>}
                                                <span className="text-xs text-warm-gray-500 font-normal ml-2">({unit})</span>
                                            </td>
                                            {allDisplayLocations.map(r => (
                                                <td key={r.id} className="p-1 min-w-[140px]">
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <input type="number" min="0" step="any"
                                                            value={itemRequirements[item.id]?.[r.id] || ''}
                                                            onChange={e => handleRequirementChange(item.id, r.id, e.target.value)}
                                                            placeholder="Qty"
                                                            className={inputStyle + " text-right text-sm p-1 w-full"}
                                                        />
                                                    </div>
                                                </td>
                                            ))}
                                            <td className="p-2 text-right font-bold">
                                                {total} {unit}
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

                                    if (isPlatter && isExpanded) {
                                        const platterDetails = details as Platter;
                                        const subRows = platterDetails.recipes.map(pRecipe => {
                                            const recipeDetails = recipeMap.get(pRecipe.recipeId);
                                            if (!recipeDetails) return null;
                                            
                                            const totalPlatterPortions = total;
                                            const { qty: totalRecipeProdQty, unit: recipeProdUnit } = getConstituentRecipeQty(totalPlatterPortions, pRecipe, recipeDetails);

                                            return (
                                                <tr key={`${item.id}-${pRecipe.recipeId}`} className="bg-warm-gray-50 dark:bg-warm-gray-800/50">
                                                    <td className="py-1 px-2 pl-12 text-xs italic text-warm-gray-600 dark:text-warm-gray-400">
                                                      - {recipeDetails.name}
                                                    </td>
                                                    {allDisplayLocations.map(r => {
                                                        const platterPortions = itemRequirements[item.id]?.[r.id] || 0;
                                                        const { qty, unit } = getConstituentRecipeQty(platterPortions, pRecipe, recipeDetails);
                                                        return (
                                                            <td key={r.id} className="py-1 px-2 text-right text-xs text-warm-gray-500">
                                                                {qty > 0 ? `${qty.toFixed(2)} ${unit}` : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="py-1 px-2 text-right text-xs font-semibold">
                                                        {totalRecipeProdQty > 0 ? `${totalRecipeProdQty.toFixed(2)} ${recipeProdUnit}` : '-'}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            );
                                        }).filter(Boolean);
                                        return <Fragment key={`${item.id}-fragment`}>{mainRow}{subRows}</Fragment>;
                                    }

                                    return mainRow;
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
                    </div>
                </div>
            </div>
        </form>
    );
};