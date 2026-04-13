-- CreateEnum
CREATE TYPE "BroadcastScope" AS ENUM ('COMPANY', 'BRANCH', 'ROLE_GROUP');

-- CreateTable: direct_conversations
CREATE TABLE "direct_conversations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "participant_a_id" TEXT NOT NULL,
    "participant_b_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: direct_messages
CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "attachment_url" TEXT,
    "attachment_name" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: broadcasts
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "scope" "BroadcastScope" NOT NULL,
    "target_role" "UserRole",
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "attachment_url" TEXT,
    "attachment_name" TEXT,
    "requires_ack" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: broadcast_recipients
CREATE TABLE "broadcast_recipients" (
    "id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable: formal_notices
CREATE TABLE "formal_notices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "attachment_url" TEXT,
    "attachment_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formal_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: formal_notice_recipients
CREATE TABLE "formal_notice_recipients" (
    "id" TEXT NOT NULL,
    "notice_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "reminder_24_sent_at" TIMESTAMP(3),
    "escalation_48_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formal_notice_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: direct_conversations
CREATE UNIQUE INDEX "direct_conversations_organization_id_participant_a_id_partic_key" ON "direct_conversations"("organization_id", "participant_a_id", "participant_b_id");
CREATE INDEX "direct_conversations_organization_id_idx" ON "direct_conversations"("organization_id");
CREATE INDEX "direct_conversations_participant_a_id_idx" ON "direct_conversations"("participant_a_id");
CREATE INDEX "direct_conversations_participant_b_id_idx" ON "direct_conversations"("participant_b_id");

-- CreateIndex: direct_messages
CREATE INDEX "direct_messages_conversation_id_created_at_idx" ON "direct_messages"("conversation_id", "created_at");
CREATE INDEX "direct_messages_organization_id_idx" ON "direct_messages"("organization_id");

-- CreateIndex: broadcasts
CREATE INDEX "broadcasts_organization_id_created_at_idx" ON "broadcasts"("organization_id", "created_at");

-- CreateIndex: broadcast_recipients
CREATE UNIQUE INDEX "broadcast_recipients_broadcast_id_user_id_key" ON "broadcast_recipients"("broadcast_id", "user_id");
CREATE INDEX "broadcast_recipients_broadcast_id_idx" ON "broadcast_recipients"("broadcast_id");
CREATE INDEX "broadcast_recipients_user_id_idx" ON "broadcast_recipients"("user_id");
CREATE INDEX "broadcast_recipients_organization_id_idx" ON "broadcast_recipients"("organization_id");

-- CreateIndex: formal_notices
CREATE INDEX "formal_notices_organization_id_created_at_idx" ON "formal_notices"("organization_id", "created_at");

-- CreateIndex: formal_notice_recipients
CREATE UNIQUE INDEX "formal_notice_recipients_notice_id_user_id_key" ON "formal_notice_recipients"("notice_id", "user_id");
CREATE INDEX "formal_notice_recipients_notice_id_idx" ON "formal_notice_recipients"("notice_id");
CREATE INDEX "formal_notice_recipients_user_id_idx" ON "formal_notice_recipients"("user_id");
CREATE INDEX "formal_notice_recipients_organization_id_idx" ON "formal_notice_recipients"("organization_id");
CREATE INDEX "formal_notice_recipients_acknowledged_at_created_at_idx" ON "formal_notice_recipients"("acknowledged_at", "created_at");

-- AddForeignKey: direct_conversations
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_participant_a_id_fkey" FOREIGN KEY ("participant_a_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_conversations" ADD CONSTRAINT "direct_conversations_participant_b_id_fkey" FOREIGN KEY ("participant_b_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: direct_messages
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: broadcasts
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: broadcast_recipients
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: formal_notices
ALTER TABLE "formal_notices" ADD CONSTRAINT "formal_notices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "formal_notices" ADD CONSTRAINT "formal_notices_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: formal_notice_recipients
ALTER TABLE "formal_notice_recipients" ADD CONSTRAINT "formal_notice_recipients_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "formal_notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "formal_notice_recipients" ADD CONSTRAINT "formal_notice_recipients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "formal_notice_recipients" ADD CONSTRAINT "formal_notice_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
