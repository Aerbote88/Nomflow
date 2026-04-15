'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { logger } from '@/lib/logger';
import { GlassCard, Button } from '@/components/ui';
import { StatCard, ProgressBar } from '@/components/Dashboard/Stats';
import { CustomStudyModal } from '@/components/Dashboard/CustomStudyModal';
import { OnboardingModal } from '@/components/Dashboard/OnboardingModal';

interface DashboardStats {
    due_count: number;
    learning_count: number;
    learned_count: number;
    points: number;
    streak: number;
    level: number;
    next_level_xp: number;
    level_progress: number;
    active_source_name?: string;
    active_source_type?: string;
    curriculum_id?: number;
    kieu_id?: number;
    active_text_id?: number;
    active_list_id?: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isStudyModalOpen, setIsStudyModalOpen] = useState(false);
    const [isOnboarding, setIsOnboarding] = useState(false);
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem('username')) {
            window.location.href = '/login';
            return;
        }

        async function fetchStats() {
            try {
                const data = await apiFetch<DashboardStats>('dashboard/stats');
                setStats(data);
                if (!data.active_source_name) setIsOnboarding(true);
            } catch (err) {
                logger.error('Failed to load stats:', err);
                setError('Failed to load dashboard data. Please make sure you are logged in.');
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="w-12 h-12 border-4 border-accent-gold/20 border-t-accent-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <p className="text-text-secondary mb-6">{error || 'Something went wrong.'}</p>
                <Button onClick={() => window.location.href = '/login'}>Go to Login</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center py-4 md:py-8 fade-in-stable">

            {/* Stats Section */}
            <div className="w-full max-w-4xl space-y-3 md:space-y-6">
                {/* Mobile Toggle summary */}
                <div className="md:hidden w-full">
                    {!isStatsExpanded ? (
                        <button
                            onClick={() => setIsStatsExpanded(true)}
                            className="w-full glass-card !p-3 flex justify-between items-center border-accent-primary/20 hover:border-accent-primary/50 transition-colors"
                        >
                            <div className="flex items-center justify-between w-full gap-2 md:gap-3 md:w-auto md:justify-start">
                                <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex flex-col items-center justify-center text-accent-primary border border-accent-gold/20 flex-shrink-0">
                                    <span className="text-[7px] font-black uppercase leading-none mb-0.5 opacity-70">Lvl</span>
                                    <span className="text-sm font-bold leading-none">{stats.level}</span>
                                </div>
                                <div className="flex flex-col items-start translate-y-[1px] flex-1 md:flex-none">
                                    <span className="hidden md:block text-[9px] text-accent-primary uppercase font-black tracking-[0.2em] leading-none mb-2 opacity-80">Quick Stats</span>
                                    <div className="flex items-center justify-around w-full md:justify-start md:gap-4">
                                        <div className="flex flex-col items-center md:items-start">
                                            <span className="text-[7px] text-text-secondary uppercase font-black tracking-widest leading-none mb-1 opacity-60">Studying</span>
                                            <span className="text-xs font-bold text-text-primary capitalize truncate max-w-[80px]">{stats.active_source_name || "Idle"}</span>
                                        </div>
                                        <div className="flex flex-col items-center md:items-start md:border-l md:border-white/10 md:pl-3">
                                            <span className="text-[7px] text-text-secondary uppercase font-black tracking-widest leading-none mb-1 opacity-60">Streak</span>
                                            <span className="text-xs font-bold text-orange-500">🔥 {stats.streak}</span>
                                        </div>
                                        <div className="flex flex-col items-center md:items-start md:border-l md:border-white/10 md:pl-3">
                                            <span className="text-[7px] text-text-secondary uppercase font-black tracking-widest leading-none mb-1 opacity-60">Due</span>
                                            <span className="text-xs font-bold text-pink-500">{stats.due_count}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsStatsExpanded(false)}
                            className="w-full mb-2 flex justify-center items-center py-2 text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] hover:text-accent-primary transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                            </svg>
                            Hide Details
                        </button>
                    )}
                </div>

                <div className={`${isStatsExpanded ? 'flex' : 'hidden'} md:flex flex-col md:flex-row md:flex-wrap md:justify-center gap-2 md:gap-3`}>
                    <div className="grid grid-cols-2 md:flex md:flex-wrap md:justify-center gap-2 md:gap-3 w-full">
                        {/* Level Card */}
                        <GlassCard className="col-span-2 md:flex-[2] md:min-w-[320px] !p-4 md:!p-8 border-accent-primary items-stretch">
                            <div className="flex justify-between items-end mb-4">
                                <div className="flex flex-col">
                                    <span className="text-xs md:text-sm text-text-secondary uppercase tracking-widest font-bold">Level</span>
                                    <span className="text-5xl md:text-6xl font-black leading-none text-text-primary">
                                        {stats.level}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-text-secondary uppercase font-bold tracking-wider">Total XP</span>
                                    <span className="text-2xl md:text-3xl font-bold text-accent-primary">
                                        {stats.points.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <ProgressBar progress={stats.level_progress} />

                            <div className="flex justify-between mt-2">
                                <span className="text-[10px] md:text-xs text-text-secondary font-bold uppercase tracking-tight">Level {stats.level}</span>
                                <span className="text-[10px] md:text-xs text-text-secondary font-bold uppercase tracking-tight">Level {stats.level + 1}</span>
                            </div>
                        </GlassCard>

                        <StatCard label="Streak" value={stats.streak} icon="🔥" colorClass="text-orange-500" />
                        <StatCard label="Due" value={stats.due_count} colorClass="text-pink-500" />
                        <StatCard label="Learning" value={stats.learning_count} colorClass="text-amber-500" />
                        <StatCard label="Learned" value={stats.learned_count} colorClass="text-emerald-500" />

                        {/* Active Source Card */}
                        <GlassCard className="col-span-2 md:flex-1 md:min-w-[240px] flex flex-col items-center justify-center !p-4 md:!p-6">
                            <span className="text-xs md:text-sm text-text-secondary uppercase tracking-widest font-bold mb-2">Studying</span>
                            <div className="text-xl md:text-3xl font-bold text-text-primary text-center font-serif leading-tight">
                                {stats.active_source_name || "None"}
                            </div>
                            {stats.active_source_type && (
                                <div className="mt-2 px-3 py-1 bg-accent-gold/10 text-accent-primary text-[10px] font-black uppercase tracking-widest rounded-full">
                                    {stats.active_source_type}
                                </div>
                            )}
                        </GlassCard>
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full max-w-[200px] md:max-w-sm mx-auto mt-8">
                    <Button
                        size="lg"
                        className="w-full text-xl py-5"
                        onClick={() => window.location.href = '/study?mode=srs'}
                    >
                        Start Session
                    </Button>
                    <Button
                        variant="secondary"
                        className="w-full text-sm py-3"
                        onClick={() => setIsStudyModalOpen(true)}
                    >
                        Custom Study
                    </Button>
                </div>

                {/* Navigation Grid */}
                <div className="grid grid-cols-2 gap-2 md:gap-4 w-full max-w-xl mx-auto mt-6 md:mt-12">
                    <Button
                        variant="secondary"
                        className="flex flex-col py-3 md:py-8 group hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-[background-color,border-color,transform,opacity] duration-300"
                        onClick={() => window.location.href = '/library'}
                    >
                        <span className="font-nom text-2xl md:text-4xl text-accent-primary mb-2 md:mb-3 group-hover:scale-110 transition-transform">經</span>
                        <span className="uppercase tracking-[0.2em] text-[10px] font-black">Library</span>
                    </Button>
                    <Button
                        variant="secondary"
                        className="flex flex-col py-3 md:py-8 group hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all duration-300"
                        onClick={() => window.location.href = '/flashcards'}
                    >
                        <span className="font-nom text-2xl md:text-4xl text-accent-primary mb-2 md:mb-3 group-hover:scale-110 transition-transform">𡨸</span>
                        <span className="uppercase tracking-[0.2em] text-[10px] font-black">My Flashcards</span>
                    </Button>
                    <Button
                        variant="secondary"
                        className="flex flex-col py-3 md:py-8 group hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all duration-300"
                        onClick={() => window.location.href = '/leaderboard'}
                    >
                        <span className="font-nom text-2xl md:text-4xl text-accent-primary mb-2 md:mb-3 group-hover:scale-110 transition-transform">魁</span>
                        <span className="uppercase tracking-[0.2em] text-[10px] font-black">Leaderboard</span>
                    </Button>
                    <Button
                        variant="secondary"
                        className="flex flex-col py-3 md:py-8 group hover:border-accent-primary/50 hover:bg-accent-primary/5 transition-all duration-300"
                        onClick={() => window.location.href = '/settings'}
                    >
                        <span className="font-nom text-2xl md:text-4xl text-accent-primary mb-2 md:mb-3 group-hover:scale-110 transition-transform">格</span>
                        <span className="uppercase tracking-[0.2em] text-[10px] font-black">Settings</span>
                    </Button>
                </div>
            </div>

            <OnboardingModal
                isOpen={isOnboarding}
                curriculumId={stats.curriculum_id}
                kieuId={stats.kieu_id}
                onComplete={() => {
                    setIsOnboarding(false);
                    window.location.reload();
                }}
            />

            <CustomStudyModal
                isOpen={isStudyModalOpen}
                onClose={() => setIsStudyModalOpen(false)}
                initialTextId={stats.active_text_id}
                initialListId={stats.active_list_id}
            />
        </div>
    );
}
