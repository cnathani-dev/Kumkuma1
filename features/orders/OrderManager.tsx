import React, { useMemo } from 'react';
import { Order } from '../../types';
import { useRecipes, useOrderTemplates } from '../../contexts/AppContexts';
import { primaryButton, iconButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import { formatYYYYMMDD } from '../../lib/utils';

interface OrderManagerProps {
    orders: Order[];
    onAdd: () => void;
    onEdit: (order: Order) => void;
    onDelete: (id: string) => void;
}

export const OrderManager: React.FC<OrderManagerProps> = ({ orders, onAdd, onEdit, onDelete }) => {
    const { recipes } = useRecipes();
    const { addOrderTemplate } = useOrderTemplates();
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
            if (recipeIds.length === 0) {
                alert("This order has no recipes to save in a template.");
                return;
            }
            try {
                await addOrderTemplate({
                    name: templateName.trim(),
                    recipeIds: recipeIds
                });
                alert(`Template "${templateName.trim()}" saved successfully!`);
            } catch (e) {
                console.error("Failed to save template", e);
                alert("Error saving template.");
            }
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-display font-bold">Production Orders</h1>
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
                                {dateOrders.map(order => {
                                    const recipeTotals = Object.entries(order.recipeRequirements || {}).map(([recipeId, requirements]) => {
                                        const total = Object.values(requirements).reduce((sum, qty) => sum + qty, 0);
                                        return {
                                            name: recipeMap.get(recipeId) || 'Unknown Recipe',
                                            total: total
                                        };
                                    }).filter(r => r.total > 0);

                                    return (
                                        <div key={order.id} className="p-5 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md flex flex-col justify-between">
                                            <div>
                                                <h3 className="font-bold text-lg capitalize">{order.session} Order</h3>
                                                <ul className="list-disc pl-5 mt-2 text-sm text-warm-gray-600 dark:text-warm-gray-400">
                                                    {recipeTotals.map((r, i) => (
                                                        <li key={i}>{r.name}: {r.total.toFixed(2)} kg (Total)</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="flex justify-end gap-2 mt-4">
                                                <button onClick={() => handleSaveAsTemplate(order)} className={iconButton('hover:bg-blue-100')} title="Save as Template">
                                                    <Save size={16} className="text-blue-600"/>
                                                </button>
                                                <button onClick={() => onEdit(order)} className={iconButton('hover:bg-primary-100')}><Edit size={16} className="text-primary-600"/></button>
                                                <button onClick={() => onDelete(order.id)} className={iconButton('hover:bg-accent-100')}><Trash2 size={16} className="text-accent-500"/></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};