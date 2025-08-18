

import React, { useState, createContext, useContext, ReactNode, useMemo, useEffect, useRef, ReactElement } from 'react';
import { Item, MenuTemplate, User, AppCategory, ItemType, Event, Client, LiveCounter, LiveCounterItem, AuditLog, Catalog, FinancialSetting, LocationSetting, Role, AppPermissions, PermissionLevel, EventState, ServiceArticle, ItemAccompaniment, ItemsContextType, ItemAccompanimentsContextType, AppCategoriesContextType, EventsContextType, EventTypeSetting, StateChangeHistoryEntry, RawMaterial, Recipe, RecipeRawMaterial, RawMaterialsContextType, RecipesContextType, RestaurantSetting, RestaurantsContextType, Order, OrdersContextType, OrderTemplate, OrderTemplatesContextType, FinancialSettingContextType, Platter, PlattersContextType, Activity, ClientTask, ActivitiesContextType, ClientTasksContextType, MuhurthamDate, MuhurthamDatesContextType } from './types';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { ClientDetailsPage, MyTasksModal } from './pages/ClientDetailsPage';
import { v4 as uuidv4 } from 'uuid';
import { Settings, LogOut, ArrowLeft, Menu, X, LayoutGrid, Building, ListTree, BookCopy, FileText, Salad, AreaChart, Users as UsersIcon, History, Database, Wrench, Key, ListChecks } from 'lucide-react';
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
    deleteField,
} from 'firebase/firestore';
import { cleanForFirebase, dateToYYYYMMDD, formatYYYYMMDD } from './lib/utils';
import { AuthProvider, useAuth, useUserPermissions } from './contexts/AuthContext';
import { logAuditEvent } from './lib/audit';
import { KitchenDashboardPage } from './pages/KitchenDashboardPage';
import Modal from './components/Modal';
import { ChangePasswordForm } from './features/users/ChangePasswordForm';
import {
    RolesContext, AuditLogsContext, CatalogsContext, LiveCountersContext,
    LiveCounterItemsContext, ClientsContext, EventsContext, ItemsContext,
    AppCategoriesContext, TemplatesContext, UsersContext, ChargeTypesContext,
    ExpenseTypesContext, PaymentModesContext, ReferralSourcesContext, ServiceArticlesContext,
    ItemAccompanimentsContext, UnitsContext, EventTypesContext, LocationsContext,
    RawMaterialsContext, RecipesContext, useEvents, useClients, RestaurantsContext, OrdersContext, OrderTemplatesContext, PlattersContext, ActivitiesContext, ClientTasksContext,
    MuhurthamDatesContext
} from './contexts/AppContexts';
import { secondaryButton } from './components/common/styles';


// --- MOCK DATA ---
const INITIAL_CATEGORIES_FIRESTORE: (Omit<AppCategory, 'id' | 'parentId'> & { children?: Omit<AppCategory, 'id' | 'parentId'>[] })[] = [
    // ... (This can be kept as it is for initial seeding)
];

const INITIAL_FINANCIAL_SETTINGS = {
    chargeTypes: ['Transportation', 'Additional Staff', 'Breakage', 'Special Request', 'Additional PAX'],
    expenseTypes: ['Groceries', 'Staff Payment', 'Rent', 'Utilities'],
    paymentModes: ['Cash', 'UPI', 'Bank Transfer', 'Credit Card'],
    referralSources: ['Google', 'Word of Mouth', 'Existing Client', 'Vendor'],
    units: ['kg', 'grams', 'litres', 'ml', 'pieces', 'bunch', 'packet'],
    eventTypes: ['Wedding', 'Birthday Party', 'Corporate Event', 'Private Gathering'],
    serviceArticles: ['Chafing Dish', 'Serving Spoon', 'Water Dispenser', 'Salad Bowl'],
};

// --- DATA PROVIDERS ---
const AppProviders = ({ children }: { children: ReactNode }) => {
    // This component will now contain ALL data-related state and logic.
    // Each section is a separate data domain (e.g., items, categories).

    // --- STATE ---
    const [items, setItems] = useState<Item[]>([]);
    const [categories, setCategories] = useState<AppCategory[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [templates, setTemplates] = useState<MenuTemplate[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [liveCounters, setLiveCounters] = useState<LiveCounter[]>([]);
    const [liveCounterItems, setLiveCounterItems] = useState<LiveCounterItem[]>([]);
    const [locations, setLocations] = useState<LocationSetting[]>([]);
    const [eventTypes, setEventTypes] = useState<EventTypeSetting[]>([]);
    const [chargeTypes, setChargeTypes] = useState<FinancialSetting[]>([]);
    const [expenseTypes, setExpenseTypes] = useState<FinancialSetting[]>([]);
    const [paymentModes, setPaymentModes] = useState<FinancialSetting[]>([]);
    const [referralSources, setReferralSources] = useState<FinancialSetting[]>([]);
    const [serviceArticles, setServiceArticles] = useState<ServiceArticle[]>([]);
    const [itemAccompaniments, setItemAccompaniments] = useState<ItemAccompaniment[]>([]);
    const [units, setUnits] = useState<FinancialSetting[]>([]);
    const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [restaurants, setRestaurants] = useState<RestaurantSetting[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [orderTemplates, setOrderTemplates] = useState<OrderTemplate[]>([]);
    const [platters, setPlatters] = useState<Platter[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [clientTasks, setClientTasks] = useState<ClientTask[]>([]);
    const [muhurthamDates, setMuhurthamDates] = useState<MuhurthamDate[]>([]);


    // --- EFFECTS for Firestore subscriptions ---
    useEffect(() => {
        const collectionsToWatch: Record<string, React.Dispatch<any>> = {
            items: setItems,
            categories: setCategories,
            events: setEvents,
            clients: setClients,
            catalogs: setCatalogs,
            templates: setTemplates,
            users: setUsers,
            roles: setRoles,
            auditLogs: setAuditLogs,
            liveCounters: setLiveCounters,
            liveCounterItems: setLiveCounterItems,
            locations: setLocations,
            eventTypes: setEventTypes,
            chargeTypes: setChargeTypes,
            expenseTypes: setExpenseTypes,
            paymentModes: setPaymentModes,
            referralSources: setReferralSources,
            serviceArticles: setServiceArticles,
            itemAccompaniments: setItemAccompaniments,
            units: setUnits,
            ingredients: setRawMaterials,
            recipes: setRecipes,
            restaurants: setRestaurants,
            orders: setOrders,
            orderTemplates: setOrderTemplates,
            platters: setPlatters,
            activities: setActivities,
            clientTasks: setClientTasks,
            muhurthamDates: setMuhurthamDates,
        };

        const unsubs = Object.entries(collectionsToWatch).map(([name, setter]) => {
            return onSnapshot(collection(db, name), (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setter(data as any);
            });
        });

        // Seed initial financial settings if they don't exist
        Object.entries(INITIAL_FINANCIAL_SETTINGS).forEach(async ([collectionName, names]) => {
            const collRef = collection(db, collectionName);
            const snapshot = await getDocs(collRef);
            if (snapshot.empty) {
                const batch = writeBatch(db);
                names.forEach(name => {
                    const docRef = doc(collRef);
                    batch.set(docRef, { name });
                });
                await batch.commit();
            }
        });

        return () => unsubs.forEach(unsub => unsub());
    }, []);

    // --- CRUD FUNCTIONS ---
    
    // --- Users ---
    const addUser = async (user: Omit<User, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'users'), cleanForFirebase(user));
        return docRef.id;
    };
    const updateUser = async (user: User) => {
        await updateDoc(doc(db, 'users', user.id), cleanForFirebase(user));
    };
    const deleteUser = async (userId: string) => {
        await deleteDoc(doc(db, 'users', userId));
    };

    // --- Roles ---
    const addRole = async (role: Omit<Role, 'id'>) => {
        await addDoc(collection(db, 'roles'), cleanForFirebase(role));
    };
    const updateRole = async (role: Role) => {
        await updateDoc(doc(db, 'roles', role.id), cleanForFirebase(role));
    };
    const deleteRole = async (roleId: string) => {
        const usersQuery = query(collection(db, 'users'), where('roleId', '==', roleId));
        const userSnapshot = await getDocs(usersQuery);
        if (!userSnapshot.empty) {
            throw new Error(`Cannot delete role. It is currently assigned to ${userSnapshot.size} user(s). Please reassign them first.`);
        }
        await deleteDoc(doc(db, 'roles', roleId));
    };
    
    // --- Clients ---
    const addClient = async (client: Omit<Client, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'clients'), cleanForFirebase(client));
        if (client.hasSystemAccess) {
            const userForClient: Omit<User, 'id'> = {
                username: client.phone, password: client.phone, role: 'regular',
                status: 'active', assignedClientId: docRef.id,
            };
            await addUser(userForClient);
        }
        return docRef.id;
    };
    const updateClient = async (client: Client) => {
        const clientRef = doc(db, 'clients', client.id);
        await updateDoc(clientRef, cleanForFirebase(client));

        const usersQuery = query(collection(db, 'users'), where('assignedClientId', '==', client.id));
        const userSnapshot = await getDocs(usersQuery);
        const userExists = !userSnapshot.empty;

        if (client.hasSystemAccess && !userExists) {
            const userForClient: Omit<User, 'id'> = {
                username: client.phone, password: client.phone, role: 'regular',
                status: client.status || 'active', assignedClientId: client.id,
            };
            await addUser(userForClient);
        } else if (!client.hasSystemAccess && userExists) {
            const batch = writeBatch(db);
            userSnapshot.forEach(userDoc => batch.delete(userDoc.ref));
            await batch.commit();
        } else if (client.hasSystemAccess && userExists) {
            const userDoc = userSnapshot.docs[0];
            await updateDoc(userDoc.ref, { 
                status: client.status || 'active', 
                username: client.phone,
                // Consider if password should also be updated here
            });
        }
    };
    const deleteClient = async (clientId: string) => {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'clients', clientId));
        const eventsQuery = query(collection(db, 'events'), where('clientId', '==', clientId));
        const eventsSnapshot = await getDocs(eventsQuery);
        eventsSnapshot.forEach(d => batch.delete(d.ref));
        const usersQuery = query(collection(db, 'users'), where('assignedClientId', '==', clientId));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(d => batch.delete(d.ref));
        await batch.commit();
    };
    const deleteAllClients = async () => { console.warn("deleteAllClients not implemented") };
    const addSampleData = async () => { console.warn("addSampleData not implemented") };
    const deleteSampleData = async () => { console.warn("deleteSampleData not implemented") };


    const addRawMaterial = async (rawMaterial: Omit<RawMaterial, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'ingredients'), cleanForFirebase(rawMaterial));
        return docRef.id;
    };
    const updateRawMaterial = async (rawMaterial: RawMaterial) => {
        await updateDoc(doc(db, 'ingredients', rawMaterial.id), cleanForFirebase(rawMaterial));
    };
    const deleteRawMaterial = async (id: string) => {
        await deleteDoc(doc(db, 'ingredients', id));
    };
    const mergeRawMaterials = async (sourceRawMaterialIds: string[], destinationRawMaterialId: string) => {
        const batch = writeBatch(db);
    
        recipes.forEach(recipe => {
            const containsSource = recipe.rawMaterials.some(rm => sourceRawMaterialIds.includes(rm.rawMaterialId));
            if (!containsSource) return;
    
            let destinationQty = 0;
            const newRawMaterials: RecipeRawMaterial[] = [];
            
            recipe.rawMaterials.forEach(rm => {
                if (rm.rawMaterialId === destinationRawMaterialId) {
                    destinationQty += rm.quantity;
                } else if (sourceRawMaterialIds.includes(rm.rawMaterialId)) {
                    destinationQty += rm.quantity;
                } else {
                    newRawMaterials.push(rm);
                }
            });
    
            newRawMaterials.push({
                rawMaterialId: destinationRawMaterialId,
                quantity: destinationQty
            });
    
            const recipeRef = doc(db, 'recipes', recipe.id);
            batch.update(recipeRef, { rawMaterials: newRawMaterials });
        });
    
        sourceRawMaterialIds.forEach(id => {
            batch.delete(doc(db, 'ingredients', id));
        });
    
        await batch.commit();
    };

    const addRecipe = async (recipe: Omit<Recipe, 'id'>) => {
        await addDoc(collection(db, 'recipes'), cleanForFirebase(recipe));
    };
    const updateRecipe = async (recipe: Recipe) => {
        await updateDoc(doc(db, 'recipes', recipe.id), cleanForFirebase(recipe));
    };
    const deleteRecipe = async (id: string) => {
        await deleteDoc(doc(db, 'recipes', id));
    };
    const addMultipleRecipes = async (data: any[]): Promise<number> => {
        const batch = writeBatch(db);
        const recipesCollection = collection(db, 'recipes');
        const rawMaterialsCollection = collection(db, 'ingredients');

        const existingRecipes = [...recipes];
        const existingRawMaterials = [...rawMaterials];

        const recipesToCreate = new Map<string, any[]>();
        data.forEach(row => {
            const recipeName = row['recipe']?.trim();
            if (!recipeName) return;
            if (!recipesToCreate.has(recipeName.toLowerCase())) {
                recipesToCreate.set(recipeName.toLowerCase(), []);
            }
            recipesToCreate.get(recipeName.toLowerCase())!.push(row);
        });

        let importedCount = 0;
        
        for (const [recipeNameKey, rows] of recipesToCreate.entries()) {
            const recipeName = rows[0]['recipe'].trim();
            if (existingRecipes.some(r => r.name.toLowerCase() === recipeNameKey)) {
                console.warn(`Skipping recipe "${recipeName}" as it already exists.`);
                continue;
            }

            const outputRow = rows.find(r => r['output quantity'] && r['output unit']);
            if (!outputRow) {
                console.warn(`Skipping recipe "${recipeName}" due to missing output quantity/unit.`);
                continue;
            }
            
            const outputUnit = String(outputRow['output unit']).toLowerCase();
            const outputKg = (outputUnit === 'kg' || outputUnit === 'kgs') ? Number(outputRow['output quantity']) : 0;
            const outputLitres = (outputUnit === 'litres' || outputUnit === 'litre') ? Number(outputRow['output quantity']) : 0;
            
            if (outputKg <= 0 && outputLitres <= 0) {
                console.warn(`Skipping recipe "${recipeName}" due to invalid output quantity/unit.`);
                continue;
            }
            
            const recipeRawMaterials: RecipeRawMaterial[] = [];

            for (const row of rows) {
                const rawMaterialName = row['raw material']?.trim();
                const rawMaterialUnit = row['raw material unit']?.trim();
                const rawMaterialQty = Number(row['raw material qty']);

                if (!rawMaterialName || !rawMaterialUnit || isNaN(rawMaterialQty) || rawMaterialQty <= 0) {
                    continue;
                }

                let rawMaterial = existingRawMaterials.find(rm => 
                    rm.name.toLowerCase() === rawMaterialName.toLowerCase() && 
                    rm.unit.toLowerCase() === rawMaterialUnit.toLowerCase()
                );

                if (!rawMaterial) {
                    const newRawMaterialData = { name: rawMaterialName, unit: rawMaterialUnit };
                    const newDocRef = doc(rawMaterialsCollection);
                    batch.set(newDocRef, cleanForFirebase(newRawMaterialData));
                    
                    rawMaterial = { id: newDocRef.id, ...newRawMaterialData };
                    existingRawMaterials.push(rawMaterial);
                }

                recipeRawMaterials.push({
                    rawMaterialId: rawMaterial.id,
                    quantity: rawMaterialQty,
                });
            }
            
            const newRecipe: Omit<Recipe, 'id'> = {
                name: recipeName,
                instructions: outputRow['instructions'] || '',
                outputKg,
                outputLitres,
                rawMaterials: recipeRawMaterials,
            };

            const newRecipeRef = doc(recipesCollection);
            batch.set(newRecipeRef, cleanForFirebase(newRecipe));
            existingRecipes.push({ id: newRecipeRef.id, ...newRecipe });
            importedCount++;
        }

        await batch.commit();
        return importedCount;
    };
    
    const addRestaurant = async (restaurant: Omit<RestaurantSetting, 'id'>) => {
        await addDoc(collection(db, 'restaurants'), cleanForFirebase(restaurant));
    };
    const updateRestaurant = async (restaurant: RestaurantSetting) => {
        await updateDoc(doc(db, 'restaurants', restaurant.id), cleanForFirebase(restaurant));
    };
    const deleteRestaurant = async (id: string) => {
        await deleteDoc(doc(db, 'restaurants', id));
    };

    const addOrder = async (order: Omit<Order, 'id'>) => {
        await addDoc(collection(db, 'orders'), cleanForFirebase(order));
    };
    const updateOrder = async (order: Order) => {
        await updateDoc(doc(db, 'orders', order.id), cleanForFirebase(order));
    };
    const deleteOrder = async (id: string) => {
        await deleteDoc(doc(db, 'orders', id));
    };

    const addOrderTemplate = async (template: Omit<OrderTemplate, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'orderTemplates'), cleanForFirebase(template));
        return docRef.id;
    };
    const updateOrderTemplate = async (template: OrderTemplate) => {
        await updateDoc(doc(db, 'orderTemplates', template.id), cleanForFirebase(template));
    };
    const deleteOrderTemplate = async (id: string) => {
        await deleteDoc(doc(db, 'orderTemplates', id));
    };

    const addPlatter = async (platter: Omit<Platter, 'id'>) => {
        await addDoc(collection(db, 'platters'), cleanForFirebase(platter));
    };
    const updatePlatter = async (platter: Platter) => {
        await updateDoc(doc(db, 'platters', platter.id), cleanForFirebase(platter));
    };
    const deletePlatter = async (id: string) => {
        await deleteDoc(doc(db, 'platters', id));
    };

    const addActivity = async (activity: Omit<Activity, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'activities'), cleanForFirebase(activity));
        return docRef.id;
    };
    const updateActivity = async (activity: Activity) => {
        await updateDoc(doc(db, 'activities', activity.id), cleanForFirebase(activity));
    };
    const deleteActivity = async (id: string) => {
        await deleteDoc(doc(db, 'activities', id));
    };

    const addTask = async (task: Omit<ClientTask, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'clientTasks'), cleanForFirebase(task));
        return docRef.id;
    };
    const updateTask = async (task: ClientTask) => {
        await updateDoc(doc(db, 'clientTasks', task.id), cleanForFirebase(task));
    };
    const deleteTask = async (id: string) => {
        await deleteDoc(doc(db, 'clientTasks', id));
    };

    const addMuhurthamDate = async (date: string) => {
        const exists = muhurthamDates.some(md => md.date === date);
        if (exists) return;
        await addDoc(collection(db, 'muhurthamDates'), { date });
    };
    const deleteMuhurthamDateByDate = async (date: string) => {
        const docToDelete = muhurthamDates.find(md => md.date === date);
        if (docToDelete) {
            await deleteDoc(doc(db, 'muhurthamDates', docToDelete.id));
        }
    };
    const importMuhurthamDates = async (data: any[]): Promise<number> => {
        const batch = writeBatch(db);
        const collectionRef = collection(db, 'muhurthamDates');
        const existingDates = new Set(muhurthamDates.map(md => md.date));
        let importedCount = 0;
        data.forEach(row => {
            const dateStr = row.date;
            if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !existingDates.has(dateStr)) {
                const newDocRef = doc(collectionRef);
                batch.set(newDocRef, { date: dateStr });
                existingDates.add(dateStr);
                importedCount++;
            }
        });
        await batch.commit();
        return importedCount;
    };
    const deleteAllMuhurthamDates = async () => {
        if (window.confirm(`Are you sure you want to delete all ${muhurthamDates.length} Muhurtham dates?`)) {
            const batch = writeBatch(db);
            muhurthamDates.forEach(md => {
                batch.delete(doc(db, 'muhurthamDates', md.id));
            });
            await batch.commit();
        }
    };

    // Helper for financial settings
    const createFinancialSettingHooks = (collectionName: string) => {
        return {
            addSetting: async (name: string) => { await addDoc(collection(db, collectionName), { name }); },
            updateSetting: async (id: string, name: string) => { await updateDoc(doc(db, collectionName, id), { name }); },
            deleteSetting: async (id: string) => { await deleteDoc(doc(db, collectionName, id)); },
        };
    };

    const { addEvent, updateEvent, deleteEvent, deleteAllEvents, duplicateEvent, importClientsAndEvents } = useMemo(() => {
        const addEvent = async (event: Omit<Event, 'id'>) => {
             const docRef = await addDoc(collection(db, 'events'), cleanForFirebase(event));
             return docRef.id;
        };
        const updateEvent = async (event: Event) => {
             await updateDoc(doc(db, 'events', event.id), cleanForFirebase(event));
        };
        const deleteEvent = async (event: Event) => {
             await deleteDoc(doc(db, 'events', event.id));
        };
        const deleteAllEvents = async () => { console.warn("deleteAllEvents not implemented") };
        const duplicateEvent = async (event: Event) => { console.warn("duplicateEvent not implemented") };
        const importClientsAndEvents = async (data: any[]) => { return 0; /* ... */ };
        
        return { addEvent, updateEvent, deleteEvent, deleteAllEvents, duplicateEvent, importClientsAndEvents };
    }, []);

    const addCategory = async (category: Omit<AppCategory, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'categories'), cleanForFirebase(category));
        return docRef.id;
    };
    const updateCategory = async (category: AppCategory) => await updateDoc(doc(db, 'categories', category.id), cleanForFirebase(category));
    const deleteCategory = async (id: string) => {
        const itemsQuery = query(collection(db, 'items'), where('categoryId', '==', id));
        if (!(await getDocs(itemsQuery)).empty) throw new Error("Cannot delete category. It contains items.");
        const subCategoriesQuery = query(collection(db, 'categories'), where('parentId', '==', id));
        if (!(await getDocs(subCategoriesQuery)).empty) throw new Error("Cannot delete category. It has sub-categories.");
        await deleteDoc(doc(db, 'categories', id));
    };
    const updateMultipleCategories = async (cats: {id: string, displayRank: number}[]) => {
        const batch = writeBatch(db);
        cats.forEach(c => batch.update(doc(db, 'categories', c.id), { displayRank: c.displayRank }));
        await batch.commit();
    };
    const mergeCategory = async (sourceId: string, destId: string) => {
        const batch = writeBatch(db);
        const itemsQuery = query(collection(db, 'items'), where('categoryId', '==', sourceId));
        (await getDocs(itemsQuery)).forEach(d => batch.update(d.ref, { categoryId: destId }));
        const subCatQuery = query(collection(db, 'categories'), where('parentId', '==', sourceId));
        (await getDocs(subCatQuery)).forEach(d => batch.update(d.ref, { parentId: destId }));
        batch.delete(doc(db, 'categories', sourceId));
        await batch.commit();
    };

    const addItem = async (item: Omit<Item, 'id'>) => { await addDoc(collection(db, 'items'), cleanForFirebase(item)); };
    const updateItem = async (item: Item) => { await updateDoc(doc(db, 'items', item.id), cleanForFirebase(item)); };
    const deleteItem = async (id: string) => { await deleteDoc(doc(db, 'items', id)); };
    const deleteMultipleItems = async (ids: string[]) => {
        const batch = writeBatch(db);
        ids.forEach(id => batch.delete(doc(db, 'items', id)));
        await batch.commit();
    };
    const moveMultipleItems = async (ids: string[], destId: string) => {
        const batch = writeBatch(db);
        ids.forEach(id => batch.update(doc(db, 'items', id), { categoryId: destId }));
        await batch.commit();
    };
    const updateMultipleItems = async (itemsToUpdate: {id: string, displayRank: number}[]) => {
        const batch = writeBatch(db);
        itemsToUpdate.forEach(item => batch.update(doc(db, 'items', item.id), { displayRank: item.displayRank }));
        await batch.commit();
    };
    const batchUpdateServiceArticles = async (ids: string[], articleId: string, action: 'add' | 'remove') => {
        const batch = writeBatch(db);
        const op = action === 'add' ? arrayUnion(articleId) : arrayRemove(articleId);
        ids.forEach(id => batch.update(doc(db, 'items', id), { serviceArticleIds: op }));
        await batch.commit();
    };
    const batchUpdateAccompaniments = async (ids: string[], accId: string, action: 'add' | 'remove') => {
        const batch = writeBatch(db);
        const op = action === 'add' ? arrayUnion(accId) : arrayRemove(accId);
        ids.forEach(id => batch.update(doc(db, 'items', id), { accompanimentIds: op }));
        await batch.commit();
    };

    const addCatalog = async (cat: Omit<Catalog, 'id'>) => { await addDoc(collection(db, 'catalogs'), cleanForFirebase(cat)); };
    const updateCatalog = async (cat: Catalog) => { await updateDoc(doc(db, 'catalogs', cat.id), cleanForFirebase(cat)); };
    const deleteCatalog = async (id: string) => { await deleteDoc(doc(db, 'catalogs', id)); };

    const addTemplate = async (tmpl: Omit<MenuTemplate, 'id'>) => { await addDoc(collection(db, 'templates'), cleanForFirebase(tmpl)); };
    const updateTemplate = async (tmpl: MenuTemplate) => { await updateDoc(doc(db, 'templates', tmpl.id), cleanForFirebase(tmpl)); };
    const deleteTemplate = async (id: string) => { await deleteDoc(doc(db, 'templates', id)); };
    
    const addLiveCounter = async (lc: Omit<LiveCounter, 'id'>) => { const docRef = await addDoc(collection(db, 'liveCounters'), cleanForFirebase(lc)); return docRef.id; };
    const updateLiveCounter = async (lc: LiveCounter) => { await updateDoc(doc(db, 'liveCounters', lc.id), cleanForFirebase(lc)); };
    const deleteLiveCounter = async (id: string) => {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'liveCounters', id));
        const itemsQuery = query(collection(db, 'liveCounterItems'), where('liveCounterId', '==', id));
        (await getDocs(itemsQuery)).forEach(d => batch.delete(d.ref));
        await batch.commit();
    };
    const updateMultipleLiveCounters = async (lcs: {id:string, displayRank:number}[]) => {
        const batch = writeBatch(db);
        lcs.forEach(lc => batch.update(doc(db, 'liveCounters', lc.id), { displayRank: lc.displayRank }));
        await batch.commit();
    };

    const addLiveCounterItem = async (lci: Omit<LiveCounterItem, 'id'>) => { await addDoc(collection(db, 'liveCounterItems'), cleanForFirebase(lci)); };
    const updateLiveCounterItem = async (lci: LiveCounterItem) => { await updateDoc(doc(db, 'liveCounterItems', lci.id), cleanForFirebase(lci)); };
    const deleteLiveCounterItem = async (id: string) => { await deleteDoc(doc(db, 'liveCounterItems', id)); };
    const updateMultipleLiveCounterItems = async (lcItems: {id:string, displayRank:number}[]) => {
        const batch = writeBatch(db);
        lcItems.forEach(item => batch.update(doc(db, 'liveCounterItems', item.id), { displayRank: item.displayRank }));
        await batch.commit();
    };

    const addLocation = async (loc: Omit<LocationSetting, 'id'>) => { await addDoc(collection(db, 'locations'), cleanForFirebase(loc)); };
    const updateLocation = async (loc: LocationSetting) => { await updateDoc(doc(db, 'locations', loc.id), cleanForFirebase(loc)); };
    const deleteLocation = async (id: string) => { await deleteDoc(doc(db, 'locations', id)); };
    const updateMultipleLocations = async (locs: {id:string, displayRank:number}[]) => {
        const batch = writeBatch(db);
        locs.forEach(loc => batch.update(doc(db, 'locations', loc.id), { displayRank: loc.displayRank }));
        await batch.commit();
    };

    const addAccompaniment = async (acc: Omit<ItemAccompaniment, 'id'>) => { await addDoc(collection(db, 'itemAccompaniments'), cleanForFirebase(acc)); };
    const updateAccompaniment = async (acc: ItemAccompaniment) => { await updateDoc(doc(db, 'itemAccompaniments', acc.id), cleanForFirebase(acc)); };
    const deleteAccompaniment = async (id: string) => { await deleteDoc(doc(db, 'itemAccompaniments', id)); };
    
    const mergeUnits = async (sourceIds: string[], destinationId: string) => {
        const batch = writeBatch(db);
        
        const destinationUnit = units.find(u => u.id === destinationId);
        if (!destinationUnit) throw new Error("Destination unit not found.");
    
        const sourceUnits = units.filter(u => sourceIds.includes(u.id));
        const sourceUnitNames = sourceUnits.map(u => u.name);
    
        const ingredientsQuery = query(collection(db, 'ingredients'), where('unit', 'in', sourceUnitNames));
        const ingredientsSnapshot = await getDocs(ingredientsQuery);
        
        ingredientsSnapshot.forEach(docSnapshot => {
            batch.update(docSnapshot.ref, { unit: destinationUnit.name });
        });
    
        sourceIds.forEach(id => {
            batch.delete(doc(db, 'units', id));
        });
    
        await batch.commit();
    };

    // --- CONTEXT VALUES ---
    const rawMaterialsContextValue: RawMaterialsContextType = { rawMaterials, addRawMaterial, updateRawMaterial, deleteRawMaterial, mergeRawMaterials };
    const recipesContextValue: RecipesContextType = { recipes, addRecipe, updateRecipe, deleteRecipe, addMultipleRecipes };
    const restaurantsContextValue: RestaurantsContextType = { restaurants, addRestaurant, updateRestaurant, deleteRestaurant };
    const ordersContextValue: OrdersContextType = { orders, addOrder, updateOrder, deleteOrder };
    const orderTemplatesContextValue: OrderTemplatesContextType = { orderTemplates, addOrderTemplate, updateOrderTemplate, deleteOrderTemplate };
    const plattersContextValue: PlattersContextType = { platters, addPlatter, updatePlatter, deletePlatter };
    const eventsContextValue: EventsContextType = { events, addEvent, updateEvent, deleteEvent, deleteAllEvents, duplicateEvent, importClientsAndEvents };
    const clientsContextValue = { clients, addClient, updateClient, deleteClient, deleteAllClients, addSampleData, deleteSampleData };
    const usersContextValue = { users, addUser, updateUser, deleteUser };
    const rolesContextValue = { roles, addRole, updateRole, deleteRole };
    const categoriesContextValue = { categories, addCategory, updateCategory, deleteCategory, updateMultipleCategories, mergeCategory, addMultipleCategories: (d:any) => Promise.resolve(0), deleteAllCategories: () => Promise.resolve() };
    const itemsContextValue = { items, addItem, updateItem, deleteItem, deleteMultipleItems, moveMultipleItems, updateMultipleItems, batchUpdateServiceArticles, batchUpdateAccompaniments, addMultipleItems: (d:any) => Promise.resolve(0), deleteAllItems: () => Promise.resolve() };
    const catalogsContextValue = { catalogs, addCatalog, updateCatalog, deleteCatalog, deleteAllCatalogs: () => Promise.resolve(), addMultipleCatalogs: (d:any) => Promise.resolve() };
    const templatesContextValue = { templates, addTemplate, updateTemplate, deleteTemplate, deleteAllTemplates: () => Promise.resolve() };
    const liveCountersContextValue = { liveCounters, addLiveCounter, updateLiveCounter, deleteLiveCounter, updateMultipleLiveCounters, addMultipleLiveCounters: (d:any) => Promise.resolve(new Map()), deleteAllLiveCountersAndItems: () => Promise.resolve() };
    const liveCounterItemsContextValue = { liveCounterItems, addLiveCounterItem, updateLiveCounterItem, deleteLiveCounterItem, updateMultipleLiveCounterItems, addMultipleLiveCounterItems: (d:any) => Promise.resolve() };
    const locationsContextValue = { locations, addLocation, updateLocation, deleteLocation, updateMultipleLocations };
    const itemAccompanimentsContextValue = { settings: itemAccompaniments, addAccompaniment, updateAccompaniment, deleteAccompaniment };
    const unitsContextValue: FinancialSettingContextType = {
        settings: units,
        ...createFinancialSettingHooks('units'),
        mergeSettings: mergeUnits,
    };
    const activitiesContextValue: ActivitiesContextType = { activities, addActivity, updateActivity, deleteActivity };
    const clientTasksContextValue: ClientTasksContextType = { tasks: clientTasks, addTask, updateTask, deleteTask };
    const muhurthamDatesContextValue: MuhurthamDatesContextType = { muhurthamDates, addMuhurthamDate, deleteMuhurthamDateByDate, importMuhurthamDates, deleteAllMuhurthamDates };


    return (
        <AuditLogsContext.Provider value={{ auditLogs }}>
            <UsersContext.Provider value={usersContextValue}>
                <RolesContext.Provider value={rolesContextValue}>
                    <ClientsContext.Provider value={clientsContextValue}>
                        <EventsContext.Provider value={eventsContextValue}>
                            <AppCategoriesContext.Provider value={categoriesContextValue}>
                                <ItemsContext.Provider value={itemsContextValue}>
                                    <CatalogsContext.Provider value={catalogsContextValue}>
                                        <TemplatesContext.Provider value={templatesContextValue}>
                                            <LiveCountersContext.Provider value={liveCountersContextValue}>
                                                <LiveCounterItemsContext.Provider value={liveCounterItemsContextValue}>
                                                    <LocationsContext.Provider value={locationsContextValue}>
                                                        <EventTypesContext.Provider value={{ settings: eventTypes, ...createFinancialSettingHooks('eventTypes') }}>
                                                            <ChargeTypesContext.Provider value={{ settings: chargeTypes, ...createFinancialSettingHooks('chargeTypes') }}>
                                                                <ExpenseTypesContext.Provider value={{ settings: expenseTypes, ...createFinancialSettingHooks('expenseTypes') }}>
                                                                    <PaymentModesContext.Provider value={{ settings: paymentModes, ...createFinancialSettingHooks('paymentModes') }}>
                                                                        <ReferralSourcesContext.Provider value={{ settings: referralSources, ...createFinancialSettingHooks('referralSources') }}>
                                                                            <ServiceArticlesContext.Provider value={{ settings: serviceArticles, ...createFinancialSettingHooks('serviceArticles') }}>
                                                                                <ItemAccompanimentsContext.Provider value={itemAccompanimentsContextValue}>
                                                                                    <UnitsContext.Provider value={unitsContextValue}>
                                                                                        <RawMaterialsContext.Provider value={rawMaterialsContextValue}>
                                                                                            <RecipesContext.Provider value={recipesContextValue}>
                                                                                                <RestaurantsContext.Provider value={restaurantsContextValue}>
                                                                                                    <OrdersContext.Provider value={ordersContextValue}>
                                                                                                        <OrderTemplatesContext.Provider value={orderTemplatesContextValue}>
                                                                                                            <PlattersContext.Provider value={plattersContextValue}>
                                                                                                                <ActivitiesContext.Provider value={activitiesContextValue}>
                                                                                                                    <ClientTasksContext.Provider value={clientTasksContextValue}>
                                                                                                                        <MuhurthamDatesContext.Provider value={muhurthamDatesContextValue}>
                                                                                                                            {children}
                                                                                                                        </MuhurthamDatesContext.Provider>
                                                                                                                    </ClientTasksContext.Provider>
                                                                                                                </ActivitiesContext.Provider>
                                                                                                            </PlattersContext.Provider>
                                                                                                        </OrderTemplatesContext.Provider>
                                                                                                    </OrdersContext.Provider>
                                                                                                </RestaurantsContext.Provider>
                                                                                            </RecipesContext.Provider>
                                                                                        </RawMaterialsContext.Provider>
                                                                                    </UnitsContext.Provider>
                                                                                </ItemAccompanimentsContext.Provider>
                                                                            </ServiceArticlesContext.Provider>
                                                                        </ReferralSourcesContext.Provider>
                                                                    </PaymentModesContext.Provider>
                                                                </ExpenseTypesContext.Provider>
                                                            </ChargeTypesContext.Provider>
                                                        </EventTypesContext.Provider>
                                                    </LocationsContext.Provider>
                                                </LiveCounterItemsContext.Provider>
                                            </LiveCountersContext.Provider>
                                        </TemplatesContext.Provider>
                                    </CatalogsContext.Provider>
                                </ItemsContext.Provider>
                            </AppCategoriesContext.Provider>
                        </EventsContext.Provider>
                    </ClientsContext.Provider>
                </RolesContext.Provider>
            </UsersContext.Provider>
        </AuditLogsContext.Provider>
    );
};


function App() {
    const { currentUser, logout } = useAuth();
    const permissions = useUserPermissions();

    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [page, setPage] = useState<'dashboard' | 'clients' | 'itemBank' | 'catalogs' | 'templates' | 'liveCounters' | 'reports' | 'users' | 'audit' | 'dataHub' | 'settings'>('dashboard');
    const [clientId, setClientId] = useState<string | null>(null);
    const [eventIdToOpen, setEventIdToOpen] = useState<string | null>(null);
    const [eventToEditId, setEventToEditId] = useState<string | null>(null);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [isMyTasksModalOpen, setIsMyTasksModalOpen] = useState(false);
    
    const { events } = useEvents();
    const { clients } = useClients();
    
    const [clientListFilters, setClientListFilters] = useState({
        name: '',
        phone: '',
        status: 'active' as 'active' | 'inactive' | 'all',
        eventState: 'all' as 'all' | 'lead' | 'confirmed' | 'lost',
        tasks: 'all' as 'all' | 'overdue',
        startDate: '',
        endDate: '',
        creationStartDate: '',
        creationEndDate: '',
    });

    useEffect(() => {
        // When an admin user logs in or the page loads, default them to the Data Hub.
        // This is a temporary measure to avoid a crash on the dashboard caused by a data issue.
        if (currentUser?.role === 'admin') {
            setPage('dataHub');
        }
    }, [currentUser]);

    const checkVersion = async () => {
        try {
            const response = await fetch('/metadata.json');
            const metadata = await response.json();
            const currentVersion = "1.0.0"; // This should come from your build process
            if (metadata.version && metadata.version !== currentVersion) {
                // Show update notification
                const notification = document.createElement('div');
                notification.innerHTML = `A new version is available! <a href="#" onclick="window.location.reload()">Refresh</a>`;
                notification.className = 'fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg';
                document.body.appendChild(notification);
            }
        } catch (error) {
            console.error('Failed to check for new version:', error);
        }
    };

    useEffect(() => {
        const intervalId = setInterval(checkVersion, 15 * 60 * 1000); // every 15 minutes
        return () => clearInterval(intervalId);
    }, []);

    const managedEvents = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'admin') return events;
        if (currentUser.role === 'staff' && currentUser.managedLocationIds && currentUser.managedLocationIds.length > 0) {
            return events.filter(e => currentUser.managedLocationIds!.includes(e.location));
        }
        return events; // Default for staff with no location restrictions
    }, [currentUser, events]);


    const navigate = (page: 'dashboard' | 'clients', clientId?: string, eventId?: string, action?: 'editEvent' | 'viewMenu') => {
        setClientId(clientId || null);
        setPage(page);
        setEventIdToOpen(action === 'viewMenu' ? eventId || null : null);
        setEventToEditId(action === 'editEvent' ? eventId || null : null);
    };

    if (!currentUser) {
        return <LoginPage />;
    }

    if (currentUser.role === 'regular') {
        return <ClientDetailsPage clientId={currentUser.assignedClientId!} onBack={() => logout()} />;
    }
    
    if(currentUser.role === 'kitchen') {
        return <KitchenDashboardPage />;
    }

    const NavLink = ({ icon: Icon, label, pageName }: { icon: React.ElementType, label: string, pageName: any }) => (
        <button
            onClick={() => { setPage(pageName); setClientId(null); setSidebarOpen(false); }}
            className={`flex items-center w-full px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${page === pageName && !clientId ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300' : 'hover:bg-warm-gray-100 dark:hover:bg-warm-gray-800'}`}
        >
            <Icon size={20} className="mr-3" />
            {label}
        </button>
    );

    const sidebarContent = (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-warm-gray-200 dark:border-warm-gray-700 flex justify-between items-center">
                <div className="leading-none text-center">
                    <span className="font-display font-bold text-2xl text-accent-500 tracking-normal">kumkuma</span>
                    <span className="block font-body text-[0.6rem] text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.2em] uppercase">CATERERS</span>
                </div>
                 <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1">
                    <X size={24}/>
                </button>
            </div>
            <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
                {permissions?.dashboard !== 'none' && <NavLink icon={LayoutGrid} label="Dashboard" pageName="dashboard" />}
                {permissions?.clientsAndEvents !== 'none' && <NavLink icon={Building} label="Clients" pageName="clients" />}
                {permissions?.itemBank !== 'none' && <NavLink icon={ListTree} label="Item Bank" pageName="itemBank" />}
                {permissions?.catalogs !== 'none' && <NavLink icon={BookCopy} label="Catalogs" pageName="catalogs" />}
                {permissions?.templates !== 'none' && <NavLink icon={FileText} label="Templates" pageName="templates" />}
                {permissions?.liveCounters !== 'none' && <NavLink icon={Salad} label="Live Counters" pageName="liveCounters" />}
                {permissions?.reports !== 'none' && <NavLink icon={AreaChart} label="Reports" pageName="reports" />}
                {permissions?.users !== 'none' && <NavLink icon={UsersIcon} label="Users & Roles" pageName="users" />}
                {currentUser?.role === 'admin' && <NavLink icon={History} label="Audit Logs" pageName="audit" />}
                {currentUser?.role === 'admin' && <NavLink icon={Database} label="Data Hub" pageName="dataHub" />}
                {permissions?.settings !== 'none' && <NavLink icon={Wrench} label="Settings" pageName="settings" />}
            </nav>
            <div className="p-4 border-t border-warm-gray-200 dark:border-warm-gray-700 space-y-2">
                <div className="text-sm">Logged in as <strong>{currentUser.username}</strong></div>
                <button onClick={() => setIsMyTasksModalOpen(true)} className="w-full flex items-center gap-2 text-sm font-semibold p-2 rounded-md hover:bg-warm-gray-100 dark:hover:bg-warm-gray-800">
                    <ListChecks size={16}/> My Tasks
                </button>
                <button onClick={() => setIsChangePasswordModalOpen(true)} className="w-full flex items-center gap-2 text-sm font-semibold p-2 rounded-md hover:bg-warm-gray-100 dark:hover:bg-warm-gray-800">
                    <Key size={16}/> Change Password
                </button>
                <button onClick={() => logout()} className="w-full flex items-center gap-2 text-sm font-semibold p-2 rounded-md hover:bg-warm-gray-100 dark:hover:bg-warm-gray-800">
                    <LogOut size={16} /> Logout
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen">
             {isChangePasswordModalOpen && (
                <Modal isOpen={isChangePasswordModalOpen} onClose={() => setIsChangePasswordModalOpen(false)} title="Change Password">
                    <ChangePasswordForm onCancel={() => setIsChangePasswordModalOpen(false)} />
                </Modal>
            )}
            {isMyTasksModalOpen && (
                <MyTasksModal
                    isOpen={isMyTasksModalOpen}
                    onClose={() => setIsMyTasksModalOpen(false)}
                    onNavigateToClient={(clientIdForNav) => {
                        setIsMyTasksModalOpen(false);
                        navigate('clients', clientIdForNav);
                    }}
                />
            )}
            {/* Mobile Sidebar */}
            <div className={`fixed inset-0 z-50 bg-warm-gray-900/50 transition-opacity lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)}></div>
            <div className={`fixed top-0 left-0 h-full w-64 bg-ivory dark:bg-warm-gray-900 shadow-lg transform transition-transform z-50 lg:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {sidebarContent}
            </div>
            
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0 bg-ivory dark:bg-warm-gray-800 border-r border-warm-gray-200 dark:border-warm-gray-700">
                {sidebarContent}
            </aside>
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="flex items-center justify-between p-4 border-b border-warm-gray-200 dark:border-warm-gray-700 flex-shrink-0">
                    <div className="flex items-center">
                        <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4 p-1">
                           <Menu size={24}/>
                        </button>
                         {clientId && (
                            <button onClick={() => { setClientId(null); setPage('clients'); }} className="flex items-center gap-2 font-semibold text-warm-gray-600 hover:text-warm-gray-900 dark:text-warm-gray-300 dark:hover:text-white">
                                <ArrowLeft size={18}/> Back to Client List
                            </button>
                        )}
                    </div>
                     <div className="flex items-center gap-2">
                         
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-8">
                    {clientId ?
                        <ClientDetailsPage
                            clientId={clientId}
                            onBack={() => { setClientId(null); setPage('clients'); }}
                            eventIdToOpen={eventIdToOpen}
                            eventToEditId={eventToEditId}
                        />
                        :
                        <AdminPage
                            activePage={page}
                            onNavigate={navigate}
                            permissions={permissions!}
                            userRole={currentUser.role}
                            managedEvents={managedEvents}
                            clients={clients}
                            clientListFilters={clientListFilters}
                            setClientListFilters={setClientListFilters}
                        />
                    }
                </div>
            </main>
        </div>
    );
}

export default function AppWrapper() {
    return (
        <AuthProvider>
            <AppProviders>
                <App />
            </AppProviders>
        </AuthProvider>
    );
}
