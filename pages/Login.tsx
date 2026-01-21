import React from 'react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const navigate = useNavigate();

    const handleLogin = () => {
        // Simulate login
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
                <div className="hidden lg:flex flex-col justify-center animate-float">
                    <div className="mb-8 relative">
                        <div className="absolute -left-4 -top-4 w-16 h-16 border-t-2 border-l-2 border-cyan-400/30 rounded-tl-3xl"></div>
                        <h1 className="text-6xl font-display font-bold text-white leading-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] tracking-tight">
                            明曰 <br />
                            <span className="gold-accent-text">之法</span>
                        </h1>
                        <div className="absolute -bottom-4 -right-4 w-16 h-16 border-b-2 border-r-2 border-amber-400/30 rounded-br-3xl"></div>
                    </div>
                    <p className="text-lg text-slate-300 font-sans italic mb-8 max-w-md leading-relaxed border-l-2 border-white/10 pl-6 font-light">
                        "法律的生命不在于逻辑，而在于经验 <br />
                        <span className="block mt-2">-奥利弗·温德尔·霍姆斯"</span>
                    </p>
                </div>

                <div className="flex justify-center w-full">
                    <div className="glass-panel w-full max-w-[440px] rounded-2xl p-8 sm:p-10 relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 mb-4 shadow-glow-cyan">
                                <span className="material-symbols-outlined text-cyan-400">smart_toy</span>
                            </div>
                            <h2 className="text-3xl font-sans font-bold text-white mb-2 tracking-wide">欢迎来到 <br />法律的未来</h2>
                            <p className="text-slate-400 text-sm font-sans">登录您的 AI 审计工作空间</p>
                        </div>

                        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                            <div className="space-y-1">
                                <label className="text-xs uppercase tracking-widest text-slate-400 font-bold ml-1 font-sans" htmlFor="email">电子邮箱</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-slate-500 group-focus-within:text-cyan-400 transition-colors text-lg">mail</span>
                                    </div>
                                    <input 
                                        className="w-full bg-[#020617]/60 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm placeholder-slate-600 focus:ring-0 focus:bg-[#020617]/80 focus:border-cyan-400/50 focus:shadow-[0_0_15px_rgba(56,189,248,0.15)] text-white transition-all duration-300" 
                                        id="email" 
                                        placeholder="attorney@firm.com" 
                                        type="email" 
                                        defaultValue="attorney@firm.com"
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
                                        className="w-full bg-[#020617]/60 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm placeholder-slate-600 focus:ring-0 focus:bg-[#020617]/80 focus:border-cyan-400/50 focus:shadow-[0_0_15px_rgba(56,189,248,0.15)] text-white transition-all duration-300" 
                                        id="password" 
                                        placeholder="••••••••" 
                                        type="password" 
                                        defaultValue="password"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer">
                                        <span className="material-symbols-outlined text-slate-500 hover:text-slate-300 text-lg">visibility</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input className="rounded bg-slate-800 border-slate-600 text-cyan-500 focus:ring-0 focus:ring-offset-0 transition-colors" type="checkbox" />
                                    <span className="text-slate-400 group-hover:text-slate-300 transition-colors font-sans">记住设备</span>
                                </label>
                                <a className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium font-sans" href="#">忘记密码？</a>
                            </div>
                            <button 
                                type="submit"
                                className="w-full relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border border-white/20 text-white py-3.5 rounded-lg font-medium text-sm tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg group"
                            >
                                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500"></span>
                                <span className="relative font-sans">验证登录</span>
                            </button>
                            
                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-slate-700"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-500 text-xs uppercase font-sans">或通过以下方式访问</span>
                                <div className="flex-grow border-t border-slate-700"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all rounded-lg py-2.5 text-sm text-slate-300 font-sans" type="button">
                                    <img alt="WeChat" className="w-5 h-5 opacity-90 grayscale brightness-200" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNLm16LLDmbO2Iqx_Aq9kv4DrPN50o_ipCcjWyDGPNhBbs8UNl8EE_FNKO7UjutgdSRyM6T_vyB5wB0d0MMFnOQVt2wM7WlImZG2em0aqrl9G2LsjgAvcn1u5sjkr9ZK5PsccLOGIEr_aKCUo_7f3Xu1VozgH_y_emdQfb4QG7W_9sJ1GdXtnTiB9Pf2GyKWsrpaqd3-8xkQvyU_OCsNsWIXWldJY0gABdi-9D2UWUwbK1S2GLq3BEN3LD6OVqMktc-XgX2i9xnQ0" />
                                    QQ
                                </button>
                                <button className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all rounded-lg py-2.5 text-sm text-slate-300 font-sans" type="button">
                                    <img alt="QQ" className="w-5 h-5 opacity-90 grayscale brightness-200" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVSpMp3HT0SAmV4qOV5pEQJ3XofLfnR0Fhy5KtjZq_W4XDWVlFLuJHhP3BPimkOuP_8_VLJyX3efesP2gqBiJm5UHtHGrFZRdmX6FDnkmMSbWTnCMGm_wIi9mqrieK2uZVfpGH7iSpxnkH2kMa8RNwE7rWwPS1A4FrjYPXCFwpQoesqAvWfM2Zn8Ld-d3hrdNfL9CONBpzkclZmWn0brcdrixFOsZ5UrPzi8_JvMU_G5uZuMlFn1lbkbGkEflBOJNLVeRpuIGw-Xw" />
                                    微信
                                </button>
                            </div>
                        </form>
                        <div className="mt-8 text-center">
                            <p className="text-slate-500 text-xs font-sans">还没有账号？ <button onClick={() => navigate('/register')} className="text-amber-400 hover:text-amber-300 font-bold ml-1 transition-colors">注册账号</button></p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Login;