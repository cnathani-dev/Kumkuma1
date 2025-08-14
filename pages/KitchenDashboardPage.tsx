import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEvents, useItems, useAppCategories, useLiveCounters, useLiveCounterItems, useClients } from '../App';
import { Event } from '../types';
import { LogOut, Calendar, Clock, MapPin, Users } from 'lucide-react';
import { exportToPdfWithOptions } from '../lib/export';
import { dateToYYYYMMDD, formatYYYYMMDD } from '../lib/utils';

const KitchenEventCard = ({ event, onClick }: { event: Event, onClick: () => void }) => {
    return (
        <div 
            onClick={onClick}
            className="p-5 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
            <h4 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200">{event.eventType}</h4>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-warm-gray-500 mt-2">
                <span className="flex items-center gap-1.5"><Calendar size={14}/> {formatYYYYMMDD(event.date)}</span>
                <span className="flex items-center gap-1.5"><Clock size={14}/> {event.session.charAt(0).toUpperCase() + event.session.slice(1)}</span>
                <span className="flex items-center gap-1.5"><MapPin size={14}/> {event.location}</span>
                <span className="flex items-center gap-1.5"><Users size={14}/> {event.pax || 0} PAX</span>
            </div>
        </div>
    );
};


export const KitchenDashboardPage = () => {
    const { logout } = useAuth();
    const { events } = useEvents();
    const { items: allItems } = useItems();
    const { categories: allCategories } = useAppCategories();
    const { liveCounters } = useLiveCounters();
    const { liveCounterItems } = useLiveCounterItems();
    const { clients } = useClients();
    
    const confirmedEvents = useMemo(() => {
        const todayStr = dateToYYYYMMDD(new Date());

        return events
            .filter(e => e.state === 'confirmed' && e.date >= todayStr)
            .sort((a,b) => a.date.localeCompare(b.date));
    }, [events]);

    const handleEventClick = (event: Event) => {
        const client = clients.find(c => c.id === event.clientId);
        if (!client) {
            alert("Could not find the client for this event.");
            return;
        }
        try {
            exportToPdfWithOptions(event, client, allItems, allCategories, liveCounters, liveCounterItems, 'elegance');
        } catch (e) {
            console.error("Failed to generate PDF for kitchen user:", e);
            alert("Could not generate the menu PDF.");
        }
    };

    return (
        <div className="min-h-screen bg-ivory dark:bg-warm-gray-900 text-warm-gray-700 dark:text-warm-gray-200">
             <header className="bg-white dark:bg-warm-gray-800 shadow-md p-2 sm:p-4 flex justify-between items-center sticky top-0 z-40">
                <div className="leading-none text-center">
                    <span className="font-display font-bold text-xl sm:text-2xl text-accent-500 tracking-normal">kumkuma</span>
                    <span className="block font-body text-[0.5rem] sm:text-[0.6rem] text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.2em] uppercase">CATERERS</span>
                </div>
                <button onClick={logout} className="flex items-center gap-2 text-sm font-semibold text-warm-gray-600 hover:text-accent-500 dark:text-warm-gray-300 dark:hover:text-accent-400 transition-colors">
                    <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
                </button>
            </header>
            <main className="p-4 sm:p-8">
                 <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                        Upcoming Events
                    </h1>
                </div>
                 {confirmedEvents.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {confirmedEvents.map(event => (
                             <KitchenEventCard 
                                 key={event.id}
                                 event={event}
                                 onClick={() => handleEventClick(event)}
                             />
                         ))}
                     </div>
                 ) : (
                    <div className="text-center py-16">
                        <p className="text-warm-gray-500">There are no upcoming confirmed events at this time.</p>
                    </div>
                 )}
            </main>
        </div>
    );
};