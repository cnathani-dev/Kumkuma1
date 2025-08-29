import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { User, Role, AppPermissions, LocationSetting } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, where, setDoc, doc, writeBatch, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { logAuditEvent } from '../lib/audit';
import { useLocations } from './AppContexts';

interface AuthContextType {
    currentUser: User | null;
    isInitializing: boolean;
    login: (user: string, pass:string) => Promise<{success: boolean, message: string}>;
    logout: () => void;
    changePassword: (oldPass: string, newPass: string) => Promise<{success: boolean, message: string}>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// This hook centralizes permission logic
export const useUserPermissions = () => {
    const { currentUser } = useAuth();
    const [roles, setRoles] = useState<Role[]>([]);
    const [rolesLoaded, setRolesLoaded] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "roles"), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Role[];
            setRoles(data);
            setRolesLoaded(true);
        });
        return () => unsub();
    }, []);

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
            // Kitchen users only need dashboard access in the main admin view.
            // Their access to other kitchen-specific pages is controlled by their role directly.
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
            // If staff user has no roleId or the role is not found, return a default no-access object.
            // This prevents the app from crashing and provides a safe fallback.
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

        // Regular users have no admin panel permissions, so return null.
        return null;
    }, [currentUser, roles, rolesLoaded]);
};

export const useManagedLocations = (): LocationSetting[] => {
    const { currentUser } = useAuth();
    const { locations } = useLocations();

    return useMemo(() => {
        if (!currentUser || currentUser.role === 'admin' || !currentUser.managedLocationIds || currentUser.managedLocationIds.length === 0) {
            return locations; // Admins and users without restrictions see all locations
        }
        
        const managedIds = new Set(currentUser.managedLocationIds);
        return locations.filter(loc => managedIds.has(loc.id));
    }, [currentUser, locations]);
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUser] = useLocalStorage<User | null>('currentUser', null);
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const seedInitialUsers = async () => {
            try {
                const usersRef = collection(db, "users");
                const usersSnapshot = await getDocs(usersRef);
                if (usersSnapshot.empty) {
                    console.log("No users found in database. Seeding initial admin and staff users...");
                    const batch = writeBatch(db);
                    
                    const adminUserData = {
                        username: "admin",
                        password: "password",
                        role: "admin",
                        status: "active",
                    };
                    batch.set(doc(usersRef), adminUserData);
                    
                    // The staff user is now seeded with a roleId after roles are seeded in App.tsx
                    // We can seed a basic staff user here, and it will get a role assigned if one exists.
                    const rolesQuery = query(collection(db, 'roles'), where('name', '==', 'General Manager'));
                    const rolesSnapshot = await getDocs(rolesQuery);
                    const defaultRoleId = rolesSnapshot.empty ? undefined : rolesSnapshot.docs[0].id;

                    const staffUserData = {
                        username: "staff",
                        password: "password",
                        role: "staff",
                        status: "active",
                        roleId: defaultRoleId,
                    };
                    batch.set(doc(usersRef), staffUserData);

                    await batch.commit();
                    console.log("Admin and staff users seeded successfully.");
                }
            } catch (error) {
                console.error("Error seeding initial users:", error);
            }
        };

        seedInitialUsers();
    }, []);

    useEffect(() => {
        setIsInitializing(false);
    }, []); // Run only once

    const login = async (username: string, pass: string): Promise<{success: boolean, message: string}> => {
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", username));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                return { success: false, message: "Invalid username or password." };
            }

            const userDoc = querySnapshot.docs[0];
            const firestoreData = userDoc.data();

            if (firestoreData.password !== pass) {
                return { success: false, message: "Invalid username or password." };
            }

            if (firestoreData.status === 'inactive') {
                return { success: false, message: "This user account is inactive. Please contact an administrator." };
            }

            // Defensively handle assignedClientId which might be a DocumentReference from Firestore
            let finalAssignedClientId: string | undefined = undefined;
            const rawClientId = firestoreData.assignedClientId;
            if (rawClientId) {
                // Duck-typing for a Firestore DocumentReference.
                // If it's an object with 'id' and 'path' properties, we assume it's a reference and extract the id.
                if (typeof rawClientId === 'object' && rawClientId.id && typeof rawClientId.path === 'string') {
                    finalAssignedClientId = rawClientId.id;
                } else if (typeof rawClientId === 'string') {
                    finalAssignedClientId = rawClientId;
                }
            }

            // Manually construct a plain user object to store.
            const userToStore: User = {
                id: userDoc.id,
                username: firestoreData.username,
                role: firestoreData.role,
                status: firestoreData.status || 'active',
                assignedClientId: finalAssignedClientId,
                roleId: firestoreData.roleId,
                managedLocationIds: firestoreData.managedLocationIds || [],
            };
            setCurrentUser(userToStore);

            await logAuditEvent({
                userId: userToStore.id,
                username: userToStore.username,
                action: 'LOGIN',
                details: 'User logged in successfully.',
                clientId: userToStore.assignedClientId
            });
            
            return { success: true, message: "Login successful." };
            
        } catch (error) {
            console.error("Error logging in:", error);
            return { success: false, message: "An unexpected error occurred." };
        }
    };

    const logout = async () => {
        if (currentUser) {
            await logAuditEvent({
                userId: currentUser.id,
                username: currentUser.username,
                action: 'LOGOUT',
                details: 'User logged out.',
                clientId: currentUser.assignedClientId
            });
        }
        setCurrentUser(null);
        // Also clear from local storage
        window.localStorage.removeItem('currentUser');
    };

    const changePassword = async (oldPass: string, newPass: string): Promise<{success: boolean, message: string}> => {
        if (!currentUser) {
            return { success: false, message: "No user is currently logged in." };
        }
        try {
            const userRef = doc(db, "users", currentUser.id);
            const userDoc = await getDoc(userRef);
            if (!userDoc.exists()) {
                return { success: false, message: "User not found." };
            }
            const userData = userDoc.data();
            if (userData.password !== oldPass) {
                return { success: false, message: "Incorrect old password." };
            }
            await updateDoc(userRef, { password: newPass });
            return { success: true, message: "Password updated successfully!" };
        } catch (error) {
            console.error("Error changing password:", error);
            return { success: false, message: "An unexpected server error occurred." };
        }
    };

    const value = {
        currentUser,
        isInitializing,
        login,
        logout,
        changePassword,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};