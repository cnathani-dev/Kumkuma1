import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Event, Item, MenuTemplate, AppCategory, ItemType, LiveCounterItem, LiveCounter, Catalog, Client } from '../../types';
import { useItems, useTemplates, useAppCategories, useLiveCounters, useLiveCounterItems, useCatalogs } from '../../contexts/AppContexts';
import Modal from '../../components/Modal';
import { Save, X, Eye, Download, FileSpreadsheet, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { exportToPdf, exportToExcel } from '../../lib/export';
import { deepClone } from '../../lib/utils';
import { primaryButton, secondaryButton } from '../../components/common/styles';

const inputStyle = "mt-1 block w-full px-3 py-2 bg-white dark:bg-warm-gray-700 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-colors";

interface MenuSummaryProps {
  event: Event;
  allItems: Item[];
  allCategories: AppCategory[];
  liveCounterMap: Map<string, LiveCounter>;
  liveCounterItemMap: Map<string, LiveCounterItem>;
  onRemoveItem: (item: Item) => void;
  isReadOnly: boolean;
}

const groupItemsByCategory = (
    itemIds: Record<string, string[]> | undefined,
    itemMap: Map<string, Item>,
    categoryMap: Map<string, AppCategory>,
    allCategories: AppCategory[]
) => {
    if (!itemIds) return [];
    const groupedByCatName: Record<string, Item[]> = {};
    for (const catId in itemIds) {
        const category = categoryMap.get(catId);
        const items = (itemIds[catId] || [])
            .map(id => itemMap.get(id))
            .filter((i): i is Item => !!i);
        if (category && items.length > 0) {
            if (!groupedByCatName[category.name]) {
                groupedByCatName[category.name] = [];
            }
            groupedByCatName[category.name].push(...items);
        }
    }
    return Object.keys(groupedByCatName)
        .map(categoryName => ({ categoryName, category: allCategories.find(c => c.name === categoryName), items: groupedByCatName[categoryName] || [] }))
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
            items: group.items.slice().sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name))
        }));
};

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

    const previewItemsByCategory = useMemo(() => groupItemsByCategory(event.itemIds, itemMap, categoryMap, allCategories), [event.itemIds, itemMap, categoryMap, allCategories]);
    const previewCocktailItems = useMemo(() => groupItemsByCategory(event.cocktailMenuItems, itemMap, categoryMap, allCategories), [event.cocktailMenuItems, itemMap, categoryMap, allCategories]);
    const previewHiTeaItems = useMemo(() => groupItemsByCategory(event.hiTeaMenuItems, itemMap, categoryMap, allCategories), [event.hiTeaMenuItems, itemMap, categoryMap, allCategories]);

    const previewLiveCounters = useMemo(() => event.liveCounters ? Object.entries(event.liveCounters)
        .map(([counterId, itemIds]) => ({
            counter: liveCounterMap.get(counterId),
            items: (itemIds.map(id => liveCounterItemMap.get(id)).filter(Boolean) as LiveCounterItem[])
        }))
        .filter(group => group.counter && group.items.length > 0) : [], [event.liveCounters, liveCounterMap, liveCounterItemMap]);

    const renderItemGroup = (title: string, itemsByCategory: { category: string; items: Item[] }[]) => (
        <div className="space-y-4 border-t pt-4">
            <h3 className="font-bold text-lg text-warm-gray-700 dark:text-warm-gray-300">{title}</h3>
            {itemsByCategory.map(({ category, items }) => (
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
    );

    return (
        <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-inner flex flex-col">
            <h3 className="text-xl font-display font-bold text-primary-600 dark:text-primary-400 border-b pb-2 mb-4">
                Menu Summary
            </h3>
            <div className="flex-grow overflow-y-auto space-y-6 pr-2">
                {previewItemsByCategory.length > 0 && renderItemGroup("Main Menu", previewItemsByCategory)}
                {previewCocktailItems.length > 0 && renderItemGroup("Cocktail Menu", previewCocktailItems)}
                {previewHiTeaItems.length > 0 && renderItemGroup("Hi-Tea Menu", previewHiTeaItems)}
                
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

interface HierarchicalItemData {
  rootCat: AppCategory;
  maxItems: number;
  currentCount: number;
  parentItems: Item[];
  itemsByChild: Record<string, Item[]>;
  childCatIds: string[];
}

const useMenuData = (templateId: string | undefined, selectedItems: Record<string, string[]>) => {
    const { templates } = useTemplates();
    const { catalogs } = useCatalogs();
    const { items: allItems } = useItems();
    const { categories: allCategories } = useAppCategories();

    return useMemo(() => {
        if (!templateId) return { template: null, catalog: null, hierarchicalData: [] };
        const temp = templates.find(t => t.id === templateId);
        if (!temp) return { template: temp, catalog: null, hierarchicalData: [] };
        const cat = catalogs.find(c => c.id === temp.catalogId);
        if (!cat) return { template: temp, catalog: cat, hierarchicalData: [] };

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
                        visited.add(c.id); children.push(c.id); queue.push(c.id);
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
                const currentCount = descendantCatIds.reduce((sum, catId) => sum + (selectedItems[catId]?.length || 0), 0);
                const parentItems = Array.from(itemsMap.values()).filter(item => item.categoryId === rootCatId).sort((a,b)=>(a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
                const itemsByChild: Record<string, Item[]> = {};
                descendantCatIds.forEach(catId => {
                    if (catId === rootCatId) return;
                    const childCat = catMap.get(catId);
                    if (childCat && childCat.parentId === rootCatId) {
                         const itemsForThisCat = Array.from(itemsMap.values()).filter(item => item.categoryId === catId);
                         if(itemsForThisCat.length > 0){
                           itemsByChild[childCat.id] = itemsForThisCat.sort((a,b)=>(a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
                         }
                    }
                });
                return { rootCat, maxItems, currentCount, parentItems, itemsByChild, childCatIds: descendantCatIds };
            })
            .filter((d): d is HierarchicalItemData => !!d);
        
        const ruleCatIds = new Set(Object.keys(temp.rules || {}));
        const standardAccompanimentRootCats = allCategories.filter(c => c.isStandardAccompaniment && !c.parentId && !ruleCatIds.has(c.id));

        const standardAccompanimentData: HierarchicalItemData[] = standardAccompanimentRootCats.map(rootCat => {
            const descendantCatIds = getDescendantCats(rootCat.id);
            const itemsInCategory = descendantCatIds.flatMap(catId => cat.itemIds[catId] || []).map(id => itemsMap.get(id)).filter((i): i is Item => !!i);
            if (itemsInCategory.length === 0) return null;
            const currentCount = descendantCatIds.reduce((sum, catId) => sum + (selectedItems[catId]?.length || 0), 0);
            const parentItems = itemsInCategory.filter(item => item.categoryId === rootCat.id).sort((a,b)=>(a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
            const itemsByChild: Record<string, Item[]> = {};
            itemsInCategory.forEach(item => {
                const childCat = catMap.get(item.categoryId);
                if (childCat && childCat.id !== rootCat.id) {
                     if (!itemsByChild[childCat.id]) itemsByChild[childCat.id] = [];
                    itemsByChild[childCat.id].push(item);
                }
            });
            for(const catId in itemsByChild){
                itemsByChild[catId].sort((a,b)=>(a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
            }
            return { rootCat, maxItems: itemsInCategory.length, currentCount, parentItems, itemsByChild, childCatIds: descendantCatIds };
        }).filter((d): d is HierarchicalItemData => !!d);

        const combinedData = [...data, ...standardAccompanimentData].sort((a, b) => (a.rootCat.displayRank ?? Infinity) - (b.rootCat.displayRank ?? Infinity) || a.rootCat.name.localeCompare(b.rootCat.name));

        return { template: temp, catalog: cat, hierarchicalData: combinedData };
    }, [templateId, selectedItems, templates, catalogs, allItems, allCategories]);
};

const TemplateItemsSelector = ({ templateId, selectedItems, onItemsUpdate, isReadOnly, muttonLimitReached, templateName }: {
    templateId: string | undefined;
    selectedItems: Record<string, string[]>;
    onItemsUpdate: (newSelectedItems: Record<string, string[]>) => void;
    isReadOnly: boolean;
    muttonLimitReached: boolean;
    templateName: string;
}) => {
    const { template, hierarchicalData } = useMenuData(templateId, selectedItems);
    const { categories: allCategories } = useAppCategories();
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

    useEffect(() => {
        if (hierarchicalData.length > 0 && !activeCategoryId) {
            setActiveCategoryId(hierarchicalData[0].rootCat.id);
        }
    }, [hierarchicalData, activeCategoryId]);

    const handleItemToggle = (item: Item, rootCatInfo: HierarchicalItemData) => {
        if (isReadOnly) return;
        const newSelectedItems = deepClone(selectedItems);
        const categoryItems = newSelectedItems[item.categoryId] || [];
        const isSelected = categoryItems.includes(item.id);

        if (isSelected) {
            newSelectedItems[item.categoryId] = categoryItems.filter(id => id !== item.id);
            if (newSelectedItems[item.categoryId].length === 0) delete newSelectedItems[item.categoryId];
        } else {
            if (rootCatInfo.currentCount >= rootCatInfo.maxItems && !rootCatInfo.rootCat.isStandardAccompaniment) {
                alert(`You can only select up to ${rootCatInfo.maxItems} items from ${rootCatInfo.rootCat.name}.`);
                return;
            }
            if (muttonLimitReached && item.type === 'mutton') {
                 alert(`You can select a maximum of ${template?.muttonRules} mutton items in total for this menu.`);
                 return;
            }
            newSelectedItems[item.categoryId] = [...categoryItems, item.id];
        }
        onItemsUpdate(newSelectedItems);
    };

    return (
        <>
            <nav className="w-64 flex-shrink-0 bg-white dark:bg-warm-gray-800 p-2 rounded-lg shadow-md overflow-y-auto">
                <ul className="space-y-1">
                    {hierarchicalData.map(data => (
                        <li key={data.rootCat.id}>
                            <button
                                onClick={() => setActiveCategoryId(data.rootCat.id)}
                                className={`w-full p-2 text-left rounded-md font-semibold transition-colors text-sm flex justify-between items-center ${activeCategoryId === data.rootCat.id ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300' : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700'}`}
                            >
                                <span>{data.rootCat.name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${data.currentCount > data.maxItems ? 'bg-red-200 text-red-800' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                    {data.currentCount}/{data.maxItems}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="flex-grow bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md overflow-y-auto">
                {(() => {
                    if (!activeCategoryId) return <div className="text-center py-10 text-warm-gray-500">Select a category from the left.</div>;
                    const activeHierarchicalData = hierarchicalData.find(d => d.rootCat.id === activeCategoryId);
                    if (!activeHierarchicalData) return <p>Category not found.</p>;
                    
                    const categoryMap = new Map(allCategories.map(c => [c.id, c]));
                    const renderItemList = (items: Item[], rootCatInfo: HierarchicalItemData) => (
                        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {items.map(item => {
                                const isSelected = (selectedItems[item.categoryId] || []).includes(item.id);
                                const isMaxReached = !rootCatInfo.rootCat.isStandardAccompaniment && rootCatInfo.currentCount >= rootCatInfo.maxItems;
                                const isDisabled = isReadOnly || (isMaxReached && !isSelected) || (muttonLimitReached && item.type === 'mutton' && !isSelected);

                                return (
                                    <li key={item.id}>
                                        <label className={`flex items-start gap-3 p-2 rounded-md transition-colors w-full ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30'}`}>
                                            <input type="checkbox" checked={isSelected} onChange={() => handleItemToggle(item, rootCatInfo)} disabled={isDisabled} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mt-1 flex-shrink-0"/>
                                            <div><span className="font-semibold text-warm-gray-800 dark:text-warm-gray-200">{item.name}</span><p className="text-xs text-warm-gray-500">{item.description}</p></div>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    );
                        const sortedChildCatGroups = Object.keys(activeHierarchicalData.itemsByChild)
                        .map(id => categoryMap.get(id)).filter((c): c is AppCategory => !!c)
                        .sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));

                    return (
                        <div className="space-y-4">
                            <div className="flex justify-between items-baseline"><h3 className="text-xl font-bold">{activeHierarchicalData.rootCat.name}</h3><span className={`px-2 py-0.5 rounded-full text-sm font-semibold ${activeHierarchicalData.currentCount > activeHierarchicalData.maxItems ? 'bg-red-200 text-red-800' : 'bg-gray-200 dark:bg-gray-700'}`}>{activeHierarchicalData.currentCount}/{activeHierarchicalData.maxItems}</span></div>
                            {activeHierarchicalData.parentItems.length > 0 && renderItemList(activeHierarchicalData.parentItems, activeHierarchicalData)}
                            {sortedChildCatGroups.map(childCat => {
                                const items = activeHierarchicalData.itemsByChild[childCat.id];
                                if (!items) return null;
                                return (<div key={childCat.id}><h4 className="font-bold text-warm-gray-700 dark:text-warm-gray-300 mt-4 pt-2 border-t">{childCat.name}</h4>{renderItemList(items, activeHierarchicalData)}</div>);
                            })}
                        </div>
                    );
                })()}
            </div>
        </>
    );
};

interface MenuCreatorProps {
  initialEvent: Event;
  client: Client;
  onSave: (event: Event) => void;
  onCancel: () => void;
}

const TabButton = ({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
            active
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700 hover:border-warm-gray-300'
        }`}
    >
        {children}
    </button>
);

export default function MenuCreator({ initialEvent, client, onSave, onCancel }: MenuCreatorProps): React.ReactElement {
    const { items: allItems } = useItems();
    const { categories: allCategories } = useAppCategories();
    const { liveCounters: allLiveCounters } = useLiveCounters();
    const { liveCounterItems } = useLiveCounterItems();
    const { templates } = useTemplates();

    const [event, setEvent] = useState<Event>(() => deepClone(initialEvent));
    const isReadOnly = useMemo(() => event.status === 'finalized' || event.state === 'lost' || event.state === 'cancelled', [event.status, event.state]);

    const cocktailCharge = useMemo(() => event.charges?.find(c => !c.isDeleted && c.type === 'Cocktail Menu'), [event.charges]);
    const hiTeaCharge = useMemo(() => event.charges?.find(c => !c.isDeleted && c.type === 'Hi-Tea Menu'), [event.charges]);
    
    const [activeTab, setActiveTab] = useState<'main' | 'live' | 'cocktail' | 'hightea'>('main');
    const [activeLiveCounterId, setActiveLiveCounterId] = useState<string | null>(null);

    const liveCounterCharges = useMemo(() => event.charges?.filter(c => !c.isDeleted && c.type === 'Live Counter' && c.liveCounterId) || [], [event.charges]);
    const chargedLiveCounterIds = useMemo(() => new Set(liveCounterCharges.map(c => c.liveCounterId)), [liveCounterCharges]);
    const sortedLiveCounters = useMemo(() => allLiveCounters.slice().sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)), [allLiveCounters]);

    useEffect(() => {
        if (activeTab === 'live' && sortedLiveCounters.length > 0 && !activeLiveCounterId) {
            setActiveLiveCounterId(sortedLiveCounters[0].id);
        }
    }, [activeTab, sortedLiveCounters, activeLiveCounterId]);

    const mainTemplate = useMemo(() => templates.find(t => t.id === event.templateId), [templates, event.templateId]);
    const cocktailTemplate = useMemo(() => templates.find(t => t.id === cocktailCharge?.menuTemplateId), [templates, cocktailCharge]);
    const hiTeaTemplate = useMemo(() => templates.find(t => t.id === hiTeaCharge?.menuTemplateId), [templates, hiTeaCharge]);

    const muttonLimitReached = (template: MenuTemplate | undefined, items: Record<string, string[]>) => {
        if (!template?.muttonRules || template.muttonRules <= 0) return false;
        const allSelectedIds = Object.values(items || {}).flat();
        const currentMuttonCount = allItems
            .filter(i => allSelectedIds.includes(i.id) && i.type === 'mutton')
            .length;
        return currentMuttonCount >= template.muttonRules;
    };

    const handleLiveCounterItemToggle = (counterId: string, itemId: string) => {
        if (isReadOnly) return;
        const newEvent = deepClone(event);
        const liveCountersSelection = newEvent.liveCounters || {};
        const currentCounterItems = liveCountersSelection[counterId] || [];
        const isSelected = currentCounterItems.includes(itemId);
        const counter = allLiveCounters.find(c => c.id === counterId);

        if (isSelected) {
            liveCountersSelection[counterId] = currentCounterItems.filter(id => id !== itemId);
        } else {
            if (counter && currentCounterItems.length >= counter.maxItems) {
                alert(`You can only select up to ${counter.maxItems} items for ${counter.name}.`);
                return;
            }
            liveCountersSelection[counterId] = [...currentCounterItems, itemId];
        }
        newEvent.liveCounters = liveCountersSelection;
        setEvent(newEvent);
    };

    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const [tempInstructions, setTempInstructions] = useState(event.notes || '');

    const handleGenericRemoveItem = (itemToRemove: Item) => {
        if (isReadOnly) return;
        const newEvent = deepClone(event);
        let updated = false;
        (['itemIds', 'cocktailMenuItems', 'hiTeaMenuItems'] as const).forEach(key => {
            if (updated) return;
            const menu = newEvent[key];
            if (menu && menu[itemToRemove.categoryId]?.includes(itemToRemove.id)) {
                menu[itemToRemove.categoryId] = menu[itemToRemove.categoryId].filter(id => id !== itemToRemove.id);
                if (menu[itemToRemove.categoryId].length === 0) delete menu[itemToRemove.categoryId];
                updated = true;
            }
        });
        if(updated) setEvent(newEvent);
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
            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className={secondaryButton}><ArrowLeft size={20}/></button>
                    <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                        {isReadOnly ? `Viewing Menu for: ${event.eventType}` : `Crafting Menu for: ${event.eventType}`}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsSummaryModalOpen(true)} className={secondaryButton}><Eye size={16} /> Preview Summary</button>
                    {!isReadOnly && <button onClick={handleSaveRequest} className={primaryButton}><Save size={18} /> Save Menu</button>}
                </div>
            </div>

            <div className="border-b border-warm-gray-200 dark:border-warm-gray-700 flex-shrink-0">
                 <nav className="-mb-px flex space-x-8">
                    <TabButton active={activeTab === 'main'} onClick={() => setActiveTab('main')}>Main Menu</TabButton>
                    <TabButton active={activeTab === 'live'} onClick={() => setActiveTab('live')}>Live Counters</TabButton>
                    {cocktailCharge && <TabButton active={activeTab === 'cocktail'} onClick={() => setActiveTab('cocktail')}>Cocktail Menu</TabButton>}
                    {hiTeaCharge && <TabButton active={activeTab === 'hightea'} onClick={() => setActiveTab('hightea')}>Hi-Tea Menu</TabButton>}
                </nav>
            </div>

            <div className="flex-grow flex gap-6 min-h-0">
                {activeTab === 'main' && (
                    <TemplateItemsSelector
                        templateId={event.templateId}
                        selectedItems={event.itemIds}
                        onItemsUpdate={(newItems) => setEvent(e => ({ ...e, itemIds: newItems }))}
                        isReadOnly={isReadOnly}
                        muttonLimitReached={muttonLimitReached(mainTemplate, event.itemIds)}
                        templateName="Main Menu"
                    />
                )}
                {activeTab === 'cocktail' && cocktailCharge?.menuTemplateId && (
                    <TemplateItemsSelector
                        templateId={cocktailCharge.menuTemplateId}
                        selectedItems={event.cocktailMenuItems || {}}
                        onItemsUpdate={(newItems) => setEvent(e => ({ ...e, cocktailMenuItems: newItems }))}
                        isReadOnly={isReadOnly}
                        muttonLimitReached={muttonLimitReached(cocktailTemplate, event.cocktailMenuItems || {})}
                        templateName="Cocktail Menu"
                    />
                )}
                {activeTab === 'hightea' && hiTeaCharge?.menuTemplateId && (
                     <TemplateItemsSelector
                        templateId={hiTeaCharge.menuTemplateId}
                        selectedItems={event.hiTeaMenuItems || {}}
                        onItemsUpdate={(newItems) => setEvent(e => ({ ...e, hiTeaMenuItems: newItems }))}
                        isReadOnly={isReadOnly}
                        muttonLimitReached={muttonLimitReached(hiTeaTemplate, event.hiTeaMenuItems || {})}
                        templateName="Hi-Tea Menu"
                    />
                )}
                {activeTab === 'live' && (
                     <>
                        <nav className="w-64 flex-shrink-0 bg-white dark:bg-warm-gray-800 p-2 rounded-lg shadow-md overflow-y-auto">
                             <ul className="space-y-1">
                                {sortedLiveCounters.map(counter => (
                                    <li key={counter.id}>
                                        <button
                                            onClick={() => setActiveLiveCounterId(counter.id)}
                                            className={`w-full p-2 text-left rounded-md font-semibold transition-colors text-sm flex justify-between items-center ${activeLiveCounterId === counter.id ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300' : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700'}`}
                                        >
                                            <span>{counter.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                        <div className="flex-grow bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md overflow-y-auto">
                           {(() => {
                                if (!activeLiveCounterId) return <div className="text-center py-10 text-warm-gray-500">Select a counter from the left.</div>;
                                const counter = sortedLiveCounters.find(lc => lc.id === activeLiveCounterId);
                                if (!counter) return <p>Live counter not found.</p>;

                                const items = liveCounterItems.filter(lci => lci.liveCounterId === counter.id).sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
                                const selected = event.liveCounters?.[counter.id] || [];
                                const isEnabled = chargedLiveCounterIds.has(counter.id);

                                return (
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-lg">{counter.name} <span className="text-sm font-normal text-warm-gray-500">({selected.length}/{counter.maxItems})</span></h3>
                                        {!isEnabled && !isReadOnly && (<div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-md text-sm text-amber-800 dark:text-amber-200">This counter is not enabled. Please add it as a charge in the 'Finances' section to select items.</div>)}
                                        <div className="mt-2 space-y-2">
                                            {items.map(item => (
                                                <label key={item.id} className={`flex items-start gap-2 p-2 rounded-md ${!isReadOnly && isEnabled ? 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30' : 'opacity-70 cursor-not-allowed'}`}>
                                                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => handleLiveCounterItemToggle(counter.id, item.id)} disabled={isReadOnly || !isEnabled || (!selected.includes(item.id) && selected.length >= counter.maxItems)} className="h-4 w-4 mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0" />
                                                    <div><p>{item.name}</p>{item.description && <p className="text-xs text-warm-gray-500">{item.description}</p>}</div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                );
                           })()}
                        </div>
                    </>
                )}
            </div>

            <Modal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} title="Event Summary" size="lg">
                <div className="max-h-[70vh] overflow-y-auto">
                    <MenuSummary event={event} allItems={allItems} allCategories={allCategories} liveCounterMap={new Map(allLiveCounters.map(lc => [lc.id, lc]))} liveCounterItemMap={new Map(liveCounterItems.map(lci => [lci.id, lci]))} onRemoveItem={handleGenericRemoveItem} isReadOnly={isReadOnly}/>
                </div>
                 <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                    <button onClick={() => exportToPdf(event, client, allItems, allCategories, allLiveCounters, liveCounterItems)} className={secondaryButton}><Download size={16}/> Download PDF</button>
                    <button onClick={() => exportToExcel(event, client, allItems, allCategories, allLiveCounters, liveCounterItems)} className={secondaryButton}><FileSpreadsheet size={16} className="text-green-600"/> Excel</button>
                </div>
            </Modal>
            <Modal isOpen={isInstructionsModalOpen} onClose={() => setIsInstructionsModalOpen(false)} title="Special Instructions">
                <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Add any special notes or instructions for this event.</label>
                    <textarea id="notes" value={tempInstructions} onChange={(e) => setTempInstructions(e.target.value)} className={inputStyle + " min-h-[120px]"}/>
                    <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => setIsInstructionsModalOpen(false)} className={secondaryButton}>Cancel</button>
                        <button onClick={handleFinalSave} className={primaryButton}>Save</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};