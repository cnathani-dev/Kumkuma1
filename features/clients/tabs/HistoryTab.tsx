
import React, { useMemo } from 'react';
import { Client } from '../../../types';
import { FilePenLine } from 'lucide-react';

export const HistoryTab: React.FC<{ client: Client }> = ({ client }) => {
    const sortedHistory = useMemo(() =>
        (client.history || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [client.history]);

    if (!sortedHistory.length) {
        return <p className="text-center text-warm-gray-500 py-8">No client history recorded.</p>;
    }

    return (
        <div className="space-y-4">
            {sortedHistory.map((entry, index) => (
                <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                        <span className="p-2 bg-blue-100 rounded-full dark:bg-blue-900/50">
                            <FilePenLine size={20} className="text-blue-600 dark:text-blue-300"/>
                        </span>
                        {index < sortedHistory.length - 1 && <div className="flex-grow w-px bg-warm-gray-200 dark:bg-warm-gray-700"></div>}
                    </div>
                    <div className="pb-4 flex-grow">
                        <p className="font-semibold">{entry.action === 'created' ? 'Client Created' : 'Client Details Updated'}
                            <span className="text-xs font-normal text-warm-gray-500"> - by {entry.username} on {new Date(entry.timestamp).toLocaleString()}</span>
                        </p>
                        <p className="text-sm italic text-warm-gray-600 dark:text-warm-gray-400">Reason: {entry.reason}</p>
                        {entry.changes && entry.changes.length > 0 && (
                            <div className="mt-2 text-xs p-2 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-md">
                                <p className="font-semibold">Changes:</p>
                                <ul className="list-disc pl-5">
                                    {entry.changes.map((change, cIndex) => (
                                        <li key={cIndex}>
                                            <strong>{change.field}:</strong> "{change.from || 'empty'}" → "{change.to || 'empty'}"
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
