import React, { useMemo } from 'react';
import { Order } from '../../types';
import { useRecipes, useOrderTemplates, useRestaurants, useRawMaterials, usePlatters, useOrders } from '../../contexts/AppContexts';
import { primaryButton, iconButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, Save, Download, Copy } from 'lucide-react';
import { formatYYYYMMDD, dateToYYYYMMDD } from '../../lib/utils';
import { exportOrderToPdf } from '../../lib/export';

interface OrderManagerProps {
    orders: Order[];
    onAdd: () => void;
    onEdit: (order: Order) => void;
    onDelete: (id: string) => void;
}

export const OrderManager: React.FC<OrderManagerProps> = ({ orders, onAdd, onEdit, onDelete }) => {
    const { recipes } = useRecipes();
    const { addOrderTemplate } = useOrderTemplates();
    const { restaurants } = useRestaurants();
    const { rawMaterials } = useRawMaterials();
    const { platters } = usePlatters();
    const { addOrder } = useOrders();

    const recipeMap = useMemo(() => new Map(recipes.map(r => [r.id, r.name])), [recipes]);

    const ordersByDate = useMemo(() => {
        const grouped: { [date: string]: Order[] } = {};
        orders.forEach(order => {
            if (!grouped[order.date]) {
                grouped[order.date] = [];
            }
            grouped[order.date].push(order);
        });
        return Object.entries(grouped).sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
    }, [orders]);

    const handleSaveAsTemplate = async (order: Order) => {
        const templateName = window.prompt("Enter a name for the new order template:");
        if (templateName && templateName.trim()) {
            const recipeIds = Object.keys(order.recipeRequirements || {});
            const platterIds = Object.keys(order.platterRequirements || {});

            if (recipeIds.length === 0 && platterIds.length === 0) {
                alert("This order has no items to save in a template.");
                return;
            }
            try {
                await addOrderTemplate({
                    name: templateName.trim(),
                    recipeIds,
                    platterIds,
                });
                alert(`Template "${templateName.trim()}" saved successfully!`);
            } catch (e) {
                console.error("Failed to save template", e);
                alert("Error saving template.");
            }
        }
    };
    
    const handleDownloadPdf = (order: Order) => {
        exportOrderToPdf(order, restaurants, recipes, rawMaterials, platters);
    };

    const handleDuplicateOrder = async (orderToDuplicate: Order) => {
        const newDate = window.prompt("Enter the date for the new order (YYYY-MM-DD):", dateToYYYYMMDD(new Date()));

        if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            if (newDate !== null) { // if user didn't press cancel
                alert("Invalid date format. Please use YYYY-MM-DD.");
            }
            return;
        }

        const { id, ...restOfOrder } = orderToDuplicate;
        
        const newOrderData: Omit<Order, 'id'> = {
            ...restOfOrder,
            date: newDate,
        };

        try {
            const newOrderId = await addOrder(newOrderData);
            const newOrderWithId = { ...newOrderData, id: newOrderId };
            onEdit(newOrderWithId); // Open the new order in the editor
        } catch (e) {
            console.error("Failed to duplicate order", e);
            alert("An error occurred while duplicating the order.");
        }
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <button onClick={onAdd} className={primaryButton}>
                    <Plus size={16}/> Create Order
                </button>
            </div>
            {ordersByDate.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-warm-gray-500">No production orders have been created yet.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {ordersByDate.map(([date, dateOrders]) => (
                        <div key={date}>
                            <h2 className="font-bold text-xl mb-4 text-primary-600 dark:text-primary-400">{formatYYYYMMDD(date)}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {dateOrders.map(order => (
                                    <div key={order.id} className="p-5 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-bold text-lg capitalize">{order.session} Order</h3>
                                        </div>
                                        <div className="flex justify-end gap-1 mt-4 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
                                            <button onClick={() => handleDownloadPdf(order)} className={iconButton('hover:bg-green-100 dark:hover:bg-green-800/50')} title="Download PDF">
                                                <Download size={16} className="text-green-600"/>
                                            </button>
                                            <button onClick={() => handleDuplicateOrder(order)} className={iconButton('hover:bg-blue-100 dark:hover:bg-blue-800/50')} title="Duplicate Order">
                                                <Copy size={16} className="text-blue-600"/>
                                            </button>
                                            <button onClick={() => handleSaveAsTemplate(order)} className={iconButton('hover:bg-purple-100 dark:hover:bg-purple-800/50')} title="Save as Template">
                                                <Save size={16} className="text-purple-600"/>
                                            </button>
                                            <button onClick={() => onEdit(order)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800/50')}><Edit size={16} className="text-primary-600"/></button>
                                            <button onClick={() => onDelete(order.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800/50')}><Trash2 size={16} className="text-accent-500"/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
