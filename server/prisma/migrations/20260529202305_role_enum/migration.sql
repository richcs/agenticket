-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'agent');

-- AlterTable: convert user.role from text to the Role enum in place.
-- Existing values ('admin' / 'agent') already match the enum labels.
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'agent';
ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL;
