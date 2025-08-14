

import React, { useMemo, useState } from 'react';
import { Client } from '../../types';
import { useClients } from '../../App';
import Modal from '../../components/Modal';
import { ClientForm } from '../../components/forms/ClientForm';
import { primaryButton, inputStyle, secondaryButton } from '../../components/common/styles';
import { Plus, Building, Phone, UserCheck } from 'lucide-react';

export const ClientList = ({ clients, onNavigate, filters, setFilters }: { 
    clients: Client[], 
    onNavigate: (page: 'clients' | 'dashboard', clientId: string) => void,
    filters: { name: string, phone: string, status: 'active' | 'inactive' | 'all' },
    setFilters: React.Dispatch<React.SetStateAction<{ name: string, phone: string, status: 'active' | 'inactive' | 'all' }>>
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addClient } = useClients();
    
    const { name: nameFilter, phone: phoneFilter, status: statusFilter } = filters;

    const filteredClients = useMemo(() => {
        const isSearching = nameFilter.trim() !== '' || phoneFilter.trim() !== '';

        return clients.filter(client => {
            const nameMatch = client.name.toLowerCase().includes(nameFilter.toLowerCase());
            const phoneMatch = client.phone.toLowerCase().includes(phoneFilter.toLowerCase());

            if (isSearching) {
                return nameMatch && phoneMatch;
            }

            // If not searching, apply the status filter
            if (statusFilter === 'all') {
                return nameMatch && phoneMatch;
            }
            return (client.status || 'active') === statusFilter && nameMatch && phoneMatch;
        });
    }, [clients, nameFilter, phoneFilter, statusFilter]);

    const handleSaveClient = async (clientData: Omit<Client, 'id'>) => {
        try {
            await addClient(clientData);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to add client:", error);
            alert("An error occurred while adding the client.");
        }
    };
    
    const FilterButton = ({ value, label }: { value: 'active' | 'inactive' | 'all', label: string }) => {
        const isActive = statusFilter === value;
        return (
            <button
                onClick={() => setFilters(prev => ({...prev, status: value}))}
                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${isActive ? 'bg-primary-500 text-white shadow-sm' : 'bg-warm-gray-200 dark:bg-warm-gray-700 hover:bg-warm-gray-300 dark:hover:bg-warm-gray-600'}`}
            >
                {label}
            </button>
        );
    };

    return (
        <div>
             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Client">
                <ClientForm onSave={handleSaveClient} onCancel={() => setIsModalOpen(false)} />
            </Modal>
            <div className="flex justify-between items-center pb-4">
                <h3 className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400">Clients</h3>
                <button onClick={() => setIsModalOpen(true)} className={`${primaryButton} text-nowrap`}>
                    <Plus size={16} /> <span className="hidden sm:inline">Add Client</span>
                </button>
            </div>
             <div className="mb-6 p-4 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg space-y-4">
                 <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold mr-2">Show:</span>
                    <FilterButton value="active" label="Active" />
                    <FilterButton value="inactive" label="Inactive" />
                    <FilterButton value="all" label="All" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        placeholder="Filter by name..."
                        value={nameFilter}
                        onChange={(e) => setFilters(prev => ({...prev, name: e.target.value}))}
                        className={inputStyle}
                    />
                    <input
                        type="text"
                        placeholder="Filter by phone..."
                        value={phoneFilter}
                        onChange={(e) => setFilters(prev => ({...prev, phone: e.target.value}))}
                        className={inputStyle}
                    />
                </div>
            </div>
            {filteredClients.length === 0 ? (
                 <div className="text-center py-16">
                    <p className="text-warm-gray-500">No clients match the current filters.</p>
                </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                {filteredClients.sort((a,b) => a.name.localeCompare(b.name)).map(client => (
                    <div key={client.id} onClick={() => onNavigate('clients', client.id)} className="bg-white dark:bg-warm-gray-800 rounded-lg shadow-md p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all">
                        <div className="flex items-center justify-between">
                            <h5 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200 flex items-center gap-2">
                               <Building size={16} className="text-primary-600"/> {client.name}
                                {client.hasSystemAccess && (
                                    <span title="Has System Access">
                                        <UserCheck size={16} className="text-green-500" />
                                    </span>
                                )}
                            </h5>
                            {client.status === 'inactive' && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warm-gray-200 text-warm-gray-600 dark:bg-warm-gray-600 dark:text-warm-gray-200">
                                    Inactive
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-warm-gray-500 mt-2 flex items-center gap-2"><Phone size={14}/> {client.phone || 'N/A'}</p>
                    </div>
                ))}
            </div>
            )}
        </div>
    );
};