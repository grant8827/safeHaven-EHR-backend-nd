const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// NOTE: this is local disk storage — simple and needs no external account,
// but Railway's filesystem is ephemeral by default. Without a persistent
// volume mounted at this path in Railway's dashboard, every recording is
// lost on the next deploy/restart. That's a Railway project setting, not
// something fixable from application code.
const RECORDINGS_DIR = path.join(__dirname, '..', 'uploads', 'recordings');
fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RECORDINGS_DIR),
  filename: (req, file, cb) => {
    const ext = (file.mimetype.split('/')[1] || 'webm').split(';')[0].replace(/[^a-z0-9]/gi, '');
    cb(null, `${uuidv4()}.${ext || 'webm'}`);
  },
});

const recordingUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB per recording
});

module.exports = { recordingUpload, RECORDINGS_DIR };
