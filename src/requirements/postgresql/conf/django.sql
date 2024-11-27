SELECT 'CREATE DATABASE django'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'django')\gexec