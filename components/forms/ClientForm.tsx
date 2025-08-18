

import React, { useState, useEffect } from 'react';
import { Client, Event, EventSession } from '../../types';
import { inputStyle, primaryButton, secondaryButton } from '../common/styles';
import { Save } from 'lucide-react';
import { useReferralSources, useLocations, useEventTypes } from '../../contexts/AppContexts';

type EventData = Omit<Event, 'id' | 'clientId' | 'createdAt' | 'status' | 'itemIds' | 'liveCounters' | 'stateHistory' | 'history' | 'transactions' | 'charges'>;

export const ClientForm = ({ onSave, onCancel, client, saveButtonText }: {
    onSave: (client: Client | Omit<Client, 'id'>) => void;
    onCancel: () => void;
    client?: Client | null;
    saveButtonText?: string;
}) => {
    const { settings: referralSources } = useReferralSources();
    
    // Client states
    const [name, setName] = useState(client?.name || '');
    const [phone, setPhone] = useState(client?.phone || '');
    const [email, setEmail] = useState(client?.email || '');
    const [company, setCompany] = useState(client?.company || '');
    const [address, setAddress] = useState(client?.address || '');
    const [referredBy, setReferredBy] = useState(client?.referredBy || '');
    const [hasSystemAccess, setHasSystemAccess] = useState(client?.hasSystemAccess || false);
    const [status, setStatus] = useState<'active' | 'inactive'>(client?.status || 'active');
    const [phoneError, setPhoneError] = useState('');

    const validatePhone = (phoneNumber: string) => {
        if (!phoneNumber) {
            setPhoneError('');
            return true;
        }
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phoneNumber)) {
            setPhoneError('Phone number must be exactly 10 digits.');
            return false;
        }
        setPhoneError('');
        return true;
    };

    useEffect(() => {
        validatePhone(phone);
    }, [phone]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('Client name is required.');
            return;
        }
        if (!validatePhone(phone.trim())) {
            alert('Please fix the errors before saving.');
            return;
        }
        const clientData = {
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            company: company.trim(),
            address: address.trim(),
            referredBy: referredBy,
            hasSystemAccess,
            status,
        };

        if (client && 'id' in client) {
            onSave({ id: client.id, ...clientData });
        } else {
            onSave(clientData);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Client Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Company</label>
                    <input type="text" value={company} onChange={e => setCompany(e.target.value)} className={inputStyle} />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Phone Number</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputStyle} />
                    {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                </div>
                 <div>
                    <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Email Address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputStyle} />
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Address</label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className={inputStyle} />
            </div>
             <div>
                <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Referred By</label>
                 <select value={referredBy} onChange={e => setReferredBy(e.target.value)} className={inputStyle}>
                    <option value="">-- Select Source --</option>
                    {referralSources.slice().sort((a,b) => a.name.localeCompare(b.name)).map(source => <option key={source.id} value={source.name}>{source.name}</option>)}
                </select>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-warm-gray-700 dark:text-warm-gray-300">Client Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')} className={inputStyle}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
                <div className="flex items-center pt-6">
                    <input
                        id="systemAccess"
                        type="checkbox"
                        checked={hasSystemAccess}
                        onChange={e => setHasSystemAccess(e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="systemAccess" className="ml-2 block text-sm text-warm-gray-900 dark:text-warm-gray-200">
                        Grant System Access
                    </label>
                </div>
            </div>
             {hasSystemAccess && <p className="text-xs text-warm-gray-500">If checked, a "regular" user account will be created using the phone number as the username and password.</p>}
            
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> {saveButtonText || 'Save Client'}</button>
            </div>
        </form>
    );
};