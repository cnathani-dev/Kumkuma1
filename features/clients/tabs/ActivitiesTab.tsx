
import React, { useState, useMemo, useEffect } from 'react';
import { Client } from '../../../types';
import { useClientActivities, useClientActivityTypeSettings } from '../../../contexts/AppContexts';
import { useAuth } from '../../../contexts/AuthContext';
import { primaryButton, inputStyle } from '../../../components/common/styles';
import { LucideIcon } from '../../../components/common/LucideIcon';

export const ActivitiesTab: React.FC<{ client: Client }> = ({ client }) => {
    const { activities, addActivity } = useClientActivities();
    const { settings: activityTypes } = useClientActivityTypeSettings();
    const { currentUser } = useAuth();
    const [details, setDetails] = useState('');
    const [typeId, setTypeId] = useState('');

    useEffect(() => {
        if (activityTypes.length > 0 && !typeId) {
            setTypeId(activityTypes[0].id);
        }
    }, [activityTypes, typeId]);

    const clientActivities = useMemo(() =>
        activities.filter(a => a.clientId === client.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [activities, client.id]);

    const handleAddActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!details.trim() || !typeId || !currentUser) return;
        const typeName = activityTypes.find(t => t.id === typeId)?.name || 'Note';
        await addActivity({
            clientId: client.id,
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            username: currentUser.username,
            typeId,
            typeName,
            details: details.trim(),
        });
        setDetails('');
    };

    return (
        <div>
            <form onSubmit={handleAddActivity} className="mb-6 p-4 bg-warm-gray-50 dark:bg-warm-gray-800/50 rounded-lg space-y-3">
                <h4 className="font-bold">Add Activity / Note</h4>
                <textarea value={details} onChange={e => setDetails(e.target.value)} required rows={3} className={inputStyle} placeholder="Record a phone call, meeting notes, etc..."></textarea>
                <div className="flex items-center justify-between">
                    <select value={typeId} onChange={e => setTypeId(e.target.value)} className={inputStyle + " w-auto"}>
                        {activityTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>
                    <button type="submit" className={primaryButton}>Add Activity</button>
                </div>
            </form>

            <div className="space-y-4">
                {clientActivities.length === 0 ? <p className="text-center text-warm-gray-500 py-8">No activities recorded for this client.</p> :
                    clientActivities.map(activity => (
                        <div key={activity.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                <span className="p-2 bg-primary-100 rounded-full dark:bg-primary-900/50">
                                    <LucideIcon name={activityTypes.find(t => t.id === activity.typeId)?.icon || 'MessageSquare'} size={20} className="text-primary-600 dark:text-primary-300"/>
                                </span>
                                <div className="flex-grow w-px bg-warm-gray-200 dark:bg-warm-gray-700"></div>
                            </div>
                            <div className="pb-4 flex-grow">
                                <p className="font-semibold">{activity.typeName} <span className="text-xs font-normal text-warm-gray-500">- by {activity.username} on {new Date(activity.timestamp).toLocaleDateString()}</span></p>
                                <p className="text-sm whitespace-pre-wrap">{activity.details}</p>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};
