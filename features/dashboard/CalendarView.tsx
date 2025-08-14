

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Event, EventSession, EventState, Client } from '../../types';
import { useLocations } from '../../App';
import { secondaryButton } from '../../components/common/styles';
import { dateToYYYYMMDD } from '../../lib/utils';

const sessionIndicator = (session: EventSession) => {
    const config = {
        breakfast: { char: 'B', color: 'bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
        lunch: { char: 'L', color: 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
        dinner: { char: 'D', color: 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300' },
    }[session];

    return (
        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm ${config.color} border border-black/20 dark:border-white/20`}>
            {config.char}
        </div>
    )
}

const statusColors: Record<EventState, string> = {
    lead: 'bg-yellow-400',
    confirmed: 'bg-green-500',
    lost: 'bg-red-500',
    cancelled: 'bg-gray-400',
};


export const CalendarView = ({ events, onDateSelect, clients }: { 
    events: Event[], 
    onDateSelect: (date: string) => void,
    clients: Client[],
}) => {
    const { locations } = useLocations();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());

    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);

    const locationColorMap = useMemo(() => {
        const map = new Map<string, string>();
        locations.forEach(loc => {
            if (loc.name && loc.color) {
                map.set(loc.name, loc.color);
            }
        });
        return map;
    }, [locations]);

    const startOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), [currentDate]);
    const endOfMonth = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), [currentDate]);

    const daysInMonth = useMemo(() => {
        const days = [];
        const dayOfWeek = startOfMonth.getDay();
        for (let i = 0; i < dayOfWeek; i++) {
            days.push(null);
        }
        for (let i = 1; i <= endOfMonth.getDate(); i++) {
            days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
        }
        return days;
    }, [startOfMonth, endOfMonth, currentDate]);
    
    const handleLocationToggle = (locationName: string) => {
        setSelectedLocations(prev => {
            const newSet = new Set(prev);
            if(locationName === 'ALL') {
                newSet.clear();
            } else if (newSet.has(locationName)) {
                newSet.delete(locationName);
            } else {
                newSet.add(locationName);
            }
            return newSet;
        });
    };
    
    const filteredEvents = useMemo(() => {
        if (selectedLocations.size === 0) return events;
        return events.filter(event => selectedLocations.has(event.location));
    }, [events, selectedLocations]);
    
    const eventsByDate = useMemo(() => {
        const grouped: Record<string, Event[]> = {};
        filteredEvents.forEach(event => {
            const dateKey = event.date; // event.date is already 'YYYY-MM-DD' and timezone-agnostic
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(event);
        });
        return grouped;
    }, [filteredEvents]);

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const allLocationOptions = useMemo(() => {
        return locations.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
    }, [locations]);

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <button onClick={() => changeMonth(-1)} className={secondaryButton}><ChevronLeft size={16}/></button>
                    <h4 className="text-xl font-bold text-warm-gray-800 dark:text-warm-gray-200 text-center w-48">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h4>
                    <button onClick={() => changeMonth(1)} className={secondaryButton}><ChevronRight size={16}/></button>
                </div>
            </div>
             <div className="flex flex-wrap items-center gap-2 mb-4 p-2 rounded-md bg-warm-gray-50 dark:bg-warm-gray-900/40">
                <span className="text-sm font-semibold mr-2">Filter:</span>
                 <button onClick={() => handleLocationToggle('ALL')} className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${selectedLocations.size === 0 ? 'bg-primary-500 text-white border-primary-500' : 'bg-transparent border-warm-gray-300'}`}>All</button>
                 {allLocationOptions.map(loc => (
                     <button key={loc.id} onClick={() => handleLocationToggle(loc.name)} className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${selectedLocations.has(loc.name) ? 'ring-2 ring-primary-500' : 'opacity-70'}`} style={{backgroundColor: loc.color}}>
                         {loc.name}
                     </button>
                 ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-bold text-sm text-warm-gray-500 p-2">{day}</div>
                ))}
                {daysInMonth.map((day, index) => {
                    if (!day) return <div key={`empty-${index}`}></div>;
                    const dateKey = dateToYYYYMMDD(day);

                    const dayEvents = eventsByDate[dateKey] || [];
                    const isToday = new Date().toDateString() === day.toDateString();
                    return (
                        <div key={index} 
                            className="border border-warm-gray-200 dark:border-warm-gray-700 rounded-md min-h-[120px] p-2 flex flex-col gap-1 transition-colors cursor-pointer hover:bg-warm-gray-50 dark:hover:bg-warm-gray-700/50"
                            onClick={() => onDateSelect(dateKey)}
                        >
                            <span className={`font-bold ${isToday ? 'bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>{day.getDate()}</span>
                             <div className="flex-grow space-y-1 overflow-y-auto">
                                {dayEvents.map(event => {
                                    const locationColor = locationColorMap.get(event.location);
                                    const cardStyle = locationColor ? { backgroundColor: locationColor } : {};
                                    const hasCustomColor = !!locationColor;

                                    return (
                                        <div 
                                            key={event.id}
                                            className={`p-1.5 rounded-md text-xs ${!hasCustomColor ? 'bg-primary-50 dark:bg-primary-900/40' : ''}`}
                                            style={cardStyle}
                                        >
                                            <div className="flex justify-between items-start gap-1">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span 
                                                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColors[event.state]}`} 
                                                        title={event.state.charAt(0).toUpperCase() + event.state.slice(1)}
                                                    ></span>
                                                    <div className="flex-grow min-w-0">
                                                        <p className={`font-semibold ${hasCustomColor ? 'text-black/80' : 'text-warm-gray-700 dark:text-warm-gray-200'} leading-tight truncate`}>
                                                            {clientMap.get(event.clientId) || 'Unknown Client'}
                                                        </p>
                                                        <p className={`${hasCustomColor ? 'text-black/60' : 'text-warm-gray-500'} truncate text-xs`}>{event.eventType}</p>
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    {sessionIndicator(event.session)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};