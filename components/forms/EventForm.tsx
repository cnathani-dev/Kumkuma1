

import React, { useState, useMemo } from 'react';
import { Event, EventSession, EventState, MenuTemplate, LocationSetting, MenuSelectionStatus } from '../../types';
import { useTemplates, useLocations, useEventTypes, useMuhurthamDates } from '../../contexts/AppContexts';
import { inputStyle, primaryButton, secondaryButton } from '../common/styles';
import { Save } from 'lucide-react';
import { dateToYYYYMMDD } from '../../lib/utils';

export const EventForm = ({ onSave, onCancel, event, clientId, isReadOnly }: {
    onSave: (event: Omit<Event, 'id'> | Event) => void;
    onCancel: () => void;
    event: Event | null;
    clientId: string;
    isReadOnly: boolean;
}) => {
    const { templates } = useTemplates();
    const { locations } = useLocations();
    const { settings: eventTypes } = useEventTypes();
    const { muhurthamDates } = useMuhurthamDates();

    const [eventType, setEventType] = useState(event?.eventType || '');
    const [startDate, setStartDate] = useState(event?.startDate || '');
    const [endDate, setEndDate] = useState(event?.endDate || '');
    const [location, setLocation] = useState(event?.location || '');
    const [address, setAddress] = useState(event?.address || '');
    const [session, setSession] = useState<EventSession>(event?.session || 'dinner');
    const [templateId, setTemplateId] = useState(event?.templateId || '');
    const [pricingModel, setPricingModel] = useState<'variable' | 'flat' | 'mix'>(event?.pricingModel || 'variable');
    const [rent, setRent] = useState(event?.rent || 0);
    const [pax, setPax] = useState(event?.pax || 0);
    const [notes, setNotes] = useState(event?.notes || '');
    
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const minDate = dateToYYYYMMDD(fifteenDaysAgo);

    const groupedTemplates = useMemo(() => {
        const groups: Record<string, MenuTemplate[]> = {};
        templates.forEach(template => {
            const groupName = template.group || 'Uncategorized';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(template);
        });
        Object.values(groups).forEach(group => group.sort((a, b) => a.name.localeCompare(b.name)));
        return groups;
    }, [templates]);

    const muhurthamDatesSet = useMemo(() => new Set(muhurthamDates.map(d => d.date)), [muhurthamDates]);

    const sortedGroupNames = useMemo(() => Object.keys(groupedTemplates).sort(), [groupedTemplates]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(isReadOnly) return;
        
        if(!eventType || !startDate || !location) {
            alert("Please fill out Event Type, Start Date, and Location fields.");
            return;
        }

        if (endDate && endDate < startDate) {
            alert("End date cannot be before start date.");
            return;
        }
        
        const baseData = {
            eventType,
            startDate: startDate,
            endDate: endDate || undefined,
            location,
            address: location === 'ODC' ? address : '',
            session,
            templateId: templateId || undefined, // Set to undefined if empty string
            clientId,
            pricingModel,
            rent: (pricingModel === 'flat' || pricingModel === 'mix') ? rent : 0,
            perPaxPrice: (pricingModel === 'variable' || pricingModel === 'mix') ? (event?.perPaxPrice || 0) : 0,
            pax,
            notes: notes,
        };

        if(event) { // This is an update
            const dataToUpdate: Partial<Event> = { ...baseData, state: event.state };
            onSave({ ...event, ...dataToUpdate });
        } else { // This is a create
            const newEventData: Omit<Event, 'id'> = {
                ...baseData,
                itemIds: {},
                createdAt: new Date().toISOString(),
                state: 'lead',
                status: 'draft',
                liveCounters: {},
                transactions: [],
                charges: [],
            };
            onSave(newEventData);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Event Type</label>
                    <select value={eventType} onChange={e => setEventType(e.target.value)} required className={inputStyle} disabled={isReadOnly}>
                        <option value="" disabled>-- Select Type --</option>
                        {eventTypes.map(et => <option key={et.id} value={et.name}>{et.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium">Session</label>
                    <select value={session} onChange={e => setSession(e.target.value as EventSession)} required className={inputStyle} disabled={isReadOnly}>
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                        <option value="all-day">All-Day</option>
                    </select>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={inputStyle} min={minDate} readOnly={isReadOnly} />
                    {muhurthamDatesSet.has(startDate) && (
                        <p className="text-xs text-amber-600 mt-1">🌟 This is a Muhurtham date (high demand)</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium">End Date (Optional)</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputStyle} min={startDate} readOnly={isReadOnly} />
                    {endDate && muhurthamDatesSet.has(endDate) && (
                         <p className="text-xs text-amber-600 mt-1">🌟 This is a Muhurtham date (high demand)</p>
                    )}
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Location</label>
                    <select value={location} onChange={e => setLocation(e.target.value)} required className={inputStyle} disabled={isReadOnly}>
                        <option value="" disabled>Select a location</option>
                        {locations.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity)).map(loc => <option key={loc.id} value={loc.name}>{loc.name === 'ODC' ? 'ODC (Outdoor Catering)' : loc.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium">PAX Count</label>
                    <input type="number" value={pax} onChange={e => setPax(Number(e.target.value))} min="0" className={inputStyle} readOnly={isReadOnly}/>
                </div>
            </div>
            {location === 'ODC' && (
                 <div>
                    <label className="block text-sm font-medium">Address for ODC</label>
                    <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} required className={inputStyle} readOnly={isReadOnly} />
                </div>
            )}
             <div>
                <label className="block text-sm font-medium">Notes / Special Instructions</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputStyle} readOnly={isReadOnly}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium">Menu Template</label>
                    <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={inputStyle} disabled={isReadOnly}>
                        <option value="">-- No Template (Custom Menu) --</option>
                        <option value="NO_FOOD">-- No Food Event --</option>
                        {sortedGroupNames.map(groupName => (
                            <optgroup key={groupName} label={groupName.toUpperCase()}>
                                {groupedTemplates[groupName].map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Pricing Model</label>
                    <select value={pricingModel} onChange={e => setPricingModel(e.target.value as 'variable' | 'flat' | 'mix')} required className={inputStyle} disabled={isReadOnly}>
                        <option value="variable">Variable (Per Pax)</option>
                        <option value="flat">Flat Rent</option>
                        <option value="mix">Mix (Rent + Per Pax)</option>
                    </select>
                </div>
            </div>
            {(pricingModel === 'flat' || pricingModel === 'mix') && (
                <div>
                    <label className="block text-sm font-medium">Flat Rent (₹)</label>
                    <input type="number" value={rent} onChange={e => setRent(Number(e.target.value))} required className={inputStyle} readOnly={isReadOnly} />
                </div>
            )}
             <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                {!isReadOnly && <button type="submit" className={primaryButton}><Save size={18}/> Save Event</button>}
            </div>
        </form>
    );
};