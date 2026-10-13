-- Migration 001: initial agent-memory schema.
-- Requires PostgreSQL 18 for uuidv7() and pgvector for the vector type.
-- No fixed embedding dimension is imposed here. Add an HNSW index in a later
-- additive migration for a specific model/dimension when that model is adopted.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now(),
    checksum text NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    email text PRIMARY KEY,
    skill_weight numeric NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    origin_url text NOT NULL UNIQUE,
    name text NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    slug text PRIMARY KEY,
    description text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('candidate', 'active'))
);

INSERT INTO categories (slug, description, status) VALUES
    ('methodology', 'Methods and workflows', 'active'),
    ('tool', 'Tools and their use', 'active'),
    ('project', 'Project-specific knowledge', 'active'),
    ('preference', 'User preferences', 'active'),
    ('decision', 'Decisions and rationale', 'active'),
    ('pitfall', 'Known pitfalls and failure modes', 'active'),
    ('convention', 'Conventions and standards', 'active'),
    ('other', 'Knowledge not covered by another category', 'active')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS memories (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    author text NOT NULL REFERENCES users(email),
    project uuid REFERENCES projects(id),
    branch_name text,
    commit_sha text,
    body text NOT NULL,
    context jsonb NOT NULL DEFAULT '{}'::jsonb,
    category text NOT NULL REFERENCES categories(slug),
    seq bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    valid_at timestamptz NOT NULL DEFAULT now(),
    invalid_at timestamptz,
    superseded_by uuid REFERENCES memories(id),
    value_score numeric,
    search tsvector GENERATED ALWAYS AS (to_tsvector('english', body)) STORED,
    CONSTRAINT memories_branch_pair CHECK ((branch_name IS NULL) = (commit_sha IS NULL)),
    CONSTRAINT memories_branch_requires_project CHECK (branch_name IS NULL OR project IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS memories_search_gin ON memories USING gin (search);

CREATE TABLE IF NOT EXISTS tags (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    slug text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS memory_tags (
    memory_id uuid NOT NULL REFERENCES memories(id),
    tag_id uuid NOT NULL REFERENCES tags(id),
    PRIMARY KEY (memory_id, tag_id)
);

CREATE TABLE IF NOT EXISTS memory_ranks (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    memory_id uuid NOT NULL REFERENCES memories(id),
    rater text NOT NULL REFERENCES users(email),
    score numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_embeddings (
    memory_id uuid NOT NULL REFERENCES memories(id),
    model text NOT NULL,
    dims integer NOT NULL,
    embedding vector NOT NULL,
    PRIMARY KEY (memory_id, model),
    CONSTRAINT memory_embeddings_dims_positive CHECK (dims > 0)
);

CREATE OR REPLACE FUNCTION reject_memory_content_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.context IS DISTINCT FROM OLD.context
       OR NEW.author IS DISTINCT FROM OLD.author
       OR NEW.project IS DISTINCT FROM OLD.project
       OR NEW.branch_name IS DISTINCT FROM OLD.branch_name
       OR NEW.commit_sha IS DISTINCT FROM OLD.commit_sha
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.valid_at IS DISTINCT FROM OLD.valid_at THEN
        RAISE EXCEPTION 'memory content and provenance are immutable; insert a successor memory';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER memories_immutable_content
BEFORE UPDATE ON memories
FOR EACH ROW EXECUTE FUNCTION reject_memory_content_update();
CREATE OR REPLACE FUNCTION reject_memory_embedding_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'memory embeddings are immutable; insert a replacement embedding';
END;
$$;

CREATE OR REPLACE TRIGGER memory_embeddings_immutable
BEFORE UPDATE ON memory_embeddings
FOR EACH ROW EXECUTE FUNCTION reject_memory_embedding_update();
