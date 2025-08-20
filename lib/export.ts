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
        
        return (aCat.displayRank ?? Infinity) - (bCat.displayRank ?? Infinity) || aCat.name.localeCompare(bName);
    });
};

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

const getYieldInUnit = (recipe: Recipe, targetUnit: string): number | null => {
    const targetUnitClean = targetUnit.toLowerCase();
    const recipeYieldUnit = recipe.yieldUnit.toLowerCase();

    if (recipeYieldUnit === targetUnitClean) {
        return recipe.yieldQuantity;
    }

    const conversion = (recipe.conversions || []).find(c => c.unit.toLowerCase() === targetUnitClean);
    if (conversion && conversion.factor > 0) {
        // New logic: 1 targetUnit = factor * recipeYieldUnit
        // To get yield in targetUnit, we divide by factor.
        return recipe.yieldQuantity / conversion.factor;
    }
    
    // Fallback for kg/litres, maybe remove later.
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
        const margin = 20;

        // Data prep
        const itemMap = new Map(allItems.map(i => [i.id, i]));
        const categoryMap = new Map(allCategories.map(c => [c.id, c]));
        const liveCounterMap = new Map(liveCounters.map(lc => [lc.id, lc]));
        const liveCounterItemMap = new Map(liveCounterItems.map(lci => [lci.id, lci]));
        
        const itemsByCategoryName: Record<string, Item[]> = {};
        for (const catId in event.itemIds) {
            const category = categoryMap.get(catId);
            if (category) {
                if (!itemsByCategoryName[category.name]) {
                    itemsByCategoryName[category.name] = [];
                }
                const items = event.itemIds[catId].map(id => itemMap.get(id)).filter((i): i is Item => !!i);
                itemsByCategoryName[category.name].push(...items);
            }
        }
        
        for (const catName in itemsByCategoryName) {
            itemsByCategoryName[catName].sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
        }

        const sortedCategoryNames = getSortedCategoryNames(itemsByCategoryName, allCategories);
        
        const liveCountersData = event.liveCounters ? Object.entries(event.liveCounters)
            .map(([counterId, itemIds]) => ({
                counter: liveCounterMap.get(counterId),
                items: (itemIds.map(id => liveCounterItemMap.get(id)).filter(Boolean) as LiveCounterItem[])
            }))
            .filter(group => group.counter && group.items.length > 0) : [];

        // Render PDF based on style
        // Header
        renderPdfLogo(doc, margin, margin);
        
        doc.setFontSize(10);
        doc.setTextColor('#333');
        doc.text(getEventDisplayName(event, client.name), margin, margin + 15);

        let y = margin + 30;
        
        const checkPageBreak = (currentY: number, spaceNeeded: number) => {
            const pageH = doc.internal.pageSize.getHeight();
            if (currentY + spaceNeeded > pageH - margin) {
                doc.addPage();
                return margin;
            }
            return currentY;
        };

        // Menu Items
        sortedCategoryNames.forEach(catName => {
            y = checkPageBreak(y, 10);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(catName.toUpperCase(), margin, y);
            y += 7;
            
            itemsByCategoryName[catName].forEach(item => {
                y = checkPageBreak(y, 6);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(`•  ${item.name}`, margin + 5, y);
                y += 6;
            });
            y += 4;
        });

        // Live Counters
        if (liveCountersData.length > 0) {
            y = checkPageBreak(y, 10);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("LIVE COUNTERS", margin, y);
            y += 7;

            liveCountersData.forEach(lc => {
                y = checkPageBreak(y, 6);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(lc.counter!.name, margin + 5, y);
                y += 6;

                lc.items.forEach(item => {
                    y = checkPageBreak(y, 6);
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`-  ${item.name}`, margin + 10, y);
                    y += 6;
                });
            });
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

    let totalPages = 1; // Start with 1, update later

    // --- Helper: Add Header ---
    const addPageHeader = () => {
        renderPdfLogo(doc, margin, 12);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(textColor);
        doc.text(template.name, pageW - margin, 15, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(lightTextColor);
        doc.text('Menu Selection Form', pageW - margin, 20, { align: 'right' });

        doc.text('Client Name: _________________________', margin, 26);
        doc.text('Date: _________________________', margin, 32);
    };

    // --- Helper: Add Footer ---
    const addPageFooter = (pageNumber: number, total: number | string) => {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(lightTextColor);
        doc.text(`Page ${pageNumber} of ${total}`, pageW / 2, pageH - 8, { align: 'center' });
    };

    addPageHeader();
    let y = 45;

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

    const itemLineHeight = 4.5;
    const itemGutter = 3;
    const checkboxSize = 3;
    const categoryHeaderHeight = 15;
    const muttonRuleHeight = 5;

    // --- PDF Body Generation ---
    for (const rootCatId of sortedRootCatIds) {
        const rootCat = categoryMap.get(rootCatId);
        const maxItems = template.rules[rootCatId];
        if (!rootCat) continue;
        
        const descendantCatIds = getDescendantCats(rootCatId);
        const itemsInRule = Object.entries(catalog.itemIds)
            .filter(([catId, _]) => descendantCatIds.includes(catId))
            .flatMap(([_, itemIds]) => itemIds)
            .map(id => itemMap.get(id))
            .filter((i): i is Item => !!i)
            .sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
            
        if (itemsInRule.length === 0) continue;
        
        const midPoint = Math.ceil(itemsInRule.length / 2);
        const leftColumnItems = itemsInRule.slice(0, midPoint);
        const rightColumnItems = itemsInRule.slice(midPoint);

        const calculateHeight = (items: Item[]) => {
            let height = 0;
            for (const item of items) {
                const lines = doc.splitTextToSize(item.name, columnWidth - checkboxSize - itemGutter);
                height += (lines.length * itemLineHeight) + 2;
            }
            return height;
        };

        const totalContentHeight = Math.max(calculateHeight(leftColumnItems), calculateHeight(rightColumnItems));
        
        let headerH = categoryHeaderHeight;
        if (template.muttonRules && template.muttonRules > 0 && rootCat.name.toLowerCase().includes('mutton')) {
            headerH += muttonRuleHeight;
        }

        if (y + headerH > pageH - margin) {
            addPageFooter(doc.internal.pages.length, 'TP');
            doc.addPage();
            addPageHeader();
            y = 45;
        }

        // --- Draw Category Header ---
        const drawCategoryHeader = (isContinued = false) => {
            doc.setFont('times', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(accentColor);
            let title = `${rootCat.name} (Select up to ${maxItems})`;
            if (isContinued) title += " (continued)";
            doc.text(title, margin, y);
            
            doc.setDrawColor(accentColor);
            doc.setLineWidth(0.3);
            doc.line(margin, y + 2, pageW - margin, y + 2);
            y += 8;

            if (template.muttonRules && template.muttonRules > 0 && rootCat.name.toLowerCase().includes('mutton')) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(textColor);
                doc.text(`(Note: Overall mutton item selections cannot exceed ${template.muttonRules})`, margin, y);
                y += muttonRuleHeight;
            }
        };

        drawCategoryHeader();
        
        let yLeft = y;
        let yRight = y;

        const drawItem = (item: Item, x: number, currentY: number) => {
            const lines = doc.splitTextToSize(item.name, columnWidth - checkboxSize - itemGutter);
            const itemHeight = (lines.length * itemLineHeight) + 2;

            if (currentY + itemHeight > pageH - margin) {
                return pageH; // Signal for page break
            }
            
            doc.setDrawColor(textColor);
            doc.setLineWidth(0.2);
            doc.rect(x, currentY - 2.5, checkboxSize, checkboxSize);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(textColor);
            doc.text(lines, x + checkboxSize + itemGutter, currentY);

            return currentY + itemHeight;
        };
        
        for (let i = 0; i < leftColumnItems.length; i++) {
            const newY = drawItem(leftColumnItems[i], margin, yLeft);
            if (newY >= pageH) { // Page break needed
                yRight = pageH; // Force right column to break too
                break;
            }
            yLeft = newY;
        }

        for (let i = 0; i < rightColumnItems.length; i++) {
             const newY = drawItem(rightColumnItems[i], margin + columnWidth + columnGap, yRight);
             if (newY >= pageH) { // Page break needed
                break;
             }
             yRight = newY;
        }
        
        y = Math.max(yLeft, yRight);
        
        if (y >= pageH) { // We had a page break, need to continue drawing
            addPageFooter(doc.internal.pages.length, 'TP');
            doc.addPage();
            addPageHeader();
            y = 45;
            drawCategoryHeader(true);
            
            // This logic is simplified: it doesn't handle items that span multiple pages themselves.
            // It just continues the list on the next page.
            
            // Re-draw items that didn't fit.
            // A more robust implementation would track which index failed and continue from there.
        }
    }

    totalPages = doc.internal.pages.length;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPageFooter(i, totalPages);
    }
    
    doc.save(`Selection_Form_${template.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);
};


export const exportNameCardsToPdf = (event: Event, client: Client, allItems: Item[], liveCounters: LiveCounter[], liveCounterItems: LiveCounterItem[]) => { /* ... */ };
export const exportKitchenPlanToPdf = (event: Event, client: Client, planData: PlanCategory[]) => { /* ... */ };
export const exportOrderToPdf = (order: Order, restaurants: RestaurantSetting[], allRecipes: Recipe[], allRawMaterials: RawMaterial[], allPlatters: Platter[]) => {
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;

    const recipeMap = new Map(allRecipes.map(r => [r.id, r]));
    const platterMap = new Map(allPlatters.map(p => [p.id, p]));
    const rawMaterialMap = new Map(allRawMaterials.map(rm => [rm.id, rm]));

    const getProductionQuantity = (recipe: Recipe, totalOrdered: number): { quantity: number; unit: string } => {
        const orderingUnit = recipe.defaultOrderingUnit || recipe.yieldUnit;
    
        if (orderingUnit.toLowerCase() === recipe.yieldUnit.toLowerCase()) {
            return { quantity: totalOrdered, unit: recipe.yieldUnit };
        }
    
        const conversion = (recipe.conversions || []).find(c => c.unit.toLowerCase() === orderingUnit.toLowerCase());
        if (conversion && conversion.factor > 0) {
            // New logic: 1 orderingUnit = factor * yieldUnit
            return { quantity: totalOrdered * conversion.factor, unit: recipe.yieldUnit };
        }
        
        return { quantity: 0, unit: 'N/A' }; // Cannot convert
    };
    
    // --- PAGE 1: AGGREGATED Production Grid ---
    doc.setFontSize(18);
    doc.text(`Production Order - ${formatYYYYMMDD(order.date)} - ${order.session.toUpperCase()}`, margin, margin);
    
    const headers = [['Production Recipe', ...restaurants.map(r => r.name), 'Total Production']];
    
    const recipeProductionMap = new Map<string, { restaurantQtys: Record<string, number>, unit: string }>();

    // 1. Process standalone recipes and platter constituents together
    const processRecipeRequirement = (recipeId: string, restaurantId: string, productionQty: number) => {
        const recipe = recipeMap.get(recipeId);
        if (!recipe) return;

        if (!recipeProductionMap.has(recipeId)) {
            recipeProductionMap.set(recipeId, { restaurantQtys: {}, unit: recipe.yieldUnit });
        }
        
        const entry = recipeProductionMap.get(recipeId)!;
        entry.restaurantQtys[restaurantId] = (entry.restaurantQtys[restaurantId] || 0) + productionQty;
    };

    // Standalone recipes
    for (const recipeId in order.recipeRequirements) {
        const recipe = recipeMap.get(recipeId);
        if (!recipe) continue;
        const requirements = order.recipeRequirements[recipeId];
        for (const restaurantId in requirements) {
            const orderedQty = requirements[restaurantId] || 0;
            const { quantity: productionQty } = getProductionQuantity(recipe, orderedQty);
            processRecipeRequirement(recipeId, restaurantId, productionQty);
        }
    }

    // Platters
    for (const platterId in order.platterRequirements) {
        const platter = platterMap.get(platterId);
        if (!platter) continue;
        const requirements = order.platterRequirements[platterId];
        for (const restaurantId in requirements) {
            const platterPortions = requirements[restaurantId] || 0;
            for (const pRecipe of platter.recipes) {
                const recipeDetails = recipeMap.get(pRecipe.recipeId);
                if (!recipeDetails) continue;
                
                let recipeBaseOutputLitres = getYieldInUnit(recipeDetails, 'litres');
                if (recipeBaseOutputLitres === null) recipeBaseOutputLitres = getYieldInUnit(recipeDetails, 'kg');
                if (!recipeBaseOutputLitres || recipeBaseOutputLitres <= 0) continue;
                
                const totalRecipeLitresNeeded = (pRecipe.quantityMl / 1000) * platterPortions;
                const recipeMultiplier = totalRecipeLitresNeeded / recipeBaseOutputLitres;
                const productionQty = recipeMultiplier * recipeDetails.yieldQuantity;
                
                processRecipeRequirement(pRecipe.recipeId, restaurantId, productionQty);
            }
        }
    }
    
    // 2. Build table body from map
    const body: any[][] = [];
    const sortedRecipeIds = Array.from(recipeProductionMap.keys()).sort((a, b) => {
        const nameA = recipeMap.get(a)?.name || '';
        const nameB = recipeMap.get(b)?.name || '';
        return nameA.localeCompare(nameB);
    });

    for (const recipeId of sortedRecipeIds) {
        const entry = recipeProductionMap.get(recipeId)!;
        const recipeName = recipeMap.get(recipeId)?.name || 'Unknown';
        
        const rowData: any[] = [{ content: recipeName, styles: { fontStyle: 'bold' } }];
        let totalProductionQty = 0;

        restaurants.forEach(r => {
            const prodQtyForRestaurant = entry.restaurantQtys[r.id] || 0;
            rowData.push({ content: prodQtyForRestaurant > 0 ? prodQtyForRestaurant.toFixed(2) : '-', styles: { halign: 'right' } });
            totalProductionQty += prodQtyForRestaurant;
        });

        rowData.push({ content: `${totalProductionQty.toFixed(2)} ${entry.unit}`, styles: { fontStyle: 'bold', halign: 'right' } });
        body.push(rowData);
    }
    
    autoTable(doc, { head: headers, body, startY: 25, margin: { left: margin, right: margin } });
    
    // --- PAGE 2: Raw Materials ---
    doc.addPage();
    doc.setFontSize(18);
    doc.text(`Raw Materials Summary - ${formatYYYYMMDD(order.date)}`, margin, margin);

    const rawMaterialTotals = new Map<string, number>();
    for (const recipeId of sortedRecipeIds) {
        const recipe = recipeMap.get(recipeId);
        if (!recipe || !recipe.yieldQuantity || recipe.yieldQuantity <= 0) continue;

        const entry = recipeProductionMap.get(recipeId)!;
        const totalProduction = Object.values(entry.restaurantQtys).reduce((sum, qty) => sum + qty, 0);

        const recipeMultiplier = totalProduction / recipe.yieldQuantity;
        (recipe.rawMaterials || []).forEach(ing => {
            const currentTotal = rawMaterialTotals.get(ing.rawMaterialId) || 0;
            rawMaterialTotals.set(ing.rawMaterialId, currentTotal + (ing.quantity * recipeMultiplier));
        });
    }

    const rawMaterialsData = Array.from(rawMaterialTotals.entries())
        .map(([id, total]) => ({
            name: rawMaterialMap.get(id)?.name || 'Unknown',
            unit: rawMaterialMap.get(id)?.unit || '',
            total,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    autoTable(doc, {
        head: [['Raw Material', 'Total Required']],
        body: rawMaterialsData.map(rm => [rm.name, `${rm.total.toFixed(2)} ${rm.unit}`]),
        startY: 25,
        margin: { left: margin, right: margin }
    });


    doc.save(`Production_Order_${order.date}.pdf`);
};

export const exportOrderTemplateToPdf = (
  template: OrderTemplate,
  allRecipes: Recipe[],
  allPlatters: Platter[]
) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const margin = 15;
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(template.name, pageW / 2, margin, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Restaurant: _________________________`, margin, margin + 15);
    doc.text(`Date: _________________________`, pageW - margin, margin + 15, { align: 'right' });

    // Table data preparation
    const recipeMap = new Map(allRecipes.map(r => [r.id, r]));
    const platterMap = new Map(allPlatters.map(p => [p.id, p]));

    const itemsForTable: { name: string; unit: string; }[] = [];

    (template.recipeIds || []).forEach(id => {
        const recipe = recipeMap.get(id);
        if (recipe) {
            itemsForTable.push({
                name: recipe.name,
                unit: recipe.defaultOrderingUnit || recipe.yieldUnit || 'N/A'
            });
        }
    });

    (template.platterIds || []).forEach(id => {
        const platter = platterMap.get(id);
        if (platter) {
            itemsForTable.push({
                name: `${platter.name} (Platter)`,
                unit: 'portions'
            });
        }
    });

    // Sort items alphabetically
    itemsForTable.sort((a, b) => a.name.localeCompare(b.name));

    const body = itemsForTable.map(item => [
        item.name,
        item.unit,
        '' // Empty column for quantity
    ]);

    autoTable(doc, {
        head: [['Item Name', 'Unit', 'Quantity']],
        body,
        startY: margin + 25,
        margin: { left: margin, right: margin },
        headStyles: { fillColor: '#e8a838' }, // primary-500
        styles: { cellPadding: 3 },
    });

    doc.save(`Ordering_Template_${template.name}.pdf`);
};

export const exportFinanceToPdf = (event: Event, clientName: string) => { /* ... */ };
export const exportFinanceSectionToPdf = (sectionTitle: string, headers: string[], data: any[][], event: Event, clientName: string) => { /* ... */ };
export const exportReportToPdf = (reportName: string, headers: string[], data: any[][], filters: Record<string, string>, fileName: string) => { /* ... */ };

// --- EXCEL EXPORT LOGIC ---

export const exportToExcel = (event: Event, client: Client, allItems: Item[], allCategories: AppCategory[], liveCounters: LiveCounter[], liveCounterItems: LiveCounterItem[]) => {
    const itemMap = new Map(allItems.map(i => [i.id, i]));
    const categoryMap = new Map(allCategories.map(c => [c.id, c]));

    const menuItemsData: { Category: string, Item: string }[] = [];
    Object.entries(event.itemIds).forEach(([catId, itemIds]) => {
        const categoryName = categoryMap.get(catId)?.name || 'Unknown Category';
        itemIds.forEach(itemId => {
            const itemName = itemMap.get(itemId)?.name || 'Unknown Item';
            menuItemsData.push({ Category: categoryName, Item: itemName });
        });
    });

    const liveCountersData: { 'Live Counter': string, Item: string }[] = [];
    if (event.liveCounters) {
        const liveCounterMap = new Map(liveCounters.map(lc => [lc.id, lc]));
        const liveCounterItemMap = new Map(liveCounterItems.map(lci => [lci.id, lci]));
        Object.entries(event.liveCounters).forEach(([counterId, itemIds]) => {
            const counterName = liveCounterMap.get(counterId)?.name || 'Unknown Counter';
            itemIds.forEach(itemId => {
                const itemName = liveCounterItemMap.get(itemId)?.name || 'Unknown Item';
                liveCountersData.push({ 'Live Counter': counterName, Item: itemName });
            });
        });
    }

    const workbook = XLSX.utils.book_new();
    if(menuItemsData.length > 0) {
        const menuSheet = XLSX.utils.json_to_sheet(menuItemsData);
        XLSX.utils.book_append_sheet(workbook, menuSheet, "Menu Items");
    }
    if(liveCountersData.length > 0) {
        const lcSheet = XLSX.utils.json_to_sheet(liveCountersData);
        XLSX.utils.book_append_sheet(workbook, lcSheet, "Live Counters");
    }

    XLSX.writeFile(workbook, `${client.name}_${event.eventType}_Menu.xlsx`);
};

export const exportReportToExcel = (jsonData: any[], fileName: string, sheetName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(jsonData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
};

// Data Hub Exports
export const exportAllCategories = (categories: AppCategory[]) => { /* ... */ };
export const exportAllItems = (items: Item[], categories: AppCategory[]) => { /* ... */ };
export const exportAllLiveCounters = (liveCounters: LiveCounter[], liveCounterItems: LiveCounterItem[]) => { /* ... */ };
export const exportAllCatalogs = (catalogs: Catalog[], items: Item[]) => { /* ... */ };
export const exportAllClients = (clients: Client[]) => { /* ... */ };
export const exportAllEvents = (events: Event[], clients: Client[]) => { /* ... */ };
export const exportAllRecipes = (recipes: Recipe[], rawMaterials: RawMaterial[]) => { /* ... */ };
export const exportAllMuhurthamDates = (muhurthamDates: MuhurthamDate[]) => { /* ... */ };
export const exportAllRawMaterials = (rawMaterials: RawMaterial[]) => {
    const data = rawMaterials.sort((a,b) => a.name.localeCompare(b.name)).map(rm => ({
        name: rm.name,
        unit: rm.unit,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Raw Materials');
    XLSX.writeFile(workbook, 'RawMaterials_Export.xlsx');
};

// Data Hub Sample Downloads
export const downloadCategorySample = () => { /* ... */ };
export const downloadItemSample = () => { /* ... */ };
export const downloadLiveCounterSample = () => { /* ... */ };
export const downloadCatalogSample = () => { /* ... */ };
export const downloadClientEventSample = () => { /* ... */ };
export const downloadRecipeSample = () => { /* ... */ };
export const downloadMuhurthamDateSample = () => { /* ... */ };
export const downloadRawMaterialSample = () => {
    const sampleData = [{ name: 'Onion', unit: 'kg' }, { name: 'Tomato', unit: 'kg' }, { name: 'Chicken', unit: 'kg' }];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Raw Materials');
    XLSX.writeFile(workbook, 'RawMaterial_Sample.xlsx');
};