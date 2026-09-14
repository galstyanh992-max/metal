-- Add sessionVersion to User for JWT revocation.
-- Incremented on disable, role change, password change/reset, or explicit revocation.
-- JWT carries this version; protected requests compare against the current DB value.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN "User"."sessionVersion" IS 'Incremented to invalidate outstanding JWTs after security-relevant changes.';

-- Add pickedById to OrderItem for object-level warehouse authorization.
-- Nullable: existing rows have no picker assigned.
ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "pickedById" TEXT;

CREATE INDEX IF NOT EXISTS "OrderItem_pickedById_idx"
  ON "OrderItem"("pickedById");

-- Foreign key constraint (self-managed; Prisma expects this relation name).
ALTER TABLE "OrderItem"
  DROP CONSTRAINT IF EXISTS "OrderItem_pickedById_fkey",
  ADD CONSTRAINT "OrderItem_pickedById_fkey"
  FOREIGN KEY ("pickedById") REFERENCES "User"("id") ON DELETE SET NULL;