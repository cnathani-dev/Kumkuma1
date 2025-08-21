import React, { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useItems, useAppCategories } from '../../contexts/AppContexts';
import { Item, AppCategory, ItemType, PermissionLevel } from '../../types';
import Modal from '../../components/Modal';
import { primaryButton, secondaryButton, inputStyle, iconButton, dangerButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, Save, X, GripVertical, ListOrdered, ArrowUpAZ, ArrowDownAZ, Merge, Move, Leaf, Egg, Beef, Shrimp, Fish, Drumstick } from 'lucide-react';
import { generateCategoryOptions } from '../../lib/ui-helpers';
import { CategoryTree } from '../../components/CategoryTree';
import { ServiceArticleAssignment } from './ServiceArticleAssignment';
import { CookingEstimates } from './CookingEstimates';
import { ItemAccompanimentAssignment } from './ItemAccompanimentAssignment';

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
        case 'other':
        default:
            return null;
    }
};

type ModalState = 
    | { type: 'category', data: AppCategory | Partial<AppCategory> | null }
    | { type: 'item', data: Item | null };

const itemTypes: ItemType[] = ['veg', 'chicken', 'mutton', 'egg', 'prawns', 'fish', 'natukodi', 'other'];

const MergeCategoryModal = ({ sourceCategory, allCategories, onCancel, onConfirm, destinationId, setDestinationId }: {
    sourceCategory: AppCategory,
    allCategories: AppCategory[],
    onCancel: () => void,
    onConfirm: () => void,
    destinationId: string,
    setDestinationId: (id: string) => void,
}) => {
    
    const getDescendantIds = useMemo(() => {
        const map = new Map<string, string[]>();
        allCategories.forEach(c => {
            if (c.parentId) {
                if (!map.has(c.parentId)) map.set(c.parentId, []);
                map.get(c.parentId)!.push(c.id);
            }
        });

        return (rootId: string): Set<string> => {
            const descendants = new Set<string>();
            const queue = [rootId];
            while (queue.length > 0) {
                const current = queue.shift()!;
                descendants.add(current);
                const children = map.get(current) || [];
                queue.push(...children);
            }
            return descendants;
        };
    }, [allCategories]);

    const invalidDestinationIds = useMemo(() => {
        return getDescendantIds(sourceCategory.id);
    }, [sourceCategory, getDescendantIds]);

    const validDestinations = useMemo(() => {
        return allCategories.filter(cat => !invalidDestinationIds.has(cat.id));
    }, [allCategories, invalidDestinationIds]);

    const destinationOptions = useMemo(() => generateCategoryOptions(validDestinations), [validDestinations]);

    return (
        <div className="space-y-4">
            <p>You are about to merge the category <strong className="text-primary-600">"{sourceCategory.name}"</strong> into another category. All of its items and sub-categories will be moved.</p>
            <div>
                <label htmlFor="destination-category" className="block text-sm font-medium">Destination Category</label>
                <select 
                    id="destination-category"
                    value={destinationId}
                    onChange={(e) => setDestinationId(e.target.value)}
                    className={inputStyle}
                >
                    <option value="">-- Select a category to merge into --</option>
                    {destinationOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="button" onClick={onConfirm} className={primaryButton} disabled={!destinationId}>Confirm Merge</button>
            </div>
        </div>
    );
};

interface ItemGroup {
    category: AppCategory;
    items: Item[];
    isSubCategory: boolean;
}

export const ItemManager = ({ permissions }: { permissions: PermissionLevel }) => {
    const { items, addItem, updateItem, deleteItem, updateMultipleItems, deleteMultipleItems, moveMultipleItems, batchUpdateItemType, batchUpdateItemNames } = useItems();
    const { categories, addCategory, updateCategory, deleteCategory, updateMultipleCategories, mergeCategory } = useAppCategories();

    const [modalState, setModalState] = useState<ModalState | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'items' | 'service' | 'estimates' | 'accompaniments'>('items');
    const [itemFilter, setItemFilter] = useState('');
    const [sortOrder, setSortOrder] = useState<'rank' | 'asc' | 'desc'>('rank');
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [destinationCategoryId, setDestinationCategoryId] = useState('');
    
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

    const [mergeState, setMergeState] = useState<{source: AppCategory, destinationId: string} | null>(null);
    const [newTypeForBatch, setNewTypeForBatch] = useState<ItemType>('veg');
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');

    const canModify = permissions === 'modify';

    useEffect(() => {
        setItemFilter('');
        setSortOrder('rank'); // Reset sort when category changes
        setSelectedItemIds(new Set()); // Clear selection when category changes
    }, [selectedCategoryId]);

    const itemGroups = useMemo((): ItemGroup[] => {
        if (!selectedCategoryId) return [];

        const selectedCategory = categories.find(c => c.id === selectedCategoryId);
        if (!selectedCategory) return [];

        const directSubCategories = categories
            .filter(c => c.parentId === selectedCategoryId)
            .sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));

        const processItems = (itemList: Item[]) => {
            let filtered = itemList;
            if (itemFilter) {
                const lowerCaseFilter = itemFilter.toLowerCase();
                filtered = filtered.filter(item =>
                    item.name.toLowerCase().includes(lowerCaseFilter) ||
                    (item.description && item.description.toLowerCase().includes(lowerCaseFilter))
                );
            }
            
            const sorted = [...filtered];
            if (sortOrder === 'asc') {
                sorted.sort((a, b) => a.name.localeCompare(b.name));
            } else if (sortOrder === 'desc') {
                sorted.sort((a, b) => b.name.localeCompare(a.name));
            } else { // 'rank'
                sorted.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
            }
            return sorted;
        };
        
        const groups: ItemGroup[] = [];
        
        const parentItems = items.filter(i => i.categoryId === selectedCategoryId);
        const processedParentItems = processItems(parentItems);
        
        if (processedParentItems.length > 0) {
            groups.push({
                category: selectedCategory,
                items: processedParentItems,
                isSubCategory: false,
            });
        }
        
        directSubCategories.forEach(subCat => {
            const subCatItems = items.filter(i => i.categoryId === subCat.id);
            const processedSubCatItems = processItems(subCatItems);
            
            if (processedSubCatItems.length > 0) {
                groups.push({
                    category: subCat,
                    items: processedSubCatItems,
                    isSubCategory: true,
                });
            }
        });

        if (groups.length === 0 && directSubCategories.length === 0) {
            groups.push({
                category: selectedCategory,
                items: [],
                isSubCategory: false
            });
        }
        
        return groups;

    }, [items, categories, selectedCategoryId, itemFilter, sortOrder]);
    
    const allVisibleItems = useMemo(() => itemGroups.flatMap(g => g.items), [itemGroups]);

    const handleItemDrop = (targetItemId: string) => {
        if (!draggedItemId || !selectedCategoryId || !canModify) return;
    
        const itemsToDragIds = selectedItemIds.has(draggedItemId)
            ? selectedItemIds
            : new Set([draggedItemId]);
    
        if (itemsToDragIds.has(targetItemId)) return;
    
        const allItemsInViewForDrag = itemGroups.flatMap(g => g.items);

        const targetItem = allItemsInViewForDrag.find(i => i.id === targetItemId);
        if(!targetItem) return;

        // All dragged items must be from the same original category as the target item.
        const sourceCategoryId = targetItem.categoryId;
        const areItemsInSameCategory = Array.from(itemsToDragIds).every(id => {
            const item = allItemsInViewForDrag.find(i => i.id === id);
            return item && item.categoryId === sourceCategoryId;
        });

        if (!areItemsInSameCategory) {
            // This prevents dragging across sub-category groups for now.
            // A more complex implementation could allow this, but it requires reparenting.
            return;
        }

        const itemsInCurrentSubCategory = allItemsInViewForDrag
            .filter(i => i.categoryId === sourceCategoryId)
            .sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
    
        const draggedItems = itemsInCurrentSubCategory.filter(item => itemsToDragIds.has(item.id));
        if (draggedItems.length === 0) return;
    
        const remainingItems = itemsInCurrentSubCategory.filter(item => !itemsToDragIds.has(item.id));
    
        const targetIndex = remainingItems.findIndex(i => i.id === targetItemId);
        if (targetIndex === -1) return;
    
        remainingItems.splice(targetIndex, 0, ...draggedItems);
    
        const updates = remainingItems.map((item, index) => ({
            id: item.id,
            displayRank: (index + 1) * 10
        }));
    
        updateMultipleItems(updates);
    };


    const handleSaveCategory = async (catData: Omit<AppCategory, 'id'> | AppCategory) => {
        if (!canModify) return;
        try {
            if('id' in catData) {
                await updateCategory(catData);
            } else {
                await addCategory(catData);
            }
            setModalState(null);
        } catch(e) { alert(`Error saving category: ${e}`); }
    };
    
    const handleDeleteCategory = async (id: string) => {
        if (!canModify) return;
        if(window.confirm("Are you sure? Deleting a category is only possible if it has no items or sub-categories.")) {
            try {
                await deleteCategory(id);
            } catch(e) { alert(`Error: ${e}`); }
        }
    };
    
    const handleSaveItem = async (itemData: Omit<Item, 'id'> | Item) => {
        if (!canModify) return;
        try {
            if('id' in itemData) {
                await updateItem(itemData);
            } else {
                await addItem(itemData);
            }
            setModalState(null);
        } catch(e) { alert(`Error saving item: ${e}`); }
    };

    const handleDeleteItem = async (id: string) => {
        if (!canModify) return;
        if(window.confirm("Are you sure you want to delete this item?")) {
            try {
                await deleteItem(id);
            } catch(e) { alert(`Error deleting item: ${e}`); }
        }
    }
    
     const handleItemSelection = (itemId: string, checked: boolean) => {
        setSelectedItemIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(itemId);
            } else {
                newSet.delete(itemId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedItemIds(new Set(allVisibleItems.map(item => item.id)));
        } else {
            setSelectedItemIds(new Set());
        }
    };

    const handleDeleteSelected = async () => {
        if (!canModify || selectedItemIds.size === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedItemIds.size} selected item(s)?`)) {
            try {
                await deleteMultipleItems(Array.from(selectedItemIds));
                setSelectedItemIds(new Set());
            } catch (e) {
                alert(`Error deleting items: ${e}`);
            }
        }
    };

    const handleMoveSelected = async () => {
        if (!canModify || selectedItemIds.size === 0 || !destinationCategoryId) return;
        if (window.confirm(`Are you sure you want to move ${selectedItemIds.size} item(s)?`)) {
            try {
                await moveMultipleItems(Array.from(selectedItemIds), destinationCategoryId);
                setSelectedItemIds(new Set());
                setIsMoveModalOpen(false);
                setDestinationCategoryId('');
            } catch (e) {
                alert(`Error moving items: ${e}`);
            }
        }
    };

    const handleBatchTypeUpdate = async () => {
        if (!canModify || selectedItemIds.size === 0) return;
        if (window.confirm(`Are you sure you want to change the type of ${selectedItemIds.size} item(s) to "${newTypeForBatch}"?`)) {
            try {
                await batchUpdateItemType(Array.from(selectedItemIds), newTypeForBatch);
                setSelectedItemIds(new Set());
            } catch (e) {
                alert(`Error updating item types: ${e}`);
            }
        }
    };

    const handleBatchNameUpdate = async () => {
        if (!canModify || selectedItemIds.size === 0 || !findText) {
            alert("Please select items and enter text to find.");
            return;
        }
    
        const confirmationMessage = `Are you sure you want to replace "${findText}" with "${replaceText}" in the names of ${selectedItemIds.size} selected item(s)? This action cannot be undone.`;
        
        if (window.confirm(confirmationMessage)) {
            try {
                const updates = Array.from(selectedItemIds).map(id => {
                    const item = items.find(i => i.id === id);
                    if (!item) return null;
                    const newName = item.name.split(findText).join(replaceText);
                    return { id, newName };
                }).filter((u): u is { id: string; newName: string } => !!u);
                
                await batchUpdateItemNames(updates);
                setSelectedItemIds(new Set());
                setFindText('');
                setReplaceText('');
                alert("Item names updated successfully.");
            } catch (e) {
                alert(`Error updating item names: ${e}`);
            }
        }
    };

    const handleOpenMergeModal = (category: AppCategory) => {
        setMergeState({ source: category, destinationId: '' });
    };

    const handleMergeConfirm = async () => {
        if (!mergeState || !mergeState.destinationId || !canModify) return;

        if (window.confirm(`Are you sure you want to merge "${mergeState.source.name}" into "${categories.find(c => c.id === mergeState.destinationId)?.name}"? This will move all items and sub-categories, then delete "${mergeState.source.name}". This action cannot be undone.`)) {
            try {
                await mergeCategory(mergeState.source.id, mergeState.destinationId);
                if (selectedCategoryId === mergeState.source.id) {
                    setSelectedCategoryId(mergeState.destinationId); // Navigate to the merged category
                }
                setMergeState(null);
            } catch (e) {
                alert(`Error merging category: ${e}`);
            }
        }
    };

    const modalContent = () => {
        if (!modalState) return null;
        if (modalState.type === 'category') {
            return <CategoryForm onSave={handleSaveCategory} onCancel={() => setModalState(null)} category={modalState.data} allCategories={categories}/>
        }
        if (modalState.type === 'item') {
            return <ItemForm onSave={handleSaveItem} onCancel={() => setModalState(null)} item={modalState.data} categories={categories} selectedCategoryId={selectedCategoryId} />
        }
    }
    
    return (
        <div>
            {modalState && 
                <Modal 
                    isOpen={!!modalState} 
                    onClose={() => setModalState(null)}
                    title={modalState.type === 'category' ? 'Category' : 'Item'}
                >
                   {modalContent()}
                </Modal>
            }
            {isMoveModalOpen && (
                <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} title="Move Items">
                    <div className="space-y-4">
                        <p>Move {selectedItemIds.size} selected item(s) to a new category.</p>
                        <div>
                            <label htmlFor="destination-category" className="block text-sm font-medium">Destination Category</label>
                            <select
                                id="destination-category"
                                value={destinationCategoryId}
                                onChange={(e) => setDestinationCategoryId(e.target.value)}
                                className={inputStyle}
                            >
                                <option value="">-- Select Destination --</option>
                                {generateCategoryOptions(categories.filter(c => c.id !== selectedCategoryId)).map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setIsMoveModalOpen(false)} className={secondaryButton}>Cancel</button>
                            <button type="button" onClick={handleMoveSelected} className={primaryButton} disabled={!destinationCategoryId}>Move Items</button>
                        </div>
                    </div>
                </Modal>
            )}
            {mergeState && (
                <Modal isOpen={!!mergeState} onClose={() => setMergeState(null)} title="Merge Category">
                    <MergeCategoryModal 
                        sourceCategory={mergeState.source}
                        allCategories={categories}
                        onCancel={() => setMergeState(null)}
                        onConfirm={handleMergeConfirm}
                        destinationId={mergeState.destinationId}
                        setDestinationId={(id) => setMergeState(s => s ? {...s, destinationId: id} : null)}
                    />
                </Modal>
            )}

            <div className="border-b border-warm-gray-200 dark:border-warm-gray-700 mb-6">
                 <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'items'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700 hover:border-warm-gray-300'
                        }`}
                    >Items & Categories</button>
                    <button
                        onClick={() => setActiveTab('service')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'service'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700 hover:border-warm-gray-300'
                        }`}
                    >Service Articles</button>
                     <button
                        onClick={() => setActiveTab('estimates')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'estimates'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700 hover:border-warm-gray-300'
                        }`}
                    >Cooking Estimates</button>
                    <button
                        onClick={() => setActiveTab('accompaniments')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'accompaniments'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700 hover:border-warm-gray-300'
                        }`}
                    >Accompaniments</button>
                </nav>
            </div>

            {activeTab === 'items' ? (
                <div className="flex gap-6 h-[calc(100vh-14rem)]">
                    <div className="w-1/3 bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Categories</h3>
                            {canModify && <button onClick={() => setModalState({ type: 'category', data: null })} className={primaryButton}>Add</button>}
                        </div>
                        <CategoryTree 
                            categories={categories} 
                            onSelect={setSelectedCategoryId}
                            onEdit={(cat) => setModalState({ type: 'category', data: cat })}
                            onDelete={handleDeleteCategory}
                            onMerge={handleOpenMergeModal}
                            onReorder={updateMultipleCategories}
                            selectedId={selectedCategoryId}
                            canModify={canModify}
                        />
                    </div>
                    <div className="w-2/3 bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md flex flex-col">
                        <div className="flex justify-between items-center mb-4 flex-shrink-0">
                            <h3 className="font-bold text-lg">Items</h3>
                            {canModify && selectedCategoryId && (
                                selectedItemIds.size > 0 ? (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setIsMoveModalOpen(true)} className={secondaryButton}>
                                            <Move size={16}/> Move ({selectedItemIds.size})
                                        </button>
                                        <button onClick={handleDeleteSelected} className={dangerButton}>
                                            <Trash2 size={16}/> Delete ({selectedItemIds.size})
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => setModalState({ type: 'item', data: null })} className={primaryButton}>
                                        Add Item
                                    </button>
                                )
                            )}
                        </div>

                        {selectedCategoryId && (
                             <div className="mb-4 flex-shrink-0 flex items-center gap-4">
                                <div className="flex-grow">
                                    <input
                                        type="text"
                                        placeholder="Filter items in this category..."
                                        value={itemFilter}
                                        onChange={(e) => setItemFilter(e.target.value)}
                                        className={inputStyle + " w-full"}
                                    />
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-1 bg-warm-gray-100 dark:bg-warm-gray-700/50 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setSortOrder('rank')} 
                                        className={`p-1.5 rounded-md ${sortOrder === 'rank' ? 'bg-white dark:bg-warm-gray-800 text-primary-600 shadow-sm' : 'text-warm-gray-500 hover:bg-white/50 dark:hover:bg-warm-gray-600'}`} 
                                        title="Sort by Rank"
                                    >
                                        <ListOrdered size={18} />
                                    </button>
                                    <button 
                                        onClick={() => setSortOrder('asc')} 
                                        className={`p-1.5 rounded-md ${sortOrder === 'asc' ? 'bg-white dark:bg-warm-gray-800 text-primary-600 shadow-sm' : 'text-warm-gray-500 hover:bg-white/50 dark:hover:bg-warm-gray-600'}`}
                                        title="Sort A-Z"
                                    >
                                        <ArrowUpAZ size={18} />
                                    </button>
                                    <button 
                                        onClick={() => setSortOrder('desc')} 
                                        className={`p-1.5 rounded-md ${sortOrder === 'desc' ? 'bg-white dark:bg-warm-gray-800 text-primary-600 shadow-sm' : 'text-warm-gray-500 hover:bg-white/50 dark:hover:bg-warm-gray-600'}`}
                                        title="Sort Z-A"
                                    >
                                        <ArrowDownAZ size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {selectedItemIds.size > 0 && canModify && (
                            <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/30 rounded-lg space-y-3 border border-primary-200 dark:border-primary-500/30">
                                <span className="font-semibold flex-shrink-0">{selectedItemIds.size} items selected.</span>
                                
                                <div className="flex items-center gap-2 flex-wrap">
                                    <label htmlFor="batch-type-update" className="text-sm font-medium">Change type to:</label>
                                    <select
                                        id="batch-type-update"
                                        value={newTypeForBatch}
                                        onChange={e => setNewTypeForBatch(e.target.value as ItemType)}
                                        className={inputStyle + ' w-auto py-1'}
                                    >
                                        {itemTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                                    </select>
                                    <button onClick={handleBatchTypeUpdate} className={secondaryButton + ' py-1'}>Apply Type</button>
                                </div>

                                <div className="flex items-end gap-2 flex-wrap pt-2 border-t border-primary-200/50 dark:border-primary-500/20">
                                    <div className="flex-grow">
                                        <label htmlFor="find-text" className="text-sm font-medium">Find in name:</label>
                                        <input
                                            id="find-text"
                                            type="text"
                                            value={findText}
                                            onChange={e => setFindText(e.target.value)}
                                            className={inputStyle + ' w-full py-1'}
                                            placeholder="e.g. [SL]"
                                        />
                                    </div>
                                    <div className="flex-grow">
                                        <label htmlFor="replace-text" className="text-sm font-medium">Replace with:</label>
                                        <input
                                            id="replace-text"
                                            type="text"
                                            value={replaceText}
                                            onChange={e => setReplaceText(e.target.value)}
                                            className={inputStyle + ' w-full py-1'}
                                            placeholder="(leave empty to remove)"
                                        />
                                    </div>
                                    <button onClick={handleBatchNameUpdate} className={secondaryButton + ' py-1'}>Apply Name Change</button>
                                </div>
                            </div>
                        )}

                        <div className="overflow-y-auto">
                            {!selectedCategoryId ? (
                                <p className="text-center py-10 text-warm-gray-500">Select a category to view items.</p>
                            ) : allVisibleItems.length === 0 ? (
                                <p className="text-center py-10 text-warm-gray-500">
                                    {itemFilter ? 'No items match your filter.' : 'This category has no items.'}
                                </p>
                            ) : (
                                <ul>
                                    {canModify &&
                                        <li className="py-2 flex items-center gap-2 border-b border-warm-gray-200 dark:border-warm-gray-700">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                checked={selectedItemIds.size > 0 && selectedItemIds.size === allVisibleItems.length}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                            <label className="text-sm font-semibold">Select All</label>
                                        </li>
                                    }
                                    {itemGroups.map((group) => (
                                        <Fragment key={group.category.id}>
                                            {group.isSubCategory && (
                                                <h4 className="font-bold text-md bg-warm-gray-50 dark:bg-warm-gray-700/50 p-2 my-2 rounded sticky top-0 z-10">{group.category.name}</h4>
                                            )}
                                            {group.items.map(item => {
                                                const isSelected = selectedItemIds.has(item.id);
                                                const isBeingDraggedAsGroup = draggedItemId !== null && selectedItemIds.has(draggedItemId) && isSelected;

                                                return (
                                                <li 
                                                    key={item.id} 
                                                    draggable={canModify && sortOrder === 'rank'}
                                                    onDragStart={(e) => {
                                                        if (!canModify || sortOrder !== 'rank') return;
                                                        e.dataTransfer.setData('application/my-app-item-id', item.id);
                                                        e.dataTransfer.effectAllowed = 'move';
                                                        setDraggedItemId(item.id);
                                                    }}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        if (item.id !== dragOverItemId) setDragOverItemId(item.id);
                                                    }}
                                                    onDragLeave={() => setDragOverItemId(null)}
                                                    onDrop={() => handleItemDrop(item.id)}
                                                    onDragEnd={() => {
                                                        setDraggedItemId(null);
                                                        setDragOverItemId(null);
                                                    }}
                                                    className={`py-3 flex justify-between items-center transition-all duration-150 border-b border-warm-gray-100 dark:border-warm-gray-700/50 ${dragOverItemId === item.id ? 'bg-primary-100 dark:bg-primary-900/40' : ''} ${isBeingDraggedAsGroup ? 'opacity-40' : ''}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {canModify && <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" checked={isSelected} onChange={e => handleItemSelection(item.id, e.target.checked)}/>}
                                                        {canModify && sortOrder === 'rank' && <GripVertical size={16} className="cursor-move text-warm-gray-400"/>}
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="font-semibold">{item.name}</p>
                                                                <ItemTypeIcon type={item.type} />
                                                            </div>
                                                            <p className="text-sm text-warm-gray-500">{item.description}</p>
                                                        </div>
                                                    </div>
                                                    {canModify &&
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => setModalState({type: 'item', data: item})} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Item">
                                                            <Edit size={16} className="text-primary-600"/>
                                                        </button>
                                                        <button onClick={() => handleDeleteItem(item.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Item">
                                                            <Trash2 size={16} className="text-accent-500"/>
                                                        </button>
                                                    </div>
                                                    }
                                                </li>
                                            );
                                        })}
                                        </Fragment>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            ) : activeTab === 'service' ? (
                <ServiceArticleAssignment permissions={permissions} />
            ) : activeTab === 'estimates' ? (
                <CookingEstimates permissions={permissions} />
            ) : (
                <ItemAccompanimentAssignment permissions={permissions} />
            )}
        </div>
    );
};

const CategoryForm = ({ onSave, onCancel, category, allCategories }: {
    onSave: (cat: AppCategory | Omit<AppCategory, 'id'>) => void,
    onCancel: () => void,
    category: AppCategory | Partial<AppCategory> | null,
    allCategories: AppCategory[]
}) => {
    const [name, setName] = useState(category?.name || '');
    const [parentId, setParentId] = useState(category?.parentId || null);
    const [type, setType] = useState<'veg' | 'non-veg' | null>(category?.type || null);
    const [displayRank, setDisplayRank] = useState(category?.displayRank || 0);
    const [isStandardAccompaniment, setIsStandardAccompaniment] = useState(category?.isStandardAccompaniment || false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { name, parentId, type: parentId ? null : type, displayRank: Number(displayRank), isStandardAccompaniment };
        if(category && 'id' in category) {
            onSave({ id: category.id, ...data });
        } else {
            onSave(data);
        }
    };

    const parentOptions = allCategories.filter(c => c.parentId === null);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Category Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <select value={parentId || ''} onChange={e => setParentId(e.target.value || null)} className={inputStyle}>
                <option value="">-- No Parent (Root Category) --</option>
                {parentOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
            </select>
            {!parentId &&
                <select value={type || ''} onChange={e => setType(e.target.value as any)} className={inputStyle}>
                    <option value="">-- Select Type (Optional) --</option>
                    <option value="veg">Veg</option>
                    <option value="non-veg">Non-Veg</option>
                </select>
            }
            <input type="number" placeholder="Display Rank" value={displayRank} onChange={e => setDisplayRank(Number(e.target.value))} className={inputStyle} />
            <div className="flex items-center">
                <input
                    id="isStandardAccompaniment"
                    type="checkbox"
                    checked={isStandardAccompaniment}
                    onChange={e => setIsStandardAccompaniment(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="isStandardAccompaniment" className="ml-2 block text-sm text-warm-gray-900 dark:text-warm-gray-200">
                    Standard Accompaniments Category
                </label>
            </div>
            <p className="text-xs text-warm-gray-500 -mt-2">Items in this category will be pre-selected when creating a menu from a template.</p>
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    )
};

const ItemForm = ({ onSave, onCancel, item, categories, selectedCategoryId }: {
    onSave: (item: Item | Omit<Item, 'id'>) => void,
    onCancel: () => void,
    item: Item | null,
    categories: AppCategory[],
    selectedCategoryId: string | null,
}) => {
    const [name, setName] = useState(item?.name || '');
    const [description, setDescription] = useState(item?.description || '');
    const [categoryId, setCategoryId] = useState(item?.categoryId || selectedCategoryId || '');
    const [type, setType] = useState<ItemType>(item?.type || 'veg');
    const [displayRank, setDisplayRank] = useState(item?.displayRank || 0);

    const categoryOptions = useMemo(() => generateCategoryOptions(categories), [categories]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { name, description, categoryId, type, displayRank: Number(displayRank) };
        if(item) {
            onSave({ id: item.id, ...data });
        } else {
            onSave(data);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Item Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className={inputStyle} rows={3} />
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className={inputStyle}>
                <option value="" disabled>Select a category</option>
                {categoryOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <select value={type} onChange={e => setType(e.target.value as ItemType)} required className={inputStyle}>
                {itemTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" placeholder="Display Rank" value={displayRank} onChange={e => setDisplayRank(Number(e.target.value))} className={inputStyle} />

            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    );
};