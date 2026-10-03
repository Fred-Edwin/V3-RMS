-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'WAITER', 'CHEF', 'BARISTA');

-- CreateEnum
CREATE TYPE "public"."PrepStation" AS ENUM ('KITCHEN', 'BARISTA');

-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('DINE_IN', 'TAKE_AWAY', 'DELIVERY');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'READY', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PrepTicketStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'READY');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('MPESA', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "public"."ClockMethod" AS ENUM ('GPS', 'OVERRIDE');

-- CreateTable
CREATE TABLE "public"."organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "isHub" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prepStation" "public"."PrepStation" NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menu_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."branch_menu_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "branch_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_zones" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shifts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shift_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clock_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "shift_assignment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "clock_in_at" TIMESTAMP(3),
    "clock_out_at" TIMESTAMP(3),
    "clock_in_method" "public"."ClockMethod" NOT NULL,
    "clock_out_method" "public"."ClockMethod",
    "override_by_id" TEXT,
    "override_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clock_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "daily_number" INTEGER NOT NULL,
    "order_date" DATE NOT NULL,
    "type" "public"."OrderType" NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "table_number" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "payment_method" "public"."PaymentMethod",
    "paid_at" TIMESTAMP(3),
    "delivery_zone_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prep_tickets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "station" "public"."PrepStation" NOT NULL,
    "status" "public"."PrepTicketStatus" NOT NULL DEFAULT 'PENDING',
    "claimed_by_id" TEXT,
    "claimed_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "items" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prep_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "public"."users"("organization_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_name_key" ON "public"."menu_categories"("name");

-- CreateIndex
CREATE INDEX "menu_categories_prepStation_idx" ON "public"."menu_categories"("prepStation");

-- CreateIndex
CREATE INDEX "menu_items_category_id_idx" ON "public"."menu_items"("category_id");

-- CreateIndex
CREATE INDEX "menu_items_is_active_idx" ON "public"."menu_items"("is_active");

-- CreateIndex
CREATE INDEX "branch_menu_items_organization_id_idx" ON "public"."branch_menu_items"("organization_id");

-- CreateIndex
CREATE INDEX "branch_menu_items_menu_item_id_idx" ON "public"."branch_menu_items"("menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_menu_items_organization_id_menu_item_id_key" ON "public"."branch_menu_items"("organization_id", "menu_item_id");

-- CreateIndex
CREATE INDEX "delivery_zones_organization_id_idx" ON "public"."delivery_zones"("organization_id");

-- CreateIndex
CREATE INDEX "shifts_organization_id_idx" ON "public"."shifts"("organization_id");

-- CreateIndex
CREATE INDEX "shift_assignments_organization_id_idx" ON "public"."shift_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "shift_assignments_user_id_idx" ON "public"."shift_assignments"("user_id");

-- CreateIndex
CREATE INDEX "shift_assignments_date_idx" ON "public"."shift_assignments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_user_id_date_shift_id_key" ON "public"."shift_assignments"("user_id", "date", "shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "clock_records_shift_assignment_id_key" ON "public"."clock_records"("shift_assignment_id");

-- CreateIndex
CREATE INDEX "clock_records_organization_id_idx" ON "public"."clock_records"("organization_id");

-- CreateIndex
CREATE INDEX "clock_records_user_id_idx" ON "public"."clock_records"("user_id");

-- CreateIndex
CREATE INDEX "clock_records_clock_in_at_idx" ON "public"."clock_records"("clock_in_at");

-- CreateIndex
CREATE INDEX "orders_organization_id_idx" ON "public"."orders"("organization_id");

-- CreateIndex
CREATE INDEX "orders_organization_id_status_idx" ON "public"."orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "orders_organization_id_order_date_idx" ON "public"."orders"("organization_id", "order_date");

-- CreateIndex
CREATE INDEX "orders_created_by_id_idx" ON "public"."orders"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_organization_id_daily_number_order_date_key" ON "public"."orders"("organization_id", "daily_number", "order_date");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "public"."order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_menu_item_id_idx" ON "public"."order_items"("menu_item_id");

-- CreateIndex
CREATE INDEX "prep_tickets_organization_id_idx" ON "public"."prep_tickets"("organization_id");

-- CreateIndex
CREATE INDEX "prep_tickets_organization_id_station_status_idx" ON "public"."prep_tickets"("organization_id", "station", "status");

-- CreateIndex
CREATE INDEX "prep_tickets_claimed_by_id_idx" ON "public"."prep_tickets"("claimed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "prep_tickets_order_id_station_key" ON "public"."prep_tickets"("order_id", "station");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menu_items" ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_menu_items" ADD CONSTRAINT "branch_menu_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."branch_menu_items" ADD CONSTRAINT "branch_menu_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_zones" ADD CONSTRAINT "delivery_zones_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shifts" ADD CONSTRAINT "shifts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_assignments" ADD CONSTRAINT "shift_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."shift_assignments" ADD CONSTRAINT "shift_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clock_records" ADD CONSTRAINT "clock_records_shift_assignment_id_fkey" FOREIGN KEY ("shift_assignment_id") REFERENCES "public"."shift_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clock_records" ADD CONSTRAINT "clock_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_tickets" ADD CONSTRAINT "prep_tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_tickets" ADD CONSTRAINT "prep_tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prep_tickets" ADD CONSTRAINT "prep_tickets_claimed_by_id_fkey" FOREIGN KEY ("claimed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
