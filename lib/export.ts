import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Event, Item, LiveCounter, LiveCounterItem, AppCategory, Catalog, MenuTemplate, Transaction, Charge, ItemType, Client, PlanCategory, Recipe, RawMaterial, MuhurthamDate, Order, RestaurantSetting, Platter, PlatterRecipe, OrderTemplate, ItemAccompaniment } from '../types';
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
    const locationInfo = event.location ? ` at ${event.location}` : '';
    
    let paxInfo = event.pax ? `(${event.pax} PAX)` : '';
    return `${clientName} - ${event.eventType}${locationInfo} - ${session} on ${dateString} ${paxInfo}`.trim();
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
  clientFieldLabel?: string;
}

const addPageShell = (doc: jsPDF, title: string, pageNumber: number, totalPages: number, options: PageShellOptions) => {
  const { showLogo = true, showClientFields = false, isFirstPage, subTitle, clientFieldLabel } = options;
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
      const nameLabel = clientFieldLabel || 'Client Name';
      doc.text(`${nameLabel}: _________________________`, margin, 28);
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

const getPackingQuantity = (recipe: Recipe, totalProductionInYieldUnit: number): { quantity: number; unit: string } => {
    const preferredUnits = ['kg', 'grams']; // Order of preference
    const yieldUnit = recipe.yieldUnit.toLowerCase();

    // Check if yield unit is already a preferred weight unit
    for (const unit of preferredUnits) {
        if (yieldUnit === unit) {
            return { quantity: totalProductionInYieldUnit, unit: recipe.yieldUnit };
        }
    }

    // Check for explicit conversions to preferred weight units
    for (const unit of preferredUnits) {
        const conversion = (recipe.conversions || []).find(c => c.unit.toLowerCase() === unit);
        if (conversion && conversion.factor > 0) {
            // Factor is yield_qty per conversion_unit_qty. So total_in_conv_unit = total_in_yield_unit / factor
            return { quantity: totalProductionInYieldUnit / conversion.factor, unit: conversion.unit };
        }
    }
    
    // Special handling for litres -> kg assumption
    if (yieldUnit.includes('litre')) {
        return { quantity: totalProductionInYieldUnit, unit: 'kg (assumed)' };
    }

    // Fallback to base yield unit
    return { quantity: totalProductionInYieldUnit, unit: recipe.yieldUnit };
};


// --- PDF EXPORT LOGIC ---

// Helper function to group items by their root category for PDF display
const groupItemsByRootCategory = (
    itemIds: Record<string, string[]> | undefined,
    itemMap: Map<string, Item>,
    categoryMap: Map<string, AppCategory>
) => {
    if (!itemIds) return [];

    const getRoot = (catId: string): AppCategory | undefined => {
        let current = categoryMap.get(catId);
        if (!current) return undefined;
        while (current.parentId && categoryMap.has(current.parentId)) {
            current = categoryMap.get(current.parentId)!;
        }
        return current;
    };

    const itemsByRootCat = new Map<string, { rootCat: AppCategory; items: Item[] }>();

    Object.values(itemIds || {}).flat().forEach(itemId => {
        const item = itemMap.get(itemId);
        if (item) {
            const root = getRoot(item.categoryId);
            if (root) {
                if (!itemsByRootCat.has(root.id)) {
                    itemsByRootCat.set(root.id, { rootCat: root, items: [] });
                }
                itemsByRootCat.get(root.id)!.items.push(item);
            }
        }
    });

    return Array.from(itemsByRootCat.values())
        .sort((a, b) => (a.rootCat.displayRank ?? Infinity) - (b.rootCat.displayRank ?? Infinity) || a.rootCat.name.localeCompare(b.rootCat.name))
        .map(group => ({
            ...group,
            items: group.items.sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name))
        }));
};

const drawMenuSection = (
    doc: jsPDF,
    title: string,
    groupedItems: ReturnType<typeof groupItemsByRootCategory>,
    startY: number,
    { pageH, margin, initialYSubsequentPage, columnWidth, columnGap, itemLineHeight, categoryHeaderHeight, categoryBottomMargin, accompanimentMap }: any
): number => {
    let y = startY;

    if (groupedItems.length === 0) return y;
    
    // Section Header
    if (y + categoryHeaderHeight > pageH - margin) {
        doc.addPage();
        y = initialYSubsequentPage;
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(accentColor);
    doc.text(title, margin, y);
    doc.setDrawColor(accentColor);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2, margin + (columnWidth*2 + columnGap), y + 2);
    y += categoryHeaderHeight;
    
    // Item drawing helpers
    const calculateItemHeight = (item: Item): number => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(item.name, columnWidth - 5);
        let height = (lines.length * itemLineHeight) + 2;

        if (item.accompanimentIds && item.accompanimentIds.length > 0) {
            const accompanimentNames = item.accompanimentIds
                .map(id => accompanimentMap.get(id))
                .filter(Boolean) as string[];

            if (accompanimentNames.length > 0) {
                const accompanimentText = `w/ ${accompanimentNames.join(', ')}`;
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);
                const accLines = doc.splitTextToSize(accompanimentText, columnWidth - 10);
                height += (accLines.length * (itemLineHeight - 1)) + 1;
            }
        }
        return height;
    };

    const drawFinalMenuItem = (item: Item, x: number, currentY: number) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(item.name, columnWidth - 5);
        
        doc.setTextColor(primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.text('•', x, currentY);

        doc.setTextColor(textColor);
        doc.setFont('helvetica', 'normal');
        doc.text(lines, x + 5, currentY);

        let yOffset = lines.length * itemLineHeight;

        if (item.accompanimentIds && item.accompanimentIds.length > 0) {
            const accompanimentNames = item.accompanimentIds
                .map(id => accompanimentMap.get(id))
                .filter(Boolean) as string[];

            if (accompanimentNames.length > 0) {
                const accompanimentText = `w/ ${accompanimentNames.join(', ')}`;
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);
                doc.setTextColor(lightTextColor);
                doc.text(accompanimentText, x + 8, currentY + yOffset, { maxWidth: columnWidth - 10 });
            }
        }
    };

    for (const { rootCat, items } of groupedItems) {
        if (y + categoryHeaderHeight > pageH - margin) {
            doc.addPage();
            y = initialYSubsequentPage;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(textColor);
        doc.text(rootCat.name, margin, y);
        y += 8;

        let yLeft = y;
        let yRight = y;

        for (const item of items) {
            const itemHeight = calculateItemHeight(item);
            
            if (yLeft + itemHeight > pageH - margin && yRight + itemHeight > pageH - margin) {
                doc.addPage();
                y = initialYSubsequentPage;
                yLeft = y;
                yRight = y;
            }

            if (yLeft <= yRight) {
                drawFinalMenuItem(item, margin, yLeft);
                yLeft += itemHeight;
            } else {
                drawFinalMenuItem(item, margin + columnWidth + columnGap, yRight);
                yRight += itemHeight;
            }
        }
        y = Math.max(yLeft, yRight) + (categoryBottomMargin / 2);
    }
    return y + categoryBottomMargin;
};


export const exportToPdf = (
  event: Event,
  client: Client,
  allItems: Item[],
  allCategories: AppCategory[],
  liveCounters: LiveCounter[], 
  liveCounterItems: LiveCounterItem[],
  allAccompaniments: ItemAccompaniment[]
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
        let y = initialYFirstPage;

        // --- Data Prep ---
        const itemMap = new Map(allItems.map(i => [i.id, i]));
        const categoryMap = new Map(allCategories.map(c => [c.id, c]));
        const liveCounterMap = new Map(liveCounters.map(lc => [lc.id, lc]));
        const liveCounterItemMap = new Map(liveCounterItems.map(lci => [lci.id, lci]));
        const accompanimentMap = new Map(allAccompaniments.map(acc => [acc.id, acc.name]));
        
        const drawingConstants = {
            pageH, margin, initialYSubsequentPage, columnWidth, columnGap,
            itemLineHeight: 4.5,
            categoryHeaderHeight: 10,
            categoryBottomMargin: 10,
            accompanimentMap
        };

        if (event.notes) {
            const notesHeaderHeight = 10;
            const splitNotes = doc.splitTextToSize(event.notes, contentWidth - 4);
            const boxHeight = (splitNotes.length * drawingConstants.itemLineHeight) + 8;
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

            doc.setFillColor('#fffde7');
            doc.setDrawColor('#fffde7');
            doc.rect(margin, y, contentWidth, boxHeight, 'F');
            
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.setTextColor(textColor);
            doc.text(splitNotes, margin + 2, y + 5);

            y += boxHeight + drawingConstants.categoryBottomMargin;
        }

        // --- Main Menu ---
        const mainMenuItems = groupItemsByRootCategory(event.itemIds, itemMap, categoryMap);
        y = drawMenuSection(doc, 'Main Menu', mainMenuItems, y, drawingConstants);

        // --- Cocktail Menu ---
        const cocktailMenuItems = groupItemsByRootCategory(event.cocktailMenuItems, itemMap, categoryMap);
        y = drawMenuSection(doc, 'Cocktail & Snacks Menu', cocktailMenuItems, y, drawingConstants);
        
        // --- Hi-Tea Menu ---
        const hiTeaMenuItems = groupItemsByRootCategory(event.hiTeaMenuItems, itemMap, categoryMap);
        y = drawMenuSection(doc, 'Hi-Tea Menu', hiTeaMenuItems, y, drawingConstants);
        
        // --- Live Counters ---
        const selectedLiveCounters = event.liveCounters ? Object.keys(event.liveCounters).filter(key => event.liveCounters![key].length > 0) : [];

        if (selectedLiveCounters.length > 0) {
            if (y + drawingConstants.categoryHeaderHeight > pageH - margin) {
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
            y += drawingConstants.categoryHeaderHeight;

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

                if (y + 8 > pageH - margin) {
                    doc.addPage();
                    y = initialYSubsequentPage;
                }
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(textColor);
                doc.text(counter.name, margin, y);
                y += 8;


                let yLeft = y;
                let yRight = y;

                for (const item of itemsInCounter) {
                    const itemText = item.description ? `${item.name} (${item.description})` : item.name;
                    const itemHeight = drawingConstants.itemLineHeight * doc.splitTextToSize(itemText, columnWidth - 5).length + 2;
                    
                    if (yLeft + itemHeight > pageH - margin && yRight + itemHeight > pageH - margin) {
                        doc.addPage();
                        y = initialYSubsequentPage;
                        yLeft = y;
                        yRight = y;
                    }
                    
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    const lines = doc.splitTextToSize(itemText, columnWidth - 5);
                    doc.setTextColor(primaryColor);
                    doc.setFont('helvetica', 'bold');

                    if (yLeft <= yRight) {
                        doc.text('•', margin, yLeft);
                        doc.setTextColor(textColor);
                        doc.setFont('helvetica', 'normal');
                        doc.text(lines, margin + 5, yLeft);
                        yLeft += itemHeight;
                    } else {
                        doc.text('•', margin + columnWidth + columnGap, yRight);
                        doc.setTextColor(textColor);
                        doc.setFont('helvetica', 'normal');
                        doc.text(lines, margin + columnWidth + columnGap + 5, yRight);
                        yRight += itemHeight;
                    }
                }
                y = Math.max(yLeft, yRight) + (drawingConstants.categoryBottomMargin / 2);
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
    let y = 0;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageW - margin * 2;
    const columnGap = 10;
    const columnWidth = (contentWidth - columnGap) / 2;
    const initialYFirstPage = 45;
    const initialYSubsequentPage = 25;

    const itemLineHeight = 4.5;
    const itemGutter = 3;
    const checkboxSize = 3.5;
    const categoryHeaderBaseHeight = 10;
    const subCategoryHeaderHeight = 8;
    const categoryBottomMargin = 10;
    const subCategoryVerticalGutter = 5;

    const itemMap = new Map(allItems.map(i => [i.id, i]));
    const categoryMap = new Map(allCategories.map(c => [c.id, c]));

    const calculateItemHeight = (itemText: string): number => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(itemText, columnWidth - checkboxSize - itemGutter);
        return (lines.length * itemLineHeight) + 2;
    };
    
    const drawItem = (itemText: string, x: number, currentY: number, isChecked: boolean = false) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(itemText, columnWidth - checkboxSize - itemGutter);
        
        const checkboxY = currentY - (checkboxSize / 2) - 1;
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.4);
        doc.rect(x, checkboxY, checkboxSize, checkboxSize);

        if (isChecked) {
            doc.setDrawColor(textColor);
            doc.setLineWidth(0.4);
            doc.line(x + 1, checkboxY + 1.5, x + 1.5, checkboxY + 2.5);
            doc.line(x + 1.5, checkboxY + 2.5, x + checkboxSize - 0.5, checkboxY + 0.5);
        }

        doc.setTextColor(textColor);
        doc.text(lines, x + checkboxSize + itemGutter, currentY);
    };

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
    
    const catalogRootCatIds = new Set<string>();
    Object.keys(catalog.itemIds).forEach(catId => {
        let currentCat = categoryMap.get(catId);
        while (currentCat && currentCat.parentId) {
            currentCat = categoryMap.get(currentCat.parentId);
        }
        if (currentCat) {
            catalogRootCatIds.add(currentCat.id);
        }
    });

    const allRootCatsInCatalog = Array.from(catalogRootCatIds)
        .map(id => categoryMap.get(id))
        .filter((c): c is AppCategory => !!c);

    const regularRootCats = allRootCatsInCatalog
        .filter(c => !c.isStandardAccompaniment && template.rules[c.id])
        .sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));

    const accompanimentRootCats = allRootCatsInCatalog
        .filter(c => c.isStandardAccompaniment)
        .sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));

    const renderCategoryGroup = (rootCat: AppCategory, isAccompaniment: boolean) => {
        const maxItems = template.rules[rootCat.id];
        const descendantCatIds = getDescendantCats(rootCat.id);
        const itemsInRule = Object.entries(catalog.itemIds)
            .filter(([catId, _]) => descendantCatIds.includes(catId))
            .flatMap(([_, itemIds]) => itemIds)
            .map(id => itemMap.get(id))
            .filter((i): i is Item => !!i);
            
        if (itemsInRule.length === 0) return;

        const itemsBySubCatId: { [id: string]: Item[] } = {};
        itemsInRule.forEach(item => {
            if (!itemsBySubCatId[item.categoryId]) itemsBySubCatId[item.categoryId] = [];
            itemsBySubCatId[item.categoryId].push(item);
        });

        const parentItems = itemsBySubCatId[rootCat.id] 
            ? itemsBySubCatId[rootCat.id].sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)) 
            : [];
        
        const subCategoryGroups = Object.keys(itemsBySubCatId)
            .filter(catId => catId !== rootCat.id)
            .map(catId => ({ category: categoryMap.get(catId)!, items: itemsBySubCatId[catId].sort((a, b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name))}))
            .filter(group => group.category)
            .sort((a, b) => (a.category.displayRank ?? Infinity) - (b.category.displayRank ?? Infinity) || a.category.name.localeCompare(b.category.name));
        
        const headerHeight = categoryHeaderBaseHeight;

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
        const subHeaderText = isAccompaniment ? '(Included by default)' : (maxItems ? `(Select up to ${maxItems})` : '');
        if (subHeaderText) {
            doc.text(subHeaderText, margin + titleWidth + 3, y, { baseline: 'bottom' });
        }

        doc.setDrawColor(accentColor);
        doc.setLineWidth(0.3);
        doc.line(margin, y + 2, pageW - margin, y + 2);
        y += categoryHeaderBaseHeight;

        let yLeft = y, yRight = y;

        const drawItems = (items: Item[]) => {
            items.forEach(item => {
                const itemHeight = calculateItemHeight(item.name);
                if (Math.min(yLeft, yRight) + itemHeight > pageH - margin) {
                    doc.addPage();
                    y = initialYSubsequentPage;
                    yLeft = y;
                    yRight = y;
                }
                if (yLeft <= yRight) {
                    drawItem(item.name, margin, yLeft, isAccompaniment);
                    yLeft += itemHeight;
                } else {
                    drawItem(item.name, margin + columnWidth + columnGap, yRight, isAccompaniment);
                    yRight += itemHeight;
                }
            });
        };

        drawItems(parentItems);
        
        subCategoryGroups.forEach((group, index) => {
            y = Math.max(yLeft, yRight);
            if (index > 0 || parentItems.length > 0) y += subCategoryVerticalGutter;
            
            if (y + subCategoryHeaderHeight > pageH - margin) {
                doc.addPage();
                y = initialYSubsequentPage;
            }
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(textColor);
            doc.text(group.category.name, margin, y);
            y += subCategoryHeaderHeight;
            yLeft = y; yRight = y;
            
            drawItems(group.items);
        });

        y = Math.max(yLeft, yRight) + categoryBottomMargin;
    };

    y = initialYFirstPage;

    if (template.muttonRules && template.muttonRules > 0) {
        const message = `Please Note: A maximum of ${template.muttonRules} mutton item(s) can be selected across the entire menu.`;
        const splitMessage = doc.splitTextToSize(message, contentWidth - 4);
        const boxHeight = (splitMessage.length * itemLineHeight) + 8;
        
        if (y + boxHeight > pageH - margin) {
            doc.addPage();
            y = initialYSubsequentPage;
        }
        
        doc.setFillColor('#fffde7');
        doc.setDrawColor(primaryColor);
        doc.setLineWidth(0.2);
        doc.rect(margin, y, contentWidth, boxHeight, 'FD');
        
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(textColor);
        doc.text(splitMessage, margin + 2, y + 5);
        y += boxHeight + categoryBottomMargin;
    }
    
    regularRootCats.forEach(cat => renderCategoryGroup(cat, false));
    accompanimentRootCats.forEach(cat => renderCategoryGroup(cat, true));

    const instructionsHeaderHeight = 10;
    const instructionsLineHeight = 7;
    const instructionsLines = 5;
    const spaceNeededForInstructions = instructionsHeaderHeight + (instructionsLines * instructionsLineHeight);

    if (y + spaceNeededForInstructions > pageH - margin) {
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
    y += instructionsHeaderHeight;

    doc.setDrawColor(lightTextColor);
    doc.setLineWidth(0.2);
    for (let i = 0; i < instructionsLines; i++) {
        const lineY = y + (i * instructionsLineHeight);
        if (lineY > pageH - (margin + 5)) break;
        doc.line(margin, lineY, pageW - margin, lineY);
    }
    y += (instructionsLines * instructionsLineHeight);

    // Final check to prevent adding a blank page if content perfectly fits
    if (y > pageH - margin && doc.internal.pages.length > 1) {
        const lastPageNumber = doc.internal.pages.length;
        // A simple heuristic: if the page has very few operations, it's likely blank.
        // A more robust check might be needed if this isn't sufficient.
        const pageContent = (doc as any).getPageContent(lastPageNumber);
        if (pageContent.length < 5) {
             doc.deletePage(lastPageNumber);
        }
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
    const subTitle = getEventDisplayName(event, client.name);

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
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPageShell(doc, "Kitchen Production Plan", i, totalPages, { isFirstPage: i === 1, showLogo: true, subTitle });
    }

    doc.save(`Kitchen_Plan_${client.name}_${event.eventType}.pdf`);
};

export const exportLiveCountersToPdf = (
  liveCounters: LiveCounter[],
  liveCounterItems: LiveCounterItem[]
) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageW - margin * 2;
        const initialYFirstPage = 45;
        const initialYSubsequentPage = 25;
        let y = initialYFirstPage;

        const liveCounterItemMap = new Map<string, LiveCounterItem[]>();
        liveCounterItems.forEach(item => {
            if (!liveCounterItemMap.has(item.liveCounterId)) {
                liveCounterItemMap.set(item.liveCounterId, []);
            }
            liveCounterItemMap.get(item.liveCounterId)!.push(item);
        });

        const sortedCounters = liveCounters.slice().sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));

        const nameLineHeight = 5;
        const descLineHeight = 4;
        const headerHeight = 10;
        const sectionBottomMargin = 12;
        const itemBottomMargin = 4;

        const calculateItemHeight = (item: LiveCounterItem): number => {
            let height = 0;
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            const nameLines = doc.splitTextToSize(`• ${item.name}`, contentWidth);
            height += nameLines.length * nameLineHeight;

            if (item.description) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(9);
                const descLines = doc.splitTextToSize(item.description, contentWidth - 10);
                height += (descLines.length * descLineHeight) + 1;
            }
            return height + itemBottomMargin;
        };

        const drawItem = (item: LiveCounterItem, currentY: number): number => {
            let newY = currentY;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(textColor);
            const nameLines = doc.splitTextToSize(item.name, contentWidth - 5);
            doc.text('•', margin, newY);
            doc.text(nameLines, margin + 5, newY);
            newY += nameLines.length * nameLineHeight;

            if (item.description) {
                newY += 1;
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(9);
                doc.setTextColor(lightTextColor);
                const descLines = doc.splitTextToSize(item.description, contentWidth - 10);
                doc.text(descLines, margin + 10, newY);
                newY += descLines.length * descLineHeight;
            }
            
            return newY + itemBottomMargin;
        };
        
        const addPage = () => {
             doc.addPage();
             y = initialYSubsequentPage;
        };

        for (const counter of sortedCounters) {
            const items = (liveCounterItemMap.get(counter.id) || []).sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name));
            if (items.length === 0) continue;

            const itemsHeight = items.reduce((sum, item) => sum + calculateItemHeight(item), 0);
            const counterSectionHeight = headerHeight + (counter.description ? 5 : 0) + itemsHeight;

            if (y + counterSectionHeight > pageH - margin) {
                addPage();
            }
            
            // Draw Counter Header
            doc.setFont('times', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(accentColor); // Changed to accent color
            doc.text(counter.name, margin, y);
            y += 6;
            
            if (counter.description) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(9);
                doc.setTextColor(lightTextColor);
                const descLines = doc.splitTextToSize(counter.description, contentWidth);
                doc.text(descLines, margin, y);
                y += (descLines.length * 4) + 2;
            }
            
            y += 2; // Space before line
            doc.setDrawColor(primaryColor);
            doc.setLineWidth(0.2);
            doc.line(margin, y, margin + contentWidth, y);
            y += 4; // Space after line

            // Draw Items
            for (const item of items) {
                const itemHeight = calculateItemHeight(item);
                if (y + itemHeight > pageH - margin) {
                    addPage();
                }
                y = drawItem(item, y);
            }
            
            y += sectionBottomMargin;
        }

        const totalPages = doc.internal.pages.length;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            addPageShell(doc, 'Live Counter Options', i, totalPages, { 
                isFirstPage: i === 1, 
                showLogo: true, 
                showClientFields: true, 
                subTitle: 'Freshly Prepared For Your Guests'
            });
        }

        doc.save(`Live_Counter_Options.pdf`);

    } catch (error) {
        console.error("Failed to generate Live Counters PDF:", error);
        alert("Sorry, there was an error generating the PDF.");
    }
};

export const exportOrderToPdf = (order: Order, restaurants: RestaurantSetting[], allRecipes: Recipe[], allRawMaterials: RawMaterial[], allPlatters: Platter[]) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const subTitle = `Order for ${formatYYYYMMDD(order.date)} - ${order.session}`;
        const startY = 35;

        // --- DATA PREP ---
        const recipeMap = new Map(allRecipes.map(r => [r.id, r]));
        const rawMaterialMap = new Map(allRawMaterials.map(rm => [rm.id, rm]));
        const platterMap = new Map(allPlatters.map(p => [p.id, p]));
        
        const allLocations = [
            ...restaurants.map(r => ({ id: r.id, name: r.name })),
            ...(order.adHocLocations || [])
        ];

        const convertQuantityToYieldUnit = (recipe: Recipe, quantity: number, fromUnit: string): number => {
            const fromUnitClean = fromUnit.toLowerCase();
            const yieldUnitClean = recipe.yieldUnit.toLowerCase();
            if (fromUnitClean === yieldUnitClean) return quantity;
            
            const conversion = (recipe.conversions || []).find(c => c.unit.toLowerCase() === fromUnitClean);
            if (conversion && conversion.factor > 0) return quantity * conversion.factor;

            if ((yieldUnitClean === 'kg' && fromUnitClean === 'litres') || (yieldUnitClean === 'litres' && fromUnitClean === 'kg')) return quantity;

            console.warn(`No conversion found for recipe ${recipe.name} from ${fromUnit} to ${recipe.yieldUnit}.`);
            return 0;
        };

        // --- CALCULATION LOGIC ---
        const recipeProductionTotals = new Map<string, number>(); // recipeId -> total quantity in yield unit

        // From direct recipes
        for (const recipeId in (order.recipeRequirements || {})) {
            const recipe = recipeMap.get(recipeId);
            if (!recipe) continue;
            const totalOrdered = Object.values(order.recipeRequirements![recipeId]).reduce((s, q) => s + q, 0);
            const productionQty = convertQuantityToYieldUnit(recipe, totalOrdered, recipe.defaultOrderingUnit || recipe.yieldUnit);
            recipeProductionTotals.set(recipeId, (recipeProductionTotals.get(recipeId) || 0) + productionQty);
        }

        // From platters
        for (const platterId in (order.platterRequirements || {})) {
            const platter = platterMap.get(platterId);
            if (!platter) continue;
            const totalPlattersOrdered = Object.values(order.platterRequirements![platterId]).reduce((s, q) => s + q, 0);
            
            for (const pRecipe of platter.recipes) {
                const recipe = recipeMap.get(pRecipe.recipeId);
                if (!recipe) continue;
                const totalComponentOrdered = totalPlattersOrdered * pRecipe.quantity;
                const productionQty = convertQuantityToYieldUnit(recipe, totalComponentOrdered, pRecipe.unit);
                recipeProductionTotals.set(pRecipe.recipeId, (recipeProductionTotals.get(pRecipe.recipeId) || 0) + productionQty);
            }
        }
        
        const aggregatedRawMaterials = new Map<string, { total: number, unit: string, name: string }>();
        for (const [recipeId, totalProduction] of recipeProductionTotals.entries()) {
            const recipe = recipeMap.get(recipeId);
            if (!recipe || !recipe.yieldQuantity || recipe.yieldQuantity <= 0) continue;
            const multiplier = totalProduction / recipe.yieldQuantity;
            for (const rm of recipe.rawMaterials) {
                const rmDetails = rawMaterialMap.get(rm.rawMaterialId);
                if (!rmDetails) continue;
                const requiredQty = rm.quantity * multiplier;
                const existing = aggregatedRawMaterials.get(rm.rawMaterialId);
                if (existing) existing.total += requiredQty;
                else aggregatedRawMaterials.set(rm.rawMaterialId, { total: requiredQty, unit: rmDetails.unit, name: rmDetails.name });
            }
        }

        const pageRanges = {
            summary: { start: 0, end: 0, title: "Kitchen Order Summary" },
            production: { start: 0, end: 0, title: "Recipe Production Summary" },
            packingPlan: { start: 0, end: 0, title: "Finished Recipe Packing Plan" },
            materialsPerRecipe: { start: 0, end: 0, title: "Raw Materials per Recipe" },
            aggregatedMaterials: { start: 0, end: 0, title: "Aggregated Raw Materials" },
        };

        // --- SECTION 1: Order Summary ---
        pageRanges.summary.start = (doc as any).internal.getNumberOfPages();
        const sortedLocations = allLocations.sort((a,b) => a.name.localeCompare(b.name));
        const summaryHead = [['Item', ...sortedLocations.map(r => r.name), 'Total']];
        const summaryBody: any[] = [];
        const sortedOrderItems = [
            ...Object.keys(order.recipeRequirements || {}).map(id => ({ type: 'recipe' as const, id, name: recipeMap.get(id)?.name || '' })),
            ...Object.keys(order.platterRequirements || {}).map(id => ({ type: 'platter' as const, id, name: platterMap.get(id)?.name || '' }))
        ].sort((a, b) => a.name.localeCompare(b.name));
        for (const item of sortedOrderItems) {
            if (item.type === 'recipe') {
                const recipe = recipeMap.get(item.id)!;
                const totalOrdered = Object.values(order.recipeRequirements?.[item.id] || {}).reduce((s, q) => s + q, 0);
                const unit = recipe.defaultOrderingUnit || recipe.yieldUnit;
                summaryBody.push([
                    { content: recipe.name, styles: { fontStyle: 'bold' } },
                    ...sortedLocations.map(r => {
                        const qty = order.recipeRequirements?.[item.id]?.[r.id];
                        return qty && qty > 0 ? `${qty} ${unit}` : '-';
                    }),
                    { content: totalOrdered > 0 ? `${totalOrdered} ${unit}` : '-', styles: { fontStyle: 'bold' } }
                ]);
            } else { // platter
                const platter = platterMap.get(item.id)!;
                const totalPlattersOrdered = Object.values(order.platterRequirements?.[item.id] || {}).reduce((s, q) => s + q, 0);
                summaryBody.push([
                    { content: platter.name, styles: { fontStyle: 'bold', fillColor: '#f0f0f0' } },
                    ...sortedLocations.map(r => {
                        const qty = order.platterRequirements?.[item.id]?.[r.id];
                        return qty && qty > 0 ? `${qty} portions` : '-';
                    }),
                    { content: totalPlattersOrdered > 0 ? `${totalPlattersOrdered} portions` : '-', styles: { fontStyle: 'bold' } }
                ]);
                for (const pRecipe of platter.recipes) {
                    const recipe = recipeMap.get(pRecipe.recipeId)!;
                    const totalComponentOrdered = totalPlattersOrdered * pRecipe.quantity;
                    summaryBody.push([
                        { content: `  - ${recipe.name}`, styles: { cellPadding: { left: 8 } } },
                         ...sortedLocations.map(r => {
                            const platterQty = order.platterRequirements?.[item.id]?.[r.id] || 0;
                            const recipeQty = platterQty * pRecipe.quantity;
                            return recipeQty > 0 ? `${recipeQty} ${pRecipe.unit}` : '-';
                        }),
                        { content: totalComponentOrdered > 0 ? `${totalComponentOrdered} ${pRecipe.unit}` : '-', styles: { fontStyle: 'bold' } }
                    ]);
                }
            }
        }
        autoTable(doc, { head: summaryHead, body: summaryBody, startY, theme: 'grid', headStyles: { fillColor: primaryColor } });
        pageRanges.summary.end = (doc as any).internal.getNumberOfPages();

        // --- SECTION 2: Recipe Production Totals ---
        doc.addPage();
        pageRanges.production.start = (doc as any).internal.getNumberOfPages();
        const productionBody = Array.from(recipeProductionTotals.entries()).map(([recipeId, total]) => {
            const recipe = recipeMap.get(recipeId);
            return { name: recipe?.name || 'Unknown', total, unit: recipe?.yieldUnit || 'N/A' };
        }).sort((a, b) => a.name.localeCompare(b.name)).map(r => [r.name, r.total.toFixed(2), r.unit]);
        autoTable(doc, { head: [['Recipe', 'Total Production', 'Unit']], body: productionBody, startY, theme: 'grid', headStyles: { fillColor: primaryColor } });
        pageRanges.production.end = (doc as any).internal.getNumberOfPages();

        // --- SECTION 3: Finished Recipe Packing Plan (Grid) ---
        doc.addPage();
        pageRanges.packingPlan.start = (doc as any).internal.getNumberOfPages();

        const packingPlanData = new Map<string, Map<string, { quantity: number; unit: string }>>(); // recipeId -> locationId -> { quantity, unit }
        const locationIdsInOrder = new Set<string>();

        const addToPackingPlan = (recipeId: string, locationId: string, qtyInYieldUnit: number) => {
            const recipe = recipeMap.get(recipeId);
            if (!recipe || qtyInYieldUnit <= 0) return;

            locationIdsInOrder.add(locationId);

            const { quantity: packingQty, unit: packingUnit } = getPackingQuantity(recipe, qtyInYieldUnit);

            if (!packingPlanData.has(recipeId)) {
                packingPlanData.set(recipeId, new Map());
            }
            const locationMap = packingPlanData.get(recipeId)!;

            const existing = locationMap.get(locationId);
            if (existing) {
                existing.quantity += packingQty;
            } else {
                locationMap.set(locationId, { quantity: packingQty, unit: packingUnit });
            }
        };

        // Process direct recipes
        for (const recipeId in (order.recipeRequirements || {})) {
            const recipe = recipeMap.get(recipeId);
            if (!recipe) continue;
            for (const locationId in order.recipeRequirements![recipeId]) {
                const orderedQty = order.recipeRequirements![recipeId][locationId];
                const qtyInYieldUnit = convertQuantityToYieldUnit(recipe, orderedQty, recipe.defaultOrderingUnit || recipe.yieldUnit);
                addToPackingPlan(recipeId, locationId, qtyInYieldUnit);
            }
        }

        // Process platters
        for (const platterId in (order.platterRequirements || {})) {
            const platter = platterMap.get(platterId);
            if (!platter) continue;
            for (const locationId in order.platterRequirements![platterId]) {
                const platterQty = order.platterRequirements![platterId][locationId];
                for (const pRecipe of platter.recipes) {
                    const recipe = recipeMap.get(pRecipe.recipeId);
                    if (!recipe) continue;
                    const totalComponentOrdered = platterQty * pRecipe.quantity;
                    const qtyInYieldUnit = convertQuantityToYieldUnit(recipe, totalComponentOrdered, pRecipe.unit);
                    addToPackingPlan(pRecipe.recipeId, locationId, qtyInYieldUnit);
                }
            }
        }
        
        const sortedLocationsInOrder = allLocations
            .filter(loc => locationIdsInOrder.has(loc.id))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        const packingPlanHead = [['Recipe', ...sortedLocationsInOrder.map(r => r.name), 'Total']];
        
        const packingPlanBody = Array.from(packingPlanData.keys())
            .map(recipeId => recipeMap.get(recipeId))
            .filter((r): r is Recipe => !!r)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(recipe => {
                const rowData = [recipe.name];
                const locationData = packingPlanData.get(recipe.id)!;
                
                let totalQuantity = 0;
                let totalUnit = '';

                sortedLocationsInOrder.forEach(location => {
                    const data = locationData.get(location.id);
                    if (data && data.quantity > 0) {
                        rowData.push(`${data.quantity.toFixed(2)} ${data.unit}`);
                        totalQuantity += data.quantity;
                        if (!totalUnit) totalUnit = data.unit; // Assume unit is consistent
                    } else {
                        rowData.push('-');
                    }
                });

                rowData.push(totalQuantity > 0 ? `${totalQuantity.toFixed(2)} ${totalUnit}` : '-');
                return rowData;
            });
        
        autoTable(doc, {
            head: packingPlanHead,
            body: packingPlanBody,
            startY,
            theme: 'grid',
            headStyles: { fillColor: primaryColor }
        });
        
        pageRanges.packingPlan.end = (doc as any).internal.getNumberOfPages();
        
        // --- SECTION 4: Raw Materials per Recipe ---
        doc.addPage();
        pageRanges.materialsPerRecipe.start = (doc as any).internal.getNumberOfPages();
        const section4Body: any[] = [];
        const sortedRecipeTotals = Array.from(recipeProductionTotals.entries()).map(([recipeId, total]) => ({ recipe: recipeMap.get(recipeId), total })).filter(item => !!item.recipe).sort((a, b) => a.recipe!.name.localeCompare(b.recipe!.name));
        for (const { recipe, total } of sortedRecipeTotals) {
            if (!recipe || !recipe.yieldQuantity || recipe.yieldQuantity <= 0) continue;
            section4Body.push([{ content: `${recipe.name} (Total: ${total.toFixed(2)} ${recipe.yieldUnit})`, colSpan: 3, styles: { fillColor: '#e0e0e0', textColor: '#000', fontStyle: 'bold' } }]);
            const multiplier = total / recipe.yieldQuantity;
            const recipeRmBody = recipe.rawMaterials.map(rm => {
                const rmDetails = rawMaterialMap.get(rm.rawMaterialId);
                return [rmDetails?.name || 'Unknown', (rm.quantity * multiplier).toFixed(2), rmDetails?.unit || ''];
            });
            if (recipeRmBody.length > 0) {
                section4Body.push(...recipeRmBody);
            } else {
                section4Body.push([{ content: 'No raw materials listed.', colSpan: 3, styles: { fontStyle: 'italic', textColor: '#777' } }]);
            }
        }
        autoTable(doc, { head: [['Raw Material', 'Quantity', 'Unit']], body: section4Body, startY, theme: 'grid', headStyles: { fillColor: primaryColor } });
        pageRanges.materialsPerRecipe.end = (doc as any).internal.getNumberOfPages();

        // --- SECTION 5: Aggregated Raw Materials ---
        doc.addPage();
        pageRanges.aggregatedMaterials.start = (doc as any).internal.getNumberOfPages();
        const aggregatedBody = Array.from(aggregatedRawMaterials.values()).sort((a, b) => a.name.localeCompare(b.name)).map(rm => [rm.name, rm.total.toFixed(2), rm.unit]);
        autoTable(doc, { head: [['Raw Material', 'Total Quantity', 'Unit']], body: aggregatedBody, startY, theme: 'grid', headStyles: { fillColor: primaryColor } });
        pageRanges.aggregatedMaterials.end = (doc as any).internal.getNumberOfPages();
        
        // --- FINAL STEP: Add headers and footers to all pages ---
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            let title = "Kitchen Order";
            if (i >= pageRanges.summary.start && i <= pageRanges.summary.end) title = pageRanges.summary.title;
            else if (i >= pageRanges.production.start && i <= pageRanges.production.end) title = pageRanges.production.title;
            else if (i >= pageRanges.packingPlan.start && i <= pageRanges.packingPlan.end) title = pageRanges.packingPlan.title;
            else if (i >= pageRanges.materialsPerRecipe.start && i <= pageRanges.materialsPerRecipe.end) title = pageRanges.materialsPerRecipe.title;
            else if (i >= pageRanges.aggregatedMaterials.start && i <= pageRanges.aggregatedMaterials.end) title = pageRanges.aggregatedMaterials.title;
            
            addPageShell(doc, title, i, totalPages, { isFirstPage: i === 1, showLogo: true, subTitle });
        }

        doc.save(`Kitchen_Order_${order.date}.pdf`);
    } catch (error) {
        console.error("Failed to generate PDF:", error);
        alert("Sorry, there was an error generating the PDF.");
    }
};

export const exportOrderTemplateToPdf = (template: OrderTemplate, allRecipes: Recipe[], allPlatters: Platter[]) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    
    const recipeMap = new Map(allRecipes.map(r => [r.id, r]));
    const platterMap = new Map(allPlatters.map(p => [p.id, p]));

    const itemsForTable: { name: string; unit: string; }[] = [];
    (template.recipeIds || []).forEach(id => { const recipe = recipeMap.get(id); if (recipe) itemsForTable.push({ name: recipe.name, unit: recipe.defaultOrderingUnit || recipe.yieldUnit || 'N/A' }); });
    (template.platterIds || []).forEach(id => { const platter = platterMap.get(id); if (platter) itemsForTable.push({ name: `${platter.name} (Platter)`, unit: 'portions' }); });
    itemsForTable.sort((a, b) => a.name.localeCompare(b.name));

    const midpoint = Math.ceil(itemsForTable.length / 2);
    const leftColumnBody = itemsForTable.slice(0, midpoint).map(item => [item.name, item.unit, '']);
    const rightColumnBody = itemsForTable.slice(midpoint).map(item => [item.name, item.unit, '']);

    if (leftColumnBody.length > 0) {
        autoTable(doc, {
            head: [['Item Name', 'Unit', 'Qty']],
            body: leftColumnBody,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: primaryColor },
            tableWidth: (pageW / 2) - margin - 2,
            margin: { left: margin },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: { 2: { cellWidth: 20 } }
        });
    }

    if (rightColumnBody.length > 0) {
        autoTable(doc, {
            head: [['Item Name', 'Unit', 'Qty']],
            body: rightColumnBody,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: primaryColor },
            tableWidth: (pageW / 2) - margin - 2,
            margin: { left: (pageW / 2) + 2 },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: { 2: { cellWidth: 20 } }
        });
    }
    
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPageShell(doc, template.name, i, totalPages, { 
            isFirstPage: i === 1, 
            showLogo: true, 
            showClientFields: i === 1, 
            subTitle: 'Ordering Form',
            clientFieldLabel: 'Restaurant Location' 
        });
    }
    
    doc.save(`Ordering_Template_${template.name}.pdf`);
};

export const exportFinanceToPdf = (
    event: Event, 
    clientName: string,
    liveCounters: LiveCounter[],
    templates: MenuTemplate[]
) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const subTitle = getEventDisplayName(event, clientName);
        let startY = 30;
        
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageW - margin * 2;
        
        const liveCounterMap = new Map(liveCounters.map(lc => [lc.id, lc]));
        const templateMap = new Map(templates.map(t => [t.id, t]));

        // --- Financial Calculations ---
        const model = event.pricingModel || 'variable';
        const pax = event.pax || 0;
        const perPax = event.perPaxPrice || 0;
        const rent = event.rent || 0;
        
        let baseCost = 0;
        if (model === 'variable') baseCost = pax * perPax;
        else if (model === 'flat') baseCost = rent;
        else if (model === 'mix') baseCost = rent + (pax * perPax);

        const charges = (event.charges || []).filter(c => !c.isDeleted);
        const payments = (event.transactions || []).filter(t => t.type === 'income' && !t.isDeleted);
        const expenses = (event.transactions || []).filter(t => t.type === 'expense' && !t.isDeleted);

        const totalCharges = charges.reduce((sum, charge) => sum + charge.amount, 0);
        const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

        const totalBill = baseCost + totalCharges;
        const balanceDue = totalBill - totalPayments;
        const profit = totalBill - totalExpenses;
        
        const summaryTableWidth = (contentWidth - 10) / 2; // Subtract gap and divide by 2
        
        // --- Pricing Summary ---
        autoTable(doc, {
            body: [
                [{ content: 'Pricing Summary', colSpan: 2, styles: { fontStyle: 'bold', fillColor: '#f5f5f5' } }],
                ['Model', model.charAt(0).toUpperCase() + model.slice(1)],
                ['PAX', pax.toString()],
                ...((model === 'variable' || model === 'mix') ? [['Per PAX Rate', `₹${perPax.toLocaleString('en-IN')}`]] : []),
                ...((model === 'flat' || model === 'mix') ? [['Base Rent', `₹${rent.toLocaleString('en-IN')}`]] : []),
                [{ content: 'Base Cost', styles: { fontStyle: 'bold' } }, { content: `₹${baseCost.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold' } }],
            ],
            startY,
            theme: 'grid',
            tableWidth: summaryTableWidth,
            styles: { fontSize: 9 },
            headStyles: {halign: 'center'},
            columnStyles: { 0: { fontStyle: 'bold' } },
        });

        // --- Financial Overview (on the right side) ---
        autoTable(doc, {
            body: [
                [{ content: 'Financial Overview', colSpan: 2, styles: { fontStyle: 'bold', fillColor: '#f5f5f5' } }],
                ['Total Bill', `₹${totalBill.toLocaleString('en-IN')}`],
                ['Payments Received', `₹${totalPayments.toLocaleString('en-IN')}`],
                [{ content: 'Balance Due', styles: { fontStyle: 'bold' } }, { content: `₹${balanceDue.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold' } }],
                ['Total Expenses', `- ₹${totalExpenses.toLocaleString('en-IN')}`],
                [{ content: 'Estimated Profit', styles: { fontStyle: 'bold' } }, { content: `₹${profit.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold' } }],
            ],
            startY,
            theme: 'grid',
            tableWidth: summaryTableWidth,
            margin: { left: margin + summaryTableWidth + 10 },
            styles: { fontSize: 9 },
            headStyles: {halign: 'center'},
            columnStyles: { 1: { halign: 'right' } },
        });
        
        startY = (doc as any).lastAutoTable.finalY + 10;

        // --- Additional Charges Table ---
        if (charges.length > 0) {
            autoTable(doc, {
                head: [['Description', 'Details', 'Amount']],
                body: charges.map(c => {
                    let description: any = { content: c.type, styles: { fontStyle: 'bold' } };
                    let details = '';
                    
                    if (c.type === 'Live Counter' && c.liveCounterId) {
                        const counter = liveCounterMap.get(c.liveCounterId);
                        description.content += `\n${counter?.name || 'Unknown Counter'}`;
                        details = `₹${c.price?.toLocaleString('en-IN') || 0} / PAX`;
                        if (c.discountAmount && c.discountAmount > 0) {
                            details += `\n(-₹${c.discountAmount.toLocaleString('en-IN')} discount)`;
                        }
                    } else if ((c.type === 'Cocktail Menu' || c.type === 'Hi-Tea Menu') && c.menuTemplateId) {
                        const template = templateMap.get(c.menuTemplateId);
                        description.content += `\n${template?.name || 'Unknown Menu'}`;
                         if (c.type === 'Cocktail Menu') {
                            details = `₹${c.price?.toLocaleString('en-IN') || 0} x ${c.cocktailPax || 0} PAX`;
                            if (c.corkageCharges && c.corkageCharges > 0) details += `\n(+₹${c.corkageCharges.toLocaleString('en-IN')} corkage)`;
                            if (c.discountAmount && c.discountAmount > 0) details += `\n(-₹${c.discountAmount.toLocaleString('en-IN')} discount)`;
                        } else { // Hi-Tea
                            details = `₹${c.price?.toLocaleString('en-IN') || 0} Base Price`;
                            if (c.discountAmount && c.discountAmount > 0) details += `\n(-₹${c.discountAmount.toLocaleString('en-IN')} discount)`;
                        }
                    } else if (c.type === 'Additional PAX') {
                        description.content += `\n(${c.additionalPaxCount || 0} extra guests)`;
                        details = `@ ₹${event.perPaxPrice?.toLocaleString('en-IN') || 0} / PAX`;
                        if (c.discountAmount && c.discountAmount > 0) {
                            details += `\n(-₹${c.discountAmount.toLocaleString('en-IN')} discount)`;
                        }
                    }
                    
                    if(c.notes) {
                        details += (details ? '\n' : '') + c.notes;
                    }

                    return [
                        description,
                        { content: details, styles: { cellWidth: 'auto' } },
                        { content: `₹${c.amount.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold' } }
                    ];
                }),
                startY,
                theme: 'striped',
                headStyles: { fillColor: primaryColor, textColor: whiteColor },
                columnStyles: { 0: { cellWidth: 50 }, 2: { halign: 'right' } },
                didParseCell: function (data) {
                    // Check if the processed text for the cell has more than one line.
                    // This is the recommended way to check for multiline content for styling.
                    if (data.cell.text && data.cell.text.length > 1) {
                        data.cell.styles.valign = 'middle';
                    }
                }
            });
            startY = (doc as any).lastAutoTable.finalY + 10;
        }

        // --- Payments Table ---
        if (payments.length > 0) {
            autoTable(doc, {
                head: [['Date', 'Mode', 'Notes', 'Amount']],
                body: payments.map(p => [
                        formatYYYYMMDD(p.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), 
                        p.paymentMode || '', 
                        p.notes || '', 
                        `₹${p.amount.toLocaleString('en-IN')}`
                    ]),
                startY,
                theme: 'striped',
                headStyles: { fillColor: primaryColor, textColor: whiteColor },
                columnStyles: { 3: { halign: 'right' } },
            });
            startY = (doc as any).lastAutoTable.finalY + 10;
        }

        // --- Expenses Table ---
        if (expenses.length > 0) {
            autoTable(doc, {
                head: [['Date', 'Category', 'Notes', 'Amount']],
                body: expenses.map(e => [
                        formatYYYYMMDD(e.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), 
                        e.category || '', 
                        e.notes || '', 
                        `₹${e.amount.toLocaleString('en-IN')}`
                    ]),
                startY,
                theme: 'striped',
                headStyles: { fillColor: primaryColor, textColor: whiteColor },
                columnStyles: { 3: { halign: 'right' } },
            });
        }
        
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            addPageShell(doc, 'Financial Report', i, totalPages, { isFirstPage: i === 1, showLogo: false, subTitle });
        }
        
        doc.save(`Financial_Report_${clientName}_${event.eventType}.pdf`);

    } catch (error) {
        console.error("Failed to generate finance PDF:", error);
        alert("Sorry, there was an error generating the finance PDF.");
    }
};
export const exportFinanceSectionToPdf = (sectionTitle: string, headers: string[], data: any[][], event: Event, clientName: string) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const subTitle = getEventDisplayName(event, clientName);
    
    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 30,
        headStyles: { fillColor: primaryColor }
    });
    
    const totalPages = (doc as any).internal.getNumberOfPages();
     for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPageShell(doc, sectionTitle, i, totalPages, { isFirstPage: i === 1, showLogo: false, subTitle });
    }
    
    doc.save(`Finance_${sectionTitle.replace(/ /g, '_')}_${clientName}.pdf`);
};
export const exportReportToPdf = (reportName: string, headers: string[], data: any[][], filters: Record<string, string>, fileName: string) => {
    try {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
        const subTitle = Object.entries(filters)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' | ');

        autoTable(doc, {
            head: [headers],
            body: data,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: primaryColor },
        });

        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            addPageShell(doc, reportName, i, totalPages, { isFirstPage: i === 1, showLogo: false, subTitle });
        }
        
        doc.save(`${fileName}`);
    } catch (error) {
        console.error("Failed to generate report PDF:", error);
        alert("Sorry, there was an error generating the report PDF.");
    }
};

// --- EXCEL EXPORT LOGIC ---

export const exportToExcel = (event: Event, client: Client, allItems: Item[], allCategories: AppCategory[], liveCounters: LiveCounter[], liveCounterItems: LiveCounterItem[]) => {
    try {
        const wb = XLSX.utils.book_new();

        const eventDetails = [
            ["Client", client.name],
            ["Event Type", event.eventType],
            ["Date", formatDateRange(event.startDate, event.endDate)],
            ["Session", event.session],
            ["Location", event.location],
            ["PAX", event.pax],
        ];
        const wsDetails = XLSX.utils.aoa_to_sheet(eventDetails);
        XLSX.utils.book_append_sheet(wb, wsDetails, 'Event Details');

        const itemMap = new Map(allItems.map(i => [i.id, i]));
        const categoryMap = new Map(allCategories.map(c => [c.id, c.name]));
        
        const menuData = Object.entries(event.itemIds || {})
            .flatMap(([catId, itemIds]) => 
                itemIds.map(itemId => ({
                    Category: categoryMap.get(catId) || 'Unknown',
                    Item: itemMap.get(itemId)?.name || 'Unknown',
                }))
            );
        const wsMenu = XLSX.utils.json_to_sheet(menuData);
        XLSX.utils.book_append_sheet(wb, wsMenu, 'Menu');

        if (event.liveCounters && Object.keys(event.liveCounters).length > 0) {
            const liveCounterMap = new Map(liveCounters.map(lc => [lc.id, lc.name]));
            const liveCounterItemMap = new Map(liveCounterItems.map(lci => [lci.id, lci.name]));
            const lcData = Object.entries(event.liveCounters).flatMap(([counterId, itemIds]) =>
                itemIds.map(itemId => ({
                    'Live Counter': liveCounterMap.get(counterId) || 'Unknown',
                    'Item': liveCounterItemMap.get(itemId) || 'Unknown',
                }))
            );
            const wsLc = XLSX.utils.json_to_sheet(lcData);
            XLSX.utils.book_append_sheet(wb, wsLc, 'Live Counters');
        }

        if (event.notes) {
            const wsNotes = XLSX.utils.aoa_to_sheet([["Special Instructions"], [event.notes]]);
            XLSX.utils.book_append_sheet(wb, wsNotes, 'Notes');
        }

        XLSX.writeFile(wb, `${client.name}_${event.eventType}_Menu.xlsx`);
    } catch (error) {
        console.error("Failed to generate menu Excel file:", error);
        alert("Sorry, there was an error generating the Excel file.");
    }
};

export const exportReportToExcel = (jsonData: any[], fileName: string, sheetName: string) => {
    try {
        if (!Array.isArray(jsonData)) {
            console.error("Data provided for Excel export is not an array.");
            return;
        }
        const ws = XLSX.utils.json_to_sheet(jsonData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${fileName}`);
    } catch (error) {
        console.error("Failed to generate Excel file:", error);
        alert("Sorry, there was an error generating the Excel file.");
    }
};

// Data Hub Exports
export const exportAllCategories = (categories: AppCategory[]) => {
    const dataToExport = categories.map(c => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId || '',
        type: c.type || '',
        displayRank: c.displayRank || 0,
        isStandardAccompaniment: c.isStandardAccompaniment || false,
    }));
    exportReportToExcel(dataToExport, 'All_Categories.xlsx', 'Categories');
};

export const exportAllItems = (items: Item[], categories: AppCategory[]) => {
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const dataToExport = items.map(i => ({
        id: i.id,
        name: i.name,
        description: i.description || '',
        categoryName: categoryMap.get(i.categoryId) || 'Unknown',
        type: i.type || '',
        displayRank: i.displayRank || 0,
    }));
    exportReportToExcel(dataToExport, 'All_Items.xlsx', 'Items');
};

export const exportAllLiveCounters = (liveCounters: LiveCounter[], liveCounterItems: LiveCounterItem[]) => {
    const counterMap = new Map(liveCounters.map(lc => [lc.id, lc.name]));
    const countersData = liveCounters.map(lc => ({
        id: lc.id,
        name: lc.name,
        description: lc.description || '',
        maxItems: lc.maxItems,
        displayRank: lc.displayRank || 0,
    }));
    const itemsData = liveCounterItems.map(lci => ({
        id: lci.id,
        name: lci.name,
        description: lci.description || '',
        liveCounterName: counterMap.get(lci.liveCounterId) || 'Unknown',
        displayRank: lci.displayRank || 0,
    }));
    
    const wb = XLSX.utils.book_new();
    const wsCounters = XLSX.utils.json_to_sheet(countersData);
    const wsItems = XLSX.utils.json_to_sheet(itemsData);
    XLSX.utils.book_append_sheet(wb, wsCounters, 'Live Counters');
    XLSX.utils.book_append_sheet(wb, wsItems, 'Live Counter Items');
    XLSX.writeFile(wb, 'All_Live_Counters.xlsx');
};

export const exportAllCatalogs = (catalogs: Catalog[], items: Item[]) => {
    const itemMap = new Map(items.map(i => [i.id, i.name]));
    const flatData = catalogs.flatMap(catalog => 
        Object.values(catalog.itemIds).flat().map(itemId => ({
            'Catalog Name': catalog.name,
            'Catalog Description': catalog.description || '',
            'Item Name': itemMap.get(itemId) || `Unknown Item (ID: ${itemId})`,
        }))
    );
    exportReportToExcel(flatData, 'All_Catalogs.xlsx', 'Catalogs');
};

export const exportAllClients = (clients: Client[]) => {
    const dataToExport = clients.map(c => ({
        id: c.id, name: c.name, phone: c.phone, email: c.email || '', company: c.company || '',
        address: c.address || '', referredBy: c.referredBy || '', hasSystemAccess: c.hasSystemAccess, status: c.status,
    }));
    exportReportToExcel(dataToExport, 'All_Clients.xlsx', 'Clients');
};

export const exportAllEvents = (events: Event[], clients: Client[]) => {
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const dataToExport = events.map(e => ({
        id: e.id, clientName: clientMap.get(e.clientId) || 'Unknown', eventType: e.eventType,
        startDate: e.startDate, endDate: e.endDate || '', location: e.location, session: e.session,
        pax: e.pax, status: e.status, state: e.state, notes: e.notes || '',
    }));
    exportReportToExcel(dataToExport, 'All_Events.xlsx', 'Events');
};

export const exportAllRecipes = (recipes: Recipe[], rawMaterials: RawMaterial[]) => {
    const rawMaterialMap = new Map(rawMaterials.map(rm => [rm.id, rm]));
    const flatData = recipes.flatMap(recipe => {
        if (recipe.rawMaterials.length === 0) {
            return [{
                'Recipe': recipe.name, 'Yield Quantity': recipe.yieldQuantity, 'Yield Unit': recipe.yieldUnit,
                'Instructions': recipe.instructions || '', 'Default Ordering Unit': recipe.defaultOrderingUnit || '',
                'Raw Material': '', 'Raw Material Qty': null, 'Raw Material Unit': '',
            }];
        }
        return recipe.rawMaterials.map(rm => {
            const rmDetails = rawMaterialMap.get(rm.rawMaterialId);
            return {
                'Recipe': recipe.name, 'Yield Quantity': recipe.yieldQuantity, 'Yield Unit': recipe.yieldUnit,
                'Instructions': recipe.instructions || '', 'Default Ordering Unit': recipe.defaultOrderingUnit || '',
                'Raw Material': rmDetails?.name || `Unknown (ID: ${rm.rawMaterialId})`,
                'Raw Material Qty': rm.quantity, 'Raw Material Unit': rmDetails?.unit || '',
            };
        });
    });
    exportReportToExcel(flatData, 'All_Recipes.xlsx', 'Recipes');
};

export const exportAllMuhurthamDates = (muhurthamDates: MuhurthamDate[]) => {
    const dataToExport = muhurthamDates.map(md => ({ date: md.date }));
    exportReportToExcel(dataToExport, 'All_Muhurtham_Dates.xlsx', 'Muhurtham Dates');
};

export const exportAllRawMaterials = (rawMaterials: RawMaterial[]) => {
    const dataToExport = rawMaterials.map(rm => ({ name: rm.name, unit: rm.unit }));
    exportReportToExcel(dataToExport, 'All_Raw_Materials.xlsx', 'Raw Materials');
};

// Data Hub Sample Downloads
const downloadSampleExcel = (fileName: string, sheets: { sheetName: string, headers: string[], data?: any[][] }[]) => {
    try {
        const wb = XLSX.utils.book_new();
        sheets.forEach(({ sheetName, headers, data }) => {
            const sheetData = data ? [headers, ...data] : [headers];
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    } catch (error) {
        console.error("Failed to download sample file:", error);
        alert("Sorry, there was an error downloading the sample file.");
    }
};

export const downloadCategorySample = () => {
    const headers = ['Name', 'Parent Category', 'Type', 'Display Rank', 'Is Standard Accompaniment'];
    const data = [['Main Course', '', 'veg', 10, false], ['Gravies', 'Main Course', '', 1, false], ['Accompaniments', '', '', 20, true]];
    downloadSampleExcel('Category_Sample', [{ sheetName: 'Categories', headers, data }]);
};

export const downloadItemSample = () => {
    const headers = ['Item Name', 'Description', 'Parent Category', 'Type', 'Display Rank'];
    const data = [['Paneer Butter Masala', 'Classic paneer dish', 'Gravies', 'veg', 10], ['Chicken Tikka', 'Tandoori chicken appetizer', 'Starters', 'chicken', 20]];
    downloadSampleExcel('Item_Sample', [{ sheetName: 'Items', headers, data }]);
};

export const downloadLiveCounterSample = () => {
    const counterHeaders = ['Name', 'Description', 'Max Items', 'Display Rank'];
    const counterData = [['Dosa Counter', 'Live dosa station', 3, 10], ['Chaat Counter', 'Variety of chaat items', 4, 20]];
    const itemHeaders = ['Name', 'Description', 'Live Counter Name', 'Display Rank'];
    const itemData = [['Masala Dosa', '', 'Dosa Counter', 10], ['Onion Dosa', '', 'Dosa Counter', 20], ['Pani Puri', '', 'Chaat Counter', 10]];
    downloadSampleExcel('Live_Counter_Sample', [
        { sheetName: 'Live Counters', headers: counterHeaders, data: counterData },
        { sheetName: 'Live Counter Items', headers: itemHeaders, data: itemData },
    ]);
};

export const downloadCatalogSample = () => {
    const headers = ['Catalog Name', 'Catalog Description', 'Item Name'];
    const data = [
        ['Standard Veg Package', 'Our most popular veg selection', 'Paneer Butter Masala'],
        ['Standard Veg Package', 'Our most popular veg selection', 'Dal Fry'],
        ['Deluxe Non-Veg Package', 'Premium non-veg options', 'Chicken Tikka'],
    ];
    downloadSampleExcel('Catalog_Sample', [{ sheetName: 'Catalogs', headers, data }]);
};

export const downloadClientEventSample = () => {
    const headers = ['Client Name', 'Phone', 'Email', 'Company', 'Address', 'Referred By', 'Has System Access', 'Status', 'Event Type', 'Start Date', 'End Date', 'Location', 'Session', 'PAX'];
    const data = [['Ravi Kumar', '9876543210', 'ravi@example.com', '', 'Hyderabad', 'Google', true, 'active', 'Wedding', '2024-12-10', '2024-12-10', 'Function Hall A', 'dinner', 500]];
    downloadSampleExcel('Client_Event_Sample', [{ sheetName: 'Clients and Events', headers, data }]);
};

export const downloadRecipeSample = () => {
    const headers = ['Recipe', 'Yield Quantity', 'Yield Unit', 'Instructions', 'Default Ordering Unit', 'Raw Material', 'Raw Material Qty', 'Raw Material Unit'];
    const data = [
        ['Tomato Soup', 5, 'litres', '1. Sauté onions...', 'litres', 'Tomatoes', 2, 'kg'],
        ['Tomato Soup', '', '', '', '', 'Onions', 0.5, 'kg'],
        ['Tomato Soup', '', '', '', '', 'Cream', 200, 'ml'],
    ];
    downloadSampleExcel('Recipe_Sample', [{ sheetName: 'Recipes', headers, data }]);
};

export const downloadMuhurthamDateSample = () => {
    const headers = ['date'];
    const data = [['2024-12-25'], ['2025-01-14']];
    downloadSampleExcel('Muhurtham_Date_Sample', [{ sheetName: 'Dates', headers, data }]);
};

export const downloadRawMaterialSample = () => {
    const headers = ['name', 'unit'];
    const data = [['Tomato', 'kg'], ['Onion', 'kg']];
    downloadSampleExcel('Raw_Material_Sample', [{ sheetName: 'Raw Materials', headers, data }]);
};