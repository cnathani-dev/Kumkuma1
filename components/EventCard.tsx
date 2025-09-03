import React, { useMemo } from 'react';
import { useTemplates, useEvents, useClients, useRestaurants } from '../contexts/AppContexts';
import { useAuth } from '../contexts/AuthContext';
import { useUserPermissions } from '../hooks/usePermissions';
import { Event, EventState, UserRole } from '../types';
import { FileEdit, Salad, Banknote, Lock, Unlock, Edit, Trash2, BadgeHelp, BadgeCheck, BadgeX, Calendar, Clock, MapPin, Users, ConciergeBell, ChefHat, Copy, BadgeAlert, CheckCircle, XCircle, Ban, FileWarning } from 'lucide-react';
import { formatDateRange } from '../lib/utils';
import { primaryButton } from './common/styles';

const secondaryButton = "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-warm-gray-300 dark:border-warm-gray-600 hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 disabled:opacity-50 disabled:cursor-not-allowed";
const iconButton = (colorClass: string) => `p-2 rounded-full ${colorClass} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`;

interface EventCardProps {
    event: Event;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onNavigate: (state: 'MENU_CREATOR' | 'FINANCE' | 'SERVICE_PLANNER' | 'KITCHEN_PLAN') => void;
    canModify: boolean;
    canAccessFinances: boolean;
    showClientName?: boolean;
    onClientClick?: () => void;
    onStateChange: (event: Event, newState: EventState) => void;
    onRequestCancel: (event: Event) => void;
    onRequestLost: (event: Event) => void;
    userRole?: UserRole;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onEdit, onDelete, onDuplicate, onNavigate, canModify, canAccessFinances, showClientName = false, onClientClick, onStateChange, onRequestCancel, onRequestLost, userRole }) => {
    const { updateEvent } = useEvents();
    const { templates } = useTemplates();
    const { clients } = useClients();
    const { restaurants } = useRestaurants();
    const { currentUser } = useAuth();
    const permissions = useUserPermissions();

    const clientName = useMemo(() => {
        if (!showClientName) return '';
        return clients.find(c => c.id === event.clientId)?.name || 'Unknown Client';
    }, [clients, event.clientId, showClientName]);
    
    const template = useMemo(() => {
        if (!event.templateId) return null;
        return templates.find(t => t.id === event.templateId) || null;
    }, [templates, event.templateId]);

    const creatorUsername = useMemo(() => {
        return event.history?.find(h => h.action === 'created')?.username;
    }, [event.history]);

    const restaurantName = useMemo(() => {
        if (event.location === 'ODC' && event.restaurantId) {
            return restaurants.find(r => r.id === event.restaurantId)?.name;
        }
        return null;
    }, [restaurants, event.location, event.restaurantId]);

    const menuFinalized = event.status === 'finalized';
    const isReadOnly = event.state === 'lost' || event.state === 'cancelled';
    const showMenuButtons = event.templateId !== 'NO_FOOD';
    const isKitchenUser = userRole === 'kitchen';
    const isClientUser = userRole === 'regular';

    const toggleMenuStatus = () => {
        if (!canModify || isReadOnly) return;
        const newStatus = event.status === 'draft' ? 'finalized' : 'draft';
        if (newStatus === 'finalized' && !window.confirm('Are you sure you want to finalize this menu? It will become read-only.')) {
            return;
        }
        updateEvent({ ...event, status: newStatus });
    };

    const handleClientFinalize = () => {
        if (window.confirm('Are you sure you want to finalize this menu? You will no longer be able to make changes.')) {
            updateEvent({ ...event, status: 'finalized' });
        }
    };

    const statusBadge = (state: EventState) => {
        const badges = {
            lead: { icon: BadgeHelp, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-400', label: 'Lead' },
            confirmed: { icon: BadgeCheck, color: 'text-green-600 bg-green-100 dark:bg-green-900/50 dark:text-green-400', label: 'Confirmed' },
            lost: { icon: BadgeX, color: 'text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-400', label: 'Lost' },
            cancelled: { icon: BadgeAlert, color: 'text-gray-600 bg-gray-200 dark:bg-gray-700 dark:text-gray-300', label: 'Cancelled' },
        };
        const BadgeIcon = badges[state].icon;
        return (
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${badges[state].color}`}>
                <BadgeIcon size={14} />
                {badges[state].label}
            </span>
        );
    }
    
    return (
        <div className={`p-5 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md ${isReadOnly ? 'opacity-70' : ''}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                <div>
                    {showClientName ? (
                        <>
                            {onClientClick ? (
                                <button onClick={onClientClick} className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200 text-left hover:underline focus:outline-none">
                                    {clientName}
                                </button>
                            ) : (
                                <h4 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200">{clientName}</h4>
                            )}
                            <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">{event.eventType}</p>
                        </>
                    ) : (
                        <h4 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200">{event.eventType}</h4>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-warm-gray-500 mt-1">
                        <span className="flex items-center gap-1.5"><Calendar size={14}/> {formatDateRange(event.startDate, event.endDate)}</span>
                        <span className="flex items-center gap-1.5"><Clock size={14}/> {event.session.charAt(0).toUpperCase() + event.session.slice(1)}</span>
                        <span className="flex items-center gap-1.5"><MapPin size={14}/> {event.location} {restaurantName && `(${restaurantName})`}</span>
                        <span className="flex items-center gap-1.5"><Users size={14}/> {event.pax || 0} PAX</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {creatorUsername && <span className="text-xs text-warm-gray-400">Created by: {creatorUsername}</span>}
                    <div className="flex items-center gap-2">
                         {userRole === 'kitchen' && event.status === 'draft' && showMenuButtons && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" title="This menu has not been finalized and is subject to change.">
                                <FileWarning size={14} />
                                Menu In Draft
                            </span>
                        )}
                        {statusBadge(event.state)}
                    </div>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
                <div className="flex flex-wrap gap-4 justify-between items-center">
                    {/* Primary Actions (Left) */}
                    <div className="flex flex-wrap gap-2 items-center">
                        {isKitchenUser ? (
                            <>
                                {showMenuButtons && (
                                    <button onClick={() => onNavigate('MENU_CREATOR')} className={secondaryButton}>
                                        <FileEdit size={16}/> View Menu
                                    </button>
                                )}
                                <button onClick={() => onNavigate('KITCHEN_PLAN')} className={secondaryButton}>
                                    <ChefHat size={16}/> Kitchen Plan
                                </button>
                            </>
                        ) : isClientUser ? (
                             <>
                                {showMenuButtons && (
                                    <>
                                        <button onClick={() => onNavigate('MENU_CREATOR')} className={secondaryButton}>
                                            <FileEdit size={16}/> {isReadOnly ? 'View Menu' : 'Edit Menu'}
                                        </button>
                                        {!menuFinalized && !isReadOnly && (
                                            <button onClick={handleClientFinalize} className={primaryButton}>
                                                Finalize Menu
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                {showMenuButtons && (
                                    <>
                                        <button onClick={() => onNavigate('MENU_CREATOR')} className={secondaryButton} disabled={!showMenuButtons}>
                                            <FileEdit size={16}/> {isReadOnly ? 'View Menu' : 'Edit Menu'}
                                        </button>
                                        <button onClick={() => onNavigate('SERVICE_PLANNER')} className={secondaryButton} disabled={isReadOnly}>
                                            <ConciergeBell size={16}/> Service Plan
                                        </button>
                                        <button onClick={() => onNavigate('KITCHEN_PLAN')} className={secondaryButton}>
                                            <ChefHat size={16}/> Kitchen Plan
                                        </button>
                                    </>
                                )}
                                {canAccessFinances &&
                                    <button onClick={() => onNavigate('FINANCE')} className={secondaryButton}>
                                        <Banknote size={16}/> Finances
                                    </button>
                                }
                            </>
                        )}
                    </div>

                    {/* Secondary Actions (Right) */}
                    {!isKitchenUser && !isClientUser && canModify && (
                        <div className="flex flex-wrap gap-2 items-center">
                            {event.state === 'lead' && (
                                <>
                                    <button onClick={() => onStateChange(event, 'confirmed')} className={iconButton('hover:bg-green-100 dark:hover:bg-green-800')} title="Confirm Event">
                                        <CheckCircle size={16} className="text-green-600"/>
                                    </button>
                                    <button onClick={() => onRequestLost(event)} className={iconButton('hover:bg-red-100 dark:hover:bg-red-800')} title="Mark as Lost">
                                        <XCircle size={16} className="text-red-600"/>
                                    </button>
                                </>
                            )}
                             {event.state === 'confirmed' && permissions?.allowEventCancellation && (
                                <button onClick={() => onRequestCancel(event)} className={iconButton('hover:bg-red-100 dark:hover:bg-red-800')} title="Cancel Event">
                                    <Ban size={16} className="text-red-600"/>
                                </button>
                            )}
                            <button onClick={onEdit} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')} disabled={isReadOnly} title="Edit Event Details">
                                <Edit size={16} className="text-primary-600" />
                            </button>
                            <button onClick={onDuplicate} className={iconButton('hover:bg-blue-100 dark:hover:bg-blue-800')} title="Duplicate Event">
                                <Copy size={16} className="text-blue-600" />
                            </button>
                            {showMenuButtons &&
                                <button onClick={toggleMenuStatus} className={iconButton('hover:bg-yellow-100 dark:hover:bg-yellow-800')} title={menuFinalized ? 'Unlock Menu' : 'Finalize and Lock Menu'} disabled={isReadOnly}>
                                    {menuFinalized ? <Lock size={16} className="text-yellow-600" /> : <Unlock size={16} className="text-yellow-600" />}
                                </button>
                            }
                            {currentUser?.role === 'admin' &&
                                   <button onClick={onDelete} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')} title="Delete Event">
                                       <Trash2 size={16} className="text-accent-500" />
                                   </button>
                            }
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
