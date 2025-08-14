import React, { useState, useMemo } from 'react';
import { AppCategory } from '../types';
import { iconButton } from './common/styles';
import { ChevronRight, ChevronDown, Edit, Trash2, GripVertical, Merge } from 'lucide-react';


const CategoryNode = ({ category, hierarchy, onSelect, onEdit, onDelete, onMerge, selectedId, canModify, level = 0, onReorder, allCategories }: {
    category: AppCategory,
    hierarchy: Map<string, AppCategory[]>,
    allCategories: AppCategory[],
    onSelect: (id: string) => void,
    onEdit: (cat: AppCategory) => void,
    onDelete: (id: string) => void,
    onMerge: (cat: AppCategory) => void,
    onReorder: (updates: { id: string, displayRank: number }[]) => void,
    selectedId: string | null,
    canModify: boolean,
    level?: number,
}) => {
    const [isOpen, setIsOpen] = useState(level < 1);
    const [isDragOver, setIsDragOver] = useState(false);
    const children = hierarchy.get(category.id);

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>) => {
        if (!canModify) return;
        e.dataTransfer.setData('application/my-app-cat-id', category.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!canModify) return;
        
        const draggedId = e.dataTransfer.getData('application/my-app-cat-id');
        const targetId = category.id;
        
        if (!draggedId || draggedId === targetId) return;

        const draggedCat = allCategories.find(c => c.id === draggedId);
        const targetCat = category;

        if (!draggedCat || !targetCat || draggedCat.parentId !== targetCat.parentId) {
            // Silently ignore drops between different levels for simplicity
            return;
        }
        
        const siblings = allCategories
            .filter(c => c.parentId === draggedCat.parentId)
            .sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));

        const draggedIndex = siblings.findIndex(s => s.id === draggedId);
        const targetIndex = siblings.findIndex(s => s.id === targetId);
        
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = siblings.splice(draggedIndex, 1);
        siblings.splice(targetIndex, 0, removed);

        const updates = siblings.map((cat, index) => ({
            id: cat.id,
            displayRank: (index + 1) * 10
        }));
        
        onReorder(updates);
    };

    return (
        <li 
            className={`my-1 transition-colors rounded-md ${isDragOver ? 'bg-primary-200 dark:bg-primary-800' : ''}`}
            draggable={canModify}
            onDragStart={handleDragStart}
            onDragOver={(e) => { e.preventDefault(); canModify && setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onDragEnd={() => setIsDragOver(false)}
        >
            <div className={`flex items-center justify-between p-2 rounded-md ${selectedId === category.id ? 'bg-primary-100 dark:bg-primary-900/40' : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700/50'}`}>
                <div className="flex items-center gap-1 flex-grow cursor-pointer" onClick={() => onSelect(category.id)}>
                    {canModify && <GripVertical size={16} className="cursor-move text-warm-gray-400"/>}
                    {children && <button type="button" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen);}}>{isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</button>}
                    {!children && <div className="w-4"></div>} {/* Placeholder for alignment */}
                    <span className="font-semibold">{category.name}</span>
                </div>
                {canModify &&
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onMerge(category)} className={iconButton('hover:bg-green-100 dark:hover:bg-green-800')} title="Merge Category"><Merge size={14} className="text-green-600"/></button>
                    <button type="button" onClick={() => onEdit(category)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Category"><Edit size={14} className="text-primary-600"/></button>
                    <button type="button" onClick={() => onDelete(category.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Category"><Trash2 size={14} className="text-accent-500"/></button>
                </div>
                }
            </div>
            {isOpen && children && (
                <ul className="pl-4 border-l-2 border-warm-gray-200 dark:border-warm-gray-600 ml-2">
                    {children.map(child => <CategoryNode key={child.id} category={child} allCategories={allCategories} hierarchy={hierarchy} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} onMerge={onMerge} onReorder={onReorder} selectedId={selectedId} canModify={canModify} level={level + 1} />)}
                </ul>
            )}
        </li>
    )
}

export const CategoryTree = ({ categories, onSelect, onEdit, onDelete, onMerge, selectedId, canModify, onReorder }: {
    categories: AppCategory[],
    onSelect: (id: string) => void,
    onEdit: (cat: AppCategory) => void,
    onDelete: (id: string) => void,
    onMerge: (cat: AppCategory) => void,
    onReorder: (updates: { id: string, displayRank: number }[]) => void,
    selectedId: string | null,
    canModify: boolean,
}) => {
    const { hierarchy, roots } = useMemo(() => {
        const hierarchy = new Map<string, AppCategory[]>();
        const roots: AppCategory[] = [];
        categories.forEach(cat => {
            if (cat.parentId === null) {
                roots.push(cat);
            } else {
                if (!hierarchy.has(cat.parentId)) {
                    hierarchy.set(cat.parentId, []);
                }
                hierarchy.get(cat.parentId)!.push(cat);
            }
        });
        roots.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
        hierarchy.forEach(children => children.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)));
        return { hierarchy, roots };
    }, [categories]);

    return (
        <ul>
            {roots.map(root => (
                <CategoryNode 
                    key={root.id}
                    category={root}
                    allCategories={categories}
                    hierarchy={hierarchy}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMerge={onMerge}
                    onReorder={onReorder}
                    selectedId={selectedId}
                    canModify={canModify}
                />
            ))}
        </ul>
    )
};