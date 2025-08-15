

export interface FinancialHistoryEntry {
  timestamp: string; // ISO string
  userId: string;
  username: string;
  action: 'created' | 'updated' | 'deleted';
  reason: string;
  changes?: { field: string; from: any; to: any }[];
}

export interface StateChangeHistoryEntry {
  timestamp: string; // ISO string
  userId: string;
  username: string;
  fromState: EventState | undefined; // Can be undefined for creation
  toState: EventState;
  reason?: string; // e.g., for cancellation or marking as lost
}

export type UserRole = 'admin' | 'staff' | 'regular' | 'kitchen';
export type UserStatus = 'active' | 'inactive';
export type ItemType = 'veg' | 'chicken' | 'mutton' | 'egg' | 'prawns' | 'fish' | 'natukodi' | 'other';

export type MenuSelectionStatus = 'draft' | 'finalized'; // maps to write | read-only

export type EventState = 'lead' | 'confirmed' | 'lost' | 'cancelled';
export type EventSession = 'breakfast' | 'lunch' | 'dinner';
export type PermissionLevel = 'none' | 'view' | 'modify';

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
}

export interface Role {
  id: string;
  name: string;
  permissions: AppPermissions;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  referredBy: string;
  hasSystemAccess?: boolean;
  status?: 'active' | 'inactive';
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  password?: string; // Only used for creation/update, not stored in client state
  assignedClientId?: string; 
  roleId?: string; // For staff users
  managedLocationIds?: string[]; // For staff users
}

export interface AppCategory {
  id:string;
  name: string;
  parentId: string | null;
  type?: 'veg' | 'non-veg' | null; // Only for parent categories
  displayRank?: number;

  // New fields for cooking estimates
  baseQuantityPerPax?: number;
  quantityUnit?: string; // e.g., 'grams', 'pieces', 'ml'
  additionalItemPercentage?: number; // e.g., 20 for 20%
}

export interface Item {
  id: string;
  name:string;
  description: string;
  categoryId: string;
  type: ItemType;
  displayRank?: number;
  serviceArticleIds?: string[];
  accompanimentIds?: string[];
}

export interface Catalog {
  id: string;
  name: string;
  description: string;
  group?: string;
  // Key: categoryId, value: array of itemIds
  itemIds: Record<string, string[]>;
}

export interface MenuTemplate {
  id:string;
  name: string;
  catalogId: string;
  group?: string;
  // key is category ID, value is max number of items
  rules: Record<string, number>;
}

export interface LiveCounter {
    id: string;
    name: string;
    description: string;
    maxItems: number;
    displayRank?: number;
}

export interface LiveCounterItem {
    id: string;
    name: string;
    description: string;
    liveCounterId: string;
    displayRank?: number;
}

export interface LocationSetting {
  id: string;
  name: string;
  displayRank?: number;
  color?: string;
}

export interface FinancialSetting {
  id: string;
  name: string;
}

export interface EventTypeSetting {
  id: string;
  name: string;
}

export interface ServiceArticle {
  id: string;
  name: string;
}

export interface ItemAccompaniment {
  id: string;
  name: string;
  baseQuantityPerPax?: number;
  quantityUnit?: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  date: string; // YYYY-MM-DD
  amount: number;
  notes?: string;
  category?: string; // For expenses
  paymentMode?: string; // For income
  history?: FinancialHistoryEntry[];
  isDeleted?: boolean;
}

export interface Charge {
  id: string;
  notes?: string;
  amount: number;
  type: string;
  history?: FinancialHistoryEntry[];
  isDeleted?: boolean;
  additionalPaxCount?: number;
  discountAmount?: number;
}

export interface Event {
  id: string;
  eventType: string;
  date: string; // YYYY-MM-DD
  location: string;
  address?: string; // For ODC location
  session: EventSession;
  state: EventState;
  clientId: string;
  templateId?: string;
  catalogId?: string;
  itemIds: Record<string, string[]>; // Key is category ID, value is array of item IDs.
  createdAt: string; // ISO string
  status: MenuSelectionStatus;
  pax?: number;
  liveCounters?: Record<string, string[]>; // key: liveCounterId, value: liveCounterItemIds[]
  specialInstructions?: string;
  stateHistory?: StateChangeHistoryEntry[];
  
  // New Finance Fields
  pricingModel?: 'variable' | 'flat' | 'mix';
  rent?: number;
  perPaxPrice?: number;
  transactions?: Transaction[];
  charges?: Charge[];

  // Service Planning Fields
  vegLineups?: number;
  nonVegLineups?: number;
  dessertLineups?: number;
  saladLineups?: number;
}

export interface AuditLog {
    id: string;
    timestamp: string; // ISO string
    userId: string;
    username: string;
    action: 'LOGIN' | 'LOGOUT' | 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT';
    details: string; // e.g., "Event 'Gala Dinner' for client 'Grand Hotel'"
    clientId?: string;
}

export interface EventsContextType {
    events: Event[];
    addEvent: (event: Omit<Event, 'id'>) => Promise<string>;
    updateEvent: (event: Event) => Promise<void>;
    deleteEvent: (event: Event) => Promise<void>;
    deleteAllEvents: () => Promise<void>;
    duplicateEvent: (event: Event) => Promise<void>;
    importClientsAndEvents: (data: any[]) => Promise<number>;
};

export interface ItemsContextType {
    items: Item[];
    addItem: (item: Omit<Item, 'id'>) => Promise<void>;
    updateItem: (item: Item) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    deleteMultipleItems: (itemIds: string[]) => Promise<void>;
    moveMultipleItems: (itemIds: string[], destinationCategoryId: string) => Promise<void>;
    addMultipleItems: (itemsToAdd: any[]) => Promise<number>;
    deleteAllItems: () => Promise<void>;
    updateMultipleItems: (itemsToUpdate: {id: string, displayRank: number}[]) => Promise<void>;
    batchUpdateServiceArticles: (itemIds: string[], articleId: string, action: 'add' | 'remove') => Promise<void>;
    batchUpdateAccompaniments: (itemIds: string[], accompanimentId: string, action: 'add' | 'remove') => Promise<void>;
};

export interface PlanItem {
    name: string;
    quantity: number;
    unit: string;
    notes?: string;
}

export interface PlanCategory {
    categoryName: string;
    displayRank?: number;
    items: PlanItem[];
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
    addMultipleCategories: (categoriesToAdd: {parentName: string, childName?: string, type?: 'veg' | 'non-veg' | null, displayRank?: number}[]) => Promise<number>;
    deleteAllCategories: () => Promise<void>;
    updateMultipleCategories: (categoriesToUpdate: {id: string, displayRank: number}[]) => Promise<void>;
    mergeCategory: (sourceCategoryId: string, destinationCategoryId: string) => Promise<void>;
};