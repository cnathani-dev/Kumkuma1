
import React from 'react';
import { OrderTemplate } from '../../types';
import { useOrderTemplates, useRecipes, usePlatters } from '../../contexts/AppContexts';
import { iconButton } from '../../components/common/styles';
import { Download, Edit, Trash2 } from 'lucide-react';
import { exportOrderTemplateToPdf } from '../../lib/export';

export const OrderTemplatesManager: React.FC<{}> = () => {
    const { orderTemplates, deleteOrderTemplate, updateOrderTemplate } = useOrderTemplates();
    const { recipes } = useRecipes();
    const { platters } = usePlatters();
    
    const handleDelete = (id: string) => window.confirm("Are you sure?") && deleteOrderTemplate(id);

    const handleDownload = (template: OrderTemplate) => {
        exportOrderTemplateToPdf(template, recipes, platters);
    };

    const handleRename = async (template: OrderTemplate) => {
        const newName = window.prompt("Enter new name for the template:", template.name);
        if (newName && newName.trim() && newName.trim() !== template.name) {
            try {
                await updateOrderTemplate({ ...template, name: newName.trim() });
            } catch (e) {
                alert(`Error renaming template: ${e}`);
            }
        }
    };

    return (
         <div className="bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md">
            <p className="text-sm text-warm-gray-500 mb-4">Order templates can be created from the "Save as Template" button on an order's edit screen.</p>
            <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700">
                {orderTemplates.sort((a,b) => a.name.localeCompare(b.name)).map(template => (
                    <li key={template.id} className="py-2 flex justify-between items-center">
                        <span>{template.name}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleDownload(template)} className={iconButton('hover:bg-green-100 dark:hover:bg-green-800/50')} title="Download Order Form">
                                <Download size={16} className="text-green-600"/>
                            </button>
                            <button onClick={() => handleRename(template)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800/50')} title="Rename Template">
                                <Edit size={16} className="text-primary-600"/>
                            </button>
                            <button onClick={() => handleDelete(template.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800/50')} title="Delete Template">
                                <Trash2 size={16} className="text-accent-500"/>
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
};
