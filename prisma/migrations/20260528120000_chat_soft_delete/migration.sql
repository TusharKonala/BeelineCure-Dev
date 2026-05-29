-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN "hiddenFor" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "isDeletedForEveryone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN "deletedFor" TEXT[] DEFAULT ARRAY[]::TEXT[];
