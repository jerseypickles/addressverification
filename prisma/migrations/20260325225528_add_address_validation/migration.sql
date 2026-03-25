-- CreateTable
CREATE TABLE "AddressValidation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "originalAddress" TEXT NOT NULL,
    "validatedAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verdict" TEXT,
    "correctedAddress" TEXT,
    "updatedInShopify" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AddressValidation_orderId_key" ON "AddressValidation"("orderId");
