process.env.NODE_ENV = "test";
process.env.PASSWORD_HASH_ITERATIONS = "1000";

delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.API_PUBLIC_BASE_PATH;
delete process.env.SENTRY_DSN;
