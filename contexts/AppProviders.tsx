import React, { useState, createContext, useContext, ReactNode, useMemo, useEffect, useRef, ReactElement } from 'react';
import { Item, MenuTemplate, User, AppCategory, Event, Client, LiveCounter, LiveCounterItem, AuditLog, Catalog, FinancialSetting, LocationSetting, Role, EventTypeSetting, RawMaterial, Recipe, RestaurantSetting, Order, OrderTemplate, Platter, ClientActivity, ClientTask, MuhurthamDate, CompetitionSetting, LostReasonSetting, ClientActivityTypeSetting, GeneralSettings, ItemAccompaniment } from '../types';
import { v4 as uuidv4 } from 'uuid';
// FIX: Refactored to use Firebase v9 modular API
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove, query, where, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { cleanForFirebase, yyyyMMDDToDate } from '../lib/utils';
import { useAuth } from './AuthContext';
import { logAuditEvent } from '../lib/audit';
import * as AllContexts from './AppContexts';

export const AppProviders = ({ children }: { children: ReactNode }) => {
    const { currentUser } = useAuth();

    // State for all data collections
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
    const [serviceArticles, setServiceArticles] = useState<FinancialSetting[]>([]);
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

    // Conditional data fetching based on user role
    useEffect(() => {
        if (!currentUser) return;

        const subscriptions: (() => void)[] = [];
        const subscribe = (collectionName: string, setter: React.Dispatch<any>) => {
            const unsub = onSnapshot(collection(db, collectionName), (snapshot) => {
                setter(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            subscriptions.push(unsub);
        };

        const baseCollections: Record<string, React.Dispatch<any>> = {
            items: setItems, categories: setCategories, events: setEvents, clients: setClients, catalogs: setCatalogs, templates: setTemplates, liveCounters: setLiveCounters, liveCounterItems: setLiveCounterItems, locations: setLocations,
            eventTypes: setEventTypes, chargeTypes: setChargeTypes, expenseTypes: setExpenseTypes, paymentModes: setPaymentModes, referralSources: setReferralSources, serviceArticles: setServiceArticles,
            itemAccompaniments: setItemAccompaniments, units: setUnits, muhurthamDates: setMuhurthamDates, competition: setCompetitionSettings,
            lostReasons: setLostReasonSettings, clientActivityTypes: setClientActivityTypes,
        };
        Object.entries(baseCollections).forEach(([name, setter]) => subscribe(name, setter));

        if (currentUser.role === 'staff' || currentUser.role === 'admin') {
            subscribe('roles', setRoles);
            subscribe('clientActivities', setClientActivities);
            subscribe('clientTasks', setClientTasks);
        }

        if (currentUser.role === 'admin') {
            subscribe('users', setUsers);
            subscribe('auditLogs', setAuditLogs);
        }

        if (currentUser.role === 'kitchen' || currentUser.role === 'admin') {
            subscribe('ingredients', setRawMaterials);
            subscribe('recipes', setRecipes);
            subscribe('restaurants', setRestaurants);
            subscribe('orders', setOrders);
            subscribe('orderTemplates', setOrderTemplates);
            subscribe('platters', setPlatters);
        }
        
        const settingsDocRef = doc(db, 'generalSettings', 'main');
        const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setGeneralSettings({ id: docSnap.id, ...docSnap.data() } as GeneralSettings);
            }
        });
        subscriptions.push(unsubSettings);

        return () => subscriptions.forEach(unsub => unsub());
    }, [currentUser]);


    const managedEvents = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'kitchen') {
            const horizonDays = generalSettings?.kitchenDashboardEventHorizon ?? 7;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const horizonEndDate = new Date(today); horizonEndDate.setDate(today.getDate() + horizonDays - 1);
            return events.filter(event => {
                if (event.state !== 'confirmed') return false;
                const eventStartDate = yyyyMMDDToDate(event.startDate);
                const eventEndDate = event.endDate ? yyyyMMDDToDate(event.endDate) : eventStartDate;
                return eventEndDate >= today && eventStartDate <= horizonEndDate;
            });
        }
        if (currentUser.role === 'admin' || !currentUser.managedLocationIds?.length) return events;
        const locationIdToNameMap = new Map(locations.map(l => [l.id, l.name]));
        const managedLocationNames = currentUser.managedLocationIds.map(id => locationIdToNameMap.get(id)).filter(Boolean) as string[];
        return events.filter(e => managedLocationNames.includes(e.location));
    }, [currentUser, events, locations, generalSettings]);

    const managedClients = useMemo(() => {
        if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'kitchen' || !currentUser.managedLocationIds?.length) return clients;
        const visibleClientIds = new Set(managedEvents.map(e => e.clientId));
        return clients.filter(c => visibleClientIds.has(c.id));
    }, [currentUser, clients, managedEvents]);

    const managedTemplates = useMemo(() => {
        if (!currentUser || currentUser.role === 'admin' || !currentUser.managedLocationIds?.length) {
            return templates;
        }
        return templates.filter(t =>
            !t.locationIds || t.locationIds.length === 0 || t.locationIds.some(locId => currentUser.managedLocationIds!.includes(locId))
        );
    }, [currentUser, templates]);
    
    const createCrudFunctions = (collectionName: string) => ({
        add: async (data: any) => {
            const ref = await addDoc(collection(db, collectionName), cleanForFirebase(data));
            return ref.id;
        },
        update: async (data: any) => {
            const { id, ...rest } = data;
            await updateDoc(doc(db, collectionName, id), cleanForFirebase(rest));
        },
        delete: async (id: string) => {
            await deleteDoc(doc(db, collectionName, id));
        }
    });

    const clientsContextValue = {
        clients: managedClients,
        addClient: createCrudFunctions('clients').add,
        updateClient: createCrudFunctions('clients').update,
        deleteClient: async (clientId: string) => {
            const batch = writeBatch(db);
            const clientEvents = events.filter(e => e.clientId === clientId);
            clientEvents.forEach(e => batch.delete(doc(db, 'events', e.id)));
            batch.delete(doc(db, 'clients', clientId));
            await batch.commit();
        },
        deleteAllClients: async () => { /* Complex logic needed */ },
        addSampleData: async () => { /* Complex logic needed */ },
        deleteSampleData: async () => { /* Complex logic needed */ },
    };

    const usersContextValue = {
        users,
        addUser: async (userData: Omit<User, 'id'> & { password?: string }) => {
            if (!userData.password || !userData.username) {
                throw new Error("Username (email) and password are required to create a new user.");
            }
            
            try {
                // Step 1: Create the user in Firebase Authentication
                const userCredential = await createUserWithEmailAndPassword(auth, userData.username, userData.password);
                const authUser = userCredential.user;
                if (!authUser) { // Added null check for safety
                    throw new Error("User creation failed, auth user object is null.");
                }
                
                // Step 2: Create the user document in Firestore using the UID from Auth
                const { password, ...firestoreData } = userData; // Don't store the password in Firestore
                
                await setDoc(doc(db, 'users', authUser.uid), cleanForFirebase(firestoreData));
                
                return authUser.uid;
            } catch (error: any) {
                console.error("Error creating user:", error);
                // Provide a more user-friendly error message
                if (error.code === 'auth/email-already-in-use') {
                    throw new Error('This email is already registered. Please use a different email.');
                }
                if (error.code === 'auth/weak-password') {
                    throw new Error('The password is too weak. It must be at least 6 characters long.');
                }
                throw new Error(error.message || 'An unknown error occurred while creating the user.');
            }
        },
        updateUser: createCrudFunctions('users').update,
        deleteUser: createCrudFunctions('users').delete,
    };
    
    const contextValues = {
        ClientsContext: clientsContextValue,
        UsersContext: usersContextValue,
        EventsContext: { events: managedEvents, addEvent: createCrudFunctions('events').add, updateEvent: createCrudFunctions('events').update, deleteEvent: async (event: Event) => { await deleteDoc(doc(db, 'events', event.id)); }, deleteAllEvents: async () => {}, duplicateEvent: async (event: Event) => {
            const { id, ...rest} = event;
            await addDoc(collection(db, 'events'), cleanForFirebase({ ...rest, state: 'lead', status: 'draft', createdAt: new Date().toISOString() }));
        }, importClientsAndEvents: async () => 0 },
        ItemsContext: { items, addItem: createCrudFunctions('items').add, updateItem: createCrudFunctions('items').update, deleteItem: createCrudFunctions('items').delete, deleteMultipleItems: async (ids: string[]) => {
            const batch = writeBatch(db);
            ids.forEach(id => batch.delete(doc(db, 'items', id)));
            await batch.commit();
        }, moveMultipleItems: async (ids: string[], destId: string) => {
            const batch = writeBatch(db);
            ids.forEach(id => batch.update(doc(db, 'items', id), { categoryId: destId }));
            await batch.commit();
        }, updateMultipleItems: async (updates: {id: string, displayRank: number}[]) => {
            const batch = writeBatch(db);
            updates.forEach(({ id, displayRank }) => batch.update(doc(db, 'items', id), { displayRank }));
            await batch.commit();
        },
        batchUpdateServiceArticles: async (ids: string[], articleId: string, action: 'add' | 'remove') => {
            const batch = writeBatch(db);
            const fieldUpdate = action === 'add' ? arrayUnion(articleId) : arrayRemove(articleId);
            ids.forEach(id => batch.update(doc(db, 'items', id), { serviceArticleIds: fieldUpdate }));
            await batch.commit();
        },
        batchUpdateAccompaniments: async (ids: string[], accId: string, action: 'add' | 'remove') => {
            const batch = writeBatch(db);
            const fieldUpdate = action === 'add' ? arrayUnion(accId) : arrayRemove(accId);
            ids.forEach(id => batch.update(doc(db, 'items', id), { accompanimentIds: fieldUpdate }));
            await batch.commit();
        },
        addMultipleItems: async (data: any[]) => 0,
        deleteAllItems: async () => {},
        batchUpdateItemType: async (itemIds: string[], newType: any) => {
            const batch = writeBatch(db);
            itemIds.forEach(id => batch.update(doc(db, 'items', id), { type: newType }));
            await batch.commit();
        },
        batchUpdateItemNames: async (updates: {id: string, newName: string}[]) => {
            const batch = writeBatch(db);
            updates.forEach(({ id, newName }) => batch.update(doc(db, 'items', id), { name: newName }));
            await batch.commit();
        }
        },
        AppCategoriesContext: { categories, addCategory: createCrudFunctions('categories').add, updateCategory: createCrudFunctions('categories').update, deleteCategory: createCrudFunctions('categories').delete, updateMultipleCategories: async () => {}, mergeCategory: async () => {}, addMultipleCategories: async () => 0, deleteAllCategories: async () => {} },
        LocationsContext: { locations, addLocation: createCrudFunctions('locations').add, updateLocation: createCrudFunctions('locations').update, deleteLocation: createCrudFunctions('locations').delete, updateMultipleLocations: async () => {} },
        RolesContext: { roles, addRole: createCrudFunctions('roles').add, updateRole: createCrudFunctions('roles').update, deleteRole: createCrudFunctions('roles').delete },
        AuditLogsContext: { auditLogs },
        GeneralSettingsContext: { settings: generalSettings, updateSettings: async (s: Partial<Omit<GeneralSettings, 'id'>>) => { await setDoc(doc(db, 'generalSettings', 'main'), s, { merge: true }) } },
        CatalogsContext: { catalogs, addCatalog: createCrudFunctions('catalogs').add, updateCatalog: createCrudFunctions('catalogs').update, deleteCatalog: createCrudFunctions('catalogs').delete, deleteAllCatalogs: async () => {}, addMultipleCatalogs: async () => 0, updateCatalogGroup: async () => {} },
        TemplatesContext: { templates: managedTemplates, addTemplate: createCrudFunctions('templates').add, updateTemplate: createCrudFunctions('templates').update, deleteTemplate: createCrudFunctions('templates').delete, deleteAllTemplates: async () => {}, updateTemplateGroup: async () => {} },
        LiveCountersContext: { liveCounters, addLiveCounter: createCrudFunctions('liveCounters').add, updateLiveCounter: createCrudFunctions('liveCounters').update, deleteLiveCounter: createCrudFunctions('liveCounters').delete, addMultipleLiveCounters: async () => new Map(), deleteAllLiveCountersAndItems: async () => {}, updateMultipleLiveCounters: async () => {} },
        LiveCounterItemsContext: { liveCounterItems, addLiveCounterItem: createCrudFunctions('liveCounterItems').add, updateLiveCounterItem: createCrudFunctions('liveCounterItems').update, deleteLiveCounterItem: createCrudFunctions('liveCounterItems').delete, addMultipleLiveCounterItems: async () => {}, updateMultipleLiveCounterItems: async () => {} },
        EventTypesContext: { settings: eventTypes, addSetting: async (name: string) => { await addDoc(collection(db, 'eventTypes'), { name }); }, updateSetting: async (id: string, name: string) => { await updateDoc(doc(db, 'eventTypes', id), { name }); }, deleteSetting: createCrudFunctions('eventTypes').delete },
        ChargeTypesContext: { settings: chargeTypes, addSetting: async (name: string) => { await addDoc(collection(db, 'chargeTypes'), { name }); }, updateSetting: async (id: string, name: string) => { await updateDoc(doc(db, 'chargeTypes', id), { name }); }, deleteSetting: createCrudFunctions('chargeTypes').delete },
        ExpenseTypesContext: { settings: expenseTypes, addSetting: async (name: string) => { await addDoc(collection(db, 'expenseTypes'), { name }); }, updateSetting: async (id: string, name: string) => { await updateDoc(doc(db, 'expenseTypes', id), { name }); }, deleteSetting: createCrudFunctions('expenseTypes').delete },
        PaymentModesContext: { settings: paymentModes, addSetting: async (name: string) => { await addDoc(collection(db, 'paymentModes'), { name }); }, updateSetting: async (id: string, name: string) => { await updateDoc(doc(db, 'paymentModes', id), { name }); }, deleteSetting: createCrudFunctions('paymentModes').delete },
        ReferralSourcesContext: { settings: referralSources, addSetting: async (name: string) => { await addDoc(collection(db, 'referralSources'), { name }); }, updateSetting: async (id: string, name: string) => { await updateDoc(doc(db, 'referralSources', id), { name }); }, deleteSetting: createCrudFunctions('referralSources').delete },
        ServiceArticlesContext: { settings: serviceArticles, addSetting: async (name: string) => { await addDoc(collection(db, 'serviceArticles'), { name }); }, updateSetting: async (id: string, name: string) => { await updateDoc(doc(db, 'serviceArticles', id), { name }); }, deleteSetting: createCrudFunctions('serviceArticles').delete },
        ItemAccompanimentsContext: { settings: itemAccompaniments, addAccompaniment: createCrudFunctions('itemAccompaniments').add, updateAccompaniment: createCrudFunctions('itemAccompaniments').update, deleteAccompaniment: createCrudFunctions('itemAccompaniments').delete },
        UnitsContext: { settings: units, addSetting: async (name: string) => { await addDoc(collection(db, 'units'), { name }); }, updateSetting: async (id: string, name: string) => { await updateDoc(doc(db, 'units', id), { name }); }, deleteSetting: createCrudFunctions('units').delete },
        RawMaterialsContext: { rawMaterials, addRawMaterial: createCrudFunctions('ingredients').add, updateRawMaterial: createCrudFunctions('ingredients').update, deleteRawMaterial: createCrudFunctions('ingredients').delete, mergeRawMaterials: async () => {}, addMultipleRawMaterials: async () => 0, deleteAllRawMaterials: async () => {} },
        RecipesContext: { recipes, addRecipe: createCrudFunctions('recipes').add, updateRecipe: createCrudFunctions('recipes').update, deleteRecipe: createCrudFunctions('recipes').delete, addMultipleRecipes: async () => ({ successCount: 0, failures: [] }), deleteAllRecipes: async () => {} },
        RestaurantsContext: { restaurants, addRestaurant: createCrudFunctions('restaurants').add, updateRestaurant: createCrudFunctions('restaurants').update, deleteRestaurant: createCrudFunctions('restaurants').delete },
        OrdersContext: { orders, addOrder: createCrudFunctions('orders').add, updateOrder: createCrudFunctions('orders').update, deleteOrder: createCrudFunctions('orders').delete },
        OrderTemplatesContext: { orderTemplates, addOrderTemplate: createCrudFunctions('orderTemplates').add, updateOrderTemplate: createCrudFunctions('orderTemplates').update, deleteOrderTemplate: createCrudFunctions('orderTemplates').delete, updateTemplateGroup: async () => {} },
        PlattersContext: { platters, addPlatter: createCrudFunctions('platters').add, updatePlatter: createCrudFunctions('platters').update, deletePlatter: createCrudFunctions('platters').delete },
        ClientActivitiesContext: { activities: clientActivities, addActivity: createCrudFunctions('clientActivities').add, deleteActivity: createCrudFunctions('clientActivities').delete },
        ClientTasksContext: { tasks: clientTasks, addTask: createCrudFunctions('clientTasks').add, updateTask: createCrudFunctions('clientTasks').update, deleteTask: createCrudFunctions('clientTasks').delete },
        MuhurthamDatesContext: { muhurthamDates, addMuhurthamDate: async (date: string) => { await addDoc(collection(db, 'muhurthamDates'), {date}); }, deleteMuhurthamDateByDate: async (date: string) => { 
            const q = query(collection(db, 'muhurthamDates'), where('date', '==', date));
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            querySnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
         }, importMuhurthamDates: async () => 0, deleteAllMuhurthamDates: async () => {} },
        CompetitionSettingsContext: { settings: competitionSettings, addSetting: async (name: string) => { await addDoc(collection(db, 'competition'), { name }); }, updateSetting: async (id: string, name: string) => { await updateDoc(doc(db, 'competition', id), { name }); }, deleteSetting: createCrudFunctions('competition').delete },
        LostReasonSettingsContext: { settings: lostReasonSettings, addSetting: createCrudFunctions('lostReasons').add, updateSetting: createCrudFunctions('lostReasons').update, deleteSetting: createCrudFunctions('lostReasons').delete },
        ClientActivityTypeSettingsContext: { settings: clientActivityTypes, addSetting: createCrudFunctions('clientActivityTypes').add, updateSetting: createCrudFunctions('clientActivityTypes').update, deleteSetting: createCrudFunctions('clientActivityTypes').delete },
    };

    const providers = Object.entries(AllContexts)
        .filter(([name]) => name.endsWith('Context'))
        .map(([contextName, Context]) => {
            const value = (contextValues as any)[contextName];
            return { Context, value };
        });

    return providers.reduceRight((acc, { Context, value }) => {
        const Provider = (Context as React.Context<any>).Provider;
        return <Provider value={value}>{acc}</Provider>;
    }, <>{children}</> as ReactElement);
};
