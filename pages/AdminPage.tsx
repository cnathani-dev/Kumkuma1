

import React, { useState } from 'react';
import { useTemplates, useClients, useAppCategories, useItems } from '../contexts/AppContexts';
import { useUserPermissions } from '../contexts/AuthContext';
import { Catalog, Client, Event, MenuTemplate, AppPermissions, UserRole } from '../types';
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
import { AlertTriangle } from 'lucide-react';

const AccessDenied = () => (
    <div className="text-center p-16 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md flex flex-col items-center gap-4">
        <div className="p-4 bg-accent-100 dark:bg-accent-900/50 rounded-full">
             <AlertTriangle size={48} className="text-accent-500" />
        </div>
        <h2 className="text-3xl font-display font-bold text-accent-500">Access Denied</h2>
        <p className="mt-2 text-warm-gray-500">You do not have the required permissions to view this page. Please contact your administrator.</p>
    </div>
);


// Main Admin Page Component
function AdminPage({ activePage, onNavigate, permissions, userRole, managedEvents, clients, clientListFilters, setClientListFilters }: {
    activePage: 'dashboard' | 'clients' | 'itemBank' | 'catalogs' | 'templates' | 'liveCounters' | 'reports' | 'users' | 'audit' | 'dataHub' | 'settings';
    onNavigate: (page: 'dashboard' | 'clients', clientId?: string, eventId?: string, action?: 'editEvent' | 'viewMenu') => void,
    permissions: AppPermissions,
    userRole: UserRole,
    managedEvents: Event[],
    clients: Client[],
    clientListFilters: { name: string; phone: string; status: "active" | "inactive" | "all"; eventState: 'all' | 'lead' | 'confirmed' | 'lost'; tasks: 'all' | 'overdue', startDate: string, endDate: string, creationStartDate: string, creationEndDate: string },
    setClientListFilters: React.Dispatch<React.SetStateAction<{ name: string; phone: string; status: "active" | "inactive" | "all"; eventState: 'all' | 'lead' | 'confirmed' | 'lost'; tasks: 'all' | 'overdue', startDate: string, endDate: string, creationStartDate: string, creationEndDate: string }>>
}) {
    // These states manage the full-page editor views for templates and catalogs
    const [editingTemplate, setEditingTemplate] = useState<MenuTemplate | null>(null);
    const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
    
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
    
    // Otherwise, render the main view based on the activePage prop
    const renderActivePage = () => {
        switch (activePage) {
            case 'dashboard':
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
            default:
                if (permissions.dashboard === 'none') return <AccessDenied />;
                return <Dashboard onNavigate={onNavigate} managedEvents={managedEvents} />;
        }
    }

    return (
        <div>
            {renderActivePage()}
        </div>
    );
}

export default AdminPage;
