ALTER TABLE "Appointment"
ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recurrenceIntervalWeeks" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "recurrenceEndDate" TIMESTAMP(3);

CREATE INDEX "Appointment_patientId_therapistId_isRecurring_idx"
ON "Appointment"("patientId", "therapistId", "isRecurring");
