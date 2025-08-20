import React, { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Order, Recipe, RawMaterial, Platter, RestaurantSetting, PlatterRecipe, EventSession } from '../../types';
import { useRecipes, useRawMaterials, useRestaurants, useOrderTemplates, usePlatters } from '../../contexts/AppContexts';
import { primaryButton, secondaryButton, inputStyle, iconButton } from '../../components/common/styles';
import { Save, ArrowLeft, Plus, Trash2, AlertTriangle, Box, ChevronDown, ChevronRight, Download } from 'lucide-react';
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

interface CalculatedRawMaterial {
    id: string;
    name: string;
    total: number;
    unit: string;
}

const getYieldInUnit = (recipe: Recipe, targetUnit: string): number | null => {
    const targetUnitClean = targetUnit.toLowerCase();
    const recipeYieldUnit = recipe.yieldUnit.toLowerCase();

    if (recipeYieldUnit === targetUnitClean) {
        return recipe.yieldQuantity;
    }

    const conversion = (recipe.conversions || []).find(c => c.unit.toLowerCase() === targetUnitClean);
    if (conversion && conversion.factor > 0) {
        // New logic: 1 targetUnit = factor * recipeYieldUnit
        // To get yield in targetUnit, we divide by factor.
        return recipe.yieldQuantity / conversion.factor;
    }
    
    // Fallback for kg/litres, maybe remove later.
    if ((recipeYieldUnit === 'kg' && targetUnitClean === 'litres') || (recipeYieldUnit === 'litres' && targetUnitClean === 'kg')) {
        return recipe.yieldQuantity;
    }

    return null;
};

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
    
    // Form state
    const [date, setDate] = useState('');
    const [session, setSession] = useState<EventSession>('lunch');
    const [expandedPlatters, setExpandedPlatters] = useState<Set<string>>(new Set());
    const [orderItems, setOrderItems] = useState<{ type: 'recipe' | 'platter', id: string }[]>([]);
    const [itemRequirements, setItemRequirements] = useState<Record<string, Record<string, number>>>({});

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

        setDate(initialDate);
        setSession(initialSession);
        setOrderItems(initialOrderItems);
        setItemRequirements(initialRequirements);

        setInitialState(JSON.stringify({
            date: initialDate,
            session: initialSession,
            orderItems: initialOrderItems,
            itemRequirements: initialRequirements
        }));
    }, [order]);

    const isDirty = useMemo(() => {
        if (initialState === null) return false;
        const currentState = JSON.stringify({
            date,
            session,
            orderItems,
            itemRequirements
        });
        return currentState !== initialState;
    }, [date, session, orderItems, itemRequirements, initialState]);

    const handleBack = () => {
        if (isDirty) {
            if (window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
                onBack();
            }
        } else {
            onBack();
        }
    };
    
    const getProductionQuantity = (recipe: Recipe, totalOrdered: number): number => {
        const orderingUnit = recipe.defaultOrderingUnit || recipe.yieldUnit;
    
        if (orderingUnit.toLowerCase() === recipe.yieldUnit.toLowerCase()) {
            return totalOrdered;
        }
    
        const conversion = (recipe.conversions || []).find(c => c.unit.toLowerCase() === orderingUnit.toLowerCase());
        if (conversion && conversion.factor > 0) {
            // 1 orderingUnit = factor * yieldUnit
            return totalOrdered * conversion.factor;
        }
        
        return 0;
    };

    const calculatedRawMaterials = useMemo((): CalculatedRawMaterial[] => {
        const rawMaterialTotals = new Map<string, number>(); // rawMaterialId -> total quantity

        orderItems.forEach(item => {
            const requirements = itemRequirements[item.id] || {};
            const totalOrdered = Object.values(requirements).reduce((sum, qty) => sum + qty, 0);
            if (totalOrdered <= 0) return;

            if (item.type === 'recipe') {
                const recipe = recipeMap.get(item.id);
                if (!recipe || !recipe.yieldQuantity || recipe.yieldQuantity <= 0) return;
                
                const totalProduction = getProductionQuantity(recipe, totalOrdered);
                if (totalProduction <= 0) return;
                
                const recipeMultiplier = totalProduction / recipe.yieldQuantity;

                (recipe.rawMaterials || []).forEach(ing => {
                    const currentTotal = rawMaterialTotals.get(ing.rawMaterialId) || 0;
                    rawMaterialTotals.set(ing.rawMaterialId, currentTotal + (ing.quantity * recipeMultiplier));
                });
            } else if (item.type === 'platter') {
                const platter = platterMap.get(item.id);
                if (!platter) return;

                const platterMultiplier = totalOrdered; // For platters, totalOrdered is always in portions

                platter.recipes.forEach(pRecipe => {
                    const recipe = recipeMap.get(pRecipe.recipeId);
                    let recipeBaseOutputLitres = recipe ? getYieldInUnit(recipe, 'litres') : null;
                    if (recipeBaseOutputLitres === null && recipe) recipeBaseOutputLitres = getYieldInUnit(recipe, 'kg');

                    if (!recipe || !recipeBaseOutputLitres || recipeBaseOutputLitres <= 0) return;
                    
                    const totalRecipeLitresNeeded = (pRecipe.quantityMl / 1000) * platterMultiplier;
                    const recipeMultiplier = totalRecipeLitresNeeded / recipeBaseOutputLitres;

                    (recipe.rawMaterials || []).forEach(ing => {
                        const currentTotal = rawMaterialTotals.get(ing.rawMaterialId) || 0;
                        rawMaterialTotals.set(ing.rawMaterialId, currentTotal + (ing.quantity * recipeMultiplier));
                    });
                });
            }
        });

        return Array.from(rawMaterialTotals.entries())
            .map(([id, total]) => ({
                id,
                name: rawMaterialMap.get(id)?.name || 'Unknown',
                unit: rawMaterialMap.get(id)?.unit || '',
                total,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [orderItems, itemRequirements, recipeMap, platterMap, rawMaterialMap]);

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

    const handleDownloadPdf = () => {
        const currentOrderState: Order = {
            id: order?.id || 'new-order',
            date,
            session,
            recipeRequirements: Object.fromEntries(orderItems.filter(i => i.type === 'recipe').map(i => [i.id, itemRequirements[i.id] || {}])),
            platterRequirements: Object.fromEntries(orderItems.filter(i => i.type === 'platter').map(i => [i.id, itemRequirements[i.id] || {}])),
        };
        exportOrderToPdf(currentOrderState, sortedRestaurants, allRecipes, allRawMaterials, platters);
    };
    
    const getConstituentRecipeQty = (platterPortions: number, pRecipe: PlatterRecipe, recipeDetails: Recipe): { qty: number; unit: string } => {
        if (platterPortions <= 0) return { qty: 0, unit: '' };
        
        let recipeBaseOutputLitres = getYieldInUnit(recipeDetails, 'litres');
        if (recipeBaseOutputLitres === null) recipeBaseOutputLitres = getYieldInUnit(recipeDetails, 'kg');

        if (!recipeDetails || !recipeBaseOutputLitres || recipeBaseOutputLitres <= 0) return { qty: 0, unit: 'N/A' };
        
        const totalRecipeLitresNeeded = (pRecipe.quantityMl / 1000) * platterPortions;
        const recipeProductionYieldAmount = recipeDetails.yieldQuantity;
        const recipeProductionYieldUnit = recipeDetails.yieldUnit;
        const recipeMultiplier = totalRecipeLitresNeeded / recipeBaseOutputLitres;
        const finalQty = recipeMultiplier * recipeProductionYieldAmount;
        return { qty: finalQty, unit: recipeProductionYieldUnit };
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                <h2 className="text-3xl font-display font-bold">{order ? 'Edit Order' : 'Create New Order'}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={handleSaveAsTemplate} className={secondaryButton}>
                        <Save size={16}/> Save as Template
                    </button>
                    <button type="button" onClick={handleDownloadPdf} className={secondaryButton}>
                        <Download size={16}/> Download PDF
                    </button>
                    <button type="button" onClick={handleBack} className={secondaryButton}><ArrowLeft size={16}/> Back</button>
                    <button type="submit" className={primaryButton}><Save size={18}/> Save Order</button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content (Left) */}
                <div className="lg:col-span-2 space-y-6">
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
                                        {sortedRestaurants.map(r => <th key={r.id} className="p-2 text-right font-semibold">{r.name}</th>)}
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
                                                </td>
                                                {sortedRestaurants.map(r => (
                                                    <td key={r.id} className="p-1 min-w-[80px]">
                                                        <input type="number" min="0" step="1"
                                                            value={itemRequirements[item.id]?.[r.id] || ''}
                                                            onChange={e => handleRequirementChange(item.id, r.id, e.target.value)}
                                                            placeholder={unit}
                                                            className={inputStyle + " text-right text-sm p-1"}
                                                        />
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
                                                        {sortedRestaurants.map(r => {
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

                {/* Sidebar (Right) */}
                <div className="lg:col-span-1">
                    <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md sticky top-8">
                        <h3 className="font-bold mb-2">Production Raw Materials Summary</h3>
                        <div className="overflow-auto max-h-[calc(100vh-12rem)]">
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
                </div>
            </div>
        </form>
    );
};