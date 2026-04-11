/**
 * Seed welcome notification and message templates.
 * Run: node backend/seed_templates.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding notification and message templates...');

  const welcomeNotifData = {
    title: 'Welcome to Safe Haven Restoration',
    body: 'Welcome to Safe Haven Restoration. We are glad to have you with us.',
    isActive: true,
  };
  await prisma.notificationTemplate.upsert({
    where: { type: 'welcome' },
    update: welcomeNotifData,
    create: { type: 'welcome', ...welcomeNotifData },
  });
  console.log('✅ Notification template: welcome');

  const welcomeMsgData = {
    subject: 'Welcome to Safe Haven Restoration',
    body: `Welcome {{first_name}},

Safe Haven Restoration Ministries is dedicated to providing professional, compassionate Christian counseling services that integrate faith and psychology.

We are honored to walk alongside you on this journey. If you have any questions or need assistance, please don't hesitate to reach out to us at any time.

Blessings,
Safe Haven Restoration Ministries`,
    isActive: true,
  };
  await prisma.messageTemplate.upsert({
    where: { type: 'welcome' },
    update: welcomeMsgData,
    create: { type: 'welcome', ...welcomeMsgData },
  });
  console.log('✅ Message template: welcome');

  // ── Assign Therapist: Patient Notification ──────────────────────────────
  const assignPatNotifData = {
    title: 'Therapist Assignment',
    body: 'You have been assigned a therapist, check your message for more info',
    isActive: true,
  };
  await prisma.notificationTemplate.upsert({
    where: { type: 'assign_therapist_patient' },
    update: assignPatNotifData,
    create: { type: 'assign_therapist_patient', ...assignPatNotifData },
  });
  console.log('✅ Notification template: assign_therapist_patient');

  // ── Assign Therapist: Patient Message ─────────────────────────────────────
  const assignPatMsgData = {
    subject: 'Your Counselor Assignment',
    body: `{{therapist_name}} has been assigned as your counselor.

{{therapist_name}} is dedicated to providing professional, compassionate Christian counseling services that integrate therapeutic approaches to bring lasting transformation to your life.

{{therapist_bio}}`,
    isActive: true,
  };
  await prisma.messageTemplate.upsert({
    where: { type: 'assign_therapist_patient' },
    update: assignPatMsgData,
    create: { type: 'assign_therapist_patient', ...assignPatMsgData },
  });
  console.log('✅ Message template: assign_therapist_patient');

  // ── Assign Therapist: Therapist Notification ──────────────────────────────
  const assignThrNotifData = {
    title: 'New Patient Assignment',
    body: '{{patient_name}} was assigned to you for counseling, see message for more info',
    isActive: true,
  };
  await prisma.notificationTemplate.upsert({
    where: { type: 'assign_therapist_therapist' },
    update: assignThrNotifData,
    create: { type: 'assign_therapist_therapist', ...assignThrNotifData },
  });
  console.log('✅ Notification template: assign_therapist_therapist');

  // ── Assign Therapist: Therapist Message ───────────────────────────────────
  const assignThrMsgData = {
    subject: 'New Patient Assignment',
    body: `{{patient_name}} needs counseling with {{primary_diagnosis}}`,
    isActive: true,
  };
  await prisma.messageTemplate.upsert({
    where: { type: 'assign_therapist_therapist' },
    update: assignThrMsgData,
    create: { type: 'assign_therapist_therapist', ...assignThrMsgData },
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
