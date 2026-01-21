/**
 * RAG (检索增强生成) 服务
 * 
 * 功能：
 * 1. 文档向量化存储
 * 2. 语义相似度检索
 * 3. 上下文构建
 * 4. 查询优化
 */

const supabase = require('./db');
const { getEmbedding, getBatchEmbeddings, ragQuery } = require('./ai');
const { smartChunk, getChunkPromptContext, estimateTokens } = require('./chunker');

/**
 * 向量存储服务
 */
class VectorStore {
    constructor() {
        this.embeddingDimension = 1024; // text-embedding-v3 默认维度
    }

    /**
     * 为文档创建向量索引
     */
    async indexDocument(documentId, text, metadata = {}) {
        console.log(`[RAG] Starting document indexing for: ${documentId}`);
        
        try {
            // 1. 智能分块
            const chunks = smartChunk(text);
            console.log(`[RAG] Document split into ${chunks.length} chunks`);

            // 2. 批量生成嵌入向量
            const chunkTexts = chunks.map(c => c.content);
            let embeddings;
            
            try {
                embeddings = await getBatchEmbeddings(chunkTexts);
            } catch (embError) {
                console.error('[RAG] Batch embedding failed, falling back to individual:', embError.message);
                // 降级为逐个生成
                embeddings = [];
                for (const text of chunkTexts) {
                    try {
                        const emb = await getEmbedding(text);
                        embeddings.push(emb);
                    } catch (e) {
                        embeddings.push(null);
                    }
                }
            }

            // 3. 存储分块和向量
            const chunkRecords = chunks.map((chunk, index) => ({
                document_id: documentId,
                content: chunk.content,
                embedding: embeddings[index] || null,
                metadata: {
                    ...chunk.metadata,
                    ...metadata,
                    indexed_at: new Date().toISOString()
                }
            }));

            // 分批插入（避免单次插入过多）
            const batchSize = 20;
            for (let i = 0; i < chunkRecords.length; i += batchSize) {
                const batch = chunkRecords.slice(i, i + batchSize);
                const { error } = await supabase
                    .from('document_chunks')
                    .insert(batch);
                
                if (error) {
                    console.error(`[RAG] Batch insert error at ${i}:`, error);
                }
            }

            console.log(`[RAG] Successfully indexed ${chunkRecords.length} chunks`);
            
            return {
                success: true,
                chunkCount: chunkRecords.length,
                chunks: chunks // 返回分块供后续分析使用
            };

        } catch (error) {
            console.error('[RAG] Document indexing failed:', error);
            throw error;
        }
    }

    /**
     * 语义相似度搜索
     */
    async semanticSearch(query, options = {}) {
        const {
            documentId = null,      // 限定文档范围
            matchThreshold = 0.5,   // 相似度阈值
            matchCount = 5,         // 返回数量
            includeMetadata = true
        } = options;

        try {
            // 1. 生成查询向量
            const queryEmbedding = await getEmbedding(query, 'query');
            
            // 2. 调用 Supabase 向量搜索函数
            let result;
            
            if (documentId) {
                // 在特定文档中搜索
                const { data, error } = await supabase.rpc('match_documents_in_doc', {
                    query_embedding: queryEmbedding,
                    match_threshold: matchThreshold,
                    match_count: matchCount,
                    target_document_id: documentId
                });
                
                if (error) {
                    // 降级为通用搜索后过滤
                    console.warn('[RAG] Specific doc search failed, using fallback:', error.message);
                    result = await this.fallbackSearch(queryEmbedding, documentId, matchCount);
                } else {
                    result = data;
                }
            } else {
                // 全局搜索
                const { data, error } = await supabase.rpc('match_documents', {
                    query_embedding: queryEmbedding,
                    match_threshold: matchThreshold,
                    match_count: matchCount
                });
                
                if (error) throw error;
                result = data;
            }

            // 3. 获取完整元数据
            if (includeMetadata && result?.length > 0) {
                const chunkIds = result.map(r => r.id);
                const { data: fullChunks } = await supabase
                    .from('document_chunks')
                    .select('id, content, metadata')
                    .in('id', chunkIds);
                
                if (fullChunks) {
                    const metadataMap = new Map(fullChunks.map(c => [c.id, c]));
                    result = result.map(r => ({
                        ...r,
                        metadata: metadataMap.get(r.id)?.metadata || {}
                    }));
                }
            }

            return result || [];

        } catch (error) {
            console.error('[RAG] Semantic search failed:', error);
            return [];
        }
    }

    /**
     * 降级搜索方案（当自定义函数不可用时）
     */
    async fallbackSearch(queryEmbedding, documentId, limit) {
        try {
            // 获取文档的所有分块
            const { data: chunks } = await supabase
                .from('document_chunks')
                .select('id, document_id, content, embedding')
                .eq('document_id', documentId);

            if (!chunks || chunks.length === 0) return [];

            // 计算余弦相似度
            const similarities = chunks
                .filter(c => c.embedding)
                .map(chunk => ({
                    id: chunk.id,
                    document_id: chunk.document_id,
                    content: chunk.content,
                    similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding)
                }))
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);

            return similarities;
        } catch (error) {
            console.error('[RAG] Fallback search failed:', error);
            return [];
        }
    }

    /**
     * 计算余弦相似度
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * 删除文档的所有向量
     */
    async deleteDocumentVectors(documentId) {
        try {
            const { error } = await supabase
                .from('document_chunks')
                .delete()
                .eq('document_id', documentId);
            
            if (error) throw error;
            console.log(`[RAG] Deleted vectors for document: ${documentId}`);
            return true;
        } catch (error) {
            console.error('[RAG] Delete vectors failed:', error);
            return false;
        }
    }
}

/**
 * RAG 查询管道
 */
class RAGPipeline {
    constructor() {
        this.vectorStore = new VectorStore();
        this.maxContextTokens = 4000; // 上下文最大 token 数
    }

    /**
     * 构建查询上下文
     */
    async buildContext(query, documentId, options = {}) {
        const {
            maxChunks = 5,
            minSimilarity = 0.5
        } = options;

        // 1. 检索相关片段
        const relevantChunks = await this.vectorStore.semanticSearch(query, {
            documentId,
            matchThreshold: minSimilarity,
            matchCount: maxChunks
        });

        if (relevantChunks.length === 0) {
            return { context: '', chunks: [], tokenCount: 0 };
        }

        // 2. 按相关性和 token 限制选择片段
        let context = '';
        let tokenCount = 0;
        const selectedChunks = [];

        for (const chunk of relevantChunks) {
            const chunkTokens = estimateTokens(chunk.content);
            
            if (tokenCount + chunkTokens <= this.maxContextTokens) {
                context += `\n\n---\n[相关度: ${(chunk.similarity * 100).toFixed(1)}%]\n${chunk.content}`;
                tokenCount += chunkTokens;
                selectedChunks.push(chunk);
            }
        }

        return {
            context: context.trim(),
            chunks: selectedChunks,
            tokenCount
        };
    }

    /**
     * RAG 增强问答
     */
    async query(question, documentId) {
        try {
            // 1. 构建上下文
            const { context, chunks, tokenCount } = await this.buildContext(question, documentId);

            if (!context) {
                return {
                    answer: '抱歉，在文档中未找到与您问题相关的内容。请尝试换一种方式提问，或确保文档已正确上传和索引。',
                    sources: [],
                    confidence: 0
                };
            }

            // 2. 调用 AI 生成回答
            const answer = await ragQuery(question, chunks);

            // 3. 计算置信度
            const avgSimilarity = chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length;

            return {
                answer,
                sources: chunks.map(c => ({
                    content: c.content.substring(0, 200) + '...',
                    similarity: c.similarity
                })),
                confidence: avgSimilarity,
                contextTokens: tokenCount
            };

        } catch (error) {
            console.error('[RAG] Query failed:', error);
            return {
                answer: '处理您的问题时出现错误，请稍后重试。',
                sources: [],
                confidence: 0,
                error: error.message
            };
        }
    }

    /**
     * 获取文档索引统计
     */
    async getIndexStats(documentId) {
        try {
            const { data, error } = await supabase
                .from('document_chunks')
                .select('id, metadata')
                .eq('document_id', documentId);

            if (error) throw error;

            const hasEmbedding = data.filter(c => c.metadata?.indexed_at).length;

            return {
                totalChunks: data.length,
                indexedChunks: hasEmbedding,
                isFullyIndexed: hasEmbedding === data.length
            };
        } catch (error) {
            return { totalChunks: 0, indexedChunks: 0, isFullyIndexed: false };
        }
    }
}

// 导出单例
const vectorStore = new VectorStore();
const ragPipeline = new RAGPipeline();

module.exports = {
    vectorStore,
    ragPipeline,
    VectorStore,
    RAGPipeline
};
