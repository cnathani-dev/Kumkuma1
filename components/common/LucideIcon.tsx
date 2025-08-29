
import React from 'react';
import * as icons from 'lucide-react';
import { HelpCircle } from 'lucide-react';

export const LucideIcon = ({ name, ...props }: { name: string;[key: string]: any }) => {
    const IconComponent = (icons as any)[name];
    if (!IconComponent) {
        return <HelpCircle {...props} />; // fallback icon
    }
    return <IconComponent {...props} />;
};
