// Unit tests for profile photo validation (issues #161, #202).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGE_BYTES, decodeImage, toDataUri } from '../../src/utils/media.js';

const dataUri = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82];
const WEBP = [...Buffer.from('RIFF'), 20, 0, 0, 0, ...Buffer.from('WEBPVP8 ')];
const NOT_AN_IMAGE = 'This is plain text pretending to be an image.';
const WRONG_TYPE = 'Profile photo must be a JPEG, PNG or WebP image';

describe('decodeImage', () => {
  it('accepts JPEG, PNG and WebP images and returns their bytes', () => {
    for (const [type, bytes] of [['image/jpeg', JPEG], ['image/png', PNG], ['image/webp', WEBP]]) {
      const image = decodeImage(dataUri(type, bytes));
      assert.equal(image.contentType, type);
      assert.deepEqual([...image.data], bytes);
    }
  });

  it('rejects a file whose bytes do not match the type it claims', () => {
    assert.throws(() => decodeImage(dataUri('image/jpeg', PNG)), { message: WRONG_TYPE });
    assert.throws(() => decodeImage(dataUri('image/png', JPEG)), { message: WRONG_TYPE });
    assert.throws(() => decodeImage(dataUri('image/webp', Buffer.from(NOT_AN_IMAGE))), { message: WRONG_TYPE });
  });

  it('rejects other image types', () => {
    assert.throws(() => decodeImage(dataUri('image/gif', [...Buffer.from('GIF89a'), 0, 0, 0, 0, 0, 0])), { message: WRONG_TYPE });
    assert.throws(() => decodeImage(dataUri('image/svg+xml', Buffer.from('<svg></svg>'))), { message: WRONG_TYPE });
  });

  it('rejects web addresses, file paths and other non-data values', () => {
    for (const value of ['https://example.com/me.jpg', 'file:///C:/me.jpg', '/tmp/me.jpg', '', null, 42]) {
      assert.throws(() => decodeImage(value), { message: WRONG_TYPE }, `${value} should be rejected`);
    }
  });

  it('rejects a file too small to hold an image header', () => {
    assert.throws(() => decodeImage(dataUri('image/jpeg', [0xff, 0xd8, 0xff, 0xe0])), { message: WRONG_TYPE });
  });

  it('accepts a photo at the size limit and rejects one byte over', () => {
    const atLimit = Buffer.alloc(MAX_IMAGE_BYTES);
    Buffer.from(JPEG).copy(atLimit);
    assert.equal(decodeImage(dataUri('image/jpeg', atLimit)).data.length, MAX_IMAGE_BYTES);

    const overLimit = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    Buffer.from(JPEG).copy(overLimit);
    assert.throws(() => decodeImage(dataUri('image/jpeg', overLimit)), { message: 'Profile photo is too large' });
  });
});

describe('toDataUri', () => {
  it('turns a stored photo back into the data URI it was decoded from', () => {
    const uri = dataUri('image/png', PNG);
    assert.equal(toDataUri(decodeImage(uri)), uri);
  });
});
