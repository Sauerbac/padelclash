// Drizzle schema — the single source of truth for the database shape.
//
// Tables arrive in slice 02 (core-schema-migration): the seven core tables
// from docs/architecture/data-model.md plus Better Auth's own tables.
// For now this is an empty schema so the Drizzle toolchain and the db client
// have something to import.
export {};
