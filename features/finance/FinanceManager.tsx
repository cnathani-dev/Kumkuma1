import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Event, Client, Charge, Transaction, FinancialHistoryEntry, PermissionLevel } from '../../types';
import { useClients, useLiveCounters, useTemplates } from '../../contexts/AppContexts';
import { useAuth } from '../../contexts/AuthContext';
import { deepClone, formatDateRange } from '../../lib/utils';
import { exportFinanceToPdf, exportFinanceSectionToPdf } from '../../lib/export';
import Modal from '../../components/Modal';
import { ChargeForm } from './ChargeForm';
import { TransactionForm } from './TransactionForm';
import { primaryButton, secondaryButton, iconButton, inputStyle, dangerButton } from '../../components/common/styles';
import { Save, ArrowLeft, FileDown, Plus, Edit, Trash2, History, FilePenLine, Users } from 'lucide-react';

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
    const { liveCounters } = useLiveCounters();
    const { templates } = useTemplates();

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
    const liveCounterMap = useMemo(() => new Map(liveCounters.map(lc => [lc.id, lc])), [liveCounters]);
    const templateMap = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);

    const handleFieldChange = (field: 'perPaxPrice' | 'rent', value: string) => {
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
        
        const isUpdate = !!modalState?.data?.id;

        const reasonForCreation = modalState?.type === 'charge' 
            ? `Charge Added: ${itemData.type}`
            : `Transaction Added: ${itemData.type === 'income' ? 'Payment' : 'Expense'}`;

        const historyEntry: FinancialHistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
            action: isUpdate ? 'updated' : 'created',
            reason: isUpdate ? reason : reasonForCreation,
            changes: []
        };
        
        const newEvent = deepClone(event);
        
        if (modalState?.type === 'charge') {
            const charges = newEvent.charges || [];
            const index = isUpdate ? charges.findIndex(c => c.id === modalState.data!.id) : -1;
            
            if (index > -1) { // Update
                const existingCharge = charges[index];
                const changes: { field: string; from: any; to: any }[] = [];
                if (existingCharge.amount !== itemData.amount) changes.push({ field: 'amount', from: existingCharge.amount, to: itemData.amount });
                if (existingCharge.notes !== itemData.notes) changes.push({ field: 'notes', from: existingCharge.notes, to: itemData.notes });
                if (existingCharge.type !== itemData.type) changes.push({ field: 'type', from: existingCharge.type, to: itemData.type });
                if (changes.length > 0) historyEntry.changes = changes;

                if (
                    (itemData.type === 'Cocktail Menu' || itemData.type === 'Hi-Tea Menu') &&
                    itemData.menuTemplateId !== existingCharge.menuTemplateId
                ) {
                    if (itemData.type === 'Cocktail Menu') {
                        newEvent.cocktailMenuItems = {};
                    } else { // Hi-Tea Menu
                        newEvent.hiTeaMenuItems = {};
                    }
                }
                
                charges[index] = { ...existingCharge, ...itemData, history: [...(existingCharge.history || []), historyEntry] };
            } else { // Create
                charges.push({ id: uuidv4(), ...itemData, history: [historyEntry] });
            }
            newEvent.charges = charges;

        } else if (modalState?.type === 'transaction') {
             const transactions = newEvent.transactions || [];
             const index = isUpdate ? transactions.findIndex(t => t.id === modalState.data!.id) : -1;

             if (index > -1) { // Update
                 const existingTx = transactions[index];
                 const changes: { field: string; from: any; to: any }[] = [];
                 if (existingTx.amount !== itemData.amount) changes.push({ field: 'amount', from: existingTx.amount, to: itemData.amount });
                 if (existingTx.notes !== itemData.notes) changes.push({ field: 'notes', from: existingTx.notes, to: itemData.notes });
                 if (existingTx.date !== itemData.date) changes.push({ field: 'date', from: existingTx.date, to: itemData.date });
                 if (existingTx.paymentMode !== itemData.paymentMode) changes.push({ field: 'paymentMode', from: existingTx.paymentMode, to: itemData.paymentMode });
                 if (existingTx.category !== itemData.category) changes.push({ field: 'category', from: existingTx.category, to: itemData.category });
                 if (changes.length > 0) historyEntry.changes = changes;
                 
                 transactions[index] = { ...existingTx, ...itemData, history: [...(existingTx.history || []), historyEntry] };
             } else { // Create
                 transactions.push({ id: uuidv4(), ...itemData, history: [historyEntry] });
             }
             newEvent.transactions = transactions;
        }

        setEvent(newEvent);
        onSave(newEvent); // Persist immediately
        setModalState(null);
    };

    const handleDeleteItem = (id: string, type: 'charge' | 'transaction', reason: string) => {
        if (!currentUser) return;
        
        const historyEntry: FinancialHistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
            action: 'deleted',
            reason: reason,
        };

        const newEvent = deepClone(event);
        if (type === 'charge') {
            const index = newEvent.charges?.findIndex(c => c.id === id);
            if (index !== undefined && index > -1) {
                const chargeToDelete = newEvent.charges![index];
                chargeToDelete.isDeleted = true;
                chargeToDelete.history = [...(chargeToDelete.history || []), historyEntry];
                
                // Clear associated menu items
                if (chargeToDelete.type === 'Live Counter' && chargeToDelete.liveCounterId && newEvent.liveCounters) {
                    delete newEvent.liveCounters[chargeToDelete.liveCounterId];
                } else if (chargeToDelete.type === 'Cocktail Menu') {
                    newEvent.cocktailMenuItems = {};
                } else if (chargeToDelete.type === 'Hi-Tea Menu') {
                    newEvent.hiTeaMenuItems = {};
                }
            }
        } else {
             const index = newEvent.transactions?.findIndex(t => t.id === id);
             if (index !== undefined && index > -1) {
                newEvent.transactions![index].isDeleted = true;
                newEvent.transactions![index].history = [...(newEvent.transactions![index].history || []), historyEntry];
             }
        }
        
        setEvent(newEvent);
        onSave(newEvent);
        setDeleteConfirmation(null);
        setDeleteReason('');
    };

    const {
        model, pax, perPax, rent,
        baseCost, totalCharges, totalBill, totalPayments,
        totalExpenses, balanceDue, profit
    } = useMemo(() => {
        const model = event.pricingModel || 'variable';
        const pax = event.pax || 0;
        const perPax = event.perPaxPrice || 0;
        const rent = event.rent || 0;
        
        let baseCost = 0;
        if (model === 'variable') baseCost = pax * perPax;
        else if (model === 'flat') baseCost = rent;
        else if (model === 'mix') baseCost = rent + (pax * perPax);

        const totalCharges = (event.charges || []).filter(c => !c.isDeleted).reduce((sum, charge) => sum + charge.amount, 0);
        const totalPayments = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted).reduce((sum, payment) => sum + payment.amount, 0);
        const totalExpenses = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted).reduce((sum, expense) => sum + expense.amount, 0);

        const totalBill = baseCost + totalCharges;
        const balanceDue = totalBill - totalPayments;
        const profit = totalBill - totalExpenses;
        
        return { model, pax, perPax, rent, baseCost, totalCharges, totalBill, totalPayments, totalExpenses, balanceDue, profit };
    }, [event]);

    const hasWritePermission = useMemo(() => {
        return permissionCore === 'modify' || permissionCharges === 'modify' || permissionPayments === 'modify' || permissionExpenses === 'modify';
    }, [permissionCore, permissionCharges, permissionPayments, permissionExpenses]);
    
    // UI Components
    const SummaryRow = ({ label, value, isBold = false }: { label: string, value: string, isBold?: boolean }) => (
        <div className={`flex justify-between items-center py-2 ${isBold ? 'font-bold' : ''}`}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );

    const Section = ({ title, data, type, permissionLevel }: { title: string, data: any[], type: 'charge' | 'transaction', permissionLevel: PermissionLevel }) => {
        const canWrite = permissionLevel === 'modify';
        const visibleData = showDeleted ? data : data.filter(item => !item.isDeleted);
        
        const openModal = (item: any | null) => {
            if (type === 'charge') setModalState({ type: 'charge', data: item });
            else setModalState({ type: 'transaction', data: { ...item, type: title.toLowerCase().includes('payment') ? 'income' : 'expense'} });
        };
        
        const headers: Record<string, string[]> = {
            'charge': ['Description', 'Details', 'Amount'],
            'transaction_income': ['Date', 'Mode', 'Notes', 'Amount'],
            'transaction_expense': ['Date', 'Category', 'Notes', 'Amount']
        };

        const getTransactionType = () => title.toLowerCase().includes('payment') ? 'income' : 'expense';
        const currentHeaders = type === 'charge' ? headers.charge : headers[`transaction_${getTransactionType()}`];
        
        const handleExport = () => {
            if (!event || !clientName) return;
            const exportHeaders = currentHeaders.filter(h => h !== 'Amount').concat('Amount');
            const exportData = visibleData.map(item => {
                 if (type === 'charge') {
                     return [item.type, item.notes, item.amount];
                 } else {
                     return [item.date, item.paymentMode || item.category, item.notes, item.amount];
                 }
            });
            exportFinanceSectionToPdf(title, exportHeaders, exportData, event, clientName);
        };

        const showPdfButton = (title.toLowerCase().includes('payment') || title.toLowerCase().includes('expense')) && permissionLevel !== 'none';

        return (
            <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-lg">{title}</h3>
                    <div className="flex items-center gap-2">
                        {showPdfButton && <button onClick={handleExport} className={secondaryButton}><FileDown size={16}/> PDF</button>}
                        {canWrite && !isEventLocked && <button onClick={() => openModal(null)} className={primaryButton}><Plus size={16}/> Add</button>}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                         <thead className="bg-warm-gray-50 dark:bg-warm-gray-900/40">
                            <tr>
                                {currentHeaders.map(h => <th key={h} className="p-2 text-left font-semibold">{h}</th>)}
                                <th className="p-2 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleData.map(item => {
                                if (type === 'charge') {
                                    let description = <p className="font-semibold">{item.type}</p>;
                                    let details = <p className="text-sm text-warm-gray-500">{item.notes || ''}</p>;

                                    if (item.type === 'Live Counter' && item.liveCounterId) {
                                        const counter = liveCounterMap.get(item.liveCounterId);
                                        description = (
                                            <div>
                                                <p className="font-semibold">{item.type}</p>
                                                <p className="text-xs text-warm-gray-500">{counter?.name || 'Unknown Counter'}</p>
                                            </div>
                                        );
                                        details = (
                                            <div>
                                                <p>₹{item.price?.toLocaleString('en-IN') || 0} / PAX</p>
                                                {item.discountAmount > 0 && <p className="text-xs text-red-500">(-₹{item.discountAmount.toLocaleString('en-IN')} discount)</p>}
                                                {item.notes && <p className="text-xs italic mt-1">{item.notes}</p>}
                                            </div>
                                        );
                                    } else if ((item.type === 'Cocktail Menu' || item.type === 'Hi-Tea Menu') && item.menuTemplateId) {
                                        const template = templateMap.get(item.menuTemplateId);
                                        description = (
                                            <div>
                                                <p className="font-semibold">{item.type}</p>
                                                <p className="text-xs text-warm-gray-500">{template?.name || 'Unknown Menu'}</p>
                                            </div>
                                        );
                                        if (item.type === 'Cocktail Menu') {
                                            details = (
                                                <div>
                                                    <p>₹{item.price?.toLocaleString('en-IN') || 0} x {item.cocktailPax || 0} PAX</p>
                                                    {item.corkageCharges > 0 && <p className="text-xs text-warm-gray-500">(+₹{item.corkageCharges.toLocaleString('en-IN')} corkage)</p>}
                                                    {item.discountAmount > 0 && <p className="text-xs text-red-500">(-₹{item.discountAmount.toLocaleString('en-IN')} discount)</p>}
                                                    {item.notes && <p className="text-xs italic mt-1">{item.notes}</p>}
                                                </div>
                                            );
                                        } else { // Hi-Tea
                                            details = (
                                                <div>
                                                    <p>₹{item.price?.toLocaleString('en-IN') || 0} Base Price</p>
                                                    {item.discountAmount > 0 && <p className="text-xs text-red-500">(-₹{item.discountAmount.toLocaleString('en-IN')} discount)</p>}
                                                    {item.notes && <p className="text-xs italic mt-1">{item.notes}</p>}
                                                </div>
                                            );
                                        }
                                    } else if (item.type === 'Additional PAX') {
                                        description = (
                                            <div>
                                                <p className="font-semibold">{item.type}</p>
                                                <p className="text-xs text-warm-gray-500">{item.additionalPaxCount || 0} extra guests</p>
                                            </div>
                                        );
                                        details = (
                                            <div>
                                                <p>@ ₹{event.perPaxPrice?.toLocaleString('en-IN') || 0} / PAX</p>
                                                {item.discountAmount > 0 && <p className="text-xs text-red-500">(-₹{item.discountAmount.toLocaleString('en-IN')} discount)</p>}
                                                {item.notes && <p className="text-xs italic mt-1">{item.notes}</p>}
                                            </div>
                                        )
                                    }
                        
                                    return (
                                        <tr key={item.id} className={`${item.isDeleted ? 'opacity-50 line-through' : ''}`}>
                                            <td className="p-2 align-top">{description}</td>
                                            <td className="p-2 align-top">{details}</td>
                                            <td className="p-2 align-top font-semibold text-right">₹{item.amount.toLocaleString('en-IN')}</td>
                                            <td className="p-2 text-right align-top">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => setHistoryLog(item.history || [])} className={iconButton('hover:bg-blue-100')}><History size={16} className="text-blue-500"/></button>
                                                    {canWrite && !isEventLocked && !item.isDeleted && <>
                                                        <button onClick={() => openModal(item)} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                                                        <button onClick={() => setDeleteConfirmation({ id: item.id, type })} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                                                    </>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }
                                
                                return (
                                    <tr key={item.id} className={`${item.isDeleted ? 'opacity-50 line-through' : ''}`}>
                                        <td className="p-2 align-top">{new Date(item.date).toLocaleDateString('en-GB')}</td>
                                        <td className="p-2 align-top">{item.paymentMode || item.category}</td>
                                        <td className="p-2 align-top">{item.notes}</td>
                                        <td className="p-2 align-top font-semibold text-right">₹{item.amount.toLocaleString('en-IN')}</td>
                                        <td className="p-2 text-right align-top">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => setHistoryLog(item.history || [])} className={iconButton('hover:bg-blue-100')}><History size={16} className="text-blue-500"/></button>
                                                {canWrite && !isEventLocked && !item.isDeleted && <>
                                                    <button onClick={() => openModal(item)} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                                                    <button onClick={() => setDeleteConfirmation({ id: item.id, type })} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                                                </>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {visibleData.length === 0 && <p className="text-center text-warm-gray-500 py-4">No entries yet.</p>}
                </div>
            </div>
        )
    };
    
    return (
        <div className="space-y-6">
            {modalState && 
                <Modal 
                    isOpen={!!modalState} 
                    onClose={() => setModalState(null)}
                    title={
                        modalState.type === 'charge' 
                        ? (modalState.data?.id ? 'Edit Charge' : 'Add Charge')
                        : (modalState.data?.id ? 'Edit Transaction' : 'Add Transaction')
                    }
                >
                    {modalState.type === 'charge' 
                        ? <ChargeForm onSave={handleSaveItem} onCancel={() => setModalState(null)} charge={modalState.data} eventPerPaxPrice={event.perPaxPrice || 0} eventPax={event.pax || 0} />
                        : <TransactionForm onSave={handleSaveItem} onCancel={() => setModalState(null)} transaction={modalState.data} />
                    }
                </Modal>
            }
            {deleteConfirmation && (
                <Modal isOpen={!!deleteConfirmation} onClose={() => setDeleteConfirmation(null)} title="Confirm Deletion">
                    <p>Please provide a reason for deleting this entry. This action cannot be undone, but the item will be archived.</p>
                    <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} required className={inputStyle + " mt-2"} rows={3} />
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setDeleteConfirmation(null)} className={secondaryButton}>Cancel</button>
                        <button onClick={() => handleDeleteItem(deleteConfirmation.id, deleteConfirmation.type, deleteReason)} disabled={!deleteReason.trim()} className={dangerButton}>Delete</button>
                    </div>
                </Modal>
            )}
             {historyLog && (
                <Modal isOpen={!!historyLog} onClose={() => setHistoryLog(null)} title="History Log" size="lg">
                    <ul className="divide-y space-y-2 max-h-96 overflow-y-auto">
                        {historyLog.slice().reverse().map((entry, i) => (
                             <li key={i} className="pt-2">
                                <p><strong>{entry.action.toUpperCase()}</strong> on {new Date(entry.timestamp).toLocaleString()}</p>
                                <p>by {entry.username}</p>
                                <p><strong>Reason:</strong> {entry.reason}</p>
                                {entry.changes && entry.changes.length > 0 && <div className="mt-1">
                                    <p className="font-semibold">Changes:</p>
                                    <ul className="list-disc pl-5 text-sm">
                                        {entry.changes.map((c, j) => <li key={j}><strong>{c.field}:</strong> "{formatValue(c.from, c.field)}" to "{formatValue(c.to, c.field)}"</li>)}
                                    </ul>
                                </div>}
                            </li>
                        ))}
                    </ul>
                </Modal>
            )}

            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className={iconButton('hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700')}><ArrowLeft size={20}/></button>
                    <div className="flex items-center gap-3">
                        <FilePenLine size={32} className="text-primary-500"/>
                        <div>
                            <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                                Finances
                            </h2>
                            <p className="text-warm-gray-500 flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                <span>{clientName} - {event.eventType} - {formatDateRange(event.startDate, event.endDate)}</span>
                                <span className="flex items-center gap-1.5"><Users size={14}/> {event.pax || 0} PAX</span>
                            </p>
                        </div>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    {permissionCore !== 'none' && <button onClick={() => exportFinanceToPdf(event, clientName, liveCounters, templates)} className={secondaryButton}><FileDown size={16}/> Full Export</button>}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {permissionCore !== 'none' && (
                    <div className="md:col-span-1 p-6 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-xl">Summary</h3>
                            {isEventLocked && <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-1 rounded-full">LOCKED</span>}
                        </div>
                        
                        <div className="p-4 border rounded-md">
                            <h4 className="font-semibold">Pricing Model</h4>
                            <div className="flex gap-4 mt-2">
                                <label><input type="radio" name="pricing" value="variable" checked={model === 'variable'} onChange={(e) => handlePricingModelChange(e.target.value as any)} disabled={isEventLocked || permissionCore !== 'modify'}/> Per Pax</label>
                                <label><input type="radio" name="pricing" value="flat" checked={model === 'flat'} onChange={(e) => handlePricingModelChange(e.target.value as any)} disabled={isEventLocked || permissionCore !== 'modify'}/> Flat</label>
                                <label><input type="radio" name="pricing" value="mix" checked={model === 'mix'} onChange={(e) => handlePricingModelChange(e.target.value as any)} disabled={isEventLocked || permissionCore !== 'modify'}/> Mix</label>
                            </div>
                        </div>

                        {(model === 'variable' || model === 'mix') && (
                            <div>
                                <label className="text-sm font-medium">Per Pax Rate</label>
                                <input type="number" value={perPax} onChange={(e) => handleFieldChange('perPaxPrice', e.target.value)} disabled={isEventLocked || permissionCore !== 'modify'} className={inputStyle} />
                            </div>
                        )}
                        {(model === 'flat' || model === 'mix') && (
                            <div>
                                <label className="text-sm font-medium">Base Rent</label>
                                <input type="number" value={rent} onChange={(e) => handleFieldChange('rent', e.target.value)} disabled={isEventLocked || permissionCore !== 'modify'} className={inputStyle} />
                            </div>
                        )}

                        <div className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                            <SummaryRow label="Base Cost" value={`₹${baseCost.toLocaleString('en-IN')}`} />
                            <SummaryRow label="Additional Charges" value={`₹${totalCharges.toLocaleString('en-IN')}`} />
                            <SummaryRow label="Total Bill" value={`₹${totalBill.toLocaleString('en-IN')}`} isBold={true}/>
                            <SummaryRow label="Payments Received" value={`₹${totalPayments.toLocaleString('en-IN')}`} />
                            <SummaryRow label="Total Expenses" value={`- ₹${totalExpenses.toLocaleString('en-IN')}`} />
                            <SummaryRow label="Balance Due" value={`₹${balanceDue.toLocaleString('en-IN')}`} isBold={true}/>
                            <SummaryRow label="Est. Profit" value={`₹${profit.toLocaleString('en-IN')}`} isBold={true}/>
                        </div>
                        
                        <div className="flex justify-end pt-4">
                            {permissionCore === 'modify' && !isEventLocked && <button onClick={handleCoreSave} className={primaryButton}>Save Pricing</button>}
                        </div>
                    </div>
                )}

                <div className={`${permissionCore === 'none' ? 'md:col-span-3' : 'md:col-span-2'} space-y-6`}>
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-xl">Breakdown</h3>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Show Deleted</label>
                    </div>
                    {permissionCharges !== 'none' && <Section title="Additional Charges" data={event.charges || []} type="charge" permissionLevel={permissionCharges} />}
                    {permissionPayments !== 'none' && <Section title="Payments (Income)" data={(event.transactions || []).filter(t => t.type === 'income')} type="transaction" permissionLevel={permissionPayments} />}
                    {permissionExpenses !== 'none' && <Section title="Expenses" data={(event.transactions || []).filter(t => t.type === 'expense')} type="transaction" permissionLevel={permissionExpenses} />}
                </div>
            </div>
        </div>
    );
};