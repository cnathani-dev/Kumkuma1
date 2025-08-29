
import React, { useMemo, useState } from 'react';
import { Recipe, RawMaterial } from '../../../types';
import Modal from '../../../components/Modal';
import { inputStyle, secondaryButton } from '../../../components/common/styles';

export const ScaleRecipeModal = ({ recipe, rawMaterials, onClose }: {
    recipe: Recipe;
    rawMaterials: RawMaterial[];
    onClose: () => void;
}) => {
    const originalOutput = recipe.yieldQuantity;
    const originalUnit = recipe.yieldUnit;
    
    const [desiredOutput, setDesiredOutput] = useState(originalOutput);

    const rawMaterialMap = useMemo(() => new Map(rawMaterials.map(rm => [rm.id, rm])), [rawMaterials]);

    const scaledIngredients = useMemo(() => {
        if (!desiredOutput || !originalOutput) return [];
        const ratio = desiredOutput / originalOutput;
        return recipe.rawMaterials.map(rm => {
            const details = rawMaterialMap.get(rm.rawMaterialId);
            return {
                name: details?.name || 'Unknown',
                unit: details?.unit || '',
                scaledQuantity: rm.quantity * ratio,
            };
        });
    }, [recipe, desiredOutput, originalOutput, rawMaterialMap]);

    return (
        <Modal isOpen={true} onClose={onClose} title={`Scale Recipe: ${recipe.name}`}>
            <div className="space-y-4">
                <div className="p-4 bg-warm-gray-50 dark:bg-warm-gray-700/50 rounded-lg">
                    <p className="font-semibold">Original Yield</p>
                    <p className="text-2xl font-bold">{originalOutput} {originalUnit}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium">Desired Yield</label>
                        <input
                            type="number"
                            value={desiredOutput}
                            onChange={e => setDesiredOutput(Number(e.target.value))}
                            min="0"
                            step="any"
                            className={inputStyle}
                        />
                    </div>
                    <div>
                         <p className={inputStyle + " bg-warm-gray-100 dark:bg-warm-gray-700"}>{originalUnit}</p>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                    <h4 className="font-bold">Scaled Ingredients</h4>
                    {scaledIngredients.length === 0 ? (
                        <p className="text-warm-gray-500">No ingredients to scale.</p>
                    ) : (
                        <ul className="divide-y divide-warm-gray-200 dark:divide-warm-gray-700 max-h-60 overflow-y-auto mt-2 pr-2">
                           {scaledIngredients.map((ing, i) => (
                               <li key={i} className="py-2 flex justify-between">
                                   <span>{ing.name}</span>
                                   <span className="font-semibold">{ing.scaledQuantity.toFixed(2)} {ing.unit}</span>
                               </li>
                           ))}
                        </ul>
                    )}
                </div>
                <div className="flex justify-end pt-4">
                     <button type="button" onClick={onClose} className={secondaryButton}>Close</button>
                </div>
            </div>
        </Modal>
    );
};
