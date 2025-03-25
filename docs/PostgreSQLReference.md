# PostgreSQL Terminal Reference Guide

This guide provides common PostgreSQL commands for verifying database state after migrations or changes.

## Connecting to the Database

### Local Connection
```bash
# Basic connection (will prompt for password)
psql -h localhost -p 5432 -U postgres -d youtube_rag

# Connection with password in command (not recommended for security)
PGPASSWORD=your_password psql -h localhost -p 5432 -U postgres -d database_name

# Connect to database running in Docker
docker exec -it container_name psql -U postgres -d database_name
```

### Connection Parameters
- `-h` - Host address (localhost, IP address, etc.)
- `-p` - Port number (default: 5432)
- `-U` - Username
- `-d` - Database name
- `-W` - Force password prompt

## Database Information Commands

### List and Switch Databases
```sql
-- List all databases
\l

-- Connect to a specific database
\c database_name

-- Show current connection info
\conninfo
```

### Table Operations
```sql
-- List all tables in current database
\dt

-- List all tables with descriptions
\dt+

-- Describe table structure (columns, types, etc.)
\d table_name

-- More detailed table description
\d+ table_name
```

### Schema Information
```sql
-- List schemas
\dn

-- List tables in a specific schema
\dt schema_name.*
```

## Common SQL Queries for Verification

### Basic Data Inspection
```sql
-- Count rows in a table
SELECT COUNT(*) FROM table_name;

-- View all data in a table (use with caution on large tables)
SELECT * FROM table_name;
SELECT * FROM public.users;

-- View first 10 rows
SELECT * FROM table_name LIMIT 10;

-- View the most recent rows (if you have a timestamp column)
SELECT * FROM table_name ORDER BY created_at DESC LIMIT 10;
```

### Column and Data Verification
```sql
-- List all column names for a table
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'table_name';

-- Check for null values in a column
SELECT COUNT(*) FROM table_name WHERE column_name IS NULL;

-- Check distinct values in a column
SELECT DISTINCT column_name FROM table_name;

-- Count records by a category
SELECT category_column, COUNT(*) FROM table_name 
GROUP BY category_column;
```

### Find Specific Records
```sql
-- Find records matching a condition
SELECT * FROM table_name WHERE column_name = 'value';

-- Find records with pattern matching
SELECT * FROM table_name WHERE column_name LIKE '%pattern%';

-- Find records within a date range
SELECT * FROM table_name 
WHERE date_column BETWEEN '2025-01-01' AND '2025-01-31';
```

### Verify Relationships
```sql
-- Check foreign key relationships
SELECT * FROM table_name 
WHERE foreign_key_column = 'related_id';

-- Join tables to verify relationships
SELECT a.column1, b.column2 
FROM table_a a
JOIN table_b b ON a.id = b.table_a_id
LIMIT 10;
```

## Verify Migrations and Schema Changes

### Check Existing Tables
```sql
-- List all tables (useful after creating new tables)
\dt

-- Check if a specific table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'table_name'
);
```

### Verify Columns
```sql
-- Check if a column exists
SELECT EXISTS (
  SELECT FROM information_schema.columns 
  WHERE table_name = 'table_name' AND column_name = 'column_name'
);

-- List all columns in a table (after adding/modifying columns)
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'table_name';
```

### Check Indexes
```sql
-- List all indexes for a table
\di+ table_name

-- Alternative index query
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'table_name';
```

### Check Constraints
```sql
-- List constraints (primary keys, foreign keys, etc.)
SELECT constraint_name, constraint_type, table_name
FROM information_schema.table_constraints
WHERE table_name = 'table_name';
```

## Monitoring and Troubleshooting

### Check Running Queries
```sql
-- Show active queries
SELECT pid, age(clock_timestamp(), query_start), usename, query
FROM pg_stat_activity
WHERE query != '<IDLE>' AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY query_start DESC;
```

### Kill Long-Running Queries
```sql
-- Cancel a specific query
SELECT pg_cancel_backend(pid);

-- Terminate a specific session
SELECT pg_terminate_backend(pid);
```

### Check Table Size and Stats
```sql
-- Table size
SELECT pg_size_pretty(pg_total_relation_size('table_name'));

-- Database size
SELECT pg_size_pretty(pg_database_size('database_name'));

-- Table statistics
SELECT * FROM pg_stat_user_tables WHERE relname = 'table_name';
```

## Migration History
If you're using the built-in migration system, you can check migration status with:

```sql
-- List executed migrations
SELECT name, executed_at FROM migration_history ORDER BY executed_at;

-- Check if a specific migration has been executed
SELECT EXISTS (
  SELECT FROM migration_history 
  WHERE name = 'migration_filename.ts'
);
```

## Useful Psql Meta-commands

```
\?          - Show all available psql commands
\h          - SQL help
\q          - Quit
\i file.sql - Execute SQL from a file
\o file.txt - Send query results to a file
\copy       - Import/export data between file and table
\timing on  - Turn on query execution time measurement
\x          - Toggle expanded display (useful for wide tables)
\e          - Edit command in external editor
```

## Exit PostgreSQL
```
\q
```