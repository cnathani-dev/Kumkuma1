





import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Catalog, Item, AppCategory, ItemType } from '../../types';
import { useCatalogs, useItems, useAppCategories } from '../../contexts/AppContexts';
import { primaryButton, secondaryButton, dangerButton, inputStyle, iconButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, Save, X, Leaf, Egg, Beef, Shrimp, Fish, Drumstick, Copy, ArrowLeft } from 'lucide-react';
import { CategoryTree } from '../../components/CategoryTree';

interface CatalogManagerProps {
    canModify: boolean;
    onAddClick: () => void;
    onEditClick: (catalog: Catalog) => void;
}

export const CatalogManager: React.FC<CatalogManagerProps> = ({ canModify, onAddClick, onEditClick }) => {
    const { catalogs, addCatalog, deleteCatalog, updateCatalogGroup } = useCatalogs();

    const groupedCatalogs = useMemo(() => {
        const groups: Record<string, Catalog[]> = {};
        catalogs.forEach(catalog => {
            const groupName = catalog.group || 'Uncategorized';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(catalog);
        });
        // Sort catalogs within each group
        Object.values(groups).forEach(group => group.sort((a, b) => a.name.localeCompare(b.name)));
        return groups;
    }, [catalogs]);

    const sortedGroupNames = useMemo(() => Object.keys(groupedCatalogs).sort(), [groupedCatalogs]);

    const handleDelete = async (catalogId: string) => {
        if (window.confirm("Are you sure you want to delete this catalog? This action cannot be undone.")) {
            try {
                await deleteCatalog(catalogId);
            } catch (error) {
                alert(`Error deleting catalog: ${error}`);
            }
        }
    };

    const handleCopy = async (catalogToCopy: Catalog) => {
        const { id, ...restOfCatalog } = catalogToCopy;
        const newCatalogData: Omit<Catalog, 'id'> = {
            ...restOfCatalog,
            name: `Copy of ${catalogToCopy.name}`
        };
        try {
            const newId = await addCatalog(newCatalogData);
            onEditClick({ ...newCatalogData, id: newId });
        } catch (error) {
            console.error("Failed to copy catalog:", error);
            alert("Could not copy the catalog.");
        }
    };

    const handleRenameGroup = (oldName: string) => {
        if (!canModify) return;
        const newName = window.prompt(`Rename group "${oldName}" to:`, oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
            updateCatalogGroup(oldName, newName.trim());
        }
    };
    

    return (
        <div className="space-y-6">
            <div className="flex justify-end items-center">
                {canModify && 
                    <div className="flex items-center gap-2">
                        <button onClick={onAddClick} className={primaryButton}><Plus size={16}/> Add Catalog</button>
                    </div>
                }
            </div>
            
            <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
                {sortedGroupNames.length === 0 ? (
                    <p className="text-center py-8 text-warm-gray-500">No catalogs created yet.</p>
                ) : (
                    sortedGroupNames.map(groupName => (
                        <div key={groupName} className="mb-6 last:mb-0">
                            <div className="flex items-center gap-2 p-2 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-md mb-2">
                                <h4 className="text-xl font-semibold text-primary-600 dark:text-primary-400">{groupName}</h4>
                                {canModify && (
                                    <button onClick={() => handleRenameGroup(groupName)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Rename Group">
                                        <Edit size={14} className="text-primary-600"/>
                                    </button>
                                )}
                            </div>
                            <ul className="pl-4 divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                                {groupedCatalogs[groupName].map(catalog => (
                                    <li key={catalog.id} className="py-3 flex justify-between items-center">
                                        <div className="flex-grow cursor-pointer" onClick={() => onEditClick(catalog)}>
                                            <p className="font-bold">{catalog.name}</p>
                                            <p className="text-sm text-warm-gray-500">{catalog.description}</p>
                                        </div>
                                        {canModify &&
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => handleCopy(catalog)} className={iconButton('hover:bg-blue-100 dark:hover:bg-blue-800')} title="Copy Catalog">
                                                    <Copy size={16} className="text-blue-600" />
                                                </button>
                                                <button onClick={() => onEditClick(catalog)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Catalog">
                                                    <Edit size={16} className="text-primary-600" />
                                                </button>
                                                <button onClick={() => handleDelete(catalog.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Catalog">
                                                    <Trash2 size={16} className="text-accent-500" />
                                                </button>
                                            </div>
                                        }
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const ItemTypeIcon = ({ type }: { type?: ItemType }) => {
    if (!type) return null;
    switch (type) {
        case 'veg':
            return <span title="Veg"><Leaf size={14} className="text-green-600 flex-shrink-0" /></span>;
        case 'egg':
            return <span title="Egg"><Egg size={14} className="text-amber-600 flex-shrink-0" /></span>;
        case 'chicken':
        case 'natukodi':
            return <span title="Chicken"><Drumstick size={14} className="text-orange-600 flex-shrink-0" /></span>;
        case 'mutton':
            return <span title="Mutton"><Beef size={14} className="text-red-600 flex-shrink-0" /></span>;
        case 'prawns':
            return <span title="Prawns"><Shrimp size={14} className="text-pink-600 flex-shrink-0" /></span>;
        case 'fish':
            return <span title="Fish"><Fish size={14} className="text-blue-600 flex-shrink-0" /></span>;
        case 'crab':
            return <span title="Crab"><Shrimp size={14} className="text-red-500 flex-shrink-0" /></span>;
        default:
            return null;
    }
};

const CategoryItemGroup = ({ category, items, selectedItemIds, onToggleCategory, onToggleItem, isReadOnly }: {
    category: AppCategory;
    items: Item[];
    selectedItemIds: Set<string>;
    onToggleCategory: (itemsToToggle: Item[], shouldSelect: boolean) => void;
    onToggleItem: (itemId: string) => void;
    isReadOnly: boolean;
}) => {
    const checkboxRef = useRef<HTMLInputElement>(null);
    const selectedCount = useMemo(() => items.filter(item => selectedItemIds.has(item.id)).length, [items, selectedItemIds]);
    
    const allSelected = selectedCount === items.length && items.length > 0;
    const someSelected = selectedCount > 0 && !allSelected;

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = someSelected;
        }
    }, [someSelected]);

    return (
        <div>
            <div className="flex items-center gap-3 p-2 bg-warm-gray-50 dark:bg-warm-gray-700/50 rounded-t-md border-b border-warm-gray-200 dark:border-warm-gray-600">
                <input
                    ref={checkboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleCategory(items, !allSelected)}
                    disabled={isReadOnly || items.length === 0}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <h4 className="font-bold">{category.name}</h4>
            </div>
            <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {items.map(item => (
                    <li key={item.id} className="py-1">
                        <label className={`flex items-center gap-3 p-2 rounded-md ${isReadOnly ? '' : 'hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50 cursor-pointer'}`}>
                            <input
                                type="checkbox"
                                checked={selectedItemIds.has(item.id)}
                                onChange={() => onToggleItem(item.id)}
                                disabled={isReadOnly}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div className="flex-grow flex items-center gap-2">
                                <span>{item.name}</span>
                                <ItemTypeIcon type={item.type} />
                            </div>
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    );
};

interface CatalogEditorProps {
    catalog: Catalog | Partial<Catalog>;
    onCancel: () => void;
    isReadOnly: boolean;
}

export const CatalogEditor: React.FC<CatalogEditorProps> = ({ catalog, onCancel, isReadOnly }) => {
    const { catalogs, addCatalog, updateCatalog } = useCatalogs();
    const { items: allItems } = useItems();
    const { categories } = useAppCategories();
    
    const [name, setName] = useState(catalog?.name || '');
    const [description, setDescription] = useState(catalog?.description || '');
    const [group, setGroup] = useState(catalog?.group || '');
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => {
        const ids = catalog?.itemIds ? Object.values(catalog.itemIds).flat() : [];
        return new Set(ids);
    });
    
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    const catalogGroups = useMemo(() => Array.from(new Set(catalogs.map(c => c.group).filter(Boolean))), [catalogs]);

    const itemsInCategory = useMemo(() => {
        if (!selectedCategoryId) return [];
        
        const descendantIds = new Set<string>();
        const getDescendants = (id: string) => {
            descendantIds.add(id);
            categories.filter(c => c.parentId === id).forEach(child => getDescendants(child.id));
        };
        getDescendants(selectedCategoryId);

        return allItems.filter(item => descendantIds.has(item.categoryId))
            .sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
    }, [allItems, selectedCategoryId, categories]);

    const groupedItemsByCategory = useMemo(() => {
        if (!itemsInCategory.length) return [];
        const categoryMap = new Map(categories.map(c => [c.id, c]));
        
        const groups: Record<string, { category: AppCategory, items: Item[] }> = {};

        itemsInCategory.forEach(item => {
            const category = categoryMap.get(item.categoryId);
            if (category) {
                if (!groups[category.id]) {
                    groups[category.id] = { category, items: [] };
                }
                groups[category.id].items.push(item);
            }
        });

        return Object.values(groups).sort((a, b) => {
            return (a.category.displayRank ?? Infinity) - (b.category.displayRank ?? Infinity) || a.category.name.localeCompare(b.category.name);
        });

    }, [itemsInCategory, categories]);

    const handleToggleItem = (itemId: string) => {
        if (isReadOnly) return;
        setSelectedItemIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const handleToggleCategoryItems = (itemsToToggle: Item[], shouldSelect: boolean) => {
        if (isReadOnly) return;
        setSelectedItemIds(prev => {
            const newSet = new Set(prev);
            if (shouldSelect) {
                itemsToToggle.forEach(item => newSet.add(item.id));
            } else {
                itemsToToggle.forEach(item => newSet.delete(item.id));
            }
            return newSet;
        });
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) return;

        const itemMap = new Map(allItems.map(i => [i.id, i]));
        const itemIdsByCat: Record<string, string[]> = {};
        
        selectedItemIds.forEach(id => {
            const item = itemMap.get(id);
            if (item) {
                if (!itemIdsByCat[item.categoryId]) {
                    itemIdsByCat[item.categoryId] = [];
                }
                if (!itemIdsByCat[item.categoryId].includes(item.id)) {
                    itemIdsByCat[item.categoryId].push(id);
                }
            }
        });

        const catalogData = { name, description, group, itemIds: itemIdsByCat };

        try {
            if ('id' in catalog) {
                await updateCatalog({ ...catalog, ...catalogData } as Catalog);
            } else {
                await addCatalog(catalogData);
            }
            onCancel();
        } catch(e) {
            alert(`Error saving catalog: ${e}`);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button type="button" onClick={onCancel} className={iconButton('hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700')}><ArrowLeft size={20}/></button>
                    <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                        {isReadOnly ? 'View Catalog' : ('id' in catalog ? 'Edit Catalog' : 'Create New Catalog')}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {!isReadOnly && <button type="submit" className={primaryButton}><Save size={18}/> Save Catalog</button>}
                </div>
            </div>

            <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md space-y-4 flex-shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Catalog Name" value={name} onChange={e => setName(e.target.value)} required readOnly={isReadOnly} className={inputStyle} />
                    <input type="text" placeholder="Group (e.g., Wedding, Corporate)" value={group} onChange={e => setGroup(e.target.value)} readOnly={isReadOnly} className={inputStyle} list="catalog-groups" />
                    <datalist id="catalog-groups">
                        {catalogGroups.map(g => <option key={g} value={g} />)}
                    </datalist>
                </div>
                <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} readOnly={isReadOnly} className={inputStyle} rows={2} />
            </div>

            <div className="flex-grow flex gap-6 min-h-0">
                <div className="w-1/3 bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md overflow-y-auto">
                     <h3 className="font-bold text-lg mb-4">Categories</h3>
                    <CategoryTree 
                        categories={categories}
                        onSelect={(id) => setSelectedCategoryId(id)}
                        onEdit={()=>{}}
                        onDelete={()=>{}}
                        onMerge={() => {}}
                        onReorder={() => {}}
                        selectedId={selectedCategoryId}
                        canModify={false}
                    />
                </div>
                 <div className="w-2/3 bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md flex flex-col">
                    <div className="flex justify-between items-center mb-4 flex-shrink-0">
                         <h3 className="font-bold text-lg">
                            {selectedCategoryId ? `Items in "${categories.find(c=>c.id === selectedCategoryId)?.name}"` : 'Items'}
                         </h3>
                         <p className="text-sm text-warm-gray-500">{selectedItemIds.size} items selected in total</p>
                    </div>
                    <div className="overflow-y-auto">
                        {!selectedCategoryId ? (
                            <p className="text-center py-10 text-warm-gray-500">Select a category to view its items.</p>
                        ) : groupedItemsByCategory && groupedItemsByCategory.length === 0 ? (
                            <p className="text-center py-10 text-warm-gray-500">No items in this category.</p>
                        ) : (
                            <div className="space-y-4">
                                {groupedItemsByCategory && groupedItemsByCategory.map(({ category, items: categoryItems }) => (
                                    <CategoryItemGroup
                                        key={category.id}
                                        category={category}
                                        items={categoryItems}
                                        selectedItemIds={selectedItemIds}
                                        onToggleCategory={handleToggleCategoryItems}
                                        onToggleItem={handleToggleItem}
                                        isReadOnly={isReadOnly}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
};