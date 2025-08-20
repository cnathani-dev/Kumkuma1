





import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Event, Item, MenuTemplate, AppCategory, ItemType, LiveCounterItem, LiveCounter, Catalog, EventSession, EventState, Client } from '../../types';
import { useItems, useTemplates, useAppCategories, useLiveCounters, useLiveCounterItems, useCatalogs, useLocations } from '../../contexts/AppContexts';
import Modal from '../../components/Modal';
import { v4 as uuidv4 } from 'uuid';
import { Save, X, Eye, FileText, FileSpreadsheet, MapPin, Clock, Calendar, Leaf, Beef, Loader2, AlertTriangle, Salad, ArrowLeft, ChevronDown, Palette } from 'lucide-react';
import { exportToPdf, exportToExcel, exportToPdfWithOptions } from '../../lib/export';
import { deepClone } from '../../lib/utils';


const inputStyle = "mt-1 block w-full px-3 py-2 bg-white dark:bg-warm-gray-700 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-colors";
const primaryButton = "flex items-center justify-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryButton = "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-warm-gray-300 dark:border-warm-gray-600 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700";


interface HierarchicalItemData {
  rootCat: AppCategory;
  maxItems: number;
  currentCount: number;
  itemsByChild: Record<string, Item[]>; // Key is child cat NAME
  childCatIds: string[];
}

export interface MenuSummaryProps {
  event: Event;
  allItems: Item[];
  allCategories: AppCategory[];
  liveCounterMap: Map<string, LiveCounter>;
  liveCounterItemMap: Map<string, LiveCounterItem>;
  onRemoveItem: (item: Item) => void;
  isReadOnly: boolean;
}

// --- Helper: New MenuSummary Component for the right panel ---
export const MenuSummary: React.FC<MenuSummaryProps> = ({ 
    event, 
    allItems,
    allCategories,
    liveCounterMap,
    liveCounterItemMap,
    onRemoveItem, 
    isReadOnly 
}) => {
    const itemMap = useMemo(() => new Map(allItems.map(i => [i.id, i])), [allItems]);
    const categoryMap = useMemo(() => new Map(allCategories.map(c => [c.id, c])), [allCategories]);

    const previewItemsByCategory = useMemo(() => {
        const groupedByCatName: Record<string, Item[]> = {};
        
        if (event.itemIds) {
            for (const catId in event.itemIds) {
                const category = categoryMap.get(catId);
                const items = event.itemIds[catId]
                    .map(id => itemMap.get(id))
                    .filter((i): i is Item => !!i);

                if (category && items.length > 0) {
                    if (!groupedByCatName[category.name]) {
                        groupedByCatName[category.name] = [];
                    }
                    groupedByCatName[category.name].push(...items);
                }
            }
        }
        
        return Object.keys(groupedByCatName)
            .map(categoryName => ({ categoryName, category: allCategories.find(c=>c.name === categoryName), items: groupedByCatName[categoryName] || [] }))
            .filter((group): group is { categoryName: string; category: AppCategory; items: Item[] } => group.items.length > 0 && !!group.category)
            .sort((a, b) => {
                const aCat = a.category;
                const bCat = b.category;
                const aParent = aCat.parentId ? categoryMap.get(aCat.parentId) : aCat;
                const bParent = bCat.parentId ? categoryMap.get(bCat.parentId) : bCat;
                if (aParent && bParent && aParent.id !== bParent.id) {
                    return (aParent.displayRank ?? Infinity) - (bParent.displayRank ?? Infinity) || aParent.name.localeCompare(bParent.name);
                }
                return (aCat.displayRank ?? Infinity) - (bCat.displayRank ?? Infinity) || aCat.name.localeCompare(bCat.name);
            })
            .map(group => ({ 
                category: group.categoryName, 
                items: group.items.slice().sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name))
            }));
    }, [event.itemIds, itemMap, categoryMap, allCategories]);

    const previewLiveCounters = event.liveCounters ? Object.entries(event.liveCounters)
        .map(([counterId, itemIds]) => ({
            counter: liveCounterMap.get(counterId),
            items: (itemIds.map(id => liveCounterItemMap.get(id)).filter(Boolean) as LiveCounterItem[])
        }))
        .filter(group => group.counter && group.items.length > 0) : [];

    return (
        <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-inner flex flex-col">
            <h3 className="text-xl font-display font-bold text-primary-600 dark:text-primary-400 border-b pb-2 mb-4">
                Menu Summary
            </h3>
            <div className="flex-grow overflow-y-auto space-y-6 pr-2">
                {/* Regular Menu Items */}
                <div className="space-y-4">
                    {previewItemsByCategory.map(({ category, items }) => (
                        <div key={category}>
                            <h4 className="font-bold text-warm-gray-700 dark:text-warm-gray-300">{category}</h4>
                            <ul className="mt-1 space-y-1">
                                {items.map(item => (
                                    <li key={item.id} className="flex justify-between items-center text-sm p-1 rounded-md hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700/50">
                                        <span className="text-warm-gray-800 dark:text-warm-gray-200">{item.name}</span>
                                        {!isReadOnly && (
                                            <button onClick={() => onRemoveItem(item)} className="text-red-500 hover:text-red-700">
                                                <X size={16} />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Live Counters */}
                {previewLiveCounters.length > 0 && (
                    <div className="space-y-4 border-t pt-4">
                         <h3 className="font-bold text-lg text-warm-gray-700 dark:text-warm-gray-300">Live Counters</h3>
                        {previewLiveCounters.map(({ counter, items }) => (
                            <div key={counter!.id}>
                                <h4 className="font-bold text-warm-gray-700 dark:text-warm-gray-300">{counter!.name}</h4>
                                <ul className="mt-1 space-y-1">
                                    {items.map(item => (
                                        <li key={item.id} className="text-sm p-1 text-warm-gray-800 dark:text-warm-gray-200">
                                            - {item.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>
             {event.notes && (
                <div className="mt-4 pt-4 border-t">
                     <h4 className="font-bold text-lg text-warm-gray-700 dark:text-warm-gray-300">Special Instructions</h4>
                     <p className="text-sm text-warm-gray-600 dark:text-warm-gray-400 whitespace-pre-wrap">{event.notes}</p>
                </div>
            )}
        </div>
    );
};

interface MenuCreatorProps {
    initialEvent: Event;
    client: Client;
    onSave: (event: Event) => void;
    onCancel: () => void;
}

export default function MenuCreator({ initialEvent, client, onSave, onCancel }: MenuCreatorProps): React.ReactElement {
    const { items: allItems } = useItems();
    const { categories: allCategories } = useAppCategories();
    const { templates } = useTemplates();
    const { catalogs } = useCatalogs();
    const { liveCounters } = useLiveCounters();
    const { liveCounterItems } = useLiveCounterItems();
    
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const [tempInstructions, setTempInstructions] = useState('');

    const [event, setEvent] = useState<Event>(() => deepClone(initialEvent));

    const isReadOnly = useMemo(() => event.status === 'finalized' || event.state === 'lost' || event.state === 'cancelled', [event.status, event.state]);
    const [activeRootCatId, setActiveRootCatId] = useState<string | null>(null);

    const liveCounterMap = useMemo(() => new Map(liveCounters.map(lc => [lc.id, lc])), [liveCounters]);
    const liveCounterItemMap = useMemo(() => new Map(liveCounterItems.map(lci => [lci.id, lci])), [liveCounterItems]);

    const { template, catalog, hierarchicalData, allItemsInCatalogMap, categoryMap } = useMemo(() => {
        if (!event.templateId) return { template: null, catalog: null, hierarchicalData: [], allItemsInCatalogMap: new Map(), categoryMap: new Map() };

        const temp = templates.find(t => t.id === event.templateId);
        if (!temp) return { template: null, catalog: null, hierarchicalData: [], allItemsInCatalogMap: new Map(), categoryMap: new Map() };

        const cat = catalogs.find(c => c.id === temp.catalogId);
        if (!cat) return { template: temp, catalog: null, hierarchicalData: [], allItemsInCatalogMap: new Map(), categoryMap: new Map() };

        const allItemsInCat = new Set(Object.values(cat.itemIds).flat());
        const itemsMap = new Map(allItems.filter(i => allItemsInCat.has(i.id)).map(i => [i.id, i]));
        const catMap = new Map(allCategories.map(c => [c.id, c]));

        const getDescendantCats = (rootId: string): string[] => {
            const children: string[] = [];
            const queue = [rootId];
            const visited = new Set([rootId]);
            while (queue.length > 0) {
                const currentId = queue.shift()!;
                allCategories.forEach(c => {
                    if (c.parentId === currentId && !visited.has(c.id)) {
                        visited.add(c.id);
                        children.push(c.id);
                        queue.push(c.id);
                    }
                });
            }
            return [rootId, ...children];
        };

        const data: HierarchicalItemData[] = Object.entries(temp.rules || {})
            .map(([rootCatId, maxItems]) => {
                const rootCat = catMap.get(rootCatId);
                if (!rootCat) return null;

                const descendantCatIds = getDescendantCats(rootCatId);
                const currentCount = descendantCatIds.reduce((sum, catId) => sum + (event.itemIds[catId]?.length || 0), 0);
                
                const childCatIds = allCategories.filter(c => descendantCatIds.includes(c.id) && !c.parentId && c.id !== rootCatId).map(c=>c.id)
                  .concat(allCategories.filter(c => descendantCatIds.includes(c.id) && c.parentId === rootCatId).map(c=>c.id));

                const itemsByChild: Record<string, Item[]> = {};
                descendantCatIds.forEach(catId => {
                    const childCat = catMap.get(catId);
                    if (childCat) {
                         const itemsForThisCat = Array.from(itemsMap.values()).filter(item => item.categoryId === catId);
                         if(itemsForThisCat.length > 0){
                           itemsByChild[childCat.name] = itemsForThisCat.sort((a,b)=>(a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
                         }
                    }
                });

                return { rootCat, maxItems, currentCount, itemsByChild, childCatIds: descendantCatIds };
            })
            .filter((d): d is HierarchicalItemData => !!d)
            .sort((a, b) => (a.rootCat.displayRank ?? Infinity) - (b.rootCat.displayRank ?? Infinity) || a.rootCat.name.localeCompare(b.rootCat.name));

        return { template: temp, catalog: cat, hierarchicalData: data, allItemsInCatalogMap: itemsMap, categoryMap: catMap };
    }, [event.templateId, event.itemIds, templates, catalogs, allItems, allCategories]);
    
    useEffect(() => {
        if (!activeRootCatId && hierarchicalData.length > 0) {
            setActiveRootCatId(hierarchicalData[0].rootCat.id);
        }
    }, [hierarchicalData, activeRootCatId]);

    const activeHierarchicalData = useMemo(() => {
        if (!activeRootCatId) return null;
        return hierarchicalData.find(d => d.rootCat.id === activeRootCatId);
    }, [activeRootCatId, hierarchicalData]);
    
    const sortedChildCatNames = useMemo(() => {
        if (!activeHierarchicalData) return [];
        
        return Object.keys(activeHierarchicalData.itemsByChild)
            .map(name => allCategories.find(c => c.name === name))
            .filter((c): c is AppCategory => !!c)
            .sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name))
            .map(c => c.name);
    }, [activeHierarchicalData, allCategories]);

    const handleItemToggle = (item: Item, rootCatInfo: HierarchicalItemData) => {
        if (isReadOnly) return;
        
        const newSelectedItems = { ...event.itemIds };
        const categoryItems = newSelectedItems[item.categoryId] || [];
        const isSelected = categoryItems.includes(item.id);

        if (isSelected) {
            newSelectedItems[item.categoryId] = categoryItems.filter(id => id !== item.id);
            if (newSelectedItems[item.categoryId].length === 0) {
                delete newSelectedItems[item.categoryId];
            }
        } else {
            if (rootCatInfo.currentCount >= rootCatInfo.maxItems) {
                alert(`You can only select up to ${rootCatInfo.maxItems} items from ${rootCatInfo.rootCat.name}.`);
                return;
            }
            newSelectedItems[item.categoryId] = [...categoryItems, item.id];
        }

        setEvent(prev => ({ ...prev, itemIds: newSelectedItems }));
    };

    const handleSaveRequest = () => {
        setTempInstructions(event.notes || '');
        setIsInstructionsModalOpen(true);
    };

    const handleFinalSave = () => {
        const finalEvent = { ...event, notes: tempInstructions };
        onSave(finalEvent);
        setIsInstructionsModalOpen(false);
    };

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
            {/* Top Bar: Title & Actions */}
            <div className="flex-shrink-0">
                <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                    <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                        {isReadOnly ? `Viewing Menu for: ${event.eventType}` : `Crafting Menu for: ${event.eventType}`}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setIsSummaryModalOpen(true)} className={secondaryButton}>
                            <Eye size={16} /> Preview Summary
                        </button>
                        <button onClick={onCancel} className={secondaryButton}>
                            <ArrowLeft size={16} /> Cancel
                        </button>
                        {!isReadOnly && (
                            <button onClick={handleSaveRequest} className={primaryButton}>
                                <Save size={18} /> Save Menu
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Item Selection Section */}
            {template ? (
            <div className="flex-grow flex gap-4 min-h-0">
                <nav className="w-48 flex-shrink-0 space-y-2">
                    {hierarchicalData.map(data => (
                        <button
                            key={data.rootCat.id}
                            onClick={() => setActiveRootCatId(data.rootCat.id)}
                            className={`w-full p-3 text-left rounded-lg font-semibold transition-colors ${activeRootCatId === data.rootCat.id ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300' : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-800'}`}
                        >
                            <div className="flex justify-between items-center">
                                <span>{data.rootCat.name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${data.currentCount > data.maxItems ? 'bg-red-200 text-red-800' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                    {data.currentCount}/{data.maxItems}
                                </span>
                            </div>
                        </button>
                    ))}
                </nav>
                <div className="flex-grow bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md overflow-y-auto">
                     {activeHierarchicalData && (
                        <div key={activeHierarchicalData.rootCat.id} className="space-y-4">
                            {sortedChildCatNames.map((childCatName) => {
                                const items = activeHierarchicalData.itemsByChild[childCatName];
                                if (!items) return null;
                                return (
                                    <div key={childCatName}>
                                        <h4 className="font-bold text-warm-gray-700 dark:text-warm-gray-300">{childCatName}</h4>
                                        <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {items.map(item => {
                                                const isSelected = (event.itemIds[item.categoryId] || []).includes(item.id);
                                                const isMaxReached = activeHierarchicalData.currentCount >= activeHierarchicalData.maxItems;
                                                const isDisabled = isReadOnly || (isMaxReached && !isSelected);

                                                return (
                                                    <li key={item.id}>
                                                        <label className={`flex items-start gap-3 p-2 rounded-md transition-colors w-full ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30'}`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleItemToggle(item, activeHierarchicalData)}
                                                                disabled={isDisabled}
                                                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-1 flex-shrink-0"
                                                            />
                                                            <div>
                                                                <span className="font-semibold text-warm-gray-800 dark:text-warm-gray-200">{item.name}</span>
                                                                <p className="text-xs text-warm-gray-500">{item.description}</p>
                                                            </div>
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            ) : (
                <div className="text-center py-10">
                    <p className="text-warm-gray-500">Please select an event with a valid template to begin.</p>
                </div>
            )}
             <Modal
                isOpen={isSummaryModalOpen}
                onClose={() => setIsSummaryModalOpen(false)}
                title="Event Summary"
                size="lg"
            >
                <div className="max-h-[70vh] overflow-y-auto">
                    <MenuSummary
                        event={event}
                        allItems={allItems}
                        allCategories={allCategories}
                        liveCounterMap={liveCounterMap}
                        liveCounterItemMap={liveCounterItemMap}
                        onRemoveItem={(item) => {
                            const rootCatInfo = hierarchicalData.find(d => d.childCatIds.includes(item.categoryId));
                            if (rootCatInfo) {
                                handleItemToggle(item, rootCatInfo);
                            }
                        }}
                        isReadOnly={isReadOnly}
                    />
                </div>
                 <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                    <button onClick={() => exportToPdfWithOptions(event, client, allItems, allCategories, liveCounters, liveCounterItems, 'elegance')} className={secondaryButton}><Palette size={16} className="text-amber-700"/> PDF (Elegance)</button>
                    <button onClick={() => exportToPdfWithOptions(event, client, allItems, allCategories, liveCounters, liveCounterItems, 'modern')} className={secondaryButton}><Palette size={16} className="text-red-500" /> PDF (Modern)</button>
                    <button onClick={() => exportToPdfWithOptions(event, client, allItems, allCategories, liveCounters, liveCounterItems, 'vibrant')} className={secondaryButton}><Palette size={16} className="text-green-600"/> PDF (Vibrant)</button>
                    <button onClick={() => exportToExcel(event, client, allItems, allCategories, liveCounters, liveCounterItems)} className={secondaryButton}><FileSpreadsheet size={16} className="text-green-600"/> Excel</button>
                </div>
            </Modal>
             <Modal
                isOpen={isInstructionsModalOpen}
                onClose={() => setIsInstructionsModalOpen(false)}
                title="Special Instructions"
            >
                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">
                        Add any special notes or instructions for this event.
                    </label>
                    <textarea
                        id="notes"
                        value={tempInstructions}
                        onChange={(e) => setTempInstructions(e.target.value)}
                        className={inputStyle + " min-h-[120px]"}
                    />
                    <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => setIsInstructionsModalOpen(false)} className={secondaryButton}>Cancel</button>
                        <button onClick={handleFinalSave} className={primaryButton}>Save</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
