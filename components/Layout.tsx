import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Determine title based on path
    const getPageTitle = () => {
        if (location.pathname === '/profile') return '个人中心';
        if (location.pathname === '/review') return '合同审查（仅供参考）';
        return 'Dashboard';
    };

    const isProfile = location.pathname === '/profile';

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-background-light dark:bg-background-dark">
            <div className="bg-noise"></div>
            
            {/* Header */}
            <header className="flex items-center justify-between whitespace-nowrap glass-panel border-b-0 border-b-glass-border px-6 py-3 shrink-0 z-30 relative">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/review')}>
                    <div className="size-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-glow-primary">
                        <span className="material-symbols-outlined text-white text-xl">gavel</span>
                    </div>
                    <div>
                        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight">
                            {getPageTitle()}
                        </h2>
                    </div>
                </div>
                
                <div className="flex flex-1 justify-end gap-6 items-center">
                    {isProfile ? (
                        <button 
                            onClick={() => navigate('/review')}
                            className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                        >
                            返回工作台
                        </button>
                    ) : (
                        <div className="hidden md:flex gap-2">
                             <button 
                                onClick={() => navigate('/profile')}
                                className="flex items-center justify-center overflow-hidden rounded-full h-9 w-9 hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-all border border-transparent hover:border-glass-border"
                                title="设置"
                            >
                                <span className="material-symbols-outlined">settings</span>
                            </button>
                            <button className="flex items-center justify-center overflow-hidden rounded-full h-9 w-9 hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-all border border-transparent hover:border-glass-border">
                                <span className="material-symbols-outlined">notifications</span>
                            </button>
                        </div>
                    )}

                    <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 mx-2"></div>
                    
                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/profile')}>
                        <div className="text-right hidden sm:block group-hover:opacity-80 transition-opacity">
                            <p className="text-xs font-bold text-slate-900 dark:text-white font-serif tracking-wide">Sarah Jenkins</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">高级法律顾问</p>
                        </div>
                        <div className="relative">
                            <div className="bg-center bg-no-repeat bg-cover rounded-full size-9 ring-2 ring-slate-200 dark:ring-white/10 shadow-lg" 
                                style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD27DqlS6gQSAZbVQMLjq_EGNkl8kaAxbfUGr3SQ28wkzZn7KnXiw7J8B_QQVPcOzIUVT6-1rXZ6TtMDXneDFA6fT8zI5-NpOaHph3DzvvL3gSojFYYowich52DECD6CJeSa0DIxn-YnOsohTHY9QDA9su4IkqHcU9UfOTewNtgPRp0lGbHnxbTq1dvNElUa1wrYA1FS3oetoEZcql_sRXWsZIQL1bKyI9sYzVjgJoWu-MFZfWWeVkb7hfwzlrmLdbRg91Y_mwfplg")'}}></div>
                            {!isProfile && (
                                <div className="absolute bottom-0 right-0 size-2.5 bg-blue-500 border-2 border-white dark:border-background-dark rounded-full shadow-glow-primary"></div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 h-full overflow-hidden relative z-10">
                {isProfile && (
                    <aside className="w-64 flex flex-col glass-panel border-r-0 border-r-glass-border z-20 shrink-0 h-full py-6">
                        <nav className="flex-1 space-y-1 px-3">
                            <NavItem icon="person" label="个人资料" active />
                            <NavItem icon="lock" label="账户安全" />
                            <NavItem icon="notifications" label="通知设置" />
                            <NavItem icon="credit_card" label="账单与订阅" />
                            <div className="my-4 h-px bg-white/5 mx-3"></div>
                            <NavItem icon="help" label="帮助中心" />
                        </nav>
                        <div className="px-6 py-4">
                            <button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors py-2 border border-red-500/20 rounded-lg hover:bg-red-500/10 hover:border-red-500/30">
                                <span className="material-symbols-outlined text-lg">logout</span>
                                退出登录
                            </button>
                        </div>
                    </aside>
                )}
                
                {children}
            </div>
        </div>
    );
};

const NavItem: React.FC<{ icon: string; label: string; active?: boolean }> = ({ icon, label, active }) => (
    <a href="#" className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
        active 
        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-glow-primary' 
        : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
    }`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
        {label}
    </a>
);

export default Layout;