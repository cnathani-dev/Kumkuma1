import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useItems, useAppCategories, useLiveCounters, useLiveCounterItems, useCatalogs, useClients, useEvents, useRecipes, useRawMaterials, useMuhurthamDates } from '../../contexts/AppContexts';
import {
    downloadCategorySample, downloadItemSample, downloadLiveCounterSample, downloadCatalogSample, downloadClientEventSample,
    exportAllCategories, exportAllItems, exportAllLiveCounters, exportAllCatalogs, exportAllClients, exportAllEvents,
    downloadRecipeSample, exportAllRecipes,
    exportAllMuhurthamDates,
    downloadMuhurthamDateSample,
    exportAllRawMaterials,
    downloadRawMaterialSample
} from '../../lib/export';
import { primaryButton, secondaryButton, inputStyle, dangerButton } from '../../components/common/styles';
import { Download, Upload, FileQuestion, Trash2, Plus, Loader2, Database } from 'lucide-react';
import { db } from '../../firebase';
import { doc, writeBatch, deleteField } from 'firebase/firestore';
import { dateToYYYYMMDD } from '../../lib/utils';


const normalizeKeys = (obj: any) => {
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key.toLowerCase().trim()] = obj[key];
        }
    }
    return newObj;
};


export const DataManagementWizard = () => {
    const { categories, addMultipleCategories, deleteAllCategories } = useAppCategories();
    const { items, addMultipleItems, deleteAllItems } = useItems();
    const { liveCounters, addMultipleLiveCounters, deleteAllLiveCountersAndItems } = useLiveCounters();
    const { liveCounterItems, addMultipleLiveCounterItems } = useLiveCounterItems();
    const { catalogs, addMultipleCatalogs, deleteAllCatalogs } = useCatalogs();
    const { clients, deleteAllClients, addSampleData, deleteSampleData } = useClients();
    const { events, deleteAllEvents, importClientsAndEvents } = useEvents();
    const { recipes, addMultipleRecipes, deleteAllRecipes } = useRecipes();
    const { rawMaterials, addMultipleRawMaterials, deleteAllRawMaterials } = useRawMaterials();
    const { muhurthamDates, importMuhurthamDates, deleteAllMuhurthamDates } = useMuhurthamDates();
    const [isMigrating, setIsMigrating] = useState(false);
    const [isFixingTxDates, setIsFixingTxDates] = useState(false);
    

    const handleFileUpload = async (file: File, importFunction: (data: any[]) => Promise<any>, expectedHeaders: string[]) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawJson = XLSX.utils.sheet_to_json(worksheet);
                const json = rawJson.map(normalizeKeys);


                if (json.length > 0) {
                    const headers = Object.keys(json[0] as object);
                    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h.toLowerCase()));
                    if (missingHeaders.length > 0) {
                        throw new Error(`Invalid file format. Missing headers: ${missingHeaders.join(', ')}`);
                    }
                }

                const result = await importFunction(json);

                if (importFunction === addMultipleRecipes) {
                    const recipeResult = result as { successCount: number; failures: { name: string; reason: string }[] };
                    let message = `Import complete.\n\nSuccessfully imported/updated: ${recipeResult.successCount} recipes.`;
                    if (recipeResult.failures.length > 0) {
                        message += `\n\nFailed to import: ${recipeResult.failures.length} recipes.\n\nReasons:\n`;
                        message += recipeResult.failures.map(f => `- ${f.name}: ${f.reason}`).join('\n');
                    }
                    alert(message);
                } else {
                    alert(`Successfully imported ${typeof result === 'number' ? result : json.length} records.`);
                }
            } catch (error) {
                console.error("Import error:", error);
                alert(`Import failed: ${error}`);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleLiveCountersUpload = async (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                const countersSheet = workbook.Sheets['Live Counters'];
                const itemsSheet = workbook.Sheets['Live Counter Items'];

                if (!countersSheet || !itemsSheet) throw new Error("Excel file must contain 'Live Counters' and 'Live Counter Items' sheets.");

                const countersJsonRaw = XLSX.utils.sheet_to_json(countersSheet) as any[];
                const itemsJsonRaw = XLSX.utils.sheet_to_json(itemsSheet) as any[];

                const countersJson = countersJsonRaw.map(normalizeKeys);
                const itemsJson = itemsJsonRaw.map(normalizeKeys);
                
                // Validate headers
                if (countersJson.length > 0 && !('name' in countersJson[0] && 'max items' in countersJson[0])) throw new Error("Counters sheet is missing 'Name' or 'Max Items' column.");
                if (itemsJson.length > 0 && !('name' in itemsJson[0] && 'live counter name' in itemsJson[0])) throw new Error("Items sheet is missing 'Name' or 'Live Counter Name' column.");

                const nameToIdMap = await addMultipleLiveCounters(countersJson.map(row => ({
                    name: row.name, description: row.description, maxItems: row['max items'], displayRank: row['display rank']
                })));
                
                const itemsToAdd = itemsJson.map(row => {
                    const liveCounterId = nameToIdMap.get(row['live counter name'].toLowerCase());
                    if (!liveCounterId) throw new Error(`Could not find Live Counter named "${row['live counter name']}" from the 'Live Counters' sheet.`);
                    return { name: row.name, description: row.description, liveCounterId, displayRank: row['display rank'] };
                });
                
                await addMultipleLiveCounterItems(itemsToAdd);

                alert(`Successfully imported ${countersJson.length} counters and ${itemsJson.length} items.`);
            } catch (error) {
                 console.error("Import error:", error);
                alert(`Import failed: ${error}`);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleCatalogUpload = async (file: File) => {
         const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonRaw = XLSX.utils.sheet_to_json(worksheet) as any[];
                const json = jsonRaw.map(normalizeKeys);

                if (json.length > 0) {
                     if (!('catalog name' in json[0] && 'item name' in json[0])) throw new Error("Catalog sheet is missing 'Catalog Name' or 'Item Name' column.");
                }

                const groupedByName = json.reduce((acc, row) => {
                    const name = row['catalog name'];
                    if(!acc[name]) {
                        acc[name] = { name, description: row['catalog description'] || '', items: [] };
                    }
                    acc[name].items.push(row['item name']);
                    return acc;
                }, {});

                await addMultipleCatalogs(Object.values(groupedByName));
                alert(`Successfully imported ${Object.keys(groupedByName).length} catalogs.`);
            } catch (error) {
                console.error("Import error:", error);
                alert(`Import failed: ${error}`);
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    const handleGenerateSampleData = async () => {
        if (window.confirm("This will add a complete set of sample data to the system, including categories, items, clients, and events. Any existing data will NOT be affected. Continue?")) {
            try {
                await addSampleData();
                alert("Sample data generated successfully!");
            } catch (error) {
                console.error("Error generating sample data:", error);
                alert(`Failed to generate sample data: ${error}`);
            }
        }
    };

    const handleDeleteSampleData = async () => {
        if (window.confirm("ARE YOU SURE you want to delete all sample data? This will remove any items, clients, events, etc., that were generated as samples. This action cannot be undone.")) {
            try {
                await deleteSampleData();
                alert("Sample data deleted successfully!");
            } catch (error) {
                console.error("Error deleting sample data:", error);
                alert(`Failed to delete sample data: ${error}`);
            }
        }
    };

    const handleFixOldDates = async () => {
        if (!window.confirm("This tool will migrate all events from the old single-date format to the new multi-day format (renaming 'date' to 'startDate'). It is safe to run multiple times. Proceed?")) {
            return;
        }
    
        setIsMigrating(true);
        let updatedCount = 0;
        const batch = writeBatch(db);
    
        try {
            events.forEach(event => {
                const eventData = event as any;
                // Check if the old `date` field exists and the new `startDate` field does NOT.
                if (eventData.date && !eventData.startDate) {
                    const eventRef = doc(db, 'events', event.id);
                    batch.update(eventRef, {
                        startDate: eventData.date,
                        date: deleteField()
                    });
                    updatedCount++;
                }
            });
    
            if (updatedCount > 0) {
                await batch.commit();
                alert(`Successfully migrated ${updatedCount} events to the new date schema.`);
            } else {
                alert("No events found that required migration.");
            }
        } catch (error: any) {
            console.error("Date migration failed:", error);
            alert(`An error occurred during date migration: ${error.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    const handleFixTransactionDates = async () => {
        if (!window.confirm("This tool will scan all events and fix improperly formatted Payment and Expense dates to the 'YYYY-MM-DD' standard. This is safe to run multiple times. Proceed?")) {
            return;
        }
    
        setIsFixingTxDates(true);
        let updatedEventsCount = 0;
        const batch = writeBatch(db);
    
        try {
            for (const event of events) {
                if (!event.transactions || event.transactions.length === 0) {
                    continue;
                }
    
                let needsUpdate = false;
                const updatedTransactions = event.transactions.map(tx => {
                    if (typeof tx.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
                        return tx; // Already in correct format
                    }
                    
                    // Attempt to parse whatever format it is in (ISO string, Firestore Timestamp obj, etc.)
                    const dateObj = new Date(tx.date);
                    if (isNaN(dateObj.getTime())) {
                        console.warn(`Skipping invalid date for transaction ${tx.id} in event ${event.id}:`, tx.date);
                        return tx; // Can't parse, so skip
                    }
                    
                    const formattedDate = dateToYYYYMMDD(dateObj);
                    if (formattedDate !== tx.date) {
                        needsUpdate = true;
                        return { ...tx, date: formattedDate };
                    }
                    
                    return tx;
                });
    
                if (needsUpdate) {
                    const eventRef = doc(db, 'events', event.id);
                    batch.update(eventRef, { transactions: updatedTransactions });
                    updatedEventsCount++;
                }
            }
    
            if (updatedEventsCount > 0) {
                await batch.commit();
                alert(`Successfully checked all events and fixed transaction dates in ${updatedEventsCount} event(s).`);
            } else {
                alert("No events found with transaction dates that required fixing.");
            }
        } catch (error: any) {
            console.error("Transaction date migration failed:", error);
            alert(`An error occurred during transaction date migration: ${error.message}`);
        } finally {
            setIsFixingTxDates(false);
        }
    };


    return (
        <div className="space-y-8">
             <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
                <h4 className="text-xl font-bold mb-4">Sample Data Management</h4>
                <p className="text-sm text-warm-gray-500 mb-4">Use these actions to populate the application with a set of sample data for demonstration purposes, or to remove it.</p>
                <div className="flex flex-wrap gap-4">
                    <button onClick={handleGenerateSampleData} className={primaryButton}>
                        <Plus size={16}/> Generate Sample Data
                    </button>
                    <button onClick={handleDeleteSampleData} className={`${secondaryButton} text-accent-500 border-accent-500/50 hover:bg-accent-50 dark:hover:bg-accent-500/10`}>
                        <Trash2 size={16}/> Delete Sample Data
                    </button>
                </div>
            </div>
            <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
                <h4 className="text-xl font-bold mb-4">Data Integrity Tools</h4>
                <p className="text-sm text-warm-gray-500 mb-4">
                    Use these tools for one-off data corrections.
                </p>
                <div className="flex flex-wrap gap-4">
                    <button onClick={handleFixOldDates} className={primaryButton} disabled={isMigrating}>
                        {isMigrating ? <Loader2 className="animate-spin" size={16}/> : <Database size={16}/>}
                        {isMigrating ? 'Migrating...' : 'Fix Event Schema Dates'}
                    </button>
                     <button onClick={handleFixTransactionDates} className={primaryButton} disabled={isFixingTxDates}>
                        {isFixingTxDates ? <Loader2 className="animate-spin" size={16}/> : <Database size={16}/>}
                        {isFixingTxDates ? 'Fixing...' : 'Fix Transaction Dates'}
                    </button>
                </div>
            </div>
            <DataCard
                title="Categories"
                onExport={() => exportAllCategories(categories)}
                onImport={(file) => handleFileUpload(file, addMultipleCategories, ['Parent Category'])}
                onSample={downloadCategorySample}
                onDeleteAll={deleteAllCategories}
            />
            <DataCard
                title="Items"
                onExport={() => exportAllItems(items, categories)}
                onImport={(file) => handleFileUpload(file, addMultipleItems, ['Parent Category', 'Item Name', 'Type'])}
                onSample={downloadItemSample}
                onDeleteAll={deleteAllItems}
            />
            <DataCard
                title="Live Counters"
                onExport={() => exportAllLiveCounters(liveCounters, liveCounterItems)}
                onImport={handleLiveCountersUpload}
                onSample={downloadLiveCounterSample}
                onDeleteAll={deleteAllLiveCountersAndItems}
            />
            <DataCard
                title="Catalogs"
                onExport={() => exportAllCatalogs(catalogs, items)}
                onImport={handleCatalogUpload}
                onSample={downloadCatalogSample}
                onDeleteAll={deleteAllCatalogs}
            />
            <DataCard 
                title="Clients & Events" 
                onExport={() => { exportAllClients(clients); exportAllEvents(events, clients);}} 
                onImport={(file) => handleFileUpload(file, importClientsAndEvents, ['Client Name', 'Event Type', 'Start Date'])}
                onSample={downloadClientEventSample}
                onDeleteAll={() => {
                    if(window.confirm("Are you sure you want to delete ALL clients and events? This cannot be undone.")) {
                        deleteAllClients();
                    }
                }} 
            />
            <DataCard
                title="Recipes"
                onExport={() => exportAllRecipes(recipes, rawMaterials)}
                onImport={(file) => handleFileUpload(file, addMultipleRecipes, ['recipe', 'raw material', 'raw material qty', 'raw material unit'])}
                onSample={downloadRecipeSample}
                onDeleteAll={deleteAllRecipes}
            />
            <DataCard
                title="Raw Materials"
                onExport={() => exportAllRawMaterials(rawMaterials)}
                onImport={(file) => handleFileUpload(file, addMultipleRawMaterials, ['name', 'unit'])}
                onSample={downloadRawMaterialSample}
                onDeleteAll={deleteAllRawMaterials}
            />
            <DataCard
                title="Muhurtham Dates"
                onExport={() => exportAllMuhurthamDates(muhurthamDates)}
                onImport={(file) => handleFileUpload(file, importMuhurthamDates, ['date'])}
                onSample={downloadMuhurthamDateSample}
                onDeleteAll={deleteAllMuhurthamDates}
            />
        </div>
    );
};

interface DataCardProps {
    title: string;
    onExport: () => void;
    onImport?: (file: File) => void;
    onSample?: () => void;
    onDeleteAll?: () => void;
}

const DataCard: React.FC<DataCardProps> = ({ title, onExport, onImport, onSample, onDeleteAll }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            <h4 className="text-xl font-bold mb-4">{title}</h4>
            <div className="flex flex-wrap gap-4">
                <button onClick={onExport} className={secondaryButton}><Download size={16}/> <span className="hidden sm:inline">Export All</span></button>
                {onImport && <button onClick={() => fileInputRef.current?.click()} className={primaryButton}><Upload size={16}/> <span className="hidden sm:inline">Import from Excel</span></button>}
                {onSample && <button onClick={onSample} className={secondaryButton}><FileQuestion size={16}/> <span className="hidden sm:inline">Download Sample</span></button>}
                {onDeleteAll && <button onClick={onDeleteAll} className={`${secondaryButton} text-accent-500 border-accent-500/50 hover:bg-accent-50 dark:hover:bg-accent-500/10`}><Trash2 size={16}/> <span className="hidden sm:inline">Delete All</span></button>}
                {onImport && <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={e => e.target.files && onImport(e.target.files[0])} />}
            </div>
        </div>
    );
};