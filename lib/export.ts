import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Event, Item, LiveCounter, LiveCounterItem, AppCategory, Catalog, MenuTemplate, Transaction, Charge, ItemType, Client, PlanCategory, Recipe, RawMaterial, MuhurthamDate } from '../types';
import { kumkumaCaterersLogoBase64 } from './branding';
import { formatYYYYMMDD, formatDateRange } from './utils';

// --- HELPER FUNCTIONS ---

const getEventDisplayName = (event: Event, clientName: string) => {
    const dateString = formatDateRange(event.startDate, event.endDate);
    const session = event.session.charAt(0).toUpperCase() + event.session.slice(1);
    
    let paxInfo = event.pax ? `(${event.pax} PAX)` : '';
    return `${clientName} - ${event.eventType} - ${session} on ${dateString} ${paxInfo}`.trim();
}

const getSortedCategoryNames = (itemsByCategoryName: Record<string, Item[]>, allCategories: AppCategory[]): string[] => {
    const categoryNameMap = new Map(allCategories.map(c => [c.name, c]));
    const categoryIdMap = new Map(allCategories.map(c => [c.id, c]));

    return Object.keys(itemsByCategoryName).sort((aName, bName) => {
        const aCat = categoryNameMap.get(aName);
        const bCat = categoryNameMap.get(bName);
        if (!aCat || !bCat) return aName.localeCompare(bName);
        
        const aParent = aCat.parentId ? categoryIdMap.get(aCat.parentId) : aCat;
        const bParent = bCat.parentId ? categoryIdMap.get(bCat.parentId) : bCat;
        
        if (aParent && bParent && aParent.id !== bParent.id) {
            return (aParent.displayRank ?? Infinity) - (bParent.displayRank ?? Infinity) || aParent.name.localeCompare(bParent.name);
        }
        
        return (aCat.displayRank ?? Infinity) - (bCat.displayRank ?? Infinity) || aCat.name.localeCompare(bCat.name);
    });
};

const checkPageBreak = (doc: jsPDF, y: number, spaceNeeded: number) => {
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    if (y + spaceNeeded > pageH - margin) {
        doc.addPage();
        return margin;
    }
    return y;
};

const renderPdfLogo = (doc: jsPDF, x: number, y: number) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor('#c43c3b'); // accent-500
    doc.text('kumkuma', x, y, { charSpace: 0.5 });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#525252'); // warm-gray-600
    doc.text('CATERERS', x, y + 4, { charSpace: 2 });
}

const renderOmConventionLogo = (doc: jsPDF, x: number, y: number, align: 'left' | 'right' | 'center' = 'right') => {
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor('#c43c3b'); // accent-500
    
    const text = 'OM CONVENTION';
    const textMetrics = doc.getTextDimensions(text);
    
    let textX;
    
    switch(align) {
        case 'left':
            textX = x;
            break;
        case 'center':
            textX = doc.internal.pageSize.getWidth() / 2;
            break;
        case 'right':
        default:
            textX = x; // jspdf handles right align from this x
            break;
    }
    
    doc.text(text, textX, y, { align: align === 'center' ? 'center' : align });

    return textMetrics.h;
};


// --- PDF EXPORT LOGIC ---

export const exportToPdf = (
  event: Event,
  client: Client,
  allItems: Item[],
  allCategories: AppCategory[],
  liveCounters: LiveCounter[], 
  liveCounterItems: LiveCounterItem[]
) => {
    // Default to elegance style if not specified
    exportToPdfWithOptions(event, client, allItems, allCategories, liveCounters, liveCounterItems, 'elegance');
};


export const exportToPdfWithOptions = (
  event: Event,
  client: Client,
  allItems: Item[],
  allCategories: AppCategory[],
  liveCounters: LiveCounter[], 
  liveCounterItems: LiveCounterItem[],
  style: 'elegance' | 'modern' | 'vibrant'
) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 20;

        // Data prep
        const itemMap = new Map(allItems.map(i => [i.id, i]));
        const categoryMap = new Map(allCategories.map(c => [c.id, c]));
        const liveCounterMap = new Map(liveCounters.map(lc => [lc.id, lc]));
        const liveCounterItemMap = new Map(liveCounterItems.map(lci => [lci.id, lci]));

        const itemsByCategoryName: Record<string, Item[]> = {};
        if (event.itemIds) {
            for (const categoryId in event.itemIds) {
                const category = categoryMap.get(categoryId);
                if (category) {
                    const itemObjects = event.itemIds[categoryId]
                        .map(id => itemMap.get(id))
                        .filter((i): i is Item => !!i);
                    if (itemObjects.length > 0) {
                        itemsByCategoryName[category.name] = itemObjects;
                    }
                }
            }
        }
        const sortedCategories = getSortedCategoryNames(itemsByCategoryName, allCategories);

        const liveCounterGroups = event.liveCounters ? Object.entries(event.liveCounters)
            .map(([counterId, itemIds]) => ({
                counter: liveCounterMap.get(counterId),
                items: (itemIds.map(id => liveCounterItemMap.get(id)).filter(Boolean) as LiveCounterItem[])
            }))
            .filter(group => group.counter && group.items.length > 0)
            .sort((a,b) => (a.counter!.displayRank ?? Infinity) - (b.counter!.displayRank ?? Infinity)) : [];

        // --- RENDER HEADER & FOOTER ---
        const renderHeader = (doc: jsPDF): number => {
            const showOmLogo = event.location === 'Om Hall-1' || event.location === 'Om Hall-2';
            const eventDisplayName = getEventDisplayName(event, client.name);
            const headerBottomMargin = 10;

            if (showOmLogo) {
                renderPdfLogo(doc, margin, margin);
                const omLogoHeight = renderOmConventionLogo(doc, pageW - margin, margin + 2, 'right');
                
                const kumkumaLogoHeight = 10;
                let currentY = margin + Math.max(omLogoHeight, kumkumaLogoHeight) + 5;

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(38, 38, 38);
                const eventNameLines = doc.splitTextToSize(eventDisplayName, pageW - (margin * 2));
                doc.text(eventNameLines, pageW / 2, currentY, { align: 'center' });
                
                currentY += doc.getTextDimensions(eventNameLines).h;
                return currentY + headerBottomMargin;
            } else {
                // Original behavior
                renderPdfLogo(doc, margin, margin);
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(38, 38, 38);
                const eventNameLines = doc.splitTextToSize(eventDisplayName, pageW / 2 - margin);
                doc.text(eventNameLines, pageW - margin, margin, { align: 'right' });

                const kumkumaLogoHeight = 10; // Estimated height of the text logo
                const eventNameHeight = doc.getTextDimensions(eventNameLines).h;
                
                const headerHeight = Math.max(kumkumaLogoHeight, eventNameHeight);
                return margin + headerHeight + headerBottomMargin;
            }
        };
        
        const renderFooter = (doc: jsPDF) => {
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(163, 163, 163);
                doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 10, { align: 'right' });
                doc.text(`Kumkuma Caterers`, margin, pageH - 10);
            }
        };
        
        // --- RENDER STYLES ---

        const renderTimelessElegance = (startY: number) => {
            let y = startY;
            const colWidth = (pageW - margin * 2 - 10) / 2;
            
            sortedCategories.forEach(catName => {
                y = checkPageBreak(doc, y, 20);
                doc.setFont('times', 'bold');
                doc.setFontSize(18);
                doc.setTextColor('#b87522');
                doc.text(catName, pageW / 2, y, { align: 'center' });
                y += 3;
                doc.setDrawColor('#e8a838');
                doc.setLineWidth(0.2);
                doc.line(margin, y, pageW - margin, y);
                y += 10;
                
                const items = itemsByCategoryName[catName]
                    .sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity));

                let col1Y = y, col2Y = y;
                items.forEach((item, index) => {
                    const itemHeight = doc.getTextDimensions(item.name, { maxWidth: colWidth, fontSize: 11 }).h + (item.description ? doc.getTextDimensions(item.description, { maxWidth: colWidth, fontSize: 9 }).h + 1 : 0) + 5;
                    
                    let currentY, currentX;
                    if(index % 2 === 0) { // Left column
                        if (col1Y + itemHeight > pageH - margin) {
                            col1Y = checkPageBreak(doc, col1Y, itemHeight);
                            if(col2Y + itemHeight > pageH - margin) col2Y = col1Y;
                        }
                        currentY = col1Y;
                        currentX = margin;
                    } else { // Right column
                         if (col2Y + itemHeight > pageH - margin) {
                            col2Y = checkPageBreak(doc, col2Y, itemHeight);
                            if(col1Y + itemHeight > pageH - margin) col1Y = col2Y;
                        }
                        currentY = col2Y;
                        currentX = margin + colWidth + 10;
                    }
                    
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    doc.setTextColor(38, 38, 38);
                    doc.text(item.name, currentX, currentY);
                    let textY = currentY + doc.getTextDimensions(item.name, { maxWidth: colWidth, fontSize: 11 }).h;

                    if (item.description) {
                        doc.setFont('times', 'normal');
                        doc.setFontSize(10);
                        doc.setTextColor(115, 115, 115);
                        doc.text(item.description, currentX, textY + 1, { maxWidth: colWidth });
                    }

                    if (index % 2 === 0) col1Y += itemHeight; else col2Y += itemHeight;
                });
                y = Math.max(col1Y, col2Y);
            });
            return y;
        };

        const renderModernMinimalist = (startY: number) => {
            let y = startY;
            sortedCategories.forEach(catName => {
                y = checkPageBreak(doc, y, 20);
                doc.setFillColor('#c43c3b');
                doc.rect(margin, y, pageW - margin * 2, 10, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor('#ffffff');
                doc.text(catName.toUpperCase(), margin + 4, y + 7);
                y += 18;

                const items = itemsByCategoryName[catName].sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity));
                items.forEach(item => {
                    const itemHeight = doc.getTextDimensions(item.name, { maxWidth: pageW - margin * 2, fontSize: 12 }).h + (item.description ? doc.getTextDimensions(item.description, { maxWidth: pageW - margin * 2, fontSize: 10 }).h + 2 : 0) + 8;
                    y = checkPageBreak(doc, y, itemHeight);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    doc.setTextColor(38, 38, 38);
                    doc.text(item.name, margin, y);
                    let textY = y + doc.getTextDimensions(item.name, { maxWidth: pageW - margin * 2, fontSize: 12 }).h;

                    if (item.description) {
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);
                        doc.setTextColor(115, 115, 115);
                        doc.text(item.description, margin, textY + 2, { maxWidth: pageW - margin * 2 });
                    }
                    y += itemHeight;
                });
                y += 5;
            });
            return y;
        };

        const renderVibrantCharm = (startY: number) => {
            let y = startY;
            
            sortedCategories.forEach(catName => {
                y = checkPageBreak(doc, y, 25);
                doc.setFont('times', 'bold');
                doc.setFontSize(22);
                doc.setTextColor('#c43c3b');
                doc.text(catName, margin, y);
                y += 12;

                const items = itemsByCategoryName[catName].sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity));
                const categoryItemsHeight = items.reduce((acc, item) => {
                    return acc + doc.getTextDimensions(item.name, { maxWidth: pageW - margin * 2 - 15, fontSize: 11 }).h + (item.description ? doc.getTextDimensions(item.description, { maxWidth: pageW - margin * 2 - 15, fontSize: 10 }).h + 2 : 0) + 12;
                }, 0);
                
                y = checkPageBreak(doc, y, categoryItemsHeight);
                const startBlockY = y - 5;
                doc.setFillColor('#fff8e1'); // primary-50
                doc.rect(margin - 5, startBlockY, pageW - margin * 2 + 10, categoryItemsHeight, 'F');
                
                items.forEach(item => {
                    const itemHeight = doc.getTextDimensions(item.name, { maxWidth: pageW - margin * 2 - 15, fontSize: 11 }).h + (item.description ? doc.getTextDimensions(item.description, { maxWidth: pageW - margin * 2 - 15, fontSize: 10 }).h + 2 : 0) + 12;
                    
                    // Draw circle instead of image for reliability
                    if (item.type === 'veg') {
                        doc.setFillColor(34, 197, 94); // green-500
                    } else {
                        doc.setFillColor(239, 68, 68); // red-500
                    }
                    doc.circle(margin + 2, y, 1.5, 'F');
                    
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    doc.setTextColor(38, 38, 38);
                    doc.text(item.name, margin + 10, y, { maxWidth: pageW - margin * 2 - 15 });
                    let textY = y + doc.getTextDimensions(item.name, { maxWidth: pageW - margin * 2 - 15, fontSize: 11 }).h;

                    if (item.description) {
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);
                        doc.setTextColor(115, 115, 115);
                        doc.text(item.description, margin + 10, textY + 1, { maxWidth: pageW - margin * 2 - 15 });
                    }
                    y += itemHeight;
                });
                y += 10;
            });
            return y;
        };
        
        // --- RENDER SECTIONS ---
        const renderCommonSection = (y: number, title: string, renderContent: () => number) => {
            y = checkPageBreak(doc, y, 25);
            y += 10;
            doc.setFont('times', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(38, 38, 38);
            doc.text(title, pageW / 2, y, { align: 'center'});
            y += 3;
            doc.setDrawColor('#e8a838');
            doc.line(margin + 30, y, pageW - margin - 30, y);
            y += 10;
            return renderContent();
        };
        
        // Main execution
        const contentStartY = renderHeader(doc);
        let y = 0;
        if (style === 'elegance') y = renderTimelessElegance(contentStartY);
        else if (style === 'modern') y = renderModernMinimalist(contentStartY);
        else if (style === 'vibrant') y = renderVibrantCharm(contentStartY);

        if (liveCounterGroups.length > 0) {
            y = renderCommonSection(y, 'Live Counters', () => {
                liveCounterGroups.forEach(group => {
                    y = checkPageBreak(doc, y, 15);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(14);
                    doc.setTextColor('#b87522');
                    doc.text(group.counter!.name, margin, y);
                    y += 6;
                    group.items.forEach(item => {
                        y = checkPageBreak(doc, y, 8);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(11);
                        doc.setTextColor(82, 82, 82);
                        doc.text(`•  ${item.name}`, margin + 5, y);
                        y += 7;
                    });
                    y += 5;
                });
                return y;
            });
        }

        if (event.notes) {
             y = renderCommonSection(y, 'Special Instructions', () => {
                 y = checkPageBreak(doc, y, 10);
                 doc.setFont('helvetica', 'normal');
                 doc.setFontSize(11);
                 doc.setTextColor(82, 82, 82);
                 const lines = doc.splitTextToSize(event.notes, pageW - margin * 2);
                 doc.text(lines, margin, y);
                 y += doc.getTextDimensions(lines).h + 5;
                 return y;
             });
        }
        
        renderFooter(doc);
        const fileName = `${client.name}_${event.eventType}_${style}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`${fileName}.pdf`);
    } catch(e) {
        console.error("Failed to generate Menu PDF:", e);
        alert(`Could not generate Menu PDF. An error occurred. Please check the browser console for details. Error: ${e instanceof Error ? e.message : String(e)}`);
    }
};

const renderSmallCardLogo = (doc: jsPDF, x: number, y: number) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#c43c3b');
    doc.text('kumkuma', x, y, { align: 'center', charSpace: 0.5 });
  
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4);
    doc.setTextColor('#525252');
    doc.text('CATERERS', x, y + 0.07, { align: 'center', charSpace: 1.5 });
};

export const exportNameCardsToPdf = (
    event: Event,
    client: Client,
    allItems: Item[],
    liveCounters: LiveCounter[],
    liveCounterItems: LiveCounterItem[]
) => {
    try {
        // --- 1. Compile all item names ---
        const itemMap = new Map(allItems.map(i => [i.id, i]));
        const eventItemIds = new Set(Object.values(event.itemIds || {}).flat());
        const mainItems: { name: string, type: ItemType }[] = [];
        eventItemIds.forEach(id => {
            const item = itemMap.get(id);
            if (item) mainItems.push({ name: item.name, type: item.type });
        });

        const liveCounterItemMap = new Map(liveCounterItems.map(lci => [lci.id, lci]));
        const liveCounterItemsForEvent: { name: string, type: 'veg' }[] = [];
        Object.values(event.liveCounters || {}).flat().forEach(id => {
            const item = liveCounterItemMap.get(id);
            if(item) liveCounterItemsForEvent.push({ name: item.name, type: 'veg' });
        });

        const allDisplayItems = [...mainItems, ...liveCounterItemsForEvent].sort((a,b) => a.name.localeCompare(b.name));
        
        // --- 2. PDF Setup ---
        const doc = new jsPDF({ orientation: 'p', unit: 'in', format: 'a4' });
        
        const CARD_W = 4;
        const CARD_H = 3.25;
        const USABLE_H = 3.0;
        const PAGE_W = doc.internal.pageSize.getWidth();
        const PAGE_H = doc.internal.pageSize.getHeight();
        const MARGIN_X = (PAGE_W - CARD_W * 2) / 2;
        const MARGIN_Y = (PAGE_H - CARD_H * 3) / 2;

        const positions = [
            { x: MARGIN_X, y: MARGIN_Y },
            { x: PAGE_W - MARGIN_X - CARD_W, y: MARGIN_Y },
            { x: MARGIN_X, y: MARGIN_Y + CARD_H },
            { x: PAGE_W - MARGIN_X - CARD_W, y: MARGIN_Y + CARD_H },
            { x: MARGIN_X, y: MARGIN_Y + CARD_H * 2 },
            { x: PAGE_W - MARGIN_X - CARD_W, y: MARGIN_Y + CARD_H * 2 },
        ];

        let cardIndex = 0;

        // --- 3. Loop and Draw Cards ---
        for (const item of allDisplayItems) {
            const pageCardIndex = cardIndex % 6;
            if (pageCardIndex === 0 && cardIndex > 0) {
                doc.addPage();
            }

            const { x, y } = positions[pageCardIndex];

            // Black Border
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.015);
            doc.rect(x, y, CARD_W, CARD_H);
            
            // Veg/Non-veg indicator dot
            const isVeg = item.type === 'veg';
            doc.setFillColor(isVeg ? '#22c55e' : '#ef4444');
            doc.circle(x + 0.25, y + 0.25, 0.08, 'F');

            // Dish Name
            doc.setFont('times', 'bold');
            doc.setTextColor('#333333');
            
            let fontSize = 22;
            doc.setFontSize(fontSize);
            let nameLines = doc.splitTextToSize(item.name, CARD_W - 0.75);
            let textHeight = doc.getTextDimensions(nameLines).h;

            // Dynamically reduce font size to fit
            while(textHeight > 1.5 && fontSize > 10) {
                fontSize -= 2;
                doc.setFontSize(fontSize);
                nameLines = doc.splitTextToSize(item.name, CARD_W - 0.75);
                textHeight = doc.getTextDimensions(nameLines).h;
            }

            doc.text(nameLines, x + CARD_W / 2, y + USABLE_H / 2, { align: 'center', baseline: 'middle' });
            
            // Kumkuma Caterers Logo at the bottom
            renderSmallCardLogo(doc, x + CARD_W / 2, y + CARD_H - 0.22);

            cardIndex++;
        }
        
        const fileName = `NameCards_${client.name}_${event.eventType}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`${fileName}.pdf`);

    } catch(e) {
         console.error("Failed to generate Name Cards PDF:", e);
        alert(`Could not generate Name Cards PDF. An error occurred: ${e instanceof Error ? e.message : String(e)}`);
    }
};


export const exportToExcel = (
    event: Event,
    client: Client,
    allItems: Item[],
    allCategories: AppCategory[],
    liveCounters: LiveCounter[],
    liveCounterItems: LiveCounterItem[]
) => {
    const wb = XLSX.utils.book_new();

    const itemMap = new Map(allItems.map(i => [i.id, i]));
    const categoryMap = new Map(allCategories.map(c => [c.id, c]));

    const menuItemsData = [];
    if (event.itemIds) {
        for (const categoryId in event.itemIds) {
            const category = categoryMap.get(categoryId);
            if (category) {
                const itemObjects = event.itemIds[categoryId]
                    .map(id => itemMap.get(id))
                    .filter((i): i is Item => !!i);

                itemObjects.forEach(item => {
                    menuItemsData.push({
                        Category: category.name,
                        Item: item.name,
                        Description: item.description,
                        Type: item.type,
                    });
                });
            }
        }
    }

    const liveCounterMap = new Map(liveCounters.map(lc => [lc.id, lc]));
    const liveCounterItemMap = new Map(liveCounterItems.map(lci => [lci.id, lci]));
    const liveCountersData = [];
    if (event.liveCounters) {
        for (const counterId in event.liveCounters) {
            const counter = liveCounterMap.get(counterId);
            if (counter) {
                const itemObjects = event.liveCounters[counterId]
                    .map(id => liveCounterItemMap.get(id))
                    .filter(Boolean) as LiveCounterItem[];

                itemObjects.forEach(item => {
                    liveCountersData.push({
                        'Live Counter': counter.name,
                        Item: item.name,
                        Description: item.description,
                    });
                });
            }
        }
    }

    const ws_menu = XLSX.utils.json_to_sheet(menuItemsData);
    XLSX.utils.book_append_sheet(wb, ws_menu, 'Menu Items');

    if (liveCountersData.length > 0) {
        const ws_lc = XLSX.utils.json_to_sheet(liveCountersData);
        XLSX.utils.book_append_sheet(wb, ws_lc, 'Live Counters');
    }
    
    const fileName = `${client.name}_${event.eventType}_${event.startDate}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};


export const exportReportToPdf = (title: string, headers: string[], data: any[][], filters: any, fileName: string) => {
    try {
        const doc = new jsPDF();
        
        let yPos = 15;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(title, 14, yPos);
        yPos += 8;

        // Render filters header
        if (filters && Object.values(filters).some(v => v)) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Filters Applied:', 14, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            
            Object.entries(filters).forEach(([key, value]) => {
                if (value) {
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    doc.text(`${label}: ${value}`, 14, yPos);
                    yPos += 5;
                }
            });
        }

        const bodyData = data.map(row => 
            row.map(cell => {
                if (cell === null || cell === undefined) return '';
                // Check if it's a styled cell object from autoTable
                if (typeof cell === 'object' && cell !== null && cell.hasOwnProperty('content')) {
                    return cell;
                }
                if (typeof cell === 'number') return `₹${cell.toLocaleString('en-IN')}`;
                return String(cell);
            })
        );
        
        const tableStartY = yPos > 25 ? yPos + 2 : 30;

        autoTable(doc, {
            head: [headers],
            body: bodyData,
            startY: tableStartY,
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [232, 168, 56], fontSize: 8 },
        });

        doc.save(fileName);
    } catch (e) {
        console.error("Failed to generate PDF report:", e);
        alert(`Could not generate PDF report. An error occurred: ${e instanceof Error ? e.message : String(e)}`);
    }
};

export const exportReportToExcel = (jsonData: any[], fileName: string, sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(jsonData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
};


export const exportFinanceToPdf = (event: Event, clientName: string) => {
    try {
        const doc = new jsPDF();
        
        const margin = 15;
        let yPos = margin;

        // Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('Financial Summary', margin, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(14);
        doc.text(event.eventType, margin, yPos);
        yPos += 6;
        doc.setFontSize(12);
        doc.text(`Client: ${clientName}`, margin, yPos);
        yPos += 6;
        const eventDateString = formatDateRange(event.startDate, event.endDate);
        doc.text(`Date: ${eventDateString}`, margin, yPos);
        yPos += 12;

        // Summary Calculations
        const model = event.pricingModel || 'variable';
        const foodCost = (event.pax || 0) * (event.perPaxPrice || 0);
        const rent = event.rent || 0;
        const baseCost = model === 'variable' ? foodCost : model === 'flat' ? rent : rent + foodCost;

        const totalCharges = (event.charges || []).filter(c => !c.isDeleted).reduce((sum, charge) => sum + charge.amount, 0);
        const totalBill = baseCost + totalCharges;
        const totalPayments = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted).reduce((sum, payment) => sum + payment.amount, 0);
        const totalExpenses = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted).reduce((sum, expense) => sum + expense.amount, 0);
        const balanceDue = totalBill - totalPayments;
        
        // Build Summary Table Data
        const summaryHeaderData: (string|number)[][] = [];
        if (model === 'variable' || model === 'mix') {
            summaryHeaderData.push(
                ['PAX Count', `${event.pax || 0}`],
                ['Per Pax Rate', `₹${(event.perPaxPrice || 0).toLocaleString('en-IN')}`],
                ['Total Food Cost', `₹${foodCost.toLocaleString('en-IN')}`]
            );
        }
        if (model === 'flat' || model === 'mix') {
            summaryHeaderData.push(['Base Rent', `₹${rent.toLocaleString('en-IN')}`]);
        }
        if (model === 'mix') {
             summaryHeaderData.push(['Subtotal (Rent + Food)', `₹${baseCost.toLocaleString('en-IN')}`]);
        }
            
        const summaryFooterData: (string|number)[][] = [
            ['Additional Charges', `₹${totalCharges.toLocaleString('en-IN')}`],
            ['Total Bill', `₹${totalBill.toLocaleString('en-IN')}`],
            ['Payments Received', `₹${totalPayments.toLocaleString('en-IN')}`],
            ['Total Expenses', `-₹${totalExpenses.toLocaleString('en-IN')}`],
            ['Balance Due', `₹${balanceDue.toLocaleString('en-IN')}`],
        ];

        const fullSummaryData = [...summaryHeaderData, ...summaryFooterData];

        const totalBillIndex = fullSummaryData.findIndex(row => row[0] === 'Total Bill');
        const balanceDueIndex = fullSummaryData.findIndex(row => row[0] === 'Balance Due');
        const foodCostIndex = fullSummaryData.findIndex(row => row[0] === 'Total Food Cost');
        const subtotalIndex = fullSummaryData.findIndex(row => row[0] === 'Subtotal (Rent + Food)');


        const boldRows = [foodCostIndex, subtotalIndex, totalBillIndex, balanceDueIndex].filter(i => i > -1);
        const borderedRows = [totalBillIndex, balanceDueIndex].filter(i => i > -1);
        
        autoTable(doc, {
            body: fullSummaryData,
            startY: yPos,
            theme: 'plain',
            styles: { fontSize: 12, font: 'helvetica' },
            columnStyles: { 1: { halign: 'right' as const } },
            willDrawCell: (data) => {
                if (boldRows.includes(data.row.index)) {
                    data.cell.styles.fontStyle = 'bold' as const;
                }
                if (borderedRows.includes(data.row.index)) {
                     data.cell.styles.lineWidth = { top: 0.2 };
                     data.cell.styles.lineColor = [20, 20, 20];
                }
            },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;

        // Charges Table
        const activeCharges = (event.charges || []).filter(c => !c.isDeleted);
        if (activeCharges.length > 0) {
            autoTable(doc, {
                head: [['Charges']],
                startY: yPos,
                styles: { font: 'helvetica' },
                theme: 'plain',
            });
            autoTable(doc, {
                head: [['Type', 'Amount', 'Notes']],
                body: activeCharges.map(c => [c.type, `₹${c.amount.toLocaleString('en-IN')}`, c.notes || '']),
                startY: (doc as any).lastAutoTable.finalY,
                theme: 'grid',
                styles: { font: 'helvetica' },
                headStyles: { fillColor: [232, 168, 56] }
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
        }

        // Income/Payments Table
        const payments = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted);
        if (payments.length > 0) {
            autoTable(doc, { head: [['Payments']], startY: yPos, styles: { font: 'helvetica' }, theme: 'plain' });
            autoTable(doc, {
                head: [['Date', 'Mode', 'Notes', 'Amount']],
                body: payments.map(t => [formatYYYYMMDD(t.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), t.paymentMode, t.notes, `₹${t.amount.toLocaleString('en-IN')}`]),
                startY: (doc as any).lastAutoTable.finalY,
                theme: 'grid',
                styles: { font: 'helvetica' },
                headStyles: { fillColor: [232, 168, 56] }
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
        }
        
        // Expenses Table
        const expenses = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted);
        if (expenses.length > 0) {
             autoTable(doc, { head: [['Expenses']], startY: yPos, styles: { font: 'helvetica' }, theme: 'plain' });
            autoTable(doc, {
                head: [['Date', 'Category', 'Notes', 'Amount']],
                body: expenses.map(t => [formatYYYYMMDD(t.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), t.category, t.notes, `₹${t.amount.toLocaleString('en-IN')}`]),
                startY: (doc as any).lastAutoTable.finalY,
                theme: 'grid',
                styles: { font: 'helvetica' },
                headStyles: { fillColor: [232, 168, 56] }
            });
        }

        const fileName = `Finance_${clientName}_${event.eventType}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`${fileName}.pdf`);
    } catch(e) {
        console.error("Failed to generate Finance PDF:", e);
        alert(`Could not generate Finance PDF. An error occurred. Please check the console for details. Error: ${e instanceof Error ? e.message : String(e)}`);
    }
}

export const exportTemplateToPdf = (
    template: MenuTemplate,
    catalog: Catalog,
    allItems: Item[],
    allCategories: AppCategory[]
) => {
  const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
    });
    
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Header
    renderPdfLogo(doc, margin, yPos);
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(34, 34, 34);
    doc.text(template.name, pageW - margin, margin + 5, { align: 'right' });
    yPos += 15;
    
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(115, 115, 115);
    doc.text(`Based on "${catalog.name}" Catalog`, pageW - margin, yPos, { align: 'right' });
    yPos = Math.max(yPos, margin + 15);
    yPos += 10;
    
    // Client detail fields
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);

    doc.text('Client Name:', margin, yPos);
    doc.line(margin + 30, yPos, pageW - margin, yPos);
    yPos += 10;
    
    doc.text('Event Date:', margin, yPos);
    doc.line(margin + 28, yPos, pageW - margin, yPos);
    yPos += 10;

    doc.text('Session:', margin, yPos);
    doc.rect(margin + 20, yPos - 4, 4, 4); 
    doc.text('Lunch', margin + 26, yPos);
    doc.rect(margin + 45, yPos - 4, 4, 4);
    doc.text('Dinner', margin + 51, yPos);
    yPos += 8;

    doc.setDrawColor('#e8a838');
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageW - margin, yPos);
    yPos += 10;

    const categoryMap = new Map(allCategories.map(c => [c.id, c]));
    const catalogItemIds = new Set(Object.values(catalog.itemIds).flat());
    const catalogItems = allItems.filter(item => catalogItemIds.has(item.id));
    
    const checkPageBreakFn = (y: number, spaceNeeded: number) => {
        if (y + spaceNeeded > pageH - margin) {
            doc.addPage();
            y = margin;
        }
        return y;
    };

    const parentCategoriesWithRules = Object.keys(template.rules)
        .map(catId => categoryMap.get(catId))
        .filter((cat): cat is AppCategory => !!cat)
        .sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));

    for (const parentCat of parentCategoriesWithRules) {
        yPos = checkPageBreakFn(yPos, 25);
        
        doc.setFont('times', 'bold');
        doc.setFontSize(16);
        doc.setTextColor('#b87522');
        doc.text(parentCat.name, margin, yPos);
        yPos += 6;
        
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(115,115,115);
        doc.text(`(Please select up to ${template.rules[parentCat.id]} from this section)`, margin, yPos);
        yPos += 8;
        
        const descendantIds = new Set<string>();
        const getDescendants = (id: string) => {
            descendantIds.add(id);
            allCategories.filter(c => c.parentId === id).forEach(child => getDescendants(child.id));
        };
        getDescendants(parentCat.id);

        const itemsInSection = catalogItems
            .filter(item => descendantIds.has(item.categoryId))
            .sort((a,b) => {
                const catA = categoryMap.get(a.categoryId);
                const catB = categoryMap.get(b.categoryId);
                if (catA && catB && catA.id !== catB.id) {
                     return (catA.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || catA.name.localeCompare(b.name);
                }
                return (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name);
            });
        
        // --- Two Column Layout ---
        const gutter = 8;
        const colWidth = (pageW - margin * 2 - gutter) / 2;
        const col1X = margin;
        const col2X = margin + colWidth + gutter;

        const renderTemplateItem = (item: Item, x: number, y: number, colW: number) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.setDrawColor(150, 150, 150);
            doc.rect(x, y - 3, 3, 3); // Checkbox
            doc.setTextColor(51, 51, 51);
            const nameLines = doc.splitTextToSize(item.name, colW - 10);
            doc.text(nameLines, x + 5, y);
            return doc.getTextDimensions(nameLines).h;
        };
        const getItemHeight = (item: Item, colW: number) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            const nameLines = doc.splitTextToSize(item.name, colW - 10);
            return doc.getTextDimensions(nameLines).h + 5;
        }

        const col1Items = itemsInSection.filter((_, index) => index % 2 === 0);
        const col2Items = itemsInSection.filter((_, index) => index % 2 !== 0);

        let yCol1 = yPos;
        let yCol2 = yPos;
        const maxLen = Math.max(col1Items.length, col2Items.length);

        for (let i = 0; i < maxLen; i++) {
            const item1 = col1Items[i];
            const item2 = col2Items[i];

            const h1 = item1 ? getItemHeight(item1, colWidth) : 0;
            const h2 = item2 ? getItemHeight(item2, colWidth) : 0;
            
            if ((item1 && yCol1 + h1 > pageH - margin) || (item2 && yCol2 + h2 > pageH - margin)) {
                doc.addPage();
                yCol1 = margin;
                yCol2 = margin;

                doc.setFont('times', 'bold');
                doc.setFontSize(16);
                doc.setTextColor('#b87522');
                doc.text(`${parentCat.name} (cont.)`, margin, yCol1);
                yCol1 += 10;
                yCol2 += 10;
            }

            if (item1) {
                renderTemplateItem(item1, col1X, yCol1, colWidth);
                yCol1 += h1;
            }
            if (item2) {
                renderTemplateItem(item2, col2X, yCol2, colWidth);
                yCol2 += h2;
            }
        }
        yPos = Math.max(yCol1, yCol2);
            
        yPos += 4; // Space between sections
    }

    doc.save(`Template_${template.name.replace(/ /g, '_')}.pdf`);
};

// --- DATA IMPORT/EXPORT HELPERS ---

export const downloadCategorySample = () => {
    const sampleData = [
        { "Parent Category": "Starters", "Child Category": "Hot Starters", "Type (for Parent only)": "non-veg", "Display Rank": 10 },
        { "Parent Category": "Starters", "Child Category": "Cold Starters", "Display Rank": 20 },
        { "Parent Category": "Mains", "Type (for Parent only)": "non-veg", "Display Rank": 20 },
    ];
    exportReportToExcel(sampleData, "category_import_sample.xlsx", "Categories");
};

export const downloadItemSample = () => {
    const sampleData = [
        { "Parent Category": "Starters", "Child Category": "Hot Starters", "Item Name": "Mushroom Vol-au-vent", "Description": "Puff pastry with mushroom ragout.", "Type": "veg", "Display Rank": 10 },
        { "Parent Category": "Mains", "Child Category": "", "Item Name": "Paneer Butter Masala", "Description": "Classic paneer dish.", "Type": "veg", "Display Rank": 20 },
        { "Parent Category": "Mains", "Child Category": "Chicken", "Item Name": "Chicken Tikka Masala", "Description": "Creamy chicken curry.", "Type": "chicken", "Display Rank": 30 },
    ];
    exportReportToExcel(sampleData, "item_import_sample.xlsx", "Items");
};

export const downloadLiveCounterSample = () => {
    const countersData = [
        { Name: "Pasta Station", Description: "Live cooking pasta station.", "Max Items": 3, "Display Rank": 1 },
        { Name: "Salad Bar", Description: "A selection of fresh salads.", "Max Items": 5, "Display Rank": 2 }
    ];
    const itemsData = [
        { Name: "Penne", "Live Counter Name": "Pasta Station", Description: "", "Display Rank": 1},
        { Name: "Alfredo Sauce", "Live Counter Name": "Pasta Station", Description: "Creamy parmesan sauce.", "Display Rank": 2},
        { Name: "Caesar Salad", "Live Counter Name": "Salad Bar", Description: "", "Display Rank": 1},
    ];
    const wb = XLSX.utils.book_new();
    const wsCounters = XLSX.utils.json_to_sheet(countersData);
    const wsItems = XLSX.utils.json_to_sheet(itemsData);
    XLSX.utils.book_append_sheet(wb, wsCounters, "Live Counters");
    XLSX.utils.book_append_sheet(wb, wsItems, "Live Counter Items");
    XLSX.writeFile(wb, "live_counters_import_sample.xlsx");
};

export const downloadCatalogSample = () => {
    const sampleData = [
        { "Catalog Name": "Wedding Catalog", "Catalog Description": "Items suitable for weddings.", "Item Name": "Lamb Kofta" },
        { "Catalog Name": "Wedding Catalog", "Catalog Description": "Items suitable for weddings.", "Item Name": "Mushroom Vol-au-vent" },
        { "Catalog Name": "Corporate Catalog", "Catalog Description": "", "Item Name": "Whipped Feta Crostini" },
    ];
    exportReportToExcel(sampleData, "catalog_import_sample.xlsx", "Catalogs");
};

export const downloadClientEventSample = () => {
    const sampleData = [
        { 
            "Client Name": "New Corp", 
            "Client Phone": "1234567890", 
            "Event Type": "Product Launch", 
            "Start Date": "2024-12-25",
            "End Date": "2024-12-26",
            "Session": "dinner",
            "Location": "Om Hall-1",
            "PAX": 150,
            "Rent": 0,
            "Per Pax Price": 2000
        },
        { 
            "Client Name": "New Corp", 
            "Client Phone": "1234567890", 
            "Event Type": "Annual Party", 
            "Start Date": "2024-12-31",
            "End Date": "",
            "Session": "dinner",
            "Location": "ODC",
            "PAX": 0,
            "Rent": 50000,
            "Per Pax Price": 0
        },
    ];
    exportReportToExcel(sampleData, "client_event_import_sample.xlsx", "Clients & Events");
};


export const exportAllCategories = (categories: AppCategory[]) => {
    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const data = categories.map(cat => ({
        ID: cat.id,
        Name: cat.name,
        'Parent Name': cat.parentId ? categoryMap.get(cat.parentId)?.name : '',
        'Parent ID': cat.parentId,
        'Display Rank': cat.displayRank,
        'Type': cat.type
    }));
    exportReportToExcel(data, "all_categories.xlsx", "Categories");
};

export const exportAllItems = (items: Item[], categories: AppCategory[]) => {
    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const data = items.map(item => {
        const category = categoryMap.get(item.categoryId);
        const parent = category?.parentId ? categoryMap.get(category.parentId) : null;
        return {
            ID: item.id,
            Name: item.name,
            Description: item.description,
            Type: item.type,
            'Parent Category': parent?.name || category?.name,
            'Child Category': parent ? category?.name : '',
            'Category ID': item.categoryId,
            'Display Rank': item.displayRank,
        };
    });
    exportReportToExcel(data, "all_items.xlsx", "Items");
};

export const exportAllLiveCounters = (liveCounters: LiveCounter[], liveCounterItems: LiveCounterItem[]) => {
    const counterData = liveCounters.map(lc => ({...lc}));
    const itemData = liveCounterItems.map(lci => {
        const counterName = liveCounters.find(lc => lc.id === lci.liveCounterId)?.name;
        return { ...lci, 'Live Counter Name': counterName };
    });
    
    const wb = XLSX.utils.book_new();
    const wsCounters = XLSX.utils.json_to_sheet(counterData);
    const wsItems = XLSX.utils.json_to_sheet(itemData);
    XLSX.utils.book_append_sheet(wb, wsCounters, "Live Counters");
    XLSX.utils.book_append_sheet(wb, wsItems, "Live Counter Items");
    XLSX.writeFile(wb, "all_live_counters.xlsx");
};

export const exportAllCatalogs = (catalogs: Catalog[], items: Item[]) => {
    const itemMap = new Map(items.map(i => [i.id, i.name]));
    const data = catalogs.flatMap(catalog => {
        return Object.values(catalog.itemIds).flat().map(itemId => ({
            'Catalog Name': catalog.name,
            'Catalog Description': catalog.description,
            'Item Name': itemMap.get(itemId) || `(Unknown Item ID: ${itemId})`,
        }));
    });
    exportReportToExcel(data, "all_catalogs.xlsx", "Catalogs");
};

export const exportAllClients = (clients: Client[]) => {
    const data = clients.map(client => ({
        ID: client.id,
        Name: client.name,
        Phone: client.phone,
        'System Access': client.hasSystemAccess ? 'Yes' : 'No',
        Status: client.status,
    }));
    exportReportToExcel(data, "all_clients.xlsx", "Clients");
};

export const exportAllEvents = (events: Event[], clients: Client[]) => {
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const data = events.map(event => ({
        ID: event.id,
        'Event Type': event.eventType,
        'Client Name': clientMap.get(event.clientId) || 'Unknown Client',
        'Start Date': event.startDate,
        'End Date': event.endDate,
        Session: event.session,
        Location: event.location,
        State: event.state,
        PAX: event.pax,
        'Pricing Model': event.pricingModel,
        'Rent': event.rent,
        'Per Pax Price': event.perPaxPrice,
    }));
    exportReportToExcel(data, "all_events.xlsx", "Events");
};

export const exportKitchenPlanToPdf = (event: Event, client: Client, planData: PlanCategory[]) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const margin = 15;
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        let yPos = margin;

        // --- Header ---
        const showOmLogo = event.location === 'Om Hall-1' || event.location === 'Om Hall-2';
        
        if (showOmLogo) {
            renderPdfLogo(doc, margin, yPos);
            const omLogoHeight = renderOmConventionLogo(doc, pageW - margin, yPos + 2, 'right');
            
            doc.setFont('times', 'bold');
            doc.setFontSize(24);
            doc.setTextColor(38,38,38);
            
            const kumkumaLogoHeight = 10;
            const titleY = margin + Math.max(omLogoHeight, kumkumaLogoHeight) / 2 - 2; // Adjust vertical centering
            doc.text('Kitchen Production Plan', pageW / 2, titleY, { align: 'center' });
            
            yPos = margin + Math.max(omLogoHeight, kumkumaLogoHeight);
        } else {
            renderPdfLogo(doc, margin, yPos);
            doc.setFont('times', 'bold');
            doc.setFontSize(24);
            doc.setTextColor(38,38,38);
            doc.text('Kitchen Production Plan', pageW - margin, yPos + 5, { align: 'right' });
            yPos += 20;
        }

        yPos += 5; // Add some space after the header

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(38, 38, 38);
        doc.text(`${client.name} - ${event.eventType}`, margin, yPos);

        const eventDateString = formatDateRange(event.startDate, event.endDate);

        doc.text(`Date: ${eventDateString}`, pageW - margin, yPos, { align: 'right' });
        yPos += 7;

        doc.setFontSize(10);
        doc.setTextColor(115, 115, 115);
        doc.text(`PAX: ${event.pax || 0}`, margin, yPos);
        doc.text(`Location: ${event.location}`, pageW / 2, yPos, { align: 'center' });
        doc.text(`Session: ${event.session.charAt(0).toUpperCase() + event.session.slice(1)}`, pageW - margin, yPos, { align: 'right' });
        yPos += 10;

        // --- Content ---
        const formatQuantity = (quantity: number) => quantity % 1 === 0 ? quantity : quantity.toFixed(2);

        planData.forEach(category => {
            const head = [['Item', 'Est. Qty', 'Unit', 'Actual Quantity']];
            const body = category.items.map(item => {
                const estQty = item.notes ? 'N/A' : formatQuantity(item.quantity);
                const unit = item.notes ? '' : item.unit;
                return [
                    item.name,
                    estQty,
                    unit,
                    '' // Empty column for override
                ];
            });

            // check for page break before adding a table
            const tableHeight = (body.length + 2) * 8; // rough estimate of table height
             if (yPos + tableHeight > pageH - margin) {
                doc.addPage();
                yPos = margin;
            }

            autoTable(doc, {
                head: [[{ content: category.categoryName, colSpan: 4, styles: { fontStyle: 'bold' as const, fontSize: 14, halign: 'left' as const, fillColor: '#fff8e1', textColor: '#b87522' } }]],
                startY: yPos,
                theme: 'plain'
            });

            autoTable(doc, {
                head: head,
                body: body,
                startY: (doc as any).lastAutoTable.finalY,
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
                headStyles: { fillColor: [232, 168, 56], textColor: [255,255,255], fontSize: 10 },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { cellWidth: 25, halign: 'right' as const },
                    2: { cellWidth: 20, halign: 'left' as const },
                    3: { cellWidth: 35, halign: 'right' as const },
                },
                didDrawCell: (data) => {
                    // Draw a line in the 'Actual Quantity' column for writing
                    if (data.column.index === 3 && data.cell.section === 'body') {
                        doc.setDrawColor(200, 200, 200);
                        doc.line(data.cell.x + 2, data.cell.y + data.cell.height - 3, data.cell.x + data.cell.width - 2, data.cell.y + data.cell.height - 3);
                    }
                }
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
        });

        if (event.notes) {
             if (yPos + 25 > pageH - margin) {
                doc.addPage();
                yPos = margin;
            }
            autoTable(doc, {
                head: [[{ content: 'Special Instructions', colSpan: 4, styles: { fontStyle: 'bold' as const, fontSize: 14, halign: 'left' as const } }]],
                startY: yPos,
                theme: 'plain'
            });

            const textY = (doc as any).lastAutoTable.finalY + 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(82, 82, 82);
            const lines = doc.splitTextToSize(event.notes, pageW - (margin * 2));
            doc.text(lines, margin, textY);
            yPos = textY + (doc.getTextDimensions(lines).h) + 10;
        }

        // --- Footer ---
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(163, 163, 163);
            doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 10, { align: 'right' });
            doc.text(`Kumkuma Caterers - Kitchen Plan`, margin, pageH - 10);
        }
        
        const fileName = `KitchenPlan_${client.name}_${event.eventType}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`${fileName}.pdf`);
    } catch (e) {
        console.error("Failed to generate Kitchen Plan PDF:", e);
        alert(`Could not generate PDF. An error occurred: ${e instanceof Error ? e.message : String(e)}`);
    }
}

export const exportFinanceSectionToPdf = (
    title: string,
    headers: string[],
    data: any[][],
    event: Event,
    clientName: string
) => {
    try {
        const doc = new jsPDF();
        
        const margin = 15;
        let yPos = margin;

        // Simplified Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(title, margin, yPos);
        yPos += 7;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(115, 115, 115);
        const eventDateString = formatDateRange(event.startDate, event.endDate);
        doc.text(`${clientName} - ${event.eventType} - ${eventDateString}`, margin, yPos);
        yPos += 10;


        const totalAmount = data.reduce((sum, row) => sum + (Number(row[row.length - 1]) || 0), 0);

        const bodyData = data.map(row => 
            row.map((cell, index) => {
                if (index === row.length - 1 && typeof cell === 'number') {
                    return `₹${cell.toLocaleString('en-IN')}`;
                }
                if (headers[index] === 'Date' && typeof cell === 'string') {
                    return formatYYYYMMDD(cell, { day: '2-digit', month: '2-digit', year: 'numeric' });
                }
                return cell;
            })
        );
        
        const totalFooter = [[
            { content: 'Total', colSpan: headers.length - 1, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
            { content: `₹${totalAmount.toLocaleString('en-IN')}`, styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
        ]];

        autoTable(doc, {
            head: [headers],
            body: bodyData,
            foot: totalFooter,
            startY: yPos,
            theme: 'grid',
            headStyles: { fillColor: [232, 168, 56] },
            footStyles: { fillColor: [229, 229, 229], textColor: [0, 0, 0] }
        });

        const fileName = `${title.replace(/[\(\)]/g, '').replace(/ /g, '_')}_${clientName}`.replace(/[^a-z0-9_]/gi, '').toLowerCase();
        doc.save(`${fileName}.pdf`);
    } catch(e) {
        console.error(`Failed to generate ${title} PDF:`, e);
        alert(`Could not generate ${title} PDF. An error occurred. Error: ${e instanceof Error ? e.message : String(e)}`);
    }
}

export const exportAllRecipes = (recipes: Recipe[], rawMaterials: RawMaterial[]) => {
    const rawMaterialMap = new Map(rawMaterials.map(rm => [rm.id, rm]));
    const data: any[] = [];

    recipes.forEach(recipe => {
        if (!recipe.rawMaterials || recipe.rawMaterials.length === 0) {
            data.push({
                'Recipe': recipe.name,
                'Instructions': recipe.instructions,
                'Raw Material': '',
                'Raw Material Unit': '',
                'Raw Material Qty': '',
                'Output Quantity': recipe.outputKg > 0 ? recipe.outputKg : recipe.outputLitres,
                'Output Unit': recipe.outputKg > 0 ? 'kg' : 'litres',
            });
        } else {
            recipe.rawMaterials.forEach((rm, index) => {
                const rawMaterialDetails = rawMaterialMap.get(rm.rawMaterialId);
                const row: any = {
                    'Recipe': recipe.name,
                    'Raw Material': rawMaterialDetails?.name || `(Unknown ID: ${rm.rawMaterialId})`,
                    'Raw Material Unit': rawMaterialDetails?.unit || '',
                    'Raw Material Qty': rm.quantity,
                };

                if (index === 0) {
                    row['Instructions'] = recipe.instructions;
                    row['Output Quantity'] = recipe.outputKg > 0 ? recipe.outputKg : recipe.outputLitres;
                    row['Output Unit'] = recipe.outputKg > 0 ? 'kg' : (recipe.outputLitres > 0 ? 'litres' : '');
                } else {
                    row['Instructions'] = '';
                    row['Output Quantity'] = '';
                    row['Output Unit'] = '';
                }
                data.push(row);
            });
        }
    });

    exportReportToExcel(data, "all_recipes.xlsx", "Recipes");
};

export const downloadRecipeSample = () => {
    const sampleData = [
        { 
            "Recipe": "Tomato Soup",
            "Instructions": "1. Saute onions.\n2. Add tomatoes.\n3. Blend.",
            "Raw Material": "Tomato",
            "Raw Material Unit": "kg",
            "Raw Material Qty": 5,
            "Output Quantity": 4.5,
            "Output Unit": "litres"
        },
        { 
            "Recipe": "Tomato Soup",
            "Instructions": "",
            "Raw Material": "Onion",
            "Raw Material Unit": "kg",
            "Raw Material Qty": 1,
            "Output Quantity": "",
            "Output Unit": ""
        },
        { 
            "Recipe": "Tomato Soup",
            "Instructions": "",
            "Raw Material": "Salt",
            "Raw Material Unit": "grams",
            "Raw Material Qty": 50,
            "Output Quantity": "",
            "Output Unit": ""
        },
    ];
    exportReportToExcel(sampleData, "recipe_import_sample.xlsx", "Recipes");
};

export const exportAllMuhurthamDates = (dates: MuhurthamDate[]) => {
    const data = dates.map(d => ({ Date: d.date })).sort((a,b) => a.Date.localeCompare(b.Date));
    exportReportToExcel(data, "all_muhurtham_dates.xlsx", "Muhurtham Dates");
};

export const downloadMuhurthamDateSample = () => {
    const sampleData = [
        { Date: "2024-11-15" },
        { Date: "2024-12-02" },
    ];
    exportReportToExcel(sampleData, "muhurtham_dates_import_sample.xlsx", "Muhurtham Dates");
};