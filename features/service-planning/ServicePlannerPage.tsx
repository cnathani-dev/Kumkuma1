





import React, { useState, useMemo } from 'react';
import { Event, Item, AppCategory } from '../../types';
import { useItems, useServiceArticles, useAppCategories, useLiveCounters, useLiveCounterItems, useClients } from '../../contexts/AppContexts';
import { primaryButton, secondaryButton, inputStyle } from '../../components/common/styles';
import { Save, ArrowLeft, UtensilsCrossed, Users, Download } from 'lucide-react';
import { exportNameCardsToPdf } from '../../lib/export';

interface ServicePlannerPageProps {
    event: Event;
    onSave: (event: Event) => void;
    onCancel: () => void;
    canModify: boolean;
}

export const ServicePlannerPage: React.FC<ServicePlannerPageProps> = ({ event, onSave, onCancel, canModify }) => {
    const { items: allItems } = useItems();
    const { settings: serviceArticles } = useServiceArticles();
    const { categories: allCategories } = useAppCategories();
    const { liveCounters } = useLiveCounters();
    const { liveCounterItems } = useLiveCounterItems();
    const { clients } = useClients();

    const [vegLineups, setVegLineups] = useState(event.vegLineups || 1);
    const [nonVegLineups, setNonVegLineups] = useState(event.nonVegLineups || 1);
    const [dessertLineups, setDessertLineups] = useState(event.dessertLineups || 1);
    const [saladLineups, setSaladLineups] = useState(event.saladLineups || 1);
    const isLocked = !canModify || event.state === 'lost' || event.state === 'cancelled';

    const { serviceArticleMap, eventItems, categoryMap, categoryHierarchy } = useMemo(() => {
        const saMap = new Map(serviceArticles.map(sa => [sa.id, sa.name]));
        const catMap = new Map(allCategories.map(c => [c.id, c]));
        
        const hierarchy = new Map<string, string[]>();
        allCategories.forEach(cat => {
            if (cat.parentId) {
                if (!hierarchy.has(cat.parentId)) {
                    hierarchy.set(cat.parentId, []);
                }
                hierarchy.get(cat.parentId)!.push(cat.id);
            }
        });

        const itemMap = new Map(allItems.map(i => [i.id, i]));
        const eventItemIds = new Set(Object.values(event.itemIds || {}).flat());
        const evItems = allItems.filter(item => eventItemIds.has(item.id));
        
        return { serviceArticleMap: saMap, eventItems: evItems, categoryMap: catMap, categoryHierarchy: hierarchy };
    }, [serviceArticles, allItems, allCategories, event.itemIds]);

    const getDescendantIds = (rootId: string): Set<string> => {
        const descendants = new Set<string>();
        const queue = [rootId];
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (!descendants.has(currentId)) {
                descendants.add(currentId);
                const children = categoryHierarchy.get(currentId) || [];
                queue.push(...children);
            }
        }
        return descendants;
    };

    const { dessertItems, saladItems, otherItems } = useMemo(() => {
        const dessertRoot = allCategories.find(c => c.name.toLowerCase() === 'desserts' && !c.parentId);
        const saladRoot = allCategories.find(c => c.name.toLowerCase() === 'salads' && !c.parentId);

        const dessertCatIds = dessertRoot ? getDescendantIds(dessertRoot.id) : new Set<string>();
        const saladCatIds = saladRoot ? getDescendantIds(saladRoot.id) : new Set<string>();
        
        const dItems: Item[] = [];
        const sItems: Item[] = [];
        const oItems: Item[] = [];

        for (const item of eventItems) {
            if (dessertCatIds.has(item.categoryId)) {
                dItems.push(item);
            } else if (saladCatIds.has(item.categoryId)) {
                sItems.push(item);
            } else {
                oItems.push(item);
            }
        }
        return { dessertItems: dItems, saladItems: sItems, otherItems: oItems };
    }, [eventItems, allCategories, categoryHierarchy]);


    const requiredArticles = useMemo(() => {
        const counts = new Map<string, number>();
        const addToCounts = (items: Item[], multiplier: number) => {
            for (const item of items) {
                if (item.serviceArticleIds) {
                    for (const articleId of item.serviceArticleIds) {
                        const currentCount = counts.get(articleId) || 0;
                        counts.set(articleId, currentCount + multiplier);
                    }
                }
            }
        };
        
        const otherVegItems = otherItems.filter(i => i.type === 'veg');
        const otherNonVegItems = otherItems.filter(i => i.type !== 'veg');

        addToCounts(otherVegItems, vegLineups > 0 ? vegLineups : 0);
        addToCounts(otherNonVegItems, nonVegLineups > 0 ? nonVegLineups : 0);
        addToCounts(dessertItems, dessertLineups > 0 ? dessertLineups : 0);
        addToCounts(saladItems, saladLineups > 0 ? saladLineups : 0);

        const namedCounts = new Map<string, number>();
        for (const [id, count] of counts.entries()) {
            const name = serviceArticleMap.get(id as string);
            if (name && count > 0) {
                namedCounts.set(name, count);
            }
        }
        
        return Array.from(namedCounts.entries()).sort((a,b) => a[0].localeCompare(b[0]));
    }, [eventItems, vegLineups, nonVegLineups, dessertLineups, saladLineups, serviceArticleMap, otherItems, dessertItems, saladItems]);

    const staffPlan = useMemo(() => {
        const chafingDishCount = requiredArticles.find(([name, count]) => name.toLowerCase() === 'chafing dish')?.[1] || 0;
        const dessertStaffCount = dessertItems.length * (dessertLineups > 0 ? dessertLineups : 0);
        
        return {
            dessertStaff: dessertStaffCount,
            chafingDishStaff: chafingDishCount,
            totalStaff: dessertStaffCount + chafingDishCount,
        };
    }, [requiredArticles, dessertItems, dessertLineups]);


    const handleSave = () => {
        if (isLocked) return;
        onSave({ ...event, vegLineups, nonVegLineups, dessertLineups, saladLineups });
    };
    
    const handleDownloadNameCards = () => {
        const client = clients.find(c => c.id === event.clientId);
        if (!client) {
            alert('Client not found for this event.');
            return;
        }
        exportNameCardsToPdf(event, client, allItems, liveCounters, liveCounterItems);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                    Service Plan for: <span className="text-primary-600">{event.eventType}</span>
                </h2>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={handleDownloadNameCards} className={secondaryButton}>
                        <Download size={16}/> Download Name Cards
                    </button>
                    <button type="button" onClick={onCancel} className={secondaryButton}>
                        <ArrowLeft size={16}/> Back
                    </button>
                    {!isLocked && 
                        <button type="button" onClick={handleSave} className={primaryButton}>
                            <Save size={18} /> Save Plan
                        </button>
                    }
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Input Section */}
                <div className="md:col-span-1 p-6 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                    <h3 className="text-xl font-bold mb-4">Buffet Lineups</h3>
                    <p className="text-sm text-warm-gray-500 mb-4">
                        Specify the number of separate physical lineups for each section. This calculates equipment and staff needed.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="vegLineups" className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Veg Main Course Lineups</label>
                            <input
                                id="vegLineups" type="number" value={vegLineups} onChange={(e) => setVegLineups(Number(e.target.value))}
                                min="0" disabled={isLocked} className={inputStyle}
                            />
                        </div>
                        <div>
                            <label htmlFor="nonVegLineups" className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Non-Veg Main Course Lineups</label>
                            <input
                                id="nonVegLineups" type="number" value={nonVegLineups} onChange={(e) => setNonVegLineups(Number(e.target.value))}
                                min="0" disabled={isLocked} className={inputStyle}
                            />
                        </div>
                         <div>
                            <label htmlFor="dessertLineups" className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Dessert Lineups</label>
                            <input
                                id="dessertLineups" type="number" value={dessertLineups} onChange={(e) => setDessertLineups(Number(e.target.value))}
                                min="0" disabled={isLocked} className={inputStyle}
                            />
                        </div>
                         <div>
                            <label htmlFor="saladLineups" className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Salad Lineups</label>
                            <input
                                id="saladLineups" type="number" value={saladLineups} onChange={(e) => setSaladLineups(Number(e.target.value))}
                                min="0" disabled={isLocked} className={inputStyle}
                            />
                        </div>
                    </div>
                </div>

                {/* Calculation Result Section */}
                <div className="md:col-span-2 space-y-6">
                    <div className="p-6 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                        <h3 className="text-xl font-bold mb-4">Required Service Articles</h3>
                        {requiredArticles.length > 0 ? (
                            <div className="overflow-auto max-h-60">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-warm-gray-100 dark:bg-warm-gray-700">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-semibold">Article</th>
                                            <th className="px-4 py-2 text-right font-semibold">Quantity Needed</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-warm-gray-200 dark:divide-warm-gray-600">
                                        {requiredArticles.map(([name, count]) => (
                                            <tr key={name}>
                                                <td className="px-4 py-2 font-medium">{name}</td>
                                                <td className="px-4 py-2 text-right font-bold text-lg text-primary-600">{count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center text-warm-gray-500">
                                <UtensilsCrossed size={48} className="mb-4" />
                                <p className="font-semibold">No Service Articles Required</p>
                                <p className="text-xs">No items with assigned service articles have been selected for this event's menu.</p>
                            </div>
                        )}
                    </div>
                     <div className="p-6 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                        <h3 className="text-xl font-bold mb-4">Staff Plan</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-warm-gray-700 dark:text-warm-gray-300">Dessert Serving Staff</span>
                                <span className="font-bold text-lg text-primary-600">{staffPlan.dessertStaff}</span>
                            </div>
                            <p className="text-xs text-warm-gray-500 -mt-2 ml-1">Based on {dessertItems.length} dessert item(s) across {dessertLineups} lineup(s).</p>
                             <div className="flex justify-between items-center">
                                <span className="font-medium text-warm-gray-700 dark:text-warm-gray-300">Chafing Dish Manning</span>
                                <span className="font-bold text-lg text-primary-600">{staffPlan.chafingDishStaff}</span>
                            </div>
                             <p className="text-xs text-warm-gray-500 -mt-2 ml-1">Based on 1 staff per required chafing dish.</p>
                             <hr className="my-2 border-warm-gray-200 dark:border-warm-gray-600"/>
                             <div className="flex justify-between items-center font-bold text-lg">
                                 <div className="flex items-center gap-2">
                                     <Users size={20}/>
                                     <span>Total Staff Required</span>
                                 </div>
                                <span className="text-2xl text-accent-500">{staffPlan.totalStaff}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};