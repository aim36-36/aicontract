-- Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table for public user profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY, -- Removed foreign key to auth.users for demo resilience
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    website TEXT,
    role TEXT,
    bio TEXT,
    
    CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Create table for storing document metadata and analysis results
CREATE TABLE public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Linked to user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'analyzed', 'error')),
    content TEXT, -- Storing extracted text for search/preview
    original_file_path TEXT, -- Path in Supabase Storage
    risk_score INTEGER,
    risks JSONB DEFAULT '[]'::jsonb, -- Store AI analysis result
    summary TEXT
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Policies for documents (Restrict access to owner)
DROP POLICY IF EXISTS "Individuals can view their own documents." ON public.documents;
DROP POLICY IF EXISTS "Individuals can insert their own documents." ON public.documents;
DROP POLICY IF EXISTS "Individuals can update their own documents." ON public.documents;
DROP POLICY IF EXISTS "Individuals can delete their own documents." ON public.documents;

CREATE POLICY "Individuals can view their own documents." ON public.documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Individuals can insert their own documents." ON public.documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Individuals can update their own documents." ON public.documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Individuals can delete their own documents." ON public.documents
    FOR DELETE USING (auth.uid() = user_id);

-- Create a storage bucket for raw files
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (Restrict access to owner folders)
DROP POLICY IF EXISTS "User can upload their own contracts" ON storage.objects;
DROP POLICY IF EXISTS "User can view their own contracts" ON storage.objects;

CREATE POLICY "User can upload their own contracts" ON storage.objects
    FOR INSERT WITH CHECK ( bucket_id = 'contracts' AND auth.uid() = owner );

CREATE POLICY "User can view their own contracts" ON storage.objects
    FOR SELECT USING ( bucket_id = 'contracts' AND auth.uid() = owner );

-- Trigger to create profile on signup
-- Function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- RAG 向量存储表和函数
-- ============================================

-- Create table for document chunks (RAG)
-- 使用 1024 维度适配阿里云 text-embedding-v3 模型
DROP TABLE IF EXISTS public.document_chunks CASCADE;
CREATE TABLE public.document_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id TEXT NOT NULL, -- 支持本地 ID 和 UUID
    content TEXT NOT NULL,
    embedding VECTOR(1024), -- text-embedding-v3 维度
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建向量索引以加速相似度搜索
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 创建文档ID索引
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx 
ON public.document_chunks (document_id);

-- Enable RLS on document_chunks
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（简化演示）
DROP POLICY IF EXISTS "Allow all operations on document_chunks" ON public.document_chunks;
CREATE POLICY "Allow all operations on document_chunks" ON public.document_chunks
    FOR ALL USING (true);

-- ============================================
-- 向量搜索函数
-- ============================================

-- 全局向量搜索函数
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE document_chunks.embedding IS NOT NULL
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 特定文档内的向量搜索函数
CREATE OR REPLACE FUNCTION match_documents_in_doc (
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5,
  target_document_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE document_chunks.embedding IS NOT NULL
    AND (target_document_id IS NULL OR document_chunks.document_id = target_document_id)
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 获取文档的所有分块
CREATE OR REPLACE FUNCTION get_document_chunks (
  target_document_id TEXT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  has_embedding BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.content,
    document_chunks.metadata,
    (document_chunks.embedding IS NOT NULL) AS has_embedding
  FROM document_chunks
  WHERE document_chunks.document_id = target_document_id
  ORDER BY (metadata->>'chunkIndex')::int;
END;
$$;

-- ============================================
-- 分析历史记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.analysis_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id TEXT NOT NULL,
    analysis_type TEXT DEFAULT 'full', -- 'full', 'chunk', 'query'
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS analysis_history_document_id_idx 
ON public.analysis_history (document_id);
