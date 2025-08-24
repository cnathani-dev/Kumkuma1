// --- Basic Types ---
export type ItemType = 'veg' | 'non-veg' | 'egg' | 'chicken' | 'mutton' | 'prawns' | 'fish' | 'natukodi' | 'crab' | 'other';
export type EventSession = 'breakfast' | 'lunch' | 'dinner' | 'all-day';
export type EventState = 'lead' | 'confirmed' | 'lost' | 'cancelled';
export type MenuSelectionStatus = 'draft' | 'finalized';
export type UserRole = 'admin' | 'staff' | 'regular' | 'kitchen';
export type PermissionLevel = 'none' | 'view' | 'modify';

// --- Data Models ---

export interface AppCategory {
  id: string;
  name: string;
  parentId: string | null;
  type?: 'veg' | 'non-veg' | null;
  displayRank?: number;
  isStandardAccompaniment?: boolean;
  baseQuantityPerPax?: number;
  quantityUnit?: string;
  additionalItemPercentage?: number;
  baseQuantityPerPax_nonVeg?: number;
  quantityUnit_nonVeg?: string;
  additionalItemPercentage_nonVeg?: number;
  useSingleCookingEstimate?: boolean;
}

export interface Item {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  type?: ItemType;
  displayRank?: number;
  serviceArticleIds?: string[];
  accompanimentIds?: string[];
  baseQuantityPerPax?: number;
  quantityUnit?: string;
}

export interface LiveCounter {
  id: string;
  name: string;
  description?: string;
  maxItems: number;
  displayRank?: number;
}

export interface LiveCounterItem {
  id: string;
  name: string;
  description?: string;
  liveCounterId: string;
  displayRank?: number;
}

export interface Catalog {
  id: string;
  name: string;
  description?: string;
  group?: string;
  itemIds: Record<string, string[]>; // categoryId -> itemId[]
}

export interface MenuTemplate {
  id: string;
  name: string;
  catalogId: string;
  group?: string;
  rules: Record<string, number>; // categoryId -> maxItems
  type?: 'veg' | 'non-veg';
  muttonRules?: number;
  isCocktailTemplate?: boolean;
  isHiTeaTemplate?: boolean;
  locationIds?: string[];
}

export interface StateChangeHistoryEntry {
    timestamp: string;
    userId: string;
    username: string;
    fromState: EventState;
    toState: EventState;
    reason?: string;
}

export interface FinancialHistoryEntry {
    timestamp: string;
    userId: string;
    username: string;
    action: 'created' | 'updated' | 'deleted';
    reason: string;
    changes?: { field: string, from: any, to: any }[];
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  address?: string;
  referredBy?: string;
  hasSystemAccess: boolean;
  status: 'active' | 'inactive';
  history?: FinancialHistoryEntry[];
}

export interface Charge {
  id: string;
  type: string;
  amount: number;
  notes?: string;
  isDeleted?: boolean;
  history?: FinancialHistoryEntry[];
  
  // Fields for special charge types
  liveCounterId?: string;
  menuTemplateId?: string; // For cocktail or hi-tea
  price?: number; // Base price before discount
  discountAmount?: number;
  cocktailPax?: number;
  corkageCharges?: number;
  additionalPaxCount?: number;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  date: string; // YYYY-MM-DD
  amount: number;
  paymentMode?: string;
  category?: string;
  notes?: string;
  isDeleted?: boolean;
  history?: FinancialHistoryEntry[];
  completedAt?: string;
}

export interface Event {
  id: string;
  clientId: string;
  eventType: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  location: string;
  address?: string;
  session: EventSession;
  pax: number;
  templateId?: string;
  itemIds: Record<string, string[]>;
  liveCounters?: Record<string, string[]>;
  cocktailMenuItems?: Record<string, string[]>;
  hiTeaMenuItems?: Record<string, string[]>;
  status: MenuSelectionStatus;
  state: EventState;
  isCocktailEvent?: boolean;
  stateHistory?: StateChangeHistoryEntry[];
  notes?: string;
  createdAt?: string;
  history?: FinancialHistoryEntry[];
  lostReasonId?: string;
  lostNotes?: string;
  lostToCompetitionId?: string;
  // Finance
  pricingModel?: 'variable' | 'flat' | 'mix';
  perPaxPrice?: number;
  rent?: number;
  charges?: Charge[];
  transactions?: Transaction[];
  // Service Plan
  vegLineups?: number;
  nonVegLineups?: number;
  dessertLineups?: number;
  saladLineups?: number;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  assignedClientId?: string;
  roleId?: string;
  managedLocationIds?: string[];
}

export interface AppPermissions {
    dashboard: PermissionLevel;
    itemBank: PermissionLevel;
    catalogs: PermissionLevel;
    templates: PermissionLevel;
    liveCounters: PermissionLevel;
    reports: PermissionLevel;
    users: PermissionLevel;
    settings: PermissionLevel;
    clientsAndEvents: PermissionLevel;
    financeCore: PermissionLevel;
    financeCharges: PermissionLevel;
    financePayments: PermissionLevel;
    financeExpenses: PermissionLevel;
    competition: PermissionLevel;
    lostReasons: PermissionLevel;
    muhurthams: PermissionLevel;
    clientActivityTypes: PermissionLevel;
    allowEventCancellation: boolean;
    visibleReports?: string[];
}

export interface Role {
    id: string;
    name: string;
    permissions: AppPermissions;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    userId: string;
    username: string;
    action: string;
    details: string;
    clientId?: string;
}

export interface FinancialSetting {
    id: string;
    name: string;
}

export interface CompetitionSetting {
    id: string;
    name: string;
}

export interface LostReasonSetting {
    id: string;
    name: string;
    isCompetitionReason?: boolean;
}

export interface LocationSetting {
    id: string;
    name: string;
    displayRank?: number;
    color?: string;
}

export interface EventTypeSetting {
    id: string;
    name: string;
}

export interface ServiceArticle {
    id: string;
    name: string;
}

export interface ServiceArticlesContextType {
    settings: ServiceArticle[];
    addSetting: (name: string) => Promise<void>;
    updateSetting: (id: string, name: string) => Promise<void>;
    deleteSetting: (id: string) => Promise<void>;
    mergeSettings?: (sourceIds: string[], destId: string) => Promise<void>;
}

export interface ItemAccompaniment {
    id: string;
    name: string;
    baseQuantityPerPax?: number;
    quantityUnit?: string;
}

export interface RawMaterial {
    id: string;
    name: string;
    unit: string;
}

export interface RecipeRawMaterial {
    rawMaterialId: string;
    quantity: number;
}

export interface RecipeConversion {
    unit: string;
    factor: number;
}

export interface Recipe {
    id: string;
    name: string;
    instructions: string;
    yieldQuantity: number;
    yieldUnit: string;
    rawMaterials: RecipeRawMaterial[];
    conversions?: RecipeConversion[];
    defaultOrderingUnit?: string;
}

export interface RestaurantSetting {
  id: string;
  name: string;
}

export interface Order {
  id: string;
  date: string; // YYYY-MM-DD
  session: EventSession;
  recipeRequirements?: Record<string, Record<string, number>>; // recipeId -> restaurantId -> quantity
  platterRequirements?: Record<string, Record<string, number>>; // platterId -> restaurantId -> quantity
  adHocLocations?: { id: string; name: string }[];
}

export interface OrderTemplate {
  id: string;
  name: string;
  group?: string;
  recipeIds?: string[];
  platterIds?: string[];
}

export interface PlatterRecipe {
  recipeId: string;
  quantity: number;
  unit: string;
}

export interface Platter {
  id: string;
  name: string;
  recipes: PlatterRecipe[];
}

export interface PlanCategory {
    categoryName: string;
    displayRank?: number;
    items: PlanItem[];
}

export interface PlanItem {
    name: string;
    quantity: number;
    unit: string;
    notes?: string;
}

export interface ClientActivity {
  id: string;
  clientId: string;
  timestamp: string;
  userId: string;
  username: string;
  typeId: string;
  typeName: string;
  details: string;
}

export interface ClientTask {
    id: string;
    clientId: string;
    title: string;
    dueDate?: string;
    isCompleted: boolean;
    createdAt: string;
    completedAt?: string;
    userId: string; // creator
    username: string; // creator
    assignedToUserId?: string;
    assignedToUsername?: string;
}

export interface MuhurthamDate {
  id: string;
  date: string; // YYYY-MM-DD
}

export interface ClientActivityTypeSetting {
  id: string;
  name: string;
  icon?: string;
}

// --- Context Types ---

export interface ItemsContextType {
    items: Item[];
    addItem: (item: Omit<Item, 'id'>) => Promise<void>;
    updateItem: (item: Item) => Promise<void>;
    deleteItem: (id: string) => Promise<void>;
    deleteMultipleItems: (ids: string[]) => Promise<void>;
    moveMultipleItems: (ids: string[], destId: string) => Promise<void>;
    updateMultipleItems: (itemsToUpdate: {id: string, displayRank: number}[]) => Promise<void>;
    batchUpdateServiceArticles: (ids: string[], articleId: string, action: 'add' | 'remove') => Promise<void>;
    batchUpdateAccompaniments: (ids: string[], accId: string, action: 'add' | 'remove') => Promise<void>;
    addMultipleItems: (data: any[]) => Promise<number>;
    deleteAllItems: () => Promise<void>;
    batchUpdateItemType: (itemIds: string[], newType: ItemType) => Promise<void>;
    batchUpdateItemNames: (updates: { id: string; newName: string }[]) => Promise<void>;
}

export interface ItemAccompanimentsContextType {
    settings: ItemAccompaniment[];
    addAccompaniment: (acc: Omit<ItemAccompaniment, 'id'>) => Promise<void>;
    updateAccompaniment: (acc: ItemAccompaniment) => Promise<void>;
    deleteAccompaniment: (id: string) => Promise<void>;
}

export interface AppCategoriesContextType {
    categories: AppCategory[];
    addCategory: (category: Omit<AppCategory, 'id'>) => Promise<string>;
    updateCategory: (category: AppCategory) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    updateMultipleCategories: (cats: {id: string, displayRank: number}[]) => Promise<void>;
    mergeCategory: (sourceId: string, destId: string) => Promise<void>;
    addMultipleCategories: (data: any[]) => Promise<number>;
    deleteAllCategories: () => Promise<void>;
}

export interface EventsContextType {
    events: Event[];
    addEvent: (event: Omit<Event, 'id'>) => Promise<string>;
    updateEvent: (event: Event) => Promise<void>;
    deleteEvent: (event: Event) => Promise<void>;
    deleteAllEvents: () => Promise<void>;
    duplicateEvent: (event: Event) => Promise<void>;
    importClientsAndEvents: (data: any[]) => Promise<number>;
}

export interface CatalogsContextType {
    catalogs: Catalog[];
    addCatalog: (catalog: Omit<Catalog, 'id'>) => Promise<string>;
    updateCatalog: (catalog: Catalog) => Promise<void>;
    deleteCatalog: (catalogId: string) => Promise<void>;
    deleteAllCatalogs: () => Promise<void>;
    addMultipleCatalogs: (catalogsToAdd: { name: string; description: string; items: string[] }[]) => Promise<number>;
    updateCatalogGroup: (oldGroup: string, newGroup: string) => Promise<void>;
}

export interface RawMaterialsContextType {
    rawMaterials: RawMaterial[];
    addRawMaterial: (rawMaterial: Omit<RawMaterial, 'id'>) => Promise<string>;
    updateRawMaterial: (rawMaterial: RawMaterial) => Promise<void>;
    deleteRawMaterial: (id: string) => Promise<void>;
    mergeRawMaterials: (sourceRawMaterialIds: string[], destinationRawMaterialId: string) => Promise<void>;
    addMultipleRawMaterials: (data: any[]) => Promise<number>;
    deleteAllRawMaterials: () => Promise<void>;
}

export interface RecipesContextType {
    recipes: Recipe[];
    addRecipe: (recipe: Omit<Recipe, 'id'>) => Promise<string>;
    updateRecipe: (recipe: Recipe) => Promise<void>;
    deleteRecipe: (id: string) => Promise<void>;
    addMultipleRecipes: (data: any[]) => Promise<{ successCount: number; failures: { name: string; reason: string }[] }>;
    deleteAllRecipes: () => Promise<void>;
}

export interface RestaurantsContextType {
  restaurants: RestaurantSetting[];
  addRestaurant: (restaurant: Omit<RestaurantSetting, 'id'>) => Promise<void>;
  updateRestaurant: (restaurant: RestaurantSetting) => Promise<void>;
  deleteRestaurant: (id: string) => Promise<void>;
}

export interface OrdersContextType {
  orders: Order[];
  addOrder: (order: Omit<Order, 'id'>) => Promise<string>;
  updateOrder: (order: Order) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
}

export interface OrderTemplatesContextType {
  orderTemplates: OrderTemplate[];
  addOrderTemplate: (template: Omit<OrderTemplate, 'id'>) => Promise<string>;
  updateOrderTemplate: (template: OrderTemplate) => Promise<void>;
  deleteOrderTemplate: (id: string) => Promise<void>;
  updateTemplateGroup: (oldGroup: string, newGroup: string) => Promise<void>;
}

export interface FinancialSettingContextType {
    settings: FinancialSetting[];
    addSetting: (name: string) => Promise<void>;
    updateSetting: (id: string, name: string) => Promise<void>;
    deleteSetting: (id: string) => Promise<void>;
    mergeSettings?: (sourceIds: string[], destId: string) => Promise<void>;
}

export interface CompetitionSettingsContextType {
    settings: CompetitionSetting[];
    addSetting: (name: string) => Promise<void>;
    updateSetting: (id: string, name: string) => Promise<void>;
    deleteSetting: (id: string) => Promise<void>;
}

export interface LostReasonSettingsContextType {
    settings: LostReasonSetting[];
    addSetting: (setting: Omit<LostReasonSetting, 'id'>) => Promise<void>;
    updateSetting: (setting: LostReasonSetting) => Promise<void>;
    deleteSetting: (id: string) => Promise<void>;
}

export interface PlattersContextType {
    platters: Platter[];
    addPlatter: (platter: Omit<Platter, 'id'>) => Promise<void>;
    updatePlatter: (platter: Platter) => Promise<void>;
    deletePlatter: (id: string) => Promise<void>;
}

export interface ClientActivitiesContextType {
    activities: ClientActivity[];
    addActivity: (activity: Omit<ClientActivity, 'id'>) => Promise<string>;
    deleteActivity: (id: string) => Promise<void>;
}

export interface ClientTasksContextType {
    tasks: ClientTask[];
    addTask: (task: Omit<ClientTask, 'id'>) => Promise<string>;
    updateTask: (task: ClientTask) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
}

export interface MuhurthamDatesContextType {
    muhurthamDates: MuhurthamDate[];
    addMuhurthamDate: (date: string) => Promise<void>;
    deleteMuhurthamDateByDate: (date: string) => Promise<void>;
    importMuhurthamDates: (data: any[]) => Promise<number>;
    deleteAllMuhurthamDates: () => Promise<void>;
}

export interface ClientActivityTypeSettingsContextType {
  settings: ClientActivityTypeSetting[];
  addSetting: (setting: Omit<ClientActivityTypeSetting, 'id'>) => Promise<void>;
  updateSetting: (setting: ClientActivityTypeSetting) => Promise<void>;
  deleteSetting: (id: string) => Promise<void>;
}