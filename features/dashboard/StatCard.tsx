
import React from 'react';

export const StatCard = ({ title, value, icon: Icon, color, isActive, onClick }: { title: string, value: number, icon: React.ElementType, color: string, isActive: boolean, onClick: () => void }) => {
    return (
        <div onClick={onClick} className={`bg-white dark:bg-warm-gray-800 p-6 rounded-lg shadow-md flex items-center gap-4 cursor-pointer transition-all duration-300 ${isActive ? 'ring-2 ring-primary-500' : 'hover:shadow-lg hover:-translate-y-1'}`}>
            <div className={`p-3 rounded-full bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
                <Icon size={24} className={color} />
            </div>
            <div>
                <p className="text-sm text-warm-gray-500">{title}</p>
                <p className="text-2xl font-bold">{value}</p>
            </div>
        </div>
    );
};
