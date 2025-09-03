import React, { useState, useMemo } from 'react';
import { User, Role, AppPermissions, Client, LocationSetting, PermissionLevel, UserRole } from '../../types';
import { useUsers, useRoles, useClients, useLocations } from '../../contexts/AppContexts';
import Modal from '../../components/Modal';
import { primaryButton, secondaryButton, dangerButton, inputStyle, iconButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, Save, AlertTriangle, GitMerge, Link2 } from 'lucide-react';
import { doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// A simple heuristic to check if an ID is likely a Firebase UID vs. a Firestore auto-ID
const isFirebaseUid = (id: string) => id.length > 20;

type ModalState =
    | { type: 'user', data: User | null }
    | { type: 'role', data: Role | null };

const MigrationAndApprovalTool = ({ pendingUsers, legacyUsers, onLinkAndApprove, onClose }: {
    pendingUsers: User[];
    legacyUsers: User[];
    onLinkAndApprove: (pendingUserId: string, legacyUserId: string) => Promise<void>;
    onClose: () => void;
}) => {
    const [selectedPending, setSelectedPending] = useState<string>('');
    const [selectedLegacy, setSelectedLegacy] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    
    const handleLink = async () => {
        if (!selectedPending || !selectedLegacy) {
            alert("Please select one user from each list to link.");
            return;
        }
        setIsLoading(true);
        try {
            await onLinkAndApprove(selectedPending, selectedLegacy);
            setSelectedLegacy('');
            setSelectedPending('');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm">Link a newly signed-up user to their old data. This will activate their new account and delete the old record.</p>
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <h4 className="font-bold mb-2">1. Select Pending User</h4>
                    <ul className="h-64 overflow-y-auto border rounded-md p-2 space-y-1 dark:border-warm-gray-700">
                        {pendingUsers.map(u => (
                            <li key={u.id}
                                onClick={() => setSelectedPending(u.id)}
                                className={`p-2 rounded cursor-pointer ${selectedPending === u.id ? 'bg-primary-100 dark:bg-primary-900/40' : 'hover:bg-warm-gray-100'}`}
                            >
                                {u.username}
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold mb-2">2. Select Legacy User</h4>
                    <ul className="h-64 overflow-y-auto border rounded-md p-2 space-y-1 dark:border-warm-gray-700">
                         {legacyUsers.map(u => (
                            <li key={u.id}
                                onClick={() => setSelectedLegacy(u.id)}
                                className={`p-2 rounded cursor-pointer ${selectedLegacy === u.id ? 'bg-primary-100 dark:bg-primary-900/40' : 'hover:bg-warm-gray-100'}`}
                            >
                                {u.username}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="flex justify-end pt-4">
                 <button onClick={handleLink} className={primaryButton} disabled={!selectedPending || !selectedLegacy || isLoading}>
                    <Link2 size={16}/> {isLoading ? 'Linking...' : 'Link & Approve Selected Users'}
                </button>
            </div>
        </div>
    );
};


export const UserAndRoleManager = ({ canModify }: { canModify: boolean }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
    const [modalState, setModalState] = useState<ModalState | null>(null);
    const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
    
    const { users, addUser, updateUser, deleteUser } = useUsers();
    const { roles, addRole, updateRole, deleteRole } = useRoles();
    const { clients } = useClients();
    const { locations } = useLocations();

    const { activeUsers, pendingUsers, unmigratedUsers } = useMemo(() => {
        const active: User[] = [];
        const pending: User[] = [];
        const unmigrated: User[] = [];
        
        users.forEach(u => {
            if (!isFirebaseUid(u.id)) {
                unmigrated.push(u);
            } else if (u.status === 'pending') {
                pending.push(u);
            } else if (u.status === 'active') {
                active.push(u);
            }
        });

        return {
            activeUsers: active,
            pendingUsers: pending.sort((a,b) => a.username.localeCompare(b.username)),
            unmigratedUsers: unmigrated.sort((a,b) => a.username.localeCompare(b.username))
        };
    }, [users]);
    
    const { clientUsers, staffUsers } = useMemo(() => {
        const clients: User[] = [];
        const staff: User[] = [];
        activeUsers.forEach(u => {
            if (u.role === 'regular') {
                clients.push(u);
            } else {
                staff.push(u);
            }
        });
        return { clientUsers: clients, staffUsers: staff };
    }, [activeUsers]);
    
    const handleLinkAndApprove = async (pendingUserId: string, legacyUserId: string) => {
        const batch = writeBatch(db);

        const pendingUserRef = doc(db, 'users', pendingUserId);
        const legacyUserRef = doc(db, 'users', legacyUserId);

        const legacyUserSnap = await getDoc(legacyUserRef);
        if (!legacyUserSnap.exists()) {
            throw new Error("Legacy user data not found.");
        }
        
        const legacyData = legacyUserSnap.data() as User;
        const { id, password, username, ...dataToMerge } = legacyData;

        // Update the new user's document with the merged data and set status to active
        batch.update(pendingUserRef, { ...dataToMerge, status: 'active' });

        // Delete the old legacy user document
        batch.delete(legacyUserRef);

        await batch.commit();
        alert('User linked and approved successfully!');
        setIsMigrationModalOpen(false); // Close the modal on success
    };


    const handleSaveUser = async (data: User | Omit<User, 'id'>) => {
        if (!canModify) return;
        try {
            if ('id' in data) await updateUser(data);
            else await addUser(data);
            setModalState(null);
        } catch(e) { alert(`Error: ${e}`); }
    };
    
    const handleDeleteUser = async (id: string) => {
        if(!canModify) return;
        if(window.confirm("Are you sure you want to delete this staff user? This action cannot be undone.")) {
            await deleteUser(id);
        }
    }

    const handleDeleteClientUser = async (id: string) => {
        if(!canModify) return;
        if(window.confirm("Are you sure you want to delete this client's account? This will revoke their system access but will NOT delete their client or event data.")) {
            await deleteUser(id);
        }
    }
    
    const handleSaveRole = async (data: Role | Omit<Role, 'id'>) => {
         if (!canModify) return;
        try {
            if ('id' in data) await updateRole(data);
            else await addRole(data);
            setModalState(null);
        } catch(e) { alert(`Error: ${e}`); }
    };

    const handleDeleteRole = async (id: string) => {
        if(!canModify) return;
        try {
            await deleteRole(id);
        } catch (e) {
            alert(`Error deleting role: ${e}`);
        }
    };

    const modalContent = () => {
        if (!modalState) return null;
        if (modalState.type === 'user') {
            return <UserForm onSave={handleSaveUser} onCancel={() => setModalState(null)} user={modalState.data} roles={roles} locations={locations} />
        }
        if (modalState.type === 'role') {
            return <RoleForm onSave={handleSaveRole} onCancel={() => setModalState(null)} role={modalState.data} />
        }
    }

    return (
        <div>
            {modalState && 
                <Modal 
                    isOpen={!!modalState} 
                    onClose={() => setModalState(null)}
                    title={modalState.type === 'user' ? 'User' : 'Role'}
                    size={modalState.type === 'role' ? 'xl' : 'md'}
                >
                   {modalContent()}
                </Modal>
            }
             {isMigrationModalOpen && (
                <Modal isOpen={true} onClose={() => setIsMigrationModalOpen(false)} title="User Approval & Migration" size="xl">
                    <MigrationAndApprovalTool
                        pendingUsers={pendingUsers}
                        legacyUsers={unmigratedUsers}
                        onLinkAndApprove={handleLinkAndApprove}
                        onClose={() => setIsMigrationModalOpen(false)}
                    />
                </Modal>
            )}
            <div className="border-b border-warm-gray-200 dark:border-warm-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8">
                     <button onClick={() => setActiveTab('users')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'users' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>Users</button>
                     <button onClick={() => setActiveTab('roles')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'roles' ? 'border-primary-500 text-primary-600' : 'border-transparent text-warm-gray-500 hover:text-warm-gray-700'}`}>Roles</button>
                </nav>
            </div>
            {activeTab === 'users' ? 
                <div className="space-y-8">
                     {(pendingUsers.length > 0 || unmigratedUsers.length > 0) && canModify && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="text-yellow-600 dark:text-yellow-400" />
                                <div>
                                    <p className="font-bold text-yellow-800 dark:text-yellow-200">Action Required</p>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                        {pendingUsers.length} user(s) awaiting approval. {unmigratedUsers.length} legacy user(s) need migration.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsMigrationModalOpen(true)} className={primaryButton}>
                                <GitMerge size={16}/> Manage Approvals & Migrations
                            </button>
                        </div>
                    )}
                    <UserTable title="Staff Users" users={staffUsers} onAdd={() => setModalState({ type: 'user', data: null })} onEdit={(u) => setModalState({ type: 'user', data: u})} onDelete={handleDeleteUser} canModify={canModify} roles={roles} />
                    <UserTable title="Client Users" users={clientUsers} onAdd={null} onEdit={null} onDelete={handleDeleteClientUser} canModify={canModify} roles={roles}/>
                </div>
                 :
                <RoleList roles={roles} onAdd={() => setModalState({ type: 'role', data: null })} onEdit={(r) => setModalState({ type: 'role', data: r})} onDelete={handleDeleteRole} canModify={canModify} />
            }
        </div>
    );
};

const UserTable = ({ title, users, onAdd, onEdit, onDelete, canModify, roles }: { title: string, users: User[], roles: Role[], onAdd:(()=>void)|null, onEdit:((u:User)=>void)|null, onDelete:((id:string)=>void)|null, canModify: boolean }) => (
    <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-warm-gray-800 dark:text-warm-gray-200">{title}</h3>
            {canModify && onAdd && <button onClick={onAdd} className={primaryButton}>Add User</button>}
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-warm-gray-50 dark:bg-warm-gray-900/40">
                    <tr>
                        <th className="px-4 py-2 text-left font-semibold">Username</th>
                        <th className="px-4 py-2 text-left font-semibold">Role</th>
                        <th className="px-4 py-2 text-left font-semibold">Status</th>
                        {canModify && <th className="px-4 py-2 text-right font-semibold">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                    {users.slice().sort((a,b) => a.username.localeCompare(b.username)).map(user => {
                        const roleName = user.role === 'staff' ? roles.find(r => r.id === user.roleId)?.name : (user.role.charAt(0).toUpperCase() + user.role.slice(1));
                        
                        return (
                            <tr key={user.id}>
                                <td className="px-4 py-2 flex items-center gap-2">
                                    {user.username}
                                </td>
                                <td className="px-4 py-2">{roleName || user.role}</td>
                                <td className="px-4 py-2">{user.status}</td>
                                {canModify && <td className="px-4 py-2 text-right">
                                    <div className="flex justify-end gap-1">
                                        {user.username !== 'admin@kumkuma.com' && onEdit && (
                                            <button onClick={() => onEdit(user)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit User">
                                                <Edit size={16} className="text-primary-600" />
                                            </button>
                                        )}
                                        {user.username !== 'admin@kumkuma.com' && onDelete && (
                                            <button onClick={() => onDelete(user.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete User">
                                                <Trash2 size={16} className="text-accent-500" />
                                            </button>
                                        )}
                                    </div>
                                </td>}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {users.length === 0 && <p className="text-center text-warm-gray-500 py-4">No users in this category.</p>}
        </div>
    </div>
);

const RoleList = ({ roles, onAdd, onEdit, onDelete, canModify }: { roles: Role[], onAdd:()=>void, onEdit:(r:Role)=>void, onDelete:(id:string)=>void, canModify: boolean }) => (
    <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
        <div className="flex justify-end mb-4">
            {canModify && <button onClick={onAdd} className={primaryButton}>Add Role</button>}
        </div>
        <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
            {roles.slice().sort((a,b) => a.name.localeCompare(b.name)).map(role => (
                <li key={role.id} className="py-2 flex justify-between items-center">
                    <span>{role.name}</span>
                    {canModify && 
                    <div className="flex gap-1">
                        <button onClick={() => onEdit(role)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} title="Edit Role">
                            <Edit size={16} className="text-primary-600" />
                        </button>
                        <button onClick={() => onDelete(role.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Role">
                            <Trash2 size={16} className="text-accent-500" />
                        </button>
                    </div>}
                </li>
            ))}
        </ul>
    </div>
);

const UserForm = ({ onSave, onCancel, user, roles, locations }: { onSave:(u:any)=>void, onCancel:()=>void, user:User|null, roles:Role[], locations:LocationSetting[] }) => {
    const [username, setUsername] = useState(user?.username || '');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>(user?.role || 'staff');
    const [status, setStatus] = useState(user?.status || 'active');
    const [roleId, setRoleId] = useState(user?.roleId || (roles.length > 0 ? roles[0].id : ''));
    const [managedLocationIds, setManagedLocationIds] = useState<string[]>(user?.managedLocationIds || []);

    const handleSubmit = (e:React.FormEvent) => {
        e.preventDefault();
        const data: Partial<User> & {password?: string} = { 
            username, 
            role, 
            status, 
            roleId: role === 'staff' ? roleId : undefined, 
            managedLocationIds: role === 'staff' ? managedLocationIds : [],
            assignedClientId: undefined
        };
        
        if (user) {
             onSave({ ...user, ...data });
        } else {
            if (!password) {
                alert('Password is required for new users.');
                return;
            }
            onSave({ ...data, password });
        }
    };

    const handleLocationToggle = (locationId: string) => {
        setManagedLocationIds(prev => prev.includes(locationId) ? prev.filter(id => id !== locationId) : [...prev, locationId]);
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Username (must be an email)" value={username} onChange={e=>setUsername(e.target.value)} required className={inputStyle} readOnly={!!user}/>
            <input type="password" placeholder={user ? "New Password (optional)" : "Password"} value={password} onChange={e=>setPassword(e.target.value)} required={!user} className={inputStyle}/>
            <select value={role} onChange={e=>setRole(e.target.value as any)} className={inputStyle}>
                <option value="admin">Admin</option>
                <option value="staff">Staff User</option>
                <option value="kitchen">Kitchen User</option>
            </select>
             <select value={status} onChange={e=>setStatus(e.target.value as any)} className={inputStyle}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                 <option value="pending">Pending</option>
            </select>

            {role === 'staff' && (
                <>
                    <select value={roleId} onChange={e=>setRoleId(e.target.value)} required className={inputStyle}>
                         <option value="">-- Assign a Role --</option>
                        {roles.slice().sort((a,b) => a.name.localeCompare(b.name)).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <div>
                        <label className="block text-sm font-medium">Managed Locations (Optional)</label>
                        <div className="mt-2 grid grid-cols-2 gap-2 p-2 border rounded-md max-h-40 overflow-y-auto">
                           {locations.map(loc => (
                               <label key={loc.id} className="flex items-center gap-2">
                                   <input type="checkbox" checked={managedLocationIds.includes(loc.id)} onChange={()=>handleLocationToggle(loc.id)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                                   {loc.name}
                               </label>
                           ))}
                        </div>
                    </div>
                </>
            )}
             <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    )
};

const RoleForm = ({ onSave, onCancel, role }: { onSave:(r:any)=>void, onCancel:()=>void, role:Role|null }) => {
    const [name, setName] = useState(role?.name || '');
    const [permissions, setPermissions] = useState<AppPermissions>(role?.permissions || {} as AppPermissions);
    const [visibleReports, setVisibleReports] = useState<string[]>(role?.permissions?.visibleReports || []);

    const permissionNames: (keyof AppPermissions)[] = [
        'dashboard', 'itemBank', 'catalogs', 'templates', 'liveCounters', 
        'reports', 'users', 'settings', 'clientsAndEvents', 
        'financeCore', 'financeCharges', 'financePayments', 'financeExpenses', 'muhurthams'
    ];
    const permissionLevels: PermissionLevel[] = ['none', 'view', 'modify'];

    const booleanPermissions: { key: keyof AppPermissions; label: string }[] = [
        { key: 'allowEventCancellation', label: 'Allow cancelling confirmed events' }
    ];

    const reportTypes = {
        income: "Income Report",
        expense: "Expense Report",
        profitability: "Event Profitability",
        sales: "Monthly Sales Report",
        additionalPax: "Additional PAX Report",
        salesFunnel: "Sales Funnel Report",
    };

    const handlePermissionChange = (key: keyof AppPermissions, level: PermissionLevel) => {
        setPermissions(prev => ({...prev, [key]: level}));
    };

    const handleBooleanPermissionChange = (key: keyof AppPermissions, checked: boolean) => {
        setPermissions(prev => ({ ...prev, [key]: checked }));
    };

    const handleReportVisibilityChange = (reportKey: string, isVisible: boolean) => {
        setVisibleReports(prev => {
            const newSet = new Set(prev);
            if (isVisible) {
                newSet.add(reportKey);
            } else {
                newSet.delete(reportKey);
            }
            return Array.from(newSet);
        });
    };
    
    const handleSubmit = (e:React.FormEvent) => {
        e.preventDefault();
        const finalPermissions = { ...permissions, visibleReports };
        const data = { name, permissions: finalPermissions };
        if (role) onSave({ ...data, id: role.id });
        else onSave(data);
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Role Name" value={name} onChange={e=>setName(e.target.value)} required className={inputStyle} />
            
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr>
                            <th className="py-2 text-left">Feature</th>
                            {permissionLevels.map(level => <th key={level} className="py-2 text-center">{level.charAt(0).toUpperCase() + level.slice(1)}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {permissionNames.map(key => (
                            <tr key={key} className="border-t">
                                <td className="py-2 font-semibold">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</td>
                                {permissionLevels.map(level => (
                                    <td key={level} className="py-2 text-center">
                                        <input type="radio" name={key} checked={permissions[key] === level} onChange={() => handlePermissionChange(key, level)} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold mb-2">Specific Permissions</h4>
                <div className="space-y-2">
                    {booleanPermissions.map(({ key, label }) => (
                        <div key={key} className="flex items-center">
                            <input
                                type="checkbox"
                                id={key}
                                checked={!!permissions[key]}
                                onChange={(e) => handleBooleanPermissionChange(key, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor={key} className="ml-2 block text-sm">
                                {label}
                            </label>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
                 <h4 className="font-semibold mb-2">Report Visibility</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(reportTypes).map(([key, reportName]) => (
                        <div key={key} className="flex items-center">
                            <input
                                type="checkbox"
                                id={`report-${key}`}
                                checked={visibleReports.includes(key)}
                                onChange={(e) => handleReportVisibilityChange(key, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor={`report-${key}`} className="ml-2 block text-sm">
                                {reportName}
                            </label>
                        </div>
                    ))}
                 </div>
            </div>

             <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton}><Save size={18}/> Save</button>
            </div>
        </form>
    )
};