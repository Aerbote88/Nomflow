'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GlassCard, Button, Portal } from '@/components/ui';

interface User {
    id: number;
    username: string;
    email: string | null;
    hide_from_leaderboard: boolean;
}

interface Settings {
    daily_new_limit: number;
    active_text_id: number | null;
    active_list_id: number | null;
}

interface SourceText {
    id: number;
    title: string;
}

interface StudyList {
    id: number;
    name: string;
}

export default function SettingsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [texts, setTexts] = useState<SourceText[]>([]);
    const [lists, setLists] = useState<StudyList[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [email, setEmail] = useState('');
    const [hideFromLeaderboard, setHideFromLeaderboard] = useState(false);
    const [sourceType, setSourceType] = useState<'text' | 'list'>('text');
    const [activeTextId, setActiveTextId] = useState<number | null>(null);
    const [activeListId, setActiveListId] = useState<number | null>(null);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // UI states
    const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');
    const [emailConfirmOpen, setEmailConfirmOpen] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [userData, settingsData, textsData, listsData] = await Promise.all([
                    apiFetch<User>('user/me'),
                    apiFetch<Settings>('settings'),
                    apiFetch<SourceText[]>('texts'),
                    apiFetch<StudyList[]>('lists')
                ]);

                setUser(userData);
                setSettings(settingsData);
                setTexts(textsData);
                setLists(listsData);

                setEmail(userData.email || '');
                setHideFromLeaderboard(userData.hide_from_leaderboard ?? false);
                if (settingsData.active_list_id) {
                    setSourceType('list');
                    setActiveListId(settingsData.active_list_id);
                } else {
                    setSourceType('text');
                    setActiveTextId(settingsData.active_text_id);
                }
            } catch (err) {
                console.error('Failed to load settings:', err);
                setError('Failed to load settings data.');
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const showMessage = (type: 'success' | 'error', message: string) => {
        setSaveStatus({ type, message });
        setTimeout(() => setSaveStatus(null), 3000);
    };

    const handleSaveProfile = async () => {
        if ((email || null) !== (user?.email || null)) {
            setEmailConfirmOpen(true);
            return;
        }
        await saveProfile();
    };

    const saveProfile = async () => {
        try {
            await apiFetch('user/settings', {
                method: 'POST',
                body: JSON.stringify({ email: email || null, hide_from_leaderboard: hideFromLeaderboard })
            });
            if (user) setUser({ ...user, email: email || null });
            showMessage('success', 'Profile updated!');
        } catch (err: any) {
            showMessage('error', err.message || 'Failed to update profile.');
        }
    };

    const handleSaveStudyConfig = async () => {
        try {
            await apiFetch('settings', {
                method: 'POST',
                body: JSON.stringify({
                    daily_new_limit: settings?.daily_new_limit || 10,
                    active_text_id: sourceType === 'text' ? activeTextId : null,
                    active_list_id: sourceType === 'list' ? activeListId : null
                })
            });
            showMessage('success', 'Study settings saved!');
        } catch (err) {
            showMessage('error', 'Failed to save study settings.');
        }
    };

    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword) {
            showMessage('error', 'Please fill in both password fields.');
            return;
        }

        try {
            await apiFetch('user/password', {
                method: 'POST',
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
            });
            showMessage('success', 'Password changed successfully!');
            setOldPassword('');
            setNewPassword('');
        } catch (err: any) {
            showMessage('error', err.message || 'Failed to change password.');
        }
    };

    const handleResetProgress = async () => {
        try {
            await apiFetch('settings/reset', { method: 'POST' });
            window.location.reload();
        } catch (err) {
            showMessage('error', 'Failed to reset progress.');
            setResetModalOpen(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteInput !== 'DELETE') return;

        try {
            await apiFetch('user', { method: 'DELETE' });
            window.location.href = '/register';
        } catch (err) {
            showMessage('error', 'Failed to delete account.');
            setDeleteModalOpen(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <p className="text-text-secondary mb-6">{error}</p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center py-4 md:py-8 px-4 max-w-2xl mx-auto fade-in-stable">
            <header className="text-center mb-6 md:mb-12">
                <h1 className="text-2xl md:text-4xl font-bold font-display text-text-primary mb-0">Settings</h1>
            </header>

            {saveStatus && (
                <div className={`fixed top-24 right-8 z-50 px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 font-bold uppercase tracking-widest text-xs
                    ${saveStatus.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                    {saveStatus.message}
                </div>
            )}

            <div className="w-full space-y-8">
                {/* Profile Section */}
                <GlassCard>
                    <h3 className="text-xl font-bold text-accent-primary font-display mb-2 uppercase tracking-tight">Public Profile</h3>
                    <p className="text-xs text-text-secondary mb-6 leading-relaxed">Manage your account and leaderboard visibility.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">
                                Email <span className="text-text-secondary/40 normal-case font-normal tracking-normal text-xs">(used for password reset)</span>
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-text-primary focus:border-accent-primary outline-none transition-colors"
                                placeholder="you@example.com"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setHideFromLeaderboard(prev => !prev)}
                            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-accent-primary/30 transition-all group"
                        >
                            <div className="text-left">
                                <div className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">Hide from Leaderboards</div>
                                <div className="text-[10px] text-text-secondary/50 uppercase font-black tracking-widest mt-0.5">Your name won't appear in any rankings</div>
                            </div>
                            <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-4 relative ${hideFromLeaderboard ? 'bg-accent-primary' : 'bg-white/10'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hideFromLeaderboard ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                        </button>
                        <Button className="w-full" onClick={handleSaveProfile}>Save Profile</Button>
                    </div>
                </GlassCard>

                {/* Study Config Section */}
                <GlassCard>
                    <h3 className="text-xl font-bold text-accent-primary font-display mb-2 uppercase tracking-tight">Study Configuration</h3>
                    <p className="text-xs text-text-secondary mb-6 leading-relaxed">Choose your current focus area.</p>

                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors duration-200
                                ${sourceType === 'text' ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' : 'bg-white/5 border-transparent text-text-secondary hover:bg-white/10'}`}>
                                <input type="radio" className="hidden" name="source" checked={sourceType === 'text'} onChange={() => setSourceType('text')} />
                                <span className="font-bold uppercase tracking-widest text-[10px]">Text / Book</span>
                            </label>
                            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors duration-200
                                ${sourceType === 'list' ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' : 'bg-white/5 border-transparent text-text-secondary hover:bg-white/10'}`}>
                                <input type="radio" className="hidden" name="source" checked={sourceType === 'list'} onChange={() => setSourceType('list')} />
                                <span className="font-bold uppercase tracking-widest text-[10px]">Custom List</span>
                            </label>
                        </div>

                        {sourceType === 'text' ? (
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Active Text</label>
                                <select
                                    value={activeTextId || ''}
                                    onChange={(e) => setActiveTextId(Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:border-accent-primary/50 outline-none transition-colors appearance-none"
                                >
                                    <option value="" disabled className="bg-bg-primary">Select a text...</option>
                                    {texts.map(t => <option key={t.id} value={t.id} className="bg-bg-primary">{t.title}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Active List</label>
                                <select
                                    value={activeListId || ''}
                                    onChange={(e) => setActiveListId(Number(e.target.value))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:border-accent-primary/50 outline-none transition-colors appearance-none"
                                >
                                    <option value="" disabled className="bg-bg-primary">Select a list...</option>
                                    {lists.map(l => <option key={l.id} value={l.id} className="bg-bg-primary">{l.name}</option>)}
                                </select>
                            </div>
                        )}

                        <Button className="w-full" onClick={handleSaveStudyConfig}>Save Study Configuration</Button>
                    </div>
                </GlassCard>

                {/* Security Section */}
                <GlassCard>
                    <h3 className="text-xl font-bold text-accent-primary font-display mb-2 uppercase tracking-tight">Security</h3>
                    <p className="text-xs text-text-secondary mb-6 leading-relaxed">Manage your account protection.</p>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Current Password</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:border-accent-primary/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:border-accent-primary/50 outline-none"
                                />
                            </div>
                        </div>
                        <Button variant="secondary" className="w-full" onClick={handleChangePassword}>Update Password</Button>
                    </div>
                </GlassCard>

                {/* Danger Zone */}
                <GlassCard className="border-red-500/30">
                    <h3 className="text-xl font-bold text-red-500 font-display mb-2 uppercase tracking-tight">Danger Zone</h3>
                    <p className="text-xs text-text-secondary mb-6 leading-relaxed">Irreversible account actions.</p>

                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <Button variant="outline" className="flex-1 !border-red-500/50 !text-red-500 bg-red-500/5 hover:bg-red-500/10" onClick={() => setResetModalOpen(true)}>Reset Progress</Button>
                            <Button variant="outline" className="flex-1 !border-red-600 !text-red-600 hover:bg-red-600/5" onClick={() => setDeleteModalOpen(true)}>Delete Account</Button>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Reset Modal */}
            {resetModalOpen && (
                <Portal>
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                        <GlassCard className="max-w-md border-red-500 shadow-2xl">
                            <h3 className="text-2xl font-bold text-red-500 font-display mb-4">Confirm Reset</h3>
                            <p className="text-sm text-text-secondary mb-8 leading-relaxed">
                                This will completely wipe your study records and set all characters back to "New". This action cannot be undone.
                            </p>
                            <div className="flex gap-4">
                                <Button variant="ghost" className="flex-1" onClick={() => setResetModalOpen(false)}>Cancel</Button>
                                <Button className="flex-1 bg-red-600 hover:bg-red-500" onClick={handleResetProgress}>Reset Everything</Button>
                            </div>
                        </GlassCard>
                    </div>
                </Portal>
            )}

            {/* Delete Modal */}
            {deleteModalOpen && (
                <Portal>
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                        <GlassCard className="max-w-md border-red-700 shadow-2xl">
                            <h3 className="text-2xl font-bold text-red-600 font-display mb-2">Delete Account</h3>
                            <p className="text-sm text-text-secondary mb-6">Type <span className="text-text-primary font-black uppercase">DELETE</span> to confirm.</p>

                            <input
                                type="text"
                                value={deleteInput}
                                onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
                                className="w-full bg-white/5 border border-red-500/30 rounded-xl px-4 py-4 text-center text-xl font-black text-red-500 mb-8 outline-none focus:border-red-500"
                                placeholder="Type here..."
                            />

                            <div className="flex gap-4">
                                <Button variant="ghost" className="flex-1" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
                                <Button className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-20" disabled={deleteInput !== 'DELETE'} onClick={handleDeleteAccount}>Permanently Delete</Button>
                            </div>
                        </GlassCard>
                    </div>
                </Portal>
            )}

            {/* Email Change Confirmation Modal */}
            {emailConfirmOpen && (
                <Portal>
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                        <GlassCard className="max-w-md border-accent-primary/30 shadow-2xl">
                            <h3 className="text-2xl font-bold text-text-primary font-display mb-2">Update Email?</h3>
                            <p className="text-sm text-text-secondary mb-2 leading-relaxed">
                                Your email will be changed to:
                            </p>
                            <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/10 mb-6 text-center font-bold text-text-primary">
                                {email || <span className="text-text-secondary italic font-normal">None</span>}
                            </div>
                            <div className="flex gap-4">
                                <Button variant="ghost" className="flex-1" onClick={() => setEmailConfirmOpen(false)}>Cancel</Button>
                                <Button className="flex-1" onClick={async () => { setEmailConfirmOpen(false); await saveProfile(); }}>Confirm</Button>
                            </div>
                        </GlassCard>
                    </div>
                </Portal>
            )}
        </div>
    );
}
