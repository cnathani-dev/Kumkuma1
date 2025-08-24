import React, { useState, useEffect, useMemo } from 'react';
import { Charge } from '../../types';
import { useChargeTypes, useLiveCounters, useTemplates } from '../../contexts/AppContexts';
import { inputStyle, primaryButton, secondaryButton } from '../../components/common/styles';

export const ChargeForm = ({ onSave, onCancel, charge, eventPerPaxPrice, eventPax }: {
    onSave: (data: Partial<Charge>, reason: string) => void,
    onCancel: () => void,
    charge: Charge | null,
    eventPerPaxPrice: number,
    eventPax: number,
}) => {
    const { settings: chargeTypes } = useChargeTypes();
    const { liveCounters } = useLiveCounters();
    const { templates } = useTemplates();

    const isEditing = !!charge;
    const [type, setType] = useState(charge?.type || '');
    const [price, setPrice] = useState(charge?.price ?? 0);
    const [discountAmount, setDiscountAmount] = useState(charge?.discountAmount || 0);
    const [amount, setAmount] = useState(charge?.amount || 0);
    const [notes, setNotes] = useState(charge?.notes || '');
    const [reason, setReason] = useState('');
    
    // Special fields
    const [liveCounterId, setLiveCounterId] = useState(charge?.liveCounterId || '');
    const [menuTemplateId, setMenuTemplateId] = useState(charge?.menuTemplateId || '');
    const [cocktailPax, setCocktailPax] = useState(charge?.cocktailPax || 0);
    const [corkageCharges, setCorkageCharges] = useState(charge?.corkageCharges || 0);
    const [additionalPaxCount, setAdditionalPaxCount] = useState(charge?.additionalPaxCount || 0);

    const specialChargeTypes = useMemo(() => ['Live Counter', 'Cocktail Menu', 'Hi-Tea Menu', 'Additional PAX'], []);
    
    const allChargeTypes = useMemo(() => {
        return ['Live Counter', 'Cocktail Menu', 'Hi-Tea Menu', ...chargeTypes.map(c => c.name)].sort();
    }, [chargeTypes]);

    const cocktailTemplates = useMemo(() => templates.filter(t => t.isCocktailTemplate), [templates]);
    const hiTeaTemplates = useMemo(() => templates.filter(t => t.isHiTeaTemplate), [templates]);

    useEffect(() => {
        if (specialChargeTypes.includes(type)) {
            let calculatedAmount = 0;

            if (type === 'Cocktail Menu') {
                calculatedAmount = ((price || 0) * (cocktailPax || 0)) - (discountAmount || 0) + (corkageCharges || 0);
            } else if (type === 'Live Counter') {
                calculatedAmount = ((price || 0) * (eventPax || 0)) - (discountAmount || 0);
            } else if (type === 'Additional PAX') {
                calculatedAmount = (additionalPaxCount * (eventPerPaxPrice || 0)) - (discountAmount || 0);
            } else { // Hi-Tea Menu
                calculatedAmount = (price || 0) - (discountAmount || 0);
            }

            setAmount(calculatedAmount > 0 ? calculatedAmount : 0);
        }
    }, [type, price, discountAmount, corkageCharges, cocktailPax, eventPax, additionalPaxCount, eventPerPaxPrice, specialChargeTypes]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isEditing && !reason.trim()) {
            alert('A reason for this update is required.');
            return;
        }

        const data: Partial<Charge> = { 
            notes, 
            type,
            amount, 
            price: specialChargeTypes.includes(type) ? price : undefined,
            discountAmount: specialChargeTypes.includes(type) ? discountAmount : undefined,
            liveCounterId: type === 'Live Counter' ? liveCounterId : undefined,
            menuTemplateId: type === 'Cocktail Menu' || type === 'Hi-Tea Menu' ? menuTemplateId : undefined,
            cocktailPax: type === 'Cocktail Menu' ? cocktailPax : undefined,
            corkageCharges: type === 'Cocktail Menu' ? corkageCharges : undefined,
            additionalPaxCount: type === 'Additional PAX' ? additionalPaxCount : undefined,
        };
        onSave(data, isEditing ? reason : 'Initial creation');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">Charge Type</label>
                <select value={type} onChange={e => setType(e.target.value)} required className={inputStyle}>
                    <option value="" disabled>-- Select Type --</option>
                    {allChargeTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
            </div>
            
            {!specialChargeTypes.includes(type) && (
                <div>
                    <label className="block text-sm font-medium">Amount (₹)</label>
                    <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} required min="0.01" step="0.01" className={inputStyle}/>
                </div>
            )}

            {type === 'Live Counter' && (
                <>
                    <div>
                        <label className="block text-sm font-medium">Select Live Counter</label>
                        <select value={liveCounterId} onChange={e => setLiveCounterId(e.target.value)} required className={inputStyle}>
                            <option value="">-- Select Counter --</option>
                            {liveCounters.map(lc => <option key={lc.id} value={lc.id}>{lc.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Price per PAX (₹)</label><input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required min="0" className={inputStyle} /></div>
                        <div><label className="block text-sm font-medium">Total Discount (₹)</label><input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} min="0" className={inputStyle} /></div>
                    </div>
                    <div className="p-2 bg-warm-gray-100 dark:bg-warm-gray-700/50 rounded-md text-sm">
                        Calculation: (₹{price || 0} Price × {eventPax} PAX) - ₹{discountAmount || 0} Discount = <span className="font-bold">₹{amount.toLocaleString('en-IN')}</span>
                    </div>
                </>
            )}

            {type === 'Cocktail Menu' && (
                <>
                    <div>
                        <label className="block text-sm font-medium">Select Cocktail Template</label>
                        <select value={menuTemplateId} onChange={e => setMenuTemplateId(e.target.value)} required className={inputStyle}>
                             <option value="">-- Select Template --</option>
                             {cocktailTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Price per PAX (₹)</label><input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required min="0" className={inputStyle} /></div>
                        <div><label className="block text-sm font-medium">Total Discount (₹)</label><input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} min="0" className={inputStyle} /></div>
                        <div><label className="block text-sm font-medium">Cocktail PAX</label><input type="number" value={cocktailPax} onChange={e => setCocktailPax(Number(e.target.value))} required min="0" className={inputStyle} /></div>
                        <div><label className="block text-sm font-medium">Corkage Charges (₹)</label><input type="number" value={corkageCharges} onChange={e => setCorkageCharges(Number(e.target.value))} min="0" className={inputStyle} /></div>
                    </div>
                    <div className="p-2 bg-warm-gray-100 dark:bg-warm-gray-700/50 rounded-md text-sm">
                        Calculation: (₹{price || 0} Price × {cocktailPax} PAX) - ₹{discountAmount || 0} Discount + ₹{corkageCharges || 0} Corkage = <span className="font-bold">₹{amount.toLocaleString('en-IN')}</span>
                    </div>
                </>
            )}

            {type === 'Hi-Tea Menu' && (
                <>
                    <div>
                        <label className="block text-sm font-medium">Select Hi-Tea Template</label>
                        <select value={menuTemplateId} onChange={e => setMenuTemplateId(e.target.value)} required className={inputStyle}>
                             <option value="">-- Select Template --</option>
                             {hiTeaTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Price (₹)</label><input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required min="0" className={inputStyle} /></div>
                        <div><label className="block text-sm font-medium">Discount (₹)</label><input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} min="0" className={inputStyle} /></div>
                    </div>
                </>
            )}

            {type === 'Additional PAX' && (
                 <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">Additional PAX Count</label><input type="number" value={additionalPaxCount} onChange={e => setAdditionalPaxCount(Number(e.target.value))} required min="0" className={inputStyle} /></div>
                        <div><label className="block text-sm font-medium">Discount (₹)</label><input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} required min="0" className={inputStyle} /></div>
                    </div>
                    <div><label className="block text-sm font-medium">Calculated Charge Amount (₹)</label><input type="number" value={amount} readOnly className={inputStyle + " bg-warm-gray-100 dark:bg-warm-gray-700"} /></div>
                </>
            )}

             <div>
                <label className="block text-sm font-medium">Notes</label>
                <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    className={inputStyle} 
                    rows={2}
                />
            </div>

            {isEditing && (
                <div>
                    <label className="block text-sm font-medium">Reason for Update</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} required className={inputStyle} rows={2}/>
                </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}>Save</button>
            </div>
        </form>
    )
}