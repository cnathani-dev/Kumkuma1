import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEvents, useItems, useAppCategories, useLiveCounters, useLiveCounterItems, useClients, useRecipes, useRawMaterials, useUnits, useOrders, usePlatters, useOrderTemplates } from '../contexts/AppContexts';
import { Event, Recipe, RecipeRawMaterial, Order, RawMaterial, Platter, OrderTemplate } from '../types';
import { LogOut, Calendar, Clock, MapPin, Users, Plus, Trash2, Edit, Scale, ChefHat, ShoppingCart, Utensils, Wheat, Upload, Merge, Box, Save } from 'lucide-react';
import { exportToPdfWithOptions } from '../lib/export';
import { dateToYYYYMMDD, formatYYYYMMDD, formatDateRange } from '../lib/utils';
import { primaryButton, secondaryButton, inputStyle, iconButton } from '../components/common/styles';
import { RecipeEditorPage } from '../features/RecipeEditorPage';
import { PlatterEditorPage } from '../features/platters/PlatterEditorPage';
import Modal from '../components/Modal';
import { OrderManager } from '../features/orders/OrderManager';
import { OrderEditorPage } from '../features/orders/OrderEditorPage';
import * as XLSX from 'xlsx';


const KitchenEventCard = ({ event, onClick }: { event: Event, onClick: () => void }) => {
    return (
        <div 
            onClick={onClick}
            className="p-5 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
            <h4 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200">{event.eventType}</h4>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-warm-gray-500 mt-2">
                <span className="flex items-center gap-1.5"><Calendar size={14}/> {formatDateRange(event.startDate, event.endDate)}</span>
                <span className="flex items-center gap-1.5"><Clock size={14}/> {event.session.charAt(0).toUpperCase() + event.session.slice(1)}</span>
                <span className="flex items-center gap-1.5"><MapPin size={14}/> {event.location}</span>
                <span className="flex items-center gap-1.5"><Users size={14}/> {event.pax || 0} PAX</span>
            </div>
        </div>
    );
};

const UpcomingEventsView = () => {
    const { events } = useEvents();
    const { items: allItems } = useItems();
    const { categories: allCategories } = useAppCategories();
    const { liveCounters } = useLiveCounters();
    const { liveCounterItems } = useLiveCounterItems();
    const { clients } = useClients();

    const confirmedEvents = useMemo(() => {
        const todayStr = dateToYYYYMMDD(new Date());
        return events
            .filter(e => e.state === 'confirmed' && e.startDate >= todayStr)
            .sort((a,b) => a.startDate.localeCompare(b.startDate));
    }, [events]);

    const handleEventClick = (event: Event) => {
        const client = clients.find(c => c.id === event.clientId);
        if (!client) {
            alert("Could not find the client for this event.");
            return;
        }
        try {
            exportToPdfWithOptions(event, client, allItems, allCategories, liveCounters, liveCounterItems, 'elegance');
        } catch (e) {
            console.error("Failed to generate PDF for kitchen user:", e);
            alert("Could not generate the menu PDF.");
        }
    };

    return (
        <div>
            {confirmedEvents.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {confirmedEvents.map(event => (
                         <KitchenEventCard 
                             key={event.id}
                             event={event}
                             onClick={() => handleEventClick(event)}
                         />
                     ))}
                 </div>
            ) : (
                <div className="text-center py-16">
                    <p className="text-warm-gray-500">There are no upcoming confirmed events at this time.</p>
                </div>
            )}
        </div>
    );
};

const RecipeScalerModal = ({ recipe, onClose }: { recipe: Recipe, onClose: () => void }) => {
    const [scaleBy, setScaleBy] = useState<'kg' | 'litres'>('kg');
    const [desiredOutput, setDesiredOutput] = useState<number | ''>('');
    const { rawMaterials } = useRawMaterials();
    const rawMaterialsMap = useMemo(() => new Map(rawMaterials.map(i => [i.id, i])), [rawMaterials]);

    const scaledRawMaterials = useMemo(() => {
        const baseOutput = scaleBy === 'kg' ? recipe.outputKg : recipe.outputLitres;
        const numDesiredOutput = Number(desiredOutput);

        if (!baseOutput || baseOutput <= 0 || !numDesiredOutput || numDesiredOutput <= 0) {
            return null;
        }

        const ratio = numDesiredOutput / baseOutput;
        return (recipe.rawMaterials || []).map(ing => {
            const details = rawMaterialsMap.get(ing.rawMaterialId);
            return {
                name: details?.name || 'Unknown',
                unit: details?.unit || '',
                scaledQuantity: ing.quantity * ratio
            };
        });
    }, [recipe, desiredOutput, scaleBy, rawMaterialsMap]);

    return (
        <Modal isOpen={!!recipe} onClose={onClose} title={`Scale Recipe: ${recipe.name}`}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Scale by</label>
                    <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-2"><input type="radio" value="kg" checked={scaleBy === 'kg'} onChange={() => setScaleBy('kg')} name="scaleBy" /> Kg</label>
                        <label className="flex items-center gap-2"><input type="radio" value="litres" checked={scaleBy === 'litres'} onChange={() => setScaleBy('litres')} name="scaleBy" /> Litres</label>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium">Desired Output ({scaleBy})</label>
                    <input type="number" value={desiredOutput} onChange={e => setDesiredOutput(e.target.value === '' ? '' : Number(e.target.value))} min="0" step="any" className={inputStyle} />
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
                <h4 className="font-semibold mb-2">Scaled Raw Material Quantities</h4>
                {scaledRawMaterials ? (
                    <ul className="space-y-1 text-sm max-h-60 overflow-y-auto">
                        {scaledRawMaterials.map((ing, i) => (
                            <li key={i} className="flex justify-between p-1 rounded hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50">
                                <span>{ing.name}</span>
                                <span className="font-semibold">{ing.scaledQuantity.toFixed(2)} {ing.unit}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-sm text-warm-gray-500 py-8">
                        Enter a desired output to see scaled quantities.
                    </p>
                )}
            </div>
        </Modal>
    );
};

const normalizeKeys = (obj: any) => {
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key.toLowerCase().trim()] = obj[key];
        }
    }
    return newObj;
};

const RecipesListView = ({ onAdd, onEdit }: { onAdd: () => void, onEdit: (recipe: Recipe) => void }) => {
    const { recipes, deleteRecipe, addMultipleRecipes } = useRecipes();
    const { rawMaterials } = useRawMaterials();
    const [scalingRecipe, setScalingRecipe] = useState<Recipe | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const handleDeleteRecipe = async (id: string) => {
        if(window.confirm("Are you sure you want to delete this recipe?")) {
            await deleteRecipe(id);
        }
    }
    
    const rawMaterialsMap = useMemo(() => new Map(rawMaterials.map(i => [i.id, i])), [rawMaterials]);

    const filteredAndSortedRecipes = useMemo(() => {
        const lowerCaseQuery = searchQuery.toLowerCase().trim();
        const filtered = lowerCaseQuery === '' 
            ? recipes
            : recipes.filter(recipe => {
                const nameMatch = recipe.name.toLowerCase().includes(lowerCaseQuery);
                if (nameMatch) return true;

                return recipe.rawMaterials.some(rm => {
                    const rawMaterialDetails = rawMaterialsMap.get(rm.rawMaterialId);
                    return rawMaterialDetails?.name.toLowerCase().includes(lowerCaseQuery);
                });
            });

        return filtered.sort((a,b) => a.name.localeCompare(b.name));
    }, [recipes, searchQuery, rawMaterialsMap]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawJson = XLSX.utils.sheet_to_json(worksheet);
                const json = rawJson.map(normalizeKeys);

                const importedCount = await addMultipleRecipes(json);
                alert(`Successfully imported ${importedCount} new recipes.`);
            } catch (error) {
                console.error("Import error:", error);
                alert(`Import failed: ${error}`);
            }
        };
        reader.readAsArrayBuffer(file);
    };


    return (
        <div>
            {scalingRecipe && <RecipeScalerModal recipe={scalingRecipe} onClose={() => setScalingRecipe(null)} />}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
                <input
                    type="text"
                    placeholder="Search recipes by name or raw material..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={inputStyle + " w-full sm:w-auto flex-grow"}
                />
                <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className={secondaryButton}><Upload size={16}/> Import</button>
                    <button onClick={onAdd} className={primaryButton}>
                        <Plus size={16}/> Create Recipe
                    </button>
                </div>
            </div>
             {filteredAndSortedRecipes.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-warm-gray-500">
                        {searchQuery ? `No recipes found matching "${searchQuery}".` : "No recipes have been created yet."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAndSortedRecipes.map(recipe => (
                        <div key={recipe.id} className="p-5 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200">{recipe.name}</h4>
                                <p className="text-sm font-semibold text-warm-gray-500">
                                    Yields: {recipe.outputKg > 0 ? `${recipe.outputKg} kg` : ''}{recipe.outputKg > 0 && recipe.outputLitres > 0 ? ' / ' : ''}{recipe.outputLitres > 0 ? `${recipe.outputLitres} L` : ''}
                                </p>
                                <p className="text-xs text-warm-gray-400 mt-2 line-clamp-3">{recipe.instructions}</p>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setScalingRecipe(recipe)} className={iconButton('hover:bg-blue-100')} title="Scale Recipe">
                                    <Scale size={16} className="text-blue-600"/>
                                </button>
                                <button onClick={() => onEdit(recipe)} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                                <button onClick={() => handleDeleteRecipe(recipe.id)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const RawMaterialsView = () => {
    const { rawMaterials, addRawMaterial, updateRawMaterial, deleteRawMaterial, mergeRawMaterials } = useRawMaterials();
    const { settings: units } = useUnits();
    const [name, setName] = useState('');
    const [unit, setUnit] = useState('');
    const [editing, setEditing] = useState<RawMaterial | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [mergeTarget, setMergeTarget] = useState<string>('');
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

    const handleSave = async () => {
        if (!name.trim() || !unit.trim()) {
            alert("Name and unit are required.");
            return;
        }

        if (editing) {
            await updateRawMaterial({ ...editing, name, unit });
        } else {
            await addRawMaterial({ name, unit });
        }
        setName('');
        setUnit('');
        setEditing(null);
    };

    const handleEdit = (rawMaterial: RawMaterial) => {
        setEditing(rawMaterial);
        setName(rawMaterial.name);
        setUnit(rawMaterial.unit);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure? This cannot be undone.")) {
            await deleteRawMaterial(id);
        }
    };
    
    const handleSelectionChange = (id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if(checked) newSet.add(id);
            else newSet.delete(id);
            return newSet;
        });
    }

    const handleOpenMergeModal = () => {
        setMergeTarget('');
        setIsMergeModalOpen(true);
    }

    const handleConfirmMerge = async () => {
        if (!mergeTarget) return;
        const sourceIds = Array.from(selectedIds).filter(id => id !== mergeTarget);
        if (sourceIds.length === 0) {
            alert("Cannot merge an item into itself.");
            return;
        }
        
        try {
            await mergeRawMaterials(sourceIds, mergeTarget);
            setSelectedIds(new Set());
            setIsMergeModalOpen(false);
        } catch(e) {
            alert(`Error merging: ${e}`);
        }
    };

    return (
        <div>
            {isMergeModalOpen && <Modal isOpen={true} onClose={() => setIsMergeModalOpen(false)} title="Merge Raw Materials">
                <div className="space-y-4">
                    <p>Select which raw material to keep. Others will be merged into it.</p>
                    <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} className={inputStyle}>
                        <option value="">-- Select Destination --</option>
                        {rawMaterials.filter(rm => selectedIds.has(rm.id)).map(rm => (
                            <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>
                        ))}
                    </select>
                     <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsMergeModalOpen(false)} className={secondaryButton}>Cancel</button>
                        <button type="button" onClick={handleConfirmMerge} disabled={!mergeTarget} className={primaryButton}>Confirm Merge</button>
                    </div>
                </div>
            </Modal>}
            <div className="flex justify-end items-center gap-4 mb-4">
                {selectedIds.size > 1 && (
                    <button onClick={handleOpenMergeModal} className={primaryButton}><Merge size={16}/> Merge ({selectedIds.size})</button>
                )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                     <h3 className="font-bold text-lg mb-4">{editing ? 'Edit' : 'Add'} Raw Material</h3>
                     <div className="space-y-3">
                         <input type="text" placeholder="Raw Material Name" value={name} onChange={e => setName(e.target.value)} className={inputStyle} />
                          <select value={unit} onChange={e => setUnit(e.target.value)} className={inputStyle}>
                            <option value="">-- Select Unit --</option>
                            {units.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                         </select>
                         <div className="flex gap-2">
                             <button onClick={handleSave} className={primaryButton}>{editing ? 'Update' : 'Add'}</button>
                             {editing && <button onClick={() => { setEditing(null); setName(''); setUnit(''); }} className={secondaryButton}>Cancel</button>}
                         </div>
                     </div>
                </div>
                <div className="lg:col-span-2 p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                     <div className="overflow-auto max-h-[70vh]">
                         <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-warm-gray-100 dark:bg-warm-gray-700">
                                <tr>
                                    <th className="p-2 w-8"></th>
                                    <th className="p-2 text-left font-semibold">Name</th>
                                    <th className="p-2 text-left font-semibold">Unit</th>
                                    <th className="p-2 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-warm-gray-200 dark:divide-warm-gray-600">
                                {rawMaterials.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(rm => (
                                    <tr key={rm.id}>
                                        <td className="p-2 text-center">
                                            <input type="checkbox" checked={selectedIds.has(rm.id)} onChange={e => handleSelectionChange(rm.id, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                                        </td>
                                        <td className="p-2 font-semibold">{rm.name}</td>
                                        <td className="p-2 text-warm-gray-500">{rm.unit}</td>
                                        <td className="p-2 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleEdit(rm)} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                                                <button onClick={() => handleDelete(rm.id)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PlattersView = ({ onAdd, onEdit }: { onAdd: () => void, onEdit: (platter: Platter) => void }) => {
    const { platters, deletePlatter } = usePlatters();
    const { recipes } = useRecipes();
    const recipeMap = useMemo(() => new Map(recipes.map(r => [r.id, r.name])), [recipes]);

    const handleDeletePlatter = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this platter?")) {
            await deletePlatter(id);
        }
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <button onClick={onAdd} className={primaryButton}>
                    <Plus size={16}/> Create Platter
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {platters.map(platter => (
                    <div key={platter.id} className="p-5 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200">{platter.name}</h4>
                            <ul className="list-disc pl-5 mt-2 text-sm text-warm-gray-600 dark:text-warm-gray-400">
                                {platter.recipes.map((r, i) => (
                                    <li key={i}>{recipeMap.get(r.recipeId) || 'Unknown Recipe'}: {r.quantityMl} ml</li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => onEdit(platter)} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                            <button onClick={() => handleDeletePlatter(platter.id)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TemplateNameForm = ({ onSave, onCancel, template }: {
    onSave: (data: {id?: string, name: string}) => void,
    onCancel: () => void,
    template: OrderTemplate | null,
}) => {
    const [name, setName] = useState(template?.name || '');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { name };
        if (template) onSave({ ...data, id: template.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    );
};

const OrderTemplatesView = () => {
    const { orderTemplates, updateOrderTemplate, deleteOrderTemplate } = useOrderTemplates();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<OrderTemplate | null>(null);

    const handleSave = async (data: {id?: string, name: string}) => {
        if (!editingTemplate || !data.id) return;
        try {
            await updateOrderTemplate({ ...editingTemplate, name: data.name });
            setIsModalOpen(false);
            setEditingTemplate(null);
        } catch (e) { alert(`Error: ${e}`); }
    };
    
    const handleDelete = async (id: string) => {
        if(window.confirm("Are you sure you want to delete this template?")) {
            await deleteOrderTemplate(id);
        }
    };

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
            {isModalOpen && editingTemplate && <Modal isOpen={true} onClose={() => setIsModalOpen(false)} title="Edit Order Template Name">
                <TemplateNameForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} template={editingTemplate} />
            </Modal>}
            <div className="flex justify-end mb-4">
                <p className="text-sm text-warm-gray-500 flex-grow">Order templates are created from the 'Orders' page by saving an existing order as a template.</p>
            </div>
            <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {orderTemplates.sort((a,b) => a.name.localeCompare(b.name)).map(template => (
                    <li key={template.id} className="py-2 flex justify-between items-center">
                        <span>{template.name}</span>
                        <div className="flex gap-1">
                             <button onClick={() => {setEditingTemplate(template); setIsModalOpen(true);}} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Rename Template">
                                <Edit size={16} className="text-primary-600" />
                            </button>
                            <button onClick={() => handleDelete(template.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Template">
                                <Trash2 size={16} className="text-accent-500" />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export const KitchenDashboardPage = () => {
    const { logout, currentUser } = useAuth();
    const { recipes, addRecipe, updateRecipe } = useRecipes();
    const { platters, addPlatter, updatePlatter } = usePlatters();
    const { orders, addOrder, updateOrder, deleteOrder } = useOrders();

    type PageState = 'dashboard' | 'recipes' | 'raw-materials' | 'orders' | 'platters' | 'order-templates';
    type EditorState = { type: 'recipe', data: Recipe | null } | { type: 'order', data: Order | null } | { type: 'platter', data: Platter | null };

    const [page, setPage] = useState<PageState>('dashboard');
    const [editor, setEditor] = useState<EditorState | null>(null);

    const handleSaveRecipe = (data: Omit<Recipe, 'id'> | Recipe) => {
        if ('id' in data) {
            updateRecipe(data);
        } else {
            addRecipe(data);
        }
        setEditor(null);
    };

    const handleSavePlatter = (data: Omit<Platter, 'id'> | Platter) => {
        if ('id' in data) {
            updatePlatter(data);
        } else {
            addPlatter(data);
        }
        setEditor(null);
    };

    const handleSaveOrder = (data: Omit<Order, 'id'> | Order) => {
        if ('id' in data) {
            updateOrder(data);
        } else {
            addOrder(data);
        }
        setEditor(null);
    };

    const navItems: { id: PageState, name: string, icon: React.ElementType }[] = [
        { id: 'dashboard', name: 'Upcoming Events', icon: Calendar },
        { id: 'orders', name: 'Production Orders', icon: ShoppingCart },
        { id: 'recipes', name: 'Recipes', icon: ChefHat },
        { id: 'platters', name: 'Platters', icon: Box },
        { id: 'raw-materials', name: 'Raw Materials', icon: Wheat },
        { id: 'order-templates', name: 'Order Templates', icon: Utensils },
    ];

    const renderPageContent = () => {
        switch (page) {
            case 'dashboard': return <UpcomingEventsView />;
            case 'recipes': return <RecipesListView onAdd={() => setEditor({ type: 'recipe', data: null })} onEdit={(r) => setEditor({ type: 'recipe', data: r })} />;
            case 'raw-materials': return <RawMaterialsView />;
            case 'platters': return <PlattersView onAdd={() => setEditor({ type: 'platter', data: null })} onEdit={(p) => setEditor({ type: 'platter', data: p })} />;
            case 'orders': return <OrderManager orders={orders} onAdd={() => setEditor({ type: 'order', data: null })} onEdit={(o) => setEditor({ type: 'order', data: o })} onDelete={deleteOrder} />;
            case 'order-templates': return <OrderTemplatesView />;
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-warm-gray-100 dark:bg-warm-gray-900">
            <header className="bg-white dark:bg-warm-gray-800 shadow-md p-4 flex justify-between items-center">
                 <div className="leading-none text-center">
                    <span className="font-display font-bold text-2xl text-accent-500 tracking-normal">kumkuma</span>
                    <span className="block font-body text-[0.6rem] text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.2em] uppercase">CATERERS</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold">Welcome, {currentUser?.username}</span>
                    <button onClick={logout} className="flex items-center gap-2 text-sm font-semibold p-2 rounded-md hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>
            <main className="p-8">
                {editor ? (
                    editor.type === 'recipe' ? <RecipeEditorPage recipe={editor.data} onSave={handleSaveRecipe} onBack={() => setEditor(null)} /> :
                    editor.type === 'platter' ? <PlatterEditorPage platter={editor.data} onSave={handleSavePlatter} onBack={() => setEditor(null)} /> :
                    editor.type === 'order' ? <OrderEditorPage order={editor.data} onSave={handleSaveOrder} onBack={() => setEditor(null)} /> : null
                ) : (
                    <>
                        <div className="border-b border-warm-gray-200 dark:border-warm-gray-700 mb-6">
                            <nav className="-mb-px flex space-x-8 overflow-x-auto">
                                {navItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setPage(item.id)}
                                        className={`flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${page === item.id
                                            ? 'border-primary-500 text-primary-600'
                                            : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700 hover:border-warm-gray-300'
                                        }`}
                                    >
                                        <item.icon size={16} /> {item.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                        {renderPageContent()}
                    </>
                )}
            </main>
        </div>
    );
};
