import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Event, Client, Charge, Transaction, FinancialHistoryEntry, PermissionLevel } from '../../types';
import { useClients } from '../../App';
import { useAuth } from '../../contexts/AuthContext';
import { deepClone } from '../../lib/utils';
import { exportFinanceToPdf, exportFinanceSectionToPdf } from '../../lib/export';
import Modal from '../../components/Modal';
import { ChargeForm } from './ChargeForm';
import { TransactionForm } from './TransactionForm';
import { primaryButton, secondaryButton, iconButton, inputStyle, dangerButton } from '../../components/common/styles';
import { Save, ArrowLeft, FileDown, Plus, Edit, Trash2, History, FilePenLine } from 'lucide-react';

type FinanceModalState = 
    | { type: 'charge', data: Charge | null }
    | { type: 'transaction', data: Partial<Transaction> | null }
    | null;

const formatValue = (value: any, field: string) => {
    if (value === null || value === undefined || value === '') return 'N/A';
    if (field === 'amount') {
        return `₹${Number(value).toLocaleString('en-IN')}`;
    }
    if (field === 'date') {
        return new Date(value).toLocaleDateString('en-GB');
    }
    return String(value);
};


export const FinanceManager = ({ event: initialEvent, onSave, onCancel, permissionCore, permissionCharges, permissionPayments, permissionExpenses }: {
    event: Event,
    onSave: (event: Event) => void,
    onCancel: () => void,
    permissionCore: PermissionLevel,
    permissionCharges: PermissionLevel,
    permissionPayments: PermissionLevel,
    permissionExpenses: PermissionLevel,
}) => {
    const [event, setEvent] = useState(() => deepClone(initialEvent));
    const { clients } = useClients();
    const { currentUser } = useAuth();

    const [modalState, setModalState] = useState<FinanceModalState>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, type: 'charge' | 'transaction' } | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [historyLog, setHistoryLog] = useState<FinancialHistoryEntry[] | null>(null);
    const [showDeleted, setShowDeleted] = useState(false);
    const isEventLocked = event.state === 'lost' || event.state === 'cancelled';
    
    useEffect(() => {
        setEvent(deepClone(initialEvent));
    }, [initialEvent]);

    const clientName = useMemo(() => clients.find(c => c.id === event.clientId)?.name || 'N/A', [clients, event.clientId]);

    const handleFieldChange = (field: 'pax' | 'perPaxPrice' | 'rent', value: string) => {
        if(isEventLocked || permissionCore !== 'modify') return;
        setEvent(prev => ({...prev, [field]: Number(value) >= 0 ? Number(value) : 0}));
    };

    const handlePricingModelChange = (model: 'variable' | 'flat' | 'mix') => {
        if (isEventLocked || permissionCore !== 'modify') return;
        setEvent(prev => ({
            ...prev,
            pricingModel: model,
            rent: model === 'variable' ? 0 : (prev.rent || 0),
            perPaxPrice: model === 'flat' ? 0 : (prev.perPaxPrice || 0),
        }));
    };
    
    const handleCoreSave = () => {
        onSave(event);
    };
    
    const handleSaveItem = (itemData: any, reason: string) => {
        if (!currentUser) {
            alert("Error: You must be logged in to make changes.");
            return;
        }

        const historyEntry: FinancialHistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
            action: modalState?.data?.id ? 'updated' : 'created',
            reason,
            changes: []
        };
        
        const newEvent = deepClone(event);
        
        if (modalState?.type === 'charge') {
            const charges = newEvent.charges || [];
            const index = modalState.data?.id ? charges.findIndex(c => c.id === modalState.data!.id) : -1;
            
            if (index > -1) { // Update
                const existingCharge = charges[index];
                const changes: { field: string; from: any; to: any }[] = [];
                if (existingCharge.amount !== itemData.amount) changes.push({ field: 'amount', from: existingCharge.amount, to: itemData.amount });
                if (existingCharge.notes !== itemData.notes) changes.push({ field: 'notes', from: existingCharge.notes, to: itemData.notes });
                if (existingCharge.type !== itemData.type) changes.push({ field: 'type', from: existingCharge.type, to: itemData.type });
                if (changes.length > 0) historyEntry.changes = changes;
                
                charges[index] = { ...existingCharge, ...itemData, history: [...(existingCharge.history || []), historyEntry] };
            } else { // Create
                charges.push({ id: uuidv4(), ...itemData, history: [historyEntry] });
            }
            newEvent.charges = charges;

        } else if (modalState?.type === 'transaction') {
             const transactions = newEvent.transactions || [];
             const index = modalState.data?.id ? transactions.findIndex(t => t.id === modalState.data!.id) : -1;

             if(index > -1) { // Update
                const existingTx = transactions[index];
                const changes: { field: string; from: any; to: any }[] = [];
                if (existingTx.amount !== itemData.amount) changes.push({ field: 'amount', from: existingTx.amount, to: itemData.amount });
                if (new Date(existingTx.date).toISOString().split('T')[0] !== new Date(itemData.date).toISOString().split('T')[0]) changes.push({ field: 'date', from: existingTx.date, to: itemData.date });
                if (existingTx.notes !== itemData.notes) changes.push({ field: 'notes', from: existingTx.notes, to: itemData.notes });
                if (existingTx.category !== itemData.category) changes.push({ field: 'category', from: existingTx.category, to: itemData.category });
                if (existingTx.paymentMode !== itemData.paymentMode) changes.push({ field: 'paymentMode', from: existingTx.paymentMode, to: itemData.paymentMode });
                if (changes.length > 0) historyEntry.changes = changes;

                transactions[index] = { ...existingTx, ...itemData, history: [...(existingTx.history || []), historyEntry] };
             } else { // Create
                transactions.push({ id: uuidv4(), ...itemData, history: [historyEntry] });
             }
             newEvent.transactions = transactions;
        }
        
        onSave(newEvent);
        setModalState(null);
    };
    
    const requestDeleteItem = (id: string, type: 'charge' | 'transaction') => {
        if(isEventLocked) return;
        setDeleteConfirmation({ id, type });
    };
    
    const confirmDeleteItem = () => {
        if (isEventLocked || !deleteConfirmation || !deleteReason.trim() || !currentUser) {
            alert("A reason for deletion is required.");
            return;
        }

        const historyEntry: FinancialHistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
            action: 'deleted',
            reason: deleteReason,
        };
        
        const newEvent = deepClone(event);
        if (deleteConfirmation.type === 'charge') {
            const charges = (newEvent.charges || []).map(c => {
                if (c.id === deleteConfirmation.id) {
                    return { ...c, isDeleted: true, history: [...(c.history || []), historyEntry] };
                }
                return c;
            });
            newEvent.charges = charges;
        } else {
             const transactions = (newEvent.transactions || []).map(t => {
                if (t.id === deleteConfirmation.id) {
                    return { ...t, isDeleted: true, history: [...(t.history || []), historyEntry] };
                }
                return t;
            });
            newEvent.transactions = transactions;
        }
        
        onSave(newEvent);
        setDeleteConfirmation(null);
        setDeleteReason('');
    };

    const handleExportSection = (title: string, items: (Charge | Transaction)[], headers: string[], dataKeys: string[]) => {
        const activeItems = items.filter(i => !i.isDeleted);
        const data = activeItems.map(item => dataKeys.map(key => (item as any)[key]));
        exportFinanceSectionToPdf(title, headers, data, event, clientName);
    };

    const baseCost = useMemo(() => {
        const model = event.pricingModel || 'variable';
        const pax = event.pax || 0;
        const perPax = event.perPaxPrice || 0;
        const rent = event.rent || 0;
        if (model === 'variable') return pax * perPax;
        if (model === 'flat') return rent;
        if (model === 'mix') return rent + (pax * perPax);
        return 0;
    }, [event]);

    const totalCharges = (event.charges || []).filter(c => !c.isDeleted).reduce((sum, charge) => sum + charge.amount, 0);
    const totalIncome = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted).reduce((sum, p) => sum + p.amount, 0);
    const totalExpense = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted).reduce((sum, e) => sum + e.amount, 0);
    const totalBill = baseCost + totalCharges;
    const balanceDue = totalBill - totalIncome;
    const netProfit = totalBill - totalExpense;

    let modalTitle = '';
    let modalContent: React.ReactNode = null;
    if (modalState) {
        if (modalState.type === 'charge') {
            modalTitle = (modalState.data?.id ? 'Edit Charge' : 'Add Charge');
            modalContent = <ChargeForm onSave={handleSaveItem} onCancel={() => setModalState(null)} charge={modalState.data} eventPerPaxPrice={event.perPaxPrice || 0} />;
        } else if (modalState.type === 'transaction') {
            modalTitle = (modalState.data?.id ? 'Edit Transaction' : 'Add Transaction');
            modalContent = <TransactionForm onSave={handleSaveItem} onCancel={() => setModalState(null)} transaction={modalState.data} />;
        }
    }

    return (
        <div>
            {modalState && (
                <Modal isOpen={true} onClose={() => setModalState(null)} title={modalTitle}>
                    {modalContent}
                </Modal>
            )}
            {deleteConfirmation && (
                <Modal isOpen={true} onClose={() => setDeleteConfirmation(null)} title="Confirm Deletion">
                    <div>
                        <label className="block text-sm font-medium">Reason for Deletion</label>
                        <textarea
                            value={deleteReason}
                            onChange={e => setDeleteReason(e.target.value)}
                            required
                            className={inputStyle}
                            rows={3}
                            placeholder="e.g., Client cancelled this charge."
                        />
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setDeleteConfirmation(null)} className={secondaryButton}>Cancel</button>
                            <button type="button" onClick={confirmDeleteItem} className={dangerButton} disabled={!deleteReason.trim()}>Confirm Delete</button>
                        </div>
                    </div>
                </Modal>
            )}
            {historyLog && (
                <Modal isOpen={true} onClose={() => setHistoryLog(null)} title="Item History">
                    <div className="max-h-[60vh] overflow-y-auto">
                        <ul className="space-y-4">
                            {[...(historyLog || [])].reverse().map((entry, index) => (
                                <li key={index} className="p-3 bg-warm-gray-50 dark:bg-warm-gray-700/50 rounded-md">
                                    <p className="font-semibold">{entry.action.charAt(0).toUpperCase() + entry.action.slice(1)} by {entry.username}</p>
                                    <p className="text-sm text-warm-gray-500">{new Date(entry.timestamp).toLocaleString()}</p>
                                    <p className="mt-2 text-sm italic">"{entry.reason}"</p>
                                     {entry.changes && entry.changes.length > 0 && (
                                        <ul className="text-xs mt-2 pl-4 list-disc space-y-1 text-warm-gray-600 dark:text-warm-gray-400">
                                            {entry.changes.map((change, cIndex) => (
                                                <li key={cIndex}>
                                                    <span className="font-medium">{change.field.charAt(0).toUpperCase() + change.field.slice(1)}</span> changed from 
                                                    <strong className="text-warm-gray-800 dark:text-warm-gray-200"> {formatValue(change.from, change.field)} </strong> to 
                                                    <strong className="text-warm-gray-800 dark:text-warm-gray-200"> {formatValue(change.to, change.field)}</strong>.
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                         {(!historyLog || historyLog.length === 0) && <p className="text-center text-warm-gray-500">No history found.</p>}
                    </div>
                </Modal>
            )}
             <div className="flex justify-between items-center pb-4 border-b mb-6">
                <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                    Finances for: <span className="text-primary-600">{event.eventType}</span>
                </h2>
                <div className="flex items-center gap-2">
                     <button onClick={onCancel} className={secondaryButton}><ArrowLeft size={16}/> Back</button>
                </div>
            </div>
            
            <div className="flex justify-end mb-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={showDeleted}
                        onChange={(e) => setShowDeleted(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Show Deleted Items
                </label>
            </div>

            <div className="flex flex-col lg:flex-row flex-wrap gap-6">
                 {/* Main Inputs & Summary Column */}
                {(permissionCore !== 'none') && (
                    <div className="w-full lg:w-[380px] flex-shrink-0 space-y-6">
                        <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                            <h3 className="font-bold text-lg mb-4">Core Figures</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium">Pricing Model</label>
                                    <select value={event.pricingModel || 'variable'} onChange={e => handlePricingModelChange(e.target.value as any)} className={inputStyle} disabled={isEventLocked || permissionCore !== 'modify'}>
                                        <option value="variable">Variable (Per Pax)</option>
                                        <option value="flat">Flat Rent</option>
                                        <option value="mix">Mix (Rent + Per Pax)</option>
                                    </select>
                                </div>
                                
                                {(event.pricingModel === 'variable' || event.pricingModel === 'mix') && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium">Guest Count (PAX)</label>
                                            <input type="number" value={event.pax || ''} onChange={e => handleFieldChange('pax', e.target.value)} className={inputStyle} disabled={isEventLocked || permissionCore !== 'modify'}/>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium">Price Per Pax (₹)</label>
                                            <input type="number" value={event.perPaxPrice || ''} onChange={e => handleFieldChange('perPaxPrice', e.target.value)} className={inputStyle} disabled={isEventLocked || permissionCore !== 'modify'} />
                                        </div>
                                    </>
                                )}

                                {(event.pricingModel === 'flat' || event.pricingModel === 'mix') && (
                                    <div>
                                        <label className="block text-sm font-medium">Flat Rent (₹)</label>
                                        <input type="number" value={event.rent || ''} onChange={e => handleFieldChange('rent', e.target.value)} className={inputStyle} disabled={isEventLocked || permissionCore !== 'modify'} />
                                    </div>
                                )}
                            </div>
                            {permissionCore === 'modify' && <button type="button" onClick={handleCoreSave} className={`${primaryButton} w-full mt-4`} disabled={isEventLocked}><Save size={18}/> Save Core Figures</button>}
                        </div>
                        
                        <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                            <h3 className="font-bold text-lg mb-4">Financial Summary</h3>
                            <div className="space-y-2 text-sm">
                                <SummaryRow label="Base Cost" value={baseCost} />
                                <SummaryRow label="Additional Charges" value={totalCharges} />
                                <SummaryRow label="Total Bill" value={totalBill} isBold={true}/>
                                <hr className="my-2 border-warm-gray-200 dark:border-warm-gray-600"/>
                                <SummaryRow label="Total Income" value={totalIncome} color="text-green-600 dark:text-green-400"/>
                                <SummaryRow label="Total Expense" value={-totalExpense} color="text-red-600 dark:text-red-400"/>
                                <hr className="my-2 border-warm-gray-200 dark:border-warm-gray-600"/>
                                <SummaryRow label="Balance Due" value={balanceDue} isBold={true} />
                                <SummaryRow label="Net Profit" value={netProfit} isBold={true} color={netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}/>
                            </div>
                            <button onClick={() => exportFinanceToPdf(event, clientName)} className={`${secondaryButton} w-full mt-4`}><FileDown size={16}/> Export PDF Summary</button>
                        </div>
                    </div>
                 )}

                {/* Tables Column */}
                {(permissionCharges !== 'none' || permissionPayments !== 'none' || permissionExpenses !== 'none') && (
                    <div className="flex-1 min-w-[300px] space-y-6">
                        {permissionCharges !== 'none' && <FinanceTable title="Additional Charges" items={event.charges || []} onAdd={() => setModalState({type: 'charge', data: null})} onEdit={(item) => setModalState({type: 'charge', data: item})} onDelete={(id) => requestDeleteItem(id, 'charge')} onViewHistory={(h) => setHistoryLog(h)} headers={['Type', 'Amount', 'Notes']} dataKeys={['type', 'amount', 'notes']} canModify={permissionCharges === 'modify' && !isEventLocked} showDeleted={showDeleted} />}
                        {permissionPayments !== 'none' && <FinanceTable title="Payments" items={(event.transactions || []).filter(t=>t.type==='income')} onAdd={() => setModalState({type: 'transaction', data: {type: 'income'}})} onEdit={(item) => setModalState({type: 'transaction', data: item})} onDelete={(id) => requestDeleteItem(id, 'transaction')} onViewHistory={(h) => setHistoryLog(h)} headers={['Date', 'Mode', 'Notes', 'Amount']} dataKeys={['date', 'paymentMode', 'notes', 'amount']} canModify={permissionPayments === 'modify' && !isEventLocked} showDeleted={showDeleted} onExport={() => handleExportSection('Payments', (event.transactions || []).filter(t => t.type === 'income'), ['Date', 'Mode', 'Notes', 'Amount'], ['date', 'paymentMode', 'notes', 'amount'])} />}
                        {permissionExpenses !== 'none' && <FinanceTable title="Expenses" items={(event.transactions || []).filter(t=>t.type==='expense')} onAdd={() => setModalState({type: 'transaction', data: {type: 'expense'}})} onEdit={(item) => setModalState({type: 'transaction', data: item})} onDelete={(id) => requestDeleteItem(id, 'transaction')} onViewHistory={(h) => setHistoryLog(h)} headers={['Date', 'Category', 'Notes', 'Amount']} dataKeys={['date', 'category', 'notes', 'amount']} canModify={permissionExpenses === 'modify' && !isEventLocked} showDeleted={showDeleted} onExport={() => handleExportSection('Expenses', (event.transactions || []).filter(t => t.type === 'expense'), ['Date', 'Category', 'Notes', 'Amount'], ['date', 'category', 'notes', 'amount'])} />}
                    </div>
                )}
            </div>
        </div>
    );
};

const SummaryRow = ({ label, value, isBold=false, color='' }: {label: string, value: number, isBold?: boolean, color?: string}) => (
    <div className={`flex justify-between items-center ${isBold ? 'font-bold' : ''} ${color}`}>
        <span>{label}</span>
        <span>₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
);

const FinanceTable = ({ title, items, onAdd, onEdit, onDelete, onViewHistory, headers, dataKeys, canModify, showDeleted, onExport }: {title:string, items: any[], onAdd: ()=>void, onEdit: (item:any)=>void, onDelete: (id:string)=>void, onViewHistory: (h: FinancialHistoryEntry[]) => void, headers: string[], dataKeys: string[], canModify: boolean, showDeleted: boolean, onExport?: () => void}) => {
    
    const itemsToDisplay = useMemo(() => {
        const filtered = showDeleted ? items : items.filter(i => !i.isDeleted);
        // Transactions have a 'date' field, Charges do not. Sort if possible.
        if (filtered.length > 0 && 'date' in filtered[0]) {
             return filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        return filtered;
    }, [items, showDeleted]);

    return (
        <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">{title}</h3>
                <div className="flex items-center gap-2">
                    {onExport && <button onClick={onExport} className={secondaryButton}><FileDown size={16}/> PDF</button>}
                    {canModify && <button onClick={onAdd} className={secondaryButton}><Plus size={16}/> Add</button>}
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-warm-gray-200 dark:border-warm-gray-700">
                            {headers.map(h => <th key={h} className="px-2 py-2 text-left font-semibold">{h}</th>)}
                            <th className="px-2 py-2 text-right font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-gray-100 dark:divide-warm-gray-700/50">
                        {itemsToDisplay.length === 0 ? (
                            <tr><td colSpan={headers.length + 1} className="text-center py-4 text-warm-gray-500">No {title.toLowerCase()} yet.</td></tr>
                        ) : (
                            itemsToDisplay.map(item => {
                                const hasHistory = item.history && item.history.length > 0;
                                const isModified = item.history && item.history.length > 1;

                                return (
                                <tr key={item.id} className={item.isDeleted ? 'opacity-50 text-warm-gray-500 line-through' : ''}>
                                    {dataKeys.map((key) => {
                                        let cellContent;
                                        if (title === 'Additional Charges' && item.type === 'Additional PAX' && key === 'notes') {
                                            cellContent = (
                                                <div>
                                                    <span className="font-semibold">{item.notes}</span>
                                                    <div className="text-xs text-warm-gray-500">
                                                        {item.additionalPaxCount || 0} PAX - ₹{(item.discountAmount || 0).toLocaleString('en-IN')} Discount
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            cellContent = (
                                                <span>
                                                    {key === 'amount' ? `₹${item[key].toLocaleString('en-IN')}` : key === 'date' ? new Date(item[key]).toLocaleDateString('en-GB') : item[key]}
                                                </span>
                                            );
                                        }

                                        return (
                                            <td key={key} className="px-2 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {key === dataKeys[0] && isModified && (
                                                        <span title="This item has been modified.">
                                                            <FilePenLine size={14} className="text-amber-500"/>
                                                        </span>
                                                    )}
                                                    {cellContent}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="px-2 py-2 text-right">
                                        <div className="flex justify-end gap-1">
                                            {hasHistory && <button onClick={() => onViewHistory(item.history || [])} className={iconButton('hover:bg-blue-100 dark:hover:bg-blue-800')} title="View History"><History size={14} className="text-blue-600"/></button>}
                                            {canModify && <button onClick={() => onEdit(item)} className={iconButton('hover:bg-primary-100')} disabled={item.isDeleted}><Edit size={14} className="text-primary-600"/></button>}
                                            {canModify && <button onClick={() => onDelete(item.id)} className={iconButton('hover:bg-accent-100')} disabled={item.isDeleted}><Trash2 size={14} className="text-accent-500"/></button>}
                                        </div>
                                    </td>
                                </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}