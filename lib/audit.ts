import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuditLog } from '../types';
import { cleanForFirebase } from './utils';

/**
 * Logs an audit event to the 'auditLogs' collection in Firestore.
 * @param event - The audit event details, excluding id and timestamp.
 */
export const logAuditEvent = async (event: Omit<AuditLog, 'id' | 'timestamp'>) => {
  try {
    const dataToLog = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    await addDoc(collection(db, 'auditLogs'), cleanForFirebase(dataToLog));
  } catch (error) {
    console.error("Failed to log audit event:", error, event);
    // In a real app, you might want more robust error handling,
    // like pushing to an error monitoring service.
  }
};