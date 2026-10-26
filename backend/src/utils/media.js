import Media from '../models/Media.js';

// The app uploads a 256px square JPEG, which is well under this.
const MAX_IMAGE_BYTES = 150 * 1024;
const UNSAVED_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const DATA_URI_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Checks the first bytes of the file, so a file can't claim to be a JPEG when
// it is something else.
function hasImageSignature(contentType, bytes) {
  switch (contentType) {
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return bytes.subarray(0, 8).equals(PNG_SIGNATURE);
    case 'image/webp':
      return bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP';
    default:
      return false;
  }
}

// Turns a base64 data URI into checked image bytes. Anything else, such as a
// file path or a web address, is rejected.
function decodeImage(dataUri) {
  const match = typeof dataUri === 'string' && dataUri.length <= MAX_IMAGE_BYTES * 2 && DATA_URI_PATTERN.exec(dataUri);
  if (!match) {
    if (typeof dataUri === 'string' && dataUri.length > MAX_IMAGE_BYTES * 2) throw new Error('Profile photo is too large');
    throw new Error('Profile photo must be a JPEG, PNG or WebP image');
  }
  const [, contentType, base64] = match;
  const data = Buffer.from(base64, 'base64');
  if (data.length > MAX_IMAGE_BYTES) throw new Error('Profile photo is too large');
  if (data.length < 12 || !hasImageSignature(contentType, data)) {
    throw new Error('Profile photo must be a JPEG, PNG or WebP image');
  }
  return { contentType, data };
}

async function storeProfilePhoto(ownerId, dataUri) {
  const image = decodeImage(dataUri);
  // Keep at most one unsaved upload per user.
  await Media.deleteMany({ owner: ownerId, purpose: 'profile-photo', expiresAt: { $ne: null } });
  return Media.create({
    owner: ownerId,
    purpose: 'profile-photo',
    ...image,
    expiresAt: new Date(Date.now() + UNSAVED_UPLOAD_TTL_MS)
  });
}

function toDataUri(media) {
  return `data:${media.contentType};base64,${media.data.toString('base64')}`;
}

// Loads media for one GraphQL request. Every lookup made while a response is
// being built is collected into a single query, so a list of players with
// photos costs one database read rather than one per player.
function createMediaLoader() {
  const cache = new Map();
  let pending = null;

  async function flush(batch) {
    try {
      const found = await Media.find({ _id: { $in: [...batch.keys()] } });
      const byId = new Map(found.map((media) => [String(media._id), media]));
      for (const [id, { resolve }] of batch) resolve(byId.get(id) || null);
    } catch (error) {
      for (const { reject } of batch.values()) reject(error);
    }
  }

  return function load(id) {
    const key = String(id);
    if (!cache.has(key)) {
      if (!pending) {
        pending = new Map();
        const batch = pending;
        setImmediate(() => {
          pending = null;
          flush(batch);
        });
      }
      cache.set(key, new Promise((resolve, reject) => pending.set(key, { resolve, reject })));
    }
    return cache.get(key);
  };
}

export { MAX_IMAGE_BYTES, decodeImage, storeProfilePhoto, toDataUri, createMediaLoader };
