
import React, { useState, useMemo } from 'react';
import { useAuditLogs, useUsers, useClients } from '../../App';
import { inputStyle } from '../../components/common/styles';

export const AuditLogViewer = () => {
    const { auditLogs } = useAuditLogs();
    const { users } = useUsers();
    const { clients } = useClients();

    const [userFilter, setUserFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    const userMap = useMemo(() => new Map(users.map(u => [u.id, u.username])), [users]);
    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    const filteredLogs = useMemo(() => {
        return auditLogs
            .filter(log => {
                const userMatch = userFilter ? log.userId === userFilter : true;
                const actionMatch = actionFilter ? log.action === actionFilter : true;
                return userMatch && actionMatch;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [auditLogs, userFilter, actionFilter]);

    const uniqueActions = useMemo(() => [...new Set(auditLogs.map(log => log.action))], [auditLogs]);

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400 mb-4">Audit Logs</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg">
                <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className={inputStyle}>
                    <option value="">All Users</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.username}</option>)}
                </select>
                <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className={inputStyle}>
                    <option value="">All Actions</option>
                    {uniqueActions.map(action => <option key={action} value={action}>{action}</option>)}
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-warm-gray-100 dark:bg-warm-gray-700">
                        <tr>
                            <th className="px-4 py-2 text-left font-semibold">Timestamp</th>
                            <th className="px-4 py-2 text-left font-semibold">User</th>
                            <th className="px-4 py-2 text-left font-semibold">Action</th>
                            <th className="px-4 py-2 text-left font-semibold">Details</th>
                            <th className="px-4 py-2 text-left font-semibold">Associated Client</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                        {filteredLogs.map(log => (
                            <tr key={log.id}>
                                <td className="px-4 py-2 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{log.username || userMap.get(log.userId) || 'System'}</td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                    <span className="px-2 py-1 font-semibold leading-tight text-yellow-700 bg-yellow-100 rounded-full dark:bg-yellow-700 dark:text-yellow-100">{log.action}</span>
                                </td>
                                <td className="px-4 py-2">{log.details}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{log.clientId ? (clientMap.get(log.clientId) || 'N/A') : 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {filteredLogs.length === 0 && <p className="text-center py-8 text-warm-gray-500">No logs found for the current filter.</p>}
        </div>
    );
};
