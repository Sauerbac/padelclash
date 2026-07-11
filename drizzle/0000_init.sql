-- No-op init migration: proves the boot-time migration path works end-to-end
-- before any real tables exist. Real schema arrives with the next slices.
SELECT 1;
