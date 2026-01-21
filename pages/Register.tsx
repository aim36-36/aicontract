import React from 'react';
import { useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
    const navigate = useNavigate();

    const handleRegister = () => {
        // Simulate registration
        navigate('/review');
    };

    return (
        <div className="h-screen w-full flex items-center justify-center relative font-inter overflow-hidden bg-[#020617] text-[#e2e8f0]">
            <div className="starry-bg">
                <div className="swirl swirl-1"></div>
                <div className="swirl swirl-2"></div>
                <div className="swirl swirl-3"></div>
                <div className="swirl swirl-4"></div>
                <div className="particle-container"></div>
            </div>

            <main className="w-full max-w-[1200px] px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
                <div className="hidden lg:flex flex-col justify-center animate-float order-2 lg:order-1">
                    <div className="mb-8 relative">
                        <div className="absolute -left-4 -top-4 w-16 h-16 border-t-2 border-l-2 border-cyan-400/30 rounded-tl-3xl"></div>
                        <h1 className="text-6xl font-display font-bold text-white leading-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] tracking-tight">
                            加入 <br />
                            <span className="gold-accent-text">精英法务</span>
                        </h1>
                        <div className="absolute -bottom-4 -right-4 w-16 h-16 border-b-2 border-r-2 border-amber-400/30 rounded-br-3xl"></div>
                    </div>
                    <p className="text-lg text-slate-300 font-sans italic mb-8 max-w-md leading-relaxed border-l-2 border-white/10 pl-6 font-light">
                        "创新决定了你是领袖还是追随者。 <br />
                        <span className="block mt-2">-史蒂夫·乔布斯"</span>
                    </p>
                </div>

                <div className="flex justify-center w-full order-1 lg:order-2">
                    <div className="glass-panel w-full max-w-[480px] rounded-2xl p-8 sm:p-10 relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                        
                        <div className="text-center mb-6">
                            <h2 className="text-3xl font-sans font-bold text-white mb-2 tracking-wide">创建账户</h2>
                            <p className="text-slate-400 text-sm font-sans">开启您的智能法律审查之旅</p>
                        </div>

                        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs uppercase tracking-widest text-slate-400 font-bold ml-1 font-sans" htmlFor="name">姓名</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="material-symbols-outlined text-slate-500 group-focus-within:text-cyan-400 transition-colors text-lg">person</span>
                                        </div>
                                        <input 
                                            className="w-full bg-[#020617]/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm placeholder-slate-600 focus:ring-0 focus:bg-[#020617]/80 focus:border-cyan-400/50 focus:shadow-[0_0_15px_rgba(56,189,248,0.15)] text-white transition-all duration-300" 
                                            id="name" 
                                            placeholder="John Doe" 
                                            type="text" 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs uppercase tracking-widest text-slate-400 font-bold ml-1 font-sans" htmlFor="role">职位</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="material-symbols-outlined text-slate-500 group-focus-within:text-cyan-400 transition-colors text-lg">badge</span>
                                        </div>
                                        <input 
                                            className="w-full bg-[#020617]/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm placeholder-slate-600 focus:ring-0 focus:bg-[#020617]/80 focus:border-cyan-400/50 focus:shadow-[0_0_15px_rgba(56,189,248,0.15)] text-white transition-all duration-300" 
                                            id="role" 
                                            placeholder="法务顾问" 
                                            type="text" 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs uppercase tracking-widest text-slate-400 font-bold ml-1 font-sans" htmlFor="email">工作邮箱</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-slate-500 group-focus-within:text-cyan-400 transition-colors text-lg">mail</span>
                                    </div>
                                    <input 
                                        className="w-full bg-[#020617]/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm placeholder-slate-600 focus:ring-0 focus:bg-[#020617]/80 focus:border-cyan-400/50 focus:shadow-[0_0_15px_rgba(56,189,248,0.15)] text-white transition-all duration-300" 
                                        id="email" 
                                        placeholder="name@company.com" 
                                        type="email" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs uppercase tracking-widest text-slate-400 font-bold ml-1 font-sans" htmlFor="password">密码</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-slate-500 group-focus-within:text-cyan-400 transition-colors text-lg">lock</span>
                                    </div>
                                    <input 
                                        className="w-full bg-[#020617]/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm placeholder-slate-600 focus:ring-0 focus:bg-[#020617]/80 focus:border-cyan-400/50 focus:shadow-[0_0_15px_rgba(56,189,248,0.15)] text-white transition-all duration-300" 
                                        id="password" 
                                        placeholder="••••••••" 
                                        type="password" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs uppercase tracking-widest text-slate-400 font-bold ml-1 font-sans" htmlFor="confirmPassword">确认密码</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-slate-500 group-focus-within:text-cyan-400 transition-colors text-lg">verified_user</span>
                                    </div>
                                    <input 
                                        className="w-full bg-[#020617]/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm placeholder-slate-600 focus:ring-0 focus:bg-[#020617]/80 focus:border-cyan-400/50 focus:shadow-[0_0_15px_rgba(56,189,248,0.15)] text-white transition-all duration-300" 
                                        id="confirmPassword" 
                                        placeholder="••••••••" 
                                        type="password" 
                                    />
                                </div>
                            </div>

                            <div className="flex items-start gap-2 text-xs text-slate-400 py-1">
                                <input type="checkbox" className="mt-0.5 rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-0 focus:ring-offset-0" id="terms" />
                                <label htmlFor="terms" className="leading-tight cursor-pointer hover:text-slate-300">
                                    我已阅读并同意 <a href="#" className="text-cyan-400 hover:text-cyan-300 underline">服务条款</a> 和 <a href="#" className="text-cyan-400 hover:text-cyan-300 underline">隐私政策</a>
                                </label>
                            </div>

                            <button 
                                type="submit"
                                className="w-full relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border border-white/20 text-white py-3 rounded-lg font-medium text-sm tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg group shadow-glow-primary"
                            >
                                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500"></span>
                                <span className="relative font-sans flex items-center justify-center gap-2">
                                    立即注册
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </span>
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-slate-500 text-xs font-sans">已有账号？ <button onClick={() => navigate('/')} className="text-amber-400 hover:text-amber-300 font-bold ml-1 transition-colors">立即登录</button></p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Register;