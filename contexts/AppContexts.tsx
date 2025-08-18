

import { createContext, useContext } from 'react';
import {
    Role,
    AuditLog,
    Catalog,
    Client,
    Event,
    Item,
    AppCategory,
    MenuTemplate,
    User,
    FinancialSetting,
    LocationSetting,
    ServiceArticle,
    ItemAccompaniment,
    EventTypeSetting,
    RawMaterial,
    Recipe,
    ItemsContextType,
    ItemAccompanimentsContextType,
    AppCategoriesContextType,
    EventsContextType,
    RawMaterialsContextType,
    RecipesContextType,
    LiveCounter,
    LiveCounterItem,
    RestaurantSetting,
    RestaurantsContextType,
    Order,
    OrdersContextType,
    OrderTemplate,
    OrderTemplatesContextType,
    PlattersContextType,
    ActivitiesContextType,
    ClientTasksContextType,
    MuhurthamDatesContextType,
} from '../types';

// --- CONTEXTS ---
type RolesContextType = {
    roles: Role[];
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    updateRole: (role: Role) => Promise<void>;
    deleteRole: (roleId: string) => Promise<void>;
};
export const RolesContext = createContext<RolesContextType | undefined>(undefined);
export const useRoles = () => {
    const context = useContext(RolesContext);
    if (!context) throw new Error('useRoles must be used within a RolesProvider');
    return context;
};

type AuditLogsContextType = {
    auditLogs: AuditLog[];
}
export const AuditLogsContext = createContext<AuditLogsContextType | undefined>(undefined);
export const useAuditLogs = () => {
    const context = useContext(AuditLogsContext);
    if (!context) throw new Error('useAuditLogs must be used within an AuditLogsProvider');
    return context;
}

type CatalogsContextType = {
    catalogs: Catalog[];
    addCatalog: (catalog: Omit<Catalog, 'id'>) => Promise<void>;
    updateCatalog: (catalog: Catalog) => Promise<void>;
    deleteCatalog: (catalogId: string) => Promise<void>;
    deleteAllCatalogs: () => Promise<void>;
    addMultipleCatalogs: (catalogsToAdd: { name: string; description: string; items: string[] }[]) => Promise<void>;
};
export const CatalogsContext = createContext<CatalogsContextType | undefined>(undefined);
export const useCatalogs = () => {
    const context = useContext(CatalogsContext);
    if (!context) throw new Error('useCatalogs must be used within a CatalogsProvider');
    return context;
};

type LiveCountersContextType = {
    liveCounters: LiveCounter[];
    addLiveCounter: (lc: Omit<LiveCounter, 'id'>) => Promise<string>;
    updateLiveCounter: (lc: LiveCounter) => Promise<void>;
    deleteLiveCounter: (lcId: string) => Promise<void>;
    addMultipleLiveCounters: (lcs: Omit<LiveCounter, 'id'>[]) => Promise<Map<string, string>>;
    deleteAllLiveCountersAndItems: () => Promise<void>;
    updateMultipleLiveCounters: (countersToUpdate: {id: string, displayRank: number}[]) => Promise<void>;
}
export const LiveCountersContext = createContext<LiveCountersContextType | undefined>(undefined);
export const useLiveCounters = () => {
    const context = useContext(LiveCountersContext);
    if(!context) throw new Error('useLiveCounters must be used within a LiveCountersProvider');
    return context;
}

type LiveCounterItemsContextType = {
    liveCounterItems: LiveCounterItem[];
    addLiveCounterItem: (lci: Omit<LiveCounterItem, 'id'>) => Promise<void>;
    updateLiveCounterItem: (lci: LiveCounterItem) => Promise<void>;
    deleteLiveCounterItem: (lciId: string) => Promise<void>;
    addMultipleLiveCounterItems: (lcitems: Omit<LiveCounterItem, 'id'>[]) => Promise<void>;
    updateMultipleLiveCounterItems: (itemsToUpdate: {id: string, displayRank: number}[]) => Promise<void>;
}
export const LiveCounterItemsContext = createContext<LiveCounterItemsContextType | undefined>(undefined);
export const useLiveCounterItems = () => {
    const context = useContext(LiveCounterItemsContext);
    if(!context) throw new Error('useLiveCounterItems must be used within a LiveCounterItemsProvider');
    return context;
}
type ClientsContextType = {
    clients: Client[];
    addClient: (client: Omit<Client, 'id'>) => Promise<string>;
    updateClient: (client: Client) => Promise<void>;
    deleteClient: (clientId: string) => Promise<void>;
    deleteAllClients: () => Promise<void>;
    addSampleData: () => Promise<void>;
    deleteSampleData: () => Promise<void>;
}
export const ClientsContext = createContext<ClientsContextType | undefined>(undefined);
export const useClients = () => {
    const context = useContext(ClientsContext);
    if (!context) throw new Error('useClients must be used within a ClientsProvider');
    return context;
};

export const EventsContext = createContext<EventsContextType | undefined>(undefined);
export const useEvents = () => {
    const context = useContext(EventsContext);
    if (!context) throw new Error('useEvents must be used within a EventsProvider');
    return context;
};

export const ItemsContext = createContext<ItemsContextType | undefined>(undefined);
export const useItems = () => {
    const context = useContext(ItemsContext);
    if (!context) throw new Error('useItems must be used within an ItemsProvider');
    return context;
};

export const AppCategoriesContext = createContext<AppCategoriesContextType | undefined>(undefined);
export const useAppCategories = () => {
    const context = useContext(AppCategoriesContext);
    if (!context) throw new Error('useAppCategories must be used within a AppCategoriesProvider');
    return context;
};

type TemplatesContextType = {
    templates: MenuTemplate[];
    addTemplate: (template: Omit<MenuTemplate, 'id'>) => Promise<void>;
    updateTemplate: (template: MenuTemplate) => Promise<void>;
    deleteTemplate: (templateId: string) => Promise<void>;
    deleteAllTemplates: () => Promise<void>;
};
export const TemplatesContext = createContext<TemplatesContextType | undefined>(undefined);
export const useTemplates = () => {
    const context = useContext(TemplatesContext);
    if (!context) throw new Error('useTemplates must be used within a TemplatesProvider');
    return context;
};

type UsersContextType = {
    users: User[];
    addUser: (user: Omit<User, 'id'>) => Promise<string>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
};
export const UsersContext = createContext<UsersContextType | undefined>(undefined);
export const useUsers = () => {
    const context = useContext(UsersContext);
    if (!context) throw new Error('useUsers must be used within a UsersProvider');
    return context;
};

type FinancialSettingContextType = {
    settings: FinancialSetting[];
    addSetting: (name: string) => Promise<void>;
    updateSetting: (id: string, name: string) => Promise<void>;
    deleteSetting: (id: string) => Promise<void>;
};

export const ChargeTypesContext = createContext<FinancialSettingContextType | undefined>(undefined);
export const useChargeTypes = () => {
    const context = useContext(ChargeTypesContext);
    if (!context) throw new Error('useChargeTypes must be used within a ChargeTypesProvider');
    return context;
};
export const ExpenseTypesContext = createContext<FinancialSettingContextType | undefined>(undefined);
export const useExpenseTypes = () => {
    const context = useContext(ExpenseTypesContext);
    if (!context) throw new Error('useExpenseTypes must be used within a ExpenseTypesProvider');
    return context;
};
export const PaymentModesContext = createContext<FinancialSettingContextType | undefined>(undefined);
export const usePaymentModes = () => {
    const context = useContext(PaymentModesContext);
    if (!context) throw new Error('usePaymentModes must be used within a PaymentModesProvider');
    return context;
};
export const ReferralSourcesContext = createContext<FinancialSettingContextType | undefined>(undefined);
export const useReferralSources = () => {
    const context = useContext(ReferralSourcesContext);
    if (!context) throw new Error('useReferralSources must be used within a ReferralSourcesProvider');
    return context;
};

type ServiceArticlesContextType = {
    settings: ServiceArticle[];
    addSetting: (name: string) => Promise<void>;
    updateSetting: (id: string, name: string) => Promise<void>;
    deleteSetting: (id: string) => Promise<void>;
};

export const ServiceArticlesContext = createContext<ServiceArticlesContextType | undefined>(undefined);
export const useServiceArticles = () => {
    const context = useContext(ServiceArticlesContext);
    if (!context) throw new Error('useServiceArticles must be used within a ServiceArticlesProvider');
    return context;
};

export const ItemAccompanimentsContext = createContext<ItemAccompanimentsContextType | undefined>(undefined);
export const useItemAccompaniments = () => {
    const context = useContext(ItemAccompanimentsContext);
    if (!context) throw new Error('useItemAccompaniments must be used within an ItemAccompanimentsProvider');
    return context;
};

export const UnitsContext = createContext<FinancialSettingContextType | undefined>(undefined);
export const useUnits = () => {
    const context = useContext(UnitsContext);
    if (!context) throw new Error('useUnits must be used within a UnitsProvider');
    return context;
};

type EventTypesContextType = {
    settings: EventTypeSetting[];
    addSetting: (name: string) => Promise<void>;
    updateSetting: (id: string, name: string) => Promise<void>;
    deleteSetting: (id: string) => Promise<void>;
};

export const EventTypesContext = createContext<EventTypesContextType | undefined>(undefined);
export const useEventTypes = () => {
    const context = useContext(EventTypesContext);
    if (!context) throw new Error('useEventTypes must be used within an EventTypesProvider');
    return context;
}

type LocationsContextType = {
    locations: LocationSetting[];
    addLocation: (location: Omit<LocationSetting, 'id'>) => Promise<void>;
    updateLocation: (location: LocationSetting) => Promise<void>;
    deleteLocation: (id: string) => Promise<void>;
    updateMultipleLocations: (locationsToUpdate: {id: string, displayRank: number}[]) => Promise<void>;
}
export const LocationsContext = createContext<LocationsContextType | undefined>(undefined);
export const useLocations = () => {
    const context = useContext(LocationsContext);
    if (!context) throw new Error('useLocations must be used within a LocationsProvider');
    return context;
};

export const RawMaterialsContext = createContext<RawMaterialsContextType | undefined>(undefined);
export const useRawMaterials = () => {
    const context = useContext(RawMaterialsContext);
    if (!context) throw new Error('useRawMaterials must be used within a RawMaterialsProvider');
    return context;
};

export const RecipesContext = createContext<RecipesContextType | undefined>(undefined);
export const useRecipes = () => {
    const context = useContext(RecipesContext);
    if (!context) throw new Error('useRecipes must be used within a RecipesProvider');
    return context;
};

export const RestaurantsContext = createContext<RestaurantsContextType | undefined>(undefined);
export const useRestaurants = () => {
    const context = useContext(RestaurantsContext);
    if (!context) throw new Error('useRestaurants must be used within a RestaurantsProvider');
    return context;
};

export const OrdersContext = createContext<OrdersContextType | undefined>(undefined);
export const useOrders = () => {
    const context = useContext(OrdersContext);
    if (!context) throw new Error('useOrders must be used within an OrdersProvider');
    return context;
};

export const OrderTemplatesContext = createContext<OrderTemplatesContextType | undefined>(undefined);
export const useOrderTemplates = () => {
    const context = useContext(OrderTemplatesContext);
    if (!context) throw new Error('useOrderTemplates must be used within an OrderTemplatesProvider');
    return context;
};

export const PlattersContext = createContext<PlattersContextType | undefined>(undefined);
export const usePlatters = () => {
    const context = useContext(PlattersContext);
    if (!context) throw new Error('usePlatters must be used within a PlattersProvider');
    return context;
};

export const ActivitiesContext = createContext<ActivitiesContextType | undefined>(undefined);
export const useActivities = () => {
    const context = useContext(ActivitiesContext);
    if (!context) throw new Error('useActivities must be used within an ActivitiesProvider');
    return context;
};

export const ClientTasksContext = createContext<ClientTasksContextType | undefined>(undefined);
export const useClientTasks = () => {
    const context = useContext(ClientTasksContext);
    if (!context) throw new Error('useClientTasks must be used within a ClientTasksProvider');
    return context;
};

export const MuhurthamDatesContext = createContext<MuhurthamDatesContextType | undefined>(undefined);
export const useMuhurthamDates = () => {
    const context = useContext(MuhurthamDatesContext);
    if (!context) throw new Error('useMuhurthamDates must be used within a MuhurthamDatesProvider');
    return context;
};