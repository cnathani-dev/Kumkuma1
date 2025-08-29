
import React from 'react';
import { Event, EventState } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { EventCard } from '../../../components/EventCard';
import { primaryButton } from '../../../components/common/styles';
import { Plus } from 'lucide-react';

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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clientEvents.map(event => (
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
            )}
        </div>
    );
};
