CREATE TABLE "DispatchPacing" (
  "userId" TEXT NOT NULL,
  "nextAt" TIMESTAMP(3) NOT NULL,
  "batchCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DispatchPacing_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "DispatchPacing" ADD CONSTRAINT "DispatchPacing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageLog" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "availableAt" TIMESTAMP(3);
CREATE INDEX "MessageLog_userId_status_idx" ON "MessageLog"("userId", "status");
