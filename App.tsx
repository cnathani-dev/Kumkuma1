

import React, { useState, createContext, useContext, ReactNode, useMemo, useEffect, useRef, ReactElement } from 'react';
import { Item, MenuTemplate, User, AppCategory, ItemType, Event, Client, LiveCounter, LiveCounterItem, AuditLog, Catalog, FinancialSetting, LocationSetting, Role, AppPermissions, PermissionLevel, EventState, ServiceArticle, ItemAccompaniment, ItemsContextType, ItemAccompanimentsContextType, AppCategoriesContextType, EventsContextType, EventTypeSetting, StateChangeHistoryEntry, RawMaterial, Recipe, RecipeRawMaterial, RawMaterialsContextType, RecipesContextType, RestaurantSetting, RestaurantsContextType, Order, OrdersContextType, OrderTemplate, OrderTemplatesContextType, FinancialSettingContextType, Platter, PlattersContextType, Activity, ClientTask, ActivitiesContextType, ClientTasksContextType, MuhurthamDate, MuhurthamDatesContextType } from './types';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { ClientDetailsPage, MyTasksModal } from './pages/ClientDetailsPage';
import { v4 as uuidv4 } from 'uuid';
import { Settings, LogOut, ArrowLeft, Menu, X, LayoutGrid, Building, ListTree, BookCopy, FileText, Salad, AreaChart, Users as UsersIcon, History, Database, Wrench, Key, ListChecks, ChefHat, ClipboardList, ScrollText, Vegan, BookOpenCheck, Package, Loader2 } from 'lucide-react';
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
    units: ['kg', 'grams', 'litres', 'ml', 'pieces', 'bunch', 'packet', 'portion'],
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
    const addMultipleRawMaterials = async (data: any[]): Promise<number> => {
        const batch = writeBatch(db);
        const collectionRef = collection(db, 'ingredients');
        const existingRawMaterials = new Set(rawMaterials.map(rm => `${rm.name.toLowerCase()}|${rm.unit.toLowerCase()}`));
        let importedCount = 0;

        data.forEach(row => {
            const name = row.name?.trim();
            const unit = row.unit?.trim();
            if (name && unit) {
                const key = `${name.toLowerCase()}|${unit.toLowerCase()}`;
                if (!existingRawMaterials.has(key)) {
                    const newDocRef = doc(collectionRef);
                    batch.set(newDocRef, { name, unit });
                    existingRawMaterials.add(key);
                    importedCount++;
                }
            }
        });
        await batch.commit();
        return importedCount;
    };
    const deleteAllRawMaterials = async () => {
        if (window.confirm(`Are you sure you want to delete all ${rawMaterials.length} raw materials? This action cannot be undone.`)) {
            const batch = writeBatch(db);
            rawMaterials.forEach(rm => {
                batch.delete(doc(db, 'ingredients', rm.id));
            });
            await batch.commit();
        }
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

    const addRecipe = async (recipe: Omit<Recipe, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'recipes'), cleanForFirebase(recipe));
        return docRef.id;
    };
    const updateRecipe = async (recipe: Recipe) => {
        await updateDoc(doc(db, 'recipes', recipe.id), cleanForFirebase(recipe));
    };
    const deleteRecipe = async (id: string) => {
        await deleteDoc(doc(db, 'recipes', id));
    };
    const deleteAllRecipes = async () => {
        if (window.confirm(`Are you sure you want to delete all ${recipes.length} recipes? This action cannot be undone.`)) {
            const batch = writeBatch(db);
            recipes.forEach(recipe => {
                batch.delete(doc(db, 'recipes', recipe.id));
            });
            await batch.commit();
        }
    };
    const addMultipleRecipes = async (data: any[]): Promise<{ successCount: number; failures: { name: string; reason: string }[] }> => {
        const batch = writeBatch(db);
        const recipesCollection = collection(db, 'recipes');
        const rawMaterialsCollection = collection(db, 'ingredients');
        const unitsCollection = collection(db, 'units');
    
        const existingRecipes = [...recipes];
        const existingRawMaterials = [...rawMaterials];
        const existingUnits = [...units];
    
        const recipesToImport = new Map<string, any[]>();
        data.forEach(row => {
            const recipeName = row['recipe']?.trim();
            if (!recipeName) return;
            const recipeNameKey = recipeName.toLowerCase();
            if (!recipesToImport.has(recipeNameKey)) {
                recipesToImport.set(recipeNameKey, []);
            }
            recipesToImport.get(recipeNameKey)!.push(row);
        });
    
        let successCount = 0;
        const failures: { name: string; reason: string }[] = [];
        
        for (const [recipeNameKey, rows] of recipesToImport.entries()) {
            const recipeName = rows[0]['recipe'].trim();
            let hasError = false;
    
            const outputRow = rows.find(r => (r['yield quantity'] || r['output quantity']) && (r['yield unit'] || r['output unit']));
            if (!outputRow) {
                failures.push({ name: recipeName, reason: "No row found with 'Yield Quantity'/'Output Quantity' and 'Yield Unit'/'Output Unit'." });
                continue;
            }
            
            const yieldUnit = String(outputRow['output unit'] || outputRow['yield unit'] || '').trim();

            if (yieldUnit && !existingUnits.some(u => u.name.toLowerCase() === yieldUnit.toLowerCase())) {
                const newUnitData = { name: yieldUnit };
                const newUnitRef = doc(unitsCollection);
                batch.set(newUnitRef, cleanForFirebase(newUnitData));
                existingUnits.push({ id: newUnitRef.id, ...newUnitData });
            }

            const yieldQuantity = Number(outputRow['output quantity'] || outputRow['yield quantity'] || 0);
            const defaultOrderingUnit = String(outputRow['default ordering unit'] || yieldUnit).trim();
            
            if (isNaN(yieldQuantity) || yieldQuantity <= 0 || !yieldUnit) {
                failures.push({ name: recipeName, reason: "Invalid or zero value for 'Yield/Output Quantity' or 'Yield/Output Unit'." });
                continue;
            }
            
            const recipeRawMaterials: RecipeRawMaterial[] = [];
    
            for (const row of rows) {
                const rawMaterialName = row['raw material']?.trim();
                if (!rawMaterialName) continue;
                
                const rawMaterialUnit = row['raw material unit']?.trim();
                
                if (rawMaterialUnit && !existingUnits.some(u => u.name.toLowerCase() === rawMaterialUnit.toLowerCase())) {
                    const newUnitData = { name: rawMaterialUnit };
                    const newUnitRef = doc(unitsCollection);
                    batch.set(newUnitRef, cleanForFirebase(newUnitData));
                    existingUnits.push({ id: newUnitRef.id, ...newUnitData });
                }

                const rawMaterialQty = Number(row['raw material qty']);
    
                if (!rawMaterialUnit || isNaN(rawMaterialQty) || rawMaterialQty <= 0) {
                    failures.push({ name: recipeName, reason: `Invalid data for raw material "${rawMaterialName}". Ensure 'Raw Material Unit' and 'Raw Material Qty' are valid.` });
                    hasError = true;
                    break;
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
    
            if (hasError) continue;
            
            const recipeData: Omit<Recipe, 'id'> = {
                name: recipeName,
                instructions: outputRow['instructions'] || '',
                yieldQuantity,
                yieldUnit,
                rawMaterials: recipeRawMaterials,
                defaultOrderingUnit,
            };
    
            const existingRecipe = existingRecipes.find(r => r.name.toLowerCase() === recipeNameKey);
    
            if (existingRecipe) {
                const recipeRef = doc(db, 'recipes', existingRecipe.id);
                batch.update(recipeRef, cleanForFirebase(recipeData));
            } else {
                const newRecipeRef = doc(recipesCollection);
                batch.set(newRecipeRef, cleanForFirebase(recipeData));
            }
            
            successCount++;
        }
    
        await batch.commit();
        return { successCount, failures };
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

    const addOrder = async (order: Omit<Order, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'orders'), cleanForFirebase(order));
        return docRef.id;
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
    const batchUpdateItemType = async (itemIds: string[], newType: ItemType) => {
        const batch = writeBatch(db);
        itemIds.forEach(id => {
            batch.update(doc(db, 'items', id), { type: newType });
        });
        await batch.commit();
    };
    const batchUpdateItemNames = async (updates: { id: string; newName: string }[]) => {
        const batch = writeBatch(db);
        updates.forEach(update => {
            batch.update(doc(db, 'items', update.id), { name: update.newName });
        });
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
    
        // 1. Update Raw Materials (ingredients collection)
        rawMaterials.forEach(rm => {
            if (sourceUnitNames.includes(rm.unit)) {
                batch.update(doc(db, 'ingredients', rm.id), { unit: destinationUnit.name });
            }
        });

        // 2. Update Recipes
        recipes.forEach(recipe => {
            const updatePayload: any = {};
            let needsUpdate = false;
            if (recipe.yieldUnit && sourceUnitNames.includes(recipe.yieldUnit)) {
                updatePayload.yieldUnit = destinationUnit.name;
                needsUpdate = true;
            }
            if (recipe.defaultOrderingUnit && sourceUnitNames.includes(recipe.defaultOrderingUnit)) {
                updatePayload.defaultOrderingUnit = destinationUnit.name;
                needsUpdate = true;
            }
            if (recipe.conversions && recipe.conversions.length > 0) {
                let conversionsChanged = false;
                const newConversions = recipe.conversions.map(conv => {
                    if (sourceUnitNames.includes(conv.unit)) {
                        conversionsChanged = true;
                        return { ...conv, unit: destinationUnit.name };
                    }
                    return conv;
                });
                if(conversionsChanged) {
                    updatePayload.conversions = newConversions;
                    needsUpdate = true;
                }
            }
            if (needsUpdate) {
                batch.update(doc(db, 'recipes', recipe.id), updatePayload);
            }
        });

        // 3. Update Categories (Cooking Estimates)
        categories.forEach(category => {
            const updatePayload: any = {};
            let needsUpdate = false;
            if (category.quantityUnit && sourceUnitNames.includes(category.quantityUnit)) {
                updatePayload.quantityUnit = destinationUnit.name;
                needsUpdate = true;
            }
            if (category.quantityUnit_nonVeg && sourceUnitNames.includes(category.quantityUnit_nonVeg)) {
                updatePayload.quantityUnit_nonVeg = destinationUnit.name;
                needsUpdate = true;
            }
            if (needsUpdate) {
                batch.update(doc(db, 'categories', category.id), updatePayload);
            }
        });

        // 4. Update Item Accompaniments
        itemAccompaniments.forEach(acc => {
            if (acc.quantityUnit && sourceUnitNames.includes(acc.quantityUnit)) {
                batch.update(doc(db, 'itemAccompaniments', acc.id), { quantityUnit: destinationUnit.name });
            }
        });

        // 5. Delete source units
        sourceIds.forEach(id => {
            batch.delete(doc(db, 'units', id));
        });
    
        await batch.commit();
    };

    // --- CONTEXT VALUES ---
    const rawMaterialsContextValue: RawMaterialsContextType = { rawMaterials, addRawMaterial, updateRawMaterial, deleteRawMaterial, mergeRawMaterials, addMultipleRawMaterials, deleteAllRawMaterials };
    const recipesContextValue: RecipesContextType = { recipes, addRecipe, updateRecipe, deleteRecipe, addMultipleRecipes, deleteAllRecipes };
    const restaurantsContextValue: RestaurantsContextType = { restaurants, addRestaurant, updateRestaurant, deleteRestaurant };
    const ordersContextValue: OrdersContextType = { orders, addOrder, updateOrder, deleteOrder };
    const orderTemplatesContextValue: OrderTemplatesContextType = { orderTemplates, addOrderTemplate, updateOrderTemplate, deleteOrderTemplate };
    const plattersContextValue: PlattersContextType = { platters, addPlatter, updatePlatter, deletePlatter };
    const eventsContextValue: EventsContextType = { events, addEvent, updateEvent, deleteEvent, deleteAllEvents, duplicateEvent, importClientsAndEvents };
    const clientsContextValue = { clients, addClient, updateClient, deleteClient, deleteAllClients, addSampleData, deleteSampleData };
    const usersContextValue = { users, addUser, updateUser, deleteUser };
    const rolesContextValue = { roles, addRole, updateRole, deleteRole };
    const categoriesContextValue = { categories, addCategory, updateCategory, deleteCategory, updateMultipleCategories, mergeCategory, addMultipleCategories: (d:any) => Promise.resolve(0), deleteAllCategories: () => Promise.resolve() };
    const itemsContextValue: ItemsContextType = { items, addItem, updateItem, deleteItem, deleteMultipleItems, moveMultipleItems, updateMultipleItems, batchUpdateServiceArticles, batchUpdateAccompaniments, addMultipleItems: (d:any) => Promise.resolve(0), deleteAllItems: () => Promise.resolve(), batchUpdateItemType, batchUpdateItemNames };
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
    const { currentUser, logout, isInitializing } = useAuth();
    const permissions = useUserPermissions();

    const [isSidebarOpen, setSidebarOpen] = useState(false);
    type PageName = 'dashboard' | 'clients' | 'itemBank' | 'catalogs' | 'templates' | 'liveCounters' | 'reports' | 'users' | 'audit' | 'dataHub' | 'settings' | 'orders' | 'orderTemplates' | 'platters' | 'recipes' | 'rawMaterials';
    const [page, setPage] = useState<PageName>('dashboard');
    const [clientId, setClientId] = useState<string | null>(null);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
    const [isMyTasksModalOpen, setIsMyTasksModalOpen] = useState(false);
    
    const { events } = useEvents();
    const { clients } = useClients();
    
    const [clientListFilters, setClientListFilters] = useState({
        name: '',
        phone: '',
        status: 'active' as 'active' | 'inactive' | 'all',
        eventState: 'all' as 'all' | 'lead' | 'confirmed' | 'lost' | 'cancelled',
        tasks: 'all' as 'all' | 'overdue',
        startDate: '',
        endDate: '',
        creationStartDate: '',
        creationEndDate: '',
        referredBy: '',
    });

    const handleNavigation = (pageName: PageName, newClientId?: string) => {
        setPage(pageName);
        setClientId(newClientId || null);
    };
    
    const navigateToClient = (page: 'dashboard' | 'clients', clientId?: string, eventId?: string, action?: 'editEvent' | 'viewMenu') => {
        // This function now primarily handles setting the state for the ClientDetailsPage to consume
        // It sets the client ID and lets the main renderer switch to that view.
        setClientId(clientId || null);
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
        if (currentUser.role === 'admin' || currentUser.role === 'kitchen') return events;
        if (currentUser.role === 'staff' && currentUser.managedLocationIds && currentUser.managedLocationIds.length > 0) {
            return events.filter(e => currentUser.managedLocationIds!.includes(e.location));
        }
        return events; // Default for staff with no location restrictions
    }, [currentUser, events]);

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

    const NavItem = ({ icon: Icon, label, pageName, activePage, onNavigate, permission }: { icon: React.ElementType, label: string, pageName: PageName, activePage: PageName, onNavigate: (p:PageName)=>void, permission: PermissionLevel }) => {
        if (permission === 'none') return null;
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
                <NavItem icon={LayoutGrid} label="Dashboard" pageName="dashboard" activePage={page} onNavigate={p => handleNavigation(p)} permission={permissions!.dashboard} />
                <NavItem icon={Building} label="Clients & Events" pageName="clients" activePage={page} onNavigate={p => handleNavigation(p)} permission={permissions!.clientsAndEvents} />
                <h4 className="text-xs font-bold uppercase text-warm-gray-400 pt-4 pb-1 px-3">Food & Menu</h4>
                <NavItem icon={ListTree} label="Item Bank" pageName="itemBank" activePage={page} onNavigate={p => handleNavigation(p)} permission={permissions!.itemBank} />
                <NavItem icon={BookCopy} label="Catalogs" pageName="catalogs" activePage={page} onNavigate={p => handleNavigation(p)} permission={permissions!.catalogs} />
                <NavItem icon={FileText} label="Templates" pageName="templates" activePage={page} onNavigate={p => handleNavigation(p)} permission={permissions!.templates} />
                <NavItem icon={Salad} label="Live Counters" pageName="liveCounters" activePage={page} onNavigate={p => handleNavigation(p)} permission={permissions!.liveCounters} />
                 <h4 className="text-xs font-bold uppercase text-warm-gray-400 pt-4 pb-1 px-3">Management</h4>
                 <NavItem icon={AreaChart} label="Reports" pageName="reports" activePage={page} onNavigate={p => handleNavigation(p)} permission={permissions!.reports} />
                {currentUser.role === 'admin' && <>
                    <h4 className="text-xs font-bold uppercase text-warm-gray-400 pt-4 pb-1 px-3">Administration</h4>
                    <NavItem icon={UsersIcon} label="Users & Roles" pageName="users" activePage={page} onNavigate={p => handleNavigation(p)} permission={permissions!.users} />
                    <NavItem icon={History} label="Audit Logs" pageName="audit" activePage={page} onNavigate={p => handleNavigation(p)} permission={'modify'} />
                    <NavItem icon={Database} label="Data Hub" pageName="dataHub" activePage={page} onNavigate={p => handleNavigation(p)} permission={'modify'} />
                </>}
                 <NavItem icon={Wrench} label="Settings" pageName="settings" activePage={page} onNavigate={p => handleNavigation(p)} permission={permissions!.settings} />
            </ul>
        </nav>
    );

    return (
        <div>
            {isChangePasswordModalOpen && <Modal isOpen={true} onClose={() => setIsChangePasswordModalOpen(false)} title="Change Password"><ChangePasswordForm onCancel={() => setIsChangePasswordModalOpen(false)} /></Modal>}
            {isMyTasksModalOpen && <MyTasksModal isOpen={true} onClose={() => setIsMyTasksModalOpen(false)} onNavigateToClient={(clientId) => {setIsMyTasksModalOpen(false); handleNavigation('clients', clientId); }} />}
            <div className="flex h-screen">
                 {/* Sidebar */}
                <aside className={`fixed z-40 inset-y-0 left-0 w-64 bg-white dark:bg-warm-gray-900 border-r border-warm-gray-200 dark:border-warm-gray-800 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out`}>
                    <div className="flex items-center justify-between p-4 border-b border-warm-gray-200 dark:border-warm-gray-800">
                         <div className="leading-none py-1">
                            <span className="font-display font-bold text-2xl text-accent-500 tracking-wide">kumkuma</span>
                            <span className="block font-body font-normal text-xs text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.2em] uppercase">CATERERS</span>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="md:hidden">
                            <X size={24} />
                        </button>
                    </div>
                    <div className="p-4 flex-grow overflow-y-auto">
                        {sidebarContent}
                    </div>
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
                                onBack={() => { handleNavigation('clients'); }} 
                            /> 
                            : <AdminPage 
                                activePage={page} 
                                onNavigate={navigateToClient}
                                permissions={permissions!}
                                userRole={currentUser.role}
                                managedEvents={managedEvents}
                                clients={clients}
                                clientListFilters={clientListFilters}
                                setClientListFilters={setClientListFilters}
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