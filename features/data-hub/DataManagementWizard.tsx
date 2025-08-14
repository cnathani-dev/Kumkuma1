


import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useItems, useAppCategories, useLiveCounters, useLiveCounterItems, useCatalogs, useClients, useEvents } from '../../App';
import {
    downloadCategorySample, downloadItemSample, downloadLiveCounterSample, downloadCatalogSample, downloadClientEventSample,
    exportAllCategories, exportAllItems, exportAllLiveCounters, exportAllCatalogs, exportAllClients, exportAllEvents
} from '../../lib/export';
import { primaryButton, secondaryButton, inputStyle, dangerButton } from '../../components/common/styles';
import { Download, Upload, FileQuestion, Trash2, Plus, Loader2, Database } from 'lucide-react';
import { db } from '../../firebase';
import { doc, writeBatch } from 'firebase/firestore';
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
    const [isMigrating, setIsMigrating] = useState(false);
    

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
                alert(`Successfully imported ${typeof result === 'number' ? result : json.length} records.`);
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
        if (!window.confirm("This tool will scan for events with old date formats (prior to Aug 1, 2025) and update them. It's safe to run multiple times, but please back up your data first if you have concerns. Proceed?")) {
            return;
        }

        setIsMigrating(true);
        let updatedCount = 0;
        const batch = writeBatch(db);
        const cutoffDate = new Date('2025-08-01');

        try {
            events.forEach(event => {
                // Check if the date is a string and looks like an ISO string (long format)
                if (typeof event.date === 'string' && (event.date.includes('T') || event.date.includes(' '))) {
                    const eventDate = new Date(event.date);

                    // Check if the parsed date is valid and before the cutoff
                    if (!isNaN(eventDate.getTime()) && eventDate < cutoffDate) {
                        const eventRef = doc(db, 'events', event.id);
                        const newDate = dateToYYYYMMDD(eventDate);
                        batch.update(eventRef, { date: newDate });
                        updatedCount++;
                    }
                }
            });

            if (updatedCount > 0) {
                await batch.commit();
                alert(`Successfully migrated ${updatedCount} event dates.`);
            } else {
                alert("No events with old date formats found to migrate.");
            }
        } catch (error: any) {
            console.error("Date migration failed:", error);
            alert(`An error occurred during date migration: ${error.message}`);
        } finally {
            setIsMigrating(false);
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
                    Use these tools for one-off data corrections. The tool below fixes old event dates causing "Invalid Date" errors.
                </p>
                <div className="flex flex-wrap gap-4">
                    <button onClick={handleFixOldDates} className={primaryButton} disabled={isMigrating}>
                        {isMigrating ? <Loader2 className="animate-spin" size={16}/> : <Database size={16}/>}
                        {isMigrating ? 'Migrating...' : 'Fix Old Event Dates'}
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
                onImport={(file) => handleFileUpload(file, importClientsAndEvents, ['Client Name', 'Event Type', 'Event Date'])}
                onSample={downloadClientEventSample}
                onDeleteAll={() => {
                    if(window.confirm("Are you sure you want to delete ALL clients and events? This cannot be undone.")) {
                        deleteAllClients();
                    }
                }} 
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