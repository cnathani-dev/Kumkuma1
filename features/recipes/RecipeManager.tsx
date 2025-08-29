
import React, { useMemo, useState } from 'react';
import { Recipe, RawMaterial } from '../../types';
import { useRecipes, useRawMaterials } from '../../contexts/AppContexts';
import { iconButton, inputStyle, primaryButton } from '../../components/common/styles';
import { Plus, Edit, Trash2, Scale } from 'lucide-react';

export const RecipeManager: React.FC<{ onAdd: () => void, onEdit: (recipe: Recipe) => void, onDelete: (id: string) => void, onScale: (recipe: Recipe) => void }> = ({ onAdd, onEdit, onDelete, onScale }) => {
    const { recipes } = useRecipes();
    const { rawMaterials } = useRawMaterials();
    const [searchTerm, setSearchTerm] = useState('');

    const rawMaterialMap = useMemo(() => new Map(rawMaterials.map(rm => [rm.id, rm.name])), [rawMaterials]);

    const filteredRecipes = useMemo(() => {
        const lowerCaseSearch = searchTerm.toLowerCase().trim();
        if (!lowerCaseSearch) {
            return recipes.sort((a, b) => a.name.localeCompare(b.name));
        }

        return recipes.filter(recipe => {
            if (recipe.name.toLowerCase().includes(lowerCaseSearch)) {
                return true;
            }
            return recipe.rawMaterials.some(rm => {
                const rawMaterialName = rawMaterialMap.get(rm.rawMaterialId);
                return rawMaterialName?.toLowerCase().includes(lowerCaseSearch);
            });
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [recipes, searchTerm, rawMaterialMap]);

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <button onClick={onAdd} className={primaryButton}><Plus size={16}/> Add Recipe</button>
            </div>
             <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search by recipe or raw material name..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={inputStyle}
                />
            </div>
            {recipes.length > 0 && filteredRecipes.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                    <p className="text-warm-gray-500">No recipes match your search.</p>
                </div>
            ) : recipes.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                    <p className="text-warm-gray-500">No recipes have been created yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map(recipe => (
                        <div key={recipe.id} className="bg-white dark:bg-warm-gray-800 rounded-lg shadow-md p-5 flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-lg text-warm-gray-800 dark:text-warm-gray-200 truncate">{recipe.name}</h4>
                                <p className="text-sm text-warm-gray-500 mt-1">
                                    Yields: {recipe.yieldQuantity || 0} {recipe.yieldUnit}
                                </p>
                                <p className="text-sm text-warm-gray-500">
                                    {recipe.rawMaterials.length} raw material(s)
                                </p>
                            </div>
                            <div className="flex justify-end gap-1 mt-4 pt-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
                                <button onClick={() => onScale(recipe)} className={iconButton('hover:bg-green-100 dark:hover:bg-green-800')} title="Scale Recipe"><Scale size={16} className="text-green-600"/></button>
                                <button onClick={() => onEdit(recipe)} className={iconButton('hover:bg-primary-100 dark:hover:bg-primary-800')}><Edit size={16} className="text-primary-600"/></button>
                                <button onClick={() => onDelete(recipe.id)} className={iconButton('hover:bg-accent-100 dark:hover:bg-accent-800')}><Trash2 size={16} className="text-accent-500"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
