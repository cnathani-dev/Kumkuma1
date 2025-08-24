import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Event, EventSession, EventState, Client } from '../../types';
import { useLocations, useMuhurthamDates } from '../../contexts/AppContexts';
import { secondaryButton } from '../../components/common/styles';
import { dateToYYYYMMDD, yyyyMMDDToDate, formatYYYYMMDD } from '../../lib/utils';

const statusColors: Record<EventState, string> = {
    lead: '#facc15', // yellow-400
    confirmed: '#22c55e', // green-500
    lost: '#ef4444', // red-500
    cancelled: '#a3a3a3', // warm-gray-400
};

export const CalendarView = ({ events, onDateSelect, clients, selectedLocations, onLocationChange }: { 
    events: Event[], 
    onDateSelect: (date: string) => void,
    clients: Client[],
    selectedLocations: string[],
    onLocationChange: (locations: string[]) => void,
}) => {
    const { locations } = useLocations();
    const { muhurthamDates, addMuhurthamDate, deleteMuhurthamDateByDate } = useMuhurthamDates();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, date: string } | null>(null);

    const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.name])), [clients]);
    const locationColorMap = useMemo(() => new Map(locations.map(loc => [loc.name, loc.color || '#fff8e1'])), [locations]);
    const muhurthamDatesSet = useMemo(() => new Set(muhurthamDates.map(d => d.date)), [muhurthamDates]);
    const selectedLocationsSet = useMemo(() => new Set(selectedLocations), [selectedLocations]);

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const handleLocationToggle = (locationName: string) => {
        const newSet = new Set(selectedLocations);
        if (locationName === 'ALL') {
            newSet.clear();
        } else if (newSet.has(locationName)) {
            newSet.delete(locationName);
        } else {
            newSet.add(locationName);
        }
        onLocationChange(Array.from(newSet));
    };
    
    const filteredEvents = useMemo(() => {
        if (selectedLocationsSet.size === 0) return events;
        return events.filter(event => selectedLocationsSet.has(event.location));
    }, [events, selectedLocationsSet]);

    const { monthGrid, calendarStart, calendarEnd } = useMemo(() => {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const gridStart = new Date(startOfMonth);
        gridStart.setDate(gridStart.getDate() - startOfMonth.getDay());
        
        const grid = Array.from({ length: 42 }, (_, i) => {
            const day = new Date(gridStart);
            day.setDate(day.getDate() + i);
            return day;
        });
        
        return { monthGrid: grid, calendarStart: grid[0], calendarEnd: grid[41] };
    }, [currentDate]);

    const singleDayEventsByDate = useMemo(() => {
        const map = new Map<string, Event[]>();
        filteredEvents.forEach(event => {
            if (!event.endDate || event.startDate === event.endDate) {
                const dateKey = event.startDate;
                if (!map.has(dateKey)) {
                    map.set(dateKey, []);
                }
                map.get(dateKey)!.push(event);
            }
        });
        return map;
    }, [filteredEvents]);

    const weeklyLanes = useMemo(() => {
        const lanes: { event: Event; startCol: number; span: number; }[][][] = Array(6).fill(0).map(() => []);

        const eventsInView = filteredEvents
            .filter(event => {
                // Only process multi-day events for spanning
                if (!event.endDate || event.startDate === event.endDate) return false;
                
                const eventStart = yyyyMMDDToDate(event.startDate);
                const eventEnd = yyyyMMDDToDate(event.endDate);
                return eventStart <= calendarEnd && eventEnd >= calendarStart;
            })
            .sort((a, b) => a.startDate.localeCompare(b.startDate));

        for (const event of eventsInView) {
            const eventStart = yyyyMMDDToDate(event.startDate);
            const eventEnd = event.endDate ? yyyyMMDDToDate(event.endDate) : eventStart;
            
            let currentDay = new Date(eventStart > calendarStart ? eventStart : calendarStart);
            
            while (currentDay <= eventEnd && currentDay <= calendarEnd) {
                const weekIndex = Math.floor((currentDay.getTime() - monthGrid[0].getTime()) / (1000 * 3600 * 24 * 7));
                if (weekIndex < 0 || weekIndex >= 6) break;

                const startOfWeek = monthGrid[weekIndex * 7];
                const endOfWeek = monthGrid[weekIndex * 7 + 6];

                const segmentStart = currentDay > startOfWeek ? currentDay : startOfWeek;
                const segmentEnd = eventEnd < endOfWeek ? eventEnd : endOfWeek;
                
                const startCol = segmentStart.getDay();
                const span = Math.round((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 3600 * 24)) + 1;
                
                let placed = false;
                for (let i = 0; i < lanes[weekIndex].length; i++) {
                    const lane = lanes[weekIndex][i];
                    if (!lane.some(s => startCol < s.startCol + s.span && startCol + span > s.startCol)) {
                        lane.push({ event, startCol, span });
                        placed = true;
                        break;
                    }
                }
                
                if (!placed) {
                    lanes[weekIndex].push([{ event, startCol, span }]);
                }

                currentDay = new Date(segmentEnd);
                currentDay.setDate(currentDay.getDate() + 1);
            }
        }
        return lanes;
    }, [filteredEvents, calendarStart, calendarEnd, monthGrid]);

    const allLocationOptions = useMemo(() => locations.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)), [locations]);

    const handleContextMenu = (e: React.MouseEvent, date: string) => {
        e.preventDefault();
        setContextMenu({ x: e.pageX, y: e.pageY, date });
    };
    
    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };
    
    useEffect(() => {
        window.addEventListener('click', handleCloseContextMenu);
        return () => {
            window.removeEventListener('click', handleCloseContextMenu);
        };
    }, []);

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-4 rounded-lg shadow-md">
            {contextMenu && (
                <div
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    className="absolute z-50 bg-white dark:bg-warm-gray-800 shadow-lg rounded-md p-2 text-sm border border-warm-gray-200 dark:border-warm-gray-700"
                >
                    <div className="font-bold pb-1 mb-1 border-b">{formatYYYYMMDD(contextMenu.date)}</div>
                    {muhurthamDatesSet.has(contextMenu.date) ? (
                        <button
                            onClick={() => deleteMuhurthamDateByDate(contextMenu.date)}
                            className="w-full text-left px-2 py-1 rounded hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
                        >
                            Unmark as Muhurtham Day
                        </button>
                    ) : (
                        <button
                            onClick={() => addMuhurthamDate(contextMenu.date)}
                            className="w-full text-left px-2 py-1 rounded hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700"
                        >
                            Mark as Muhurtham Day
                        </button>
                    )}
                </div>
            )}
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
                 <button onClick={() => handleLocationToggle('ALL')} className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${selectedLocations.length === 0 ? 'bg-primary-500 text-white border-primary-500' : 'bg-transparent border-warm-gray-300'}`}>All</button>
                 {allLocationOptions.map(loc => (
                     <button key={loc.id} onClick={() => handleLocationToggle(loc.name)} className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${selectedLocations.includes(loc.name) ? 'ring-2 ring-primary-500' : 'opacity-70'}`} style={{backgroundColor: loc.color}}>
                         {loc.name}
                     </button>
                 ))}
            </div>
            <div className="grid grid-cols-7">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-bold text-sm text-warm-gray-500 p-2">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-1 grid-rows-6 gap-px bg-warm-gray-200 dark:bg-warm-gray-700 border border-warm-gray-200 dark:border-warm-gray-700">
                {weeklyLanes.map((week, weekIndex) => (
                    <div key={weekIndex} className="relative grid grid-cols-7 grid-rows-1 gap-px min-h-[120px]">
                        {monthGrid.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => {
                            const isToday = new Date().toDateString() === day.toDateString();
                            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                            const dayKey = dateToYYYYMMDD(day);
                            const eventsForDay = singleDayEventsByDate.get(dayKey) || [];

                            return (
                                <div key={dayIndex} className="bg-white dark:bg-warm-gray-800 p-1 flex flex-col relative" onClick={() => onDateSelect(dayKey)} onContextMenu={(e) => handleContextMenu(e, dayKey)}>
                                    {muhurthamDatesSet.has(dayKey) && (
                                        <span className="absolute top-1 left-1 text-lg z-20" title="Muhurtham Day">🌟</span>
                                    )}
                                    <span className={`relative z-10 font-bold text-xs p-1 rounded-full w-6 h-6 flex items-center justify-center self-end ${isToday ? 'bg-primary-500 text-white' : ''} ${isCurrentMonth ? 'text-warm-gray-700 dark:text-warm-gray-200' : 'text-warm-gray-400 dark:text-warm-gray-500'}`}>
                                        {day.getDate()}
                                    </span>
                                    <div className="flex-grow overflow-y-auto space-y-1 mt-1 pr-1 -mr-1">
                                        {eventsForDay.map(event => {
                                            const clientName = clientMap.get(event.clientId) || 'Unknown Client';
                                            const locationColor = locationColorMap.get(event.location);
                                            const sessionInitial = event.session.charAt(0).toUpperCase();
                                            const statusColor = event.state === 'confirmed' ? 'bg-green-500' : 'bg-yellow-400';
                                            
                                            return (
                                                <div
                                                    key={event.id}
                                                    style={{ backgroundColor: locationColor }}
                                                    className="p-1 rounded text-xs shadow-sm cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); onDateSelect(event.startDate); }}
                                                >
                                                    <div className="flex justify-between items-center gap-2">
                                                        <div className="flex items-center gap-1.5 overflow-hidden flex-grow">
                                                            <span className={`w-2 h-2 rounded-full ${statusColor} flex-shrink-0`} title={event.state}></span>
                                                            <div className="overflow-hidden">
                                                                <p className="font-semibold text-black/80 truncate">{clientName}</p>
                                                                <p className="text-xs text-black/60 truncate">{event.eventType} ({event.pax} PAX)</p>
                                                            </div>
                                                        </div>
                                                        <div
                                                            style={{ backgroundColor: statusColors[event.state] }}
                                                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                                        >
                                                            {sessionInitial}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        {week.map((lane, laneIndex) => (
                            lane.map((segment, segIndex) => {
                                const { event, startCol, span } = segment;
                                const locationColor = locationColorMap.get(event.location);
                                const clientName = clientMap.get(event.clientId) || 'Unknown Client';
                                return (
                                    <div
                                        key={`${event.id}-${weekIndex}-${segIndex}`}
                                        className="absolute p-1 text-xs rounded-md shadow-sm overflow-hidden cursor-pointer"
                                        style={{
                                            top: `${laneIndex * 40 + 4}px`,
                                            left: `calc(${startCol / 7 * 100}% + 1px)`,
                                            width: `calc(${span / 7 * 100}% - 2px)`,
                                            minHeight: '38px',
                                            backgroundColor: locationColor || '#fff8e1',
                                            borderLeft: `3px solid ${statusColors[event.state]}`,
                                        }}
                                        onClick={() => onDateSelect(event.startDate)}
                                    >
                                        <div className="flex items-center gap-1.5 overflow-hidden h-full">
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0`} style={{ backgroundColor: statusColors[event.state] }} title={event.state}></span>
                                            <div className="overflow-hidden">
                                                <p className="font-semibold text-black/80 leading-tight truncate">{clientName}</p>
                                                <p className="text-xs text-black/60 leading-tight truncate">{event.eventType} ({event.pax} PAX)</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};