






import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppCategories, useUnits, useItemAccompaniments } from '../../contexts/AppContexts';
import { AppCategory, PermissionLevel, FinancialSetting, ItemAccompaniment } from '../../types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { inputStyle } from '../../components/common/styles';

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const debounced = (...args: Parameters<F>): void => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), waitFor);
    };
    return debounced;
}

const CategoryNode = ({ category, hierarchy, updateCategory, canModify, units, level = 0 }: {
    category: AppCategory;
    hierarchy: Map<string, AppCategory[]>;
    updateCategory: (category: AppCategory) => Promise<void>;
    canModify: boolean;
    units: FinancialSetting[];
    level?: number;
}) => {
    const [isOpen, setIsOpen] = useState(level < 1);
    const children = useMemo(() => hierarchy.get(category.id) || [], [hierarchy, category.id]);
    
    const [localData, setLocalData] = useState({
        baseQuantityPerPax: category.baseQuantityPerPax ?? '',
        quantityUnit: category.quantityUnit ?? '',
        additionalItemPercentage: category.additionalItemPercentage ?? '',
    });

    const [localNonVegData, setLocalNonVegData] = useState({
        baseQuantityPerPax_nonVeg: category.baseQuantityPerPax_nonVeg ?? '',
        quantityUnit_nonVeg: category.quantityUnit_nonVeg ?? '',
        additionalItemPercentage_nonVeg: category.additionalItemPercentage_nonVeg ?? '',
    });


    // Sync with parent prop changes
    useEffect(() => {
        setLocalData({
            baseQuantityPerPax: category.baseQuantityPerPax ?? '',
            quantityUnit: category.quantityUnit ?? '',
            additionalItemPercentage: category.additionalItemPercentage ?? '',
        });
        setLocalNonVegData({
            baseQuantityPerPax_nonVeg: category.baseQuantityPerPax_nonVeg ?? '',
            quantityUnit_nonVeg: category.quantityUnit_nonVeg ?? '',
            additionalItemPercentage_nonVeg: category.additionalItemPercentage_nonVeg ?? '',
        });
    }, [category]);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedUpdate = useCallback(debounce((updatedCategory: AppCategory) => {
        if (canModify) {
           updateCategory(updatedCategory);
        }
    }, 1200), [updateCategory, canModify]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        const updatedLocalData = { ...localData };
        const updatedLocalNonVegData = { ...localNonVegData };

        if (name.endsWith('_nonVeg')) {
            (updatedLocalNonVegData as any)[name] = value;
            setLocalNonVegData(updatedLocalNonVegData);
        } else {
            (updatedLocalData as any)[name] = value;
            setLocalData(updatedLocalData);
        }
        
        debouncedUpdate({
            ...category,
            baseQuantityPerPax: updatedLocalData.baseQuantityPerPax === '' ? undefined : Number(updatedLocalData.baseQuantityPerPax),
            quantityUnit: updatedLocalData.quantityUnit,
            additionalItemPercentage: updatedLocalData.additionalItemPercentage === '' ? undefined : Number(updatedLocalData.additionalItemPercentage),
            baseQuantityPerPax_nonVeg: updatedLocalNonVegData.baseQuantityPerPax_nonVeg === '' ? undefined : Number(updatedLocalNonVegData.baseQuantityPerPax_nonVeg),
            quantityUnit_nonVeg: updatedLocalNonVegData.quantityUnit_nonVeg,
            additionalItemPercentage_nonVeg: updatedLocalNonVegData.additionalItemPercentage_nonVeg === '' ? undefined : Number(updatedLocalNonVegData.additionalItemPercentage_nonVeg),
        });
    };
    
    const isVegCategory = category.type === 'veg';

    return (
        <li className="list-none">
            <div className="grid grid-cols-10 gap-4 items-center p-2 border-t border-warm-gray-100 dark:border-warm-gray-700/50 hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/30">
                <div style={{ paddingLeft: `${level * 24}px` }} className="flex items-center gap-1 col-span-4">
                    {children.length > 0 && (
                        <button onClick={() => setIsOpen(!isOpen)} className="p-1 -ml-1">
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                    )}
                    <span className="font-semibold">{category.name}</span>
                </div>
                
                {/* Veg Menu Estimates */}
                <div><input type="number" name="baseQuantityPerPax" value={localData.baseQuantityPerPax} onChange={handleChange} disabled={!canModify} className={inputStyle + " text-sm"} placeholder="e.g., 100"/></div>
                <div><select name="quantityUnit" value={localData.quantityUnit} onChange={handleChange} disabled={!canModify} className={inputStyle + " text-sm"}><option value="">-- Unit --</option>{units.slice().sort((a,b) => a.name.localeCompare(b.name)).map(unit => (<option key={unit.id} value={unit.name}>{unit.name}</option>))}</select></div>
                <div><input type="number" name="additionalItemPercentage" value={localData.additionalItemPercentage} onChange={handleChange} disabled={!canModify} className={inputStyle + " text-sm"} placeholder="e.g., 20"/></div>
                
                {/* Non-Veg Menu Estimates */}
                {isVegCategory ? (
                    <>
                        <div><input type="number" name="baseQuantityPerPax_nonVeg" value={localNonVegData.baseQuantityPerPax_nonVeg} onChange={handleChange} disabled={!canModify} className={inputStyle + " text-sm"} placeholder="e.g., 75"/></div>
                        <div><select name="quantityUnit_nonVeg" value={localNonVegData.quantityUnit_nonVeg} onChange={handleChange} disabled={!canModify} className={inputStyle + " text-sm"}><option value="">-- Unit --</option>{units.slice().sort((a,b) => a.name.localeCompare(b.name)).map(unit => (<option key={unit.id} value={unit.name}>{unit.name}</option>))}</select></div>
                        <div><input type="number" name="additionalItemPercentage_nonVeg" value={localNonVegData.additionalItemPercentage_nonVeg} onChange={handleChange} disabled={!canModify} className={inputStyle + " text-sm"} placeholder="e.g., 10"/></div>
                    </>
                ) : (
                    <div className="col-span-3 text-center text-sm text-warm-gray-400 p-2 italic">N/A</div>
                )}
            </div>
            {isOpen && children.length > 0 && (
                <ul className="list-none">
                    {children.map(child => (
                        <CategoryNode 
                            key={child.id} 
                            category={child} 
                            hierarchy={hierarchy} 
                            updateCategory={updateCategory}
                            canModify={canModify}
                            units={units}
                            level={level + 1}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
};

const AccompanimentRow = ({ accompaniment, updateAccompaniment, canModify, units }: {
    accompaniment: ItemAccompaniment;
    updateAccompaniment: (acc: ItemAccompaniment) => Promise<void>;
    canModify: boolean;
    units: FinancialSetting[];
}) => {
     const [localData, setLocalData] = useState({
        baseQuantityPerPax: accompaniment.baseQuantityPerPax ?? '',
        quantityUnit: accompaniment.quantityUnit ?? '',
    });

    useEffect(() => {
        setLocalData({
            baseQuantityPerPax: accompaniment.baseQuantityPerPax ?? '',
            quantityUnit: accompaniment.quantityUnit ?? '',
        });
    }, [accompaniment]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedUpdate = useCallback(debounce((updatedAccompaniment: ItemAccompaniment) => {
        if (canModify) {
           updateAccompaniment(updatedAccompaniment);
        }
    }, 1200), [updateAccompaniment, canModify]);

     const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const newLocalData = { ...localData, [name]: value };
        setLocalData(newLocalData);
        
        debouncedUpdate({
            ...accompaniment,
            baseQuantityPerPax: newLocalData.baseQuantityPerPax === '' ? undefined : Number(newLocalData.baseQuantityPerPax),
            quantityUnit: newLocalData.quantityUnit,
        });
    };

    return (
        <div className="grid grid-cols-4 gap-4 items-center p-2 border-t border-warm-gray-100 dark:border-warm-gray-700/50 hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/30">
            <span className="font-semibold">{accompaniment.name}</span>
            <div>
                <input
                    type="number"
                    name="baseQuantityPerPax"
                    value={localData.baseQuantityPerPax}
                    onChange={handleChange}
                    disabled={!canModify}
                    className={inputStyle + " text-sm"}
                    placeholder="e.g., 10"
                />
            </div>
            <div>
                 <select
                    name="quantityUnit"
                    value={localData.quantityUnit}
                    onChange={handleChange}
                    disabled={!canModify}
                    className={inputStyle + " text-sm"}
                >
                    <option value="">-- Select Unit --</option>
                    {units.slice().sort((a,b) => a.name.localeCompare(b.name)).map(unit => (
                        <option key={unit.id} value={unit.name}>{unit.name}</option>
                    ))}
                </select>
            </div>
            <div className="text-sm text-warm-gray-400">N/A</div>
        </div>
    );
};


export const CookingEstimates = ({ permissions }: { permissions: PermissionLevel }) => {
    const { categories, updateCategory } = useAppCategories();
    const { settings: units } = useUnits();
    const { settings: accompaniments, updateAccompaniment } = useItemAccompaniments();
    const canModify = permissions === 'modify';

    const { roots, hierarchy } = useMemo(() => {
        const hierarchyMap = new Map<string, AppCategory[]>();
        const rootCategories: AppCategory[] = [];
        categories.forEach(cat => {
            if (cat.parentId === null) {
                rootCategories.push(cat);
            } else {
                if (!hierarchyMap.has(cat.parentId)) {
                    hierarchyMap.set(cat.parentId, []);
                }
                hierarchyMap.get(cat.parentId)!.push(cat);
            }
        });
        rootCategories.sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
        hierarchyMap.forEach(children => children.sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)));
        return { roots: rootCategories, hierarchy: hierarchyMap };
    }, [categories]);

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-display font-bold text-primary-600 dark:text-primary-400 mb-2">Category Cooking Estimates</h3>
                <p className="text-sm text-warm-gray-500 mb-6">
                    Set cooking quantities for each category. For events, these values help estimate total preparation amounts. For example, if 'Base Qty' is 100g and 'Extra Item %' is 20, selecting two items from this category for 10 PAX would suggest cooking (10 * 100g) * 1.20 = 1200g total for that category, to be distributed among the items.
                </p>
                <div className="overflow-x-auto">
                    <div className="min-w-[1200px]">
                        {/* Table Header */}
                        <div className="grid grid-cols-10 gap-4 font-semibold p-2 border-b-2 border-warm-gray-300 dark:border-warm-gray-600 text-sm text-warm-gray-600 dark:text-warm-gray-300">
                            <div className="col-span-4 self-end">Category Name</div>
                            <div className="col-span-3 text-center p-2 bg-green-50 dark:bg-green-900/30 rounded-t-md">Estimates for <span className="font-bold">VEG</span> Menus</div>
                            <div className="col-span-3 text-center p-2 bg-red-50 dark:bg-red-900/30 rounded-t-md">Estimates for <span className="font-bold">NON-VEG</span> Menus</div>
                            
                            <div className="col-span-4"></div>
                            <div className="text-xs">Base Qty / Pax</div>
                            <div className="text-xs">Unit</div>
                            <div className="text-xs">Add. Item %</div>
                            <div className="text-xs">Base Qty / Pax</div>
                            <div className="text-xs">Unit</div>
                            <div className="text-xs">Add. Item %</div>
                        </div>
                        {/* Tree Body */}
                        <ul className="mt-2">
                            {roots.map(root => (
                                <CategoryNode 
                                    key={root.id} 
                                    category={root} 
                                    hierarchy={hierarchy}
                                    updateCategory={updateCategory}
                                    canModify={canModify}
                                    units={units}
                                />
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-display font-bold text-primary-600 dark:text-primary-400 mb-2">Accompaniment Cooking Estimates</h3>
                 <p className="text-sm text-warm-gray-500 mb-6">
                    Set a fixed cooking quantity per guest for each accompaniment (e.g., 15ml of Raitha per PAX). This quantity will be calculated for any event where an item requiring this accompaniment is selected.
                </p>
                 <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Table Header */}
                        <div className="grid grid-cols-4 gap-4 font-semibold p-2 border-b-2 border-warm-gray-300 dark:border-warm-gray-600 text-sm text-warm-gray-600 dark:text-warm-gray-300">
                            <div>Accompaniment Name</div>
                            <div>Base Quantity per Pax</div>
                            <div>Unit</div>
                             <div className="text-warm-gray-400">Additional Item % (N/A)</div>
                        </div>
                        {/* List Body */}
                        <ul className="mt-2">
                             {accompaniments.sort((a,b) => a.name.localeCompare(b.name)).map(acc => (
                                <li key={acc.id} className="list-none">
                                    <AccompanimentRow
                                        accompaniment={acc}
                                        updateAccompaniment={updateAccompaniment}
                                        canModify={canModify}
                                        units={units}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};