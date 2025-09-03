import React, { useMemo } from 'react';
import { Event, EventState } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { EventCard } from '../../../components/EventCard';
import { primaryButton } from '../../../components/common/styles';
import { Plus } from 'lucide-react';
import { yyyyMMDDToDate } from '../../../lib/utils';

type PageState = 'LIST' | 'MENU_CREATOR' | 'FINANCE' | 'SERVICE_PLANNER' | 'KITCHEN_PLAN';

export const EventsTab: React.FC<{
    clientEvents: Event[];
    canModify: boolean;
    canAccessFinances: boolean;
    onAddEvent: () => void;
    onEditEvent: (e: Event) => void;
    onDeleteEvent: (e: Event) => void;
    onDuplicateEvent: (e: Event) => void;
    onNavigate: (e: Event, state: PageState) => void;
    onStateChange: (event: Event, newState: EventState) => void;
    onRequestCancel: (event: Event) => void;
    onRequestLost: (event: Event) => void;
}> = ({ clientEvents, canModify, canAccessFinances, onAddEvent, onEditEvent, onDeleteEvent, onDuplicateEvent, onNavigate, onStateChange, onRequestCancel, onRequestLost }) => {
    const { currentUser } = useAuth();

    const groupedEvents = useMemo(() => {
        // clientEvents is already sorted newest-first from ClientDetailsPage
        const groups: { [key: string]: { monthName: string, events: Event[] } } = {};

        clientEvents.forEach(event => {
            const eventDate = yyyyMMDDToDate(event.startDate);
            const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
            const monthName = eventDate.toLocaleString('default', { month: 'long', year: 'numeric' });

            if (!groups[monthKey]) {
                groups[monthKey] = { monthName, events: [] };
            }
            groups[monthKey].events.push(event);
        });

        // Sort groups by month key (YYYY-MM) descending for newest first
        return Object.keys(groups).sort().reverse().map(key => groups[key]);
    }, [clientEvents]);

    return (
        <div>
            <div className="flex justify-end mb-4">
                {canModify && (
                    <button onClick={onAddEvent} className={primaryButton}>
                        <Plus size={16} /> Add Event
                    </button>
                )}
            </div>
            {clientEvents.length === 0 ? (
                <p className="text-center text-warm-gray-500 py-8">No events found for this client.</p>
            ) : (
                <div className="space-y-8">
                    {groupedEvents.map(({ monthName, events }) => (
                        <div key={monthName}>
                            <h3 className="font-bold text-lg mb-4 text-primary-600 dark:text-primary-400">{monthName}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {events.map(event => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        onEdit={() => onEditEvent(event)}
                                        onDelete={() => onDeleteEvent(event)}
                                        onDuplicate={() => onDuplicateEvent(event)}
                                        onNavigate={(pageState) => onNavigate(event, pageState)}
                                        canModify={canModify}
                                        canAccessFinances={canAccessFinances}
                                        onStateChange={onStateChange}
                                        onRequestCancel={onRequestCancel}
                                        onRequestLost={onRequestLost}
                                        userRole={currentUser?.role}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
