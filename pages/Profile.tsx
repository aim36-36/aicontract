import React, { useState, useRef, useEffect } from 'react';

// Default initial state
const INITIAL_PROFILE = {
    name: "Sarah Jenkins",
    role: "高级法律顾问",
    email: "sarah.jenkins@elitelegal.ai",
    bio: "拥有10年以上的企业法务经验，专注于知识产权和合同法。",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD27DqlS6gQSAZbVQMLjq_EGNkl8kaAxbfUGr3SQ28wkzZn7KnXiw7J8B_QQVPcOzIUVT6-1rXZ6TtMDXneDFA6fT8zI5-NpOaHph3DzvvL3gSojFYYowich52DECD6CJeSa0DIxn-YnOsohTHY9QDA9su4IkqHcU9UfOTewNtgPRp0lGbHnxbTq1dvNElUa1wrYA1FS3oetoEZcql_sRXWsZIQL1bKyI9sYzVjgJoWu-MFZfWWeVkb7hfwzlrmLdbRg91Y_mwfplg"
};

const DEFAULT_AVATAR = "https://lh3.googleusercontent.com/aida-public/AB6AXuB9bjfz0q134AbLljZ6FeNAOz-hLbO1t_MgZHAWe8MMJVy-REG42d7r3xNzCRyQD18DRaWsSQuM_sfHsAw4uV2K9OMDFMXgpwTc90bYOfRA_hOlTbDHV6BwLqLtI2j5CKHvEtfXEVgcjCPNWLaoPD_yG-Kbaf1BwDnGOhr4htAnrS03GNj7EGaorxggJTX9qHrGtqdbou4AGcQs1pvOiH_Kfj-y5MUZPTniA-mBMQlXLCnCcacOTQnYTQubdTwI5-N1jcZgaczOQ5U"; // Fallback/Noise pattern for now or generic avatar

type ThemeMode = 'light' | 'dark' | 'system';

const Profile: React.FC = () => {
    // State
    const [profile, setProfile] = useState(INITIAL_PROFILE);
    const [theme, setTheme] = useState<ThemeMode>('dark');
    const [language, setLanguage] = useState('zh-CN');
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize theme based on HTML class
    useEffect(() => {
        if (document.documentElement.classList.contains('dark')) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }, []);

    // Theme Switch Logic
    const handleThemeChange = (mode: ThemeMode) => {
        setTheme(mode);
        const root = document.documentElement;

        if (mode === 'dark') {
            root.classList.add('dark');
        } else if (mode === 'light') {
            root.classList.remove('dark');
        } else {
            // System
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        }
        showToast(`主题已切换为: ${mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '跟随系统'}`);
    };

    // Form Handlers
    const handleChange = (field: keyof typeof profile, value: string) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    // Avatar Handlers
    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile(prev => ({ ...prev, avatar: reader.result as string }));
                showToast("头像已更新");
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveAvatar = () => {
        setProfile(prev => ({ ...prev, avatar: DEFAULT_AVATAR })); // In real app, maybe set to a generic placeholder URL
        showToast("已移除自定义头像", 'success');
    };

    // Action Handlers
    // Load Profile
    useEffect(() => {
        fetch('/api/profile')
            .then(res => res.json())
            .then(data => {
                // Map backend fields to frontend state if needed
                // Backend returns full profile. Adjust state to match if keys differ.
                // My API mimics the structure mostly, but database has snake_case.
                if (data.full_name) {
                    setProfile({
                        name: data.full_name || "",
                        role: data.role || "高级法律顾问", // Role might not be in DB yet, fallback
                        email: data.username || "", // API used email as username
                        bio: data.bio || "拥有10年以上的企业法务经验，专注于知识产权和合同法。", // Bio fallback
                        avatar: data.avatar_url || DEFAULT_AVATAR
                    });
                } else {
                    // If it returned the default JSON from my API fallback, keys match usage
                    setProfile(data);
                }
            })
            .catch(err => console.error("Failed to load profile", err));
    }, []);

    // Action Handlers
    const handleSave = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: profile.name,
                    role: profile.role,
                    email: profile.email,
                    bio: profile.bio,
                    avatar: profile.avatar
                })
            });
            if (!response.ok) throw new Error("Save failed");

            showToast("个人资料已保存", 'success');
        } catch (e) {
            console.error(e);
            showToast("保存失败", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setProfile(INITIAL_PROFILE);
        showToast("已重置更改", 'error'); // Using 'error' style for cancellation just for visual distinction
    };

    // Toast Logic
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    return (
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-100/50 dark:bg-[#05080f] relative p-8 md:p-12 transition-colors duration-500">
            {/* Toast Notification */}
            <div className={`fixed top-24 right-10 z-50 transition-all duration-500 transform ${toast.show ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0 pointer-events-none'}`}>
                <div className="glass-panel bg-slate-900/90 border border-blue-500/30 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 backdrop-blur-xl">
                    <div className={`p-2 rounded-full shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-slate-500'}`}>
                        <span className="material-symbols-outlined text-white text-xl">{toast.type === 'success' ? 'check' : 'refresh'}</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">{toast.type === 'success' ? '成功' : '操作提示'}</h4>
                        <p className="text-xs text-slate-300 mt-0.5">{toast.message}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-serif tracking-wide mb-2">个人资料管理</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">管理您的个人信息及系统显示偏好。</p>
                </div>

                <div className="space-y-8">
                    {/* Avatar Section */}
                    <div className="glass-panel rounded-xl p-8 border border-white/5 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                            <div className="relative group/avatar cursor-pointer" onClick={handleAvatarClick}>
                                <div className="size-32 rounded-full bg-cover bg-center border-4 border-slate-200 dark:border-white/10 shadow-2xl group-hover/avatar:border-blue-500/50 transition-all duration-300" style={{ backgroundImage: `url("${profile.avatar}")` }}></div>
                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all backdrop-blur-[2px]">
                                    <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-full shadow-lg border-4 border-[#0f172a]">
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                </div>
                            </div>
                            <div className="text-center md:text-left flex-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">更换头像</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 max-w-sm">支持 JPG, PNG 或 GIF 格式。最大文件大小 5MB。</p>
                                <div className="flex items-center justify-center md:justify-start gap-3">
                                    <button
                                        onClick={handleAvatarClick}
                                        className="px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white text-sm font-medium rounded-lg transition-colors border border-transparent"
                                    >
                                        上传新图片
                                    </button>
                                    <button
                                        onClick={handleRemoveAvatar}
                                        className="px-4 py-2 text-red-500 hover:text-red-400 text-sm font-medium rounded-lg transition-colors"
                                    >
                                        移除
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="glass-panel rounded-xl p-8 border border-white/5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500">badge</span>
                            基本信息
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">全名</label>
                                <div className="relative group">
                                    <input
                                        value={profile.name}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                                        type="text"
                                    />
                                    <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 text-lg group-hover:text-blue-500 transition-colors pointer-events-none">edit</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">职位</label>
                                <div className="relative group">
                                    <input
                                        value={profile.role}
                                        onChange={(e) => handleChange('role', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                                        type="text"
                                    />
                                    <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 text-lg group-hover:text-blue-500 transition-colors pointer-events-none">work</span>
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">电子邮箱</label>
                                <div className="relative group">
                                    <input
                                        value={profile.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                                        type="email"
                                    />
                                    <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 text-lg group-hover:text-blue-500 transition-colors pointer-events-none">mail</span>
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">个人简介</label>
                                <textarea
                                    value={profile.bio}
                                    onChange={(e) => handleChange('bio', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 resize-none"
                                    rows={3}
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Display Settings */}
                    <div className="glass-panel rounded-xl p-8 border border-white/5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-purple-500">palette</span>
                            显示设置
                        </h3>
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <h4 className="text-sm font-medium text-slate-900 dark:text-white">界面主题</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">选择最适合您工作环境的外观模式。</p>
                            </div>
                            <div className="flex bg-slate-200 dark:bg-white/5 rounded-lg p-1 border border-slate-300 dark:border-white/10">
                                <button
                                    onClick={() => handleThemeChange('light')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${theme === 'light' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-base">light_mode</span>
                                    浅色
                                </button>
                                <button
                                    onClick={() => handleThemeChange('dark')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-700 shadow-sm text-white font-bold' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-base">dark_mode</span>
                                    深色
                                </button>
                                <button
                                    onClick={() => handleThemeChange('system')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${theme === 'system' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-bold' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-base">desktop_windows</span>
                                    跟随系统
                                </button>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-md bg-blue-500/10 text-blue-400">
                                    <span className="material-symbols-outlined text-lg">translate</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">界面语言</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">更改系统显示的语言</p>
                                </div>
                            </div>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="bg-transparent border border-slate-300 dark:border-white/20 rounded-lg text-sm px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-0 focus:border-blue-500 dark:bg-[#0f172a]"
                            >
                                <option value="zh-CN">简体中文 (Chinese)</option>
                                <option value="en-US">English (US)</option>
                            </select>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-4 pt-4">
                        <button
                            onClick={handleCancel}
                            disabled={isLoading}
                            className="px-6 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors text-sm font-medium border border-transparent disabled:opacity-50"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="px-8 py-2.5 rounded-lg btn-shimmer animate-shimmer text-white text-sm font-bold shadow-glow-primary hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all transform hover:-translate-y-0.5 border border-blue-400/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                    保存中...
                                </>
                            ) : (
                                "保存更改"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Profile;