/**
 * 文档处理路由
 * 
 * 功能：
 * 1. 文档上传与解析
 * 2. 智能分块分析 (Map-Reduce)
 * 3. RAG 向量索引与查询
 * 4. AI 辅助功能
 */

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const supabase = require('../services/db');
const { analyzeChunk, consolidateAnalysis, performAiAction } = require('../services/ai');
const { smartChunk, analyzeDocument, getChunkPromptContext } = require('../services/chunker');
const { vectorStore, ragPipeline } = require('../services/rag');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

/**
 * 清理临时文件
 */
const cleanUp = (filePath) => {
    fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete temp file:", err);
    });
};

/**
 * ============================================
 * 文档上传接口
 * ============================================
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // 处理文件名编码问题 (Windows/Multer)
        let originalName = file.originalname;
        try {
            const converted = Buffer.from(file.originalname, 'latin1').toString('utf8');
            if (converted !== file.originalname) {
                originalName = converted;
            }
        } catch (e) {
            console.error("Filename encoding fix failed:", e);
        }

        console.log(`[Upload] Processing: ${originalName} (${file.mimetype})`);

        let content = '';
        const filePath = file.path;

        try {
            // 根据文件类型提取文本
            if (file.mimetype === 'application/pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdf(dataBuffer);
                content = data.text;
            } else if (
                file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                file.mimetype === 'application/msword'
            ) {
                const result = await mammoth.extractRawText({ path: filePath });
                content = result.value;
            } else {
                content = fs.readFileSync(filePath, 'utf8');
            }

            if (!content || content.trim().length === 0) {
                console.warn("[Upload] Empty content extracted:", originalName);
                content = `[无法自动提取内容 - 请尝试复制粘贴到审查框]\n\n文件类型: ${file.mimetype}`;
            }
        } catch (extractError) {
            console.error("[Upload] Extraction error:", extractError);
            content = `[提取文件内容时发生错误: ${extractError.message}]`;
        }

        const docId = Date.now().toString();
        cleanUp(filePath);

        // 返回文档预分析信息
        const docAnalysis = analyzeDocument(content);

        console.log(`[Upload] Success: ${originalName}, ${content.length} chars, ${docAnalysis.chunkCount} chunks`);

        res.json({
            id: docId,
            name: originalName,
            status: 'ready',
            content: content,
            analysis: {
                language: docAnalysis.language,
                charCount: docAnalysis.totalChars,
                estimatedTokens: docAnalysis.estimatedTokens,
                chunkCount: docAnalysis.chunkCount,
                avgChunkTokens: docAnalysis.averageChunkTokens
            }
        });

    } catch (error) {
        console.error("[Upload] Error:", error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

/**
 * ============================================
 * 智能分析接口 (Map-Reduce 架构)
 * ============================================
 */
router.post('/analyze/:id', async (req, res) => {
    const documentId = req.params.id;
    const { text, document_id } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text content required for analysis' });
    }

    // 使用 SSE 推送进度
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = (stage, progress, message) => {
        res.write(`data: ${JSON.stringify({ stage, progress, message })}\n\n`);
    };

    try {
        console.log(`[Analyze] Starting analysis for: ${documentId}`);
        sendProgress('init', 0, '正在初始化分析...');

        // ==========================================
        // 阶段 1: 智能分块 (Chunking)
        // ==========================================
        sendProgress('chunking', 5, '正在进行智能文档分块...');
        
        const chunks = smartChunk(text);
        console.log(`[Analyze] Split into ${chunks.length} semantic chunks`);
        
        sendProgress('chunking', 10, `文档已分为 ${chunks.length} 个语义片段`);

        // ==========================================
        // 阶段 2: 并行 Map 分析
        // ==========================================
        sendProgress('mapping', 15, '开始多片段并行分析...');
        
        const chunkResults = [];
        const concurrency = 3; // 并发数限制
        
        for (let i = 0; i < chunks.length; i += concurrency) {
            const batch = chunks.slice(i, Math.min(i + concurrency, chunks.length));
            
            // 并行处理当前批次
            const batchPromises = batch.map(async (chunk, batchIndex) => {
                const chunkIndex = i + batchIndex;
                const promptContext = getChunkPromptContext(chunk);
                
                try {
                    const analysis = await analyzeChunk(chunk.content, promptContext);
                    return { index: chunkIndex, success: true, data: analysis };
                } catch (error) {
                    console.error(`[Analyze] Chunk ${chunkIndex} failed:`, error.message);
                    return { 
                        index: chunkIndex, 
                        success: false, 
                        data: { score: 50, summary: '分析失败', risks: [] } 
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            chunkResults.push(...batchResults.sort((a, b) => a.index - b.index).map(r => r.data));
            
            // 更新进度
            const progress = 15 + Math.round((i + batch.length) / chunks.length * 55);
            sendProgress('mapping', progress, `已分析 ${Math.min(i + concurrency, chunks.length)}/${chunks.length} 个片段`);
        }

        console.log(`[Analyze] Map phase complete: ${chunkResults.length} results`);

        // ==========================================
        // 阶段 3: Reduce 汇总
        // ==========================================
        sendProgress('reducing', 75, '正在整合分析结果...');
        
        const finalReport = await consolidateAnalysis(chunkResults, chunks.length);
        
        sendProgress('reducing', 90, '生成最终报告...');

        // ==========================================
        // 阶段 4: 向量索引 (可选，后台进行)
        // ==========================================
        sendProgress('indexing', 95, '建立文档索引...');
        
        // 后台索引，不阻塞响应
        vectorStore.indexDocument(document_id || documentId, text, {
            fileName: documentId,
            analyzedAt: new Date().toISOString()
        }).catch(err => console.error('[Analyze] Background indexing error:', err));

        // ==========================================
        // 完成
        // ==========================================
        sendProgress('complete', 100, '分析完成');

        // 发送最终结果
        res.write(`data: ${JSON.stringify({ 
            stage: 'result', 
            progress: 100,
            data: finalReport 
        })}\n\n`);
        
        res.end();

    } catch (error) {
        console.error("[Analyze] Error:", error);
        sendProgress('error', 0, `分析失败: ${error.message}`);
        res.write(`data: ${JSON.stringify({ 
            stage: 'error', 
            error: error.message 
        })}\n\n`);
        res.end();
    }
});

/**
 * 同步分析接口 (兼容旧版)
 */
router.post('/analyze-sync/:id', async (req, res) => {
    const documentId = req.params.id;
    const { text, document_id } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text content required' });
    }

    try {
        console.log(`[Analyze-Sync] Starting for: ${documentId}`);

        // 1. 智能分块
        const chunks = smartChunk(text);
        console.log(`[Analyze-Sync] ${chunks.length} chunks`);

        // 2. 并行分析（提升速度）
        const chunkResults = [];
        const concurrency = 4; // 增加并发数，加快处理速度
        
        for (let i = 0; i < chunks.length; i += concurrency) {
            const batch = chunks.slice(i, Math.min(i + concurrency, chunks.length));
            
            const batchPromises = batch.map(async (chunk, batchIndex) => {
                const chunkIndex = i + batchIndex;
                
                // 确保正确获取分块内容（smartChunk 返回 {content, metadata} 格式）
                const chunkContent = chunk.content || (typeof chunk === 'string' ? chunk : '');
                if (!chunkContent || (typeof chunkContent === 'string' && chunkContent.trim().length === 0)) {
                    console.warn(`[Analyze-Sync] Chunk ${chunkIndex} is empty, skipping`);
                    return { 
                        index: chunkIndex, 
                        success: false, 
                        data: { score: 50, summary: '分块内容为空', risks: [] } 
                    };
                }
                
                const promptContext = getChunkPromptContext(chunk);
                
                try {
                    const analysis = await analyzeChunk(chunkContent, promptContext);
                    return { index: chunkIndex, success: true, data: analysis };
                } catch (error) {
                    console.error(`[Analyze-Sync] Chunk ${chunkIndex} error:`, error.message);
                    // 返回空结果，不包含错误信息，避免错误信息出现在摘要中
                    return { 
                        index: chunkIndex, 
                        success: false, 
                        data: { 
                            score: 50, 
                            summary: '该片段分析跳过', 
                            risks: [],
                            keyTerms: [],
                            suggestions: []
                        } 
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            chunkResults.push(...batchResults.sort((a, b) => a.index - b.index).map(r => r.data));
            
            console.log(`[Analyze-Sync] Progress: ${Math.min(i + concurrency, chunks.length)}/${chunks.length} chunks analyzed`);
        }

        // 3. 汇总
        let finalReport;
        try {
            finalReport = await consolidateAnalysis(chunkResults, chunks.length);
        } catch (error) {
            console.error("[Analyze-Sync] Consolidation failed:", error.message);
            // 降级处理：直接聚合分块结果，确保风险清单完整
            const allRisks = chunkResults.flatMap(r => r.risks || []).map(r => ({
                level: ['high', 'medium', 'low'].includes(r.level) ? r.level : 'low',
                title: r.title || '未命名风险',
                clause: r.clause || '',
                description: r.description || '',
                recommendation: r.recommendation || '',
                legalBasis: r.legalBasis || '',
                category: r.category || '其他'
            }));
            const avgScore = Math.round(chunkResults.reduce((sum, r) => sum + (r.score || 50), 0) / chunkResults.length);
            // 过滤掉包含错误信息的摘要
            const validSummaries = chunkResults
                .map(r => r.summary)
                .filter(s => s && !s.includes('分析失败') && !s.includes('网络连接') && s !== '该片段分析跳过');
            
            // 生成风险分类
            const riskCategories = {};
            allRisks.forEach(risk => {
                const category = risk.category || '其他';
                if (!riskCategories[category]) {
                    riskCategories[category] = [];
                }
                if (!riskCategories[category].includes(risk.title)) {
                    riskCategories[category].push(risk.title);
                }
            });
            
            // 按风险等级排序
            allRisks.sort((a, b) => {
                const order = { high: 3, medium: 2, low: 1 };
                return (order[b.level] || 0) - (order[a.level] || 0);
            });
            
            finalReport = {
                score: avgScore,
                riskLevel: avgScore >= 80 ? 'low' : avgScore >= 60 ? 'medium' : avgScore >= 40 ? 'high' : 'critical',
                summary: validSummaries.length > 0 
                    ? `合同共分${chunks.length}段分析，平均得分${avgScore}分，发现${allRisks.length}个风险点。${validSummaries.slice(0, 3).join('；')}`
                    : `合同共分${chunks.length}段分析，平均得分${avgScore}分，发现${allRisks.length}个风险点。`,
                contractProfile: undefined,
                riskCategories: riskCategories,  // 添加风险分类
                dimensionScores: [],
                missingItems: [],
                complianceChecklist: [],
                risks: allRisks,  // 确保风险清单返回（已排序）
                overallSuggestions: chunkResults.flatMap(r => r.suggestions || []).filter(Boolean).slice(0, 5),
                keyFactsToConfirm: [],
                nextSteps: [],
                signRecommendation: avgScore >= 70 ? '建议人工复核后签署' : avgScore >= 50 ? '建议修改后签署' : '建议暂缓签署'
            };
        }

        // 4. 后台索引（忽略错误，因为表可能不存在）
        if (document_id || documentId) {
            vectorStore.indexDocument(document_id || documentId, text).catch(err => {
                console.warn("[Analyze-Sync] Indexing skipped:", err.message);
            });
        }

        // 确保即使所有分块都失败，也返回一个有效的结果
        if (!finalReport || !finalReport.risks) {
            console.warn("[Analyze-Sync] No valid report generated, creating fallback");
            finalReport = {
                score: 50,
                riskLevel: 'medium',
                summary: '分析过程中遇到网络问题，部分内容未能完成分析。建议重新尝试或检查网络连接。',
                contractProfile: undefined,
                riskCategories: {},
                dimensionScores: [],
                missingItems: [],
                complianceChecklist: [],
                risks: [],
                overallSuggestions: ['建议重新运行分析以获取完整结果'],
                keyFactsToConfirm: [],
                nextSteps: ['检查网络连接后重新分析'],
                signRecommendation: '建议重新分析后签署'
            };
        }

        res.json(finalReport);

    } catch (error) {
        console.error("[Analyze-Sync] Error:", error);
        // 即使发生错误，也返回一个基本结果，而不是完全失败
        res.status(200).json({
            score: 50,
            riskLevel: 'medium',
            summary: '分析过程中遇到错误，请检查网络连接后重试。',
            contractProfile: undefined,
            riskCategories: {},
            dimensionScores: [],
            missingItems: [],
            complianceChecklist: [],
            risks: [],
            overallSuggestions: ['建议重新运行分析'],
            keyFactsToConfirm: [],
            nextSteps: ['检查网络连接', '重新上传文档'],
            signRecommendation: '建议重新分析后签署'
        });
    }
});

/**
 * ============================================
 * RAG 问答接口
 * ============================================
 */
router.post('/query', async (req, res) => {
    const { question, document_id } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question required' });
    }

    try {
        console.log(`[Query] Question: "${question}" for doc: ${document_id}`);
        
        const result = await ragPipeline.query(question, document_id);
        
        res.json(result);

    } catch (error) {
        console.error("[Query] Error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 文档重新索引
 */
router.post('/reindex/:id', async (req, res) => {
    const { text } = req.body;
    const documentId = req.params.id;

    if (!text) {
        return res.status(400).json({ error: 'Text content required' });
    }

    try {
        // 删除旧索引
        await vectorStore.deleteDocumentVectors(documentId);
        
        // 重新索引
        const result = await vectorStore.indexDocument(documentId, text);
        
        res.json({ 
            success: true, 
            chunkCount: result.chunkCount 
        });

    } catch (error) {
        console.error("[Reindex] Error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 获取索引状态
 */
router.get('/index-stats/:id', async (req, res) => {
    try {
        const stats = await ragPipeline.getIndexStats(req.params.id);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ============================================
 * 导出 DOCX 接口
 * ============================================
 */
router.post('/export-docx', async (req, res) => {
    const { 
        content, 
        annotations, 
        risks, 
        score, 
        summary, 
        riskLevel,
        contractProfile,
        riskCategories,
        dimensionScores,
        missingItems,
        complianceChecklist,
        overallSuggestions,
        keyFactsToConfirm,
        nextSteps,
        signRecommendation, 
        fileName 
    } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Content required' });
    }

    try {
        // 生成带批注的文本内容
        let annotatedContent = content;
        
        if (annotations && annotations.length > 0) {
            // 按位置倒序处理，避免插入批注后位置偏移
            const sortedAnnots = [...annotations].sort((a, b) => b.position - a.position);
            
            sortedAnnots.forEach((annot) => {
                const levelIcon = annot.risk.level === 'high' ? '⚠️ 高风险' : 
                                  annot.risk.level === 'medium' ? '⚡ 中风险' : 'ℹ️ 低风险';
                
                const suggestion = annot.risk.recommendation || '建议审慎评估此条款，必要时与对方协商修改。';
                const legalBasis = annot.risk.legalBasis ? `\n法律依据: ${annot.risk.legalBasis}` : '';
                const annotationText = `\n\n【${levelIcon} - ${annot.risk.title}】\n原文: "${annot.clause}"\n风险分析: ${annot.risk.description}${legalBasis}\n修改建议: ${suggestion}\n`;
                
                const insertPos = annot.position + annot.clause.length;
                annotatedContent = annotatedContent.slice(0, insertPos) + annotationText + annotatedContent.slice(insertPos);
            });
        }

        // 生成完整报告
        let fullContent = `合同法律审查报告（批注版）\n========================================\n\n`;
        fullContent += `文档审查信息\n------------\n`;
        fullContent += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
        fullContent += `合规评分: ${score || 0}/100\n`;
        if (riskLevel) {
            const rl = String(riskLevel).toLowerCase();
            const riskLevelZh = rl === 'low' ? '低风险' : rl === 'medium' ? '中风险' : rl === 'high' ? '高风险' : rl === 'critical' ? '致命风险' : riskLevel;
            fullContent += `整体风险等级: ${riskLevelZh}\n`;
        }
        fullContent += `签署建议: ${signRecommendation || '需人工复核'}\n`;
        if (risks) {
            fullContent += `风险数量: 高风险 ${risks.filter((r) => r.level === 'high').length} | 中风险 ${risks.filter((r) => r.level === 'medium').length} | 低风险 ${risks.filter((r) => r.level === 'low').length}\n`;
        }
        fullContent += `\n执行摘要\n--------\n${summary || '无'}\n\n`;

        // 结构化评估信息（如有）
        if (contractProfile) {
            fullContent += `合同画像\n--------\n`;
            fullContent += `合同类型: ${contractProfile.contractType || '未明确'}\n`;
            if (contractProfile.parties?.length) fullContent += `主体: ${contractProfile.parties.join(' / ')}\n`;
            if (contractProfile.subjectMatter) fullContent += `标的/范围: ${contractProfile.subjectMatter}\n`;
            if (contractProfile.term) fullContent += `期限: ${contractProfile.term}\n`;
            if (contractProfile.payment) fullContent += `价款/付款: ${contractProfile.payment}\n`;
            if (contractProfile.deliveryAndAcceptance) fullContent += `交付/验收: ${contractProfile.deliveryAndAcceptance}\n`;
            if (contractProfile.disputeResolution) fullContent += `争议解决: ${contractProfile.disputeResolution}\n`;
            fullContent += `\n`;
        }

        if (riskCategories && Object.keys(riskCategories).length > 0) {
            fullContent += `风险领域分布\n------------\n`;
            Object.entries(riskCategories).forEach(([k, v]) => {
                fullContent += `${k}: ${(v || []).join('、') || '无'}\n`;
            });
            fullContent += `\n`;
        }

        if (dimensionScores && dimensionScores.length > 0) {
            fullContent += `维度评分\n--------\n`;
            dimensionScores.forEach((d) => {
                fullContent += `- ${d.dimension || '未命名维度'}: ${d.score}\n`;
                if (d.findings?.length) fullContent += `  发现: ${d.findings.join('；')}\n`;
                if (d.recommendations?.length) fullContent += `  建议: ${d.recommendations.join('；')}\n`;
            });
            fullContent += `\n`;
        }

        if (missingItems && missingItems.length > 0) {
            fullContent += `缺失条款/缺失信息\n----------------\n`;
            missingItems.forEach((m) => {
                fullContent += `- ${m.item}\n`;
                if (m.whyImportant) fullContent += `  重要性: ${m.whyImportant}\n`;
                if (m.suggestion) fullContent += `  补充建议: ${m.suggestion}\n`;
            });
            fullContent += `\n`;
        }

        if (complianceChecklist && complianceChecklist.length > 0) {
            fullContent += `合规清单\n--------\n`;
            complianceChecklist.forEach((c) => {
                fullContent += `- ${c.topic}: ${c.status}\n`;
                if (c.notes) fullContent += `  说明: ${c.notes}\n`;
            });
            fullContent += `\n`;
        }

        if (overallSuggestions && overallSuggestions.length > 0) {
            fullContent += `总体建议\n--------\n`;
            overallSuggestions.forEach((s, idx) => {
                fullContent += `${idx + 1}. ${s}\n`;
            });
            fullContent += `\n`;
        }

        if (keyFactsToConfirm && keyFactsToConfirm.length > 0) {
            fullContent += `需确认信息\n----------\n`;
            keyFactsToConfirm.forEach((s, idx) => {
                fullContent += `${idx + 1}. ${s}\n`;
            });
            fullContent += `\n`;
        }

        if (nextSteps && nextSteps.length > 0) {
            fullContent += `下一步\n------\n`;
            nextSteps.forEach((s, idx) => {
                fullContent += `${idx + 1}. ${s}\n`;
            });
            fullContent += `\n`;
        }

        fullContent += `========================================\n正文（含AI批注）\n========================================\n\n`;
        fullContent += annotatedContent;

        if (risks && risks.length > 0) {
            fullContent += `\n\n========================================\n附录：完整风险清单\n========================================\n\n`;
            risks.forEach((risk, idx) => {
                fullContent += `${idx + 1}. [${risk.level.toUpperCase()}] ${risk.title}\n   类别: ${risk.category || '其他'}\n   条款: ${risk.clause || '未指定'}\n   风险原因/分析: ${risk.description || ''}\n`;
                if (risk.recommendation) fullContent += `   修改建议: ${risk.recommendation}\n`;
                if (risk.legalBasis) fullContent += `   法律依据: ${risk.legalBasis}\n`;
                fullContent += `\n`;
            });
        }

        // 返回文本内容（前端可以转换为 DOCX）
        res.json({ 
            content: fullContent,
            fileName: fileName || '合同审查报告'
        });

    } catch (error) {
        console.error("[Export-DOCX] Error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ============================================
 * AI 辅助接口
 * ============================================
 */
router.post('/assist', async (req, res) => {
    const { text, action } = req.body;
    
    if (!text || !action) {
        return res.status(400).json({ error: 'Text and action required' });
    }

    try {
        console.log(`[Assist] Action: ${action}, text length: ${text.length}`);
        
        const result = await performAiAction(text, action);
        res.json({ result });

    } catch (error) {
        console.error("[Assist] Error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ============================================
 * 文档列表接口
 * ============================================
 */
router.get('/', async (req, res) => {
    // 可扩展为从数据库获取
    res.json([]);
});

module.exports = router;
