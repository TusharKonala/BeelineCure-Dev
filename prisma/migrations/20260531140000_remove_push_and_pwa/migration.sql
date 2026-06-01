-- DropTable
DROP TABLE IF EXISTS "PushSubscription";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "pwaInstalledAt",
DROP COLUMN IF EXISTS "pwaDismissedAt";
