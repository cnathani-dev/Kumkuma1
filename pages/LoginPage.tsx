import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

const LoginPage: React.FC<{ onNavigateToSignUp: () => void }> = ({ onNavigateToSignUp }) => {
    console.log("LoginPage.tsx: Rendering.");
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const result = await login(username, password);
            if (!result.success) {
                setError(result.message);
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const inputStyle = "relative block w-full px-4 py-3 text-warm-gray-900 placeholder-warm-gray-500 border border-warm-gray-300 rounded-md appearance-none focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm dark:bg-warm-gray-700 dark:border-warm-gray-600 dark:placeholder-warm-gray-400 dark:text-white transition-colors";

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-2xl dark:bg-warm-gray-800 border-t-4 border-primary-400">
                <div className="text-center">
                    <div className="leading-none py-1 inline-block">
                        <span className="font-display font-bold text-4xl text-accent-500 tracking-wide">
                            kumkuma
                        </span>
                        <span className="block font-body font-normal text-xs text-warm-gray-600 dark:text-warm-gray-300 tracking-[0.3em] uppercase">
                            CATERERS
                        </span>
                    </div>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4 rounded-md">
                        <div>
                            <label htmlFor="username" className="sr-only">Username</label>
                            <input
                                id="username"
                                name="username"
                                type="email"
                                autoComplete="email"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className={inputStyle}
                                placeholder="Email Address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={inputStyle}
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-center text-accent-500 dark:text-accent-400">{error}</p>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="relative flex justify-center w-full px-4 py-3 text-sm font-semibold text-white bg-primary-500 border border-transparent rounded-md group hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-warm-gray-50 dark:focus:ring-offset-warm-gray-800 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                        >
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <LogIn className="w-5 h-5 text-primary-300" aria-hidden="true" />
                            </span>
                            {isLoading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </div>
                </form>
                 <p className="mt-6 text-sm text-center text-warm-gray-600 dark:text-warm-gray-400">
                    Don't have an account?{' '}
                    <button onClick={onNavigateToSignUp} className="font-medium text-primary-600 hover:text-primary-500 hover:underline">
                        Sign up
                    </button>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;