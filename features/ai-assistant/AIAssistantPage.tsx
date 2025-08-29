import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Event, Client } from '../../types';
import { inputStyle, primaryButton, secondaryButton } from '../../components/common/styles';
import { Sparkles, Send, Loader2, ServerCrash } from 'lucide-react';
import { processQueryPlan, QueryPlan } from './DataProcessor';
import { ChartRenderer, ChartData } from './ChartRenderer';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    summary?: string;
    visualization?: {
        type: string;
        title: string;
        data: ChartData[];
    };
}

const examplePrompts = [
    "How many events were confirmed last week?",
    "Show me a bar chart of leads per day for the last month",
    "What are my top 5 event locations by number of events?",
    "Total number of active clients"
];

const schemas = `
Event Schema:
- id: string
- clientId: string (links to a client)
- eventType: string (e.g., "Wedding", "Birthday Party")
- startDate: string (format YYYY-MM-DD)
- endDate: string (optional, format YYYY-MM-DD)
- location: string
- session: 'breakfast' | 'lunch' | 'dinner' | 'all-day'
- pax: number (number of guests)
- state: 'lead' | 'confirmed' | 'lost' | 'cancelled'
- createdAt: string (ISO 8601 format of when the event was created)

Client Schema:
- id: string
- name: string
- status: 'active' | 'inactive'
- history: array of objects. The first entry's timestamp can be used as the client's creation date.
`;

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "A one-sentence, natural language summary of the answer to the user's query." },
        queryPlan: {
            type: Type.OBJECT,
            properties: {
                dataType: { type: Type.STRING, enum: ["events", "clients"], description: "The primary dataset to query." },
                filters: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            field: { type: Type.STRING },
                            operator: { type: Type.STRING, enum: ["eq", "neq", "gt", "lt", "contains"] },
                            value: { type: Type.STRING }
                        }
                    },
                    nullable: true,
                },
                timeFilter: {
                    type: Type.OBJECT,
                    properties: {
                        field: { type: Type.STRING, enum: ["startDate", "createdAt"] },
                        period: { type: Type.STRING, enum: ["last_week", "last_month", "this_week", "this_month", "custom"] },
                        startDate: { type: Type.STRING, nullable: true },
                        endDate: { type: Type.STRING, nullable: true },
                    },
                    nullable: true,
                },
                aggregation: {
                    type: Type.OBJECT,
                    properties: {
                        groupBy: { type: Type.STRING, enum: ["day", "week", "month", "eventType", "location", "none"] },
                        metric: { type: Type.STRING, enum: ["count"] }
                    }
                },
                visualization: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ["kpi", "bar", "line", "table"] },
                        title: { type: Type.STRING }
                    }
                }
            }
        }
    }
};

export const AIAssistantPage = ({ events, clients }: { events: Event[], clients: Client[] }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    const handleQuery = async (queryText: string) => {
        if (!queryText.trim() || isLoading) return;

        const newUserMessage: Message = { id: Date.now().toString(), role: 'user', content: queryText };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            const systemInstruction = `You are an expert data analyst for a catering business. Your task is to interpret a user's question about their business data and generate a JSON object representing a 'query plan'. The client-side code will handle the actual data filtering and aggregation. You have access to two data types: 'events' and 'clients'. Here are their schemas: ${schemas}. When you receive a user question, you MUST respond ONLY with a valid JSON object that follows the provided schema. Do not include any other text or explanation. Today's date is ${new Date().toISOString().split('T')[0]}.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: queryText,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema
                }
            });

            const responseText = response.text;
            const parsedResponse = JSON.parse(responseText);

            const queryPlan: QueryPlan = parsedResponse.queryPlan;
            const processedData = processQueryPlan(queryPlan, events, clients);

            const newAssistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
                summary: parsedResponse.summary,
                visualization: {
                    type: queryPlan.visualization.type,
                    title: queryPlan.visualization.title,
                    data: processedData,
                }
            };
            setMessages(prev => [...prev, newAssistantMessage]);

        } catch (err) {
            console.error("Gemini API Error:", err);
            setError("Sorry, I couldn't process that request. The AI might be unavailable or the query could not be understood.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="flex flex-col h-[calc(100vh-10rem)] max-w-4xl mx-auto">
            <div className="flex-grow overflow-y-auto p-4 space-y-6">
                {messages.length === 0 && !isLoading && (
                     <div className="text-center py-8">
                        <Sparkles size={48} className="mx-auto text-primary-500" />
                        <h2 className="mt-4 text-2xl font-bold">AI Assistant</h2>
                        <p className="mt-2 text-warm-gray-500">Ask me anything about your events and clients.</p>
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {examplePrompts.map(prompt => (
                                <button key={prompt} onClick={() => handleQuery(prompt)} className="p-3 bg-warm-gray-100 dark:bg-warm-gray-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/40 text-left transition-colors">
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map(message => (
                    <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {message.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0"><Sparkles size={20} className="text-primary-600"/></div>}
                        <div className={`max-w-xl p-4 rounded-2xl ${message.role === 'user' ? 'bg-primary-500 text-white rounded-br-none' : 'bg-warm-gray-100 dark:bg-warm-gray-800 rounded-bl-none'}`}>
                            {message.role === 'user' ? (
                                <p>{message.content}</p>
                            ) : (
                                <div className="space-y-4">
                                    <p className="font-semibold">{message.summary}</p>
                                    {message.visualization && <ChartRenderer {...message.visualization} />}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0"><Loader2 size={20} className="text-primary-600 animate-spin"/></div>
                        <div className="max-w-xl p-4 rounded-2xl bg-warm-gray-100 dark:bg-warm-gray-800 rounded-bl-none">
                            <p className="italic text-warm-gray-500">Thinking...</p>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="flex justify-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0"><ServerCrash size={20} className="text-red-600"/></div>
                        <div className="max-w-xl p-4 rounded-2xl bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 rounded-bl-none">
                            <p className="font-semibold">Error</p>
                            <p>{error}</p>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
            <div className="flex-shrink-0 p-4 border-t border-warm-gray-200 dark:border-warm-gray-700">
                <form onSubmit={(e) => { e.preventDefault(); handleQuery(input); }} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Ask a question about your data..."
                        className={inputStyle + " flex-grow"}
                        disabled={isLoading}
                    />
                    <button type="submit" className={primaryButton} disabled={isLoading || !input.trim()}>
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};
