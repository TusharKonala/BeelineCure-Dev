-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_slug_key" ON "Doctor"("slug");
