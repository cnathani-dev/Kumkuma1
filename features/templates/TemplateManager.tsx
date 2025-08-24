import React, { useState, useMemo } from 'react';
import { MenuTemplate, Catalog, AppCategory, LocationSetting } from '../../types';
import { useTemplates, useCatalogs, useAppCategories, useItems, useLocations } from '../../contexts/AppContexts';
import { primaryButton, secondaryButton, dangerButton, inputStyle, iconButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, Save, X, FileText, ArrowLeft } from 'lucide-react';
import { exportTemplateToPdf } from '../../lib/export';

interface TemplateManagerProps {
    canModify: boolean;
    onAddClick: () => void;
    onEditClick: (template: MenuTemplate) => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ canModify, onAddClick, onEditClick }) => {
    const { templates, deleteTemplate, updateTemplateGroup } = useTemplates();
    const { catalogs } = useCatalogs();
    const { items } = useItems();
    const { categories } = useAppCategories();

    const catalogMap = useMemo(() => new Map(catalogs.map(c => [c.id, c.name])), [catalogs]);
    
    const groupedTemplates = useMemo(() => {
        const groups: Record<string, MenuTemplate[]> = {};
        templates.forEach(template => {
            const groupName = template.group || 'Uncategorized';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(template);
        });
        Object.values(groups).forEach(group => group.sort((a, b) => a.name.localeCompare(b.name)));
        return groups;
    }, [templates]);

    const sortedGroupNames = useMemo(() => Object.keys(groupedTemplates).sort(), [groupedTemplates]);

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure? This cannot be undone.")) {
            await deleteTemplate(id);
        }
    };
    
    const handleExport = (template: MenuTemplate) => {
        const catalog = catalogs.find(c => c.id === template.catalogId);
        if (!catalog) {
            alert("Could not export: The catalog associated with this template could not be found.");
            return;
        }
        exportTemplateToPdf(template, catalog, items, categories);
    };

    const handleRenameGroup = (oldName: string) => {
        if (!canModify) return;
        const newName = window.prompt(`Rename group "${oldName}" to:`, oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
            updateTemplateGroup(oldName, newName.trim());
        }
    };

    return (
         <div className="space-y-6">
            <div className="flex justify-end items-center">
                {canModify &&
                    <div className="flex items-center gap-2">
                        <button onClick={onAddClick} className={primaryButton}><Plus size={16}/> Add Template</button>
                    </div>
                }
            </div>
             <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
                {sortedGroupNames.length === 0 ? (
                    <p className="text-center py-8 text-warm-gray-500">No templates created yet.</p>
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
                                {groupedTemplates[groupName].map(template => (
                                    <li key={template.id} className="py-3 flex justify-between items-center">
                                        <div className="flex-grow cursor-pointer" onClick={() => onEditClick(template)}>
                                            <p className="font-bold">{template.name}</p>
                                            <p className="text-sm text-warm-gray-500">Catalog: {catalogMap.get(template.catalogId) || 'Unknown'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleExport(template)} className={secondaryButton}><FileText size={16}/> Export</button>
                                            {canModify && <>
                                                <button onClick={() => onEditClick(template)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Template">
                                                    <Edit size={16} className="text-primary-600" />
                                                </button>
                                                <button onClick={() => handleDelete(template.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Template">
                                                    <Trash2 size={16} className="text-accent-500" />
                                                </button>
                                            </>}
                                        </div>
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


interface TemplateEditorProps {
    template: MenuTemplate | Partial<MenuTemplate>;
    onCancel: () => void;
    isReadOnly: boolean;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onCancel, isReadOnly }) => {
    const { templates, addTemplate, updateTemplate } = useTemplates();
    const { catalogs } = useCatalogs();
    const { categories } = useAppCategories();
    const { locations } = useLocations();

    const [name, setName] = useState(template.name || '');
    const [catalogId, setCatalogId] = useState(template.catalogId || '');
    const [group, setGroup] = useState(template.group || '');
    const [rules, setRules] = useState<Record<string, number>>(template.rules || {});
    const [type, setType] = useState<'veg' | 'non-veg'>(('type' in template ? template.type : 'non-veg') || 'non-veg');
    const [muttonRules, setMuttonRules] = useState(template.muttonRules || 0);
    const [isCocktailTemplate, setIsCocktailTemplate] = useState(template.isCocktailTemplate || false);
    const [isHiTeaTemplate, setIsHiTeaTemplate] = useState(template.isHiTeaTemplate || false);
    const [locationIds, setLocationIds] = useState<string[]>(template.locationIds || []);

    const templateGroups = useMemo(() => Array.from(new Set(templates.map(t => t.group).filter(Boolean))), [templates]);
    
    const rootCategories = useMemo(() => {
        return categories.filter(c => {
            const isRoot = c.parentId === null;
            const typeMatch = type === 'veg' ? c.type === 'veg' : true;
            return isRoot && typeMatch && !c.isStandardAccompaniment;
        }).sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
    }, [categories, type]);
    
    const handleRuleChange = (categoryId: string, value: string) => {
        if (isReadOnly) return;
        const numValue = parseInt(value, 10);
        setRules(prev => {
            const newRules = { ...prev };
            if (isNaN(numValue) || numValue <= 0) {
                delete newRules[categoryId];
            } else {
                newRules[categoryId] = numValue;
            }
            return newRules;
        });
    };

    const handleLocationToggle = (locationId: string) => {
        setLocationIds(prev =>
            prev.includes(locationId)
                ? prev.filter(id => id !== locationId)
                : [...prev, locationId]
        );
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) return;
        if(!catalogId) {
            alert('Please select a catalog.');
            return;
        }
        const templateData = { 
            name, 
            catalogId, 
            group, 
            rules, 
            type,
            muttonRules: muttonRules || 0,
            isCocktailTemplate,
            isHiTeaTemplate,
            locationIds,
        };
        try {
            if('id' in template) {
                await updateTemplate({ ...template, ...templateData } as MenuTemplate);
            } else {
                await addTemplate(templateData as Omit<MenuTemplate, 'id'>);
            }
            onCancel();
        } catch(e) {
            alert(`Error: ${e}`);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                <div className="flex items-center gap-4">
                    <button type="button" onClick={onCancel} className={iconButton('hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700')}><ArrowLeft size={20}/></button>
                    <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                        {isReadOnly ? 'View Template' : ('id' in template ? 'Edit Template' : 'Create New Template')}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {!isReadOnly && <button type="submit" className={primaryButton}><Save size={18}/> Save Template</button>}
                </div>
            </div>

             <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md grid grid-cols-1 md:grid-cols-3 gap-6">
                <input type="text" placeholder="Template Name" value={name} onChange={e => setName(e.target.value)} required readOnly={isReadOnly} className={inputStyle} />
                <input type="text" placeholder="Group (e.g., Wedding, Corporate)" value={group} onChange={e => setGroup(e.target.value)} readOnly={isReadOnly} className={inputStyle} list="template-groups"/>
                <datalist id="template-groups">
                    {templateGroups.map(g => <option key={g} value={g} />)}
                </datalist>
                <select value={catalogId} onChange={e => setCatalogId(e.target.value)} required disabled={isReadOnly} className={inputStyle}>
                    <option value="" disabled>Select a Catalog</option>
                    {catalogs.slice().sort((a,b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300 mb-1">Template Type</label>
                    <div className="flex gap-1 bg-warm-gray-100 dark:bg-warm-gray-700 p-1 rounded-md">
                        <button type="button" onClick={() => !isReadOnly && setType('non-veg')} className={`flex-1 p-2 rounded text-sm font-semibold transition-colors ${type === 'non-veg' ? 'bg-white dark:bg-warm-gray-800 shadow' : 'hover:bg-white/50'}`}>Non-Veg (Shows all categories)</button>
                        <button type="button" onClick={() => !isReadOnly && setType('veg')} className={`flex-1 p-2 rounded text-sm font-semibold transition-colors ${type === 'veg' ? 'bg-white dark:bg-warm-gray-800 shadow' : 'hover:bg-white/50'}`}>Veg (Shows only veg categories)</button>
                    </div>
                </div>
                <div className="md:col-span-3 flex flex-wrap gap-x-6 gap-y-2 items-center">
                    <div className="flex items-center">
                        <input id="isCocktailTemplate" type="checkbox" checked={isCocktailTemplate} onChange={e => {setIsCocktailTemplate(e.target.checked); if(e.target.checked) setIsHiTeaTemplate(false);}} disabled={isReadOnly} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                        <label htmlFor="isCocktailTemplate" className="ml-2 block text-sm text-warm-gray-900 dark:text-warm-gray-200">Cocktail/Snacks Template</label>
                    </div>
                     <div className="flex items-center">
                        <input id="isHiTeaTemplate" type="checkbox" checked={isHiTeaTemplate} onChange={e => {setIsHiTeaTemplate(e.target.checked); if(e.target.checked) setIsCocktailTemplate(false);}} disabled={isReadOnly} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"/>
                        <label htmlFor="isHiTeaTemplate" className="ml-2 block text-sm text-warm-gray-900 dark:text-warm-gray-200">Hi-Tea Template</label>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
                <h4 className="text-xl font-bold">Location Assignment</h4>
                <p className="text-sm text-warm-gray-500 mb-4">Assign this template to specific locations. Staff will only see templates for their assigned locations. Leave all unchecked to make it a global template, visible to all.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {locations.map(loc => (
                        <label key={loc.id} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={locationIds.includes(loc.id)}
                                onChange={() => handleLocationToggle(loc.id)}
                                disabled={isReadOnly}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span>{loc.name}</span>
                        </label>
                    ))}
                </div>
            </div>
            
            <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
                 <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold">Category Rules</h4>
                </div>
                <p className="text-sm text-warm-gray-500 mb-4">For each root category, specify the maximum number of items a user can select. Leave blank or 0 to exclude the category.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rootCategories.map(cat => (
                        <div key={cat.id}>
                            <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">{cat.name}</label>
                            <input
                                type="number"
                                value={rules[cat.id] || ''}
                                onChange={e => handleRuleChange(cat.id, e.target.value)}
                                placeholder="Max items"
                                min="0"
                                readOnly={isReadOnly}
                                className={inputStyle}
                            />
                        </div>
                    ))}
                </div>
                 <div className="mt-6 pt-6 border-t border-warm-gray-200 dark:border-warm-gray-700">
                    <h4 className="text-xl font-bold mb-2">Additional Rules</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Max Mutton Items</label>
                            <input
                                type="number"
                                value={muttonRules}
                                onChange={e => setMuttonRules(Number(e.target.value))}
                                placeholder="e.g., 2"
                                min="0"
                                readOnly={isReadOnly}
                                className={inputStyle}
                            />
                            <p className="text-xs text-warm-gray-500 mt-1">Total mutton items allowed across all categories.</p>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
};