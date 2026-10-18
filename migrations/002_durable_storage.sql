CREATE TABLE IF NOT EXISTS artifact_revisions (
  project_id text NOT NULL,
  subject_id text NOT NULL,
  kind text NOT NULL,
  logical_name text NOT NULL,
  branch_id text NOT NULL,
  worktree_id text NOT NULL DEFAULT '',
  run_id text NOT NULL DEFAULT '',
  revision text NOT NULL,
  bytes bytea NOT NULL,
  sha256 text NOT NULL,
  author text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (project_id, subject_id, kind, logical_name, branch_id, worktree_id, run_id, revision)
);
CREATE TABLE IF NOT EXISTS artifact_pointers (
  project_id text NOT NULL,
  subject_id text NOT NULL,
  kind text NOT NULL,
  logical_name text NOT NULL,
  branch_id text NOT NULL,
  worktree_id text NOT NULL DEFAULT '',
  run_id text NOT NULL DEFAULT '',
  revision text NOT NULL,
  PRIMARY KEY (project_id, subject_id, kind, logical_name, branch_id, worktree_id, run_id),
  FOREIGN KEY (project_id, subject_id, kind, logical_name, branch_id, worktree_id, run_id, revision)
    REFERENCES artifact_revisions(project_id, subject_id, kind, logical_name, branch_id, worktree_id, run_id, revision)
);
CREATE TABLE IF NOT EXISTS artifact_lifecycle (
  subject_id text PRIMARY KEY,
  revision text NOT NULL,
  state text NOT NULL,
  evidence jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS artifact_runs (
  project_id text NOT NULL,
  run_id text NOT NULL,
  branch_id text NOT NULL,
  worktree_id text NOT NULL,
  attempt_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('attempted', 'complete')),
  artifact_revisions jsonb NOT NULL,
  PRIMARY KEY (project_id, run_id)
);
CREATE TABLE IF NOT EXISTS artifact_checkpoints (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  branch_id text NOT NULL,
  commit_sha text NOT NULL,
  integration_tip text NOT NULL,
  revision_set jsonb NOT NULL,
  bound_commit text
);
CREATE TABLE IF NOT EXISTS artifact_publications (
  id text PRIMARY KEY,
  checkpoint_id text NOT NULL REFERENCES artifact_checkpoints(id),
  integration_tip text NOT NULL,
  revision_set jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS artifact_attachments (
  project_id text NOT NULL,
  sha256 text NOT NULL,
  bytes bytea NOT NULL,
  PRIMARY KEY (project_id, sha256)
);
CREATE TABLE IF NOT EXISTS artifact_import_provenance (
  source_id text PRIMARY KEY,
  destination_revision text NOT NULL,
  source_metadata jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artifact_revisions_project_kind ON artifact_revisions(project_id, kind, created_at);
CREATE INDEX IF NOT EXISTS artifact_revisions_branch ON artifact_revisions(project_id, branch_id, created_at);
