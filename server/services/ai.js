/**
 * AI 服务 - 专业法律文档分析
 * 
 * 功能：
 * 1. 分块级专业分析（带上下文提示）
 * 2. 汇总级综合分析
 * 3. 向量嵌入生成
 * 4. RAG 检索增强
 */

const axios = require('axios');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');

dotenv.config();

// 创建可复用的 HTTP/HTTPS Agent，提升连接稳定性
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 120000
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 120000,
    rejectUnauthorized: true
});

const API_KEY = process.env.DASHSCOPE_API_KEY;
const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const EMBEDDING_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

/**
 * ============================================
 * 专业级法律分析提示词模板
 * ============================================
 */
const PROMPTS = {
    // 分块级分析提示词（优化：缩短但保持专业性）
    chunkAnalysis: (chunkContext) => `你是资深法律顾问，对以下合同片段进行专业法律风险审查。

## 核心要求（必须严格遵守）
1. **必须提取并引用具体合同原文**：每个风险必须包含精确的条款原文（至少20字，最多150字），必须从片段中直接提取，不能是概括
2. **详细风险说明**：每个风险必须说明为什么是风险、可能的法律后果、具体修改建议（至少100字）
3. **法律依据**：每个风险必须引用相关法律条文

## 审查重点
${chunkContext || '全面审查权利义务、违约责任、关键条款缺失、格式条款合规性'}

## 输出JSON格式（必须严格遵循）
{
  "score": 0-100整数,
  "summary": "100字内简评",
  "risks": [
    {
      "level": "high|medium|low",
      "title": "风险标题（10字以内）",
      "clause": "合同原文（精确引用，20-150字，必须从片段中提取真实原文）",
      "description": "风险分析：为什么是风险、法律后果、修改建议（至少100字，不能空泛）",
      "legalBasis": "法律依据（如《民法典》第XXX条）"
    }
  ],
  "keyTerms": ["关键术语"],
  "suggestions": ["改进建议"]
}

**重要**：
- clause字段必须是从片段中提取的真实原文，不能是概括或总结
- description必须详细说明风险原因和修改建议，不能空泛
- 如果片段开头有"[上文续]"标记，避免重复分析`,

    // 汇总分析提示词
    consolidation: (chunkCount) => `你是一位首席法律顾问，需要整合一份合同的完整法律审查报告。

## 背景
这份合同已被分为 ${chunkCount} 个片段进行独立审查。以下是各部分审查结果的汇总。

## 你的任务

将零散的风险点整合成一份**逻辑严密、专业客观、可落地**的最终法律审查报告。注意：用户抱怨“只有一段分析、维度太少、内容不具体”，因此你必须输出多维度结构化评估，每一维都要给出具体发现与建议，避免空泛措辞。

### 1. 风险整合原则
- **去重合并**：相同或相似的风险点合并为一项
- **冲突解决**：如不同片段对同一条款有不同判断，给出权威结论
- **全局视角**：从合同整体角度评估风险，而非孤立看待

### 2. 报告结构要求
- **核心结论**：200字以内概括合同整体风险水平、最主要的3个问题、建议的签署态度
- **维度评分**：至少 8 个维度，每个维度给出 0-100 分、1-2句具体发现、以及可执行建议
- **缺失条款/缺失信息**：列出导致风险或无法判断的缺失点（如：付款节点/验收标准/违约金上限/争议解决等），并说明为什么重要
- **合规清单**：格式条款、公平性、个人信息/数据安全、反商业贿赂/制裁（如适用）、劳动用工（如适用）等，逐项给状态
- **风险清单**：高风险>中风险>低风险，且每项都要有：精确条款引文（尽量直接摘录原文，<=120字）、风险原因、修改建议（最好给可替换表述）
- **总体建议与下一步**：3-8条，按优先级排序

### 3. 评分标准
- 90-100: 合同条款完善，无明显法律风险
- 70-89: 存在轻微风险，建议优化但不影响签署
- 50-69: 存在中等风险，建议修改后签署
- 30-49: 存在重大风险，不建议签署
- 0-29: 存在致命法律风险，强烈建议拒绝

## 输出格式

**必须**以有效 JSON 格式返回：

{
  "score": 0-100的整数，表示合同整体合规得分,
  "riskLevel": "low|medium|high|critical（根据风险情况给出）",
  "summary": "200字以内的专业总结，包含：1）合同类型判断 2）整体风险评级 3）核心问题概述 4）签署建议",
  "contractProfile": {
    "contractType": "合同类型判断（如：服务合同/采购合同/劳动合同等；不确定则写'未明确'）",
    "parties": ["甲方/乙方/丙方等主体名称（不确定可写'未明确'）"],
    "term": "期限/起止/续展要点（无则写'未明确'）",
    "subjectMatter": "标的/服务范围要点（无则写'未明确'）",
    "payment": "价款/付款节点/发票税费要点（无则写'未明确'）",
    "deliveryAndAcceptance": "交付/验收标准要点（无则写'未明确'）",
    "disputeResolution": "争议解决/管辖/仲裁/法律适用（无则写'未明确'）"
  },
  "riskCategories": {
    "高风险领域": ["领域1", "领域2"],
    "中风险领域": ["领域3"],
    "需关注领域": ["领域4"]
  },
  "dimensionScores": [
    {
      "dimension": "权利义务对等性",
      "score": 0-100,
      "findings": ["1-2条具体发现（避免空话）"],
      "recommendations": ["可执行建议（尽量给出修改方向）"]
    }
  ],
  "missingItems": [
    {
      "item": "缺失条款/缺失信息点（如：验收标准/付款节点/违约金上限/不可抗力/通知送达等）",
      "whyImportant": "为什么重要（风险后果）",
      "suggestion": "补充建议（可给示例表述/谈判要点）"
    }
  ],
  "complianceChecklist": [
    {
      "topic": "格式条款提示说明/公平性/数据合规/劳动合规等",
      "status": "ok|risk|missing|na",
      "notes": "简要说明（尽量引用或指出具体条款位置）"
    }
  ],
  "risks": [
    {
      "level": "high|medium|low",
      "title": "风险标题",
      "category": "风险所属类别（如：违约责任、知识产权等）",
      "clause": "涉及条款原文摘录（尽量精确引用，<=120字；无法摘录则写概括）",
      "riskReason": "为什么是风险（具体到法律逻辑/可被利用点/不利后果）",
      "recommendation": "如何改（尽量给可替换表述或谈判底线）",
      "legalBasis": "可选：相关法律条文（如《民法典》第XXX条）"
    }
  ],
  "overallSuggestions": [
    "针对整份合同的宏观修改建议（3-5条）"
  ],
  "keyFactsToConfirm": ["需补充/需确认的关键信息（3-10条）"],
  "nextSteps": ["下一步行动建议（如：要求对方补充附件、补充验收条款、调整责任上限等，3-8条）"],
  "signRecommendation": "签署建议：可签署/修改后签署/暂缓签署/建议拒绝（保持简短）"
}`,

    // RAG 问答提示词
    ragQuery: (context) => `你是一位专业的法律顾问AI助手。基于以下合同内容回答用户的问题。

## 相关合同内容
${context}

## 回答要求
1. 答案必须基于提供的合同内容，不要编造
2. 如果内容中没有相关信息，明确告知用户
3. 引用具体条款时要标注出处
4. 语言专业但易懂

请用中文回答用户问题。`,

    // AI 助手操作提示词
    actions: {
        summary: `你是一位资深法律文书专家。请对以下合同文本进行专业摘要：

要求：
1. 提取合同核心要素（主体、标的、金额、期限、关键义务）
2. 概括主要条款内容
3. 指出值得关注的特殊约定
4. 语言简洁专业，控制在500字以内

以结构化方式输出：
【合同类型】
【签约主体】
【核心条款】
【特殊约定】
【摘要总结】`,

        extract_terms: `你是一位法律术语专家。请从以下合同文本中提取关键法律术语和定义：

要求：
1. 识别合同中明确定义的专有名词
2. 提取关键法律术语及其在本合同中的含义
3. 标注重要的数字、日期、金额等关键信息
4. 按重要性排序

输出格式：
## 合同定义术语
- **术语名称**: 定义内容

## 关键法律术语
- **术语**: 在本合同中的适用解释

## 关键数据
- 金额/日期/期限等`,

        translate: `你是一位专业的法律翻译专家，精通中英双语法律文书翻译。

请翻译以下法律文本：
- 如果是中文，翻译成英文
- 如果是英文，翻译成中文

翻译要求：
1. 保持法律术语的准确性和专业性
2. 保留原文的法律效力表述
3. 必要时添加译注说明文化差异
4. 格式与原文保持一致`,

        clause_compare: `你是一位合同比对专家。请对以下条款进行分析：

要求：
1. 识别条款中对双方权利义务的界定
2. 分析条款是否公平对等
3. 与行业标准条款进行对比
4. 指出可能的协商修改点

输出格式：
【条款解读】
【公平性分析】
【行业对比】
【修改建议】`
    }
};

/**
 * ============================================
 * API 调用函数
 * ============================================
 */

/**
 * 调用 AI API 进行文本分析
 */
const callAI = async (systemPrompt, userContent, options = {}) => {
    const { 
        model = 'qwen-turbo',  // 使用更快的模型
        temperature = 0.3,    // 降低随机性，提高一致性
        jsonMode = true,
        maxRetries = 3,  // 增加重试次数，应对网络问题
        maxContentLength = 5000,  // 增大到5000以匹配分块大小
        timeout = 120000  // 增加到120秒，给网络更多时间
    } = options;

    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // 限制内容长度，避免超时
            const truncatedContent = userContent.length > maxContentLength 
                ? userContent.substring(0, maxContentLength) + `\n\n[内容已截断，仅分析前${maxContentLength}字符]`
                : userContent;

            const requestBody = {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: truncatedContent }
                ],
                temperature
            };

            if (jsonMode) {
                requestBody.response_format = { type: "json_object" };
            }

            // 配置 axios 请求，增加网络稳定性
            const response = await axios.post(API_URL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'Connection': 'keep-alive'
                },
                timeout: timeout,
                maxRedirects: 5,
                validateStatus: (status) => status < 500, // 允许 4xx 状态码，只重试 5xx
                // 使用预定义的 Agent，提升连接复用
                httpAgent: httpAgent,
                httpsAgent: httpsAgent
            });

            const content = response.data.choices[0].message.content;
            
            if (jsonMode) {
                try {
                    return JSON.parse(content);
                } catch (parseError) {
                    // 尝试提取 JSON
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        return JSON.parse(jsonMatch[0]);
                    }
                    throw new Error('Failed to parse JSON response');
                }
            }
            
            return content;

        } catch (error) {
            lastError = error;
            const isNetworkError = error.code === 'ECONNRESET' || 
                                 error.code === 'ETIMEDOUT' || 
                                 error.code === 'ECONNREFUSED' ||
                                 error.code === 'ENOTFOUND' ||
                                 error.message?.includes('socket') ||
                                 error.message?.includes('network') ||
                                 error.message?.includes('ECONNRESET') ||
                                 error.message?.includes('ETIMEDOUT');
            
            console.error(`AI API attempt ${attempt}/${maxRetries} failed:`, error.message, error.code);
            
            if (attempt < maxRetries) {
                // 网络错误使用更长的退避时间
                const backoffTime = isNetworkError 
                    ? Math.pow(2, attempt) * 3000  // 网络错误：3秒、6秒、12秒（增加等待时间）
                    : Math.pow(2, attempt) * 1000; // 其他错误：1秒、2秒、4秒
                
                console.log(`[Retry] Waiting ${backoffTime/1000} seconds before retry ${attempt + 1}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
            } else {
                // 最后一次尝试失败，抛出更友好的错误
                if (isNetworkError) {
                    console.error('[AI API] All retries failed due to network error');
                    throw new Error('网络连接不稳定，请检查网络后重试');
                }
                console.error('[AI API] All retries failed:', error.message);
            }
        }
    }

    // 如果所有重试都失败，抛出最后一个错误
    if (lastError) {
        throw lastError;
    }
    throw new Error('AI API 调用失败');
};

/**
 * 分析单个文档分块
 */
const analyzeChunk = async (chunkContent, chunkContext = '') => {
    // 验证输入
    if (!chunkContent || (typeof chunkContent === 'string' && chunkContent.trim().length === 0)) {
        console.warn('analyzeChunk: Empty content provided');
        return {
            score: 50,
            summary: '分块内容为空，跳过分析',
            risks: [],
            keyTerms: [],
            suggestions: []
        };
    }

    const systemPrompt = PROMPTS.chunkAnalysis(chunkContext);
    
    try {
        // 确保内容为字符串
        const contentStr = typeof chunkContent === 'string' ? chunkContent : JSON.stringify(chunkContent);
        
        const result = await callAI(systemPrompt, contentStr, {
            model: 'qwen-turbo',  // 使用更快的模型
            temperature: 0.2,
            timeout: 90000,  // 减少到90秒，加快响应
            maxRetries: 2,  // 减少重试次数，加快失败响应
            maxContentLength: 6000  // 匹配分块大小
        });
        
        // 验证并规范化结果
        if (!result || typeof result !== 'object') {
            throw new Error('Invalid AI response format');
        }
        
        // 验证风险数据质量：确保有clause和description
        const validatedRisks = (result.risks || []).map(r => {
            // 如果clause为空或太短，尝试从description中提取或标记为无效
            const clause = (r.clause || '').trim();
            const description = (r.description || '').trim();
            
            // 如果clause太短（少于10字），认为无效
            if (clause.length < 10) {
                console.warn(`[analyzeChunk] Risk "${r.title}" has invalid clause, skipping`);
                return null;
            }
            
            // 如果description太短（少于30字），认为不够详细
            if (description.length < 30) {
                console.warn(`[analyzeChunk] Risk "${r.title}" has insufficient description`);
            }
            
            return {
                level: ['high', 'medium', 'low'].includes(r.level) ? r.level : 'low',
                title: r.title || '未命名风险',
                clause: clause,
                description: description || '风险分析不完整',
                legalBasis: r.legalBasis || ''
            };
        }).filter(r => r !== null); // 过滤掉无效风险
        
        return {
            score: Math.max(0, Math.min(100, result.score || 50)),
            summary: result.summary || '无法生成摘要',
            risks: validatedRisks,  // 使用验证后的风险列表
            keyTerms: result.keyTerms || [],
            suggestions: result.suggestions || []
        };
    } catch (error) {
        console.error('Chunk analysis failed:', error.message, error.stack);
        // 返回空结果，不包含错误信息，避免错误信息出现在最终报告中
        return {
            score: 50,
            summary: '该片段分析跳过',
            risks: [],
            keyTerms: [],
            suggestions: []
        };
    }
};

/**
 * 汇总分析结果
 */
const consolidateAnalysis = async (chunkResults, chunkCount) => {
    const systemPrompt = PROMPTS.consolidation(chunkCount);
    
    // 构建汇总内容
    const summaryContext = chunkResults.map((r, i) => 
        `【片段 ${i + 1}/${chunkCount}】\n得分: ${r.score}\n摘要: ${r.summary}\n关键术语: ${r.keyTerms?.join(', ') || '无'}`
    ).join('\n\n');
    
    const risksContext = chunkResults
        .flatMap(r => r.risks || [])
        // 限制数量，避免输入过长
        .slice(0, 80)
        .map(r => {
            const clause = (r.clause || '').replace(/\s+/g, ' ').trim();
            const clauseShort = clause.length > 120 ? clause.substring(0, 120) + '…' : clause;
            const desc = (r.description || '').replace(/\s+/g, ' ').trim();
            const descShort = desc.length > 200 ? desc.substring(0, 200) + '…' : desc;
            return `- [${(r.level || 'low').toUpperCase()}] ${r.title || '未命名风险'} | 条款: ${clauseShort || '未提供原文摘录'} | 分析: ${descShort}${r.legalBasis ? ` (${r.legalBasis})` : ''}`;
        })
        .join('\n');

    const userContent = `
## 各片段分析摘要
${summaryContext}

## 已识别的风险点（中高风险）
${risksContext || '未发现中高风险'}

## 各片段改进建议汇总
${chunkResults.flatMap(r => r.suggestions || []).join('\n')}

请整合以上信息，生成最终法律审查报告。
    `;

    try {
        // 限制汇总内容长度，加快响应
        const maxSummaryLength = 8000;  // 减少汇总内容长度
        const truncatedContent = userContent.length > maxSummaryLength 
            ? userContent.substring(0, maxSummaryLength) + '\n\n[内容已截断，仅汇总前8000字符]'
            : userContent;
            
        const result = await callAI(systemPrompt, truncatedContent, {
            model: 'qwen-turbo',  // 使用更快的模型
            temperature: 0.3,
            timeout: 90000,  // 减少到90秒，加快响应
            maxRetries: 2,  // 减少重试次数
            maxContentLength: 8000  // 限制汇总内容长度
        });

        return {
            score: Math.max(0, Math.min(100, result.score || 50)),
            riskLevel: ['low', 'medium', 'high', 'critical'].includes(result.riskLevel) ? result.riskLevel : undefined,
            summary: result.summary || '无法生成总结',
            contractProfile: result.contractProfile || undefined,
            riskCategories: result.riskCategories || {},
            dimensionScores: Array.isArray(result.dimensionScores) ? result.dimensionScores : [],
            missingItems: Array.isArray(result.missingItems) ? result.missingItems : [],
            complianceChecklist: Array.isArray(result.complianceChecklist) ? result.complianceChecklist : [],
            // 确保风险清单完整：合并汇总结果和分块结果
            risks: (() => {
                // 先处理汇总结果的风险，验证质量
                const consolidatedRisks = (result.risks || []).map(r => ({
                    level: ['high', 'medium', 'low'].includes(r.level) ? r.level : 'low',
                    title: r.title || '未命名风险',
                    clause: (r.clause || '').trim(),
                    description: (r.description || r.riskReason || '').trim(),
                    recommendation: r.recommendation || '',
                    legalBasis: r.legalBasis || '',
                    category: r.category || '其他'
                })).filter(r => r.clause.length >= 10 && r.description.length >= 30); // 过滤无效风险
                
                // 如果汇总结果中没有有效风险，从分块结果中提取
                if (consolidatedRisks.length === 0) {
                    console.log('[consolidateAnalysis] No valid risks in consolidated result, using chunk results');
                    const chunkRisks = chunkResults.flatMap(r => r.risks || []).map(r => ({
                        level: ['high', 'medium', 'low'].includes(r.level) ? r.level : 'low',
                        title: r.title || '未命名风险',
                        clause: (r.clause || '').trim(),
                        description: (r.description || '').trim(),
                        recommendation: r.recommendation || '',
                        legalBasis: r.legalBasis || '',
                        category: r.category || '其他'
                    })).filter(r => r.clause.length >= 10 && r.description.length >= 30); // 只保留有效风险
                    
                    // 去重：基于 title 和 clause 的前50个字符
                    const uniqueRisks = [];
                    const seen = new Set();
                    for (const risk of chunkRisks) {
                        const key = `${risk.title}_${risk.clause.substring(0, 50)}`;
                        if (!seen.has(key) && risk.title && risk.title !== '未命名风险') {
                            seen.add(key);
                            uniqueRisks.push(risk);
                        }
                    }
                    
                    // 按风险等级排序
                    uniqueRisks.sort((a, b) => {
                        const order = { high: 3, medium: 2, low: 1 };
                        return (order[b.level] || 0) - (order[a.level] || 0);
                    });
                    
                    return uniqueRisks;
                }
                
                // 汇总结果有风险，按等级排序
                consolidatedRisks.sort((a, b) => {
                    const order = { high: 3, medium: 2, low: 1 };
                    return (order[b.level] || 0) - (order[a.level] || 0);
                });
                
                return consolidatedRisks;
            })(),
            overallSuggestions: result.overallSuggestions || [],
            keyFactsToConfirm: Array.isArray(result.keyFactsToConfirm) ? result.keyFactsToConfirm : [],
            nextSteps: Array.isArray(result.nextSteps) ? result.nextSteps : [],
            signRecommendation: result.signRecommendation || '需人工复核'
        };
    } catch (error) {
        console.error('Consolidation failed:', error.message);
        
        // 降级处理：基于分块结果直接聚合，确保风险清单完整
        const allRisksRaw = chunkResults.flatMap(r => r.risks || []).map(r => ({
            level: ['high', 'medium', 'low'].includes(r.level) ? r.level : 'low',
            title: r.title || '未命名风险',
            clause: r.clause || '',
            description: r.description || '',
            recommendation: r.recommendation || '',
            legalBasis: r.legalBasis || '',
            category: r.category || '其他'
        }));
        
        // 去重：基于 title 和 clause 的前50个字符
        const uniqueRisks = [];
        const seen = new Set();
        for (const risk of allRisksRaw) {
            const key = `${risk.title}_${(risk.clause || '').substring(0, 50)}`;
            if (!seen.has(key) && risk.title && risk.title !== '未命名风险') {
                seen.add(key);
                uniqueRisks.push(risk);
            }
        }
        
        // 按风险等级排序：high > medium > low
        uniqueRisks.sort((a, b) => {
            const order = { high: 3, medium: 2, low: 1 };
            return (order[b.level] || 0) - (order[a.level] || 0);
        });
        
        const avgScore = Math.round(chunkResults.reduce((sum, r) => sum + (r.score || 50), 0) / chunkResults.length);
        // 过滤掉包含错误信息的摘要
        const validSummaries = chunkResults
            .map(r => r.summary)
            .filter(s => s && !s.includes('分析失败') && !s.includes('网络连接') && s !== '该片段分析跳过');
        
        // 生成风险分类
        const riskCategories = {};
        uniqueRisks.forEach(risk => {
            const category = risk.category || '其他';
            if (!riskCategories[category]) {
                riskCategories[category] = [];
            }
            if (!riskCategories[category].includes(risk.title)) {
                riskCategories[category].push(risk.title);
            }
        });
        
        return {
            score: avgScore,
            riskLevel: avgScore >= 80 ? 'low' : avgScore >= 60 ? 'medium' : avgScore >= 40 ? 'high' : 'critical',
            summary: validSummaries.length > 0 
                ? `合同共分${chunkCount}段分析，平均得分${avgScore}分，发现${uniqueRisks.length}个风险点。${validSummaries.slice(0, 3).join('；')}`
                : `合同共分${chunkCount}段分析，平均得分${avgScore}分，发现${uniqueRisks.length}个风险点。`,
            contractProfile: undefined,
            riskCategories: riskCategories,  // 添加风险分类
            dimensionScores: [],
            missingItems: [],
            complianceChecklist: [],
            risks: uniqueRisks,  // 确保风险清单返回（已去重和排序）
            overallSuggestions: chunkResults.flatMap(r => r.suggestions || []).slice(0, 5),
            keyFactsToConfirm: [],
            nextSteps: [],
            signRecommendation: avgScore >= 70 ? '建议人工复核后签署' : avgScore >= 50 ? '建议修改后签署' : '建议暂缓签署'
        };
    }
};

/**
 * 执行 AI 助手操作
 */
const performAiAction = async (text, action) => {
    const actionPrompt = PROMPTS.actions[action];
    if (!actionPrompt) {
        throw new Error(`Invalid action: ${action}`);
    }

    return await callAI(actionPrompt, text, { 
        jsonMode: false,
        temperature: 0.4,
        timeout: 120000
    });
};

/**
 * ============================================
 * 向量嵌入服务
 * ============================================
 */

/**
 * 生成文本向量嵌入
 */
const getEmbedding = async (text, textType = 'document') => {
    try {
        const response = await axios.post(
            EMBEDDING_URL,
            {
                model: 'text-embedding-v3',  // 使用更新的嵌入模型
                input: { texts: [text.substring(0, 8000)] }, // 限制长度
                parameters: { text_type: textType }
            },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        if (response.data?.output?.embeddings?.[0]?.embedding) {
            return response.data.output.embeddings[0].embedding;
        }
        throw new Error('Invalid embedding response structure');
    } catch (error) {
        console.error('Embedding generation failed:', error.message);
        throw error;
    }
};

/**
 * 批量生成嵌入
 */
const getBatchEmbeddings = async (texts, textType = 'document') => {
    try {
        // 限制单次请求数量
        const batchSize = 10;
        const results = [];
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize).map(t => t.substring(0, 8000));
            
            const response = await axios.post(
                EMBEDDING_URL,
                {
                    model: 'text-embedding-v3',
                    input: { texts: batch },
                    parameters: { text_type: textType }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                }
            );

            if (response.data?.output?.embeddings) {
                results.push(...response.data.output.embeddings.map(e => e.embedding));
            }
            
            // 避免速率限制
            if (i + batchSize < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        return results;
    } catch (error) {
        console.error('Batch embedding failed:', error.message);
        throw error;
    }
};

/**
 * RAG 问答
 */
const ragQuery = async (question, relevantChunks) => {
    const context = relevantChunks
        .map((chunk, i) => `[片段 ${i + 1}]\n${chunk.content}`)
        .join('\n\n---\n\n');
    
    const systemPrompt = PROMPTS.ragQuery(context);
    
    return await callAI(systemPrompt, question, {
        jsonMode: false,
        temperature: 0.5
    });
};

/**
 * 向后兼容的分析函数
 */
const analyzeContract = async (text) => {
    const isConsolidation = text.includes("SUMMARY CONTEXT:") || text.includes("各片段分析摘要");
    
    if (isConsolidation) {
        // 旧版汇总调用
        return await callAI(PROMPTS.consolidation(1), text, { temperature: 0.3 });
    } else {
        // 旧版单块分析
        return await analyzeChunk(text, '');
    }
};

module.exports = { 
    // 核心分析函数
    analyzeChunk,
    consolidateAnalysis,
    analyzeContract,  // 向后兼容
    
    // AI 助手
    performAiAction,
    
    // 向量服务
    getEmbedding,
    getBatchEmbeddings,
    
    // RAG
    ragQuery,
    
    // 提示词模板（供测试使用）
    PROMPTS
};
