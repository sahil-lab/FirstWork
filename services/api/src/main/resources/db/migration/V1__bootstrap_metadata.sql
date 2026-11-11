CREATE TABLE prototype_metadata (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    schema_version VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO prototype_metadata (id, schema_version)
VALUES (1, 'phase-1');
