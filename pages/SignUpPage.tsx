import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus } from 'lucide-react';

const SignUpPage: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { signup } = useAuth();

    useEffect(() => {
        if (success) {
            console.log("useEffect[success]: Success message is set, starting 3s timer for navigation.");
            const timer = setTimeout(() => {
                console.log("useEffect[success]: Timer finished, calling onNavigate.");
                onNavigate();
            }, 3000); // Navigate to login page after 3 seconds
            return () => clearTimeout(timer); // Cleanup on component unmount
        }
    }, [success, onNavigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("SignUp.handleSubmit: Fired.");
        setError('');
        setSuccess('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            console.log("SignUp.handleSubmit: Password too short.");
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            console.log("SignUp.handleSubmit: Passwords do not match.");
            return;
        }

        console.log("SignUp.handleSubmit: Setting isLoading to true.");
        setIsLoading(true);
        try {
            console.log("SignUp.handleSubmit: Calling signup function...");
            const result = await signup(username, password);
            console.log("SignUp.handleSubmit: signup function returned with result:", result);

            if (result.success) {
                console.log("SignUp.handleSubmit: Signup successful, setting success message.");
                setSuccess(result.message);
            } else {
                console.log("SignUp.handleSubmit: Signup failed, setting error message.");
                setError(result.message);
            }
        } catch (err) {
            console.error("SignUp.handleSubmit: Caught an unexpected error:", err);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            console.log("SignUp.handleSubmit: In finally block, setting isLoading to false.");
            setIsLoading(false);
        }
    };
    
    const inputStyle = "relative block w-full px-4 py-3 text-warm-gray-900 placeholder-warm-gray-500 border border-warm-gray-300 rounded-md appearance-none focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm dark:bg-warm-gray-700 dark:border-warm-gray-600 dark:placeholder-warm-gray-400 dark:text-white transition-colors";

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-2xl dark:bg-warm-gray-800 border-t-4 border-primary-400">
                <div className="text-center">
                     <h2 className="text-3xl font-display font-bold text-warm-gray-800 dark:text-warm-gray-100">Create an Account</h2>
                     <p className="mt-2 text-sm text-warm-gray-600 dark:text-warm-gray-400">Your account will be activated after administrator approval.</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4 rounded-md">
                        <div>
                            <label htmlFor="username" className="sr-only">Email</label>
                            <input id="username" name="username" type="email" autoComplete="email" required value={username} onChange={(e) => setUsername(e.target.value)} className={inputStyle} placeholder="Email Address"/>
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input id="password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} placeholder="Password (min. 6 characters)"/>
                        </div>
                         <div>
                            <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
                            <input id="confirm-password" name="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputStyle} placeholder="Confirm Password"/>
                        </div>
                    </div>

                    {error && <p className="text-sm text-center text-accent-500 dark:text-accent-400">{error}</p>}
                    {success && <p className="text-sm text-center text-green-600 dark:text-green-300">{success}</p>}

                    <div>
                        <button type="submit" disabled={isLoading || !!success} className="relative flex justify-center w-full px-4 py-3 text-sm font-semibold text-white bg-primary-500 border border-transparent rounded-md group hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3"><UserPlus className="w-5 h-5 text-primary-300" aria-hidden="true" /></span>
                            {isLoading ? 'Creating Account...' : 'Sign Up'}
                        </button>
                    </div>
                </form>
                 <p className="mt-6 text-sm text-center text-warm-gray-600 dark:text-warm-gray-400">
                    Already have an account?{' '}
                    <button onClick={onNavigate} className="font-medium text-primary-600 hover:text-primary-500 hover:underline">
                        Sign in
                    </button>
                </p>
            </div>
        </div>
    );
};

export default SignUpPage;