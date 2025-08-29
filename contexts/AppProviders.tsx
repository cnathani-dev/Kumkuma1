import React, { useState, createContext, useContext, ReactNode, useMemo, useEffect, useRef, ReactElement } from 'react';
import { Item, MenuTemplate, User, AppCategory, ItemType, Event, Client, LiveCounter, LiveCounterItem, AuditLog, Catalog, FinancialSetting, LocationSetting, Role, AppPermissions, PermissionLevel, EventState, ServiceArticle, ItemAccompaniment, ItemsContextType, ItemAccompanimentsContextType, AppCategoriesContextType, EventsContextType, EventTypeSetting, StateChangeHistoryEntry, RawMaterial, Recipe, RecipeRawMaterial, RawMaterialsContextType, RecipesContextType, RestaurantSetting, RestaurantsContextType, Order, OrdersContextType, OrderTemplate, OrderTemplatesContextType, FinancialSettingContextType, Platter, PlattersContextType, ClientActivity, ClientTask, ClientActivitiesContextType, ClientTasksContextType, MuhurthamDate, MuhurthamDatesContextType, CatalogsContextType, ServiceArticlesContextType, Transaction, Charge, CompetitionSetting, LostReasonSetting, LostReasonSettingsContextType, ClientActivityTypeSetting, ClientActivityTypeSettingsContextType, GeneralSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../firebase';
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
import { cleanForFirebase, dateToYYYYMMDD, formatYYYYMMDD, yyyyMMDDToDate } from '../lib/utils';
import { AuthProvider, useAuth, useUserPermissions } from './AuthContext';
import { logAuditEvent } from '../lib/audit';
import {
    RolesContext, AuditLogsContext, CatalogsContext, LiveCountersContext,
    LiveCounterItemsContext, ClientsContext, EventsContext, ItemsContext,
    AppCategoriesContext, TemplatesContext, UsersContext, ChargeTypesContext,
    ExpenseTypesContext, PaymentModesContext, ReferralSourcesContext, ServiceArticlesContext,
    ItemAccompanimentsContext, UnitsContext, EventTypesContext, LocationsContext,
    RawMaterialsContext, RecipesContext, useEvents, useClients, RestaurantsContext, OrdersContext, OrderTemplatesContext, PlattersContext, ClientActivitiesContext, ClientTasksContext,
    MuhurthamDatesContext,
    CompetitionSettingsContext,
    LostReasonSettingsContext,
    ClientActivityTypeSettingsContext,
    GeneralSettingsContext
} from './AppContexts';


// --- MOCK DATA ---
const INITIAL_CATEGORIES_FIRESTORE: (Omit<AppCategory, 'id' | 'parentId'> & { children?: Omit<AppCategory, 'id' | 'parentId'>[] })[] = [
    // ... (This can be kept as it is for initial seeding)
];

const INITIAL_FINANCIAL_SETTINGS = {
    chargeTypes: ['Transportation', 'Additional Staff', 'Breakage', 'Special Request', 'Additional PAX'],
    expenseTypes: ['Groceries', 'Staff Payment', 'Rent', 'Utilities'],
    paymentModes: ['Cash', 'UPI', 'Bank Transfer', 'Credit Card'],
    referralSources: ['Google', 'Word of Mouth', 'Existing Client', 'Vendor', 'Walk-In', 'Phone Enquiry'],
    units: ['kg', 'grams', 'litres', 'ml', 'pieces', 'bunch', 'packet', 'portion'],
    eventTypes: ['Wedding', 'Birthday Party', 'Corporate Event', 'Private Gathering'],
    serviceArticles: ['Chafing Dish', 'Serving Spoon', 'Water Dispenser', 'Salad Bowl'],
};

const INITIAL_ACTIVITY_TYPES = [
    { name: 'Phone Call', icon: 'Phone' },
    { name: 'Meeting', icon: 'Users' },
    { name: 'Site Visit', icon: 'MapPin' },
    { name: 'Follow-up', icon: 'ClipboardCheck' },
    { name: 'Quote Sent', icon: 'Mail' },
    { name: 'General Note', icon: 'StickyNote' },
];

// --- DATA PROVIDERS ---
export const AppProviders = ({ children }: { children: ReactNode }) => {
    // This component will now contain ALL data-related state and logic.
    const { currentUser } = useAuth();

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
    const [clientActivities, setClientActivities] = useState<ClientActivity[]>([]);
    const [clientTasks, setClientTasks] = useState<ClientTask[]>([]);
    const [muhurthamDates, setMuhurthamDates] = useState<MuhurthamDate[]>([]);
    const [competitionSettings, setCompetitionSettings] = useState<CompetitionSetting[]>([]);
    const [lostReasonSettings, setLostReasonSettings] = useState<LostReasonSetting[]>([]);
    const [clientActivityTypes, setClientActivityTypes] = useState<ClientActivityTypeSetting[]>([]);
    const [generalSettings, setGeneralSettings] = useState<GeneralSettings | null>(null);


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
            clientActivities: setClientActivities,
            clientTasks: setClientTasks,
            muhurthamDates: setMuhurthamDates,
            competition: setCompetitionSettings,
            lostReasons: setLostReasonSettings,
            clientActivityTypes: setClientActivityTypes,
        };

        const unsubs = Object.entries(collectionsToWatch).map(([name, setter]) => {
            return onSnapshot(collection(db, name), (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setter(data as any);
            });
        });

        // Seed initial financial settings, only if they haven't been seeded before.
        Object.entries(INITIAL_FINANCIAL_SETTINGS).forEach(async ([collectionName, defaultNames]) => {
            const seededFlag = `seeded_${collectionName}`;
            if (localStorage.getItem(seededFlag)) {
                return;
            }

            const collRef = collection(db, collectionName);
            const snapshot = await getDocs(collRef);
            if (snapshot.empty) {
                console.log(`Seeding initial data for ${collectionName}...`);
                const batch = writeBatch(db);
                defaultNames.forEach(name => {
                    const docRef = doc(collRef);
                    batch.set(docRef, { name });
                });
                await batch.commit();
            }
            localStorage.setItem(seededFlag, 'true');
        });

        const seedActivityTypes = async () => {
            const seededFlag = `seeded_clientActivityTypes`;
             if (localStorage.getItem(seededFlag)) {
                return;
            }
            const activityTypesRef = collection(db, 'clientActivityTypes');
            const activitySnapshot = await getDocs(activityTypesRef);
            if (activitySnapshot.empty) {
                console.log(`Seeding initial data for clientActivityTypes...`);
                const batch = writeBatch(db);
                INITIAL_ACTIVITY_TYPES.forEach(type => {
                    const docRef = doc(activityTypesRef);
                    batch.set(docRef, type);
                });
                await batch.commit();
            }
            localStorage.setItem(seededFlag, 'true');
        };
        seedActivityTypes();

        const settingsRef = doc(db, 'generalSettings', 'main');
        const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setGeneralSettings({ id: docSnap.id, ...docSnap.data() } as GeneralSettings);
            } else {
                console.log("No general settings document found, creating with defaults.");
                const defaultSettings: Omit<GeneralSettings, 'id'> = {
                    kitchenDashboardEventHorizon: 7, // Default value
                };
                setDoc(settingsRef, defaultSettings).catch(error => console.error("Error creating default settings:", error));
            }
        });
        unsubs.push(unsubSettings);


        return () => unsubs.forEach(unsub => unsub());
    }, []);
    
    // --- Centralized Data Filtering for Role-Based Access ---
    const managedEvents = useMemo(() => {
        if (!currentUser) return [];

        if (currentUser.role === 'kitchen') {
            const horizonDays = generalSettings?.kitchenDashboardEventHorizon ?? 7;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const horizonEndDate = new Date(today);
            horizonEndDate.setDate(today.getDate() + horizonDays - 1);

            return events.filter(event => {
                if (event.state !== 'confirmed') return false;
                
                const eventStartDate = yyyyMMDDToDate(event.startDate);
                const eventEndDate = event.endDate ? yyyyMMDDToDate(event.endDate) : eventStartDate;

                // The event must be confirmed AND
                // it must not have already ended (end date is today or later) AND
                // it must start within the horizon.
                return eventEndDate >= today && eventStartDate <= horizonEndDate;
            });
        }
        
        if (currentUser.role === 'admin' || !currentUser.managedLocationIds || currentUser.managedLocationIds.length === 0) {
            return events;
        }

        const locationIdToNameMap = new Map(locations.map(l => [l.id, l.name]));
        const managedLocationNames = (currentUser.managedLocationIds || []).map(id => locationIdToNameMap.get(id)).filter(Boolean) as string[];

        return events.filter(e => managedLocationNames.includes(e.location));
    }, [currentUser, events, locations, generalSettings]);

    const managedClients = useMemo(() => {
        if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'kitchen' || !currentUser.managedLocationIds || currentUser.managedLocationIds.length === 0) {
            return clients;
        }
        const visibleClientIds = new Set(managedEvents.map(e => e.clientId));
        return clients.filter(c => visibleClientIds.has(c.id));
    }, [currentUser, clients, managedEvents]);

    const managedTemplates = useMemo(() => {
        if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'kitchen' || !currentUser.managedLocationIds || currentUser.managedLocationIds.length === 0) {
            return templates;
        }
        const userLocationIds = new Set(currentUser.managedLocationIds);
        return templates.filter(t => 
            !t.locationIds || t.locationIds.length === 0 || t.locationIds.some(locId => userLocationIds.has(locId))
        );
    }, [currentUser, templates]);

    // --- Category Type Inheritance Logic ---
    const categoriesWithInheritance = useMemo(() => {
        if (!categories.length) return [];

        const categoryMap = new Map(categories.map(c => [c.id, { ...c }]));
        const effectiveTypeMap = new Map<string, 'veg' | 'non-veg' | null>();

        function determineType(categoryId: string): 'veg' | 'non-veg' | null {
            // Check memoized results first
            if (effectiveTypeMap.has(categoryId)) {
                return effectiveTypeMap.get(categoryId)!;
            }

            const category = categoryMap.get(categoryId);
            if (!category) {
                return null;
            }

            // If it has a parent, recursively find the parent's effective type.
            if (category.parentId) {
                const parentType = determineType(category.parentId);
                // If parent has a type, child inherits it.
                if (parentType) {
                    effectiveTypeMap.set(categoryId, parentType);
                    return parentType;
                }
            }
            
            // If no parent with a type, use its own type.
            const ownType = category.type || null;
            effectiveTypeMap.set(categoryId, ownType);
            return ownType;
        }

        // Populate the map for all categories
        for (const category of categories) {
            determineType(category.id);
        }

        // Create the new array with inherited types
        return categories.map(c => {
            const effectiveType = effectiveTypeMap.get(c.id);
            // Return a new object only if the type changes to avoid unnecessary re-renders
            if (effectiveType !== undefined && c.type !== effectiveType) {
                return { ...c, type: effectiveType };
            }
            return c;
        });

    }, [categories]);

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
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            const userData = userDoc.data() as User; // We assume it's a User object
            if (userData.role === 'regular' && userData.assignedClientId) {
                try {
                    const clientRef = doc(db, 'clients', userData.assignedClientId);
                    const clientDoc = await getDoc(clientRef);
                    if (clientDoc.exists()) {
                        await updateDoc(clientRef, { hasSystemAccess: false });
                    }
                } catch (error) {
                    console.error(`Failed to update client ${userData.assignedClientId} while deleting user ${userId}:`, error);
                }
            }
        }
        await deleteDoc(userRef);
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

    const createGenericMergeSettings = (
        collectionName: string,
        targetCollectionName: string,
        targetFieldMapper: (docData: any, sourceNames: string[], destName: string) => any | null,
        settings: (FinancialSetting | EventTypeSetting | ServiceArticle)[]
    ) => {
        return async (sourceIds: string[], destId: string) => {
            const batch = writeBatch(db);

            const destSetting = settings.find(s => s.id === destId);
            if (!destSetting) throw new Error("Destination setting not found.");

            const sourceSettings = settings.filter(s => sourceIds.includes(s.id));
            if (sourceSettings.length === 0) return;
            const sourceNames = sourceSettings.map(s => s.name);

            const targetCollectionRef = collection(db, targetCollectionName);
            const targetDocsSnapshot = await getDocs(targetCollectionRef);

            targetDocsSnapshot.forEach(docSnapshot => {
                const docData = docSnapshot.data();
                const updatedData = targetFieldMapper(docData, sourceNames, destSetting.name);
                if (updatedData) {
                    batch.update(docSnapshot.ref, updatedData);
                }
            });

            sourceIds.forEach(id => {
                if(id !== destId) {
                    batch.delete(doc(db, collectionName, id));
                }
            });

            await batch.commit();
        };
    };

    const mergeChargeTypes = createGenericMergeSettings('chargeTypes', 'events', (eventData, sourceNames, destName) => {
        if (!eventData.charges || eventData.charges.length === 0) return null;
        let wasModified = false;
        const newCharges = eventData.charges.map((c: Charge) => {
            if (c.type && sourceNames.includes(c.type)) {
                wasModified = true;
                return { ...c, type: destName };
            }
            return c;
        });
        return wasModified ? { charges: newCharges } : null;
    }, chargeTypes);

    const mergePaymentModes = createGenericMergeSettings('paymentModes', 'events', (eventData, sourceNames, destName) => {
        if (!eventData.transactions || eventData.transactions.length === 0) return null;
        let wasModified = false;
        const newTransactions = eventData.transactions.map((t: Transaction) => {
            if (t.paymentMode && sourceNames.includes(t.paymentMode)) {
                wasModified = true;
                return { ...t, paymentMode: destName };
            }
            return t;
        });
        return wasModified ? { transactions: newTransactions } : null;
    }, paymentModes);

    const mergeEventTypes = createGenericMergeSettings('eventTypes', 'events', (eventData, sourceNames, destName) => {
        if (eventData.eventType && sourceNames.includes(eventData.eventType)) {
            return { eventType: destName };
        }
        return null;
    }, eventTypes);

    const mergeReferralSources = createGenericMergeSettings('referralSources', 'clients', (clientData, sourceNames, destName) => {
        if (clientData.referredBy && sourceNames.includes(clientData.referredBy)) {
            return { referredBy: destName };
        }
        return null;
    }, referralSources);

    const mergeExpenseTypes = createGenericMergeSettings('expenseTypes', 'events', (eventData, sourceNames, destName) => {
        if (!eventData.transactions || eventData.transactions.length === 0) return null;
        let wasModified = false;
        const newTransactions = eventData.transactions.map((t: Transaction) => {
            if (t.type === 'expense' && t.category && sourceNames.includes(t.category)) {
                wasModified = true;
                return { ...t, category: destName };
            }
            return t;
        });
        return wasModified ? { transactions: newTransactions } : null;
    }, expenseTypes);

    const mergeServiceArticles = async (sourceIds: string[], destId: string) => {
        const batch = writeBatch(db);
        const itemsToUpdateQuery = query(collection(db, 'items'), where('serviceArticleIds', 'array-contains-any', sourceIds));
        const itemsSnapshot = await getDocs(itemsToUpdateQuery);
        
        itemsSnapshot.forEach(itemDoc => {
            const itemData = itemDoc.data() as Item;
            const existingIds = new Set(itemData.serviceArticleIds || []);
            let needsUpdate = false;
            sourceIds.forEach(sourceId => {
                if (existingIds.has(sourceId)) {
                    existingIds.delete(sourceId);
                    needsUpdate = true;
                }
            });
            if (needsUpdate) {
                existingIds.add(destId);
                batch.update(itemDoc.ref, { serviceArticleIds: Array.from(existingIds) });
            }
        });

        sourceIds.forEach(id => {
            if (id !== destId) {
                batch.delete(doc(db, 'serviceArticles', id));
            }
        });
        await batch.commit();
    };

    const mergeClientActivityTypes = async (sourceIds: string[], destId: string) => {
        if (!currentUser) throw new Error("User not authenticated for merge operation.");
        const batch = writeBatch(db);

        const destSetting = clientActivityTypes.find(s => s.id === destId);
        if (!destSetting) throw new Error("Destination activity type not found.");

        const activitiesToUpdateQuery = query(collection(db, 'clientActivities'), where('typeId', 'in', sourceIds));
        const activitiesSnapshot = await getDocs(activitiesToUpdateQuery);

        activitiesSnapshot.forEach(activityDoc => {
            batch.update(activityDoc.ref, {
                typeId: destId,
                typeName: destSetting.name
            });
        });

        sourceIds.forEach(id => {
            if (id !== destId) {
                batch.delete(doc(db, 'clientActivityTypes', id));
            }
        });

        await batch.commit();
        await logAuditEvent({
            userId: currentUser.id,
            username: currentUser.username,
            action: 'MERGE_CLIENT_ACTIVITY_TYPES',
            details: `Merged ${sourceIds.length} types into "${destSetting.name}".`,
        });
    };

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
    const updateOrderTemplateGroup = async (oldGroup: string, newGroup: string) => {
        const batch = writeBatch(db);
        const templatesToUpdate = orderTemplates.filter(t => t.group === oldGroup);
        templatesToUpdate.forEach(t => {
            const docRef = doc(db, 'orderTemplates', t.id);
            batch.update(docRef, { group: newGroup });
        });
        await batch.commit();
    };
    const updateTemplateGroup = async (oldGroup: string, newGroup: string) => {
        const batch = writeBatch(db);
        const templatesToUpdate = templates.filter(t => t.group === oldGroup);
        templatesToUpdate.forEach(t => {
            const docRef = doc(db, 'templates', t.id);
            batch.update(docRef, { group: newGroup });
        });
        await batch.commit();
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

    const addActivity = async (activity: Omit<ClientActivity, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'clientActivities'), cleanForFirebase(activity));
        return docRef.id;
    };
    const deleteActivity = async (id: string) => {
        await deleteDoc(doc(db, 'clientActivities', id));
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

    const addLostReasonSetting = async (setting: Omit<LostReasonSetting, 'id'>) => {
        if (setting.isCompetitionReason) {
            const competitionReasons = lostReasonSettings.filter(s => s.isCompetitionReason);
            if (competitionReasons.length > 0) {
                const batch = writeBatch(db);
                competitionReasons.forEach(cr => {
                    const docRef = doc(db, 'lostReasons', cr.id);
                    batch.update(docRef, { isCompetitionReason: false });
                });
                await batch.commit();
            }
        }
        await addDoc(collection(db, 'lostReasons'), cleanForFirebase(setting));
    };
    const updateLostReasonSetting = async (setting: LostReasonSetting) => {
        if (setting.isCompetitionReason) {
            const competitionReasons = lostReasonSettings.filter(s => s.isCompetitionReason && s.id !== setting.id);
            if (competitionReasons.length > 0) {
                const batch = writeBatch(db);
                competitionReasons.forEach(cr => {
                    const docRef = doc(db, 'lostReasons', cr.id);
                    batch.update(docRef, { isCompetitionReason: false });
                });
                await batch.commit();
            }
        }
        await updateDoc(doc(db, 'lostReasons', setting.id), cleanForFirebase(setting));
    };
    const deleteLostReasonSetting = async (id: string) => { await deleteDoc(doc(db, 'lostReasons', id)); };

    const { addEvent, updateEvent, deleteEvent, deleteAllEvents, duplicateEvent, importClientsAndEvents } = useMemo(() => {
        const addEvent = async (event: Omit<Event, 'id'>): Promise<string> => {
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
        const duplicateEvent = async (event: Event) => {
            const { 
                id, 
                state, 
                stateHistory, 
                createdAt, 
                history, 
                charges, 
                transactions, 
                // Destructure menu items to exclude them
                itemIds,
                liveCounters,
                cocktailMenuItems,
                hiTeaMenuItems,
                ...restOfEvent 
            } = event;
    
            const newEventData: Omit<Event, 'id'> = {
                ...restOfEvent,
                state: 'lead',
                status: 'draft',
                createdAt: new Date().toISOString(),
                stateHistory: [],
                history: [],
                charges: [],
                transactions: [],
                // Explicitly clear all menu selections
                itemIds: {},
                liveCounters: {},
                cocktailMenuItems: {},
                hiTeaMenuItems: {},
            };
            
            // Re-populate with standard accompaniments if a template is chosen
            if (newEventData.templateId && newEventData.templateId !== 'NO_FOOD') {
                const selectedTemplate = templates.find(t => t.id === newEventData.templateId);
                const selectedCatalog = selectedTemplate ? catalogs.find(c => c.id === selectedTemplate.catalogId) : null;
    
                if (selectedCatalog) {
                    const standardAccompanimentCategories = categoriesWithInheritance.filter(c => c.isStandardAccompaniment);
                    const standardCategoryIds = new Set(standardAccompanimentCategories.map(c => c.id));
                    
                    const newItemIds: Record<string, string[]> = {};
    
                    for (const catId in selectedCatalog.itemIds) {
                        if (standardCategoryIds.has(catId)) {
                            newItemIds[catId] = [...(selectedCatalog.itemIds[catId] || [])];
                        }
                    }
                    newEventData.itemIds = newItemIds;
                }
            }

            await addEvent(newEventData);
        };
        const importClientsAndEvents = async (data: any[]) => { return 0; /* ... */ };
        
        return { addEvent, updateEvent, deleteEvent, deleteAllEvents, duplicateEvent, importClientsAndEvents };
    }, [templates, catalogs, categoriesWithInheritance]);

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

    const addCatalog = async (cat: Omit<Catalog, 'id'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'catalogs'), cleanForFirebase(cat));
        return docRef.id;
    };
    const updateCatalog = async (cat: Catalog) => { await updateDoc(doc(db, 'catalogs', cat.id), cleanForFirebase(cat)); };
    const deleteCatalog = async (id: string) => { await deleteDoc(doc(db, 'catalogs', id)); };
    const updateCatalogGroup = async (oldGroup: string, newGroup: string) => {
        const batch = writeBatch(db);
        const catalogsToUpdate = catalogs.filter(c => c.group === oldGroup);
        catalogsToUpdate.forEach(c => {
            const docRef = doc(db, 'catalogs', c.id);
            batch.update(docRef, { group: newGroup });
        });
        await batch.commit();
    };

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

    const updateGeneralSettings = async (data: Partial<Omit<GeneralSettings, 'id'>>) => {
        const settingsRef = doc(db, 'generalSettings', 'main');
        await updateDoc(settingsRef, cleanForFirebase(data));
    };

    // --- CONTEXT VALUES ---
    const generalSettingsContextValue = {
        settings: generalSettings,
        updateSettings: updateGeneralSettings,
    };
    const rawMaterialsContextValue: RawMaterialsContextType = { rawMaterials, addRawMaterial, updateRawMaterial, deleteRawMaterial, mergeRawMaterials, addMultipleRawMaterials, deleteAllRawMaterials };
    const recipesContextValue: RecipesContextType = { recipes, addRecipe, updateRecipe, deleteRecipe, addMultipleRecipes, deleteAllRecipes };
    const restaurantsContextValue: RestaurantsContextType = { restaurants, addRestaurant, updateRestaurant, deleteRestaurant };
    const ordersContextValue: OrdersContextType = { orders, addOrder, updateOrder, deleteOrder };
    const orderTemplatesContextValue = { orderTemplates, addOrderTemplate, updateOrderTemplate, deleteOrderTemplate, updateTemplateGroup: updateOrderTemplateGroup };
    const plattersContextValue: PlattersContextType = { platters, addPlatter, updatePlatter, deletePlatter };
    const eventsContextValue: EventsContextType = { events: managedEvents, addEvent, updateEvent, deleteEvent, deleteAllEvents, duplicateEvent, importClientsAndEvents };
    const clientsContextValue = { clients: managedClients, addClient, updateClient, deleteClient, deleteAllClients, addSampleData, deleteSampleData };
    const usersContextValue = { users, addUser, updateUser, deleteUser };
    const rolesContextValue = { roles, addRole, updateRole, deleteRole };
    const categoriesContextValue = { categories: categoriesWithInheritance, addCategory, updateCategory, deleteCategory, updateMultipleCategories, mergeCategory, addMultipleCategories: (d:any) => Promise.resolve(0), deleteAllCategories: () => Promise.resolve() };
    const itemsContextValue: ItemsContextType = { items, addItem, updateItem, deleteItem, deleteMultipleItems, moveMultipleItems, updateMultipleItems, batchUpdateServiceArticles, batchUpdateAccompaniments, addMultipleItems: (d:any) => Promise.resolve(0), deleteAllItems: () => Promise.resolve(), batchUpdateItemType, batchUpdateItemNames };
    const catalogsContextValue: CatalogsContextType = { catalogs, addCatalog, updateCatalog, deleteCatalog, deleteAllCatalogs: () => Promise.resolve(), addMultipleCatalogs: (d:any) => Promise.resolve(0), updateCatalogGroup };
    const templatesContextValue = { templates: managedTemplates, addTemplate, updateTemplate, deleteTemplate, deleteAllTemplates: () => Promise.resolve(), updateTemplateGroup };
    const liveCountersContextValue = { liveCounters, addLiveCounter, updateLiveCounter, deleteLiveCounter, updateMultipleLiveCounters, addMultipleLiveCounters: (d:any) => Promise.resolve(new Map()), deleteAllLiveCountersAndItems: () => Promise.resolve() };
    const liveCounterItemsContextValue = { liveCounterItems, addLiveCounterItem, updateLiveCounterItem, deleteLiveCounterItem, updateMultipleLiveCounterItems, addMultipleLiveCounterItems: (d:any) => Promise.resolve() };
    const locationsContextValue = { locations, addLocation, updateLocation, deleteLocation, updateMultipleLocations };
    const itemAccompanimentsContextValue = { settings: itemAccompaniments, addAccompaniment, updateAccompaniment, deleteAccompaniment };
    const unitsContextValue: FinancialSettingContextType = {
        settings: units,
        ...createFinancialSettingHooks('units'),
        mergeSettings: mergeUnits,
    };
    const clientActivitiesContextValue: ClientActivitiesContextType = { activities: clientActivities, addActivity, deleteActivity };
    const clientTasksContextValue: ClientTasksContextType = { tasks: clientTasks, addTask, updateTask, deleteTask };
    const muhurthamDatesContextValue: MuhurthamDatesContextType = { muhurthamDates, addMuhurthamDate, deleteMuhurthamDateByDate, importMuhurthamDates, deleteAllMuhurthamDates };
    const competitionSettingsContextValue = { settings: competitionSettings, ...createFinancialSettingHooks('competition') };
    const lostReasonSettingsContextValue: LostReasonSettingsContextType = { settings: lostReasonSettings, addSetting: addLostReasonSetting, updateSetting: updateLostReasonSetting, deleteSetting: deleteLostReasonSetting };
    const clientActivityTypeSettingsContextValue: ClientActivityTypeSettingsContextType = { 
        settings: clientActivityTypes, 
        addSetting: async (setting) => { await addDoc(collection(db, 'clientActivityTypes'), cleanForFirebase(setting)); },
        updateSetting: async (setting) => { await updateDoc(doc(db, 'clientActivityTypes', setting.id), cleanForFirebase(setting)); },
        deleteSetting: async (id) => { await deleteDoc(doc(db, 'clientActivityTypes', id)); },
        mergeSettings: mergeClientActivityTypes,
    };

    const eventTypesContextValue = { settings: eventTypes, ...createFinancialSettingHooks('eventTypes'), mergeSettings: mergeEventTypes };
    const chargeTypesContextValue: FinancialSettingContextType = { settings: chargeTypes, ...createFinancialSettingHooks('chargeTypes'), mergeSettings: mergeChargeTypes };
    const expenseTypesContextValue: FinancialSettingContextType = { settings: expenseTypes, ...createFinancialSettingHooks('expenseTypes'), mergeSettings: mergeExpenseTypes };
    const paymentModesContextValue: FinancialSettingContextType = { settings: paymentModes, ...createFinancialSettingHooks('paymentModes'), mergeSettings: mergePaymentModes };
    const referralSourcesContextValue: FinancialSettingContextType = { settings: referralSources, ...createFinancialSettingHooks('referralSources'), mergeSettings: mergeReferralSources };
    const serviceArticlesContextValue: ServiceArticlesContextType = { settings: serviceArticles, ...createFinancialSettingHooks('serviceArticles'), mergeSettings: mergeServiceArticles };


    return (
        <GeneralSettingsContext.Provider value={generalSettingsContextValue}>
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
                                                            <EventTypesContext.Provider value={eventTypesContextValue}>
                                                                <ChargeTypesContext.Provider value={chargeTypesContextValue}>
                                                                    <ExpenseTypesContext.Provider value={expenseTypesContextValue}>
                                                                        <PaymentModesContext.Provider value={paymentModesContextValue}>
                                                                            <ReferralSourcesContext.Provider value={referralSourcesContextValue}>
                                                                                <ServiceArticlesContext.Provider value={serviceArticlesContextValue}>
                                                                                    <ItemAccompanimentsContext.Provider value={itemAccompanimentsContextValue}>
                                                                                        <UnitsContext.Provider value={unitsContextValue}>
                                                                                            <RawMaterialsContext.Provider value={rawMaterialsContextValue}>
                                                                                                <RecipesContext.Provider value={recipesContextValue}>
                                                                                                    <RestaurantsContext.Provider value={restaurantsContextValue}>
                                                                                                        <OrdersContext.Provider value={ordersContextValue}>
                                                                                                            <OrderTemplatesContext.Provider value={orderTemplatesContextValue}>
                                                                                                                <PlattersContext.Provider value={plattersContextValue}>
                                                                                                                    <ClientActivitiesContext.Provider value={clientActivitiesContextValue}>
                                                                                                                        <ClientTasksContext.Provider value={clientTasksContextValue}>
                                                                                                                            <MuhurthamDatesContext.Provider value={muhurthamDatesContextValue}>
                                                                                                                                <CompetitionSettingsContext.Provider value={competitionSettingsContextValue}>
                                                                                                                                    <LostReasonSettingsContext.Provider value={lostReasonSettingsContextValue}>
                                                                                                                                        <ClientActivityTypeSettingsContext.Provider value={clientActivityTypeSettingsContextValue}>
                                                                                                                                            {children}
                                                                                                                                        </ClientActivityTypeSettingsContext.Provider>
                                                                                                                                    </LostReasonSettingsContext.Provider>
                                                                                                                                </CompetitionSettingsContext.Provider>
                                                                                                                            </MuhurthamDatesContext.Provider>
                                                                                                                        </ClientTasksContext.Provider>
                                                                                                                    </ClientActivitiesContext.Provider>
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
        </GeneralSettingsContext.Provider>
    );
};