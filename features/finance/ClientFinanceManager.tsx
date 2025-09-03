import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Client, Event, Transaction, FinancialHistoryEntry } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPermissions } from '../../hooks/usePermissions';
import { deepClone, calculateFinancials, formatYYYYMMDD } from '../../lib/utils';
import Modal from '../../components/Modal';
import { TransactionForm } from './TransactionForm';
import { primaryButton, secondaryButton, iconButton, inputStyle, dangerButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, History, ArrowLeft, Banknote } from 'lucide-react';

type AdvanceModalState = { type: 'transaction', data: Partial<Transaction> | null } | null;

export const ClientFinanceManager: React.FC<{
    client: Client;
    clientEvents: Event[];
    onSave: (client: Client) => void;
    onCancel: () => void;
}> = ({ client, clientEvents, onSave, onCancel }) => {
    const { currentUser } = useAuth();
    const permissions = useUserPermissions();
    const [modalState, setModalState] = useState<AdvanceModalState>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<Transaction | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [historyLog, setHistoryLog] = useState<FinancialHistoryEntry[] | null>(null);
    const [showDeleted, setShowDeleted] = useState(false);

    const canModify = permissions?.clientsAndEvents === 'modify';

    const { totalAdvance, totalBilled, balance } = useMemo(() => {
        const totalAdvance = (client.transactions || [])
            .filter(t => t.type === 'income' && !t.isDeleted)
            .reduce((sum, t) => sum + t.amount, 0);

        const totalBilled = clientEvents
            .filter(e => e.state === 'confirmed' || e.state === 'cancelled')
            .reduce((sum, e) => sum + calculateFinancials(e).totalBill, 0);

        const balance = totalAdvance - totalBilled;
        return { totalAdvance, totalBilled, balance };
    }, [client.transactions, clientEvents]);

    const visibleTransactions = useMemo(() => {
        const transactions = (client.transactions || []).filter(t => t.type === 'income');
        return showDeleted ? transactions : transactions.filter(t => !t.isDeleted);
    }, [client.transactions, showDeleted]);

    const handleSaveTransaction = (itemData: any, reason: string) => {
        if (!currentUser) return;

        const newClient = deepClone(client);
        if (!newClient.transactions) newClient.transactions = [];

        const isUpdate = !!modalState?.data?.id;

        const historyEntry: FinancialHistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
            action: isUpdate ? 'updated' : 'created',
            reason: isUpdate ? reason : `Advance Payment Added`,
            changes: []
        };
        
        const index = isUpdate ? newClient.transactions.findIndex(t => t.id === modalState.data!.id) : -1;

        if (index > -1) { // Update
            const existingTx = newClient.transactions[index];
            historyEntry.changes = Object.keys(itemData).map(key => ({ field: `advance.${key}`, from: existingTx[key as keyof Transaction], to: itemData[key] })).filter(c => c.from !== c.to);
            newClient.transactions[index] = { ...existingTx, ...itemData, history: [...(existingTx.history || []), historyEntry] };
        } else { // Create
            newClient.transactions.push({ id: uuidv4(), ...itemData, history: [historyEntry] });
        }
        
        onSave(newClient);
        setModalState(null);
    };

    const handleDeleteTransaction = () => {
        if (!currentUser || !deleteConfirmation || !deleteReason.trim()) return;

        const historyEntry: FinancialHistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
            action: 'deleted',
            reason: deleteReason,
        };
        
        const newClient = deepClone(client);
        const index = newClient.transactions?.findIndex(t => t.id === deleteConfirmation.id);
        if (index !== undefined && index > -1) {
            newClient.transactions![index].isDeleted = true;
            newClient.transactions![index].history = [...(newClient.transactions![index].history || []), historyEntry];
        }

        onSave(newClient);
        setDeleteConfirmation(null);
        setDeleteReason('');
    };

    const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="space-y-6">
            {modalState && 
                <Modal 
                    isOpen={!!modalState} 
                    onClose={() => setModalState(null)}
                    title={modalState.data?.id ? 'Edit Advance Payment' : 'Add Advance Payment'}
                >
                    <TransactionForm onSave={handleSaveTransaction} onCancel={() => setModalState(null)} transaction={{ ...modalState.data, type: 'income' }} />
                </Modal>
            }
            {deleteConfirmation && (
                <Modal isOpen={!!deleteConfirmation} onClose={() => setDeleteConfirmation(null)} title="Confirm Deletion">
                    <p>Please provide a reason for deleting this advance payment. This action cannot be undone, but the item will be archived.</p>
                    <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} required className={inputStyle + " mt-2"} rows={3} />
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setDeleteConfirmation(null)} className={secondaryButton}>Cancel</button>
                        <button onClick={handleDeleteTransaction} disabled={!deleteReason.trim()} className={dangerButton}>Delete</button>
                    </div>
                </Modal>
            )}
             {historyLog && (
                <Modal isOpen={!!historyLog} onClose={() => setHistoryLog(null)} title="Payment History Log" size="lg">
                    <ul className="divide-y space-y-2 max-h-96 overflow-y-auto">
                        {historyLog.slice().reverse().map((entry, i) => (
                             <li key={i} className="pt-2">
                                <p><strong>{entry.action.toUpperCase()}</strong> on {new Date(entry.timestamp).toLocaleString()}</p>
                                <p>by {entry.username}</p>
                                <p><strong>Reason:</strong> {entry.reason}</p>
                                {entry.changes && entry.changes.length > 0 && <div className="mt-1">
                                    <p className="font-semibold">Changes:</p>
                                    <ul className="list-disc pl-5 text-sm">
                                        {entry.changes.map((c, j) => <li key={j}><strong>{c.field}:</strong> "{c.from || 'empty'}" to "{c.to || 'empty'}"</li>)}
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
                    <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">Client Finances: {client.name}</h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Panel: Payments and Summary */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg">Client Advance Payments</h3>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Show Deleted</label>
                                {canModify && <button onClick={() => setModalState({ type: 'transaction', data: null })} className={primaryButton}><Plus size={16}/> Add Payment</button>}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-warm-gray-50 dark:bg-warm-gray-900/40">
                                    <tr>
                                        <th className="p-2 text-left font-semibold">Date</th>
                                        <th className="p-2 text-left font-semibold">Mode</th>
                                        <th className="p-2 text-right font-semibold">Amount</th>
                                        <th className="p-2 text-right font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleTransactions.sort((a,b) => b.date.localeCompare(a.date)).map(tx => (
                                        <tr key={tx.id} className={`${tx.isDeleted ? 'opacity-50 line-through' : ''}`}>
                                            <td className="p-2">{formatYYYYMMDD(tx.date)}</td>
                                            <td className="p-2">{tx.paymentMode}</td>
                                            <td className="p-2 text-right font-semibold">{formatCurrency(tx.amount)}</td>
                                            <td className="p-2 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => setHistoryLog(tx.history || [])} className={iconButton('hover:bg-blue-100')}><History size={16} className="text-blue-500"/></button>
                                                    {canModify && !tx.isDeleted && <>
                                                        <button onClick={() => setModalState({ type: 'transaction', data: tx })} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                                                        <button onClick={() => setDeleteConfirmation(tx)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                                                    </>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {visibleTransactions.length === 0 && <p className="text-center text-warm-gray-500 py-4">No advance payments recorded.</p>}
                        </div>
                    </div>
                    
                    <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                        <h3 className="font-bold text-lg mb-4">Financial Summary</h3>
                        <div className="space-y-4">
                            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                                <h4 className="font-semibold text-sm text-green-800 dark:text-green-200">Total Advance Received</h4>
                                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(totalAdvance)}</p>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                                <h4 className="font-semibold text-sm text-red-800 dark:text-red-200">Total Billed Across Events</h4>
                                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(totalBilled)}</p>
                            </div>
                            <div className={`p-3 rounded-lg ${balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
                                <h4 className={`font-semibold text-sm ${balance >= 0 ? 'text-blue-800 dark:text-blue-200' : 'text-orange-800 dark:text-orange-200'}`}>
                                    {balance >= 0 ? 'Client Balance (Credit)' : 'Amount Due from Client'}
                                </h4>
                                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                                    {formatCurrency(Math.abs(balance))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Right Panel: Event Breakdown */}
                <div className="md:col-span-1 space-y-6">
                    <div className="p-4 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                        <h3 className="font-bold text-lg mb-4">Event Billing Breakdown</h3>
                        <div className="overflow-x-auto max-h-[calc(100vh-20rem)]">
                             <table className="w-full text-sm">
                                <thead className="bg-warm-gray-50 dark:bg-warm-gray-900/40 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left font-semibold">Event</th>
                                        <th className="p-2 text-right font-semibold">Bill</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientEvents.filter(e => e.state === 'confirmed' || e.state === 'cancelled').sort((a,b) => b.startDate.localeCompare(a.startDate)).map(event => (
                                        <tr key={event.id} className="border-b border-warm-gray-100 dark:border-warm-gray-700/50">
                                            <td className="p-2">
                                                <p>{event.eventType}</p>
                                                <p className="text-xs text-warm-gray-500">{formatYYYYMMDD(event.startDate)}</p>
                                            </td>
                                            <td className="p-2 text-right font-semibold">{formatCurrency(calculateFinancials(event).totalBill)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {clientEvents.filter(e => e.state === 'confirmed' || e.state === 'cancelled').length === 0 && (
                                <p className="text-center text-warm-gray-500 py-4">No billable events to display.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
