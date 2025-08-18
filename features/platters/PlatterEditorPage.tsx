import React, { useState, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Platter, PlatterRecipe, Recipe } from '../../types';
import { useRecipes } from '../../contexts/AppContexts';
import { primaryButton, secondaryButton, inputStyle } from '../../components/common/styles';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';

const RecipeSearchInput = ({
    recipes,
    onSelect,
    value,
}: {
    recipes: Recipe[];
    onSelect: (recipeId: string) => void;
    value: string; // The selected recipeId
}) => {
    const selectedRecipeName = useMemo(() => recipes.find(r => r.id === value)?.name || '', [recipes, value]);
    const [searchTerm, setSearchTerm] = useState(selectedRecipeName);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSearchTerm(selectedRecipeName);
    }, [selectedRecipeName]);
    
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // If dropdown is closed without selection, revert to original name
                setSearchTerm(selectedRecipeName);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef, selectedRecipeName]);


    const filteredRecipes = useMemo(() => {
        if (!searchTerm) return recipes;
        return recipes.filter(recipe =>
            recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, recipes]);

    const handleSelect = (recipe: Recipe) => {
        onSelect(recipe.id);
        setSearchTerm(recipe.name);
        setIsOpen(false);
    };
    
    return (
        <div className="relative flex-grow" ref={wrapperRef}>
            <input
                type="text"
                value={searchTerm}
                onChange={e => {
                    setSearchTerm(e.target.value);
                    if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                className={inputStyle}
                placeholder="Search for a recipe..."
            />
            {isOpen && (
                <ul className="absolute z-[100] w-full bg-white dark:bg-warm-gray-700 border border-warm-gray-300 dark:border-warm-gray-600 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                    {filteredRecipes.length > 0 ? (
                        filteredRecipes.map(recipe => (
                            <li
                                key={recipe.id}
                                onClick={() => handleSelect(recipe)}
                                className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30"
                            >
                                {recipe.name}
                            </li>
                        ))
                    ) : (
                        <li className="px-3 py-2 text-warm-gray-500">No recipes found</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export const PlatterEditorPage = ({ platter: initialPlatter, onSave, onBack }: {
    platter: Platter | null,
    onSave: (data: Omit<Platter, 'id'> | Platter) => void,
    onBack: () => void
}) => {
    const { recipes: allRecipes } = useRecipes();
    const sortedRecipes = useMemo(() => allRecipes.slice().sort((a,b) => a.name.localeCompare(b.name)), [allRecipes]);

    const [name, setName] = useState(initialPlatter?.name || '');
    const [platterRecipes, setPlatterRecipes] = useState<(PlatterRecipe & { tempId: string })[]>(
        (initialPlatter?.recipes || []).map(r => ({ ...r, tempId: uuidv4() }))
    );

    const handleAddRecipeRow = () => {
        setPlatterRecipes([...platterRecipes, { recipeId: '', quantityMl: 0, tempId: uuidv4() }]);
    };

    const handleRemoveRecipeRow = (tempId: string) => {
        setPlatterRecipes(platterRecipes.filter(r => r.tempId !== tempId));
    };

    const handleRecipeChange = (tempId: string, field: 'recipeId' | 'quantityMl', value: any) => {
        const index = platterRecipes.findIndex(r => r.tempId === tempId);
        if (index === -1) return;

        const updatedRecipes = [...platterRecipes];
        const newValue = field === 'quantityMl' ? (Number(value) < 0 ? 0 : Number(value)) : value;
        updatedRecipes[index] = { ...updatedRecipes[index], [field]: newValue };
        setPlatterRecipes(updatedRecipes);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const finalRecipes = platterRecipes
            .filter(r => r.recipeId && r.quantityMl > 0)
            .map(({ tempId, ...rest }) => rest);
        
        if (finalRecipes.length === 0) {
            alert("A platter must contain at least one recipe with a quantity greater than 0.");
            return;
        }

        const platterData = { name, recipes: finalRecipes };
        if (initialPlatter) {
            onSave({ ...initialPlatter, ...platterData });
        } else {
            onSave(platterData);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-warm-gray-200 dark:border-warm-gray-700">
                <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-primary-100">
                    {initialPlatter ? "Edit Platter" : "Create New Platter"}
                </h2>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className={secondaryButton}>
                        <ArrowLeft size={16}/> Back
                    </button>
                    <button type="submit" className={primaryButton}>
                        <Save size={18} /> Save Platter
                    </button>
                </div>
            </div>

            <div className="p-6 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md space-y-4">
                <h3 className="font-bold text-lg">Platter Details</h3>
                <div>
                    <label className="block text-sm font-medium">Platter Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputStyle} />
                </div>
            </div>

            <div className="p-6 bg-white dark:bg-warm-gray-800 rounded-lg shadow-md">
                <h3 className="font-bold text-lg mb-4">Recipes in this Platter</h3>
                <div className="space-y-2">
                    {platterRecipes.map((pRecipe) => (
                        <div key={pRecipe.tempId} className="flex items-center gap-2">
                            <RecipeSearchInput
                                recipes={sortedRecipes}
                                value={pRecipe.recipeId}
                                onSelect={(recipeId) => handleRecipeChange(pRecipe.tempId, 'recipeId', recipeId)}
                            />
                            <input type="number" placeholder="Qty" value={pRecipe.quantityMl || ''} onChange={e => handleRecipeChange(pRecipe.tempId, 'quantityMl', e.target.value)} className={inputStyle + " w-24"} min="0" step="any"/>
                            <span className="w-16 text-sm text-gray-500">ml</span>
                            <button type="button" onClick={() => handleRemoveRecipeRow(pRecipe.tempId)} className="text-accent-500 p-2 rounded-full hover:bg-accent-100"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={handleAddRecipeRow} className={`${secondaryButton} mt-4`}>
                    <Plus size={16}/> Add Recipe
                </button>
            </div>
        </form>
    );
};