import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLocations, useRoles } from '../contexts/AppContexts';
import { AppPermissions, LocationSetting, Role } from '../types';

// This hook centralizes permission logic
export const useUserPermissions = () => {
    const { currentUser } = useAuth();
    const { roles } = useRoles(); // Use the context to get roles
    const [rolesLoaded, setRolesLoaded] = useState(false);

    // Note: The logic to fetch roles is now within the RolesProvider.
    // This hook just consumes the context.
    useEffect(() => {
        // We can check if the roles array has been populated
        if (roles.length > 0 || (currentUser && currentUser.role !== 'staff')) {
            setRolesLoaded(true);
        }
    }, [roles, currentUser]);


    return useMemo(() => {
        if (!currentUser) return null;
        
        if (currentUser.role === 'admin') {
            const allPermissions: AppPermissions = {
                dashboard: 'modify', itemBank: 'modify', catalogs: 'modify',
                templates: 'modify', liveCounters: 'modify', reports: 'modify',
                users: 'modify', settings: 'modify', clientsAndEvents: 'modify',
                financeCore: 'modify',
                financeCharges: 'modify',
                financePayments: 'modify',
                financeExpenses: 'modify',
                competition: 'modify',
                lostReasons: 'modify',
                muhurthams: 'modify',
                clientActivityTypes: 'modify',
                allowEventCancellation: true,
            };
            return allPermissions;
        }

        if (currentUser.role === 'kitchen') {
            const KITCHEN_PERMISSIONS: AppPermissions = {
                dashboard: 'view',
                itemBank: 'none', catalogs: 'none', templates: 'none',
                liveCounters: 'none', reports: 'none', users: 'none',
                settings: 'none', clientsAndEvents: 'none',
                financeCore: 'none', financeCharges: 'none', financePayments: 'none', financeExpenses: 'none',
                competition: 'none', lostReasons: 'none', muhurthams: 'none',
                clientActivityTypes: 'none', allowEventCancellation: false,
            };
            return KITCHEN_PERMISSIONS;
        }

        if (currentUser.role === 'staff') {
            if (!rolesLoaded) {
                return null; // Indicate that permissions are still loading
            }
            
            if (currentUser.roleId) {
                const role = roles.find(r => r.id === currentUser.roleId);
                if (role) {
                    return role.permissions;
                }
            }
            const NO_ACCESS_PERMISSIONS: AppPermissions = {
                dashboard: 'none', itemBank: 'none', catalogs: 'none',
                templates: 'none', liveCounters: 'none', reports: 'none',
                users: 'none', settings: 'none', clientsAndEvents: 'none',
                financeCore: 'none',
                financeCharges: 'none',
                financePayments: 'none',
                financeExpenses: 'none',
                competition: 'none',
                lostReasons: 'none',
                muhurthams: 'none',
                clientActivityTypes: 'none',
                allowEventCancellation: false,
            };
            return NO_ACCESS_PERMISSIONS;
        }
        return null;
    }, [currentUser, roles, rolesLoaded]);
};

export const useManagedLocations = (): LocationSetting[] => {
    const { currentUser } = useAuth();
    const { locations } = useLocations();

    return useMemo(() => {
        if (!currentUser || currentUser.role === 'admin' || !currentUser.managedLocationIds || currentUser.managedLocationIds.length === 0) {
            return locations;
        }
        
        const managedIds = new Set(currentUser.managedLocationIds);
        return locations.filter(loc => managedIds.has(loc.id));
    }, [currentUser, locations]);
};
