import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteField, updateDoc } from 'firebase/firestore';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { User, Role, AppPermissions, LocationSetting } from '../types';
import { db, auth } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { logAuditEvent } from '../lib/audit';
import { cleanForFirebase } from '../lib/utils';

interface AuthContextType {
    currentUser: User | null;
    isInitializing: boolean;
    login: (user: string, pass:string) => Promise<{success: boolean, message: string}>;
    logout: () => void;
    changePassword: (oldPass: string, newPass: string) => Promise<{success: boolean, message: string}>;
    // FIX: Added signup to support user registration.
    signup: (user: string, pass: string) => Promise<{success: boolean, message: string}>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        console.log("AuthContext: useEffect running. Subscribing to onAuthStateChanged.");
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
            console.log("AuthContext: onAuthStateChanged callback fired. firebaseUser:", firebaseUser);
            if (firebaseUser) {
                const creationTime = new Date(firebaseUser.metadata.creationTime || 0).getTime();
                const now = new Date().getTime();
                const isNewUser = (now - creationTime) < 5000; // 5-second grace period

                const userRef = doc(db, "users", firebaseUser.uid);
                console.log("AuthContext: Fetching user doc from Firestore:", firebaseUser.uid);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    console.log("AuthContext: User doc exists.");
                    const firestoreData = userDoc.data();
                    if (firestoreData && firestoreData.status === 'active') {
                         const userToStore: User = {
                            id: firebaseUser.uid,
                            username: firestoreData.username,
                            role: firestoreData.role,
                            status: firestoreData.status,
                            assignedClientId: firestoreData.assignedClientId,
                            roleId: firestoreData.roleId,
                            managedLocationIds: firestoreData.managedLocationIds || [],
                        };
                        setCurrentUser(userToStore);
                        console.log("AuthContext: Active user set.", userToStore);
                    } else {
                        // This handles signing out users who are pending, inactive, etc.
                        console.log("AuthContext: User is not active. Signing out.", firestoreData);
                        await signOut(auth);
                        setCurrentUser(null);
                    }
                } else {
                    // This is the race condition guard: if a user was just created,
                    // their Firestore doc might not exist yet. We give it a moment.
                    if (!isNewUser) {
                        console.error("AuthContext: Authenticated user not found in Firestore. Logging out.");
                        await signOut(auth);
                        setCurrentUser(null);
                    } else {
                        console.log("AuthContext: User is new, Firestore doc might not exist yet. Waiting.");
                    }
                }
            } else {
                console.log("AuthContext: No firebaseUser. Setting currentUser to null.");
                setCurrentUser(null);
            }
            console.log("AuthContext: Finished processing auth state change. Setting isInitializing to false.");
            setIsInitializing(false);
        });

        return () => {
            console.log("AuthContext: useEffect cleanup. Unsubscribing from onAuthStateChanged.");
            unsubscribe();
        };
    }, []);

    const login = async (username: string, pass: string): Promise<{success: boolean, message: string}> => {
        console.log("AuthContext: login function called for user:", username);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, username, pass);
            const user = userCredential.user;
            if (!user) { // Added null check for safety
                throw new Error("Login failed, user object is null.");
            }
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
                 await signOut(auth);
                 return { success: false, message: "User profile not found. Please contact support." };
            }

            const userData = userDoc.data();
            if (userData && userData.status === 'inactive') {
                await signOut(auth);
                return { success: false, message: "This account is inactive. Please contact an administrator." };
            }
            if (userData && userData.status === 'pending') {
                 await signOut(auth);
                 return { success: false, message: "This account is pending administrator approval." };
            }

            await logAuditEvent({ userId: user.uid, username: username, action: 'LOGIN', details: 'User logged in successfully.' });
            // onAuthStateChanged will handle setting the current user state
            return { success: true, message: "Login successful." };
        } catch (error: any) {
            console.error("Firebase login error:", error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                 return { success: false, message: "Invalid username or password." };
            }
            return { success: false, message: error.message || "An unexpected error occurred during login." };
        }
    };

    // FIX: Implement signup function to create a new user with pending status.
    const signup = async (username: string, pass: string): Promise<{success: boolean, message: string}> => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, username, pass);
            const user = userCredential.user;
            if (!user) {
                throw new Error("Sign up failed, user object is null.");
            }

            const newUserDoc: Omit<User, 'id'> = {
                username: username,
                role: 'staff', // Default role for new signups
                status: 'pending',
            };
            
            await setDoc(doc(db, "users", user.uid), cleanForFirebase(newUserDoc));

            // Automatically log out the user after signup, as they need approval
            await signOut(auth);

            return { success: true, message: "Account created! It is now pending administrator approval." };
        } catch (error: any) {
            console.error("Firebase signup error:", error);
            if (error.code === 'auth/email-already-in-use') {
                return { success: false, message: "This email address is already in use." };
            }
            if (error.code === 'auth/weak-password') {
                return { success: false, message: "Password is too weak. It must be at least 6 characters long." };
            }
            return { success: false, message: error.message || "An unexpected error occurred during sign up." };
        }
    };

    const logout = async () => {
        if (currentUser) {
            await logAuditEvent({ userId: currentUser.id, username: currentUser.username, action: 'LOGOUT', details: 'User logged out.' });
        }
        await signOut(auth);
    };

    const changePassword = async (oldPass: string, newPass: string): Promise<{success: boolean, message: string}> => {
        const user = auth.currentUser;
        if (!user || !user.email) {
            return { success: false, message: "No user is currently logged in." };
        }
        try {
            const credential = EmailAuthProvider.credential(user.email, oldPass);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPass);
            if(currentUser) {
                 const userRef = doc(db, "users", currentUser.id);
                 await updateDoc(userRef, { password: deleteField() });
            }
            
            return { success: true, message: "Password updated successfully!" };
        } catch (error: any) {
            console.error("Error changing password:", error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                return { success: false, message: "Incorrect old password." };
            }
            return { success: false, message: "An unexpected server error occurred." };
        }
    };

    const value = {
        currentUser,
        isInitializing,
        login,
        logout,
        changePassword,
        signup,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};