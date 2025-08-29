





import React, { useState, useEffect } from 'react';
import { User, AppPermissions, EventState, Event } from './types';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { ClientDetailsPage } from './pages/ClientDetailsPage';
import { MyTasksModal } from './features/tasks/components/MyTasksModal';
import { Settings, LogOut, ArrowLeft, Menu, X, LayoutGrid, Building, ListTree, BookCopy, FileText, Salad, AreaChart, Users as UsersIcon, History, Database, Wrench, Key, ListChecks, ChefHat, ClipboardList, ScrollText, Vegan, BookOpenCheck, Package, Loader2, Target } from 'lucide-react';
import { AuthProvider, useAuth, useUserPermissions } from './contexts/AuthContext';
import Modal from './components/Modal';
import { ChangePasswordForm } from './features/users/ChangePasswordForm';
import { useEvents, useClients } from './contexts/AppContexts';
import { secondaryButton, primaryButton } from './components/common/styles';
import { AppProviders } from './contexts/AppProviders';


function App() {
    const { currentUser, logout, isInitializing } = useAuth();
    const permissions = useUserPermissions();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    type PageName = 'dashboard' | 'clients' | 'itemBank' | 'catalogs' | 'templates' | 'liveCounters' | 'reports' | 'users' | 'audit' | 'dataHub' | 'settings' | 'orders' | 'orderTemplates' | 'platters' | 'recipes' | 'rawMaterials' | 'aiAssistant';
    
    // History stack to remember navigation state
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
    };

    type HistoryState = {
        page: PageName;
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
    
    // Lifted state
    const [dashboardState, setDashboardState] = useState<DashboardState>({
        view: 'calendar',
        dateFilter: null,
        activeFilter: 'upcoming',
        selectedLocations: [],
    });
    
    const [clientListFilters, setClientListFilters] = useState<ClientListFiltersState>({
        name: '', phone: '', status: 'active', eventState: 'all',
        tasks: 'all', startDate: '', endDate: '',
        creationStartDate: '', creationEndDate: '', referredBy: '',
        stateChangeFilters: null,
    });
    
    const { events } = useEvents();
    const { clients } = useClients();

    const handleNavigation = (pageName: PageName, newClientId?: string) => {
        setPage(pageName);
        setClientId(newClientId || null);
        setHistory([]); // Clear history on main navigation
    };
    
    const goToClientPage = (targetClientId: string) => {
        const currentState: HistoryState = {
            page,
            dashboardState,
            clientListFilters,
        };
        setHistory(prev => [...prev, currentState]);
        setClientId(targetClientId);
    };

    const handleBack = () => {
        const lastState = history[history.length - 1];
        if (lastState) {
            setPage(lastState.page);
            setDashboardState(lastState.dashboardState);
            setClientListFilters(lastState.clientListFilters);
            setHistory(prev => prev.slice(0, -1));
        } else {
            // Fallback if history is empty (e.g., direct URL access to a client page)
            // Going to the main client list is a sensible default.
            setPage('clients');
        }
        setClientId(null);
    };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const clientIdFromUrl = urlParams.get('clientId');
        
        if (clientIdFromUrl && currentUser && currentUser.role !== 'regular') {
            handleNavigation('clients', clientIdFromUrl);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) {
             if (currentUser.role === 'admin') {
                setPage('dataHub');
            } else if (currentUser.role === 'kitchen') {
                setPage('dashboard');
            }
        }
    }, [currentUser]);

    useEffect(() => {
        let intervalId: number | undefined;
        let isMounted = true;
        let runningVersion: string | null = null; // Set only once on load

        const checkVersion = async () => {
            try {
                // Fetch with cache-busting to establish the version at load time.
                const response = await fetch('/metadata.json?t=' + new Date().getTime(), { cache: 'no-store' });
                if (!isMounted) return;
                
                const metadata = await response.json();
                runningVersion = metadata.version;

                if (runningVersion && isMounted) {
                    setAppVersion(runningVersion);
                }

                if (!runningVersion) {
                    console.error("Could not determine current app version.");
                    return;
                }

                // Function to poll for updates
                const pollForUpdates = async () => {
                    try {
                        // Always fetch the latest version, bypassing any caches.
                        const serverResponse = await fetch('/metadata.json?t=' + new Date().getTime(), { cache: 'no-store' });
                        if (!isMounted) return;
                        
                        const serverMetadata = await serverResponse.json();

                        if (serverMetadata.version && runningVersion && serverMetadata.version !== runningVersion) {
                            setIsUpdateAvailable(true);
                            if (intervalId) clearInterval(intervalId);
                        }
                    } catch (error) {
                        console.log('Polling for version update failed (may be offline):', error);
                    }
                };
                
                // Poll every minute
                intervalId = window.setInterval(pollForUpdates, 60 * 1000); 
            } catch (error) {
                console.error("Could not establish initial app version:", error);
            }
        };

        checkVersion();

        return () => {
            isMounted = false;
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, []);

    if (isInitializing) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="animate-spin text-primary-500" size={48} />
            </div>
        );
    }
    
    if (!currentUser) {
        return <LoginPage />;
    }

    // Regular user logged in, show their details page
    if (currentUser.role === 'regular' && currentUser.assignedClientId) {
        return (
            <div className="flex flex-col h-screen">
                 <header className="flex items-center justify-between p-4 border-b border-warm-gray-200 dark:border-warm-gray-800 bg-white dark:bg-warm-gray-900 flex-shrink-0">
                    <div className="leading-none py-1 inline-block">
                        <span className="font-display font-bold text-2xl text-accent-500 tracking-wide">kumkuma</span>
                        <span className="block font-body font-normal text-xs text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.2em] uppercase">CATERERS</span>
                    </div>
                     <button onClick={logout} className={secondaryButton}>Logout</button>
                </header>
                <main className="flex-grow overflow-y-auto p-4 sm:p-6">
                    <ClientDetailsPage
                        clientId={currentUser.assignedClientId}
                        onBack={() => {}} // No back button needed for client view
                    />
                </main>
            </div>
        );
    }
    
    if (currentUser.role === 'staff' && !permissions) {
        return <div className="p-8 text-center">Loading permissions...</div>;
    }

    const NavItem = ({ icon: Icon, label, pageName, activePage, onNavigate }: { icon: React.ElementType, label: string, pageName: PageName, activePage: PageName, onNavigate: (p:PageName)=>void }) => {
        return (
            <li
                onClick={() => onNavigate(pageName)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${activePage === pageName ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 font-semibold' : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-800'}`}
            >
                <Icon size={20} />
                <span>{label}</span>
            </li>
        );
    }
    
    const KitchenNavItem = ({ icon: Icon, label, pageName, activePage, onNavigate }: { icon: React.ElementType, label: string, pageName: PageName, activePage: PageName, onNavigate: (p:PageName)=>void }) => (
         <li
            onClick={() => onNavigate(pageName)}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${activePage === pageName ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 font-semibold' : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-800'}`}
        >
            <Icon size={20} />
            <span>{label}</span>
        </li>
    );

    const navConfig = [
        { type: 'item', icon: LayoutGrid, label: 'Dashboard', pageName: 'dashboard', permissionKey: 'dashboard' },
        { type: 'item', icon: Building, label: 'Clients & Events', pageName: 'clients', permissionKey: 'clientsAndEvents' },
        { 
            type: 'group', 
            label: 'Food & Menu', 
            items: [
                { icon: ListTree, label: 'Item Bank', pageName: 'itemBank', permissionKey: 'itemBank' },
                { icon: BookCopy, label: 'Catalogs', pageName: 'catalogs', permissionKey: 'catalogs' },
                { icon: FileText, label: 'Templates', pageName: 'templates', permissionKey: 'templates' },
                { icon: Salad, label: 'Live Counters', pageName: 'liveCounters', permissionKey: 'liveCounters' },
            ]
        },
        {
            type: 'group',
            label: 'Management',
            items: [
                { icon: AreaChart, label: 'Reports', pageName: 'reports', permissionKey: 'reports' },
            ]
        },
        {
            type: 'group',
            label: 'Administration',
            adminOnly: true,
            items: [
                 { icon: UsersIcon, label: 'Users & Roles', pageName: 'users', permissionKey: 'users' },
                 { icon: History, label: 'Audit Logs', pageName: 'audit', permissionKey: 'users' }, // Use 'users' as a proxy for admin-only pages
                 { icon: Database, label: 'Data Hub', pageName: 'dataHub', permissionKey: 'users' },
                 { icon: Target, label: 'AI Assistant', pageName: 'aiAssistant', permissionKey: 'users' },
            ]
        },
        { type: 'item', icon: Wrench, label: 'Settings', pageName: 'settings', permissionKey: 'settings' },
    ];

    const sidebarContent = currentUser.role === 'kitchen' ? (
        <nav>
            <ul className="space-y-2">
                <KitchenNavItem icon={LayoutGrid} label="Dashboard" pageName="dashboard" activePage={page} onNavigate={p => handleNavigation(p)} />
                <KitchenNavItem icon={ClipboardList} label="Orders" pageName="orders" activePage={page} onNavigate={p => handleNavigation(p)} />
                <KitchenNavItem icon={ScrollText} label="Order Templates" pageName="orderTemplates" activePage={page} onNavigate={p => handleNavigation(p)} />
                <KitchenNavItem icon={Salad} label="Platters" pageName="platters" activePage={page} onNavigate={p => handleNavigation(p)} />
                <KitchenNavItem icon={BookOpenCheck} label="Recipes" pageName="recipes" activePage={page} onNavigate={p => handleNavigation(p)} />
                <KitchenNavItem icon={Package} label="Raw Materials" pageName="rawMaterials" activePage={page} onNavigate={p => handleNavigation(p)} />
            </ul>
        </nav>
    ) : (
        <nav>
            <ul className="space-y-2">
                {navConfig.map((navItem, index) => {
                    if (navItem.type === 'item') {
                        if (permissions?.[navItem.permissionKey as keyof AppPermissions] !== 'none') {
                            return <NavItem key={index} icon={navItem.icon} label={navItem.label} pageName={navItem.pageName as PageName} activePage={page} onNavigate={p => handleNavigation(p)} />;
                        }
                        return null;
                    }

                    if (navItem.type === 'group') {
                        if (navItem.adminOnly && currentUser.role !== 'admin') {
                            return null;
                        }
                        
                        const isGroupVisible = navItem.items.some(item => permissions?.[item.permissionKey as keyof AppPermissions] !== 'none');

                        if (isGroupVisible) {
                            return (
                                <li key={index}>
                                    <h4 className="text-xs font-bold uppercase text-warm-gray-400 pt-4 pb-1 px-3">{navItem.label}</h4>
                                    <ul className="space-y-2">
                                        {navItem.items.map((item, itemIndex) => {
                                             if (permissions?.[item.permissionKey as keyof AppPermissions] !== 'none') {
                                                return <NavItem key={itemIndex} icon={item.icon} label={item.label} pageName={item.pageName as PageName} activePage={page} onNavigate={p => handleNavigation(p)} />;
                                             }
                                             return null;
                                        })}
                                    </ul>
                                </li>
                            );
                        }
                        return null;
                    }
                    return null;
                })}
            </ul>
        </nav>
    );

    return (
        <div>
            {isUpdateAvailable && <UpdateModal />}
            {isChangePasswordModalOpen && <Modal isOpen={true} onClose={() => setIsChangePasswordModalOpen(false)} title="Change Password"><ChangePasswordForm onCancel={() => setIsChangePasswordModalOpen(false)} /></Modal>}
            {isMyTasksModalOpen && <MyTasksModal isOpen={true} onClose={() => setIsMyTasksModalOpen(false)} onNavigateToClient={(clientId) => {setIsMyTasksModalOpen(false); goToClientPage(clientId); }} />}
            <div className="flex h-screen">
                 {/* Sidebar */}
                <aside className={`fixed z-40 inset-y-0 left-0 w-64 bg-white dark:bg-warm-gray-900 border-r border-warm-gray-200 dark:border-warm-gray-800 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out flex flex-col`}>
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-between p-4 border-b border-warm-gray-200 dark:border-warm-gray-800">
                             <div className="leading-none py-1">
                                <span className="font-display font-bold text-2xl text-accent-500 tracking-wide">kumkuma</span>
                                <span className="block font-body font-normal text-xs text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.2em] uppercase">CATERERS</span>
                            </div>
                            <button onClick={() => setSidebarOpen(false)} className="md:hidden">
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto p-4">
                        {sidebarContent}
                    </div>
                    {appVersion && (
                        <div className="p-4 border-t border-warm-gray-200 dark:border-warm-gray-800 text-center text-xs text-warm-gray-500 flex-shrink-0">
                            Version {appVersion}
                        </div>
                    )}
                </aside>

                 {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    <header className="flex items-center justify-between p-4 border-b border-warm-gray-200 dark:border-warm-gray-800 bg-white dark:bg-warm-gray-900 sticky top-0 z-30">
                        <button onClick={() => setSidebarOpen(true)} className="md:hidden"><Menu size={24} /></button>
                        <div className="text-xl font-bold"></div> {/* Title removed to prevent duplication */}
                        <div className="flex items-center gap-4">
                            <button onClick={() => setIsMyTasksModalOpen(true)} className="relative" title="My Tasks">
                                <ListChecks size={22} />
                            </button>
                            <button onClick={() => setIsChangePasswordModalOpen(true)} title="Change Password">
                                <Key size={22} />
                            </button>
                            <button onClick={logout} className="flex items-center gap-2" title="Logout">
                                <LogOut size={22} />
                                <span className="text-sm hidden sm:inline">{currentUser.username}</span>
                            </button>
                        </div>
                    </header>
                    <main className="flex-grow overflow-y-auto p-4 sm:p-6">
                        {clientId ? 
                            <ClientDetailsPage 
                                clientId={clientId} 
                                onBack={handleBack} 
                            /> 
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
                    </main>
                </div>
            </div>
        </div>
    );
}

export default () => (
    <AuthProvider>
        <AppProviders>
            <App />
        </AppProviders>
    </AuthProvider>
);