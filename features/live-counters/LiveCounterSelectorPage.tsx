




import React, { useState } from 'react';
import { Event } from '../../types';
import { useLiveCounters, useLiveCounterItems } from '../../contexts/AppContexts';
import { primaryButton, secondaryButton } from '../../components/common/styles';
import { Save, ArrowLeft } from 'lucide-react';

export const LiveCounterSelectorPage = ({ event, onSave, onCancel, canModify }: {
    event: Event;
    onSave: (event: Event, updatedCounters: Record<string, string[]>) => void;
    onCancel: () => void;
    canModify: boolean;
}) => {
    const { liveCounters } = useLiveCounters();
    const { liveCounterItems } = useLiveCounterItems();
    const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>(event.liveCounters || {});
    const isLocked = !canModify || event.state === 'lost' || event.state === 'cancelled';

    const handleToggleItem = (counterId: string, itemId: string) => {
        if (isLocked) return;
        const currentCounterItems = selectedItems[counterId] || [];
        const isSelected = currentCounterItems.includes(itemId);
        const counter = liveCounters.find(c => c.id === counterId);

        if (isSelected) {
            const newItems = currentCounterItems.filter(id => id !== itemId);
            setSelectedItems(prev => ({ ...prev, [counterId]: newItems }));
        } else {
            if (counter && currentCounterItems.length >= counter.maxItems) {
                alert(`You can only select up to ${counter.maxItems} items for ${counter.name}.`);
                return;
            }
            const newItems = [...currentCounterItems, itemId];
            setSelectedItems(prev => ({ ...prev, [counterId]: newItems }));
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLocked) {
            onSave(event, selectedItems);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
             <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700 mb-6">
                <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                    Live Counters for: <span className="text-primary-600">{event.eventType}</span>
                </h2>
                <div className="flex items-center gap-2">
                     <button type="button" onClick={onCancel} className={secondaryButton}>
                        <ArrowLeft size={16}/> Back
                    </button>
                    {!isLocked && 
                        <button type="submit" className={primaryButton}>
                            <Save size={18} /> Save Counters
                        </button>
                    }
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {liveCounters.sort((a,b)=>(a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)).map(counter => (
                    <div key={counter.id} className="p-4 rounded-lg bg-white dark:bg-warm-gray-800 shadow-md">
                        <h3 className="font-bold text-lg">{counter.name} <span className="text-sm font-normal text-warm-gray-500">(select up to {counter.maxItems})</span></h3>
                        <div className="mt-2 space-y-2">
                           {liveCounterItems.filter(i => i.liveCounterId === counter.id).sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)).map(item => (
                               <label key={item.id} className={`flex items-center gap-2 p-2 rounded-md ${!isLocked ? 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30' : 'opacity-70'}`}>
                                   <input
                                        type="checkbox"
                                        checked={(selectedItems[counter.id] || []).includes(item.id)}
                                        onChange={() => handleToggleItem(counter.id, item.id)}
                                        disabled={isLocked}
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                   />
                                   <div>
                                     <p>{item.name}</p>
                                     {item.description && <p className="text-xs text-warm-gray-500">{item.description}</p>}
                                   </div>
                               </label>
                           ))}
                        </div>
                    </div>
                ))}
            </div>
        </form>
    );
};
