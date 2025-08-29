import { Event, Client } from '../../types';
import { yyyyMMDDToDate } from '../../lib/utils';
import { ChartData } from './ChartRenderer';

export interface QueryPlan {
    dataType: 'events' | 'clients';
    filters?: {
        field: string;
        operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
        value: string;
    }[];
    timeFilter?: {
        field: 'startDate' | 'createdAt';
        period: 'last_week' | 'last_month' | 'this_week' | 'this_month' | 'custom';
        startDate?: string;
        endDate?: string;
    };
    aggregation: {
        groupBy: 'day' | 'week' | 'month' | 'eventType' | 'location' | 'none';
        metric: 'count';
    };
    visualization: {
        type: 'kpi' | 'bar' | 'line' | 'table';
        title: string;
    };
}

const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
};

export const processQueryPlan = (plan: QueryPlan, events: Event[], clients: Client[]): ChartData[] => {
    let data: any[] = plan.dataType === 'events' ? events : clients;

    // Apply time filters
    if (plan.timeFilter) {
        const { field, period } = plan.timeFilter;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let startDate: Date;
        let endDate: Date = new Date(now);
        endDate.setHours(23, 59, 59, 999);

        switch (period) {
            case 'last_week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay() - 6);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'this_week':
                 startDate = new Date(now);
                 startDate.setDate(now.getDate() - now.getDay());
                 break;
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'custom':
                 startDate = plan.timeFilter.startDate ? yyyyMMDDToDate(plan.timeFilter.startDate) : new Date(0);
                 endDate = plan.timeFilter.endDate ? yyyyMMDDToDate(plan.timeFilter.endDate) : new Date();
                 break;
        }
        
        data = data.filter(item => {
            const dateValueStr = field === 'createdAt' 
                ? (item.createdAt || (item.history && item.history[0]?.timestamp)) 
                : item.startDate;
            if (!dateValueStr) return false;
            
            const itemDate = field === 'startDate' ? yyyyMMDDToDate(dateValueStr) : new Date(dateValueStr);
            return itemDate >= startDate && itemDate <= endDate;
        });
    }

    // Apply general filters
    if (plan.filters) {
        plan.filters.forEach(filter => {
            data = data.filter(item => {
                const itemValue = item[filter.field];
                if (itemValue === undefined) return false;
                switch (filter.operator) {
                    case 'eq': return itemValue.toString() === filter.value;
                    case 'neq': return itemValue.toString() !== filter.value;
                    case 'contains': return itemValue.toString().toLowerCase().includes(filter.value.toLowerCase());
                    // Add more operators as needed
                    default: return true;
                }
            });
        });
    }
    
    // Apply aggregation
    const { groupBy, metric } = plan.aggregation;

    if (groupBy === 'none' || metric !== 'count') {
        // For KPI, just return the count
        return [{ label: 'Total', value: data.length }];
    }

    const aggregated: Record<string, number> = {};

    data.forEach(item => {
        let key: string;
        switch (groupBy) {
            case 'day':
                key = item.startDate || new Date(item.createdAt || (item.history && item.history[0]?.timestamp)).toISOString().split('T')[0];
                break;
            case 'week':
                const date = item.startDate ? yyyyMMDDToDate(item.startDate) : new Date(item.createdAt || (item.history && item.history[0]?.timestamp));
                key = getStartOfWeek(date).toISOString().split('T')[0];
                break;
             case 'month':
                 const monthDate = item.startDate ? yyyyMMDDToDate(item.startDate) : new Date(item.createdAt || (item.history && item.history[0]?.timestamp));
                 key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
                 break;
            case 'eventType':
                key = item.eventType || 'N/A';
                break;
            case 'location':
                key = item.location || 'N/A';
                break;
            default:
                key = 'Total';
                break;
        }
        aggregated[key] = (aggregated[key] || 0) + 1;
    });

    return Object.entries(aggregated).map(([label, value]) => ({ label, value })).sort((a,b) => a.label.localeCompare(b.label));
};
