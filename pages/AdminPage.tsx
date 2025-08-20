import React, { useState, useMemo } from 'react';
import { useTemplates, useClients, useAppCategories, useItems, useOrders, useRecipes, usePlatters, useRawMaterials, useOrderTemplates, useUnits, useLiveCounters, useLiveCounterItems } from '../contexts/AppContexts';
import { useUserPermissions } from '../contexts/AuthContext';
import { Catalog, Client, Event, MenuTemplate, AppPermissions, UserRole, Order, Recipe, Platter, RawMaterial, OrderTemplate, LiveCounter, LiveCounterItem, Item, AppCategory } from '../types';
import { AuditLogViewer } from '../features/audit/AuditLogViewer';
import { CatalogEditor, CatalogManager } from '../features/catalogs/CatalogManager';
import { ClientList } from '../features/clients/ClientList';
import { Dashboard } from '../features/dashboard/Dashboard';
import { DataManagementWizard } from '../features/data-hub/DataManagementWizard';
import { ItemManager } from '../features/item-bank/ItemManager';
import { LiveCounterManager } from '../features/live-counters/LiveCounterManager';
import { ReportsManager } from '../features/reports/ReportsManager';
import { SettingsManager } from '../features/settings/SettingsManager';
import { TemplateEditor, TemplateManager } from '../features/templates/TemplateManager';
import { UserAndRoleManager } from '../features/users/UserAndRoleManager';
import { AlertTriangle, Plus, Edit, Trash2, Save, FileSpreadsheet, Palette, Scale, Download } from 'lucide-react';
import { OrderManager } from '../features/orders/OrderManager';
import { OrderEditorPage } from '../features/orders/OrderEditorPage';
import { RecipeEditorPage } from '../features/RecipeEditorPage';
import { PlatterEditorPage } from '../features/platters/PlatterEditorPage';
import { iconButton, inputStyle, primaryButton, secondaryButton } from '../components/common/styles';
import Modal from '../components/Modal';
import { v4 as uuidv4 } from 'uuid';
import { yyyyMMDDToDate } from '../lib/utils';
import { MenuSummary } from '../features/menu-creator/MenuCreator';
import { exportToExcel, exportToPdfWithOptions, exportOrderTemplateToPdf } from '../lib/export';
import { KitchenPlanPage } from '../features/kitchen-plan/KitchenPlanPage';

const AccessDenied = () => (
    <div className="text-center p-16 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md flex flex-col items-center gap-4">
        <div className="p-4 bg-accent-100 dark:bg-accent-900/50 rounded-full">
             <AlertTriangle size={48} className="text-accent-500" />
        </div>
        <h2 className="text-3xl font-display font-bold text-accent-500">Access Denied</h2>
        <p className="mt-2 text-warm-gray-500">You do not have the required permissions to view this page. Please contact your administrator.</p>
    </div>
);

// --- KITCHEN UI COMPONENTS ---
// To avoid creating new files, these simple manager components are defined here.
const ScaleRecipeModal = ({ recipe, rawMaterials, onClose }: {
    recipe: Recipe;
    rawMaterials: RawMaterial[];
    onClose: () => void;
}) => {
    const originalOutput = recipe.yieldQuantity;
    const originalUnit = recipe.yieldUnit;
    
    const [desiredOutput, setDesiredOutput] = useState(originalOutput);

    const rawMaterialMap = useMemo(() => new Map(rawMaterials.map(rm => [rm.id, rm])), [rawMaterials]);

    const scaledIngredients = useMemo(() => {
        if (!desiredOutput || !originalOutput) return [];
        const ratio = desiredOutput / originalOutput;
        return recipe.rawMaterials.map(rm => {
            const details = rawMaterialMap.get(rm.rawMaterialId);
            return {
                name: details?.name || 'Unknown',
                unit: details?.unit || '',
                scaledQuantity: rm.quantity * ratio,
            };
        });
    }, [recipe, desiredOutput, originalOutput, rawMaterialMap]);

    return (
        <Modal isOpen={true} onClose={onClose} title={`Scale Recipe: ${recipe.name}`}>
            <div className="space-y-4">
                <div className="p-4 bg-warm-gray-50 dark:bg-warm-gray-700/50 rounded-lg">
                    <p className="font-semibold">Original Yield</p>
                    <p className="text-2xl font-bold">{originalOutput} {originalUnit}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium">Desired Yield</label>
                        <input
                            type="number"
                            value={desiredOutput}
                            onChange={e => setDesiredOutput(Number(e.target.value))}
                            min="0"
                            step="any"
                            className={inputStyle}
                        />
                    </div>
                    <div>
                         <p className={inputStyle + " bg-warm-gray-100 dark:bg-warm-gray-700"}>{originalUnit}</p>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                    <h4 className="font-bold">Scaled Ingredients</h4>
                    {scaledIngredients.length === 0 ? (
                        <p className="text-warm-gray-500">No ingredients to scale.</p>
                    ) : (
                        <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700 max-h-60 overflow-y-auto mt-2 pr-2">
                           {scaledIngredients.map((ing, i) => (
                               <li key={i} className="py-2 flex justify-between">
                                   <span>{ing.name}</span>
                                   <span className="font-semibold">{ing.scaledQuantity.toFixed(2)} {ing.unit}</span>
                               </li>
                           ))}
                        </ul>
                    )}
                </div>
                <div className="flex justify-end pt-4">
                     <button type="button" onClick={onClose} className={secondaryButton}>Close</button>
                </div>
            </div>
        </Modal>
    );
};


const RecipeManager: React.FC<{ onAdd: () => void, onEdit: (recipe: Recipe) => void, onDelete: (id: string) => void, onScale: (recipe: Recipe) => void }> = ({ onAdd, onEdit, onDelete, onScale }) => {
    const { recipes } = useRecipes();
    const { rawMaterials } = useRawMaterials();
    const [searchTerm, setSearchTerm] = useState('');

    const rawMaterialMap = useMemo(() => new Map(rawMaterials.map(rm => [rm.id, rm.name])), [rawMaterials]);

    const filteredRecipes = useMemo(() => {
        const lowerCaseSearch = searchTerm.toLowerCase().trim();
        if (!lowerCaseSearch) {
            return recipes.sort((a, b) => a.name.localeCompare(b.name));
        }

        return recipes.filter(recipe => {
            if (recipe.name.toLowerCase().includes(lowerCaseSearch)) {
                return true;
            }
            return recipe.rawMaterials.some(rm => {
                const rawMaterialName = rawMaterialMap.get(rm.rawMaterialId);
                return rawMaterialName?.toLowerCase().includes(lowerCaseSearch);
            });
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [recipes, searchTerm, rawMaterialMap]);

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <button onClick={onAdd} className={primaryButton}><Plus size={16}/> Add Recipe</button>
            </div>
             <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search by recipe or raw material name..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={inputStyle}
                />
            </div>
            {recipes.length > 0 && filteredRecipes.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                    <p className="text-warm-gray-500">No recipes match your search.</p>
                </div>
            ) : recipes.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                    <p className="text-warm-gray-500">No recipes have been created yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map(recipe => (
                        <div key={recipe.id} className="bg-white dark:bg-warm-gray-800 rounded-lg shadow-md p-5 flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200 truncate">{recipe.name}</h4>
                                <p className="text-sm text-warm-gray-500 mt-1">
                                    Yields: {recipe.yieldQuantity || 0} {recipe.yieldUnit}
                                </p>
                                <p className="text-sm text-warm-gray-500">
                                    {recipe.rawMaterials.length} raw material(s)
                                </p>
                            </div>
                            <div className="flex justify-end gap-1 mt-4 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
                                <button onClick={() => onScale(recipe)} className={iconButton('hover:bg-green-100 dark:hover:bg-green-800')} title="Scale Recipe"><Scale size={16} className="text-green-600"/></button>
                                <button onClick={() => onEdit(recipe)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')}><Edit size={16} className="text-primary-600"/></button>
                                <button onClick={() => onDelete(recipe.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')}><Trash2 size={16} className="text-accent-500"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const PlatterManager: React.FC<{ onAdd: () => void, onEdit: (platter: Platter) => void, onDelete: (id: string) => void }> = ({ onAdd, onEdit, onDelete }) => {
    const { platters } = usePlatters();
    return (
        <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex justify-end items-center mb-4">
                <button onClick={onAdd} className={primaryButton}><Plus size={16}/> Add Platter</button>
            </div>
            <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {platters.sort((a,b) => a.name.localeCompare(b.name)).map(platter => (
                    <li key={platter.id} className="py-2 flex justify-between items-center">
                        <span>{platter.name}</span>
                        <div className="flex gap-1">
                            <button onClick={() => onEdit(platter)} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                            <button onClick={() => onDelete(platter.id)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const RawMaterialForm = ({ onSave, onCancel, material }: { onSave: (data: Omit<RawMaterial, 'id'> | RawMaterial) => void, onCancel: () => void, material: RawMaterial | null }) => {
    const [name, setName] = useState(material?.name || '');
    const { settings: units } = useUnits();
    const [unit, setUnit] = useState(material?.unit || (units.length > 0 ? units[0].name : ''));
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (material) onSave({ id: material.id, name, unit });
        else onSave({ name, unit });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Material Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <select value={unit} onChange={e => setUnit(e.target.value)} required className={inputStyle}>
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    );
};

const RawMaterialsManager: React.FC<{}> = () => {
    const { rawMaterials, addRawMaterial, updateRawMaterial, deleteRawMaterial } = useRawMaterials();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<RawMaterial | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleSave = async (data: Omit<RawMaterial, 'id'> | RawMaterial) => {
        if ('id' in data) await updateRawMaterial(data);
        else await addRawMaterial(data);
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => window.confirm("Are you sure?") && deleteRawMaterial(id);

    const filteredRawMaterials = useMemo(() => {
        return rawMaterials
            .filter(material => material.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rawMaterials, searchTerm]);

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            {isModalOpen && <Modal isOpen={true} onClose={() => setIsModalOpen(false)} title={editing ? "Edit Raw Material" : "Add Raw Material"}>
                <RawMaterialForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} material={editing} />
            </Modal>}
            <div className="flex justify-end items-center mb-4">
                <button onClick={() => { setEditing(null); setIsModalOpen(true); }} className={primaryButton}><Plus size={16}/> Add Material</button>
            </div>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search raw materials..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={inputStyle}
                />
            </div>
             <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {filteredRawMaterials.map(mat => (
                    <li key={mat.id} className="py-2 flex justify-between items-center">
                        <span>{mat.name} <span className="text-sm text-warm-gray-500">({mat.unit})</span></span>
                        <div className="flex gap-1">
                            <button onClick={() => { setEditing(mat); setIsModalOpen(true); }} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                            <button onClick={() => handleDelete(mat.id)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const OrderTemplatesManager: React.FC<{}> = () => {
    const { orderTemplates, deleteOrderTemplate } = useOrderTemplates();
    const { recipes } = useRecipes();
    const { platters } = usePlatters();
    
    const handleDelete = (id: string) => window.confirm("Are you sure?") && deleteOrderTemplate(id);

    const handleDownload = (template: OrderTemplate) => {
        exportOrderTemplateToPdf(template, recipes, platters);
    };

    return (
         <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            <p className="text-sm text-warm-gray-500 mb-4">Order templates can be created from the "Save as Template" button on an order's edit screen.</p>
            <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {orderTemplates.sort((a,b) => a.name.localeCompare(b.name)).map(template => (
                    <li key={template.id} className="py-2 flex justify-between items-center">
                        <span>{template.name}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleDownload(template)} className={iconButton('hover:bg-green-100 dark:hover:bg-green-800/50')} title="Download Order Form">
                                <Download size={16} className="text-green-600"/>
                            </button>
                            <button onClick={() => handleDelete(template.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800/50')} title="Delete Template">
                                <Trash2 size={16} className="text-accent-500"/>
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
};


// Main Admin Page Component
function AdminPage({ activePage, onNavigate, permissions, userRole, managedEvents, clients, clientListFilters, setClientListFilters }: {
    activePage: 'dashboard' | 'clients' | 'itemBank' | 'catalogs' | 'templates' | 'liveCounters' | 'reports' | 'users' | 'audit' | 'dataHub' | 'settings' | 'orders' | 'orderTemplates' | 'platters' | 'recipes' | 'rawMaterials';
    onNavigate: (page: 'dashboard' | 'clients', clientId?: string, eventId?: string, action?: 'editEvent' | 'viewMenu') => void,
    permissions: AppPermissions,
    userRole: UserRole,
    managedEvents: Event[],
    clients: Client[],
    clientListFilters: { name: string; phone: string; status: "active" | "inactive" | "all"; eventState: 'all' | 'lead' | 'confirmed' | 'lost' | 'cancelled'; tasks: 'all' | 'overdue', startDate: string, endDate: string, creationStartDate: string, creationEndDate: string },
    setClientListFilters: React.Dispatch<React.SetStateAction<{ name: string; phone: string; status: "active" | "inactive" | "all"; eventState: 'all' | 'lead' | 'confirmed' | 'lost' | 'cancelled'; tasks: 'all' | 'overdue', startDate: string, endDate: string, creationStartDate: string, creationEndDate: string }>>
}) {
    // These states manage the full-page editor views
    const [editingTemplate, setEditingTemplate] = useState<MenuTemplate | null>(null);
    const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [editingPlatter, setEditingPlatter] = useState<Platter | null>(null);
    const [kitchenMenuEvent, setKitchenMenuEvent] = useState<Event | null>(null);
    const [viewingKitchenPlan, setViewingKitchenPlan] = useState<Event | null>(null);
    const [scalingRecipe, setScalingRecipe] = useState<Recipe | null>(null);

    // Context Hooks
    const { orders, addOrder, updateOrder, deleteOrder } = useOrders();
    const { addRecipe, updateRecipe, deleteRecipe } = useRecipes();
    const { addPlatter, updatePlatter, deletePlatter } = usePlatters();
    const { items: allItems } = useItems();
    const { categories: allCategories } = useAppCategories();
    const { liveCounters } = useLiveCounters();
    const { liveCounterItems } = useLiveCounterItems();
    const { rawMaterials } = useRawMaterials();

    // Create maps for MenuSummary and PDF export
    const liveCounterMap = useMemo(() => new Map(liveCounters.map(lc => [lc.id, lc])), [liveCounters]);
    const liveCounterItemMap = useMemo(() => new Map(liveCounterItems.map(lci => [lci.id, lci])), [liveCounterItems]);
    
    // Editor Save Handlers
    const handleSaveOrder = async (data: Omit<Order, 'id'> | Order) => {
        if ('id' in data) {
            await updateOrder(data);
            setEditingOrder(data); // Keep editor open with updated data
        } else {
            const newId = await addOrder(data);
            const newOrderWithId = { ...data, id: newId };
            setEditingOrder(newOrderWithId); // Keep editor open with the newly created order
        }
    };
    const handleSaveRecipe = async (data: Omit<Recipe, 'id'> | Recipe) => {
        if ('id' in data) {
            await updateRecipe(data as Recipe);
            setEditingRecipe(data as Recipe); // Keep editor open with updated data
        } else {
            const newId = await addRecipe(data);
            const newRecipeWithId = { ...data, id: newId };
            setEditingRecipe(newRecipeWithId); // Keep editor open with the newly created recipe
        }
    };
     const handleSavePlatter = (data: Omit<Platter, 'id'> | Platter) => {
        if ('id' in data) updatePlatter(data); else addPlatter(data);
        setEditingPlatter(null);
    };
    
    const handleKitchenNavigation = (event: Event, state: 'MENU_CREATOR' | 'KITCHEN_PLAN') => {
        if (state === 'MENU_CREATOR') {
            if (event.templateId && event.templateId !== 'NO_FOOD') {
                setKitchenMenuEvent(event);
            } else {
                alert("This event has no associated menu to view.");
            }
        } else if (state === 'KITCHEN_PLAN') {
            setViewingKitchenPlan(event);
        }
    };

    // If an editor is active, render it exclusively
    if (editingTemplate) {
        return <TemplateEditor 
                    template={editingTemplate} 
                    onCancel={() => setEditingTemplate(null)}
                    isReadOnly={permissions.templates !== 'modify'}
                />
    }
    if (editingCatalog) {
        return <CatalogEditor 
                    catalog={editingCatalog} 
                    onCancel={() => setEditingCatalog(null)}
                    isReadOnly={permissions.catalogs !== 'modify'}
                />
    }
    if (editingOrder) {
        return <OrderEditorPage order={editingOrder} onSave={handleSaveOrder} onBack={() => setEditingOrder(null)} />
    }
    if (editingRecipe) {
        return <RecipeEditorPage recipe={editingRecipe} onSave={handleSaveRecipe} onBack={() => setEditingRecipe(null)} />
    }
    if (editingPlatter) {
        return <PlatterEditorPage platter={editingPlatter} onSave={handleSavePlatter} onBack={() => setEditingPlatter(null)} />
    }
    if (viewingKitchenPlan) {
        return <KitchenPlanPage event={viewingKitchenPlan} onCancel={() => setViewingKitchenPlan(null)} />
    }
    
    // Otherwise, render the main view based on the activePage prop
    const renderActivePage = () => {
        switch (activePage) {
            case 'dashboard':
                if (userRole === 'kitchen') {
                    const kitchenEventsFilter = (allEvents: Event[]): Event[] => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const fifteenDaysFromNow = new Date(today);
                        fifteenDaysFromNow.setDate(today.getDate() + 15);
            
                        return allEvents.filter(event => {
                            if (event.state !== 'confirmed') return false;
                            const eventStart = yyyyMMDDToDate(event.startDate);
                            return eventStart >= today && eventStart <= fifteenDaysFromNow;
                        });
                    };
                    return <Dashboard 
                        onNavigate={onNavigate} 
                        managedEvents={managedEvents} 
                        showStats={false}
                        eventsFilter={kitchenEventsFilter}
                        onNavigateToMenu={handleKitchenNavigation}
                    />;
                }
                if (permissions.dashboard === 'none') return <AccessDenied />;
                return <Dashboard onNavigate={onNavigate} managedEvents={managedEvents} />;
            case 'clients':
                if (permissions.clientsAndEvents === 'none') return <AccessDenied />;
                return <ClientList 
                            clients={clients} 
                            events={managedEvents}
                            onNavigate={(page, clientId) => onNavigate(page, clientId)} 
                            filters={clientListFilters}
                            setFilters={setClientListFilters}
                        />;
            case 'itemBank':
                if (permissions.itemBank === 'none') return <AccessDenied />;
                return <ItemManager permissions={permissions.itemBank} />;
            case 'catalogs':
                if (permissions.catalogs === 'none') return <AccessDenied />;
                return <CatalogManager 
                            canModify={permissions.catalogs === 'modify'} 
                            onAddClick={() => setEditingCatalog({} as Catalog)} 
                            onEditClick={(catalog) => setEditingCatalog(catalog)} />;
            case 'templates':
                if (permissions.templates === 'none') return <AccessDenied />;
                return <TemplateManager 
                            canModify={permissions.templates === 'modify'} 
                            onAddClick={() => setEditingTemplate({} as MenuTemplate)} 
                            onEditClick={(template) => setEditingTemplate(template)} />;
            case 'liveCounters':
                if (permissions.liveCounters === 'none') return <AccessDenied />;
                return <LiveCounterManager canModify={permissions.liveCounters === 'modify'} />;
            case 'reports':
                if (permissions.reports === 'none') return <AccessDenied />;
                return <ReportsManager managedEvents={managedEvents} />;
            case 'users':
                if (permissions.users === 'none') return <AccessDenied />;
                return <UserAndRoleManager canModify={permissions.users === 'modify'} />;
            case 'audit':
                if (userRole !== 'admin') return <AccessDenied />;
                return <AuditLogViewer />;
            case 'dataHub':
                if (userRole !== 'admin') return <AccessDenied />;
                return <DataManagementWizard />;
            case 'settings':
                if (permissions.settings === 'none') return <AccessDenied />;
                return <SettingsManager canModify={permissions.settings === 'modify'}/>;
            
            // Kitchen Pages
            case 'orders':
                return <OrderManager orders={orders} onAdd={() => setEditingOrder({} as Order)} onEdit={setEditingOrder} onDelete={deleteOrder} />;
            case 'recipes':
                return <RecipeManager onAdd={() => setEditingRecipe({} as Recipe)} onEdit={setEditingRecipe} onDelete={deleteRecipe} onScale={setScalingRecipe} />;
            case 'platters':
                return <PlatterManager onAdd={() => setEditingPlatter({} as Platter)} onEdit={setEditingPlatter} onDelete={deletePlatter} />;
            case 'rawMaterials':
                return <RawMaterialsManager />;
            case 'orderTemplates':
                return <OrderTemplatesManager />;

            default:
                if (userRole !== 'kitchen' && permissions.dashboard === 'none') return <AccessDenied />;
                return <Dashboard onNavigate={onNavigate} managedEvents={managedEvents} />;
        }
    }

    return (
        <div>
            {scalingRecipe && <ScaleRecipeModal recipe={scalingRecipe} rawMaterials={rawMaterials} onClose={() => setScalingRecipe(null)} />}
            {kitchenMenuEvent && (
                <Modal 
                    isOpen={true} 
                    onClose={() => setKitchenMenuEvent(null)} 
                    title={`Menu for: ${kitchenMenuEvent.eventType}`}
                    size="lg"
                >
                    <div className="max-h-[70vh] overflow-y-auto">
                        {kitchenMenuEvent.status === 'draft' ? (
                            <div className="p-4 text-center bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                                <AlertTriangle className="mx-auto mb-2 text-amber-500" size={32}/>
                                <h4 className="font-bold text-amber-800 dark:text-amber-200">Menu is in Draft</h4>
                                <p className="text-sm text-amber-700 dark:text-amber-300">This menu has not been finalized and is subject to change. You can download a preliminary version below.</p>
                            </div>
                        ) : (
                            <MenuSummary
                                event={kitchenMenuEvent}
                                allItems={allItems}
                                allCategories={allCategories}
                                liveCounterMap={liveCounterMap}
                                liveCounterItemMap={liveCounterItemMap}
                                onRemoveItem={() => {}} // Kitchen user cannot remove items
                                isReadOnly={true}
                            />
                        )}
                    </div>
                    <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                        <button onClick={() => {
                            const client = clients.find(c => c.id === kitchenMenuEvent.clientId);
                            if (client) exportToPdfWithOptions(kitchenMenuEvent, client, allItems, allCategories, liveCounters, liveCounterItems, 'elegance');
                        }} className={secondaryButton}><Palette size={16} className="text-amber-700"/> PDF (Elegance)</button>
                        <button onClick={() => {
                            const client = clients.find(c => c.id === kitchenMenuEvent.clientId);
                            if (client) exportToPdfWithOptions(kitchenMenuEvent, client, allItems, allCategories, liveCounters, liveCounterItems, 'modern');
                        }} className={secondaryButton}><Palette size={16} className="text-red-500" /> PDF (Modern)</button>
                        <button onClick={() => {
                            const client = clients.find(c => c.id === kitchenMenuEvent.clientId);
                            if (client) exportToPdfWithOptions(kitchenMenuEvent, client, allItems, allCategories, liveCounters, liveCounterItems, 'vibrant');
                        }} className={secondaryButton}><Palette size={16} className="text-green-600"/> PDF (Vibrant)</button>
                        <button onClick={() => {
                             const client = clients.find(c => c.id === kitchenMenuEvent.clientId);
                             if(client) exportToExcel(kitchenMenuEvent, client, allItems, allCategories, liveCounters, liveCounterItems);
                        }} className={secondaryButton}><FileSpreadsheet size={16} className="text-green-600"/> Excel</button>
                    </div>
                </Modal>
            )}
            {renderActivePage()}
        </div>
    );
}

export default AdminPage;