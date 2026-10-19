const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Leave documents (sick note / supporting files) are stored on disk under
// backend/uploads/leave-docs and referenced by an authenticated API URL instead
// of keeping large base64 blobs in MongoDB (Phase 3.3).
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'leave-docs');
const MAX_ATTACHMENT_MB = parseInt(process.env.MAX_ATTACHMENT_MB, 10) || 5;
const MAX_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const ensureDir = () => {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
};

const isDataUri = (value) => /^data:[^;]+;base64,/.test(String(value || ''));

/**
 * Persist a base64 data URI to disk as a server-hosted attachment.
 * @param {string} dataUri
 * @returns {{error:string} | {fileName:string, storedName:string, mime:string, size:number, filePath:string}}
 */
const saveAttachmentFromDataUri = async (dataUri, { originalName } = {}) => {
    const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUri || ''));
    if (!match) return { error: 'Format lampiran tidak valid.' };

    const mime = match[1].toLowerCase();
    if (!ALLOWED_TYPES.includes(mime)) {
        return { error: 'Jenis file tidak diizinkan. Gunakan gambar (JPG/PNG/WebP/GIF) atau PDF.' };
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) return { error: 'File lampiran kosong.' };
    if (buffer.length > MAX_BYTES) {
        return { error: `File terlalu besar. Maksimum ${MAX_ATTACHMENT_MB}MB.` };
    }

    ensureDir();
    const extension = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1] || 'bin';
    const storedName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${extension}`;
    const filePath = path.join(UPLOAD_DIR, storedName);
    fs.writeFileSync(filePath, buffer);

    return {
        fileName: originalName || storedName,
        storedName,
        mime,
        size: buffer.length,
        filePath
    };
};

const removeAttachmentFile = (storedName) => {
    if (!storedName) return;
    try {
        const filePath = path.join(UPLOAD_DIR, storedName);
        // Guard against path traversal in case the value is ever attacker-controlled.
        if (path.resolve(filePath).startsWith(path.resolve(UPLOAD_DIR)) && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (_e) { /* non-fatal */ }
};

module.exports = {
    saveAttachmentFromDataUri,
    removeAttachmentFile,
    isDataUri,
    UPLOAD_DIR
};