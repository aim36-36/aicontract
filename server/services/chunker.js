/**
 * 智能法律文档分块服务
 * 
 * 特点：
 * 1. 语义完整性保持 - 按法律条款结构分割
 * 2. 中文友好分割 - 正确处理中文标点和结构
 * 3. 重叠策略 - 避免截断重要信息
 * 4. 预留空间 - 为提示词和回答预留 token 空间
 */

// Token 估算：中文约 1.5 字符/token，英文约 4 字符/token
const estimateTokens = (text) => {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars * 0.7 + otherChars * 0.25);
};

// 检测文本语言主体
const detectLanguage = (text) => {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    return chineseChars / text.length > 0.3 ? 'zh' : 'en';
};

/**
 * 法律条款模式识别
 */
const LEGAL_PATTERNS = {
    // 中文法律条款模式
    zh: {
        article: /^第[一二三四五六七八九十百千零\d]+[条章节款项]/,
        numberedClause: /^[（\(]?[一二三四五六七八九十\d]+[）\)、．.]/,
        subClause: /^[\s　]*[①②③④⑤⑥⑦⑧⑨⑩\d]+[、．.）\)]/,
        sectionHeader: /^[【】「」『』【】].*?[【】「」『』【】]$/,
        signature: /^(甲方|乙方|丙方|签章|签字|盖章|日期|地址)/,
    },
    // 英文法律条款模式
    en: {
        article: /^(Article|Section|ARTICLE|SECTION)\s*[\d.]+/i,
        numberedClause: /^\d+[\.\)]\s+/,
        subClause: /^[\s]*[a-z]\)|^\s*\([a-z]\)/i,
        sectionHeader: /^[A-Z][A-Z\s]+$/,
        signature: /^(IN WITNESS WHEREOF|EXECUTED|Signature|Date|Address)/i,
    }
};

/**
 * 中文分句（保持语义完整性）
 */
const splitChineseSentences = (text) => {
    // 中文句末标点
    const sentenceEnders = /([。！？；;!?])/;
    const parts = text.split(sentenceEnders);
    const sentences = [];
    
    for (let i = 0; i < parts.length; i += 2) {
        const sentence = parts[i] + (parts[i + 1] || '');
        if (sentence.trim()) {
            sentences.push(sentence.trim());
        }
    }
    
    return sentences;
};

/**
 * 识别法律文档结构段落
 */
const identifyLegalStructure = (text, lang) => {
    const patterns = LEGAL_PATTERNS[lang];
    const lines = text.split(/\r?\n/);
    const segments = [];
    let currentSegment = {
        type: 'content',
        content: '',
        importance: 'normal'
    };
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            if (currentSegment.content) {
                currentSegment.content += '\n';
            }
            continue;
        }
        
        // 检测段落类型
        let newSegmentType = null;
        let importance = 'normal';
        
        if (patterns.article.test(trimmedLine)) {
            newSegmentType = 'article';
            importance = 'high';
        } else if (patterns.numberedClause.test(trimmedLine)) {
            newSegmentType = 'clause';
            importance = 'high';
        } else if (patterns.sectionHeader.test(trimmedLine)) {
            newSegmentType = 'header';
            importance = 'high';
        } else if (patterns.signature.test(trimmedLine)) {
            newSegmentType = 'signature';
            importance = 'low';
        }
        
        // 如果检测到新的结构段落，保存当前段落
        if (newSegmentType && currentSegment.content.trim()) {
            segments.push({ ...currentSegment });
            currentSegment = {
                type: newSegmentType,
                content: trimmedLine,
                importance
            };
        } else {
            currentSegment.content += (currentSegment.content ? '\n' : '') + trimmedLine;
            if (newSegmentType) {
                currentSegment.type = newSegmentType;
                currentSegment.importance = importance;
            }
        }
    }
    
    // 添加最后一个段落
    if (currentSegment.content.trim()) {
        segments.push(currentSegment);
    }
    
    return segments;
};

/**
 * 智能分块配置
 */
const CHUNK_CONFIG = {
    // qwen-turbo 最大上下文约 8K，预留空间给提示词(~1K)和回答(~2K)
    // 进一步增大分块大小以减少分块数量，大幅提升速度
    maxChunkTokens: 6000,  // 从5000增加到6000，减少分块数量
    // 重叠 token 数，避免截断重要上下文
    overlapTokens: 300,  // 适当增加重叠，确保重要信息不丢失
    // 最小分块大小（避免过小的分块）
    minChunkTokens: 800,  // 从500增加到800，减少小分块
    // 提示词预留 token
    promptReserve: 1000,  // 保持1000
    // 回答预留 token
    responseReserve: 1500,  // 保持1500
};

/**
 * 主分块函数 - 语义感知智能分块
 * 
 * @param {string} text - 原始文档文本
 * @param {object} options - 分块选项
 * @returns {Array<{content: string, metadata: object}>} - 分块结果
 */
const smartChunk = (text, options = {}) => {
    const config = { ...CHUNK_CONFIG, ...options };
    const lang = detectLanguage(text);
    
    // 1. 识别法律文档结构
    const segments = identifyLegalStructure(text, lang);
    
    // 2. 按语义完整性分块
    const chunks = [];
    let currentChunk = {
        content: '',
        tokens: 0,
        segments: [],
        startIndex: 0,
        importance: 'normal'
    };
    
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentTokens = estimateTokens(segment.content);
        
        // 如果单个段落超过最大限制，需要进一步切分
        if (segmentTokens > config.maxChunkTokens) {
            // 保存当前分块
            if (currentChunk.content) {
                chunks.push(finalizeChunk(currentChunk, chunks.length));
            }
            
            // 对超长段落进行句子级切分
            const subChunks = splitLongSegment(segment, config, lang);
            chunks.push(...subChunks.map((c, idx) => finalizeChunk(c, chunks.length + idx)));
            
            // 重置当前分块（带重叠）
            currentChunk = createOverlapChunk(subChunks[subChunks.length - 1], config);
            continue;
        }
        
        // 检查是否可以添加到当前分块
        if (currentChunk.tokens + segmentTokens <= config.maxChunkTokens) {
            currentChunk.content += (currentChunk.content ? '\n\n' : '') + segment.content;
            currentChunk.tokens += segmentTokens;
            currentChunk.segments.push(segment.type);
            if (segment.importance === 'high') {
                currentChunk.importance = 'high';
            }
        } else {
            // 保存当前分块并开始新分块
            if (currentChunk.content) {
                chunks.push(finalizeChunk(currentChunk, chunks.length));
            }
            
            // 创建带重叠的新分块
            currentChunk = createOverlapChunk(currentChunk, config);
            currentChunk.content += (currentChunk.content ? '\n\n' : '') + segment.content;
            currentChunk.tokens = estimateTokens(currentChunk.content);
            currentChunk.segments = [segment.type];
            currentChunk.importance = segment.importance;
        }
    }
    
    // 添加最后一个分块
    if (currentChunk.content && currentChunk.tokens >= config.minChunkTokens) {
        chunks.push(finalizeChunk(currentChunk, chunks.length));
    } else if (currentChunk.content && chunks.length > 0) {
        // 如果最后一个分块太小，合并到前一个
        const lastChunk = chunks[chunks.length - 1];
        lastChunk.content += '\n\n' + currentChunk.content;
        lastChunk.metadata.tokens = estimateTokens(lastChunk.content);
    }
    
    return chunks;
};

/**
 * 对超长段落进行句子级切分
 */
const splitLongSegment = (segment, config, lang) => {
    const sentences = lang === 'zh' 
        ? splitChineseSentences(segment.content)
        : segment.content.split(/(?<=[.!?;])\s+/);
    
    const subChunks = [];
    let currentSubChunk = {
        content: '',
        tokens: 0,
        segments: [segment.type],
        importance: segment.importance
    };
    
    for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);
        
        if (currentSubChunk.tokens + sentenceTokens <= config.maxChunkTokens) {
            currentSubChunk.content += (currentSubChunk.content ? ' ' : '') + sentence;
            currentSubChunk.tokens += sentenceTokens;
        } else {
            if (currentSubChunk.content) {
                subChunks.push(currentSubChunk);
            }
            currentSubChunk = {
                content: sentence,
                tokens: sentenceTokens,
                segments: [segment.type],
                importance: segment.importance
            };
        }
    }
    
    if (currentSubChunk.content) {
        subChunks.push(currentSubChunk);
    }
    
    return subChunks;
};

/**
 * 创建带重叠的分块
 */
const createOverlapChunk = (previousChunk, config) => {
    if (!previousChunk.content) {
        return {
            content: '',
            tokens: 0,
            segments: [],
            importance: 'normal'
        };
    }
    
    // 从上一个分块末尾提取重叠内容
    const overlapContent = extractOverlap(previousChunk.content, config.overlapTokens);
    
    return {
        content: overlapContent ? `[上文续] ${overlapContent}` : '',
        tokens: estimateTokens(overlapContent || ''),
        segments: [],
        importance: 'normal',
        hasOverlap: !!overlapContent
    };
};

/**
 * 提取重叠内容
 */
const extractOverlap = (content, targetTokens) => {
    const sentences = content.split(/(?<=[。！？.!?;；])\s*/);
    let overlapContent = '';
    let tokens = 0;
    
    // 从末尾向前收集句子
    for (let i = sentences.length - 1; i >= 0 && tokens < targetTokens; i--) {
        const sentence = sentences[i];
        const sentenceTokens = estimateTokens(sentence);
        overlapContent = sentence + (overlapContent ? ' ' + overlapContent : '');
        tokens += sentenceTokens;
    }
    
    return overlapContent;
};

/**
 * 完成分块构建，添加元数据
 */
const finalizeChunk = (chunk, index) => {
    return {
        content: chunk.content,
        metadata: {
            chunkIndex: index,
            tokens: estimateTokens(chunk.content),
            segmentTypes: [...new Set(chunk.segments)],
            importance: chunk.importance,
            hasOverlap: chunk.hasOverlap || false,
            charCount: chunk.content.length
        }
    };
};

/**
 * 根据分块类型获取专用提示词
 */
const getChunkPromptContext = (chunk) => {
    // 安全检查：确保 metadata 存在
    if (!chunk || !chunk.metadata) {
        return '对本段进行全面审查';
    }
    
    const segmentTypes = chunk.metadata.segmentTypes || [];
    const contexts = [];
    
    if (segmentTypes.includes('article') || segmentTypes.includes('clause')) {
        contexts.push('重点关注条款的权利义务分配、违约责任界定、条款有效性');
    }
    if (segmentTypes.includes('header')) {
        contexts.push('注意该部分在整体合同中的地位和与其他条款的关联');
    }
    if (segmentTypes.includes('signature')) {
        contexts.push('检查签署要件的完整性、生效条件');
    }
    
    if (chunk.metadata.importance === 'high') {
        contexts.push('此为关键条款，需进行深度分析');
    }
    
    if (chunk.metadata.hasOverlap) {
        contexts.push('此分块与上一分块有内容重叠，请注意避免重复分析');
    }
    
    return contexts.length > 0 ? contexts.join('；') : '对本段进行全面审查';
};

/**
 * 分析文档并返回分块统计
 */
const analyzeDocument = (text) => {
    const lang = detectLanguage(text);
    const segments = identifyLegalStructure(text, lang);
    const chunks = smartChunk(text);
    
    return {
        language: lang,
        totalChars: text.length,
        estimatedTokens: estimateTokens(text),
        segmentCount: segments.length,
        chunkCount: chunks.length,
        chunks: chunks,
        segmentTypes: segments.map(s => s.type),
        averageChunkTokens: Math.round(chunks.reduce((sum, c) => sum + c.metadata.tokens, 0) / chunks.length)
    };
};

// 向后兼容的简单分块函数
const splitText = (text, chunkSize = 2000, overlap = 300) => {
    const result = smartChunk(text, {
        maxChunkTokens: Math.round(chunkSize / 2),
        overlapTokens: Math.round(overlap / 2)
    });
    return result.map(c => c.content);
};

module.exports = { 
    smartChunk, 
    splitText, 
    analyzeDocument, 
    getChunkPromptContext,
    estimateTokens,
    detectLanguage,
    CHUNK_CONFIG
};
