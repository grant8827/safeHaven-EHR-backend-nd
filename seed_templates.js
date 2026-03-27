/**
 * Seed welcome notification and message templates.
 * Run: node backend/seed_templates.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding notification and message templates...');

  // Welcome Notification Template
  await prisma.notificationTemplate.upsert({
    where: { type: 'welcome' },
    update: {},
    create: {
      type: 'welcome',
      title: 'Welcome to Safe Haven Restoration',
      body: 'Welcome to Safe Haven Restoration. We are glad to have you with us.',
      isActive: true,
    },
  });
  console.log('✅ Notification template: welcome');

  // Welcome Message Template
  await prisma.messageTemplate.upsert({
    where: { type: 'welcome' },
    update: {},
    create: {
      type: 'welcome',
      subject: 'Welcome to Safe Haven Restoration',
      body: `Welcome {{first_name}},

Safe Haven Restoration Ministries is dedicated to providing professional, compassionate Christian counseling services that integrate faith and psychology.

We are honored to walk alongside you on this journey. If you have any questions or need assistance, please don't hesitate to reach out to us at any time.

Blessings,
Safe Haven Restoration Ministries`,
      isActive: true,
    },
  });
  console.log('✅ Message template: welcome');

  // ── Assign Therapist: Patient Notification ──────────────────────────────
  await prisma.notificationTemplate.upsert({
    where: { type: 'assign_therapist_patient' },
    update: {},
    create: {
      type: 'assign_therapist_patient',
      title: 'Therapist Assignment',
      body: 'You have been assigned a therapist, check your message for more info',
      isActive: true,
    },
  });
  console.log('✅ Notification template: assign_therapist_patient');

  // ── Assign Therapist: Patient Message ─────────────────────────────────────
  await prisma.messageTemplate.upsert({
    where: { type: 'assign_therapist_patient' },
    update: {},
    create: {
      type: 'assign_therapist_patient',
      subject: 'Your Counselor Assignment',
      body: `{{therapist_name}} has been assigned as your counselor.

{{therapist_name}} is dedicated to providing professional, compassionate Christian counseling services that integrate therapeutic approaches to bring lasting transformation to your life.

{{therapist_bio}}`,
      isActive: true,
    },
  });
  console.log('✅ Message template: assign_therapist_patient');

  // ── Assign Therapist: Therapist Notification ──────────────────────────────
  await prisma.notificationTemplate.upsert({
    where: { type: 'assign_therapist_therapist' },
    update: {},
    create: {
      type: 'assign_therapist_therapist',
      title: 'New Patient Assignment',
      body: '{{patient_name}} was assigned to you for counseling, see message for more info',
      isActive: true,
    },
  });
  console.log('✅ Notification template: assign_therapist_therapist');

  // ── Assign Therapist: Therapist Message ───────────────────────────────────
  await prisma.messageTemplate.upsert({
    where: { type: 'assign_therapist_therapist' },
    update: {},
    create: {
      type: 'assign_therapist_therapist',
      subject: 'New Patient Assignment',
      body: `{{patient_name}} needs counseling with {{primary_diagnosis}}`,
      isActive: true,
    },
  });
  console.log('✅ Message template: assign_therapist_therapist');

  console.log('🎉 Templates seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
