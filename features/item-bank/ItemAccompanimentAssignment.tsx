import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useItems, useItemAccompaniments, useAppCategories } from '../../contexts/AppContexts';
import { Item, ItemAccompaniment, PermissionLevel, AppCategory } from '../../types';
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Edit, Trash2, Save } from 'lucide-react';
import Modal from '../../components/Modal';
import { primaryButton, secondaryButton, iconButton, inputStyle } from '../../components/common/styles';


const AccompanimentForm = ({ onSave, onCancel, accompaniment }: {
    onSave: (data: {id?: string, name: string}) => void,
    onCancel: () => void,
    accompaniment: ItemAccompaniment | null,
}) => {
    const [name, setName] = useState(accompaniment?.name || '');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert("Accompaniment name cannot be empty.");
            return;
        }
        const data = { name: name.trim() };
        if (accompaniment) onSave({ ...data, id: accompaniment.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Accompaniment Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    );
};


// --- Recursive Node Component for the Assignment Tree ---

const AssignmentCategoryNode = ({
    category,
    hierarchy,
    allItems,
    selectedAccompanimentId,
    onItemToggle,
    onCategoryToggle,
    canModify,
    level = 0
}: {
    category: AppCategory,
    hierarchy: Map<string, AppCategory[]>,
    allItems: Item[],
    selectedAccompanimentId: string,
    onItemToggle: (itemId: string) => void,
    onCategoryToggle: (categoryId: string, action: 'add' | 'remove') => void,
    canModify: boolean,
    level?: number
}) => {
    const [isOpen, setIsOpen] = useState(level < 1);
    const checkboxRef = useRef<HTMLInputElement>(null);

    const childCategories = useMemo(() => hierarchy.get(category.id) || [], [hierarchy, category.id]);
    const itemsDirectlyInCategory = useMemo(() => 
        allItems.filter(i => i.categoryId === category.id).sort((a,b)=> (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)), 
        [allItems, category.id]
    );

    const descendantItems = useMemo(() => {
        const itemIds = new Set<string>();
        const queue = [category.id];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentCatId = queue.shift()!;
            if(visited.has(currentCatId)) continue;
            visited.add(currentCatId);

            allItems.forEach(item => {
                if (item.categoryId === currentCatId) {
                    itemIds.add(item.id);
                }
            });
            (hierarchy.get(currentCatId) || []).forEach(child => queue.push(child.id));
        }
        return allItems.filter(item => itemIds.has(item.id));
    }, [category.id, allItems, hierarchy]);

    const { isChecked, isIndeterminate } = useMemo(() => {
        if (descendantItems.length === 0) return { isChecked: false, isIndeterminate: false };
        const assignedCount = descendantItems.filter(i => i.accompanimentIds?.includes(selectedAccompanimentId)).length;
        
        return {
            isChecked: assignedCount === descendantItems.length,
            isIndeterminate: assignedCount > 0 && assignedCount < descendantItems.length
        };
    }, [descendantItems, selectedAccompanimentId]);

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = isIndeterminate;
        }
    }, [isIndeterminate]);

    const handleCategoryCheckboxChange = () => {
        if (!canModify) return;
        onCategoryToggle(category.id, isChecked ? 'remove' : 'add');
    };

    return (
        <li className="my-1">
            <div className="flex items-center p-2 rounded-md hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50">
                <input
                    ref={checkboxRef}
                    type="checkbox"
                    checked={isChecked}
                    onChange={handleCategoryCheckboxChange}
                    disabled={!canModify || descendantItems.length === 0}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 flex-grow text-left ml-2"
                >
                    {childCategories.length > 0 || itemsDirectlyInCategory.length > 0 ? (
                        isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                    ) : (
                        <div className="w-4"></div>
                    )}
                    <span className="font-semibold">{category.name}</span>
                </button>
            </div>
            {isOpen && (
                <ul className="pl-4 border-l-2 border-warm-gray-200 dark:border-warm-gray-600 ml-3">
                    {itemsDirectlyInCategory.map(item => (
                         <li key={item.id} className="my-1 ml-4 p-2 rounded-md hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50">
                             <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={item.accompanimentIds?.includes(selectedAccompanimentId) || false}
                                    onChange={() => canModify && onItemToggle(item.id)}
                                    disabled={!canModify}
                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                {item.name}
                            </label>
                         </li>
                    ))}
                    {childCategories.map(childCat => (
                        <AssignmentCategoryNode
                            key={childCat.id}
                            category={childCat}
                            hierarchy={hierarchy}
                            allItems={allItems}
                            selectedAccompanimentId={selectedAccompanimentId}
                            onItemToggle={onItemToggle}
                            onCategoryToggle={onCategoryToggle}
                            canModify={canModify}
                            level={level + 1}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
};

// --- Main Component ---

export const ItemAccompanimentAssignment = ({ permissions }: { permissions: PermissionLevel }) => {
    const { items, updateItem, batchUpdateAccompaniments } = useItems();
    const { settings: itemAccompaniments, addAccompaniment, updateAccompaniment, deleteAccompaniment } = useItemAccompaniments();
    const { categories } = useAppCategories();

    const [selectedAccompaniment, setSelectedAccompaniment] = useState<ItemAccompaniment | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccompaniment, setEditingAccompaniment] = useState<ItemAccompaniment | null>(null);

    const canModify = permissions === 'modify';

    const missingCount = useMemo(() => items.filter(i => !i.accompanimentIds || i.accompanimentIds.length === 0).length, [items]);
    const sortedAccompaniments = useMemo(() => itemAccompaniments.slice().sort((a,b) => a.name.localeCompare(b.name)), [itemAccompaniments]);

    useEffect(() => {
        if (!selectedAccompaniment && sortedAccompaniments.length > 0) {
            setSelectedAccompaniment(sortedAccompaniments[0]);
        }
    }, [sortedAccompaniments, selectedAccompaniment]);

    const { hierarchy, roots } = useMemo(() => {
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
        rootCategories.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
        hierarchyMap.forEach(children => children.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)));
        return { hierarchy: hierarchyMap, roots: rootCategories };
    }, [categories]);

    // --- Handlers ---
    const handleSaveAccompaniment = async (data: { id?: string, name: string }) => {
        if (!canModify) return;
        try {
            if (data.id) {
                const existing = itemAccompaniments.find(a => a.id === data.id);
                if(existing) {
                    await updateAccompaniment({ ...existing, name: data.name });
                }
            } else {
                await addAccompaniment({ name: data.name });
            }
            setIsModalOpen(false);
        } catch (e) {
            alert(`Error saving accompaniment: ${e}`);
        }
    };

    const handleDeleteAccompaniment = async (id: string) => {
        if (!canModify) return;
        if (window.confirm("Are you sure you want to delete this accompaniment?")) {
            try {
                await deleteAccompaniment(id);
                if (selectedAccompaniment?.id === id) {
                    setSelectedAccompaniment(null);
                }
            } catch (e) {
                alert(`Error deleting accompaniment: ${e}`);
            }
        }
    };

    const handleItemToggle = (itemId: string) => {
        if (!selectedAccompaniment || !canModify) return;
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const currentIds = item.accompanimentIds || [];
        const newIds = currentIds.includes(selectedAccompaniment.id)
            ? currentIds.filter(id => id !== selectedAccompaniment.id)
            : [...currentIds, selectedAccompaniment.id];
        
        updateItem({ ...item, accompanimentIds: newIds });
    };

    const handleCategoryToggle = (categoryId: string, action: 'add' | 'remove') => {
        if (!selectedAccompaniment || !canModify) return;

        const itemIdsToUpdate: string[] = [];
        const queue = [categoryId];
        const visited = new Set<string>();

        while(queue.length > 0) {
            const currentCatId = queue.shift()!;
            if (visited.has(currentCatId)) continue;
            visited.add(currentCatId);

            items.forEach(item => {
                if (item.categoryId === currentCatId) {
                    itemIdsToUpdate.push(item.id);
                }
            });
            (hierarchy.get(currentCatId) || []).forEach(child => queue.push(child.id));
        }

        if (itemIdsToUpdate.length > 0) {
            batchUpdateAccompaniments(itemIdsToUpdate, selectedAccompaniment.id, action);
        }
    };
    
    return (
        <div>
            {isModalOpen && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    title={editingAccompaniment ? 'Edit Accompaniment' : 'Add Accompaniment'}
                >
                    <AccompanimentForm onSave={handleSaveAccompaniment} onCancel={() => setIsModalOpen(false)} accompaniment={editingAccompaniment}/>
                </Modal>
            )}

            {missingCount > 0 && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded-md" role="alert">
                    <div className="flex items-center">
                        <AlertTriangle size={20} className="mr-3" />
                        <div>
                            <p className="font-bold">Attention Needed</p>
                            <p>{missingCount} items are missing accompaniment assignments.</p>
                        </div>
                    </div>
                </div>
            )}
             <div className="flex gap-6 h-[calc(100vh-14rem)]">
                {/* Left Panel: Service Articles List */}
                <div className="w-1/3 bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md flex flex-col">
                     <div className="flex justify-between items-center mb-2 flex-shrink-0">
                         <h3 className="text-lg font-bold">Accompaniments</h3>
                         {canModify && 
                            <button onClick={() => { setEditingAccompaniment(null); setIsModalOpen(true); }} className={primaryButton}>
                                <Plus size={16}/> Add
                            </button>
                         }
                    </div>
                     <ul className="overflow-y-auto divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                        {sortedAccompaniments.map(accompaniment => (
                            <li 
                                key={accompaniment.id}
                                onClick={() => setSelectedAccompaniment(accompaniment)}
                                className={`py-2 cursor-pointer ${selectedAccompaniment?.id === accompaniment.id ? 'bg-primary-50 dark:bg-primary-900/40' : ''}`}
                            >
                                <div className={`flex justify-between items-center w-full p-2 rounded-md ${selectedAccompaniment?.id === accompaniment.id ? '' : 'hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50'}`}>
                                    <span className="font-semibold flex-grow">{accompaniment.name}</span>
                                    {canModify && (
                                        <div className="flex items-center gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); setEditingAccompaniment(accompaniment); setIsModalOpen(true); }} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Accompaniment">
                                                <Edit size={16} className="text-primary-600" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteAccompaniment(accompaniment.id); }} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Accompaniment">
                                                <Trash2 size={16} className="text-accent-500" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                {/* Right Panel: Category & Item Assignment Tree */}
                <div className="w-2/3 bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md overflow-y-auto">
                     {selectedAccompaniment ? (
                        <div>
                            <h3 className="text-lg font-bold mb-4">Assign: <span className="text-primary-600">{selectedAccompaniment.name}</span></h3>
                            <ul>
                                {roots.map(rootCat => (
                                    <AssignmentCategoryNode
                                        key={rootCat.id}
                                        category={rootCat}
                                        hierarchy={hierarchy}
                                        allItems={items}
                                        selectedAccompanimentId={selectedAccompaniment.id}
                                        onItemToggle={handleItemToggle}
                                        onCategoryToggle={handleCategoryToggle}
                                        canModify={canModify}
                                    />
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-warm-gray-500">Select an accompaniment from the left to begin.</p>
                        </div>
                    )}
                </div>
             </div>
        </div>
    );
};