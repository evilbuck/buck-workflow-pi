CREATE TABLE IF NOT EXISTS artifact_branches (
  project_id text NOT NULL,
  branch_id text NOT NULL,
  ref text NOT NULL,
  incarnation uuid NOT NULL,
  initial_tip text NOT NULL,
  observed_tip text NOT NULL,
  integration_tip text,
  parent_branch_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, branch_id),
  UNIQUE (project_id, incarnation),
  FOREIGN KEY (project_id, parent_branch_id) REFERENCES artifact_branches(project_id, branch_id)
);
CREATE INDEX IF NOT EXISTS artifact_branches_project_ref ON artifact_branches(project_id, ref);
