CREATE TABLE IF NOT EXISTS artifact_lifecycle_scope (
  project_id text NOT NULL,
  branch_id text NOT NULL,
  subject_id text NOT NULL,
  revision text NOT NULL,
  state text NOT NULL,
  evidence jsonb NOT NULL,
  provenance text NOT NULL,
  PRIMARY KEY (project_id, branch_id, subject_id)
);
CREATE TABLE IF NOT EXISTS artifact_corrections (
  project_id text NOT NULL,
  branch_id text NOT NULL,
  artifact_key text NOT NULL,
  idempotency_key text NOT NULL,
  predecessor_revision text NOT NULL,
  result_revision text,
  replacement_sha256 text,
  PRIMARY KEY (project_id, branch_id, artifact_key, idempotency_key)
);
CREATE TABLE IF NOT EXISTS artifact_search_text (
  project_id text NOT NULL,
  revision text NOT NULL,
  search_text text NOT NULL,
  PRIMARY KEY (project_id, revision)
);
CREATE TABLE IF NOT EXISTS artifact_run_duties (
  project_id text NOT NULL,
  run_id text NOT NULL,
  receipt_kind text NOT NULL,
  metadata_duties jsonb NOT NULL,
  PRIMARY KEY (project_id, run_id)
);
