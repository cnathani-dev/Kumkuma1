

import React, { useState, createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { Item, MenuTemplate, User, AppCategory, ItemType, Event, Client, LiveCounter, LiveCounterItem, AuditLog, Catalog, FinancialSetting, LocationSetting, Role, AppPermissions, PermissionLevel, EventState, ServiceArticle, ItemAccompaniment, ItemsContextType, ItemAccompanimentsContextType, AppCategoriesContextType, EventsContextType, EventTypeSetting, StateChangeHistoryEntry } from './types';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { ClientDetailsPage } from './pages/ClientDetailsPage';
import { v4 as uuidv4 } from 'uuid';
import { Settings, LogOut, ArrowLeft, Menu, X, LayoutGrid, Building, ListTree, BookCopy, FileText, Salad, AreaChart, Users as UsersIcon, History, Database, Wrench, Key } from 'lucide-react';
import { db } from './firebase';
import {
    collection,
    onSnapshot,
    updateDoc,
    deleteDoc,
    doc,
    writeBatch,
    getDocs,
    setDoc,
    query,
    where,
    getDoc,
    addDoc,
    DocumentReference,
    arrayUnion,
    arrayRemove,
    WriteBatch,
} from 'firebase/firestore';
import { cleanForFirebase, dateToYYYYMMDD, formatYYYYMMDD } from './lib/utils';
import { AuthProvider, useAuth, useUserPermissions } from './contexts/AuthContext';
import { logAuditEvent } from './lib/audit';
import { KitchenDashboardPage } from './pages/KitchenDashboardPage';
import Modal from './components/Modal';
import { ChangePasswordForm } from './features/users/ChangePasswordForm';


// --- MOCK DATA ---
const INITIAL_CATEGORIES_FIRESTORE: (Omit<AppCategory, 'id' | 'parentId'> & {type?: 'veg' | 'non-veg'})[] = [
    // Roots
    { name: 'Starters', type: 'non-veg' },
    { name: 'Salads', type: 'veg' },
    { name: 'Mains', type: 'non-veg' },
    { name: 'Desserts', type: 'veg' },
    { name: 'Beverages', type: 'veg' },
];

const INITIAL_ITEMS_FIRESTORE: (Omit<Item, 'id' | 'categoryId'> & { categoryName: string })[] = [
    { name: 'Wild Mushroom & Truffle Vol-au-vent', description: 'Puff pastry with a creamy wild mushroom and black truffle ragout.', categoryName: 'Hot Starters', type: 'veg' },
    { name: 'Whipped Feta Crostini', description: 'Creamy whipped feta with honey drizzle and pistachios.', categoryName: 'Cold Starters', type: 'veg' },
    { name: 'Seared Scallop with Saffron Risotto Bite', description: 'Perfectly seared scallop atop a miniature saffron risotto cake.', categoryName: 'Seafood Bites', type: 'fish' },
    { name: 'Lamb Kofta with Tzatziki', description: 'Spiced minced lamb meatballs with a cool cucumber yogurt dip.', categoryName: 'Meat Bites', type: 'mutton' },
    { name: 'Burrata with Heirloom Tomatoes', description: 'Fresh Burrata, vibrant tomatoes, basil oil, and balsamic glaze.', categoryName: 'Garden Salads', type: 'veg' },
    { name: 'Handmade Gnocchi with Sage Butter', description: 'Pillowy potato gnocchi in a brown butter sage sauce.', categoryName: 'Pasta Dishes', type: 'veg' },
    { name: 'Chicken Roulade with Prosciutto', description: 'Chicken breast stuffed with spinach and ricotta, wrapped in prosciutto.', categoryName: 'From The Land', type: 'chicken' },
    { name: 'Herb-Crusted Rack of Lamb', description: 'Tender rack of lamb with a fresh herb crust and mint jus.', categoryName: 'From The Land', type: 'mutton' },
    { name: 'Pan-Seared Halibut', description: 'Delicate halibut fillet with a lemon-caper sauce and asparagus.', categoryName: 'From The Sea', type: 'fish' },
    { name: 'Deconstructed Lemon Meringue Pie', description: 'Lemon curd, toasted meringue, and shortbread crumble.', categoryName: 'Fruit & Cream', type: 'veg' },
    { name: 'Dark Chocolate Lava Cake', description: 'Molten chocolate cake with a warm, gooey center.', categoryName: 'Chocolate & Pastry', type: 'veg' },
    { name: 'Sparkling Elderflower Pressé', description: 'Refreshing non-alcoholic beverage with elderflower, mint, and lime.', categoryName: 'Non-Alcoholic', type: 'veg' },
    { name: 'Curated Wine Selection', description: 'A selection of red, white, and rosé wines.', categoryName: 'Wines & Spirits', type: 'veg' },
];

const INITIAL_TEMPLATES: Omit<MenuTemplate, 'id' | 'catalogId'>[] = [
    { 
        name: 'Grand Wedding Feast', 
        rules: { 'Starters': 2, 'Salads': 1, 'Mains': 2, 'Desserts': 1, 'Beverages': 2 } 
    },
    { 
        name: 'Elegant Vegetarian Soiree', 
        rules: { 'Starters': 2, 'Salads': 1, 'Mains': 1, 'Desserts': 2 } 
    },
];

const INITIAL_CLIENTS: Omit<Client, 'id'>[] = [
    { name: 'The Grand Hotel', phone: '555-0101', referredBy: 'Word of Mouth', hasSystemAccess: false, status: 'active' },
    { name: 'Innovate Corp', phone: '555-0102', referredBy: 'Web Search', hasSystemAccess: false, status: 'active' },
]

const INITIAL_LIVE_COUNTERS: Omit<LiveCounter, 'id'>[] = [
    { name: 'Pasta Station', description: 'Live cooking pasta station.', maxItems: 3 },
    { name: 'Salad Bar', description: 'A selection of fresh salads and toppings.', maxItems: 5 },
];

const INITIAL_LIVE_COUNTER_ITEMS: (Omit<LiveCounterItem, 'id' | 'liveCounterId'> & { liveCounterName: string })[] = [
    { name: 'Penne', description: 'Classic tube pasta.', liveCounterName: 'Pasta Station' },
    { name: 'Fettuccine', description: 'Flat ribbon pasta.', liveCounterName: 'Pasta Station' },
    { name: 'Alfredo Sauce', description: 'Creamy parmesan sauce.', liveCounterName: 'Pasta Station' },
    { name: 'Marinara Sauce', description: 'Classic tomato and herb sauce.', liveCounterName: 'Pasta Station' },
    { name: 'Caesar Salad', description: 'Romaine, croutons, parmesan, Caesar dressing.', liveCounterName: 'Salad Bar' },
    { name: 'Greek Salad', description: 'Feta, olives, cucumber, tomatoes.', liveCounterName: 'Salad Bar' },
    { name: 'Grilled Chicken', description: 'A protein topping.', liveCounterName: 'Salad Bar' },
    { name: 'Avocado', description: 'Fresh sliced avocado.', liveCounterName: 'Salad Bar' },
    { name: 'Balsamic Vinaigrette', description: 'A classic dressing.', liveCounterName: 'Salad Bar' },
    { name: 'Ranch Dressing', description: 'A creamy dressing.', liveCounterName: 'Salad Bar' },
];

const INITIAL_CHARGE_TYPES: string[] = ['Transportation', 'Printing', 'Decorations', 'Rentals', 'Additional PAX', 'Miscellaneous'];
const INITIAL_EXPENSE_TYPES: string[] = ['Groceries', 'Staff Payment', 'Venue Rent', 'Utilities', 'Marketing', 'Miscellaneous'];
const INITIAL_PAYMENT_MODES: string[] = ['Cash', 'Bank Transfer (NEFT/RTGS)', 'UPI (GPay, PhonePe, etc.)', 'Credit Card', 'Debit Card', 'Cheque'];
const INITIAL_REFERRAL_SOURCES: string[] = ['Word of Mouth', 'Web Search', 'Social Media', 'Advertisement', 'Existing Client', 'Other'];
const INITIAL_SERVICE_ARTICLES: string[] = ['Chafing Dish', 'Serving Ladle', 'Tongs', 'Name Board', 'Salad Bowl', 'Deep Ladle', 'Starter Name Board'];
const INITIAL_ACCOMPANIMENTS: string[] = ['Gongura Gravy', 'Mirchi Ka Salan', 'Raitha'];
const INITIAL_UNITS: string[] = ['grams', 'kg', 'ml', 'liters', 'pieces', 'servings'];
const INITIAL_EVENT_TYPES: string[] = ['Wedding', 'Birthday Party', 'Corporate Event', 'Private Gathering', 'Reception'];


const INITIAL_LOCATIONS: Omit<LocationSetting, 'id'>[] = [
    { name: 'Sandhya', displayRank: 10, color: '#fecaca' }, // red-200
    { name: 'Om Hall-1', displayRank: 20, color: '#bfdbfe' }, // blue-200
    { name: 'Om Hall-2', displayRank: 30, color: '#c7d2fe' }, // indigo-200
    { name: 'Om Lawn', displayRank: 40, color: '#bbf7d0' }, // green-200
    { name: 'Kumkuma Miyapur', displayRank: 50, color: '#e9d5ff' }, // purple-200
    { name: 'Kumkuma Aziznagar', displayRank: 60, color: '#fbcfe8' }, // pink-200
    { name: 'ODC', displayRank: 70, color: '#fde68a' }, // yellow-200
];

const DEFAULT_STAFF_PERMISSIONS: AppPermissions = {
    dashboard: 'modify',
    itemBank: 'modify',
    catalogs: 'modify',
    templates: 'modify',
    liveCounters: 'modify',
    reports: 'modify',
    users: 'view',
    settings: 'view',
    clientsAndEvents: 'modify',
    financeCore: 'modify',
    financeCharges: 'modify',
    financePayments: 'modify',
    financeExpenses: 'modify',
};

// --- CONTEXTS ---
type RolesContextType = {
    roles: Role[];
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    updateRole: (role: Role) => Promise<void>;
    deleteRole: (roleId: string) => Promise<void>;
};
const RolesContext = createContext<RolesContextType | undefined>(undefined);
export const useRoles = () => {
    const context = useContext(RolesContext);
    if (!context) throw new Error('useRoles must be used within a RolesProvider');
    return context;
};

type AuditLogsContextType = {
    auditLogs: AuditLog[];
}
const AuditLogsContext = createContext<AuditLogsContextType | undefined>(undefined);
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
const CatalogsContext = createContext<CatalogsContextType | undefined>(undefined);
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
const LiveCountersContext = createContext<LiveCountersContextType | undefined>(undefined);
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
const LiveCounterItemsContext = createContext<LiveCounterItemsContextType | undefined>(undefined);
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
const ClientsContext = createContext<ClientsContextType | undefined>(undefined);
export const useClients = () => {
    const context = useContext(ClientsContext);
    if (!context) throw new Error('useClients must be used within a ClientsProvider');
    return context;
};

const EventsContext = createContext<EventsContextType | undefined>(undefined);
export const useEvents = () => {
    const context = useContext(EventsContext);
    if (!context) throw new Error('useEvents must be used within a EventsProvider');
    return context;
};

const ItemsContext = createContext<ItemsContextType | undefined>(undefined);
export const useItems = () => {
    const context = useContext(ItemsContext);
    if (!context) throw new Error('useItems must be used within an ItemsProvider');
    return context;
};

const AppCategoriesContext = createContext<AppCategoriesContextType | undefined>(undefined);
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
const TemplatesContext = createContext<TemplatesContextType | undefined>(undefined);
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
const UsersContext = createContext<UsersContextType | undefined>(undefined);
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

const ChargeTypesContext = createContext<FinancialSettingContextType | undefined>(undefined);
export const useChargeTypes = () => {
    const context = useContext(ChargeTypesContext);
    if (!context) throw new Error('useChargeTypes must be used within a ChargeTypesProvider');
    return context;
};
const ExpenseTypesContext = createContext<FinancialSettingContextType | undefined>(undefined);
export const useExpenseTypes = () => {
    const context = useContext(ExpenseTypesContext);
    if (!context) throw new Error('useExpenseTypes must be used within a ExpenseTypesProvider');
    return context;
};
const PaymentModesContext = createContext<FinancialSettingContextType | undefined>(undefined);
export const usePaymentModes = () => {
    const context = useContext(PaymentModesContext);
    if (!context) throw new Error('usePaymentModes must be used within a PaymentModesProvider');
    return context;
};
const ReferralSourcesContext = createContext<FinancialSettingContextType | undefined>(undefined);
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

const ServiceArticlesContext = createContext<ServiceArticlesContextType | undefined>(undefined);
export const useServiceArticles = () => {
    const context = useContext(ServiceArticlesContext);
    if (!context) throw new Error('useServiceArticles must be used within a ServiceArticlesProvider');
    return context;
};

const ItemAccompanimentsContext = createContext<ItemAccompanimentsContextType | undefined>(undefined);
export const useItemAccompaniments = () => {
    const context = useContext(ItemAccompanimentsContext);
    if (!context) throw new Error('useItemAccompaniments must be used within an ItemAccompanimentsProvider');
    return context;
};

const UnitsContext = createContext<FinancialSettingContextType | undefined>(undefined);
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

const EventTypesContext = createContext<EventTypesContextType | undefined>(undefined);
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
const LocationsContext = createContext<LocationsContextType | undefined>(undefined);
export const useLocations = () => {
    const context = useContext(LocationsContext);
    if (!context) throw new Error('useLocations must be used within a LocationsProvider');
    return context;
};


// --- PROVIDERS ---
const AppProviders = ({ children }: { children: ReactNode }) => {
    const { currentUser } = useAuth();
    const [items, setItems] = useState<Item[]>([]);
    const [categories, setCategories] = useState<AppCategory[]>([]);
    const [templates, setTemplates] = useState<MenuTemplate[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [liveCounters, setLiveCounters] = useState<LiveCounter[]>([]);
    const [liveCounterItems, setLiveCounterItems] = useState<LiveCounterItem[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [chargeTypes, setChargeTypes] = useState<FinancialSetting[]>([]);
    const [expenseTypes, setExpenseTypes] = useState<FinancialSetting[]>([]);
    const [paymentModes, setPaymentModes] = useState<FinancialSetting[]>([]);
    const [referralSources, setReferralSources] = useState<FinancialSetting[]>([]);
    const [locations, setLocations] = useState<LocationSetting[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [serviceArticles, setServiceArticles] = useState<ServiceArticle[]>([]);
    const [itemAccompaniments, setItemAccompaniments] = useState<ItemAccompaniment[]>([]);
    const [units, setUnits] = useState<FinancialSetting[]>([]);
    const [eventTypes, setEventTypes] = useState<EventTypeSetting[]>([]);


    useEffect(() => {
        const runInitialSeeding = async () => {
            const getParentId = (name: string, categories: AppCategory[]) => {
                const parent = categories.find(c => c.name === name);
                return parent ? parent.id : null;
            };

            const createInitialChildCategories = (parents: AppCategory[]) => [
                { name: 'Hot Starters', parentId: getParentId('Starters', parents) },
                { name: 'Cold Starters', parentId: getParentId('Starters', parents) },
                { name: 'Seafood Bites', parentId: getParentId('Starters', parents) },
                { name: 'Meat Bites', parentId: getParentId('Starters', parents) },
                { name: 'Garden Salads', parentId: getParentId('Salads', parents) },
                { name: 'Pasta Dishes', parentId: getParentId('Mains', parents) },
                { name: 'From The Land', parentId: getParentId('Mains', parents) },
                { name: 'From The Sea', parentId: getParentId('Mains', parents) },
                { name: 'Fruit & Cream', parentId: getParentId('Desserts', parents) },
                { name: 'Chocolate & Pastry', parentId: getParentId('Desserts', parents) },
                { name: 'Non-Alcoholic', parentId: getParentId('Beverages', parents) },
                { name: 'Wines & Spirits', parentId: getParentId('Beverages', parents) },
            ];

            const seedSettings = async () => {
                const batch = writeBatch(db);
                let changesMade = false;
                
                const seedCollection = async (collectionName: string, initialData: string[]) => {
                     const snap = await getDocs(collection(db, collectionName));
                     if (snap.empty) {
                        console.log(`Seeding ${collectionName}...`);
                        changesMade = true;
                        initialData.forEach(name => batch.set(doc(collection(db, collectionName)), { name }));
                     }
                };

                const seedAccompaniments = async (batch: WriteBatch) => {
                    const snap = await getDocs(collection(db, 'itemAccompaniments'));
                     if (snap.empty) {
                        console.log('Seeding itemAccompaniments...');
                        changesMade = true;
                        INITIAL_ACCOMPANIMENTS.forEach(name => {
                           const data: Omit<ItemAccompaniment, 'id'> = { name };
                           batch.set(doc(collection(db, 'itemAccompaniments')), data);
                        });
                     }
                };

                await seedCollection('chargeTypes', INITIAL_CHARGE_TYPES);
                await seedCollection('expenseTypes', INITIAL_EXPENSE_TYPES);
                await seedCollection('paymentModes', INITIAL_PAYMENT_MODES);
                await seedCollection('referralSources', INITIAL_REFERRAL_SOURCES);
                await seedCollection('serviceArticles', INITIAL_SERVICE_ARTICLES);
                await seedCollection('units', INITIAL_UNITS);
                await seedCollection('eventTypes', INITIAL_EVENT_TYPES);
                await seedAccompaniments(batch);

                const locationsSnap = await getDocs(collection(db, 'locations'));
                if (locationsSnap.empty) {
                    console.log('Seeding locations...');
                    changesMade = true;
                    INITIAL_LOCATIONS.forEach(loc => batch.set(doc(collection(db, 'locations')), loc));
                }
                if (changesMade) {
                    await batch.commit();
                    console.log('Settings seeded.');
                }
            };

            try {
                const categoriesSnapshot = await getDocs(collection(db, "categories"));
                if (categoriesSnapshot.empty) {
                    console.log("Seeding initial data...");
                    const batch = writeBatch(db);
                    const allSeededCategories: AppCategory[] = [];
                    const allSeededItems: (Item & {categoryName: string})[] = [];
                    let seededClientDocs: {name: string, id: string}[] = [];
                    let seededTemplateDocs: {name: string, id: string}[] = [];

                    // 1. Seed Parent Categories
                    for (const cat of INITIAL_CATEGORIES_FIRESTORE) {
                        const docRef = doc(collection(db, 'categories'));
                        const catData = {name: cat.name, parentId: null, type: cat.type || null };
                        batch.set(docRef, catData);
                        allSeededCategories.push({ id: docRef.id, ...catData });
                    }
                    
                    // 2. Seed Child Categories
                    const childCategories = createInitialChildCategories(allSeededCategories);
                    for (const cat of childCategories) {
                         if (cat.parentId) {
                            const docRef = doc(collection(db, 'categories'));
                            const catData = {...cat, type: null};
                            batch.set(docRef, catData);
                            allSeededCategories.push({ id: docRef.id, ...catData });
                        }
                    }

                    const categoryNameToIdMap = new Map(allSeededCategories.map(c => [c.name, c.id]));
                    
                    // 3. Seed Items using category IDs
                    INITIAL_ITEMS_FIRESTORE.forEach(itemToSeed => {
                        const { categoryName, ...itemData } = itemToSeed;
                        const categoryId = categoryNameToIdMap.get(categoryName);
                        if (categoryId) {
                            const newItemDocRef = doc(collection(db, 'items'));
                            const fullItemData = { ...itemData, categoryId };
                            batch.set(newItemDocRef, fullItemData);
                            allSeededItems.push({ id: newItemDocRef.id, categoryName, ...fullItemData });
                        } else {
                            console.warn(`Could not find category ID for "${categoryName}" while seeding. Item "${itemData.name}" skipped.`);
                        }
                    });

                    // 4. Seed a default "Full Catalog"
                    const fullCatalogDocRef = doc(collection(db, 'catalogs'));
                    const itemIdsByCatId: Record<string, string[]> = {};
                    allSeededItems.forEach(item => {
                        if (!itemIdsByCatId[item.categoryId]) {
                            itemIdsByCatId[item.categoryId] = [];
                        }
                        if (!itemIdsByCatId[item.categoryId].includes(item.id)) {
                            itemIdsByCatId[item.categoryId].push(item.id);
                        }
                    });
                    const fullCatalogData = {
                        name: 'Full Item Catalog',
                        description: 'Includes all items available in the system.',
                        itemIds: itemIdsByCatId
                    };
                    batch.set(fullCatalogDocRef, fullCatalogData);
                    
                    // 5. Seed Templates using category IDs in rules AND the new catalog ID
                    INITIAL_TEMPLATES.forEach(templateToSeed => {
                        const newRules: Record<string, number> = {};
                        for (const categoryName in templateToSeed.rules) {
                            const categoryId = categoryNameToIdMap.get(categoryName);
                            if (categoryId) {
                                newRules[categoryId] = (templateToSeed.rules as any)[categoryName];
                            } else {
                                console.warn(`Could not find category ID for "${categoryName}" while seeding template "${templateToSeed.name}".`);
                            }
                        }
                        const templateDocRef = doc(collection(db, "templates"));
                        const newTemplate = { name: templateToSeed.name, rules: newRules, catalogId: fullCatalogDocRef.id };
                        batch.set(templateDocRef, newTemplate);
                        seededTemplateDocs.push({ name: templateToSeed.name, id: templateDocRef.id });
                    });
                    
                    // 6. Seed Clients
                    INITIAL_CLIENTS.forEach(client => {
                        const clientDocRef = doc(collection(db, "clients"));
                        batch.set(clientDocRef, client);
                        seededClientDocs.push({ name: client.name, id: clientDocRef.id });
                    });

                    // 7. Seed Live Counters
                    const liveCounterDocs: {name: string, id: string}[] = [];
                    INITIAL_LIVE_COUNTERS.forEach(lc => {
                        const docRef = doc(collection(db, 'liveCounters'));
                        batch.set(docRef, lc);
                        liveCounterDocs.push({ name: lc.name, id: docRef.id });
                    });
                    
                    // 8. Seed Live Counter Items
                    const liveCounterNameToIdMap = new Map(liveCounterDocs.map(lc => [lc.name, lc.id]));
                    INITIAL_LIVE_COUNTER_ITEMS.forEach(lci => {
                        const liveCounterId = liveCounterNameToIdMap.get(lci.liveCounterName);
                        if (liveCounterId) {
                            const docRef = doc(collection(db, 'liveCounterItems'));
                            const { liveCounterName, ...itemData } = lci;
                            batch.set(docRef, { ...itemData, liveCounterId });
                        }
                    });

                    // 9. Seed Sample Event with Financial Data
                    const grandHotel = seededClientDocs.find(c => c.name === 'The Grand Hotel');
                    const weddingTemplate = seededTemplateDocs.find(t => t.name === 'Grand Wedding Feast');

                    if (grandHotel && weddingTemplate) {
                        const sampleEvent: Omit<Event, 'id'> = {
                          eventType: 'Annual Gala Dinner',
                          date: dateToYYYYMMDD(new Date()),
                          location: 'ODC',
                          address: 'The Grand Hotel, 123 Luxury Ave, Metropolia',
                          session: 'dinner',
                          state: 'confirmed',
                          clientId: grandHotel.id,
                          templateId: weddingTemplate.id,
                          catalogId: fullCatalogDocRef.id,
                          itemIds: {}, // Intentionally empty for this sample
                          createdAt: new Date().toISOString(),
                          status: 'draft',
                          pax: 150,
                          perPaxPrice: 2500,
                          specialInstructions: 'One table requires a gluten-free option for all courses. Please ensure the main course is served promptly at 8:30 PM.',
                          charges: [
                            { id: uuidv4(), notes: 'DJ & Sound System', amount: 25000, type: 'Rentals' },
                            { id: uuidv4(), notes: 'Valet Service', amount: 15000, type: 'Transportation' }
                          ],
                          transactions: [
                            { id: uuidv4(), type: 'income', date: dateToYYYYMMDD(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)), amount: 200000, notes: 'Advance payment', paymentMode: 'Bank Transfer (NEFT/RTGS)' },
                            { id: uuidv4(), type: 'expense', date: dateToYYYYMMDD(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)), amount: 75000, notes: 'Imported cheese and meats', category: 'Groceries' },
                            { id: uuidv4(), type: 'expense', date: dateToYYYYMMDD(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)), amount: 45000, notes: 'Part-time staff payment', category: 'Staff Payment' }
                          ],
                          liveCounters: {},
                        };
                        batch.set(doc(collection(db, 'events')), sampleEvent);
                    }

                    // 10. Seed default staff role
                    const defaultStaffRole: Omit<Role, 'id'> = {
                        name: 'General Manager',
                        permissions: DEFAULT_STAFF_PERMISSIONS
                    };
                    batch.set(doc(collection(db, 'roles')), defaultStaffRole);

                    await batch.commit();
                    console.log("Initial data seeding complete.");
                }

                // Always run settings seeder, as it might have been added later
                await seedSettings();

            } catch (error) {
                console.error("Error during initial data seeding:", error);
            }
        };

        runInitialSeeding();
    }, []);


    useEffect(() => {
        const createSubscription = (collectionName: string, setter: Function) => {
            return onSnapshot(collection(db, collectionName), (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setter(data);
            }, (error) => console.error(`${collectionName} snapshot error: `, error));
        };

        const unsubscribers = [
            createSubscription('items', setItems),
            createSubscription('categories', setCategories),
            createSubscription('templates', setTemplates),
            createSubscription('users', setUsers),
            createSubscription('events', setEvents),
            createSubscription('clients', setClients),
            createSubscription('liveCounters', setLiveCounters),
            createSubscription('liveCounterItems', setLiveCounterItems),
            createSubscription('auditLogs', setAuditLogs),
            createSubscription('catalogs', setCatalogs),
            createSubscription('chargeTypes', setChargeTypes),
            createSubscription('expenseTypes', setExpenseTypes),
            createSubscription('paymentModes', setPaymentModes),
            createSubscription('referralSources', setReferralSources),
            createSubscription('locations', setLocations),
            createSubscription('roles', setRoles),
            createSubscription('serviceArticles', setServiceArticles),
            createSubscription('itemAccompaniments', setItemAccompaniments),
            createSubscription('units', setUnits),
            createSubscription('eventTypes', setEventTypes),
        ];

        return () => unsubscribers.forEach(unsub => unsub());
    }, []);
    
    // --- Roles Methods ---
    const addRole = async (role: Omit<Role, 'id'>) => {
        await addDoc(collection(db, 'roles'), cleanForFirebase(role));
    };
    const updateRole = async (role: Role) => {
        const { id, ...data } = role;
        await updateDoc(doc(db, 'roles', id), cleanForFirebase(data));
    };
    const deleteRole = async (roleId: string) => {
        // Check if any user is assigned this role
        const usersWithRoleQuery = query(collection(db, 'users'), where('roleId', '==', roleId));
        const usersSnapshot = await getDocs(usersWithRoleQuery);
        if (!usersSnapshot.empty) {
            throw new Error(`Cannot delete role: it is assigned to ${usersSnapshot.size} user(s).`);
        }
        await deleteDoc(doc(db, 'roles', roleId));
    };


    // --- Location Methods ---
    const addLocation = async (location: Omit<LocationSetting, 'id'>) => {
        await addDoc(collection(db, "locations"), cleanForFirebase(location));
    }
    const updateLocation = async (location: LocationSetting) => {
        const { id, ...data } = location;
        await updateDoc(doc(db, 'locations', id), cleanForFirebase(data));
    }
    const deleteLocation = async (id: string) => {
        // Future: Check for dependencies in events. For now, we allow it.
        await deleteDoc(doc(db, 'locations', id));
    }
    const updateMultipleLocations = async (locationsToUpdate: {id: string, displayRank: number}[]) => {
        const batch = writeBatch(db);
        locationsToUpdate.forEach(loc => {
            const docRef = doc(db, 'locations', loc.id);
            batch.update(docRef, { displayRank: loc.displayRank });
        });
        await batch.commit();
    };

    // --- Financial & Other Settings Methods (Generic) ---
    const createFinancialSettingMethods = (collectionName: string) => ({
        addSetting: async (name: string) => {
            await addDoc(collection(db, collectionName), { name });
        },
        updateSetting: async (id: string, name: string) => {
            await updateDoc(doc(db, collectionName, id), { name });
        },
        deleteSetting: async (id: string) => {
            await deleteDoc(doc(db, collectionName, id));
        },
    });
    
    const chargeTypesMethods = createFinancialSettingMethods('chargeTypes');
    const expenseTypesMethods = createFinancialSettingMethods('expenseTypes');
    const paymentModesMethods = createFinancialSettingMethods('paymentModes');
    const referralSourcesMethods = createFinancialSettingMethods('referralSources');
    const serviceArticlesMethods = createFinancialSettingMethods('serviceArticles');
    const unitsMethods = createFinancialSettingMethods('units');
    const eventTypesMethods = createFinancialSettingMethods('eventTypes');

    // --- Accompaniment Methods ---
    const addAccompaniment = async (acc: Omit<ItemAccompaniment, 'id'>) => {
        await addDoc(collection(db, 'itemAccompaniments'), cleanForFirebase(acc));
    };
    const updateAccompaniment = async (acc: ItemAccompaniment) => {
        const { id, ...data } = acc;
        await updateDoc(doc(db, 'itemAccompaniments', id), cleanForFirebase(data));
    };
    const deleteAccompaniment = async (id: string) => {
        await deleteDoc(doc(db, 'itemAccompaniments', id));
    };


    // --- Catalog Methods ---
    const addCatalog = async (catalog: Omit<Catalog, 'id'>) => {
        await addDoc(collection(db, "catalogs"), cleanForFirebase(catalog));
    };
    const updateCatalog = async (catalog: Catalog) => {
        const { id, ...data } = catalog;
        await updateDoc(doc(db, "catalogs", id), cleanForFirebase(data));
    };
    const deleteCatalog = async (catalogId: string) => {
        const templatesQuery = query(collection(db, 'templates'), where('catalogId', '==', catalogId));
        const templatesSnapshot = await getDocs(templatesQuery);
        if (!templatesSnapshot.empty) {
            throw new Error(`Cannot delete catalog: it is used by ${templatesSnapshot.size} template(s).`);
        }
        await deleteDoc(doc(db, "catalogs", catalogId));
    };
    const deleteAllCatalogs = async () => {
        const templatesSnapshot = await getDocs(collection(db, 'templates'));
        if (!templatesSnapshot.empty) {
            throw new Error(`Cannot delete all catalogs because ${templatesSnapshot.size} template(s) still exist. Please delete all templates first.`);
        }

        const batch = writeBatch(db);
        const catalogsSnapshot = await getDocs(collection(db, "catalogs"));
        catalogsSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    };
    const addMultipleCatalogs = async (catalogsToAdd: { name: string, description: string, items: string[] }[]) => {
        const allItemsMap = new Map(items.map(i => [i.name.toLowerCase(), i]));
        const batch = writeBatch(db);

        for (const cat of catalogsToAdd) {
            const itemIds: Record<string, string[]> = {};
            for (const itemName of cat.items) {
                if(!itemName) continue; // Skip empty item names
                const item = allItemsMap.get(itemName.toLowerCase());
                if (!item) {
                    throw new Error(`Item "${itemName}" not found in the item bank. Please import items first.`);
                }
                if (!itemIds[item.categoryId]) {
                    itemIds[item.categoryId] = [];
                }
                if (!itemIds[item.categoryId].includes(item.id)) {
                    itemIds[item.categoryId].push(item.id);
                }
            }

            const newCatalogData = {
                name: cat.name,
                description: cat.description,
                itemIds
            };
            
            const docRef = doc(collection(db, 'catalogs'));
            batch.set(docRef, cleanForFirebase(newCatalogData));
        }

        await batch.commit();
    };

    // --- Live Counter Methods ---
    const addLiveCounter = async (lc: Omit<LiveCounter, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'liveCounters'), cleanForFirebase(lc));
        return docRef.id;
    }
    const updateLiveCounter = async (lc: LiveCounter) => {
        const {id, ...data} = lc;
        await updateDoc(doc(db, 'liveCounters', id), cleanForFirebase(data));
    }
    const deleteLiveCounter = async (lcId: string) => {
        const batch = writeBatch(db);

        // 1. Find and delete associated live counter items
        const itemsQuery = query(collection(db, 'liveCounterItems'), where('liveCounterId', '==', lcId));
        const itemsSnapshot = await getDocs(itemsQuery);
        itemsSnapshot.forEach(itemDoc => {
            batch.delete(itemDoc.ref);
        });

        // 2. Find events using this counter and remove the coupling
        const eventsSnapshot = await getDocs(collection(db, "events"));
        eventsSnapshot.forEach(eventDoc => {
            const eventData = eventDoc.data() as Event;
            if (eventData.liveCounters && eventData.liveCounters[lcId]) {
                const newLiveCounters = { ...eventData.liveCounters };
                delete newLiveCounters[lcId];
                batch.update(eventDoc.ref, { liveCounters: newLiveCounters });
            }
        });

        // 3. Delete the live counter itself
        const counterRef = doc(db, 'liveCounters', lcId);
        batch.delete(counterRef);

        await batch.commit();
    }
     const addMultipleLiveCounters = async (lcs: Omit<LiveCounter, 'id'>[]): Promise<Map<string, string>> => {
        const batch = writeBatch(db);
        const nameToIdMap = new Map<string, string>();
        lcs.forEach(lc => {
            const docRef = doc(collection(db, 'liveCounters'));
            batch.set(docRef, cleanForFirebase(lc));
            nameToIdMap.set((lc.name as string).toLowerCase(), docRef.id);
        });
        await batch.commit();
        return nameToIdMap;
    };
    const deleteAllLiveCountersAndItems = async () => {
        const batch = writeBatch(db);

        // 1. Decouple from all events
        const eventsSnapshot = await getDocs(collection(db, "events"));
        eventsSnapshot.forEach(eventDoc => {
            const eventData = eventDoc.data() as Event;
            if (eventData.liveCounters && Object.keys(eventData.liveCounters).length > 0) {
                batch.update(eventDoc.ref, { liveCounters: {} });
            }
        });

        // 2. Delete all counters and items
        const countersSnapshot = await getDocs(collection(db, "liveCounters"));
        countersSnapshot.forEach(doc => batch.delete(doc.ref));
        const itemsSnapshot = await getDocs(collection(db, "liveCounterItems"));
        itemsSnapshot.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
    }
    const updateMultipleLiveCounters = async (countersToUpdate: {id: string, displayRank: number}[]) => {
        const batch = writeBatch(db);
        countersToUpdate.forEach(counter => {
            const docRef = doc(db, 'liveCounters', counter.id);
            batch.update(docRef, { displayRank: counter.displayRank });
        });
        await batch.commit();
    };
    
    // --- Live Counter Item Methods ---
    const addLiveCounterItem = async (lci: Omit<LiveCounterItem, 'id'>) => {
        await addDoc(collection(db, 'liveCounterItems'), cleanForFirebase(lci));
    }
    const updateLiveCounterItem = async (lci: LiveCounterItem) => {
        const {id, ...data} = lci;
        await updateDoc(doc(db, 'liveCounterItems', id), cleanForFirebase(data));
    }
    const deleteLiveCounterItem = async (lciId: string) => {
        await deleteDoc(doc(db, 'liveCounterItems', lciId));
    }
    const addMultipleLiveCounterItems = async (lcitems: Omit<LiveCounterItem, 'id'>[]) => {
        const batch = writeBatch(db);
        lcitems.forEach(item => {
            const docRef = doc(collection(db, 'liveCounterItems'));
            batch.set(docRef, cleanForFirebase(item));
        });
        await batch.commit();
    };
    const updateMultipleLiveCounterItems = async (itemsToUpdate: {id: string, displayRank: number}[]) => {
        const batch = writeBatch(db);
        itemsToUpdate.forEach(item => {
            const docRef = doc(db, 'liveCounterItems', item.id);
            batch.update(docRef, { displayRank: item.displayRank });
        });
        await batch.commit();
    };


    // --- Client Methods ---
    const addClient = async (clientData: Omit<Client, 'id'>): Promise<string> => {
        if (clientData.hasSystemAccess && !clientData.phone) {
            throw new Error("A phone number is required to grant system access.");
        }

        const clientDataWithDefaults = {
            ...clientData,
            status: clientData.status || 'active'
        };

        const clientDocRef = doc(collection(db, "clients"));
        
        if (clientDataWithDefaults.hasSystemAccess) {
            const batch = writeBatch(db);
            batch.set(clientDocRef, cleanForFirebase(clientDataWithDefaults));

            const userStatus = clientDataWithDefaults.status === 'active' ? 'active' : 'inactive';
            const userData = {
                username: clientDataWithDefaults.phone,
                password: clientDataWithDefaults.phone,
                role: 'regular',
                status: userStatus,
                assignedClientId: clientDocRef.id,
            };
            const userDocRef = doc(collection(db, 'users'));
            batch.set(userDocRef, cleanForFirebase(userData));

            await batch.commit();
        } else {
            await setDoc(clientDocRef, cleanForFirebase(clientDataWithDefaults));
        }
        return clientDocRef.id;
    }

    const updateClient = async (client: Client) => {
         if (client.hasSystemAccess && !client.phone) {
            throw new Error("A phone number is required to maintain system access.");
        }

        const { id, ...data } = client;
        const clientRef = doc(db, "clients", id);
        
        const oldClientSnap = await getDoc(clientRef);
        if (!oldClientSnap.exists()) {
            throw new Error("Client not found for update.");
        }
        const oldClientData = oldClientSnap.data() as Client;

        const batch = writeBatch(db);
        batch.update(clientRef, cleanForFirebase(data));

        const userQuery = query(collection(db, 'users'), where('assignedClientId', '==', id));
        const userSnapshot = await getDocs(userQuery);
        const existingUserDoc = userSnapshot.docs[0];

        // Determine if there's a user associated with this client
        if (existingUserDoc) {
            // A user exists, so we might need to update it
            const updates: any = {};
            const targetUserStatus = (client.status === 'active' || !client.status) && client.hasSystemAccess ? 'active' : 'inactive';

            if (existingUserDoc.data().status !== targetUserStatus) {
                updates.status = targetUserStatus;
            }

            if (client.hasSystemAccess && oldClientData.phone !== client.phone) {
                updates.username = client.phone;
                updates.password = client.phone;
            }
            
            if (Object.keys(updates).length > 0) {
                batch.update(existingUserDoc.ref, updates);
            }

        } else if (!oldClientData.hasSystemAccess && client.hasSystemAccess && (client.status === 'active' || !client.status)) {
            // No user exists, but we are granting access now and the client is active
            const userData = {
                username: client.phone, password: client.phone, role: 'regular', status: 'active', assignedClientId: id
            };
            const newUserRef = doc(collection(db, 'users'));
            batch.set(newUserRef, cleanForFirebase(userData));
        }

        await batch.commit();
    }
    
    const deleteClient = async (clientId: string) => {
        // Find all dependent documents first
        const eventsQuery = query(collection(db, 'events'), where('clientId', '==', clientId));
        const usersQuery = query(collection(db, 'users'), where('assignedClientId', '==', clientId));

        const [eventsSnapshot, usersSnapshot] = await Promise.all([
            getDocs(eventsQuery),
            getDocs(usersQuery),
        ]);

        const refsToDelete: DocumentReference[] = [];
        eventsSnapshot.forEach(doc => refsToDelete.push(doc.ref));
        usersSnapshot.forEach(doc => refsToDelete.push(doc.ref));

        // Add the client document itself to the list of documents to delete
        refsToDelete.push(doc(db, 'clients', clientId));

        // Firestore batches are limited to 500 operations.
        // We'll process the deletions in chunks to handle cases with many dependents.
        const BATCH_SIZE = 500;
        for (let i = 0; i < refsToDelete.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = refsToDelete.slice(i, i + BATCH_SIZE);
            
            for (const ref of chunk) {
                batch.delete(ref);
            }
            
            await batch.commit();
        }
    };

    const deleteAllClients = async () => {
        const batch = writeBatch(db);
        const clientsSnapshot = await getDocs(collection(db, "clients"));
        const eventsSnapshot = await getDocs(collection(db, "events"));
        const usersSnapshot = await getDocs(collection(db, "users"));

        clientsSnapshot.forEach(doc => batch.delete(doc.ref));
        eventsSnapshot.forEach(doc => batch.delete(doc.ref));
        usersSnapshot.forEach(doc => {
            if (doc.data().role === 'regular') {
                batch.delete(doc.ref);
            }
        });
        
        await batch.commit();
    };

    const addSampleData = async () => {
        const sampleClientExists = clients.some(c => c.name.startsWith('[Sample]'));
        if (sampleClientExists) {
            throw new Error("Sample data already exists. Please delete it first before generating new samples.");
        }
    
        const batch = writeBatch(db);
    
        // --- 1. Categories ---
        const catRefs: Record<string, DocumentReference> = {};
        const addCat = (name: string, parentId: string | null = null, type: 'veg' | 'non-veg' | null = null) => {
            const ref = doc(collection(db, 'categories'));
            batch.set(ref, { name, parentId, type });
            catRefs[name] = ref;
            return ref;
        }
        const startersCat = addCat('[Sample] Festive Starters', null, 'non-veg');
        const mainsCat = addCat('[Sample] Holiday Mains', null, 'non-veg');
        const saladsCat = addCat('[Sample] Corporate Salads', null, 'veg');
        const dessertsCat = addCat('[Sample] Decadent Desserts', null, 'veg');

        const vegBitesCat = addCat('[Sample] Veg Bites', startersCat.id);
        const nonVegBitesCat = addCat('[Sample] Non-Veg Bites', startersCat.id);
        const poultryCat = addCat('[Sample] Poultry', mainsCat.id);
        const redMeatCat = addCat('[Sample] Red Meat', mainsCat.id);

        // --- 2. Items ---
        const itemRefs: Record<string, DocumentReference> = {};
        const addItem = (name: string, catRef: DocumentReference, type: ItemType = 'veg', desc: string = '') => {
            const ref = doc(collection(db, 'items'));
            batch.set(ref, { name, description: desc, categoryId: catRef.id, type });
            itemRefs[name] = ref;
        };
        addItem('[Sample] Cranberry Brie Bites', vegBitesCat, 'veg', 'Warm brie with cranberry chutney.');
        addItem('[Sample] Spinach Artichoke Dip', vegBitesCat, 'veg', 'Served with tortilla chips.');
        addItem('[Sample] Mushroom Puffs', vegBitesCat, 'veg', 'Flaky pastry filled with mushrooms.');
        addItem('[Sample] Mini Lamb Samosas', nonVegBitesCat, 'mutton', 'Crispy pockets of spiced lamb.');
        addItem('[Sample] Prawn Skewers', nonVegBitesCat, 'prawns', 'Grilled with garlic and herbs.');
        addItem('[Sample] Chicken Tikka Bites', nonVegBitesCat, 'chicken', 'Tandoori spiced chicken pieces.');
        addItem('[Sample] Roast Turkey Slices', poultryCat, 'chicken', 'Classic holiday turkey slices.');
        addItem('[Sample] Chicken Biryani', poultryCat, 'chicken', 'Aromatic rice and chicken dish.');
        addItem('[Sample] Duck Confit', poultryCat, 'chicken', 'Slow-cooked duck leg.');
        addItem('[Sample] Mutton Rogan Josh', redMeatCat, 'mutton', 'Aromatic lamb curry.');
        addItem('[Sample] Beef Wellington Bites', redMeatCat, 'mutton', 'Beef tenderloin in puff pastry.');
        addItem('[Sample] Quinoa Salad', saladsCat, 'veg', 'With roasted vegetables.');
        addItem('[Sample] Classic Caesar Salad', saladsCat, 'veg', 'With homemade croutons.');
        addItem('[Sample] Chocolate Fondue', dessertsCat, 'veg', 'With fruits and marshmallows for dipping.');
        addItem('[Sample] Red Velvet Cake', dessertsCat, 'veg', 'Classic cream cheese frosting.');
        addItem('[Sample] Tiramisu', dessertsCat, 'veg', 'Coffee-flavored Italian dessert.');

        // --- 3. Catalogs ---
        const holidayCatalogRef = doc(collection(db, 'catalogs'));
        batch.set(holidayCatalogRef, {
            name: '[Sample] Holiday Catalog', description: 'A collection of festive sample items.',
            itemIds: {
                [vegBitesCat.id]: [itemRefs['[Sample] Cranberry Brie Bites'].id],
                [nonVegBitesCat.id]: [itemRefs['[Sample] Mini Lamb Samosas'].id, itemRefs['[Sample] Prawn Skewers'].id],
                [poultryCat.id]: [itemRefs['[Sample] Roast Turkey Slices'].id, itemRefs['[Sample] Duck Confit'].id],
                [redMeatCat.id]: [itemRefs['[Sample] Mutton Rogan Josh'].id],
                [dessertsCat.id]: [itemRefs['[Sample] Chocolate Fondue'].id, itemRefs['[Sample] Red Velvet Cake'].id],
            }
        });
        const corpCatalogRef = doc(collection(db, 'catalogs'));
        batch.set(corpCatalogRef, {
            name: '[Sample] Corporate Lunch Catalog', description: 'Lighter options for business events.',
            itemIds: {
                [vegBitesCat.id]: [itemRefs['[Sample] Mushroom Puffs'].id],
                [nonVegBitesCat.id]: [itemRefs['[Sample] Chicken Tikka Bites'].id],
                [saladsCat.id]: [itemRefs['[Sample] Quinoa Salad'].id, itemRefs['[Sample] Classic Caesar Salad'].id],
                [poultryCat.id]: [itemRefs['[Sample] Chicken Biryani'].id],
            }
        });
        
        // --- 4. Templates ---
        const holidayTemplateRef = doc(collection(db, 'templates'));
        batch.set(holidayTemplateRef, {
            name: '[Sample] Christmas Dinner Template', catalogId: holidayCatalogRef.id,
            rules: { [startersCat.id]: 2, [mainsCat.id]: 1, [dessertsCat.id]: 1 }
        });
        const corpTemplateRef = doc(collection(db, 'templates'));
        batch.set(corpTemplateRef, {
            name: '[Sample] Business Lunch Template', catalogId: corpCatalogRef.id,
            rules: { [startersCat.id]: 1, [saladsCat.id]: 1, [mainsCat.id]: 1 }
        });

        // --- 5. Live Counters ---
        const chocoLcRef = doc(collection(db, 'liveCounters'));
        batch.set(chocoLcRef, { name: '[Sample] Hot Chocolate Bar', description: 'Customizable hot chocolate.', maxItems: 2 });
        batch.set(doc(collection(db, 'liveCounterItems')), { name: '[Sample] Mini Marshmallows', description: 'Fluffy marshmallows.', liveCounterId: chocoLcRef.id });
        batch.set(doc(collection(db, 'liveCounterItems')), { name: '[Sample] Whipped Cream', description: 'Sweet whipped cream.', liveCounterId: chocoLcRef.id });

        const tacoLcRef = doc(collection(db, 'liveCounters'));
        batch.set(tacoLcRef, { name: '[Sample] Taco Bar', description: 'Build your own tacos.', maxItems: 3 });
        batch.set(doc(collection(db, 'liveCounterItems')), { name: '[Sample] Ground Beef', description: '', liveCounterId: tacoLcRef.id });
        batch.set(doc(collection(db, 'liveCounterItems')), { name: '[Sample] Shredded Chicken', description: '', liveCounterId: tacoLcRef.id });
        batch.set(doc(collection(db, 'liveCounterItems')), { name: '[Sample] Black Beans (Veg)', description: '', liveCounterId: tacoLcRef.id });

        const chaatLcRef = doc(collection(db, 'liveCounters'));
        batch.set(chaatLcRef, { name: '[Sample] Chaat Corner', description: 'Classic Indian street food.', maxItems: 4 });
        batch.set(doc(collection(db, 'liveCounterItems')), { name: '[Sample] Pani Puri', description: '', liveCounterId: chaatLcRef.id });
        batch.set(doc(collection(db, 'liveCounterItems')), { name: '[Sample] Dahi Vada', description: '', liveCounterId: chaatLcRef.id });

        // --- 6. Clients ---
        const clientRefs: Record<string, DocumentReference> = {};
        const addClient = (name: string, phone: string, status: 'active' | 'inactive') => {
            const ref = doc(collection(db, 'clients'));
            batch.set(ref, { name: `[Sample] ${name}`, phone, status, hasSystemAccess: false, referredBy: 'Sample Data' });
            clientRefs[name] = ref;
        }
        addClient('The North Pole', '555-1225', 'active');
        addClient('Stark Industries', '555-4766', 'active');
        addClient('Wayne Enterprises', '555-2286', 'active');
        addClient('Acme Corporation', '555-9876', 'inactive');
        addClient('Globex Corporation', '555-4562', 'active');

        // --- 7. Events ---
        const addEvent = (clientName: string, eventType: string, state: EventState, daysOffset: number, templateRef: DocumentReference) => {
            batch.set(doc(collection(db, 'events')), {
                eventType: `[Sample] ${eventType}`,
                date: dateToYYYYMMDD(new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000)),
                location: 'ODC',
                session: 'dinner',
                state,
                clientId: clientRefs[clientName].id,
                templateId: templateRef.id,
                catalogId: templateRef.id === holidayTemplateRef.id ? holidayCatalogRef.id : corpCatalogRef.id,
                itemIds: {},
                createdAt: new Date().toISOString(),
                status: 'draft',
                pax: Math.floor(Math.random() * 100) + 50,
                perPaxPrice: Math.floor(Math.random() * 1000) + 1500,
            });
        };
        addEvent('The North Pole', "Santa's Workshop Party", 'confirmed', 15, holidayTemplateRef);
        addEvent('Stark Industries', "Avengers Tower Gala", 'lead', 30, holidayTemplateRef);
        addEvent('Wayne Enterprises', "Gotham Charity Ball", 'confirmed', -60, holidayTemplateRef);
        addEvent('Acme Corporation', "Product Launch", 'lost', -90, corpTemplateRef);
        addEvent('Globex Corporation', "Annual Retreat", 'lead', 45, corpTemplateRef);
        
        await batch.commit();
    };
    
    const deleteSampleData = async () => {
        const batch = writeBatch(db);
        let sampleFound = false;
    
        const collectionsToSearch = [
            'categories', 'items', 'catalogs', 'templates', 
            'liveCounters', 'liveCounterItems', 'clients', 'events'
        ];
        
        const sampleClientIds = new Set<string>();
    
        for (const collectionName of collectionsToSearch) {
            // Field for events is 'eventType', for others it's 'name'
            const field = collectionName === 'events' ? 'eventType' : 'name';
            const q = query(collection(db, collectionName), where(field, ">=", "[Sample]"), where(field, "<=", "[Sample]\uf8ff"));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                sampleFound = true;
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                    if (collectionName === 'clients') {
                        sampleClientIds.add(doc.id);
                    }
                });
            }
        }
        
        if (sampleClientIds.size > 0) {
            const idsArray = Array.from(sampleClientIds);
            const userQuery = query(collection(db, 'users'), where('assignedClientId', 'in', idsArray));
            const userSnapshot = await getDocs(userQuery);
            if (!userSnapshot.empty) {
                sampleFound = true;
                userSnapshot.forEach(userDoc => {
                    batch.delete(userDoc.ref);
                });
            }
        }
    
        if (!sampleFound) {
            throw new Error("No sample data found to delete.");
        }
    
        await batch.commit();
    };


    // --- Event Methods ---
    const addEvent = async (eventData: Omit<Event, 'id'>): Promise<string> => {
        const eventWithDefaults: Partial<Event> = {
            pax: 0,
            liveCounters: {},
            itemIds: {},
            ...eventData,
        };

        if (currentUser) {
            const historyEntry: StateChangeHistoryEntry = {
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
                username: currentUser.username,
                fromState: undefined,
                toState: eventData.state,
            };
            eventWithDefaults.stateHistory = [historyEntry];
        }

        const newDocRef = await addDoc(collection(db, "events"), cleanForFirebase(eventWithDefaults));
        if (currentUser) {
            const clientName = clients.find(c => c.id === eventData.clientId)?.name || 'Unknown Client';
            await logAuditEvent({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'CREATE_EVENT',
                details: `Event '${eventData.eventType}' for client '${clientName}'`,
                clientId: eventData.clientId
            });
        }
        return newDocRef.id;
    };
    const updateEvent = async (event: Event) => {
        const { id, ...data } = event;
        await updateDoc(doc(db, "events", id), cleanForFirebase(data));
        if (currentUser) {
            const clientName = clients.find(c => c.id === event.clientId)?.name || 'Unknown Client';
            await logAuditEvent({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'UPDATE_EVENT',
                details: `Event '${event.eventType}' for client '${clientName}'`,
                clientId: event.clientId
            });
        }
    };
    const deleteEvent = async (event: Event) => {
        await deleteDoc(doc(db, "events", event.id));
        if (currentUser) {
            const clientName = clients.find(c => c.id === event.clientId)?.name || 'Unknown Client';
            await logAuditEvent({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'DELETE_EVENT',
                details: `Event '${event.eventType}' for client '${clientName}'`,
                clientId: event.clientId
            });
        }
    };
    const duplicateEvent = async (eventToDuplicate: Event) => {
        const { id, ...restOfEvent } = eventToDuplicate;
        const newEventData: Omit<Event, 'id'> = {
            ...restOfEvent,
            date: dateToYYYYMMDD(new Date()),
            state: 'lead',
            status: 'draft',
            createdAt: new Date().toISOString(),
            transactions: [],
            charges: [],
        };

        const newDocRef = await addDoc(collection(db, "events"), cleanForFirebase(newEventData));

        if (currentUser) {
            const clientName = clients.find(c => c.id === newEventData.clientId)?.name || 'Unknown Client';
            await logAuditEvent({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'CREATE_EVENT',
                details: `Duplicated event '${eventToDuplicate.eventType}' to create '${newEventData.eventType}' for client '${clientName}'`,
                clientId: newEventData.clientId
            });
        }
    };
    const deleteAllEvents = async () => {
        const batch = writeBatch(db);
        const eventsSnapshot = await getDocs(collection(db, "events"));
        eventsSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    
    const importClientsAndEvents = async (data: any[]): Promise<number> => {
        const batch = writeBatch(db);
        // Fetch all existing clients to build a cache for lookups
        const allClientsSnap = await getDocs(collection(db, 'clients'));
        const allClients = allClientsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Client);
        
        // Create two caches: one by phone (if available) and one by name
        const clientCacheByPhone = new Map<string, string>();
        const clientCacheByName = new Map<string, string>();
        allClients.forEach(c => {
            if (c.phone) {
                clientCacheByPhone.set(c.phone, c.id);
            }
            clientCacheByName.set(c.name.toLowerCase(), c.id);
        });

        // Group events by a unique client identifier (phone if present, otherwise name)
        const eventsByClient = new Map<string, any[]>();
        for (const row of data) {
            const clientName = row['client name']?.trim();
            const clientPhone = String(row['client phone'] || '').trim();
            
            if (!clientName || !row['event type']?.trim()) continue; // Skip rows without client name or event type
            
            // Use phone number as the primary key, fall back to name
            const clientKey = clientPhone || clientName.toLowerCase();
            
            if (!eventsByClient.has(clientKey)) {
                eventsByClient.set(clientKey, []);
            }
            eventsByClient.get(clientKey)!.push(row);
        }

        let importedCount = 0;

        // Iterate through each client's events
        for (const [clientKey, clientEventRows] of eventsByClient.entries()) {
            const firstRow = clientEventRows[0];
            const clientName = firstRow['client name'].trim();
            const clientPhone = String(firstRow['client phone'] || '').trim();
            
            // Try to find an existing client. Prioritize phone number lookup.
            let clientId: string | undefined;
            if (clientPhone) {
                clientId = clientCacheByPhone.get(clientPhone);
            }
            // If not found by phone, try by name (but only if phone wasn't provided in the import row)
            if (!clientId && !clientPhone) {
                clientId = clientCacheByName.get(clientName.toLowerCase());
            }

            // If client is new, create them
            if (!clientId) {
                // Check if any of the client's events are in the future
                const hasFutureEvent = clientEventRows.some(row => {
                    const eventDate = row['event date'] ? new Date(row['event date']) : null;
                    return eventDate && eventDate > new Date();
                });

                const newClientRef = doc(collection(db, 'clients'));
                const newClient: Omit<Client, 'id'> = {
                    name: clientName,
                    phone: clientPhone,
                    referredBy: 'Importer',
                    status: hasFutureEvent ? 'active' : 'inactive',
                    hasSystemAccess: false
                };
                batch.set(newClientRef, newClient);
                clientId = newClientRef.id;

                // Update local caches for subsequent rows in the same import batch
                if (clientPhone) {
                    clientCacheByPhone.set(clientPhone, clientId);
                }
                clientCacheByName.set(clientName.toLowerCase(), clientId);
            }
            
            // Create all events for this client (new or existing)
            for (const row of clientEventRows) {
                const eventType = row['event type']?.trim();
                const pax = Number(row['pax']) || 0;

                const newEvent: Omit<Event, 'id'> = {
                    clientId,
                    eventType,
                    date: row['event date'] ? dateToYYYYMMDD(new Date(row['event date'])) : dateToYYYYMMDD(new Date()),
                    session: row['session']?.toLowerCase() || 'dinner',
                    location: row['location'] || 'ODC',
                    state: 'confirmed',
                    status: 'finalized',
                    pax,
                    perPaxPrice: Number(row['per pax price']) || 0,
                    rent: Number(row['rent']) || 0,
                    pricingModel: pax === 0 ? 'flat' : 'variable',
                    createdAt: new Date().toISOString(),
                    itemIds: {},
                };

                batch.set(doc(collection(db, 'events')), cleanForFirebase(newEvent));
                importedCount++;
            }
        }
        await batch.commit();
        return importedCount;
    };


    // --- Item Methods ---
    const addItem = async (item: Omit<Item, 'id'>) => {
        await addDoc(collection(db, "items"), cleanForFirebase(item));
    };
    const updateItem = async (item: Item) => {
        const { id, ...data } = item;
        await updateDoc(doc(db, "items", id), cleanForFirebase(data));
    };
    const deleteItem = async (itemId: string) => {
        // Here you might check for dependencies in events, but for now we'll allow it.
        await deleteDoc(doc(db, "items", itemId));
    };
     const deleteMultipleItems = async (itemIds: string[]) => {
        const batch = writeBatch(db);
        itemIds.forEach(id => {
            const docRef = doc(db, 'items', id);
            batch.delete(docRef);
        });
        await batch.commit();
    };
    const moveMultipleItems = async (itemIds: string[], destinationCategoryId: string) => {
        const batch = writeBatch(db);
        itemIds.forEach(id => {
            const docRef = doc(db, 'items', id);
            batch.update(docRef, { categoryId: destinationCategoryId });
        });
        await batch.commit();
    };
    const addMultipleItems = async (itemsToAdd: any[]): Promise<number> => {
        const batch = writeBatch(db);
        const allCategories = (await getDocs(collection(db, 'categories'))).docs.map(d => ({id: d.id, ...d.data()}) as AppCategory);
        const categoryCache = new Map<string, string>(); // 'parentName/childName' -> id
        allCategories.forEach(c => categoryCache.set(c.name.toLowerCase(), c.id));

        const getOrCreateCategory = async (name: string, parentId: string | null = null): Promise<string> => {
            const cacheKey = `${parentId || 'root'}/${name.toLowerCase()}`;
            if (categoryCache.has(cacheKey)) {
                return categoryCache.get(cacheKey)!;
            }

            const existing = allCategories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.parentId === parentId);
            if (existing) {
                categoryCache.set(cacheKey, existing.id);
                return existing.id;
            }

            const newCatRef = doc(collection(db, 'categories'));
            batch.set(newCatRef, { name, parentId, type: parentId ? null : 'veg' }); // Default type for new parent cats
            categoryCache.set(cacheKey, newCatRef.id);
            allCategories.push({id: newCatRef.id, name, parentId, type: null}); // Add to local list for subsequent lookups
            return newCatRef.id;
        };

        let importedCount = 0;
        for (const row of itemsToAdd) {
            const parentName = row['parent category'];
            const childName = row['child category'];
            const itemName = row['item name'];

            if (!parentName || !itemName) continue;

            try {
                const parentId = await getOrCreateCategory(parentName.trim());
                const categoryId = childName ? await getOrCreateCategory(childName.trim(), parentId) : parentId;
                
                const newItem: Omit<Item, 'id'> = {
                    name: itemName.trim(),
                    description: row['description'] || '',
                    categoryId: categoryId,
                    type: (row['type'] as ItemType) || 'veg',
                    displayRank: Number(row['display rank']) || 0,
                };
                
                batch.set(doc(collection(db, 'items')), cleanForFirebase(newItem));
                importedCount++;

            } catch(e) {
                 console.error(`Skipping row due to error: ${e}`, row);
            }
        }
        
        await batch.commit();
        return importedCount;
    };
    const deleteAllItems = async () => {
        const catalogsSnapshot = await getDocs(collection(db, "catalogs"));
        if (!catalogsSnapshot.empty) {
            throw new Error(`Cannot delete all items because ${catalogsSnapshot.size} catalog(s) still exist. Please delete all catalogs first.`);
        }
        const itemsRef = collection(db, "items");
        const snapshot = await getDocs(itemsRef);
        if (snapshot.empty) return;
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    };
    const updateMultipleItems = async (itemsToUpdate: {id: string, displayRank: number}[]) => {
        const batch = writeBatch(db);
        itemsToUpdate.forEach(item => {
            const docRef = doc(db, 'items', item.id);
            batch.update(docRef, { displayRank: item.displayRank });
        });
        await batch.commit();
    };
    const batchUpdateServiceArticles = async (itemIds: string[], articleId: string, action: 'add' | 'remove') => {
        const batch = writeBatch(db);
        const fieldUpdate = {
            serviceArticleIds: action === 'add' ? arrayUnion(articleId) : arrayRemove(articleId)
        };
        itemIds.forEach(id => {
            const docRef = doc(db, 'items', id);
            batch.update(docRef, fieldUpdate);
        });
        await batch.commit();
    };
    const batchUpdateAccompaniments = async (itemIds: string[], accompanimentId: string, action: 'add' | 'remove') => {
        const batch = writeBatch(db);
        const fieldUpdate = {
            accompanimentIds: action === 'add' ? arrayUnion(accompanimentId) : arrayRemove(accompanimentId)
        };
        itemIds.forEach(id => {
            const docRef = doc(db, 'items', id);
            batch.update(docRef, fieldUpdate);
        });
        await batch.commit();
    };

    // --- Category Methods ---
    const addCategory = async (category: Omit<AppCategory, 'id'>): Promise<string> => {
        const dataToSave = {
            ...category,
            type: category.parentId === null ? (category.type || null) : null
        };
        const docRef = await addDoc(collection(db, "categories"), cleanForFirebase(dataToSave));
        return docRef.id;
    };
    const updateCategory = async (category: AppCategory) => {
        const { id, ...data } = category;
        const dataToUpdate = {
            ...data,
            type: data.parentId === null ? (data.type || null) : null
        };
        await updateDoc(doc(db, "categories", id), cleanForFirebase(dataToUpdate));
    };
    const deleteCategory = async (id: string) => {
        const childrenQuery = query(collection(db, "categories"), where("parentId", "==", id));
        if (!(await getDocs(childrenQuery)).empty) throw new Error("Cannot delete a category that has child categories.");
        const itemsQuery = query(collection(db, "items"), where("categoryId", "==", id));
        if (!(await getDocs(itemsQuery)).empty) throw new Error("Cannot delete category: it is used by one or more items.");
        const templatesSnapshot = await getDocs(collection(db, "templates"));
        if (templatesSnapshot.docs.some(d => d.data().rules && d.data().rules[id])) throw new Error("Cannot delete category: it is used by one or more templates.");
        await deleteDoc(doc(db, 'categories', id));
    };
    const addMultipleCategories = async (categoriesToAdd: { parentName: string, childName?: string, type?: 'veg' | 'non-veg' | null, displayRank?: number }[]) => {
        const newlyAddedCategories: AppCategory[] = [];
        let importedCount = 0;

        for (const { parentName, childName, type, displayRank } of categoriesToAdd) {
            let parent = categories.find(c => c.name.toLowerCase() === parentName.toLowerCase() && c.parentId === null) 
                         || newlyAddedCategories.find(c => c.name.toLowerCase() === parentName.toLowerCase() && c.parentId === null);
            
            const isParentRow = !childName;

            if (!parent) {
                // This is a new parent category
                const newParentId = await addCategory({ name: parentName, parentId: null, type: isParentRow ? type : null, displayRank: isParentRow ? displayRank : undefined });
                parent = { id: newParentId, name: parentName, parentId: null, type: isParentRow ? type : null, displayRank: isParentRow ? displayRank : undefined };
                newlyAddedCategories.push(parent);
                importedCount++;
            } else {
                 // The parent already exists, check if we need to update it
                 const updates: Partial<AppCategory> = {};
                 if (isParentRow && displayRank !== undefined && parent.displayRank !== displayRank) {
                    updates.displayRank = displayRank;
                 }
                 // Only update type if it's explicitly provided in the file for a parent row
                 if (isParentRow && type !== undefined && parent.type !== type) {
                    updates.type = type;
                 }

                 if (Object.keys(updates).length > 0) {
                    await updateCategory({ ...parent, ...updates });
                    // Update local representation for subsequent checks within this import
                    Object.assign(parent, updates);
                 }
            }

            if (childName) {
                const childExists = categories.some(c => c.name.toLowerCase() === childName.toLowerCase() && c.parentId === parent!.id)
                                  || newlyAddedCategories.some(c => c.name.toLowerCase() === childName.toLowerCase() && c.parentId === parent!.id);
                if (!childExists) {
                    const newChildId = await addCategory({ name: childName, parentId: parent.id, type: null, displayRank });
                    newlyAddedCategories.push({ id: newChildId, name: childName, parentId: parent.id, type: null, displayRank });
                    importedCount++;
                }
            }
        }
        return importedCount;
    };
    const deleteAllCategories = async () => {
        // Validation: Check for dependent items, etc.
        const itemsSnapshot = await getDocs(collection(db, "items"));
        if (!itemsSnapshot.empty) {
            throw new Error(`Cannot delete all categories because ${itemsSnapshot.size} item(s) still exist. Please delete all items first.`);
        }
        const templatesSnapshot = await getDocs(collection(db, "templates"));
        if (templatesSnapshot.docs.some(d => d.data().rules && Object.keys(d.data().rules).length > 0)) {
            throw new Error("Cannot delete all categories because one or more templates have category-based rules. Please delete all templates first.");
        }

        const categoriesRef = collection(db, "categories");
        const snapshot = await getDocs(categoriesRef);
        if (snapshot.empty) return;
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    };
    const updateMultipleCategories = async (categoriesToUpdate: {id: string, displayRank: number}[]) => {
        const batch = writeBatch(db);
        categoriesToUpdate.forEach(category => {
            const docRef = doc(db, 'categories', category.id);
            batch.update(docRef, { displayRank: category.displayRank });
        });
        await batch.commit();
    };
    const mergeCategory = async (sourceCategoryId: string, destinationCategoryId: string) => {
        if (sourceCategoryId === destinationCategoryId) {
            throw new Error("Source and destination categories cannot be the same.");
        }
        
        const batch = writeBatch(db);

        // 1. Move items
        const itemsQuery = query(collection(db, 'items'), where('categoryId', '==', sourceCategoryId));
        const itemsSnapshot = await getDocs(itemsQuery);
        itemsSnapshot.forEach(itemDoc => {
            batch.update(itemDoc.ref, { categoryId: destinationCategoryId });
        });

        // 2. Move child categories
        const childrenQuery = query(collection(db, 'categories'), where('parentId', '==', sourceCategoryId));
        const childrenSnapshot = await getDocs(childrenQuery);
        childrenSnapshot.forEach(childDoc => {
            batch.update(childDoc.ref, { parentId: destinationCategoryId });
        });

        // 3. Delete the source category
        const sourceCategoryRef = doc(db, 'categories', sourceCategoryId);
        batch.delete(sourceCategoryRef);
        
        await batch.commit();
    };

    // --- Template Methods ---
    const addTemplate = async (template: Omit<MenuTemplate, 'id'>) => {
        await addDoc(collection(db, "templates"), cleanForFirebase(template));
    };
    const updateTemplate = async (template: MenuTemplate) => {
        const { id, ...data } = template;
        await updateDoc(doc(db, "templates", id), cleanForFirebase(data));
    };
    const deleteTemplate = async (templateId: string) => {
        await deleteDoc(doc(db, "templates", templateId));
    };
     const deleteAllTemplates = async () => {
        const templatesRef = collection(db, "templates");
        const snapshot = await getDocs(templatesRef);
        if (snapshot.empty) return;
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    };

    // --- User Methods ---
    const addUser = async (userData: Omit<User, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, "users"), cleanForFirebase(userData));
        return docRef.id;
    };
    const updateUser = async (user: User) => {
        const { id, password, ...data } = user;
        const userRef = doc(db, 'users', id);
        const dataToUpdate = cleanForFirebase(data);
        
        // Only include password in the update if it's provided and not empty
        if (password) {
            (dataToUpdate as any).password = password;
        }
        
        await updateDoc(userRef, dataToUpdate);
    };
    const deleteUser = async (userId: string) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            console.warn(`User with id ${userId} not found`);
            return;
        }
        const userData = userSnap.data() as User;
        const batch = writeBatch(db);

        // If it's a regular user assigned to a client, update client's access
        if (userData.role === 'regular' && userData.assignedClientId) {
            const clientRef = doc(db, 'clients', userData.assignedClientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                batch.update(clientRef, { hasSystemAccess: false });
            }
        }
        batch.delete(userRef);
        await batch.commit();
    };

    return (
        <AuditLogsContext.Provider value={{ auditLogs }}>
        <ClientsContext.Provider value={{ clients, addClient, updateClient, deleteClient, deleteAllClients, addSampleData, deleteSampleData }}>
        <EventsContext.Provider value={{ events, addEvent, updateEvent, deleteEvent, deleteAllEvents, duplicateEvent, importClientsAndEvents }}>
        <ItemsContext.Provider value={{ items, addItem, updateItem, deleteItem, deleteMultipleItems, moveMultipleItems, addMultipleItems, deleteAllItems, updateMultipleItems, batchUpdateServiceArticles, batchUpdateAccompaniments }}>
        <AppCategoriesContext.Provider value={{ categories, addCategory, updateCategory, deleteCategory, addMultipleCategories, deleteAllCategories, updateMultipleCategories, mergeCategory }}>
        <TemplatesContext.Provider value={{ templates, addTemplate, updateTemplate, deleteTemplate, deleteAllTemplates }}>
        <UsersContext.Provider value={{ users, addUser, updateUser, deleteUser }}>
        <LiveCountersContext.Provider value={{ liveCounters, addLiveCounter, updateLiveCounter, deleteLiveCounter, addMultipleLiveCounters, deleteAllLiveCountersAndItems, updateMultipleLiveCounters }}>
        <LiveCounterItemsContext.Provider value={{ liveCounterItems, addLiveCounterItem, updateLiveCounterItem, deleteLiveCounterItem, addMultipleLiveCounterItems, updateMultipleLiveCounterItems }}>
        <CatalogsContext.Provider value={{ catalogs, addCatalog, updateCatalog, deleteCatalog, deleteAllCatalogs, addMultipleCatalogs }}>
        <ChargeTypesContext.Provider value={{ settings: chargeTypes, ...chargeTypesMethods }}>
        <ExpenseTypesContext.Provider value={{ settings: expenseTypes, ...expenseTypesMethods }}>
        <PaymentModesContext.Provider value={{ settings: paymentModes, ...paymentModesMethods }}>
        <ReferralSourcesContext.Provider value={{ settings: referralSources, ...referralSourcesMethods }}>
        <ServiceArticlesContext.Provider value={{ settings: serviceArticles, ...serviceArticlesMethods }}>
        <ItemAccompanimentsContext.Provider value={{ settings: itemAccompaniments, addAccompaniment, updateAccompaniment, deleteAccompaniment }}>
        <UnitsContext.Provider value={{ settings: units, ...unitsMethods }}>
        <EventTypesContext.Provider value={{ settings: eventTypes, ...eventTypesMethods }}>
        <LocationsContext.Provider value={{ locations, addLocation, updateLocation, deleteLocation, updateMultipleLocations }}>
        <RolesContext.Provider value={{ roles, addRole, updateRole, deleteRole }}>
            {children}
        </RolesContext.Provider>
        </LocationsContext.Provider>
        </EventTypesContext.Provider>
        </UnitsContext.Provider>
        </ItemAccompanimentsContext.Provider>
        </ServiceArticlesContext.Provider>
        </ReferralSourcesContext.Provider>
        </PaymentModesContext.Provider>
        </ExpenseTypesContext.Provider>
        </ChargeTypesContext.Provider>
        </CatalogsContext.Provider>
        </LiveCounterItemsContext.Provider>
        </LiveCounterItemsContext.Provider>
        </UsersContext.Provider>
        </TemplatesContext.Provider>
        </AppCategoriesContext.Provider>
        </ItemsContext.Provider>
        </EventsContext.Provider>
        </ClientsContext.Provider>
        </AuditLogsContext.Provider>
    );
};

// --- APP ROUTER ---

type ViewState = {
  page: 'admin' | 'client-details';
  clientId?: string | null;
  eventIdToOpen?: string | null;
  eventToEditId?: string | null;
}

type AdminPageId = 'dashboard' | 'clients' | 'itemBank' | 'catalogs' | 'templates' | 'liveCounters' | 'reports' | 'users' | 'audit' | 'dataHub' | 'settings';

const Sidebar = ({ isOpen, setIsOpen, activePage, onNavigate, permissions }: {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    activePage: AdminPageId;
    onNavigate: (page: AdminPageId) => void;
    permissions: AppPermissions | null;
}) => {
    const { currentUser } = useAuth();
    if (!permissions) return null;

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, permission: permissions.dashboard },
        { id: 'clients', label: 'Clients', icon: Building, permission: permissions.clientsAndEvents },
        { id: 'itemBank', label: 'Item Bank', icon: ListTree, permission: permissions.itemBank },
        { id: 'catalogs', label: 'Catalogs', icon: BookCopy, permission: permissions.catalogs },
        { id: 'templates', label: 'Templates', icon: FileText, permission: permissions.templates },
        { id: 'liveCounters', label: 'Live Counters', icon: Salad, permission: permissions.liveCounters },
        { id: 'reports', label: 'Reports', icon: AreaChart, permission: permissions.reports },
        { id: 'users', label: 'Users & Roles', icon: UsersIcon, permission: permissions.users },
        { id: 'audit', label: 'Audit Logs', icon: History, permission: permissions.users },
        { id: 'dataHub', label: 'Data Hub', icon: Database, permission: currentUser?.role === 'admin' ? 'modify' : 'none' },
        { id: 'settings', label: 'Settings', icon: Wrench, permission: permissions.settings },
    ].filter(item => item.permission && item.permission !== 'none');

    const handleNavigation = (page: AdminPageId) => {
        onNavigate(page);
        if (window.innerWidth < 768) { // md breakpoint
            setIsOpen(false);
        }
    }

    return (
        <>
            {/* Overlay for mobile */}
            <div
                className={`fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
            ></div>

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-warm-gray-800 shadow-xl z-50 transform transition-transform duration-300 ease-in-out md:relative md:w-56 md:translate-x-0 md:flex-shrink-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="p-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                    <div className="leading-none text-center">
                        <span className="font-display font-bold text-2xl text-accent-500 tracking-normal">kumkuma</span>
                        <span className="block font-body text-[0.6rem] text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.2em] uppercase">CATERERS</span>
                    </div>
                </div>
                <nav className="p-4">
                    <ul className="space-y-2">
                        {navItems.map(item => (
                             <li key={item.id}>
                                <button 
                                    onClick={() => handleNavigation(item.id as AdminPageId)}
                                    className={`w-full flex items-center gap-3 p-3 text-left font-semibold rounded-lg transition-colors ${activePage === item.id ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300' : 'text-warm-gray-600 dark:text-warm-gray-300 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700'}`}
                                >
                                   <item.icon size={20} />
                                   <span>{item.label}</span>
                                </button>
                             </li>
                        ))}
                    </ul>
                </nav>
            </aside>
        </>
    );
};

const AppContent: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const [view, setView] = useState<ViewState>({ page: 'admin' });
    const userPermissions = useUserPermissions();
    const { events } = useEvents();
    const { clients } = useClients();
    
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [adminActivePage, setAdminActivePage] = useState<AdminPageId | null>(null);
    const [clientListFilters, setClientListFilters] = useState({
        name: '',
        phone: '',
        status: 'active' as 'active' | 'inactive' | 'all'
    });
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

    // Effect to set the initial landing page based on permissions
    useEffect(() => {
        if (userPermissions) {
            if (userPermissions.dashboard !== 'none') {
                setAdminActivePage('dashboard');
            } else {
                // Find the first available page if dashboard is not accessible
                const pageOrder: AdminPageId[] = [
                    'clients', 'itemBank', 'catalogs', 'templates', 'liveCounters', 
                    'reports', 'users', 'audit', 'dataHub', 'settings'
                ];
                const firstAvailablePage = pageOrder.find(page => userPermissions[page] && userPermissions[page] !== 'none');
                setAdminActivePage(firstAvailablePage || 'clients'); // Fallback to clients
            }
        }
    }, [userPermissions]);

    // Filter events for managers based on location
    const managedEvents = useMemo(() => {
        if (!currentUser || currentUser.role === 'admin' || !currentUser.managedLocationIds || currentUser.managedLocationIds.length === 0) {
            return events;
        }
        const locationNames = new Set(currentUser.managedLocationIds);
        return events.filter(event => locationNames.has(event.location));
    }, [events, currentUser]);

    const handleNavigateToClients = () => {
        setView({ page: 'admin' });
        setAdminActivePage('clients');
    };
    
    if (!currentUser) {
        return <LoginPage />;
    }

    if (currentUser.role === 'regular' && currentUser.assignedClientId) {
         return (
            <div className="min-h-screen bg-ivory dark:bg-warm-gray-900 text-warm-gray-700 dark:text-warm-gray-200">
                <header className="bg-white dark:bg-warm-gray-800 shadow-md p-2 sm:p-4 flex justify-between items-center sticky top-0 z-40">
                    <div className="leading-none text-center">
                        <span className="font-display font-bold text-xl sm:text-2xl text-accent-500 tracking-normal">kumkuma</span>
                        <span className="block font-body text-[0.5rem] sm:text-[0.6rem] text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.2em] uppercase">CATERERS</span>
                    </div>
                    <button onClick={logout} className="flex items-center gap-2 text-sm font-semibold text-warm-gray-600 hover:text-accent-500 dark:text-warm-gray-300 dark:hover:text-accent-400 transition-colors">
                        <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
                    </button>
                </header>
                 <main className="p-4 sm:p-8">
                    <ClientDetailsPage clientId={currentUser.assignedClientId} onBack={logout} />
                 </main>
            </div>
        );
    }
    
    if (currentUser.role === 'kitchen') {
        return <KitchenDashboardPage />;
    }
    
    const sidebarActivePage = view.page === 'client-details' ? 'clients' : adminActivePage || 'dashboard';

    return (
        <div className="flex h-screen bg-ivory dark:bg-warm-gray-900 text-warm-gray-700 dark:text-warm-gray-200">
            {isChangePasswordOpen && (
                <Modal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} title="Change Password">
                    <ChangePasswordForm onCancel={() => setIsChangePasswordOpen(false)} />
                </Modal>
            )}
            <Sidebar 
                isOpen={isSidebarOpen} 
                setIsOpen={setIsSidebarOpen} 
                activePage={sidebarActivePage}
                onNavigate={(page) => { setView({ page: 'admin' }); setAdminActivePage(page); }}
                permissions={userPermissions}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white dark:bg-warm-gray-800 shadow-md p-2 sm:p-4 flex justify-between items-center sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 md:hidden">
                            <Menu size={24} />
                        </button>
                        
                        {view.page === 'client-details' ? (
                             <button onClick={handleNavigateToClients} className="flex items-center gap-2 text-sm font-semibold text-warm-gray-600 hover:text-primary-600 dark:text-warm-gray-300 dark:hover:text-primary-400 transition-colors">
                                <ArrowLeft size={16} /> <span className="hidden sm:inline">Back to Clients</span>
                            </button>
                        ) : (
                            <span className="font-display text-xl font-bold">{adminActivePage?.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                        )}

                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold hidden sm:inline">Welcome, {currentUser.username}</span>
                         <button onClick={() => setIsChangePasswordOpen(true)} className="p-2 text-warm-gray-600 hover:text-primary-600 dark:text-warm-gray-300 dark:hover:text-primary-400 transition-colors" title="Change Password">
                            <Key size={16} />
                        </button>
                         <button onClick={logout} className="flex items-center gap-2 text-sm font-semibold text-warm-gray-600 hover:text-accent-500 dark:text-warm-gray-300 dark:hover:text-accent-400 transition-colors">
                            <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
                         </button>
                    </div>
                </header>
                 <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-8">
                    {userPermissions && adminActivePage && view.page === 'admin' && (
                        <AdminPage
                            activePage={adminActivePage}
                            onNavigate={(pageId, clientId, eventId, action) => {
                                if (clientId) {
                                    setView({
                                        page: 'client-details',
                                        clientId,
                                        eventIdToOpen: (action === 'viewMenu' || !action) ? eventId : undefined,
                                        eventToEditId: action === 'editEvent' ? eventId : undefined,
                                    });
                                } else {
                                    setView({ page: 'admin' });
                                    setAdminActivePage(pageId);
                                }
                            }}
                            permissions={userPermissions}
                            managedEvents={managedEvents}
                            clients={clients}
                            clientListFilters={clientListFilters}
                            setClientListFilters={setClientListFilters}
                        />
                    )}
                    {userPermissions && view.page === 'client-details' && view.clientId && (
                        <ClientDetailsPage 
                            clientId={view.clientId} 
                            onBack={handleNavigateToClients} 
                            eventIdToOpen={view.eventIdToOpen} 
                            eventToEditId={view.eventToEditId}
                        />
                    )}
                 </main>
            </div>
        </div>
    );
}

const App: React.FC = () => (
    <AuthProvider>
        <AppProviders>
            <AppContent />
        </AppProviders>
    </AuthProvider>
);

export default App;