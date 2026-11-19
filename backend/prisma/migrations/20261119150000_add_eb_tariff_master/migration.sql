-- Electricity Tariff Rate Master (singleton row)
CREATE TABLE IF NOT EXISTS "EbTariffMaster" (
  "id" text NOT NULL,
  "rate" double precision NOT NULL DEFAULT 8.12,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "EbTariffMaster_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EbTariffMaster" ("id", "rate", "updatedAt")
VALUES ('GLOBAL', 8.12, NOW())
ON CONFLICT ("id") DO NOTHING;
