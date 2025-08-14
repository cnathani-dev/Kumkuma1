

import React, { useState } from 'react';
import { useTemplates, useClients, useAppCategories, useItems } from '../App';
import { useUserPermissions } from '../contexts/AuthContext';
import { Catalog, Client, Event, MenuTemplate, AppPermissions } from '../types';
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


// Main Admin Page Component
function AdminPage({ activePage, onNavigate, permissions, managedEvents, clients, clientListFilters, setClientListFilters }: {
    activePage: 'dashboard' | 'clients' | 'itemBank' | 'catalogs' | 'templates' | 'liveCounters' | 'reports' | 'users' | 'audit' | 'dataHub' | 'settings';
    onNavigate: (page: 'dashboard' | 'clients', clientId?: string, eventId?: string, action?: 'editEvent' | 'viewMenu') => void,
    permissions: AppPermissions,
    managedEvents: Event[],
    clients: Client[],
    clientListFilters: { name: string, phone: string, status: 'active' | 'inactive' | 'all' },
    setClientListFilters: React.Dispatch<React.SetStateAction<{ name: string; phone: string; status: "active" | "inactive" | "all"; }>>
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
                return <Dashboard onNavigate={onNavigate} managedEvents={managedEvents} />;
            case 'clients':
                return <ClientList 
                            clients={clients} 
                            onNavigate={(page, clientId) => onNavigate(page, clientId)} 
                            filters={clientListFilters}
                            setFilters={setClientListFilters}
                        />;
            case 'itemBank':
                return <ItemManager permissions={permissions.itemBank} />;
            case 'catalogs':
                return <CatalogManager 
                            canModify={permissions.catalogs === 'modify'} 
                            onAddClick={() => setEditingCatalog({} as Catalog)} 
                            onEditClick={(catalog) => setEditingCatalog(catalog)} />;
            case 'templates':
                return <TemplateManager 
                            canModify={permissions.templates === 'modify'} 
                            onAddClick={() => setEditingTemplate({} as MenuTemplate)} 
                            onEditClick={(template) => setEditingTemplate(template)} />;
            case 'liveCounters':
                return <LiveCounterManager canModify={permissions.liveCounters === 'modify'} />;
            case 'reports':
                return <ReportsManager managedEvents={managedEvents} />;
            case 'users':
                return <UserAndRoleManager canModify={permissions.users === 'modify'} />;
            case 'audit':
                return <AuditLogViewer />;
            case 'dataHub':
                return <DataManagementWizard />;
            case 'settings':
                return <SettingsManager canModify={permissions.settings === 'modify'}/>;
            default:
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