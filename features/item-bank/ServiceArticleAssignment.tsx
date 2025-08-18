import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useItems, useServiceArticles, useAppCategories } from '../../contexts/AppContexts';
import { Item, ServiceArticle, PermissionLevel, AppCategory } from '../../types';
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Edit, Trash2, Save } from 'lucide-react';
import Modal from '../../components/Modal';
import { primaryButton, secondaryButton, iconButton, inputStyle } from '../../components/common/styles';


const ArticleForm = ({ onSave, onCancel, article }: {
    onSave: (data: {id?: string, name: string}) => void,
    onCancel: () => void,
    article: ServiceArticle | null,
}) => {
    const [name, setName] = useState(article?.name || '');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert("Article name cannot be empty.");
            return;
        }
        const data = { name: name.trim() };
        if (article) onSave({ ...data, id: article.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Article Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
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
    selectedArticleId,
    onItemToggle,
    onCategoryToggle,
    canModify,
    level = 0
}: {
    category: AppCategory,
    hierarchy: Map<string, AppCategory[]>,
    allItems: Item[],
    selectedArticleId: string,
    onItemToggle: (itemId: string) => void,
    onCategoryToggle: (categoryId: string, action: 'add' | 'remove') => void,
    canModify: boolean,
    level?: number
}) => {
    const [isOpen, setIsOpen] = useState(level < 1); // Auto-open root and first-level categories
    const checkboxRef = useRef<HTMLInputElement>(null);

    // Memoize fetching children and items to avoid re-calculations
    const childCategories = useMemo(() => hierarchy.get(category.id) || [], [hierarchy, category.id]);
    const itemsDirectlyInCategory = useMemo(() => 
        allItems.filter(i => i.categoryId === category.id).sort((a,b)=> (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)), 
        [allItems, category.id]
    );

    // Get all items under this category, including sub-categories
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

    // Calculate checkbox state based on descendant items
    const { isChecked, isIndeterminate } = useMemo(() => {
        if (descendantItems.length === 0) return { isChecked: false, isIndeterminate: false };
        const assignedCount = descendantItems.filter(i => i.serviceArticleIds?.includes(selectedArticleId)).length;
        
        return {
            isChecked: assignedCount === descendantItems.length,
            isIndeterminate: assignedCount > 0 && assignedCount < descendantItems.length
        };
    }, [descendantItems, selectedArticleId]);

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
                        <div className="w-4"></div> // Placeholder for alignment
                    )}
                    <span className="font-semibold">{category.name}</span>
                </button>
            </div>
            {isOpen && (
                <ul className="pl-4 border-l-2 border-warm-gray-200 dark:border-warm-gray-600 ml-3">
                    {/* Render child items */}
                    {itemsDirectlyInCategory.map(item => (
                         <li key={item.id} className="my-1 ml-4 p-2 rounded-md hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50">
                             <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={item.serviceArticleIds?.includes(selectedArticleId) || false}
                                    onChange={() => canModify && onItemToggle(item.id)}
                                    disabled={!canModify}
                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                {item.name}
                            </label>
                         </li>
                    ))}
                    {/* Render child categories recursively */}
                    {childCategories.map(childCat => (
                        <AssignmentCategoryNode
                            key={childCat.id}
                            category={childCat}
                            hierarchy={hierarchy}
                            allItems={allItems}
                            selectedArticleId={selectedArticleId}
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

export const ServiceArticleAssignment = ({ permissions }: { permissions: PermissionLevel }) => {
    const { items, updateItem, batchUpdateServiceArticles } = useItems();
    const { settings: serviceArticles, addSetting, updateSetting, deleteSetting } = useServiceArticles();
    const { categories } = useAppCategories();

    const [selectedArticle, setSelectedArticle] = useState<ServiceArticle | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArticle, setEditingArticle] = useState<ServiceArticle | null>(null);

    const canModify = permissions === 'modify';

    const missingCount = useMemo(() => items.filter(i => !i.serviceArticleIds || i.serviceArticleIds.length === 0).length, [items]);
    const sortedArticles = useMemo(() => serviceArticles.slice().sort((a,b) => a.name.localeCompare(b.name)), [serviceArticles]);

    // Auto-select first article on load
    useEffect(() => {
        if (!selectedArticle && sortedArticles.length > 0) {
            setSelectedArticle(sortedArticles[0]);
        }
    }, [sortedArticles, selectedArticle]);

    // Create category hierarchy for the tree view
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
    const handleSaveArticle = async (data: { id?: string, name: string }) => {
        if (!canModify) return;
        try {
            if (data.id) {
                await updateSetting(data.id, data.name);
            } else {
                await addSetting(data.name);
            }
            setIsModalOpen(false);
        } catch (e) {
            alert(`Error saving article: ${e}`);
        }
    };

    const handleDeleteArticle = async (id: string) => {
        if (!canModify) return;
        if (window.confirm("Are you sure you want to delete this service article?")) {
            try {
                await deleteSetting(id);
                if (selectedArticle?.id === id) {
                    setSelectedArticle(null);
                }
            } catch (e) {
                alert(`Error deleting article: ${e}`);
            }
        }
    };

    const handleItemToggle = (itemId: string) => {
        if (!selectedArticle || !canModify) return;
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        const currentIds = item.serviceArticleIds || [];
        const newIds = currentIds.includes(selectedArticle.id)
            ? currentIds.filter(id => id !== selectedArticle.id)
            : [...currentIds, selectedArticle.id];
        
        updateItem({ ...item, serviceArticleIds: newIds });
    };

    const handleCategoryToggle = (categoryId: string, action: 'add' | 'remove') => {
        if (!selectedArticle || !canModify) return;

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
            batchUpdateServiceArticles(itemIdsToUpdate, selectedArticle.id, action);
        }
    };
    
    return (
        <div>
            {isModalOpen && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    title={editingArticle ? 'Edit Service Article' : 'Add Service Article'}
                >
                    <ArticleForm onSave={handleSaveArticle} onCancel={() => setIsModalOpen(false)} article={editingArticle}/>
                </Modal>
            )}

            {missingCount > 0 && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded-md" role="alert">
                    <div className="flex items-center">
                        <AlertTriangle size={20} className="mr-3" />
                        <div>
                            <p className="font-bold">Attention Needed</p>
                            <p>{missingCount} items are missing service article assignments.</p>
                        </div>
                    </div>
                </div>
            )}
             <div className="flex gap-6 h-[calc(100vh-14rem)]">
                {/* Left Panel: Service Articles List */}
                <div className="w-1/3 bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md flex flex-col">
                     <div className="flex justify-between items-center mb-2 flex-shrink-0">
                         <h3 className="text-lg font-bold">Service Articles</h3>
                         {canModify && 
                            <button onClick={() => { setEditingArticle(null); setIsModalOpen(true); }} className={primaryButton}>
                                <Plus size={16}/> Add
                            </button>
                         }
                    </div>
                     <ul className="overflow-y-auto divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                        {sortedArticles.map(article => (
                            <li 
                                key={article.id}
                                onClick={() => setSelectedArticle(article)}
                                className={`py-2 cursor-pointer ${selectedArticle?.id === article.id ? 'bg-primary-50 dark:bg-primary-900/40' : ''}`}
                            >
                                <div className={`flex justify-between items-center w-full p-2 rounded-md ${selectedArticle?.id === article.id ? '' : 'hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50'}`}>
                                    <span className="font-semibold flex-grow">{article.name}</span>
                                    {canModify && (
                                        <div className="flex items-center gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); setEditingArticle(article); setIsModalOpen(true); }} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Article">
                                                <Edit size={16} className="text-primary-600" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteArticle(article.id); }} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Article">
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
                     {selectedArticle ? (
                        <div>
                            <h3 className="text-lg font-bold mb-4">Assign: <span className="text-primary-600">{selectedArticle.name}</span></h3>
                            <ul>
                                {roots.map(rootCat => (
                                    <AssignmentCategoryNode
                                        key={rootCat.id}
                                        category={rootCat}
                                        hierarchy={hierarchy}
                                        allItems={items}
                                        selectedArticleId={selectedArticle.id}
                                        onItemToggle={handleItemToggle}
                                        onCategoryToggle={handleCategoryToggle}
                                        canModify={canModify}
                                    />
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-warm-gray-500">Select a service article from the left to begin.</p>
                        </div>
                    )}
                </div>
             </div>
        </div>
    );
};