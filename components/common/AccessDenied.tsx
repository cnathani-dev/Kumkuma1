
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const AccessDenied = () => (
    <div className="text-center p-16 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md flex flex-col items-center gap-4">
        <div className="p-4 bg-accent-100 dark:bg-accent-900/50 rounded-full">
             <AlertTriangle size={48} className="text-accent-500" />
        </div>
        <h2 className="text-3xl font-display font-bold text-accent-500">Access Denied</h2>
        <p className="mt-2 text-warm-gray-500">You do not have the required permissions to view this page. Please contact your administrator.</p>
    </div>
);
