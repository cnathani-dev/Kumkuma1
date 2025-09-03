import React, { useState, useEffect } from 'react';
import { User, AppPermissions, EventState, Event } from '../types';
import AdminPage from '../pages/AdminPage';
import { ClientDetailsPage } from '../pages/ClientDetailsPage';
import { MyTasksModal } from '../features/tasks/components/MyTasksModal';
import { Settings, LogOut, Menu, X, LayoutGrid, Building, ListTree, BookCopy, FileText, Salad, AreaChart, Users as UsersIcon, History, Database, Wrench, Key, ListChecks, ChefHat, ClipboardList, ScrollText, BookOpenCheck, Package, Loader2, Target, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserPermissions } from '../hooks/usePermissions';
import Modal from '../components/Modal';
import { ChangePasswordForm } from '../features/users/ChangePasswordForm';
import { useEvents, useClients } from '../contexts/AppContexts';
import { secondaryButton, primaryButton } from '../components/common/styles';

type PageName = 'dashboard' | 'clients' | 'itemBank' | 'catalogs' | 'templates' | 'liveCounters' | 'reports' | 'users' | 'audit' | 'dataHub' | 'settings' | 'orders' | 'orderTemplates' | 'platters' | 'recipes' | 'rawMaterials' | 'aiAssistant';
    
interface NavSubItemConfig {
    icon: React.ElementType;
    label: string;
    pageName: PageName;
    permissionKey: keyof AppPermissions;
}

interface NavItemConfig extends NavSubItemConfig {
    type: 'item';
}

interface NavGroupConfig {
    type: 'group';
    label: string;
    adminOnly?: boolean;
    items: NavSubItemConfig[];
}

type NavConfigItem = NavItemConfig | NavGroupConfig;

const MainLayout = () => {
    const { currentUser, logout } = useAuth();
    const permissions = useUserPermissions();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    
    type DashboardState = {
        view: 'grid' | 'calendar';
        dateFilter: string | null;
        activeFilter: 'upcoming' | 'leads' | 'finalize' | 'collect' | null;
        selectedLocations: string[];
    };
    
    type ClientListFiltersState = {
        name: string; phone: string; status: 'active' | 'inactive' | 'all';
        eventState: 'all' | 'lead' | 'confirmed' | 'lost' | 'cancelled';
        tasks: 'all' | 'overdue'; startDate: string; endDate: string;
        creationStartDate: string; creationEndDate: string; referredBy: string;
        stateChangeFilters: { state: EventState, period: 'this_week' } | null;
        location: string[];
    };

    type HistoryState = {
        page: PageName;
        clientId: string | null;
        dashboardState: DashboardState;
        clientListFilters: ClientListFiltersState;
    };

    const [history, setHistory] = useState<HistoryState[]>([]);

    const [page, setPage] = useState<PageName>('dashboard');
    const [clientId, setClientId] = useState<string | null>(null);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [isMyTasksModalOpen, setIsMyTasksModalOpen] = useState(false);
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [appVersion, setAppVersion] = useState<string>('');
    
    const UpdateModal = () => (
      <div className="fixed inset-0 bg-warm-gray-900 bg-opacity-80 z-[100] flex items-center justify-center p-4 text-center">
        <div className="bg-white dark:bg-warm-gray-800 p-8 rounded-lg shadow-2xl max-w-sm w-full border-t-4 border-primary-500">
          <h3 className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400">Update Required</h3>
          <p className="mt-4 text-warm-gray-600 dark:text-warm-gray-300">
            A new version has been deployed. You must refresh the application to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className={`${primaryButton} mt-6 w-full`}
          >
            Refresh Now
          </button>
        </div>
      </div>
    );
    
    const [dashboardState, setDashboardState] = useState<DashboardState>({
        view: 'calendar',
        dateFilter: null,
        activeFilter: null,
        selectedLocations: [],
    });
    
    const [clientListFilters, setClientListFilters] = useState<ClientListFiltersState>({
        name: '', phone: '', status: 'active', eventState: 'all',
        tasks: 'all', startDate: '', endDate: '',
        creationStartDate: '', creationEndDate: '', referredBy: '',
        stateChangeFilters: null,
        location: [],
    });
    
    const { events } = useEvents();
    const { clients } = useClients();

    const handleNavigation = (pageName: PageName, newClientId?: string) => {
        setPage(pageName);
        setClientId(newClientId || null);
        setHistory([]);
        setSidebarOpen(false);
    };
    
    const goToClientPage = (targetClientId: string) => {
        const currentState: HistoryState = { page, clientId, dashboardState, clientListFilters };
        setHistory(prev => [...prev, currentState]);
        setClientId(targetClientId);
    };

    const handleBack = () => {
        const lastState = history.pop();
        if (lastState) {
            setPage(lastState.page);
            setClientId(lastState.clientId);
            setDashboardState(lastState.dashboardState);
            setClientListFilters(lastState.clientListFilters);
            setHistory([...history]);
        } else {
            setClientId(null);
            setPage(currentUser?.role === 'kitchen' ? 'dashboard' : 'clients');
        }
    };

    useEffect(() => {
        if (currentUser) {
            if (currentUser.role === 'regular' && currentUser.assignedClientId) {
                setClientId(currentUser.assignedClientId);
            } else if (currentUser.role !== 'regular' && !clientId) {
                // Only set default page if not already on a client detail page
                const initialPage: PageName = currentUser.role === 'kitchen' ? 'dashboard' : 'dashboard';
                setPage(initialPage);
            }
        }
    }, [currentUser, clientId]);

    useEffect(() => {
        let intervalId: number | undefined;
        let isMounted = true;
        let runningVersion: string | null = null;

        const checkVersion = async () => {
            try {
                const response = await fetch('/metadata.json?t=' + new Date().getTime(), { cache: 'no-store' });
                if (!isMounted) return;
                const metadata = await response.json();
                runningVersion = metadata.version;
                if (runningVersion && isMounted) setAppVersion(runningVersion);
                if (!runningVersion) return;
                intervalId = window.setInterval(async () => {
                    try {
                        const serverResponse = await fetch('/metadata.json?t=' + new Date().getTime(), { cache: 'no-store' });
                        if (!isMounted) return;
                        const serverMetadata = await serverResponse.json();
                        if (serverMetadata.version && runningVersion && serverMetadata.version !== runningVersion) {
                            setIsUpdateAvailable(true);
                            if (intervalId) clearInterval(intervalId);
                        }
                    } catch (error) {}
                }, 60 * 1000);
            } catch (error) {}
        };
        checkVersion();
        return () => { isMounted = false; if (intervalId) clearInterval(intervalId); };
    }, []);

    if (!currentUser || (currentUser.role === 'staff' && !permissions)) {
        return (
            <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary-500" size={48} /></div>
        );
    }
    
    const NavItem = ({ icon: Icon, label, pageName, activePage, onNavigate }: { icon: React.ElementType, label: string, pageName: PageName, activePage: PageName, onNavigate: (p:PageName)=>void }) => (
        <li onClick={() => onNavigate(pageName)} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${activePage === pageName && !clientId ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 font-semibold' : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-800'}`}>
            <Icon size={20} /><span>{label}</span>
        </li>
    );
    
    const navConfig: NavConfigItem[] = [
        { type: 'item', icon: LayoutGrid, label: 'Dashboard', pageName: 'dashboard', permissionKey: 'dashboard' },
        { type: 'item', icon: Building, label: 'Clients & Events', pageName: 'clients', permissionKey: 'clientsAndEvents' },
        { type: 'group', label: 'Food & Menu', items: [
            { icon: ListTree, label: 'Item Bank', pageName: 'itemBank', permissionKey: 'itemBank' },
            { icon: BookCopy, label: 'Catalogs', pageName: 'catalogs', permissionKey: 'catalogs' },
            { icon: FileText, label: 'Templates', pageName: 'templates', permissionKey: 'templates' },
            { icon: Salad, label: 'Live Counters', pageName: 'liveCounters', permissionKey: 'liveCounters' },
        ]},
        { type: 'group', label: 'Management', items: [{ icon: AreaChart, label: 'Reports', pageName: 'reports', permissionKey: 'reports' }] },
        { type: 'group', label: 'Administration', adminOnly: true, items: [
             { icon: UsersIcon, label: 'Users & Roles', pageName: 'users', permissionKey: 'users' },
             { icon: History, label: 'Audit Logs', pageName: 'audit', permissionKey: 'users' },
             { icon: Database, label: 'Data Hub', pageName: 'dataHub', permissionKey: 'users' },
             { icon: Sparkles, label: 'AI Assistant', pageName: 'aiAssistant', permissionKey: 'users' },
        ]},
        { type: 'item', icon: Wrench, label: 'Settings', pageName: 'settings', permissionKey: 'settings' },
    ];

    const sidebarContent = currentUser.role === 'kitchen' ? (
        <nav><ul className="space-y-2">
            <NavItem icon={LayoutGrid} label="Dashboard" pageName="dashboard" activePage={page} onNavigate={p => handleNavigation(p)} />
            <NavItem icon={ClipboardList} label="Orders" pageName="orders" activePage={page} onNavigate={p => handleNavigation(p)} />
            <NavItem icon={ScrollText} label="Order Templates" pageName="orderTemplates" activePage={page} onNavigate={p => handleNavigation(p)} />
            <NavItem icon={Salad} label="Platters" pageName="platters" activePage={page} onNavigate={p => handleNavigation(p)} />
            <NavItem icon={BookOpenCheck} label="Recipes" pageName="recipes" activePage={page} onNavigate={p => handleNavigation(p)} />
            <NavItem icon={Package} label="Raw Materials" pageName="rawMaterials" activePage={page} onNavigate={p => handleNavigation(p)} />
        </ul></nav>
    ) : (
        <nav><ul className="space-y-2">{navConfig.map((navItem, index) => {
            if (navItem.type === 'item') {
                if (permissions?.[navItem.permissionKey as keyof AppPermissions] !== 'none') {
                    return <NavItem key={index} {...navItem} activePage={page} onNavigate={p => handleNavigation(p)} />;
                } return null;
            }
            if (navItem.type === 'group') {
                if (navItem.adminOnly && currentUser.role !== 'admin') return null;
                const isGroupVisible = navItem.items.some(item => permissions?.[item.permissionKey as keyof AppPermissions] !== 'none');
                if (isGroupVisible) {
                    return (<li key={index}><h4 className="text-xs font-bold uppercase text-warm-gray-400 pt-4 pb-1 px-3">{navItem.label}</h4><ul className="space-y-2">{navItem.items.map((item, itemIndex) => {
                        if (permissions?.[item.permissionKey as keyof AppPermissions] !== 'none') {
                           return <NavItem key={itemIndex} {...item} activePage={page} onNavigate={p => handleNavigation(p)} />;
                        } return null;
                    })}</ul></li>);
                } return null;
            } return null;
        })}</ul></nav>
    );

    return (
        <div>
            {isUpdateAvailable && <UpdateModal />}
            {isChangePasswordModalOpen && <Modal isOpen={true} onClose={() => setIsChangePasswordModalOpen(false)} title="Change Password"><ChangePasswordForm onCancel={() => setIsChangePasswordModalOpen(false)} /></Modal>}
            {isMyTasksModalOpen && <MyTasksModal isOpen={true} onClose={() => setIsMyTasksModalOpen(false)} onNavigateToClient={(clientId) => {setIsMyTasksModalOpen(false); goToClientPage(clientId); }} />}
            <div className="flex h-screen bg-ivory dark:bg-warm-gray-950">
                <aside className={`fixed z-40 inset-y-0 left-0 w-64 bg-white dark:bg-warm-gray-900 border-r border-warm-gray-200 dark:border-warm-gray-800 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out flex flex-col`}>
                    <div className="flex-shrink-0"><div className="flex items-center justify-between p-4 border-b border-warm-gray-200 dark:border-warm-gray-800">
                        <div className="leading-none py-1"><span className="font-display font-bold text-2xl text-accent-500 tracking-wide">kumkuma</span><span className="block font-body font-normal text-xs text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.2em] uppercase">CATERERS</span></div>
                        <button onClick={() => setSidebarOpen(false)} className="md:hidden"><X size={24} /></button>
                    </div></div>
                    <div className="flex-grow overflow-y-auto p-4">{sidebarContent}</div>
                    {appVersion && (<div className="p-4 border-t border-warm-gray-200 dark:border-warm-gray-800 text-center text-xs text-warm-gray-500 flex-shrink-0">Version {appVersion}</div>)}
                </aside>
                <div className="flex-1 flex flex-col"><header className="flex items-center justify-between p-4 border-b border-warm-gray-200 dark:border-warm-gray-800 bg-white dark:bg-warm-gray-900 sticky top-0 z-30">
                    <button onClick={() => setSidebarOpen(true)} className="md:hidden"><Menu size={24} /></button>
                    <div className="text-xl font-bold"></div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMyTasksModalOpen(true)} className="relative" title="My Tasks"><ListChecks size={22} /></button>
                        <button onClick={() => setIsChangePasswordModalOpen(true)} title="Change Password"><Key size={22} /></button>
                        <button onClick={logout} className="flex items-center gap-2" title="Logout"><LogOut size={22} /><span className="text-sm hidden sm:inline">{currentUser.username}</span></button>
                    </div>
                </header>
                <main className="flex-grow overflow-y-auto p-4 sm:p-6">
                    {clientId ? 
                        <ClientDetailsPage clientId={clientId} onBack={handleBack} /> 
                        : <AdminPage 
                            activePage={page} 
                            onNavigate={goToClientPage}
                            permissions={permissions!}
                            userRole={currentUser.role}
                            managedEvents={events}
                            clients={clients}
                            clientListFilters={clientListFilters}
                            setClientListFilters={setClientListFilters}
                            dashboardState={dashboardState}
                            setDashboardState={setDashboardState}
                        />}
                </main></div>
            </div>
        </div>
    );
};
export default MainLayout;