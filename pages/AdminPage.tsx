import React, { useState, useMemo } from 'react';
import { useTemplates, useClients, useAppCategories, useItems, useOrders, useRecipes, usePlatters, useRawMaterials, useOrderTemplates, useUnits, useLiveCounters, useLiveCounterItems, useItemAccompaniments } from '../contexts/AppContexts';
import { useUserPermissions } from '../hooks/usePermissions';
import { Catalog, Client, Event, MenuTemplate, AppPermissions, UserRole, Order, Recipe, Platter, RawMaterial, OrderTemplate, LiveCounter, LiveCounterItem, Item, AppCategory, EventState, ItemAccompaniment } from '../types';
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
import { OrderManager } from '../features/orders/OrderManager';
import { OrderEditorPage } from '../features/orders/OrderEditorPage';
import { RecipeEditorPage } from '../features/RecipeEditorPage';
import { PlatterEditorPage } from '../features/platters/PlatterEditorPage';
import { yyyyMMDDToDate } from '../lib/utils';
import { MenuSummary } from '../features/menu-creator/MenuCreator';
import { exportToExcel, exportToPdf } from '../lib/export';
import { KitchenPlanPage } from '../features/kitchen-plan/KitchenPlanPage';
import { AccessDenied } from '../components/common/AccessDenied';
import { RecipeManager } from '../features/recipes/RecipeManager';
import { PlatterManager } from '../features/platters/PlatterManager';
import { RawMaterialsManager } from '../features/raw-materials/RawMaterialsManager';
import { OrderTemplatesManager } from '../features/orders/OrderTemplatesManager';
import { ScaleRecipeModal } from '../features/recipes/components/ScaleRecipeModal';
import Modal from '../components/Modal';
import { AlertTriangle, Download, FileSpreadsheet } from 'lucide-react';
import { secondaryButton } from '../components/common/styles';
import { AIAssistantPage } from '../features/ai-assistant/AIAssistantPage';

type EventFilter = 'upcoming' | 'leads' | 'finalize' | 'collect' | null;

// Main Admin Page Component
function AdminPage({ activePage, onNavigate, permissions, userRole, managedEvents, clients, clientListFilters, setClientListFilters, dashboardState, setDashboardState }: {
    activePage: 'dashboard' | 'clients' | 'itemBank' | 'catalogs' | 'templates' | 'liveCounters' | 'reports' | 'users' | 'audit' | 'dataHub' | 'settings' | 'orders' | 'orderTemplates' | 'platters' | 'recipes' | 'rawMaterials' | 'aiAssistant';
    onNavigate: (clientId: string) => void,
    permissions: AppPermissions,
    userRole: UserRole,
    managedEvents: Event[],
    clients: Client[],
    clientListFilters: { name: string; phone: string; status: "active" | "inactive" | "all"; eventState: 'all' | 'lead' | 'confirmed' | 'lost' | 'cancelled'; tasks: 'all' | 'overdue', startDate: string, endDate: string, creationStartDate: string, creationEndDate: string, referredBy: string, stateChangeFilters: { state: EventState, period: 'this_week' } | null, location: string[] },
    setClientListFilters: React.Dispatch<React.SetStateAction<{ name: string; phone: string; status: "active" | "inactive" | "all"; eventState: 'all' | 'lead' | 'confirmed' | 'lost' | 'cancelled'; tasks: 'all' | 'overdue', startDate: string, endDate: string, creationStartDate: string, creationEndDate: string, referredBy: string, stateChangeFilters: { state: EventState, period: 'this_week' } | null, location: string[] }>>,
    dashboardState: { view: 'grid' | 'calendar', dateFilter: string | null, activeFilter: EventFilter, selectedLocations: string[] },
    setDashboardState: React.Dispatch<React.SetStateAction<{ view: 'grid' | 'calendar', dateFilter: string | null, activeFilter: EventFilter, selectedLocations: string[] }>>
}) {
    // These states manage the full-page editor views
    // FIX: Changed state to allow Partial<T> to support creating new items with an empty object.
    const [editingTemplate, setEditingTemplate] = useState<MenuTemplate | Partial<MenuTemplate> | null>(null);
    const [editingCatalog, setEditingCatalog] = useState<Catalog | Partial<Catalog> | null>(null);
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
    const { settings: allAccompaniments } = useItemAccompaniments();
    const { liveCounters: allLiveCounters } = useLiveCounters();
    const { liveCounterItems: allLiveCounterItems } = useLiveCounterItems();
    const { addOrderTemplate } = useOrderTemplates();
    const { rawMaterials } = useRawMaterials();
    const { platters } = usePlatters();

    const handleEditOrder = (order: Order) => setEditingOrder(order);
    const handleAddOrder = () => setEditingOrder({} as Order);
    const handleSaveOrder = (orderData: Omit<Order, 'id'> | Order) => {
        if ('id' in orderData) {
            updateOrder(orderData);
        } else {
            addOrder(orderData);
        }
        setEditingOrder(null);
    };
    const handleDeleteOrder = (id: string) => {
        if (window.confirm("Are you sure you want to delete this order?")) {
            deleteOrder(id);
        }
    };
    
    const handleEditRecipe = (recipe: Recipe) => setEditingRecipe(recipe);
    const handleAddRecipe = () => setEditingRecipe({} as Recipe);
    const handleSaveRecipe = (recipeData: Omit<Recipe, 'id'> | Recipe) => {
        if ('id' in recipeData) {
            updateRecipe(recipeData);
        } else {
            addRecipe(recipeData);
        }
        setEditingRecipe(null);
    };
    const handleDeleteRecipe = (id: string) => {
        if (window.confirm("Are you sure you want to delete this recipe?")) {
            deleteRecipe(id);
        }
    };
    
    const handleEditPlatter = (platter: Platter) => setEditingPlatter(platter);
    const handleAddPlatter = () => setEditingPlatter({} as Platter);
    const handleSavePlatter = (platterData: Omit<Platter, 'id'> | Platter) => {
        if ('id' in platterData) {
            updatePlatter(platterData);
        } else {
            addPlatter(platterData);
        }
        setEditingPlatter(null);
    };
    const handleDeletePlatter = (id: string) => {
        if (window.confirm("Are you sure you want to delete this platter?")) {
            deletePlatter(id);
        }
    };

    const clientForKitchenMenu = clients.find(c => c.id === kitchenMenuEvent?.clientId);

    if (editingTemplate) {
        return <TemplateEditor template={editingTemplate} onCancel={() => setEditingTemplate(null)} isReadOnly={permissions.templates !== 'modify'} />;
    }
    if (editingCatalog) {
        return <CatalogEditor catalog={editingCatalog} onCancel={() => setEditingCatalog(null)} isReadOnly={permissions.catalogs !== 'modify'} />;
    }
    if (editingOrder) {
        return <OrderEditorPage order={editingOrder} onSave={handleSaveOrder} onBack={() => setEditingOrder(null)} />;
    }
    if (editingRecipe) {
        return <RecipeEditorPage recipe={editingRecipe} onSave={handleSaveRecipe} onBack={() => setEditingRecipe(null)} />;
    }
    if (editingPlatter) {
        return <PlatterEditorPage platter={editingPlatter} onSave={handleSavePlatter} onBack={() => setEditingPlatter(null)} />;
    }
    if (viewingKitchenPlan) {
        return <KitchenPlanPage event={viewingKitchenPlan} onCancel={() => setViewingKitchenPlan(null)} />;
    }

    const pageContent = () => {
        switch (activePage) {
            case 'dashboard':
                return permissions.dashboard !== 'none' ? <Dashboard 
                    onNavigate={onNavigate} 
                    managedEvents={managedEvents} 
                    clients={clients} 
                    showStats={true} 
                    onNavigateToMenu={userRole === 'kitchen' ? (event, state) => { 
                        if (state === 'KITCHEN_PLAN') setViewingKitchenPlan(event); 
                        else setKitchenMenuEvent(event);
                    } : undefined}
                    dashboardState={dashboardState} 
                    setDashboardState={setDashboardState} 
                /> : <AccessDenied />;
            case 'clients':
                return permissions.clientsAndEvents !== 'none' ? <ClientList clients={clients} events={managedEvents} onClientClick={onNavigate} filters={clientListFilters} setFilters={setClientListFilters} /> : <AccessDenied />;
            case 'itemBank':
                return permissions.itemBank !== 'none' ? <ItemManager permissions={permissions.itemBank}/> : <AccessDenied />;
            case 'catalogs':
                return permissions.catalogs !== 'none' ? <CatalogManager canModify={permissions.catalogs === 'modify'} onAddClick={() => setEditingCatalog({})} onEditClick={setEditingCatalog} /> : <AccessDenied />;
            case 'templates':
                return permissions.templates !== 'none' ? <TemplateManager canModify={permissions.templates === 'modify'} onAddClick={() => setEditingTemplate({})} onEditClick={setEditingTemplate} /> : <AccessDenied />;
            case 'liveCounters':
                return permissions.liveCounters !== 'none' ? <LiveCounterManager canModify={permissions.liveCounters === 'modify'}/> : <AccessDenied />;
            case 'reports':
                return permissions.reports !== 'none' ? <ReportsManager managedEvents={managedEvents} permissions={permissions} userRole={userRole} /> : <AccessDenied />;
            case 'users':
                return permissions.users !== 'none' ? <UserAndRoleManager canModify={permissions.users === 'modify'} /> : <AccessDenied />;
            case 'audit':
                return userRole === 'admin' ? <AuditLogViewer /> : <AccessDenied />;
            case 'dataHub':
                return userRole === 'admin' ? <DataManagementWizard /> : <AccessDenied />;
            case 'settings':
                return permissions.settings !== 'none' ? <SettingsManager canModify={permissions.settings === 'modify'} /> : <AccessDenied />;
            case 'aiAssistant':
                return userRole === 'admin' ? <AIAssistantPage events={managedEvents} clients={clients} /> : <AccessDenied />;
            // Kitchen User Pages
            case 'orders':
                return userRole === 'kitchen' ? <OrderManager orders={orders} onAdd={handleAddOrder} onEdit={handleEditOrder} onDelete={handleDeleteOrder} /> : <AccessDenied />;
            case 'recipes':
                return userRole === 'kitchen' ? <RecipeManager onAdd={handleAddRecipe} onEdit={handleEditRecipe} onDelete={handleDeleteRecipe} onScale={setScalingRecipe} /> : <AccessDenied />;
            case 'platters':
                 return userRole === 'kitchen' ? <PlatterManager onAdd={handleAddPlatter} onEdit={handleEditPlatter} onDelete={handleDeletePlatter} /> : <AccessDenied />;
            case 'rawMaterials':
                return userRole === 'kitchen' ? <RawMaterialsManager /> : <AccessDenied />;
            case 'orderTemplates':
                 return userRole === 'kitchen' ? <OrderTemplatesManager /> : <AccessDenied />;
            default:
                return <div>Page not found</div>;
        }
    };

    return (
        <div>
            {kitchenMenuEvent && clientForKitchenMenu && (
                <Modal isOpen={true} onClose={() => setKitchenMenuEvent(null)} title="View Menu" size="lg">
                    <MenuSummary event={kitchenMenuEvent} allItems={allItems} allCategories={allCategories} liveCounterMap={new Map(allLiveCounters.map(lc => [lc.id, lc]))} liveCounterItemMap={new Map(allLiveCounterItems.map(lci => [lci.id, lci]))} onRemoveItem={() => {}} isReadOnly={true}/>
                    <div className="mt-4 pt-4 border-t flex justify-end gap-2">
                        <button onClick={() => exportToPdf(kitchenMenuEvent, clientForKitchenMenu, allItems, allCategories, allLiveCounters, allLiveCounterItems, allAccompaniments)} className={secondaryButton}><Download size={16}/> Download PDF</button>
                        <button onClick={() => exportToExcel(kitchenMenuEvent, clientForKitchenMenu, allItems, allCategories, allLiveCounters, allLiveCounterItems)} className={secondaryButton}><FileSpreadsheet size={16} className="text-green-600"/> Excel</button>
                    </div>
                </Modal>
            )}
             {scalingRecipe && <ScaleRecipeModal recipe={scalingRecipe} rawMaterials={rawMaterials} onClose={() => setScalingRecipe(null)} />}
            {pageContent()}
        </div>
    );
}

export default AdminPage;