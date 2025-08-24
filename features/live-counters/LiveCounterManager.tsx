
import React, { useState, useMemo, useEffect } from 'react';
import { useLiveCounters, useLiveCounterItems } from '../../contexts/AppContexts';
import { LiveCounter, LiveCounterItem } from '../../types';
import Modal from '../../components/Modal';
import { primaryButton, secondaryButton, dangerButton, inputStyle, iconButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, Save, Download } from 'lucide-react';
import { exportLiveCountersToPdf } from '../../lib/export';

type ModalState = 
    | { type: 'counter', data: LiveCounter | null }
    | { type: 'item', data: LiveCounterItem | null };

export const LiveCounterManager = ({ canModify }: { canModify: boolean }) => {
    const { liveCounters, addLiveCounter, updateLiveCounter, deleteLiveCounter } = useLiveCounters();
    const { liveCounterItems, addLiveCounterItem, updateLiveCounterItem, deleteLiveCounterItem } = useLiveCounterItems();
    
    const [selectedCounterId, setSelectedCounterId] = useState<string | null>(null);
    const [modalState, setModalState] = useState<ModalState | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [selectedIdsForExport, setSelectedIdsForExport] = useState<Set<string>>(new Set());

    useEffect(() => {
        // If no counter is selected and there are counters available, select the first one.
        if (!selectedCounterId && liveCounters.length > 0) {
            const sortedCounters = [...liveCounters].sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
            setSelectedCounterId(sortedCounters[0].id);
        }
    }, [liveCounters, selectedCounterId]);
    
    const filteredItems = useMemo(() => {
        if (!selectedCounterId) return [];
        return liveCounterItems.filter(i => i.liveCounterId === selectedCounterId)
            .sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
    }, [liveCounterItems, selectedCounterId]);

    const handleSaveCounter = async (counterData: LiveCounter | Omit<LiveCounter, 'id'>) => {
        if (!canModify) return;
        try {
            if ('id' in counterData) await updateLiveCounter(counterData);
            else await addLiveCounter(counterData);
            setModalState(null);
        } catch (e) { alert(`Error: ${e}`); }
    };
    
    const handleDeleteCounter = async (id: string) => {
        if (!canModify) return;
        if (window.confirm("Are you sure? This will delete the counter and all its items, and remove it from any events.")) {
            try {
                await deleteLiveCounter(id);
                if (selectedCounterId === id) setSelectedCounterId(null);
            } catch (e) { alert(`Error: ${e}`); }
        }
    };
    
    const handleSaveItem = async (itemData: LiveCounterItem | Omit<LiveCounterItem, 'id'>) => {
        if (!canModify) return;
        try {
            if ('id' in itemData) await updateLiveCounterItem(itemData);
            else await addLiveCounterItem(itemData);
            setModalState(null);
        } catch (e) { alert(`Error: ${e}`); }
    };
    
    const handleDeleteItem = async (id: string) => {
        if (!canModify) return;
        if(window.confirm("Are you sure?")) {
            await deleteLiveCounterItem(id);
        }
    };

    const handleExportSelectionChange = (counterId: string) => {
        setSelectedIdsForExport(prev => {
            const newSet = new Set(prev);
            if (newSet.has(counterId)) {
                newSet.delete(counterId);
            } else {
                newSet.add(counterId);
            }
            return newSet;
        });
    };

    const handleSelectAllForExport = (select: boolean) => {
        if (select) {
            setSelectedIdsForExport(new Set(liveCounters.map(lc => lc.id)));
        } else {
            setSelectedIdsForExport(new Set());
        }
    };

    const handleGeneratePdf = () => {
        const countersToExport = liveCounters.filter(lc => selectedIdsForExport.has(lc.id));
        exportLiveCountersToPdf(countersToExport, liveCounterItems);
        setIsExportModalOpen(false);
    };

    const modalContent = () => {
        if (!modalState) return null;
        if (modalState.type === 'counter') {
            return <CounterForm onSave={handleSaveCounter} onCancel={() => setModalState(null)} counter={modalState.data} />;
        }
        if (modalState.type === 'item') {
            return <ItemForm onSave={handleSaveItem} onCancel={() => setModalState(null)} item={modalState.data} counterId={selectedCounterId!} />;
        }
    };

    return (
        <div className="flex gap-6 h-[calc(100vh-10rem)]">
             {modalState && 
                <Modal 
                    isOpen={!!modalState} 
                    onClose={() => setModalState(null)}
                    title={modalState.type === 'counter' ? 'Live Counter' : 'Counter Item'}
                >
                   {modalContent()}
                </Modal>
            }
            {isExportModalOpen && (
                <Modal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    title="Select Live Counters to Export"
                >
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b">
                            <p className="text-sm text-warm-gray-500">Select which counters to include in the PDF.</p>
                            <div className="flex gap-2">
                                <button onClick={() => handleSelectAllForExport(true)} className="text-xs font-semibold text-primary-600">Select All</button>
                                <button onClick={() => handleSelectAllForExport(false)} className="text-xs font-semibold text-primary-600">Deselect All</button>
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                            {liveCounters.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)).map(counter => (
                                <label key={counter.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700/50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedIdsForExport.has(counter.id)}
                                        onChange={() => handleExportSelectionChange(counter.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span>{counter.name}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setIsExportModalOpen(false)} className={secondaryButton}>Cancel</button>
                            <button type="button" onClick={handleGeneratePdf} className={primaryButton} disabled={selectedIdsForExport.size === 0}>Generate PDF</button>
                        </div>
                    </div>
                </Modal>
            )}
            <div className="w-1/3 bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">Live Counters</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsExportModalOpen(true)} className={secondaryButton}>
                            <Download size={16} /> Export PDF
                        </button>
                        {canModify && <button onClick={() => setModalState({ type: 'counter', data: null })} className={primaryButton}>Add</button>}
                    </div>
                </div>
                 <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                    {liveCounters.sort((a,b)=>(a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)).map(counter => (
                        <li 
                            key={counter.id} 
                            className={`p-3 rounded-md cursor-pointer ${selectedCounterId === counter.id ? 'bg-primary-100 dark:bg-primary-900/40' : 'hover:bg-warm-gray-50'}`}
                            onClick={() => setSelectedCounterId(counter.id)}
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{counter.name}</p>
                                    <p className="text-sm text-warm-gray-500">Max {counter.maxItems} items</p>
                                </div>
                                {canModify && 
                                <div className="flex items-center gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); setModalState({ type: 'counter', data: counter })}} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Counter">
                                        <Edit size={16} className="text-primary-600"/>
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCounter(counter.id)}} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Counter">
                                        <Trash2 size={16} className="text-accent-500"/>
                                    </button>
                                </div>
                                }
                            </div>
                        </li>
                    ))}
                 </ul>
            </div>
            <div className="w-2/3 bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="font-bold text-lg">Items for Selected Counter</h3>
                    {canModify && selectedCounterId && <button onClick={() => setModalState({ type: 'item', data: null })} className={primaryButton}>Add Item</button>}
                </div>
                 <div className="overflow-y-auto">
                    {!selectedCounterId && <p className="text-center py-10 text-warm-gray-500">Select a counter to view its items.</p>}
                    <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                        {filteredItems.map(item => (
                            <li key={item.id} className="py-3 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-sm text-warm-gray-500">{item.description}</p>
                                </div>
                                {canModify &&
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setModalState({type: 'item', data: item})} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Item">
                                        <Edit size={16} className="text-primary-600"/>
                                    </button>
                                    <button onClick={() => handleDeleteItem(item.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Item">
                                        <Trash2 size={16} className="text-accent-500"/>
                                    </button>
                                </div>
                                }
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

const CounterForm = ({ onSave, onCancel, counter }: {
    onSave: (data: LiveCounter | Omit<LiveCounter, 'id'>) => void,
    onCancel: () => void,
    counter: LiveCounter | null
}) => {
    const [name, setName] = useState(counter?.name || '');
    const [description, setDescription] = useState(counter?.description || '');
    const [maxItems, setMaxItems] = useState(counter?.maxItems || 1);
    const [displayRank, setDisplayRank] = useState(counter?.displayRank || 0);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { name, description, maxItems: Number(maxItems), displayRank: Number(displayRank) };
        if (counter) onSave({ ...data, id: counter.id });
        else onSave(data);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Counter Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className={inputStyle} rows={3} />
            <input type="number" placeholder="Max Items" value={maxItems} onChange={e => setMaxItems(Number(e.target.value))} required min="1" className={inputStyle} />
            <input type="number" placeholder="Display Rank" value={displayRank} onChange={e => setDisplayRank(Number(e.target.value))} className={inputStyle} />
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    );
};

const ItemForm = ({ onSave, onCancel, item, counterId }: {
    onSave: (data: LiveCounterItem | Omit<LiveCounterItem, 'id'>) => void,
    onCancel: () => void,
    item: LiveCounterItem | null,
    counterId: string
}) => {
    const [name, setName] = useState(item?.name || '');
    const [description, setDescription] = useState(item?.description || '');
    const [displayRank, setDisplayRank] = useState(item?.displayRank || 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { name, description, liveCounterId: counterId, displayRank: Number(displayRank) };
        if (item) onSave({ ...data, id: item.id });
        else onSave(data);
    };

    return (
         <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Item Name" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
            <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className={inputStyle} rows={3} />
            <input type="number" placeholder="Display Rank" value={displayRank} onChange={e => setDisplayRank(Number(e.target.value))} className={inputStyle} />
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    );
};
