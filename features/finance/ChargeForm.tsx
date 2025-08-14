import React, { useState, useEffect } from 'react';
import { Charge } from '../../types';
import { useChargeTypes } from '../../App';
import { inputStyle, primaryButton, secondaryButton } from '../../components/common/styles';

export const ChargeForm = ({ onSave, onCancel, charge, eventPerPaxPrice }: {
    onSave: (data: Partial<Charge>, reason: string) => void,
    onCancel: () => void,
    charge: Charge | null,
    eventPerPaxPrice: number,
}) => {
    const { settings: chargeTypes } = useChargeTypes();
    const [notes, setNotes] = useState(charge?.notes || '');
    const [amount, setAmount] = useState(charge?.amount || 0);
    const [type, setType] = useState(charge?.type || '');
    const [reason, setReason] = useState('');
    const [additionalPaxCount, setAdditionalPaxCount] = useState(charge?.additionalPaxCount || 0);
    const [discountAmount, setDiscountAmount] = useState(charge?.discountAmount || 0);
    const isEditing = !!charge;

    useEffect(() => {
        if (type === 'Additional PAX') {
            const calculatedAmount = (additionalPaxCount * (eventPerPaxPrice || 0)) - discountAmount;
            setAmount(calculatedAmount > 0 ? calculatedAmount : 0);
        }
    }, [type, additionalPaxCount, discountAmount, eventPerPaxPrice]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (type === 'Additional PAX' && discountAmount > 0 && !notes.trim()) {
            alert('Notes are required when a discount is applied.');
            return;
        }

        if (amount < 0) {
            alert('A positive amount is required.');
            return;
        }

        if (isEditing && !reason.trim()) {
            alert('A reason for this update is required.');
            return;
        }

        const data: Partial<Charge> = { 
            notes: notes, 
            amount, 
            type,
            additionalPaxCount: type === 'Additional PAX' ? additionalPaxCount : undefined,
            discountAmount: type === 'Additional PAX' ? discountAmount : undefined,
        };
        onSave(data, isEditing ? reason : 'Initial creation');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">Charge Type</label>
                <select value={type} onChange={e => setType(e.target.value)} required className={inputStyle}>
                    <option value="" disabled>-- Select Type --</option>
                    {chargeTypes.slice().sort((a,b) => a.name.localeCompare(b.name)).map(ct => <option key={ct.id} value={ct.name}>{ct.name}</option>)}
                </select>
            </div>

            {type === 'Additional PAX' ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Additional PAX Count</label>
                            <input type="number" value={additionalPaxCount} onChange={e => setAdditionalPaxCount(Number(e.target.value))} required min="0" className={inputStyle} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Discount (₹)</label>
                            <input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} required min="0" className={inputStyle} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Calculated Charge Amount (₹)</label>
                        <input type="number" value={amount} readOnly className={inputStyle + " bg-warm-gray-100 dark:bg-warm-gray-700"} />
                    </div>
                </>
            ) : (
                <div>
                    <label className="block text-sm font-medium">Amount (₹)</label>
                    <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} required min="0.01" step="0.01" className={inputStyle}/>
                </div>
            )}
            
             <div>
                <label className="block text-sm font-medium">Notes</label>
                <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    required={type === 'Additional PAX' && discountAmount > 0}
                    className={inputStyle} 
                    rows={2}
                    placeholder={type === 'Additional PAX' && discountAmount > 0 ? "Notes required for discount" : "Optional notes"}
                />
            </div>

            {isEditing && (
                <div>
                    <label className="block text-sm font-medium">Reason for Update</label>
                    <textarea 
                        value={reason} 
                        onChange={e => setReason(e.target.value)} 
                        required 
                        className={inputStyle} 
                        rows={2}
                        placeholder="e.g., Added transportation charge as per client request."
                    />
                </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}>Save</button>
            </div>
        </form>
    )
}