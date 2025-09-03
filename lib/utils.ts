

import { Event } from '../types';

/**
 * Recursively removes properties with `undefined` values from an object.
 * This is useful for preparing objects to be saved to Firestore, which doesn't allow `undefined`.
 */
export const cleanForFirebase = (obj: any): any => {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => cleanForFirebase(item));
    }
    // Handle Firestore Timestamps and other special objects if necessary, but for now this is fine.
    if (typeof obj === 'object' && !(obj instanceof Date)) {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (value !== undefined) {
                    newObj[key] = cleanForFirebase(value);
                }
            }
        }
        return newObj;
    }
    return obj;
};

/**
 * Creates a deep copy of an object. This is safer than JSON.parse(JSON.stringify(obj))
 * as it handles more types and avoids issues with proxies or circular refs from Firestore.
 */
export const deepClone = <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as any;
    }

    if (Array.isArray(obj)) {
        const arrCopy: any[] = [];
        for (let i = 0; i < obj.length; i++) {
            arrCopy[i] = deepClone(obj[i]);
        }
        return arrCopy as any;
    }

    const objCopy: { [key: string]: any } = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            objCopy[key] = deepClone((obj as any)[key]);
        }
    }
    return objCopy as T;
};


/**
 * Converts a 'YYYY-MM-DD' string into a Date object, correctly interpreting it in the user's local timezone.
 * This avoids timezone-related "off-by-one-day" errors.
 * @param dateString A string in 'YYYY-MM-DD' format.
 * @returns A Date object representing midnight in the local timezone.
 */
export const yyyyMMDDToDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  // Month is 0-indexed in JavaScript Date constructor
  return new Date(year, month - 1, day);
};

/**
 * Formats a 'YYYY-MM-DD' string for display, ensuring the correct date is shown regardless of timezone.
 * @param dateString A string in 'YYYY-MM-DD' format.
 * @param options Intl.DateTimeFormatOptions to customize the output.
 * @returns A formatted date string (e.g., "July 25, 2024").
 */
export const formatYYYYMMDD = (dateString: string | undefined | null, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }): string => {
  if (!dateString) return 'N/A';
  try {
    const date = yyyyMMDDToDate(dateString);
    // By creating a local date and formatting it locally, we ensure what you see is what you selected.
    return date.toLocaleDateString('en-US', options);
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return "Invalid Date";
  }
};

/**
 * Converts a Date object to a 'YYYY-MM-DD' string. This is the standardized format for storing dates.
 * @param date A Date object.
 * @returns A string in 'YYYY-MM-DD' format.
 */
export const dateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a date range for display.
 * @param startDate A string in 'YYYY-MM-DD' format.
 * @param endDate An optional string in 'YYYY-MM-DD' format.
 * @returns A formatted date range string (e.g., "July 25, 2024" or "July 25 to 28, 2024").
 */
export const formatDateRange = (startDate: string, endDate?: string | null): string => {
    if (!endDate || startDate === endDate) {
        return formatYYYYMMDD(startDate);
    }

    const start = yyyyMMDDToDate(startDate);
    const end = yyyyMMDDToDate(endDate);

    const startMonth = start.toLocaleString('default', { month: 'long' });
    const endMonth = end.toLocaleString('default', { month: 'long' });
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear !== endYear) {
        return `${formatYYYYMMDD(startDate)} to ${formatYYYYMMDD(endDate)}`;
    }
    if (startMonth !== endMonth) {
         return `${start.toLocaleString('default', { month: 'long', day: 'numeric' })} to ${formatYYYYMMDD(endDate)}`;
    }
    
    return `${startMonth} ${start.getDate()} to ${end.getDate()}, ${startYear}`;
};

export const calculateFinancials = (event: Event) => {
    const model = event.pricingModel || 'variable';
    const pax = event.pax || 0;
    const perPax = event.perPaxPrice || 0;
    const rent = event.rent || 0;
    
    let baseCost = 0;
    if (model === 'variable') baseCost = pax * perPax;
    else if (model === 'flat') baseCost = rent;
    else if (model === 'mix') baseCost = rent + (pax * perPax);

    const totalCharges = (event.charges || []).filter(c => !c.isDeleted).reduce((sum, charge) => sum + charge.amount, 0);
    const totalPayments = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted).reduce((sum, payment) => sum + payment.amount, 0);
    const totalExpenses = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted).reduce((sum, expense) => sum + expense.amount, 0);

    const totalBill = baseCost + totalCharges;
    const balanceDue = totalBill - totalPayments;
    const profit = totalBill - totalExpenses;

    return { totalBill, totalPayments, totalExpenses, balanceDue, profit };
};