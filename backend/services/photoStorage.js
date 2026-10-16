const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '..', 'uploads');
const PHOTO_SUBDIR = path.join(UPLOAD_DIR, 'photos');

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB encoded source cap
const MAX_WIDTH = 960; // downscale before storing

const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

if (!fs.existsSync(PHOTO_SUBDIR)) {
    fs.mkdirSync(PHOTO_SUBDIR, { recursive: true });
}

// Accepts a data URL ("data:image/...;base64,...") or a raw base64 payload.
const parsePhoto = (photo) => {
    if (!photo || typeof photo !== 'string') return { error: null, buffer: null, mime: null };

    let mime = null;
    let base64 = photo;
    const dataUrlMatch = photo.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
    if (dataUrlMatch) {
        mime = dataUrlMatch[1].toLowerCase();
        base64 = dataUrlMatch[2];
    } else {
        const head = Buffer.from(base64.slice(0, 20), 'base64');
        if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) mime = 'image/jpeg';
        else if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) mime = 'image/png';
        else if (head.length >= 12 && head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';
        else return { error: 'Format foto tidak didukung (JPG/PNG/WebP).' };
    }

    const buffer = Buffer.from(base64, 'base64');
    if (!buffer || buffer.length === 0) return { error: 'Data foto kosong.' };
    if (buffer.length > MAX_PHOTO_BYTES) {
        return { error: 'Ukuran foto melebihi batas maksimal 5MB.' };
    }
    return { error: null, buffer, mime };
};

// Downscale + re-encode (compression step). Returns the storeable buffer.
const compressPhoto = async (buffer, mime) => {
    try {
        const image = await Jimp.fromBuffer(buffer);
        if (image.bitmap.width > MAX_WIDTH) {
            image.resize({ w: MAX_WIDTH });
        }
        if (mime === 'image/png') {
            return await image.getBuffer('image/png');
        }
        return await image.getBuffer('image/jpeg', { quality: 82 });
    } catch (err) {
        // If compression fails, fall back to the original buffer (still size/type-checked).
        console.warn('Photo compression skipped:', err.message);
        return buffer;
    }
};

// Persist a photo and return the public URL path.
const savePhoto = async (photo, staffId) => {
    const parsed = parsePhoto(photo);
    if (parsed.error) return { error: parsed.error, url: null };
    if (!parsed.buffer) return { error: null, url: null };

    const storedBuffer = await compressPhoto(parsed.buffer, parsed.mime);
    const ext = parsed.mime === 'image/png' ? '.png' : '.jpg';
    const filename = `${Date.now()}-${String(staffId).replace(/[^a-zA-Z0-9]/g, '').slice(-8)}${ext}`;
    fs.writeFileSync(path.join(PHOTO_SUBDIR, filename), storedBuffer);
    return { error: null, url: `/uploads/photos/${filename}` };
};

// Resolve a stored filename back to an absolute path (path-traversal safe).
const getPhotoPath = (photoUrl) => {
    const filename = path.basename(String(photoUrl || '').replace(/^\/uploads\/photos\//, ''));
    if (!filename) return null;
    const full = path.join(PHOTO_SUBDIR, filename);
    if (!full.startsWith(PHOTO_SUBDIR)) return null;
    return full;
};

const deleteStoredPhoto = (photoUrl) => {
    const full = getPhotoPath(photoUrl);
    if (!full) return;
    try {
        if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch (err) {
        console.warn('Failed to delete stored photo:', err.message);
    }
};

module.exports = { savePhoto, getPhotoPath, deleteStoredPhoto, UPLOAD_DIR };