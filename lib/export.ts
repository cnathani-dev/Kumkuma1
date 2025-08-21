import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Event, Item, LiveCounter, LiveCounterItem, AppCategory, Catalog, MenuTemplate, Transaction, Charge, ItemType, Client, PlanCategory, Recipe, RawMaterial, MuhurthamDate, Order, RestaurantSetting, Platter, PlatterRecipe, OrderTemplate } from '../types';
import { kumkumaCaterersLogoBase64 } from './branding';
import { formatYYYYMMDD, formatDateRange, dateToYYYYMMDD } from './utils';

// --- BRAND COLORS ---
const primaryColor = '#e8a838'; // Main Saffron
const accentColor = '#c43c3b'; // Main Red
const textColor = '#404040'; // warm-gray-700
const lightTextColor = '#737373'; // warm-gray-500
const whiteColor = '#FFFFFF';

// --- PDF HELPER FUNCTIONS ---

const getEventDisplayName = (event: Event, clientName: string) => {
    const dateString = formatDateRange(event.startDate, event.endDate);
    const session = event.session.charAt(0).toUpperCase() + event.session.slice(1);
    
    let paxInfo = event.pax ? `(${event.pax} PAX)` : '';
    return `${clientName} - ${event.eventType} - ${session} on ${dateString} ${paxInfo}`.trim();
}

const renderPdfLogo = (doc: jsPDF, x: number, y: number) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(accentColor);
    const kumkumaText = 'kumkuma';
    doc.text(kumkumaText, x, y, { charSpace: 0.5 });
    const kumkumaWidth = doc.getTextWidth(kumkumaText) + (kumkumaText.length - 1) * 0.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textColor);
    const caterersText = 'CATERERS';
    const caterersWidth = doc.getTextWidth(caterersText) + (caterersText.length - 1) * 2;
    const caterersX = x + (kumkumaWidth - caterersWidth) / 2;
    doc.text(caterersText, caterersX, y + 4, { charSpace: 2 });
}

interface PageShellOptions {
  showLogo?: boolean;
  showClientFields?: boolean;
  isFirstPage: boolean;
  subTitle?: string;
}

const addPageShell = (doc: jsPDF, title: string, pageNumber: number, totalPages: number, options: PageShellOptions) => {
  const { showLogo = true, showClientFields = false, isFirstPage, subTitle } = options;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Page Border
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, pageW - 10, pageH - 10);
  
  // Header
  if (isFirstPage && showLogo) {
      renderPdfLogo(doc, margin, 12);
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(textColor);
  doc.text(title, pageW - margin, 15, { align: 'right' });

  if (subTitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(lightTextColor);
    doc.text(subTitle, pageW - margin, 20, { align: 'right' });
  }

  if (isFirstPage && showClientFields) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(lightTextColor);
      doc.text('Client Name: _________________________', margin, 28);
      doc.text('Date: _________________________', margin, 34);
  }

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(lightTextColor);
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageW / 2, pageH - 8, { align: 'center' });
};

const getYieldInUnit = (recipe: Recipe, targetUnit: string): number | null => {
    const targetUnitClean = targetUnit.toLowerCase();
    const recipeYieldUnit = recipe.yieldUnit.toLowerCase();

    if (recipeYieldUnit === targetUnitClean) {
        return recipe.yieldQuantity;
    }

    const conversion = (recipe.conversions || []).find(c => c.unit.toLowerCase() === targetUnitClean);
    if (conversion && conversion.factor > 0) {
        return recipe.yieldQuantity / conversion.factor;
    }
    
    if ((recipeYieldUnit === 'kg' && targetUnitClean === 'litres') || (recipeYieldUnit === 'litres' && targetUnitClean === 'kg')) {
        return recipe.yieldQuantity;
    }

    return null;
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
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageW - margin * 2;
        const columnGap = 10;
        const columnWidth = (contentWidth - columnGap) / 2;
        const initialYFirstPage = 45;
        const initialYSubsequentPage = 25;

        // --- Drawing Constants ---
        const itemLineHeight = 4.5;
        const categoryHeaderHeight = 10;
        const categoryBottomMargin = 10;

        // --- Data Prep ---
        const itemMap = new Map(allItems.map(i => [i.id, i]));
        const categoryMap = new Map(allCategories.map(c => [c.id, c]));
        const liveCounterMap = new Map(liveCounters.map(lc => [lc.id, lc]));
        const liveCounterItemMap = new Map(liveCounterItems.map(lci => [lci.id, lci]));
        
        const getDescendantCats = (rootId: string): string[] => {
            const children: string[] = [];
            const queue = [rootId];
            const visited = new Set([rootId]);
            while (queue.length > 0) {
                const currentId = queue.shift()!;
                allCategories.forEach(c => {
                    if (c.parentId === currentId && !visited.has(c.id)) {
                        visited.add(c.id);
                        children.push(c.id);
                        queue.push(c.id);
                    }
                });
            }
            return [rootId, ...children];
        };
        
        const rootCatIdsInEvent = new Set<string>();
        Object.keys(event.itemIds).forEach(catId => {
            let currentCat = categoryMap.get(catId);
            while (currentCat && currentCat.parentId) {
                currentCat = categoryMap.get(currentCat.parentId);
            }
            if (currentCat) {
                rootCatIdsInEvent.add(currentCat.id);
            }
        });

        const sortedRootCats = Array.from(rootCatIdsInEvent)
            .map(id => categoryMap.get(id))
            .filter((c): c is AppCategory => !!c)
            .sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));

        // --- Helper: Calculate Item Height ---
        const calculateItemHeight = (itemText: string): number => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(itemText, columnWidth - 5);
            return (lines.length * itemLineHeight) + 2; // +2 for vertical padding
        };

        // --- Helper: Draw a single item ---
        const drawFinalMenuItem = (itemText: string, x: number, currentY: number) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(itemText, columnWidth - 5);
            
            doc.setTextColor(primaryColor);
            doc.setFont('helvetica', 'bold');
            doc.text('•', x, currentY);

            doc.setTextColor(textColor);
            doc.setFont('helvetica', 'normal');
            doc.text(lines, x + 5, currentY);
        };

        // --- PDF Generation ---
        addPageShell(doc, 'Finalized Menu', 1, 1, { isFirstPage: true, showLogo: true, subTitle: getEventDisplayName(event, client.name) });
        let y = initialYFirstPage;

        for (const rootCat of sortedRootCats) {
            const descendantCatIds = getDescendantCats(rootCat.id);
            const itemsInCategory = Object.entries(event.itemIds)
                .filter(([catId, _]) => descendantCatIds.includes(catId))
                .flatMap(([_, itemIds]) => itemIds)
                .map(id => itemMap.get(id))
                .filter((i): i is Item => !!i)
                .sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
                
            if (itemsInCategory.length === 0) continue;

            if (y + categoryHeaderHeight > pageH - margin) {
                doc.addPage();
                y = initialYSubsequentPage;
            }

            // --- Draw Category Header ---
            doc.setFont('times', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(accentColor);
            doc.text(rootCat.name, margin, y);
            doc.setDrawColor(accentColor);
            doc.setLineWidth(0.3);
            doc.line(margin, y + 2, pageW - margin, y + 2);
            y += categoryHeaderHeight;

            let yLeft = y;
            let yRight = y;

            for (const item of itemsInCategory) {
                const itemHeight = calculateItemHeight(item.name);
                
                // Check for page break
                if (yLeft + itemHeight > pageH - margin && yRight + itemHeight > pageH - margin) {
                    doc.addPage();
                    y = initialYSubsequentPage;
                    yLeft = y;
                    yRight = y;
                }

                if (yLeft <= yRight) {
                    drawFinalMenuItem(item.name, margin, yLeft);
                    yLeft += itemHeight;
                } else {
                    drawFinalMenuItem(item.name, margin + columnWidth + columnGap, yRight);
                    yRight += itemHeight;
                }
            }
            y = Math.max(yLeft, yRight) + categoryBottomMargin;
        }
        
        // --- Special Instructions ---
        if (event.notes) {
            const notesHeaderHeight = 10;
            const splitNotes = doc.splitTextToSize(event.notes, contentWidth - 4);
            const boxHeight = (splitNotes.length * itemLineHeight) + 8;
            const notesSectionHeight = notesHeaderHeight + boxHeight;

            if (y + notesSectionHeight > pageH - margin) {
                doc.addPage();
                y = initialYSubsequentPage;
            }

            doc.setFont('times', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(accentColor);
            doc.text('Special Instructions', margin, y);
            doc.setDrawColor(accentColor);
            doc.setLineWidth(0.3);
            doc.line(margin, y + 2, pageW - margin, y + 2);
            y += notesHeaderHeight;

            doc.setFillColor('#fffde7'); // Light yellow
            doc.setDrawColor('#fffde7');
            doc.rect(margin, y, contentWidth, boxHeight, 'F');
            
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.setTextColor(textColor);
            doc.text(splitNotes, margin + 2, y + 5);

            y += boxHeight + categoryBottomMargin;
        }

        // --- Live Counters ---
        const selectedLiveCounters = event.liveCounters ? Object.keys(event.liveCounters).filter(key => event.liveCounters![key].length > 0) : [];

        if (selectedLiveCounters.length > 0) {
            if (y + categoryHeaderHeight > pageH - margin) {
                doc.addPage();
                y = initialYSubsequentPage;
            }

            doc.setFont('times', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(accentColor);
            doc.text('Live Counters', margin, y);
            doc.setDrawColor(accentColor);
            doc.setLineWidth(0.3);
            doc.line(margin, y + 2, pageW - margin, y + 2);
            y += categoryHeaderHeight;

            const sortedLiveCounterIds = selectedLiveCounters
                .map(id => liveCounterMap.get(id))
                .filter((lc): lc is LiveCounter => !!lc)
                .sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name))
                .map(lc => lc.id);
            
            for (const lcId of sortedLiveCounterIds) {
                const counter = liveCounterMap.get(lcId)!;
                const itemsInCounter = event.liveCounters![lcId]
                    .map(itemId => liveCounterItemMap.get(itemId))
                    .filter((i): i is LiveCounterItem => !!i)
                    .sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
                
                if (itemsInCounter.length === 0) continue;

                let yLeft = y;
                let yRight = y;

                for (const item of itemsInCounter) {
                    const itemHeight = calculateItemHeight(item.name);
                    
                    if (yLeft + itemHeight > pageH - margin && yRight + itemHeight > pageH - margin) {
                        doc.addPage();
                        y = initialYSubsequentPage;
                        yLeft = y;
                        yRight = y;
                    }

                    if (yLeft <= yRight) {
                        drawFinalMenuItem(item.name, margin, yLeft);
                        yLeft += itemHeight;
                    } else {
                        drawFinalMenuItem(item.name, margin + columnWidth + columnGap, yRight);
                        yRight += itemHeight;
                    }
                }
                y = Math.max(yLeft, yRight) + (categoryBottomMargin / 2); // Smaller margin between counters
            }
        }


        const totalPages = doc.internal.pages.length;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            addPageShell(doc, 'Finalized Menu', i, totalPages, { isFirstPage: i === 1, showLogo: true, subTitle: getEventDisplayName(event, client.name) });
        }

        doc.save(`${client.name}_${event.eventType}_Menu.pdf`);
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        alert("Sorry, there was an error generating the PDF.");
    }
};

export const exportTemplateToPdf = (template: MenuTemplate, catalog: Catalog, allItems: Item[], allCategories: AppCategory[]) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageW - margin * 2;
    const columnGap = 10;
    const columnWidth = (contentWidth - columnGap) / 2;
    const initialYFirstPage = 45;
    const initialYSubsequentPage = 25;

    // --- Drawing Constants ---
    const itemLineHeight = 4.5;
    const itemGutter = 3;
    const checkboxSize = 3.5;
    const categoryHeaderBaseHeight = 10;
    const subCategoryHeaderHeight = 8;
    const categoryBottomMargin = 10;
    const muttonRuleHeight = 5;
    const subCategoryVerticalGutter = 5;

    // --- Helper: Calculate Item Height ---
    const calculateItemHeight = (itemText: string): number => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(itemText, columnWidth - checkboxSize - itemGutter);
        return (lines.length * itemLineHeight) + 2; // +2 for vertical padding
    };
    
    // --- Helper: Draw a single item ---
    const drawItem = (itemText: string, x: number, currentY: number) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(itemText, columnWidth - checkboxSize - itemGutter);
        
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.4);
        doc.rect(x, currentY - (checkboxSize / 2) - 1, checkboxSize, checkboxSize);

        doc.setTextColor(textColor);
        doc.text(lines, x + checkboxSize + itemGutter, currentY);
    };

    // --- Data Prep ---
    const itemMap = new Map(allItems.map(i => [i.id, i]));
    const categoryMap = new Map(allCategories.map(c => [c.id, c]));
    
    const getDescendantCats = (rootId: string): string[] => {
        const children: string[] = [];
        const queue = [rootId];
        const visited = new Set([rootId]);
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            allCategories.forEach(c => {
                if (c.parentId === currentId && !visited.has(c.id)) {
                    visited.add(c.id);
                    children.push(c.id);
                    queue.push(c.id);
                }
            });
        }
        return [rootId, ...children];
    };
    
    const sortedRootCatIds = Object.keys(template.rules)
        .map(id => categoryMap.get(id))
        .filter((c): c is AppCategory => !!c)
        .sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name))
        .map(c => c.id);

    // --- PDF Body Generation ---
    addPageShell(doc, template.name, 1, 1, { isFirstPage: true, showLogo: true, showClientFields: true, subTitle: 'Menu Selection Form' });
    let y = initialYFirstPage;

    for (const rootCatId of sortedRootCatIds) {
        const rootCat = categoryMap.get(rootCatId);
        const maxItems = template.rules[rootCatId];
        if (!rootCat) continue;
        
        const descendantCatIds = getDescendantCats(rootCatId);
        const itemsInRule = Object.entries(catalog.itemIds)
            .filter(([catId, _]) => descendantCatIds.includes(catId))
            .flatMap(([_, itemIds]) => itemIds)
            .map(id => itemMap.get(id))
            .filter((i): i is Item => !!i);
            
        if (itemsInRule.length === 0) continue;

        const itemsBySubCatId: { [id: string]: Item[] } = {};
        itemsInRule.forEach(item => {
            if (!itemsBySubCatId[item.categoryId]) itemsBySubCatId[item.categoryId] = [];
            itemsBySubCatId[item.categoryId].push(item);
        });

        const subCategoryGroups = Object.keys(itemsBySubCatId)
            .map(catId => ({ category: categoryMap.get(catId)!, items: itemsBySubCatId[catId].sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name))}))
            .filter(group => group.category)
            .sort((a, b) => (a.category.displayRank ?? Infinity) - (b.category.displayRank ?? Infinity) || a.category.name.localeCompare(b.category.name));
        
        let headerHeight = categoryHeaderBaseHeight;
        if (template.muttonRules && template.muttonRules > 0 && rootCat.name.toLowerCase().includes('mutton')) headerHeight += muttonRuleHeight;

        if (y + headerHeight > pageH - margin) {
            doc.addPage();
            y = initialYSubsequentPage;
        }

        doc.setFont('times', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(accentColor);
        doc.text(rootCat.name, margin, y);
        const titleWidth = doc.getTextWidth(rootCat.name);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(lightTextColor);
        doc.text(`(Select up to ${maxItems})`, margin + titleWidth + 3, y, { baseline: 'bottom' });

        doc.setDrawColor(accentColor);
        doc.setLineWidth(0.3);
        doc.line(margin, y + 2, pageW - margin, y + 2);
        y += categoryHeaderBaseHeight;

        if (template.muttonRules && template.muttonRules > 0 && rootCat.name.toLowerCase().includes('mutton')) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(textColor);
            doc.text(`(Note: Overall mutton item selections cannot exceed ${template.muttonRules})`, margin, y);
            y += muttonRuleHeight;
        }

        subCategoryGroups.forEach((group, index) => {
            if (index > 0) y += subCategoryVerticalGutter;
            
            let subCatItems = group.items;
            let itemsDrawnForSubCat = 0;
            let isFirstChunkOfSubCat = true;

            while(itemsDrawnForSubCat < subCatItems.length) {
                if (y + subCategoryHeaderHeight > pageH - margin) {
                    doc.addPage();
                    y = initialYSubsequentPage;
                }
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(textColor);
                doc.text(isFirstChunkOfSubCat ? group.category.name : `${group.category.name} (continued)`, margin, y);
                y += subCategoryHeaderHeight;
                isFirstChunkOfSubCat = false;

                let yLeft = y, yRight = y;
                let itemsToDrawOnThisPage = 0;
                
                for(const item of subCatItems.slice(itemsDrawnForSubCat)) {
                    const itemHeight = calculateItemHeight(item.name);
                    if (yLeft <= yRight) { if (yLeft + itemHeight <= pageH - margin) { yLeft += itemHeight; itemsToDrawOnThisPage++; } else if (yRight + itemHeight <= pageH - margin) { yRight += itemHeight; itemsToDrawOnThisPage++; } else break; }
                    else { if (yRight + itemHeight <= pageH - margin) { yRight += itemHeight; itemsToDrawOnThisPage++; } else if(yLeft + itemHeight <= pageH - margin) { yLeft += itemHeight; itemsToDrawOnThisPage++; } else break; }
                }
                
                yLeft = y; yRight = y;
                const itemsToDraw = subCatItems.slice(itemsDrawnForSubCat, itemsDrawnForSubCat + itemsToDrawOnThisPage);
                const midPoint = Math.ceil(itemsToDraw.length / 2);

                itemsToDraw.slice(0, midPoint).forEach(item => {
                    drawItem(item.name, margin, yLeft);
                    yLeft += calculateItemHeight(item.name);
                });
                itemsToDraw.slice(midPoint).forEach(item => {
                    drawItem(item.name, margin + columnWidth + columnGap, yRight);
                    yRight += calculateItemHeight(item.name);
                });

                itemsDrawnForSubCat += itemsToDrawOnThisPage;
                y = Math.max(yLeft, yRight);

                if (itemsDrawnForSubCat < subCatItems.length) {
                    doc.addPage();
                    y = initialYSubsequentPage;
                }
            }
        });
        y += categoryBottomMargin;
    }

    const totalPages = doc.internal.pages.length;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPageShell(doc, template.name, i, totalPages, { isFirstPage: i === 1, showLogo: true, showClientFields: true, subTitle: 'Menu Selection Form' });
    }
    
    doc.save(`Selection_Form_${template.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);
};


export const exportNameCardsToPdf = (event: Event, client: Client, allItems: Item[], liveCounters: LiveCounter[], liveCounterItems: LiveCounterItem[]) => { /* ... */ };
export const exportKitchenPlanToPdf = (event: Event, client: Client, planData: PlanCategory[]) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    addPageShell(doc, "Kitchen Production Plan", 1, 1, { isFirstPage: true, showLogo: true, subTitle: getEventDisplayName(event, client.name) });

    const tableData = planData.flatMap(cat => [
        [{ content: cat.categoryName, colSpan: 3, styles: { fontStyle: 'bold' as const, fillColor: '#f5f5f5' } }],
        ...cat.items.map(item => [item.name, item.quantity, item.unit])
    ]);

    autoTable(doc, {
        head: [['Item', 'Quantity', 'Unit']],
        body: tableData,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: primaryColor },
    });
    
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        addPageShell(doc, "Kitchen Production Plan", i, totalPages, { isFirstPage: false, showLogo: true, subTitle: getEventDisplayName(event, client.name) });
    }

    doc.save(`Kitchen_Plan_${client.name}_${event.eventType}.pdf`);
};
export const exportOrderToPdf = (order: Order, restaurants: RestaurantSetting[], allRecipes: Recipe[], allRawMaterials: RawMaterial[], allPlatters: Platter[]) => { /* ... */ };
export const exportOrderTemplateToPdf = (template: OrderTemplate, allRecipes: Recipe[], allPlatters: Platter[]) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    addPageShell(doc, template.name, 1, 1, { isFirstPage: true, showLogo: true, showClientFields: true, subTitle: 'Ordering Form' });
    
    const recipeMap = new Map(allRecipes.map(r => [r.id, r]));
    const platterMap = new Map(allPlatters.map(p => [p.id, p]));

    const itemsForTable: { name: string; unit: string; }[] = [];
    (template.recipeIds || []).forEach(id => { const recipe = recipeMap.get(id); if (recipe) itemsForTable.push({ name: recipe.name, unit: recipe.defaultOrderingUnit || recipe.yieldUnit || 'N/A' }); });
    (template.platterIds || []).forEach(id => { const platter = platterMap.get(id); if (platter) itemsForTable.push({ name: `${platter.name} (Platter)`, unit: 'portions' }); });
    itemsForTable.sort((a, b) => a.name.localeCompare(b.name));

    autoTable(doc, {
        head: [['Item Name', 'Unit', 'Quantity']],
        body: itemsForTable.map(item => [item.name, item.unit, '']),
        startY: 45,
        headStyles: { fillColor: primaryColor },
        styles: { cellPadding: 3 },
    });
    
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        addPageShell(doc, template.name, i, totalPages, { isFirstPage: false, showLogo: true, showClientFields: true, subTitle: 'Ordering Form' });
    }
    
    doc.save(`Ordering_Template_${template.name}.pdf`);
};

export const exportFinanceToPdf = (event: Event, clientName: string) => { /* ... */ };
export const exportFinanceSectionToPdf = (sectionTitle: string, headers: string[], data: any[][], event: Event, clientName: string) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const subTitle = getEventDisplayName(event, clientName);
    
    addPageShell(doc, sectionTitle, 1, 1, { isFirstPage: true, showLogo: false, subTitle });

    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 30,
        headStyles: { fillColor: primaryColor }
    });
    
    const totalPages = (doc as any).internal.getNumberOfPages();
     for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        addPageShell(doc, sectionTitle, i, totalPages, { isFirstPage: false, showLogo: false, subTitle });
    }
    
    doc.save(`Finance_${sectionTitle.replace(/ /g, '_')}_${clientName}.pdf`);
};
export const exportReportToPdf = (reportName: string, headers: string[], data: any[][], filters: Record<string, string>, fileName: string) => { /* ... */ };

// --- EXCEL EXPORT LOGIC ---

export const exportToExcel = (event: Event, client: Client, allItems: Item[], allCategories: AppCategory[], liveCounters: LiveCounter[], liveCounterItems: LiveCounterItem[]) => { /* ... */ };
export const exportReportToExcel = (jsonData: any[], fileName: string, sheetName: string) => { /* ... */ };

// Data Hub Exports
export const exportAllCategories = (categories: AppCategory[]) => { /* ... */ };
export const exportAllItems = (items: Item[], categories: AppCategory[]) => { /* ... */ };
export const exportAllLiveCounters = (liveCounters: LiveCounter[], liveCounterItems: LiveCounterItem[]) => { /* ... */ };
export const exportAllCatalogs = (catalogs: Catalog[], items: Item[]) => { /* ... */ };
export const exportAllClients = (clients: Client[]) => { /* ... */ };
export const exportAllEvents = (events: Event[], clients: Client[]) => { /* ... */ };
export const exportAllRecipes = (recipes: Recipe[], rawMaterials: RawMaterial[]) => { /* ... */ };
export const exportAllMuhurthamDates = (muhurthamDates: MuhurthamDate[]) => { /* ... */ };
export const exportAllRawMaterials = (rawMaterials: RawMaterial[]) => { /* ... */ };

// Data Hub Sample Downloads
export const downloadCategorySample = () => { /* ... */ };
export const downloadItemSample = () => { /* ... */ };
export const downloadLiveCounterSample = () => { /* ... */ };
export const downloadCatalogSample = () => { /* ... */ };
export const downloadClientEventSample = () => { /* ... */ };
export const downloadRecipeSample = () => { /* ... */ };
export const downloadMuhurthamDateSample = () => { /* ... */ };
export const downloadRawMaterialSample = () => { /* ... */ };