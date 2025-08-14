
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from '../../types';
import { useExpenseTypes, usePaymentModes } from '../../App';
import { inputStyle, primaryButton, secondaryButton } from '../../components/common/styles';
import { dateToYYYYMMDD } from '../../lib/utils';

export const TransactionForm = ({ onSave, onCancel, transaction }: {
    onSave: (t: Omit<Transaction, 'id' | 'history' | 'isDeleted'>, reason: string) => void,
    onCancel: () => void,
    transaction: Partial<Transaction> | null,
}) => {
    const [type] = useState(transaction?.type || 'income');
    const [date, setDate] = useState(transaction?.date || dateToYYYYMMDD(new Date()));
    const [amount, setAmount] = useState(transaction?.amount || 0);
    const [notes, setNotes] = useState(transaction?.notes || '');
    const [category, setCategory] = useState(transaction?.category || '');
    const [paymentMode, setPaymentMode] = useState(transaction?.paymentMode || '');
    const [reason, setReason] = useState('');
    const isEditing = !!transaction?.id;

    const { settings: expenseTypes } = useExpenseTypes();
    const { settings: paymentModes } = usePaymentModes();

    useEffect(() => {
        if (type === 'expense' && !category && expenseTypes.length > 0) {
            setCategory(expenseTypes[0].name);
        } else if (type === 'income' && !paymentMode && paymentModes.length > 0) {
            setPaymentMode(paymentModes[0].name);
        }
    }, [type, category, paymentMode, expenseTypes, paymentModes]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) {
            alert('Amount must be positive.');
            return;
        }
        if(type === 'expense' && !category) {
            alert('Please select an expense category.');
            return;
        }
        if(type === 'income' && !paymentMode) {
            alert('Please select a payment mode.');
            return;
        }
        if (isEditing && !reason.trim()) {
            alert('A reason for this update is required.');
            return;
        }

        const data = {
            type,
            date: date,
            amount,
            notes,
            ...((type === 'expense' ? { category } : {category: undefined})),
            ...((type === 'income' ? { paymentMode } : {paymentMode: undefined})),
        };
        onSave(data, isEditing ? reason : 'Initial creation');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={inputStyle}/>
                </div>
                <div>
                     <label className="block text-sm font-medium">Amount (₹)</label>
                    <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} required min="0.01" step="0.01" className={inputStyle}/>
                </div>
            </div>
             <div>
                 {type === 'income' ? (
                     <div>
                        <label className="block text-sm font-medium">Payment Mode</label>
                        <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} required className={inputStyle}>
                            <option value="" disabled>Select mode...</option>
                             {paymentModes.slice().sort((a,b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                    </div>
                 ) : (
                     <div>
                        <label className="block text-sm font-medium">Expense Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} required className={inputStyle}>
                             <option value="" disabled>Select category...</option>
                             {expenseTypes.slice().sort((a,b) => a.name.localeCompare(b.name)).map(et => <option key={et.id} value={et.name}>{et.name}</option>)}
                        </select>
                    </div>
                 )}
            </div>
             <div>
                <label className="block text-sm font-medium">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputStyle} rows={2}/>
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
                        placeholder="e.g., Received advance payment via UPI."
                    />
                </div>
            )}
             <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}>Save Transaction</button>
            </div>
        </form>
    );
}
