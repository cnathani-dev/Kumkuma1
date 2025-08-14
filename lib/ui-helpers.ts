
import { AppCategory } from '../types';

export const generateCategoryOptions = (categories: AppCategory[]) => {
    const categoryMap = new Map(categories.map(c => [c.id, {...c, children: [] as AppCategory[]}]));
    const roots: AppCategory[] = [];

    categories.forEach(c => {
        if(c.parentId && categoryMap.has(c.parentId)) {
            categoryMap.get(c.parentId)!.children.push(c);
        } else {
            roots.push(c);
        }
    });

    const options: { value: string; label: string }[] = [];
    const buildOptions = (cats: AppCategory[], depth = 0) => {
        const prefix = '— '.repeat(depth);
        cats.sort((a,b) => (a.displayRank ?? Infinity) - (b.displayRank ?? Infinity) || a.name.localeCompare(b.name)).forEach(c => {
            options.push({ value: c.id, label: prefix + c.name });
            const mappedCategory = categoryMap.get(c.id);
            if (mappedCategory && mappedCategory.children.length > 0) {
                buildOptions(mappedCategory.children, depth + 1);
            }
        });
    }

    buildOptions(roots);
    return options;
};
