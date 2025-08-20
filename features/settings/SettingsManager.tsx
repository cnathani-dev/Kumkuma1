import React, { useState } from 'react';
import { useLocations, useChargeTypes, useExpenseTypes, usePaymentModes, useReferralSources, useServiceArticles, useUnits, useItemAccompaniments, useEventTypes, useRestaurants, useOrderTemplates } from '../../contexts/AppContexts';
import { LocationSetting, FinancialSetting, EventTypeSetting, RestaurantSetting, OrderTemplate } from '../../types';
import Modal from '../../components/Modal';
import { primaryButton, secondaryButton, dangerButton, inputStyle, iconButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, Save, Merge } from 'lucide-react';

type SettingType = 'locations' | 'eventTypes' | 'chargeTypes' | 'expenseTypes' | 'paymentModes' | 'referralSources' | 'serviceArticles' | 'units' | 'restaurants';

export const SettingsManager = ({ canModify }: { canModify: boolean }) => {
    const [activeTab, setActiveTab] = useState<SettingType>('locations');

    const tabs: { id: SettingType, name: string }[] = [
        { id: 'locations', name: 'Locations' },
        { id: 'restaurants', name: 'Restaurants' },
        { id: 'eventTypes', name: 'Event Types' },
        { id: 'chargeTypes', name: 'Charge Types' },
        { id: 'expenseTypes', name: 'Expense Types' },
        { id: 'paymentModes', name: 'Payment Modes' },
        { id: 'referralSources', name: 'Referral Sources' },
        { id: 'serviceArticles', name: 'Service Articles' },
        { id: 'units', name: 'Units' },
    ];
    
    const renderContent = () => {
        switch (activeTab) {
            case 'locations':
                return <LocationSettings canModify={canModify} />;
            case 'restaurants':
                return <RestaurantSettings canModify={canModify} />;
            case 'eventTypes':
                return <FinancialSettings type="Event Type" contextHook={useEventTypes} canModify={canModify} />;
            case 'chargeTypes':
                return <FinancialSettings type="Charge Types" contextHook={useChargeTypes} canModify={canModify} />;
            case 'expenseTypes':
                return <FinancialSettings type="Expense Types" contextHook={useExpenseTypes} canModify={canModify} />;
            case 'paymentModes':
                return <FinancialSettings type="Payment Modes" contextHook={usePaymentModes} canModify={canModify} />;
            case 'referralSources':
                return <FinancialSettings type="Referral Source" contextHook={useReferralSources} canModify={canModify} />;
            case 'serviceArticles':
                return <FinancialSettings type="Service Article" contextHook={useServiceArticles} canModify={canModify} />;
            case 'units':
                return <FinancialSettings type="Unit" contextHook={useUnits} canModify={canModify} />;
            default: return null;
        }
    };

    return (
        <div>
            <div className="border-b border-warm-gray-200 dark:border-warm-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-shrink-0 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700 hover:border-warm-gray-300'
                            }`}
                        >{tab.name}</button>
                    ))}
                </nav>
            </div>
            {renderContent()}
        </div>
    )
};

const LocationSettings = ({ canModify }: { canModify: boolean }) => {
    const { locations, addLocation, updateLocation, deleteLocation } = useLocations();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<LocationSetting | null>(null);

    const handleSave = async (data: LocationSetting | Omit<LocationSetting, 'id'>) => {
        if (!canModify) return;
        try {
            if ('id' in data) await updateLocation(data);
            else await addLocation(data);
            setIsModalOpen(false);
        } catch (e) { alert(`Error: ${e}`); }
    };
    
    const handleDelete = async (id: string) => {
        if (!canModify) return;
        if(window.confirm("Are you sure?")) {
            await deleteLocation(id);
        }
    };

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
            {isModalOpen && <Modal isOpen={true} onClose={() => setIsModalOpen(false)} title={editingLocation ? "Edit Location" : "Add Location"}>
                <LocationForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} location={editingLocation} />
            </Modal>}
            <div className="flex justify-end mb-4">
                {canModify && <button onClick={() => { setEditingLocation(null); setIsModalOpen(true); }} className={primaryButton}><Plus size={16}/> <span className="hidden sm:inline">Add Location</span></button>}
            </div>
            <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {locations.sort((a,b)=>(a.displayRank ?? Infinity) - (b.displayRank ?? Infinity)).map(loc => (
                    <li key={loc.id} className="py-2 flex justify-between items-center">
                        <span className="flex items-center gap-2 font-semibold">
                            <span className="w-4 h-4 rounded-full" style={{backgroundColor: loc.color || '#ccc'}}></span>
                            {loc.name}
                        </span>
                        {canModify && <div className="flex gap-1">
                            <button onClick={() => {setEditingLocation(loc); setIsModalOpen(true);}} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Location">
                                <Edit size={16} className="text-primary-600" />
                            </button>
                            <button onClick={() => handleDelete(loc.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Location">
                                <Trash2 size={16} className="text-accent-500" />
                            </button>
                        </div>}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const LocationForm = ({ onSave, onCancel, location }: {
    onSave: (data: LocationSetting | Omit<LocationSetting, 'id'>) => void,
    onCancel: () => void,
    location: LocationSetting | null
}) => {
    const [name, setName] = useState(location?.name || '');
    const [displayRank, setDisplayRank] = useState(location?.displayRank || 0);
    const [color, setColor] = useState(location?.color || '#fde68a');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { name, displayRank: Number(displayRank), color };
        if (location) onSave({ ...data, id: location.id });
        else onSave(data);
    }
    return (
         <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Location Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <input type="number" placeholder="Display Rank" value={displayRank} onChange={e => setDisplayRank(Number(e.target.value))} className={inputStyle} />
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className={`${inputStyle} h-10`} />
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    );
};

const FinancialSettings = ({ type, contextHook, canModify }: { type: string, contextHook: any, canModify: boolean }) => {
    const { settings, addSetting, updateSetting, deleteSetting, mergeSettings } = contextHook();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSetting, setEditingSetting] = useState<FinancialSetting | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [mergeTarget, setMergeTarget] = useState<string>('');
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

    const handleSave = async (data: {id?: string, name: string}) => {
        if(!canModify) return;
        try {
            if (data.id) await updateSetting(data.id, data.name);
            else await addSetting(data.name);
            setIsModalOpen(false);
        } catch(e) { alert(`Error: ${e}`); }
    };
    
    const handleDelete = async (id: string) => {
         if(!canModify) return;
        if(window.confirm("Are you sure?")) {
            await deleteSetting(id);
        }
    };
    
    const handleSelectionChange = (id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if(checked) newSet.add(id);
            else newSet.delete(id);
            return newSet;
        });
    }

    const handleOpenMergeModal = () => {
        setMergeTarget('');
        setIsMergeModalOpen(true);
    }

    const handleConfirmMerge = async () => {
        if (!mergeTarget || !mergeSettings) return;
        const sourceIds = Array.from(selectedIds).filter(id => id !== mergeTarget);
        if (sourceIds.length === 0) {
            alert("Cannot merge an item into itself. Please select a different destination unit.");
            return;
        }
        if (window.confirm(`Are you sure? This will update all items using the merged units and cannot be undone.`)) {
            try {
                await mergeSettings(sourceIds, mergeTarget);
                setSelectedIds(new Set());
                setIsMergeModalOpen(false);
            } catch(e) {
                alert(`Error merging: ${e}`);
            }
        }
    };

    return (
         <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
            {isModalOpen && <Modal isOpen={true} onClose={() => setIsModalOpen(false)} title={editingSetting ? `Edit ${type}` : `Add ${type}`}>
                <FinancialSettingForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} setting={editingSetting} />
            </Modal>}
            {isMergeModalOpen && <Modal isOpen={true} onClose={() => setIsMergeModalOpen(false)} title={`Merge ${type}`}>
                <div className="space-y-4">
                    <p>You have selected <strong>{selectedIds.size}</strong> {type}s to merge. Select which one to keep as the primary. All others will be deleted, and their references updated.</p>
                    <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} className={inputStyle}>
                        <option value="">-- Select Destination --</option>
                        {settings.filter((s: FinancialSetting) => selectedIds.has(s.id)).map((s:FinancialSetting) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                     <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsMergeModalOpen(false)} className={secondaryButton}>Cancel</button>
                        <button type="button" onClick={handleConfirmMerge} disabled={!mergeTarget} className={primaryButton}>Confirm Merge</button>
                    </div>
                </div>
            </Modal>}
             <div className="flex justify-end items-center gap-4 mb-4">
                {canModify && mergeSettings && selectedIds.size > 1 && (
                    <button onClick={handleOpenMergeModal} className={primaryButton}><Merge size={16}/> Merge ({selectedIds.size})</button>
                )}
                {canModify && <button onClick={() => { setEditingSetting(null); setIsModalOpen(true); }} className={primaryButton}><Plus size={16}/> <span className="hidden sm:inline">Add {type}</span></button>}
            </div>
            <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {settings.sort((a: FinancialSetting, b: FinancialSetting) => a.name.localeCompare(b.name)).map((s: FinancialSetting) => (
                    <li key={s.id} className="py-2 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {canModify && mergeSettings && <input type="checkbox" checked={selectedIds.has(s.id)} onChange={e => handleSelectionChange(s.id, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />}
                            <span>{s.name}</span>
                        </div>
                        {canModify && <div className="flex gap-1">
                             <button onClick={() => {setEditingSetting(s); setIsModalOpen(true);}} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title={`Edit ${type}`}>
                                <Edit size={16} className="text-primary-600" />
                            </button>
                            <button onClick={() => handleDelete(s.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title={`Delete ${type}`}>
                                <Trash2 size={16} className="text-accent-500" />
                            </button>
                        </div>}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const FinancialSettingForm = ({ onSave, onCancel, setting }: {
    onSave: (data: {id?: string, name: string}) => void,
    onCancel: () => void,
    setting: FinancialSetting | null,
}) => {
    const [name, setName] = useState(setting?.name || '');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { name };
        if (setting) onSave({ ...data, id: setting.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    );
};

const RestaurantSettings = ({ canModify }: { canModify: boolean }) => {
    const { restaurants, addRestaurant, updateRestaurant, deleteRestaurant } = useRestaurants();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<RestaurantSetting | null>(null);

    const handleSave = async (data: {id?: string, name: string}) => {
        if(!canModify) return;
        try {
            if (data.id) await updateRestaurant({id: data.id, name: data.name});
            else await addRestaurant({name: data.name});
            setIsModalOpen(false);
        } catch(e) { alert(`Error: ${e}`); }
    };

    const handleDelete = async (id: string) => {
        if(!canModify) return;
       if(window.confirm("Are you sure?")) {
           await deleteRestaurant(id);
       }
   };
    
    return (
        <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
           {isModalOpen && <Modal isOpen={true} onClose={() => setIsModalOpen(false)} title={editing ? "Edit Restaurant" : "Add Restaurant"}>
               <FinancialSettingForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} setting={editing} />
           </Modal>}
            <div className="flex justify-end mb-4">
               {canModify && <button onClick={() => { setEditing(null); setIsModalOpen(true); }} className={primaryButton}><Plus size={16}/> Add Restaurant</button>}
           </div>
           <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
               {restaurants.sort((a, b) => a.name.localeCompare(b.name)).map(r => (
                   <li key={r.id} className="py-2 flex justify-between items-center">
                       <span>{r.name}</span>
                       {canModify && <div className="flex gap-1">
                            <button onClick={() => {setEditing(r); setIsModalOpen(true);}} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit">
                               <Edit size={16} className="text-primary-600" />
                           </button>
                           <button onClick={() => handleDelete(r.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete">
                               <Trash2 size={16} className="text-accent-500" />
                           </button>
                       </div>}
                   </li>
               ))}
           </ul>
       </div>
    )
}