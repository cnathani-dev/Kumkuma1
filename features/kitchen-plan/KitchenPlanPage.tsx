




import React, { useMemo } from 'react';
import { Event, Item, AppCategory, PlanCategory, PlanItem, Client } from '../../types';
import { useItems, useAppCategories, useItemAccompaniments, useClients } from '../../contexts/AppContexts';
import { secondaryButton, iconButton } from '../../components/common/styles';
import { ArrowLeft, ChefHat, User, Calendar, Clock, Download, MapPin } from 'lucide-react';
import { exportKitchenPlanToPdf } from '../../lib/export';
import { formatDateRange } from '../../lib/utils';

interface KitchenPlanPageProps {
    event: Event;
    onCancel: () => void;
}

export const KitchenPlanPage: React.FC<KitchenPlanPageProps> = ({ event, onCancel }) => {
    const { items: allItems } = useItems();
    const { categories: allCategories } = useAppCategories();
    const { settings: itemAccompaniments } = useItemAccompaniments();
    const { clients } = useClients();

    const itemMap = useMemo(() => new Map(allItems.map(i => [i.id, i])), [allItems]);
    const categoryMap = useMemo(() => new Map(allCategories.map(c => [c.id, c])), [allCategories]);
    
    const isNonVegMenu = useMemo(() => {
        const allSelectedIds = new Set(Object.values(event.itemIds || {}).flat());
        for (const id of allSelectedIds) {
            const item = itemMap.get(id);
            if (item && item.type !== 'veg') {
                return true;
            }
        }
        return false;
    }, [event.itemIds, itemMap]);

    const getRootCategory = (catId: string): AppCategory | undefined => {
        let current = categoryMap.get(catId);
        if (!current) return undefined;
        while (current.parentId && categoryMap.has(current.parentId)) {
            current = categoryMap.get(current.parentId)!;
        }
        return current;
    };

    const planData = useMemo(() => {
        const pax = event.pax || 0;
        if (pax === 0) return null;

        const calculatedQuantities = new Map<string, { quantity: number; unit: string; notes?: string }>();
        const selectedNormalItemsByCat = new Map<string, Item[]>();

        // 1. Separate standard accompaniment items from normal items
        Object.values(event.itemIds || {}).flat().forEach(itemId => {
            const item = itemMap.get(itemId);
            if (item) {
                const rootCat = getRootCategory(item.categoryId);
                if (rootCat?.isStandardAccompaniment) {
                    // 2. Calculate for standard accompaniment items directly (item-level)
                    if (typeof item.baseQuantityPerPax === 'number') {
                        calculatedQuantities.set(item.id, {
                            quantity: pax * item.baseQuantityPerPax,
                            unit: item.quantityUnit || 'N/A',
                            notes: !item.quantityUnit ? 'Unit not configured' : undefined
                        });
                    }
                } else {
                    // Group normal items for category-level calculation
                    if (!selectedNormalItemsByCat.has(item.categoryId)) {
                        selectedNormalItemsByCat.set(item.categoryId, []);
                    }
                    selectedNormalItemsByCat.get(item.categoryId)!.push(item);
                }
            }
        });
        
        // 3. Calculate quantities for normal category groups
        for (const [catId, items] of selectedNormalItemsByCat.entries()) {
            const category = categoryMap.get(catId);
            if (!category) {
                items.forEach(item => calculatedQuantities.set(item.id, { quantity: 0, unit: 'N/A', notes: 'Category not found' }));
                continue;
            }

            let baseQtyPerPax: number | undefined;
            let unit: string | undefined;
            let additionalItemPercentage: number | undefined;

            if (isNonVegMenu && category.type !== 'non-veg' && !category.useSingleCookingEstimate) {
                baseQtyPerPax = category.baseQuantityPerPax_nonVeg ?? category.baseQuantityPerPax;
                unit = category.quantityUnit_nonVeg ?? category.quantityUnit;
                additionalItemPercentage = category.additionalItemPercentage_nonVeg ?? category.additionalItemPercentage;
            } else {
                baseQtyPerPax = category.baseQuantityPerPax;
                unit = category.quantityUnit;
                additionalItemPercentage = category.additionalItemPercentage;
            }

            if (typeof baseQtyPerPax !== 'number') {
                items.forEach(item => calculatedQuantities.set(item.id, { quantity: 0, unit: 'N/A', notes: 'Category not configured for estimates' }));
                continue;
            }

            unit = unit || '';
            const numItems = items.length;

            let totalCategoryQty = pax * baseQtyPerPax;

            if (numItems > 1 && typeof additionalItemPercentage === 'number') {
                const increaseFactor = (numItems - 1) * (additionalItemPercentage / 100);
                totalCategoryQty *= (1 + increaseFactor);
            }
            
            const quantityPerItem = numItems > 0 ? totalCategoryQty / numItems : 0;

            items.forEach(item => {
                calculatedQuantities.set(item.id, { quantity: quantityPerItem, unit, notes: !unit ? 'Unit not configured' : undefined });
            });
        }
        
        // 4. Group all items for display by root category
        const displayPlan = new Map<string, PlanCategory>();
        
        Object.values(event.itemIds || {}).flat().forEach(itemId => {
            const item = itemMap.get(itemId);
            const calc = calculatedQuantities.get(itemId);
            if (!item) return;
            
            const rootCat = getRootCategory(item.categoryId);
            if (!rootCat) return;

            if (!displayPlan.has(rootCat.id)) {
                displayPlan.set(rootCat.id, {
                    categoryName: rootCat.name,
                    displayRank: rootCat.displayRank,
                    items: []
                });
            }
            
            const planItem: PlanItem = {
                name: item.name,
                quantity: calc?.quantity ?? 0,
                unit: calc?.unit ?? 'N/A',
                notes: calc?.notes
            };
            displayPlan.get(rootCat.id)!.items.push(planItem);
        });

        const sortedPlan = Array.from(displayPlan.values()).sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity));

        // 5. Calculate (item) accompaniments
        const allAccompanimentIds = new Set<string>();
        Object.values(event.itemIds || {}).flat().forEach(itemId => {
            itemMap.get(itemId)?.accompanimentIds?.forEach(accId => allAccompanimentIds.add(accId));
        });

        if (allAccompanimentIds.size > 0) {
            const accompanimentPlanItems: PlanItem[] = [];
            allAccompanimentIds.forEach(accId => {
                const accompaniment = itemAccompaniments.find(a => a.id === accId);
                if (accompaniment && typeof accompaniment.baseQuantityPerPax === 'number') {
                    accompanimentPlanItems.push({
                        name: accompaniment.name,
                        quantity: pax * accompaniment.baseQuantityPerPax,
                        unit: accompaniment.quantityUnit || 'N/A',
                        notes: !accompaniment.quantityUnit ? 'Unit not configured' : undefined,
                    });
                }
            });

            if (accompanimentPlanItems.length > 0) {
                sortedPlan.push({
                    categoryName: 'Accompaniments',
                    displayRank: 9999, // High rank to ensure it's last
                    items: accompanimentPlanItems.sort((a,b) => a.name.localeCompare(b.name)),
                });
            }
        }
        
        return sortedPlan;

    }, [event, itemMap, categoryMap, itemAccompaniments, allCategories, isNonVegMenu]);
    
    const formatQuantity = (quantity: number) => {
        // Show up to 2 decimal places if not a whole number
        return quantity % 1 === 0 ? quantity : quantity.toFixed(2);
    };

    const handleExport = () => {
        if (planData) {
            const client = clients.find(c => c.id === event.clientId);
            if (!client) {
                alert("Client not found for this event.");
                return;
            }
            exportKitchenPlanToPdf(event, client, planData);
        } else {
            alert("No data to export. Ensure PAX count is greater than 0.");
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                <div className="flex items-center gap-4">
                     <button type="button" onClick={onCancel} className={iconButton('hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700')}><ArrowLeft size={20}/></button>
                     <div className="flex items-center gap-3">
                         <ChefHat size={32} className="text-primary-500" />
                         <div>
                            <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                                Kitchen Production Plan
                            </h2>
                            <p className="text-warm-gray-500">{event.eventType}</p>
                         </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={handleExport} className={secondaryButton}>
                        <Download size={16}/> Download PDF
                    </button>
                </div>
            </div>
            
             <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md flex flex-wrap items-center gap-x-6 gap-y-2 text-warm-gray-600 dark:text-warm-gray-300">
                 <div className="flex items-center gap-2 font-semibold">
                    <User size={16} /> PAX: <span className="text-lg text-primary-500">{event.pax || 0}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <Calendar size={16} /> {formatDateRange(event.startDate, event.endDate)}
                 </div>
                 <div className="flex items-center gap-2">
                    <Clock size={16} /> {event.session.charAt(0).toUpperCase() + event.session.slice(1)}
                 </div>
                 <div className="flex items-center gap-2">
                    <MapPin size={16} /> {event.location}
                 </div>
             </div>
             
             {(!event.pax || event.pax === 0) && (
                <div className="text-center py-10 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="font-semibold text-yellow-700 dark:text-yellow-300">Warning: PAX count is 0.</p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">Quantities cannot be calculated without a guest count.</p>
                </div>
             )}

             {event.notes && (
                 <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                     <h3 className="font-bold text-lg mb-2 text-yellow-800 dark:text-yellow-200">Special Instructions</h3>
                     <p className="text-sm text-yellow-700 dark:text-yellow-500 whitespace-pre-wrap">{event.notes}</p>
                 </div>
             )}

            {planData && planData.length > 0 && (
                <div className="space-y-6">
                    {planData.map(category => (
                        <div key={category.categoryName} className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                            <h3 className="font-bold text-xl mb-3 text-primary-600 dark:text-primary-400">{category.categoryName}</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-warm-gray-200 dark:border-warm-gray-700">
                                            <th className="p-2 text-left font-semibold">Item</th>
                                            <th className="p-2 text-right font-semibold">Quantity</th>
                                            <th className="p-2 text-left font-semibold">Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {category.items.map(item => (
                                            <tr key={item.name} className="border-b border-warm-gray-100 dark:border-warm-gray-700/50">
                                                <td className="p-2 font-medium text-warm-gray-800 dark:text-warm-gray-200">{item.name}</td>
                                                <td className="p-2 text-right font-bold text-lg">
                                                    {item.notes ? (
                                                        <span className="text-xs font-normal text-yellow-500" title={item.notes}>N/A</span>
                                                    ) : (
                                                        formatQuantity(item.quantity)
                                                    )}
                                                </td>
                                                <td className="p-2 text-warm-gray-500">{item.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};