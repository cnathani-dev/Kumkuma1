import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { inputStyle, primaryButton, secondaryButton } from '../../components/common/styles';
import { Save } from 'lucide-react';

export const ChangePasswordForm = ({ onCancel }: { onCancel: () => void }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { changePassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters long.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await changePassword(oldPassword, newPassword);
            if (result.success) {
                setSuccess(result.message);
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(onCancel, 2000); // Close modal after 2 seconds on success
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium">Old Password</label>
                <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required className={inputStyle} />
            </div>
            <div>
                <label className="block text-sm font-medium">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className={inputStyle} />
            </div>
            <div>
                <label className="block text-sm font-medium">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={inputStyle} />
            </div>
            
            {error && <p className="text-sm text-center text-accent-500">{error}</p>}
            {success && <p className="text-sm text-center text-green-600">{success}</p>}

            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
                <button type="submit" className={primaryButton} disabled={isLoading}>
                    <Save size={18}/> {isLoading ? 'Saving...' : 'Save Password'}
                </button>
            </div>
        </form>
    );
};
