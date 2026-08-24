-- Los admins que ya existian antes del self-signup no tienen onboarding_completed_at,
-- y el router del frontend manda al wizard a todo el que lo tenga NULL. Sin esto,
-- cada bar de produccion queda bloqueado tras el proximo login.
UPDATE admins SET onboarding_completed_at = CURRENT_TIMESTAMP
WHERE onboarding_completed_at IS NULL;
