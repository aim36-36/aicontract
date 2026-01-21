import React, { useState, useRef, useCallback, useMemo } from 'react';

interface DocumentItem {
    id: string;
    name: string;
    status: 'ready' | 'scanned';
    content?: string;
    analysis?: {
        language: string;
        charCount: number;
        estimatedTokens: number;
        chunkCount: number;
        avgChunkTokens: number;
    };
}

interface Risk {
    level: 'high' | 'medium' | 'low';
    title: string;
    clause: string;
    description: string;
    category?: string;
    recommendation?: string;
    legalBasis?: string;
}

interface DimensionScore {
    dimension: string;
    score: number;
    findings?: string[];
    recommendations?: string[];
}

interface MissingItem {
    item: string;
    whyImportant?: string;
    suggestion?: string;
}

interface ComplianceItem {
    topic: string;
    status: 'ok' | 'risk' | 'missing' | 'na';
    notes?: string;
}

interface ContractProfile {
    contractType?: string;
    parties?: string[];
    term?: string;
    subjectMatter?: string;
    payment?: string;
    deliveryAndAcceptance?: string;
    disputeResolution?: string;
}

interface Annotation {
    id: string;
    clause: string;
    risk: Risk;
    position: number; // 在文档中的位置
}

const ContractReview: React.FC = () => {
    // State Management
    const [zoom, setZoom] = useState(100);
    const [isScanning, setIsScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('info');
    const [risks, setRisks] = useState<Risk[]>([]);
    const [score, setScore] = useState<number>(0);
    const [summary, setSummary] = useState<string>("");
    const [highlightedText, setHighlightedText] = useState<string | null>(null);
    const [signRecommendation, setSignRecommendation] = useState<string>("");
    const [riskLevel, setRiskLevel] = useState<string>("");
    const [riskCategories, setRiskCategories] = useState<Record<string, string[]>>({});
    const [overallSuggestions, setOverallSuggestions] = useState<string[]>([]);
    const [dimensionScores, setDimensionScores] = useState<DimensionScore[]>([]);
    const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
    const [complianceChecklist, setComplianceChecklist] = useState<ComplianceItem[]>([]);
    const [keyFactsToConfirm, setKeyFactsToConfirm] = useState<string[]>([]);
    const [nextSteps, setNextSteps] = useState<string[]>([]);
    const [contractProfile, setContractProfile] = useState<ContractProfile | null>(null);

    // 批注状态
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [showAnnotations, setShowAnnotations] = useState(true);

    // 进度状态
    const [analysisProgress, setAnalysisProgress] = useState({
        stage: '',
        progress: 0,
        message: ''
    });

    // Document List State
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

    // AI 助手状态
    const [showAiAssistant, setShowAiAssistant] = useState(false);
    const [aiActionResult, setAiActionResult] = useState<string | null>(null);
    const [aiActionLoading, setAiActionLoading] = useState(false);
    const [ragQuestion, setRagQuestion] = useState('');

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const documentContainerRef = useRef<HTMLDivElement>(null);

    // Handlers
    const handleZoom = (delta: number) => {
        setZoom(prev => Math.min(Math.max(prev + delta, 50), 200));
    };

    const triggerToast = useCallback((msg: string, type: 'success' | 'info' | 'error' = 'info') => {
        setToastMessage(msg);
        setToastType(type);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }, []);

    /**
     * AI 分析（使用同步 API）
     */
    const handleStartReview = async () => {
        if (isScanning || scanComplete) return;
        const currentDoc = documents.find(d => d.id === selectedDocId);
        if (!currentDoc || !currentDoc.content) {
            triggerToast("无法获取文档内容", 'error');
            return;
        }

        setIsScanning(true);
        setAnalysisProgress({ stage: 'analyzing', progress: 10, message: '正在启动AI分析...' });

        // 模拟进度
        const progressInterval = setInterval(() => {
            setAnalysisProgress(prev => {
                if (prev.progress >= 85) {
                    return { ...prev, progress: 85, message: '等待AI响应...' };
                }
                return {
                    ...prev,
                    progress: prev.progress + Math.random() * 8,
                    message: prev.progress < 30 ? '正在分块处理...' :
                             prev.progress < 60 ? '正在AI分析...' : '正在整合结果...'
                };
            });
        }, 800);

        try {
            const response = await fetch(`/api/documents/analyze-sync/${selectedDocId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: currentDoc.content,
                    document_id: selectedDocId
                })
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "分析请求失败");
            }

            const data = await response.json();
            
            setAnalysisProgress({ stage: 'complete', progress: 100, message: '分析完成' });
            
            // 处理结果
            const risksData = Array.isArray(data.risks) ? data.risks : [];
            
            // 确保风险数据格式正确
            const normalizedRisks = risksData.map((r: any) => ({
                level: ['high', 'medium', 'low'].includes(r.level) ? r.level : 'low',
                title: r.title || '未命名风险',
                clause: r.clause || '',
                description: r.description || '',
                recommendation: r.recommendation || '',
                legalBasis: r.legalBasis || '',
                category: r.category || '其他'
            })).filter(r => r.title && r.title !== '未命名风险'); // 过滤无效风险
            
            console.log(`[Frontend] Received ${normalizedRisks.length} risks from backend`);
            
            setRisks(normalizedRisks);
            setScore(data.score || 0);
            setSummary(data.summary || "");
            setSignRecommendation(data.signRecommendation || "");
            setRiskLevel(data.riskLevel || "");
            setRiskCategories(data.riskCategories || {});
            setOverallSuggestions(Array.isArray(data.overallSuggestions) ? data.overallSuggestions : []);
            setDimensionScores(Array.isArray(data.dimensionScores) ? data.dimensionScores : []);
            setMissingItems(Array.isArray(data.missingItems) ? data.missingItems : []);
            setComplianceChecklist(Array.isArray(data.complianceChecklist) ? data.complianceChecklist : []);
            setKeyFactsToConfirm(Array.isArray(data.keyFactsToConfirm) ? data.keyFactsToConfirm : []);
            setNextSteps(Array.isArray(data.nextSteps) ? data.nextSteps : []);
            setContractProfile(data.contractProfile || null);
            setScanComplete(true);
            setDocuments(prev => prev.map(doc => 
                doc.id === selectedDocId ? { ...doc, status: 'scanned' } : doc
            ));

            // 自动生成批注
            generateAnnotations(normalizedRisks, currentDoc.content);

            triggerToast(`审查完成：发现 ${normalizedRisks.length} 个风险点`, 'success');

        } catch (e: any) {
            clearInterval(progressInterval);
            console.error(e);
            triggerToast(e.message || "AI 审查服务繁忙，请稍后重试", 'error');
            setAnalysisProgress({ stage: 'error', progress: 0, message: '分析失败' });
        } finally {
            setIsScanning(false);
        }
    };

    /**
     * 根据风险生成批注
     */
    const generateAnnotations = (risksData: Risk[], content: string) => {
        const newAnnotations: Annotation[] = [];
        
        risksData.forEach((risk, index) => {
            if (risk.clause && content.includes(risk.clause)) {
                const position = content.indexOf(risk.clause);
                newAnnotations.push({
                    id: `ann-${index}`,
                    clause: risk.clause,
                    risk: risk,
                    position: position
                });
            }
        });

        // 按位置排序
        newAnnotations.sort((a, b) => a.position - b.position);
        setAnnotations(newAnnotations);
    };

    const handleFileUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('file', file);

            try {
                triggerToast("正在上传...", 'info');
                const response = await fetch('/api/documents/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error("Upload failed");
                const data = await response.json();

                const newDoc: DocumentItem = {
                    id: data.id,
                    name: data.name,
                    status: 'ready',
                    content: data.content,
                    analysis: data.analysis
                };
                setDocuments(prev => [...prev, newDoc]);
                setSelectedDocId(newDoc.id);
                setScanComplete(false);
                setRisks([]);
                setScore(0);
                setSummary("");
                setAnnotations([]);
                setRiskLevel("");
                setRiskCategories({});
                setOverallSuggestions([]);
                setDimensionScores([]);
                setMissingItems([]);
                setComplianceChecklist([]);
                setKeyFactsToConfirm([]);
                setNextSteps([]);
                setContractProfile(null);
                
                if (data.analysis) {
                    triggerToast(`已加载: ${data.name} (${data.analysis.charCount} 字符)`, 'success');
                } else {
                    triggerToast(`已加载文件: ${data.name}`, 'success');
                }
            } catch (error) {
                console.error(error);
                triggerToast("文件上传失败", 'error');
            }
        }
    };

    const handleRemoveDocument = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDocuments(prev => prev.filter(doc => doc.id !== id));
        if (selectedDocId === id) {
            setSelectedDocId(null);
            setScanComplete(false);
            setRisks([]);
            setAnnotations([]);
            setScore(0);
            setSummary("");
            setSignRecommendation("");
            setRiskLevel("");
            setRiskCategories({});
            setOverallSuggestions([]);
            setDimensionScores([]);
            setMissingItems([]);
            setComplianceChecklist([]);
            setKeyFactsToConfirm([]);
            setNextSteps([]);
            setContractProfile(null);
        }
        triggerToast("文档已移除", 'info');
    };

    /**
     * AI 助手功能
     */
    const handleAiAction = async (action: string) => {
        const currentDoc = documents.find(d => d.id === selectedDocId);
        if (!currentDoc || !currentDoc.content) {
            triggerToast("请先选择文档", 'error');
            return;
        }

        setAiActionLoading(true);
        setAiActionResult(null);

        try {
            const response = await fetch('/api/documents/assist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: currentDoc.content.substring(0, 6000),
                    action
                })
            });
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "请求失败");
            }
            
            const data = await response.json();
            setAiActionResult(data.result);
            triggerToast("AI 回复已生成", 'success');
        } catch (e: any) {
            console.error(e);
            triggerToast(e.message || "AI 请求失败，请重试", 'error');
        } finally {
            setAiActionLoading(false);
        }
    };

    const handleRagQuery = async () => {
        if (!ragQuestion.trim()) {
            triggerToast("请输入问题", 'error');
            return;
        }
        
        const currentDoc = documents.find(d => d.id === selectedDocId);
        if (!currentDoc?.content) {
            triggerToast("请先选择文档", 'error');
            return;
        }

        setAiActionLoading(true);
        setAiActionResult(null);

        try {
            const response = await fetch('/api/documents/assist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `基于以下合同内容回答问题。\n\n合同内容：\n${currentDoc.content.substring(0, 5000)}\n\n问题：${ragQuestion}`,
                    action: 'summary'
                })
            });
            
            if (!response.ok) throw new Error("查询失败");
            
            const data = await response.json();
            setAiActionResult(data.result);
            setRagQuestion('');
            triggerToast("已获取答案", 'success');
        } catch (e) {
            console.error(e);
            triggerToast("查询失败，请重试", 'error');
        } finally {
            setAiActionLoading(false);
        }
    };

    /**
     * 导出带批注的文档
     */
    const handleExport = async (type: 'clean' | 'annotated') => {
        const currentDoc = documents.find(d => d.id === selectedDocId);
        if (!currentDoc || !currentDoc.content) {
            triggerToast("请先选择文档", 'error');
            return;
        }

        try {
            if (type === 'annotated' && scanComplete) {
                // 调用后端生成 DOCX
                triggerToast("正在生成批注版文档...", 'info');
                
                const response = await fetch('/api/documents/export-docx', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: currentDoc.content,
                        annotations: annotations,
                        risks: risks,
                        score: score,
                        summary: summary,
                        riskLevel: riskLevel,
                        contractProfile: contractProfile,
                        riskCategories: riskCategories,
                        dimensionScores: dimensionScores,
                        missingItems: missingItems,
                        complianceChecklist: complianceChecklist,
                        overallSuggestions: overallSuggestions,
                        keyFactsToConfirm: keyFactsToConfirm,
                        nextSteps: nextSteps,
                        signRecommendation: signRecommendation,
                        fileName: currentDoc.name
                    })
                });

                if (!response.ok) throw new Error("导出失败");

                const data = await response.json();
                
                // 创建并下载文件
                const blob = new Blob([data.content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${data.fileName}_批注版.docx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                triggerToast("批注版 DOCX 导出成功！", 'success');
            } else {
                // 导出原文
                const blob = new Blob([currentDoc.content], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentDoc.name}_原文.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                triggerToast("原文导出成功！", 'success');
            }
        } catch (e: any) {
            console.error(e);
            triggerToast(e.message || "导出失败", 'error');
        }
    };

    /**
     * 生成带批注的文档内容
     */
    const generateAnnotatedDocument = (content: string, annots: Annotation[]): string => {
        let result = `合同法律审查报告（批注版）
========================================

文档审查信息
------------
生成时间: ${new Date().toLocaleString('zh-CN')}
合规评分: ${score}/100
签署建议: ${signRecommendation || '需人工复核'}
风险数量: 高风险 ${risks.filter(r => r.level === 'high').length} | 中风险 ${risks.filter(r => r.level === 'medium').length} | 低风险 ${risks.filter(r => r.level === 'low').length}

执行摘要
--------
${summary}

========================================
正文（含AI批注）
========================================

`;
        // 按位置倒序处理，避免插入批注后位置偏移
        const sortedAnnots = [...annots].sort((a, b) => b.position - a.position);
        let annotatedContent = content;

        sortedAnnots.forEach((annot, idx) => {
            const levelIcon = annot.risk.level === 'high' ? '⚠️ 高风险' : 
                              annot.risk.level === 'medium' ? '⚡ 中风险' : 'ℹ️ 低风险';
            
            const annotationText = `

【${levelIcon} - ${annot.risk.title}】
┌─────────────────────────────────────
│ 原文: "${annot.clause}"
│ 
│ 风险分析: ${annot.risk.description}
│ 
│ 修改建议: 建议审慎评估此条款，必要时与对方协商修改。
└─────────────────────────────────────

`;
            // 在条款后插入批注
            const insertPos = annot.position + annot.clause.length;
            annotatedContent = annotatedContent.slice(0, insertPos) + annotationText + annotatedContent.slice(insertPos);
        });

        result += annotatedContent;

        result += `

========================================
附录：完整风险清单
========================================

`;
        risks.forEach((risk, idx) => {
            result += `${idx + 1}. [${risk.level.toUpperCase()}] ${risk.title}
   条款: ${risk.clause || '未指定'}
   分析: ${risk.description}
   
`;
        });

        return result;
    };

    const scrollToClause = (clause: string) => {
        if (!clause || !currentDoc?.content) return;
        
        // 清理clause，去除引号和多余空格
        const cleanClause = clause.replace(/^["'"]+|["'"]+$/g, '').trim();
        
        // 尝试精确匹配
        let searchText = cleanClause;
        if (!currentDoc.content.includes(searchText)) {
            // 如果精确匹配失败，尝试使用前30个字符
            searchText = cleanClause.substring(0, 30);
        }
        if (!currentDoc.content.includes(searchText)) {
            // 如果还是失败，尝试使用前20个字符
            searchText = cleanClause.substring(0, 20);
        }
        
        if (searchText && currentDoc.content.includes(searchText)) {
            setHighlightedText(searchText);
            // 滚动到文档预览区域
            setTimeout(() => {
                const element = document.querySelector('.highlight-target');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // 添加高亮动画
                    element.classList.add('animate-pulse');
                    setTimeout(() => {
                        element.classList.remove('animate-pulse');
                    }, 2000);
                } else {
                    // 如果找不到元素，至少滚动到文档容器
                    documentContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 150);
        } else {
            // 如果完全找不到，至少滚动到文档顶部
            documentContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            triggerToast('未在文档中找到对应文本，已滚动到文档顶部', 'info');
        }
    };

    const getToastIcon = () => {
        switch (toastType) {
            case 'success': return 'check_circle';
            case 'error': return 'error';
            default: return 'smart_toy';
        }
    };

    const getToastColor = () => {
        switch (toastType) {
            case 'success': return 'bg-green-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gradient-to-br from-blue-500 to-cyan-500';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'from-green-500 to-emerald-400';
        if (score >= 60) return 'from-yellow-500 to-amber-400';
        if (score >= 40) return 'from-orange-500 to-amber-500';
        return 'from-red-500 to-rose-400';
    };

    const getOverallRiskBadge = (level: string) => {
        const l = (level || '').toLowerCase();
        if (l === 'low') return { label: '整体：低风险', cls: 'bg-green-500/10 text-green-400 border-green-500/20' };
        if (l === 'medium') return { label: '整体：中风险', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
        if (l === 'high') return { label: '整体：高风险', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
        if (l === 'critical') return { label: '整体：致命风险', cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
        return null;
    };

    const getComplianceStatusMeta = (status: ComplianceItem['status']) => {
        if (status === 'ok') return { label: '通过', cls: 'bg-green-500/10 text-green-400 border-green-500/20' };
        if (status === 'risk') return { label: '存在风险', cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
        if (status === 'missing') return { label: '缺失', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
        return { label: '不适用', cls: 'bg-slate-500/10 text-slate-400 border-white/10' };
    };

    const currentDoc = documents.find(d => d.id === selectedDocId);

    /**
     * 渲染带批注的文档内容
     */
    const renderAnnotatedContent = useMemo(() => {
        if (!currentDoc?.content) return null;
        
        const content = currentDoc.content;
        
        if (!showAnnotations || annotations.length === 0) {
            // 只处理高亮
            if (highlightedText && content.includes(highlightedText)) {
                const parts = content.split(highlightedText);
                return (
                    <>
                        {parts[0]}
                        <span className="highlight-target bg-yellow-500/30 ring-2 ring-yellow-400/50 rounded px-1 animate-pulse">
                            {highlightedText}
                        </span>
                        {parts.slice(1).join(highlightedText)}
                    </>
                );
            }
            return content;
        }

        // 带批注渲染
        const elements: React.ReactNode[] = [];
        let lastIndex = 0;

        annotations.forEach((annot, idx) => {
            // 添加批注前的文本
            if (annot.position > lastIndex) {
                elements.push(
                    <span key={`text-${idx}`}>
                        {content.slice(lastIndex, annot.position)}
                    </span>
                );
            }

            // 添加带批注的条款（适配白纸黑字）
            const levelColors = {
                high: 'bg-red-100 border-red-400 border-b-2 text-red-900',
                medium: 'bg-yellow-100 border-yellow-400 border-b-2 text-yellow-900',
                low: 'bg-blue-100 border-blue-400 border-b-2 text-blue-900'
            };

            const levelIcons = {
                high: 'error',
                medium: 'warning',
                low: 'info'
            };

            elements.push(
                <span key={`annot-${idx}`} className="relative inline-block group">
                    <span 
                        className={`${levelColors[annot.risk.level]} border-b-2 cursor-pointer transition-all hover:opacity-80 ${highlightedText === annot.clause ? 'highlight-target ring-2 ring-yellow-400/50' : ''}`}
                        onClick={() => scrollToClause(annot.clause)}
                    >
                        {annot.clause}
                    </span>
                    {/* 批注气泡 */}
                    <span className="absolute left-0 top-full mt-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className={`block w-72 p-3 rounded-lg shadow-xl border ${
                            annot.risk.level === 'high' ? 'bg-red-50 border-red-300' :
                            annot.risk.level === 'medium' ? 'bg-yellow-50 border-yellow-300' :
                            'bg-blue-50 border-blue-300'
                        }`}>
                            <span className="flex items-center gap-2 mb-2">
                                <span className={`material-symbols-outlined text-sm ${
                                    annot.risk.level === 'high' ? 'text-red-600' :
                                    annot.risk.level === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                                }`}>{levelIcons[annot.risk.level]}</span>
                                <span className="text-xs font-bold text-slate-900">{annot.risk.title}</span>
                            </span>
                            <span className="text-xs text-slate-700 leading-relaxed block">
                                {annot.risk.description.substring(0, 150)}...
                            </span>
                        </span>
                    </span>
                </span>
            );

            lastIndex = annot.position + annot.clause.length;
        });

        // 添加剩余文本
        if (lastIndex < content.length) {
            elements.push(
                <span key="text-end">
                    {content.slice(lastIndex)}
                </span>
            );
        }

        return elements;
    }, [currentDoc?.content, annotations, showAnnotations, highlightedText]);

    return (
        <>
            {/* Toast Notification */}
            <div className={`fixed top-24 right-10 z-[100] transition-all duration-500 transform ${showToast ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-slate-900/95 border border-blue-500/30 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 backdrop-blur-xl">
                    <div className={`${getToastColor()} p-2 rounded-full shadow-lg`}>
                        <span className="material-symbols-outlined text-white text-xl">{getToastIcon()}</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">系统通知</h4>
                        <p className="text-xs text-slate-300 mt-0.5">{toastMessage}</p>
                    </div>
                    <button onClick={() => setShowToast(false)} className="text-slate-400 hover:text-white ml-2">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            </div>

            {/* 左侧边栏 */}
            <aside className="w-full md:w-[400px] lg:w-[420px] flex flex-col bg-slate-900/80 backdrop-blur-xl border-r border-white/5 z-20 shrink-0 h-full overflow-y-auto custom-scrollbar">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-slate-100 text-sm uppercase tracking-widest font-bold mb-4 opacity-80">文档来源</h3>

                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.doc,.txt" />

                    <div
                        onClick={handleFileUpload}
                        className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 hover:bg-blue-900/10 hover:border-blue-500/30 transition-all cursor-pointer group active:scale-[0.98]"
                    >
                        <div className="size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:border-blue-500/50 transition-all duration-300">
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-400 text-2xl transition-colors">cloud_upload</span>
                        </div>
                        <div className="text-center">
                            <p className="text-slate-200 text-sm font-semibold">点击上传合同文档</p>
                            <p className="text-slate-500 text-xs mt-1">PDF, DOCX, TXT</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        {documents.map(doc => (
                            <div
                                key={doc.id}
                                onClick={() => { setSelectedDocId(doc.id); setScanComplete(doc.status === 'scanned'); }}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                                    ${selectedDocId === doc.id
                                        ? 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                        : 'bg-white/[0.02] border-white/10 hover:bg-white/5'}`}
                            >
                                <span className={`material-symbols-outlined ${selectedDocId === doc.id ? 'text-blue-400' : 'text-slate-500'}`}>description</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${selectedDocId === doc.id ? 'text-white' : 'text-slate-200'}`}>{doc.name}</p>
                                    {doc.analysis && (
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            {doc.analysis.charCount} 字符 · {doc.analysis.language === 'zh' ? '中文' : '英文'}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="h-0.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className={`h-full bg-blue-500 rounded-full transition-all duration-1000 ${doc.status === 'scanned' ? 'w-full' : 'w-0'}`}></div>
                                        </div>
                                        <span className="text-[10px] text-blue-400 font-bold uppercase">{doc.status === 'scanned' ? '已分析' : '待审查'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => handleRemoveDocument(doc.id, e)}
                                    className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-white/10"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 flex-1">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-slate-100 text-sm uppercase tracking-widest font-bold opacity-80">审查配置</h3>
                    </div>

                    <div className="space-y-3">
                        <ReviewOption icon="policy" title="条款检测" subtitle="法律结构智能识别" color="blue" checked={true} />
                        <ReviewOption icon="warning" title="风险分析" subtitle="权责对等 · 违约责任" color="orange" checked={true} />
                        <ReviewOption icon="edit_note" title="自动批注" subtitle="风险点同步标注到文档" color="purple" checked={showAnnotations} onChange={setShowAnnotations} />
                    </div>

                    <div className="mt-8">
                        {!scanComplete ? (
                            <button
                                onClick={handleStartReview}
                                disabled={isScanning || documents.length === 0 || !selectedDocId}
                                className={`w-full flex items-center justify-center gap-2 rounded-lg h-12 text-white text-sm uppercase tracking-wide font-bold transition-all border border-blue-400/20
                                    ${isScanning || documents.length === 0 || !selectedDocId
                                        ? 'bg-slate-700 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5'
                                    }`}
                            >
                                {isScanning ? (
                                    <>
                                        <span className="animate-spin material-symbols-outlined text-xl">progress_activity</span>
                                        {analysisProgress.message || '分析中...'}
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                        开始智能审查
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                                <p className="text-green-400 text-sm font-bold flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    审查已完成
                                </p>
                                <button onClick={() => { 
                                    setScanComplete(false); 
                                    setIsScanning(false); 
                                    setRisks([]); 
                                    setScore(0); 
                                    setSummary("");
                                    setSignRecommendation("");
                                    setAnnotations([]); 
                                    setRiskLevel("");
                                    setRiskCategories({});
                                    setOverallSuggestions([]);
                                    setDimensionScores([]);
                                    setMissingItems([]);
                                    setComplianceChecklist([]);
                                    setKeyFactsToConfirm([]);
                                    setNextSteps([]);
                                    setContractProfile(null);
                                }} className="text-xs text-slate-400 hover:text-white mt-2 underline">
                                    重新审查
                                </button>
                            </div>
                        )}

                        {/* 进度条 */}
                        {isScanning && (
                            <div className="mt-4 space-y-2">
                                <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                                        style={{ width: `${Math.min(analysisProgress.progress, 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-400">
                                    <span>{analysisProgress.message}</span>
                                    <span>{Math.round(analysisProgress.progress)}%</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* 主内容区 */}
            <main className="flex-1 relative flex flex-col bg-slate-950 overflow-hidden">
                {/* 工具栏 */}
                <div className="h-16 shrink-0 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 z-20">
                    <div className="flex items-center gap-4">
                        {/* 缩放控制 */}
                        <div className="flex items-center gap-2 text-slate-400 select-none">
                            <button onClick={() => handleZoom(-10)} className="hover:text-white transition-colors p-1">
                                <span className="material-symbols-outlined">remove</span>
                            </button>
                            <span className="text-sm font-mono text-slate-200 w-12 text-center">{zoom}%</span>
                            <button onClick={() => handleZoom(10)} className="hover:text-white transition-colors p-1">
                                <span className="material-symbols-outlined">add</span>
                            </button>
                        </div>
                        <div className="h-4 w-[1px] bg-white/10 mx-1"></div>
                        {/* 文档信息 */}
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span className="material-symbols-outlined text-lg">article</span>
                            <span>{currentDoc ? currentDoc.name : '未选择文档'}</span>
                        </div>
                        {/* 批注开关 */}
                        {annotations.length > 0 && (
                            <>
                                <div className="h-4 w-[1px] bg-white/10 mx-1"></div>
                                <button
                                    onClick={() => setShowAnnotations(!showAnnotations)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        showAnnotations 
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                            : 'bg-white/5 text-slate-400 border border-white/10'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-sm">edit_note</span>
                                    批注 ({annotations.length})
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {scanComplete && (
                            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                审查完成
                            </div>
                        )}
                        <button
                            onClick={() => handleExport('clean')}
                            disabled={!currentDoc}
                            className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[18px]">description</span>
                            导出原文
                        </button>
                        <button
                            onClick={() => handleExport('annotated')}
                            disabled={!scanComplete}
                            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            导出批注版
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                    {/* 文档预览区 - 白纸黑字原文档样式 */}
                    <div
                        ref={documentContainerRef}
                        className="flex-1 overflow-y-auto p-8 custom-scrollbar flex justify-center bg-gray-200 relative"
                    >
                        {/* 扫描动画遮罩 */}
                        {isScanning && (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-200/80 backdrop-blur-sm">
                                <div className="relative">
                                    <div className="w-32 h-32 rounded-full border-t-2 border-b-2 border-cyan-400 animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-5xl text-cyan-400 animate-pulse">psychology</span>
                                    </div>
                                </div>
                                <p className="mt-6 text-cyan-400 font-bold tracking-widest text-sm">{analysisProgress.message}</p>
                                <p className="mt-2 text-slate-500 text-xs">{Math.round(analysisProgress.progress)}%</p>
                            </div>
                        )}

                        {/* 文档内容 - 白纸黑字原文档样式 */}
                        <div
                            className="w-full max-w-[800px] bg-white text-slate-900 min-h-[1000px] shadow-2xl p-16 mb-20 relative z-10 rounded-sm transition-transform duration-200 origin-top"
                            style={{ transform: `scale(${zoom / 100})`, marginTop: `${(zoom - 100) * 0.5}%` }}
                        >
                            {currentDoc?.content ? (
                                <div className="font-serif">
                                    {/* 文档标题 */}
                                    <div className="text-center mb-16">
                                        <h1 className="text-2xl font-bold uppercase tracking-[0.15em] mb-4 text-slate-900">
                                            {currentDoc.name}
                                        </h1>
                                        <div className="flex justify-center items-center gap-4">
                                            <div className="h-[1px] w-12 bg-slate-400"></div>
                                            <p className="text-xs font-bold text-slate-600 tracking-widest">法律文档审查</p>
                                            <div className="h-[1px] w-12 bg-slate-400"></div>
                                        </div>
                                        {scanComplete && annotations.length > 0 && (
                                            <div className="mt-4 flex justify-center gap-4 text-xs">
                                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded border border-red-300">
                                                    高风险 {annotations.filter(a => a.risk.level === 'high').length}
                                                </span>
                                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded border border-yellow-300">
                                                    中风险 {annotations.filter(a => a.risk.level === 'medium').length}
                                                </span>
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded border border-blue-300">
                                                    低风险 {annotations.filter(a => a.risk.level === 'low').length}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 文档正文（带批注） */}
                                    <div className="whitespace-pre-wrap text-justify leading-loose text-[15px] text-slate-800">
                                        {renderAnnotatedContent}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[600px] flex flex-col items-center justify-center opacity-50">
                                    <span className="material-symbols-outlined text-6xl mb-4 text-slate-400">description</span>
                                    <p className="text-slate-600">请从左侧上传或选择文档</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI 评估侧边栏 */}
                    <div className="w-[340px] bg-slate-900/95 backdrop-blur-xl border-l border-white/5 shadow-2xl flex flex-col z-20 shrink-0">
                        <div className="p-5 border-b border-white/5">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2 flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full bg-blue-500 ${isScanning ? 'animate-ping' : ''}`}></span>
                                {isScanning ? 'AI 分析中...' : 'AI 风险评估'}
                            </h4>
                            <div className="flex items-end justify-between">
                                <div>
                                    <h2 className={`text-3xl font-bold text-white tracking-tight transition-all duration-1000 ${isScanning ? 'opacity-50 blur-sm' : ''}`}>
                                        {scanComplete ? score : '--'}
                                        <span className="text-lg text-slate-500 font-normal">/100</span>
                                    </h2>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {scanComplete && riskLevel && (() => {
                                        const meta = getOverallRiskBadge(riskLevel);
                                        if (!meta) return null;
                                        return (
                                            <span className={`px-2 py-1 text-[11px] font-bold border rounded ${meta.cls}`}>
                                                {meta.label}
                                            </span>
                                        );
                                    })()}
                                    {scanComplete && signRecommendation && (
                                        <span className={`px-2 py-1 text-xs font-bold border rounded ${
                                            signRecommendation.includes('可签署') ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            signRecommendation.includes('修改') ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                            'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                            {signRecommendation}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
                                <div
                                    className={`h-full bg-gradient-to-r ${scanComplete ? getScoreColor(score) : 'from-blue-500 to-cyan-400'} transition-all duration-[2000ms] ease-out`}
                                    style={{ width: scanComplete ? `${score}%` : isScanning ? `${analysisProgress.progress}%` : '0%' }}
                                ></div>
                            </div>

                            {scanComplete && summary && (
                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <h5 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">执行摘要</h5>
                                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-4 hover:line-clamp-none transition-all cursor-default">
                                        {summary}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                            {!scanComplete && !isScanning && (
                                <div className="text-center py-10 opacity-50">
                                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-600">analytics</span>
                                    <p className="text-sm text-slate-500">点击"开始智能审查"获取报告</p>
                                </div>
                            )}

                            {isScanning && (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-24 rounded-lg bg-white/5 animate-pulse"></div>
                                    ))}
                                </div>
                            )}

                            {scanComplete && contractProfile && (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-cyan-400">badge</span>
                                        合同画像
                                    </h5>
                                    <div className="mt-3 space-y-2 text-xs text-slate-300">
                                        {[
                                            { label: '合同类型', value: contractProfile.contractType },
                                            { label: '主体', value: contractProfile.parties?.filter(Boolean).join(' / ') },
                                            { label: '标的/范围', value: contractProfile.subjectMatter },
                                            { label: '期限', value: contractProfile.term },
                                            { label: '价款/付款', value: contractProfile.payment },
                                            { label: '交付/验收', value: contractProfile.deliveryAndAcceptance },
                                            { label: '争议解决', value: contractProfile.disputeResolution }
                                        ].filter(row => row.value && String(row.value).trim().length > 0).map((row, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <span className="text-slate-500 shrink-0 w-16">{row.label}</span>
                                                <span className="text-slate-200 leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {scanComplete && Object.keys(riskCategories || {}).length > 0 && (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-blue-400">category</span>
                                        风险领域分布
                                    </h5>
                                    <div className="mt-3 space-y-3">
                                        {Object.entries(riskCategories).map(([k, v]) => {
                                            const items = Array.isArray(v) ? v : [];
                                            return (
                                                <div key={k}>
                                                    <div className="text-[11px] text-slate-300 font-bold mb-1">{k}</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {items.slice(0, 10).map((item, idx) => (
                                                            <span key={idx} className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                                                                {item}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {scanComplete && dimensionScores.length > 0 && (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-purple-400">leaderboard</span>
                                        维度评分
                                    </h5>
                                    <div className="mt-3 space-y-3">
                                        {dimensionScores.slice(0, 12).map((d, idx) => (
                                            <div key={idx}>
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-300 font-medium">{d.dimension || '未命名维度'}</span>
                                                    <span className="text-slate-400 font-mono">{Math.max(0, Math.min(100, Number(d.score) || 0))}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                                                    <div
                                                        className={`h-full bg-gradient-to-r ${getScoreColor(Math.max(0, Math.min(100, Number(d.score) || 0)))} transition-all`}
                                                        style={{ width: `${Math.max(0, Math.min(100, Number(d.score) || 0))}%` }}
                                                    />
                                                </div>
                                                {d.findings?.[0] && (
                                                    <div className="mt-1 text-[11px] text-slate-400 leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">
                                                        {d.findings[0]}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {scanComplete && missingItems.length > 0 && (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-yellow-400">rule</span>
                                        缺失条款/缺失信息
                                    </h5>
                                    <ul className="mt-3 space-y-2 text-xs text-slate-300 list-disc pl-4">
                                        {missingItems.slice(0, 8).map((m, idx) => (
                                            <li key={idx} className="leading-relaxed">
                                                <span className="text-slate-200">{m.item}</span>
                                                {m.whyImportant && <span className="text-slate-500">（{m.whyImportant}）</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {scanComplete && complianceChecklist.length > 0 && (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-green-400">fact_check</span>
                                        合规清单
                                    </h5>
                                    <div className="mt-3 space-y-2">
                                        {complianceChecklist.slice(0, 10).map((c, idx) => {
                                            const meta = getComplianceStatusMeta(c.status);
                                            return (
                                                <div key={idx} className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="text-xs text-slate-200 font-medium truncate">{c.topic}</div>
                                                        {c.notes && (
                                                            <div className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">
                                                                {c.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className={`shrink-0 px-2 py-1 text-[10px] font-bold border rounded ${meta.cls}`}>
                                                        {meta.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {scanComplete && keyFactsToConfirm.length > 0 && (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-slate-300">help</span>
                                        需确认信息
                                    </h5>
                                    <ul className="mt-3 space-y-2 text-xs text-slate-300 list-disc pl-4">
                                        {keyFactsToConfirm.slice(0, 10).map((it, idx) => (
                                            <li key={idx} className="leading-relaxed">{it}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {scanComplete && overallSuggestions.length > 0 && (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-blue-400">tips_and_updates</span>
                                        总体建议
                                    </h5>
                                    <ul className="mt-3 space-y-2 text-xs text-slate-300 list-disc pl-4">
                                        {overallSuggestions.slice(0, 8).map((s, idx) => (
                                            <li key={idx} className="leading-relaxed">{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {scanComplete && nextSteps.length > 0 && (
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-cyan-400">playlist_add_check</span>
                                        下一步
                                    </h5>
                                    <ul className="mt-3 space-y-2 text-xs text-slate-300 list-disc pl-4">
                                        {nextSteps.slice(0, 8).map((s, idx) => (
                                            <li key={idx} className="leading-relaxed">{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {scanComplete && (
                                <div className="pt-4 border-t border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm text-red-400">warning</span>
                                            风险清单
                                            <span className="text-slate-600 ml-2">({risks.length})</span>
                                        </h5>
                                        {risks.length > 0 && (
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                                    高: {risks.filter(r => r.level === 'high').length}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                    中: {risks.filter(r => r.level === 'medium').length}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    低: {risks.filter(r => r.level === 'low').length}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {scanComplete && risks.length > 0 && (
                                <div className="space-y-3">
                                    {risks.map((risk, idx) => (
                                        <RiskCard
                                            key={idx}
                                            level={risk.level}
                                            title={risk.title}
                                            clause={risk.clause}
                                            description={risk.description}
                                            recommendation={risk.recommendation}
                                            legalBasis={risk.legalBasis}
                                            category={risk.category}
                                            onClick={() => scrollToClause(risk.clause)}
                                        />
                                    ))}
                                </div>
                            )}
                            {scanComplete && risks.length === 0 && (
                                <div className="text-center py-10 opacity-70">
                                    <span className="material-symbols-outlined text-4xl mb-2 text-green-400">check_circle</span>
                                    <p className="text-sm text-slate-400">未发现显著风险</p>
                                    <p className="text-xs text-slate-500 mt-1">合同条款符合法律要求</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/5">
                            <h5 className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-widest">风险概览</h5>
                            <div className="flex gap-3 text-center">
                                <SummaryBox count={scanComplete ? risks.filter(r => r.level === 'high').length : 0} label="高风险" color="red" />
                                <SummaryBox count={scanComplete ? risks.filter(r => r.level === 'medium').length : 0} label="中风险" color="yellow" />
                                <SummaryBox count={scanComplete ? risks.filter(r => r.level === 'low').length : 0} label="低风险" color="blue" />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* AI 助手浮动窗口 - 固定左下角 */}
            <div className={`fixed left-6 bottom-6 z-50 transition-all duration-300 ${showAiAssistant ? 'w-[380px]' : 'w-auto'}`}>
                {showAiAssistant ? (
                    <div className="bg-slate-900/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                        {/* 标题栏 */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-white">smart_toy</span>
                                <span className="text-white font-bold text-sm">AI 文档助手</span>
                            </div>
                            <button 
                                onClick={() => setShowAiAssistant(false)}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* 快捷操作 */}
                        <div className="p-4 border-b border-white/5">
                            <p className="text-xs text-slate-400 mb-3">快捷操作</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => handleAiAction('summary')}
                                    disabled={!currentDoc || aiActionLoading}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-300 transition-all disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-sm text-blue-400">summarize</span>
                                    生成摘要
                                </button>
                                <button 
                                    onClick={() => handleAiAction('extract_terms')}
                                    disabled={!currentDoc || aiActionLoading}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-300 transition-all disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-sm text-green-400">list_alt</span>
                                    提取条款
                                </button>
                                <button 
                                    onClick={() => handleAiAction('translate')}
                                    disabled={!currentDoc || aiActionLoading}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-300 transition-all disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-sm text-purple-400">translate</span>
                                    中英互译
                                </button>
                                <button 
                                    onClick={() => handleAiAction('clause_compare')}
                                    disabled={!currentDoc || aiActionLoading}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-300 transition-all disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-sm text-orange-400">compare</span>
                                    条款分析
                                </button>
                            </div>
                        </div>

                        {/* 自由问答 */}
                        <div className="p-4 border-b border-white/5">
                            <p className="text-xs text-slate-400 mb-2">智能问答</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={ragQuestion}
                                    onChange={(e) => setRagQuestion(e.target.value)}
                                    placeholder="询问关于此合同的问题..."
                                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                    onKeyPress={(e) => e.key === 'Enter' && handleRagQuery()}
                                    disabled={!currentDoc || aiActionLoading}
                                />
                                <button 
                                    onClick={handleRagQuery}
                                    disabled={!currentDoc || aiActionLoading || !ragQuestion.trim()}
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {aiActionLoading ? (
                                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-sm">send</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* AI 回复区域 */}
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {aiActionLoading && (
                                <div className="p-4 flex items-center gap-3">
                                    <span className="material-symbols-outlined animate-spin text-blue-400">progress_activity</span>
                                    <span className="text-sm text-slate-400">AI 正在思考...</span>
                                </div>
                            )}
                            {aiActionResult && !aiActionLoading && (
                                <div className="p-4">
                                    <div className="flex items-start gap-2 mb-2">
                                        <span className="material-symbols-outlined text-blue-400 text-sm mt-0.5">smart_toy</span>
                                        <span className="text-xs text-blue-400 font-bold">AI 助手回复</span>
                                    </div>
                                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap pl-6">
                                        {aiActionResult}
                                    </div>
                                </div>
                            )}
                            {!aiActionResult && !aiActionLoading && (
                                <div className="p-4 text-center text-slate-500 text-sm">
                                    <span className="material-symbols-outlined text-2xl mb-2 opacity-50">chat</span>
                                    <p>选择操作或输入问题开始对话</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* 收起状态的浮动按钮 */
                    <button
                        onClick={() => setShowAiAssistant(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                        <span className="material-symbols-outlined">smart_toy</span>
                        <span className="font-medium text-sm">AI 助手</span>
                    </button>
                )}
            </div>
        </>
    );
};

interface ReviewOptionProps {
    icon: string;
    title: string;
    subtitle: string;
    color: string;
    checked: boolean;
    onChange?: (checked: boolean) => void;
}

const ReviewOption: React.FC<ReviewOptionProps> = ({ icon, title, subtitle, color, checked: initialChecked, onChange }) => {
    const [checked, setChecked] = useState(initialChecked);

    const handleChange = () => {
        const newValue = !checked;
        setChecked(newValue);
        onChange?.(newValue);
    };

    const colorClasses: { [key: string]: string } = {
        blue: 'from-blue-500/10 to-blue-600/10 text-blue-400 ring-blue-500/20',
        orange: 'from-orange-500/10 to-orange-600/10 text-orange-400 ring-orange-500/20',
        purple: 'from-purple-500/10 to-purple-600/10 text-purple-400 ring-purple-500/20',
    };

    return (
        <div
            className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 cursor-pointer"
            onClick={handleChange}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md bg-gradient-to-br ring-1 ${colorClasses[color]} transition-all`}>
                    <span className="material-symbols-outlined text-lg">{icon}</span>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-200 select-none">{title}</p>
                    <p className="text-[11px] text-slate-500 select-none">{subtitle}</p>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                <input type="checkbox" checked={checked} readOnly className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
        </div>
    );
}

const RiskCard: React.FC<{ level: 'high' | 'medium' | 'low'; title: string; clause: string; description: string; recommendation?: string; legalBasis?: string; category?: string; onClick?: () => void }> = ({ level, title, clause, description, recommendation, legalBasis, category, onClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const config = {
        high: {
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            icon: 'error',
            textColor: 'text-red-400',
            headerBg: 'bg-red-500/20',
            clauseBg: 'bg-red-500/5',
            clauseBorder: 'border-red-500/20',
        },
        medium: {
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/30',
            icon: 'warning',
            textColor: 'text-yellow-400',
            headerBg: 'bg-yellow-500/20',
            clauseBg: 'bg-yellow-500/5',
            clauseBorder: 'border-yellow-500/20',
        },
        low: {
            bg: 'bg-slate-500/10',
            border: 'border-slate-500/30',
            icon: 'info',
            textColor: 'text-slate-400',
            headerBg: 'bg-slate-500/20',
            clauseBg: 'bg-slate-500/5',
            clauseBorder: 'border-slate-500/20',
        }
    }[level];

    return (
        <div
            className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden hover:shadow-lg transition-all duration-300 ${level === 'low' ? 'opacity-70 hover:opacity-100' : ''}`}
        >
            <div className={`${config.headerBg} px-4 py-2.5 flex items-center justify-between border-b ${config.border}`}>
                <div className="flex items-center gap-2">
                    <span className={`${config.textColor} font-bold text-xs uppercase flex items-center gap-1.5 tracking-wider`}>
                        <span className="material-symbols-outlined text-sm">{config.icon}</span> 
                        {level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险'}
                    </span>
                    {category && (
                        <span className="text-[10px] text-slate-400 border border-white/10 px-1.5 py-0.5 rounded">{category}</span>
                    )}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className={`text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10`}
                    title={isExpanded ? '收起' : '展开'}
                >
                    <span className="material-symbols-outlined text-sm transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        expand_more
                    </span>
                </button>
            </div>
            <div className="p-4">
                {/* 风险标题 */}
                <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-slate-400">gavel</span>
                    {title}
                </p>
                
                {/* 合同原文 - 突出显示 */}
                {clause && (
                    <div className={`mb-3 p-3 rounded-lg border ${config.clauseBorder} ${config.clauseBg} relative`}>
                        <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-sm text-slate-400 mt-0.5 shrink-0">description</span>
                            <div className="flex-1">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-bold">合同原文</p>
                                <p 
                                    className="text-xs text-slate-200 leading-relaxed cursor-pointer hover:text-white transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onClick) onClick();
                                    }}
                                    title="点击定位到文档中的位置"
                                >
                                    "{clause}"
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* 风险分析 - 可展开 */}
                <div className="mb-3">
                    <div className="flex items-start gap-2 mb-1.5">
                        <span className="material-symbols-outlined text-sm text-slate-400 mt-0.5 shrink-0">analytics</span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">AI 风险分析</p>
                    </div>
                    <p className={`text-xs text-slate-300 leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {description}
                    </p>
                    {description.length > 150 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                            className="text-[10px] text-blue-400 hover:text-blue-300 mt-1.5 flex items-center gap-1"
                        >
                            {isExpanded ? '收起' : '展开完整分析'}
                            <span className="material-symbols-outlined text-xs" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                expand_more
                            </span>
                        </button>
                    )}
                </div>
                
                {/* 法律依据 */}
                {legalBasis && (
                    <div className="mb-3 p-2.5 rounded bg-slate-800/30 border border-slate-700/30">
                        <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-sm text-slate-400 mt-0.5 shrink-0">balance</span>
                            <div className="flex-1">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">法律依据</p>
                                <p className="text-[11px] text-slate-300 leading-relaxed">{legalBasis}</p>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* 修改建议 */}
                {recommendation && (
                    <div className={`p-2.5 rounded border ${config.border} ${config.bg}`}>
                        <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-sm text-slate-400 mt-0.5 shrink-0">lightbulb</span>
                            <div className="flex-1">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">修改建议</p>
                                <p className="text-[11px] text-slate-200 leading-relaxed">{recommendation}</p>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* 定位按钮 */}
                {clause && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onClick) onClick();
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-400 hover:text-blue-300 transition-all"
                    >
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        定位到文档中的位置
                    </button>
                )}
            </div>
        </div>
    );
};

const SummaryBox: React.FC<{ count: number; label: string; color: string }> = ({ count, label, color }) => {
    const colorClasses = {
        red: 'bg-red-500/10 border-red-500/20 text-red-400',
        yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400'
    }[color];

    return (
        <div className={`flex-1 ${colorClasses} border rounded-md p-2 transition-all ${count === 0 ? 'opacity-50' : ''}`}>
            <div className="text-lg font-bold">{count}</div>
            <div className="text-[9px] uppercase opacity-70 font-bold tracking-wider">{label}</div>
        </div>
    );
};

export default ContractReview;
