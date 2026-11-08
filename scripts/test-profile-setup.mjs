// #202: first-run profile setup, weekly availability and uploaded profile photos.
import assert from 'node:assert/strict';
import Media from '../backend/src/models/Media.js';
import User from '../backend/src/models/User.js';
import { runTest, startHarness } from './lib/graphqlHarness.mjs';

const harness = await startHarness(`profile-setup-test-${Date.now()}`);
const { ok, fails, createUsers, fresh } = harness;

const ME = `query{me{ id name bio profilePicture profileComplete profileSetupMissing
  sportSkills{sport skillLevel} availability{day periods} }}`;
const UPLOAD = 'mutation($p:String!){uploadProfilePhoto(image:$p){id contentType}}';
const UPDATE = `mutation($i:UpdateProfileInput!){updateProfile(input:$i){
  id name bio profilePicture profileComplete profileSetupMissing availability{day periods} }}`;

const dataUri = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
const JPEG = dataUri('image/jpeg', [0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1]);
const OTHER_JPEG = dataUri('image/jpeg', [0xff, 0xd8, 0xff, 0xe1, 0, 16, 69, 120, 105, 102, 0, 0, 2, 2]);
const PNG = dataUri('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const WEBP = dataUri('image/webp', [...Buffer.from('RIFF'), 20, 0, 0, 0, ...Buffer.from('WEBPVP8 ')]);

await runTest(harness, async () => {
  const [alice, bob] = await createUsers(['alice', 'bob']);

  // ---- A new account starts with setup incomplete ---------------------------
  const start = (await ok(ME, {}, await fresh(alice))).me;
  assert.equal(start.profileComplete, false);
  assert.deepEqual(start.profileSetupMissing, ['sports', 'availability'], 'the sign-up name counts and a photo is optional');
  console.log('✓ New accounts report which setup steps are missing');

  // ---- Photos are uploaded and referenced, never taken as a raw string -------
  for (const bad of [
    'file:///var/mobile/Containers/Data/tmp/photo.jpg',
    'https://example.com/me.jpg',
    'data:image/svg+xml;base64,PHN2Zz4=',
    dataUri('image/png', [0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]),
    dataUri('image/jpeg', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  ]) {
    await fails(UPLOAD, { p: bad }, await fresh(alice), 'must be a JPEG, PNG or WebP');
  }
  await fails(UPLOAD, { p: dataUri('image/jpeg', [0xff, 0xd8, 0xff, ...new Array(160 * 1024).fill(0)]) }, await fresh(alice), 'too large');
  assert.equal(await Media.countDocuments({ owner: alice._id }), 0, 'rejected uploads store nothing');
  for (const [image, type] of [[PNG, 'image/png'], [WEBP, 'image/webp']]) {
    assert.equal((await ok(UPLOAD, { p: image }, await fresh(alice))).uploadProfilePhoto.contentType, type);
  }
  await fails(UPDATE, { i: { profilePhotoId: 'file:///tmp/photo.jpg' } }, await fresh(alice), 'Choose the photo again');

  const upload = (await ok(UPLOAD, { p: JPEG }, await fresh(alice))).uploadProfilePhoto;
  assert.equal(await Media.countDocuments({ owner: alice._id }), 1, 'only the latest unsaved upload is kept');
  assert.ok((await Media.findById(upload.id)).expiresAt, 'an unsaved upload expires');
  await fails(UPDATE, { i: { profilePhotoId: upload.id } }, await fresh(bob), 'Choose the photo again');
  assert.equal((await fresh(bob)).profilePhoto, null, 'you cannot use someone else\'s upload');
  console.log('✓ Photos must be real JPEG, PNG or WebP uploads owned by the user');

  // ---- Saving the setup ------------------------------------------------------
  await fails(UPDATE, { i: { availability: [{ day: 'FUNDAY', periods: ['MORNING'] }] } }, await fresh(alice), 'Weekday');
  await fails(UPDATE, { i: { availability: [{ day: 'MON', periods: ['NIGHT'] }] } }, await fresh(alice), 'DayPeriod');
  const saved = (await ok(UPDATE, {
    i: {
      name: '  Alice Ace ',
      bio: 'Weekend pickleball',
      profilePhotoId: upload.id,
      sportSkills: [{ sport: 'Pickleball', skillLevel: 4 }],
      availability: [
        { day: 'SAT', periods: ['EVENING', 'MORNING'] },
        { day: 'TUE', periods: [] },
        { day: 'MON', periods: ['EVENING'] },
        { day: 'SAT', periods: ['MORNING', 'AFTERNOON'] }
      ]
    }
  }, await fresh(alice))).updateProfile;
  assert.equal(saved.name, 'Alice Ace');
  assert.equal(saved.profilePicture, JPEG, 'the profile shows the uploaded photo');
  assert.deepEqual(saved.availability, [
    { day: 'MON', periods: ['EVENING'] },
    { day: 'SAT', periods: ['MORNING', 'AFTERNOON', 'EVENING'] }
  ], 'days are merged, sorted, and empty ones dropped');
  assert.equal(saved.profileComplete, true);
  assert.deepEqual(saved.profileSetupMissing, []);
  assert.equal((await Media.findById(upload.id)).expiresAt, null, 'a saved photo no longer expires');
  const storedAlice = await fresh(alice);
  assert.equal(String(storedAlice.profilePhoto), upload.id, 'the profile stores a reference to the upload');
  assert.equal(storedAlice.profilePicture, '', 'no image data is stored on the profile itself');
  console.log('✓ Setup saves name, photo, sports, availability and bio');

  // ---- After a restart the saved profile loads again -------------------------
  const reloaded = (await ok(ME, {}, await fresh(alice))).me;
  assert.deepEqual(
    [reloaded.name, reloaded.bio, reloaded.profilePicture, reloaded.profileComplete, reloaded.sportSkills],
    ['Alice Ace', 'Weekend pickleball', JPEG, true, [{ sport: 'Pickleball', skillLevel: 4 }]]
  );
  const bobView = (await ok(ME, {}, await fresh(bob))).me;
  assert.deepEqual([bobView.name, bobView.bio, bobView.profilePicture, bobView.availability], ['bob', '', '', []], 'each user\'s profile is separate');
  console.log('✓ The saved profile loads for its owner only');

  // ---- Changing and removing the photo -------------------------------------
  const replacement = (await ok(UPLOAD, { p: OTHER_JPEG }, await fresh(alice))).uploadProfilePhoto;
  assert.ok(await Media.findById(upload.id), 'uploading a new photo keeps the saved one until the profile is saved');
  const swapped = (await ok(UPDATE, { i: { profilePhotoId: replacement.id } }, await fresh(alice))).updateProfile;
  assert.equal(swapped.profilePicture, OTHER_JPEG);
  assert.equal(await Media.findById(upload.id), null, 'the replaced photo is deleted');
  const removed = (await ok(UPDATE, { i: { profilePhotoId: '' } }, await fresh(alice))).updateProfile;
  assert.equal(removed.profilePicture, '');
  assert.equal(removed.profileComplete, true, 'a photo is optional, so removing it keeps setup complete');
  assert.equal(await Media.countDocuments({ owner: alice._id }), 0, 'and deletes it');
  console.log('✓ Photos can be replaced and removed without leaving old files behind');

  // ---- Older accounts --------------------------------------------------------
  const legacyPicture = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';
  await User.updateOne({ _id: bob._id }, { profilePicture: legacyPicture, sports: ['Soccer'], skillLevel: 2 });
  const legacy = (await ok(ME, {}, await fresh(bob))).me;
  assert.equal(legacy.profilePicture, legacyPicture, 'photos stored inline before uploads still show');
  assert.deepEqual(legacy.profileSetupMissing, ['availability'], 'and count towards setup');
  console.log('✓ Older accounts keep their inline photo and sports');

  // ---- Lists of players load photos in one go ------------------------------
  const third = (await createUsers(['carol']))[0];
  for (const user of [alice, third]) {
    const id = (await ok(UPLOAD, { p: JPEG }, await fresh(user))).uploadProfilePhoto.id;
    await ok(UPDATE, { i: { profilePhotoId: id } }, await fresh(user));
  }
  const { createSession: { id: sessionId } } = await ok('mutation($i:CreateSessionInput!){createSession(input:$i){id}}', {
    i: {
      sport: 'Pickleball', startsAt: new Date(Date.now() + 86400000).toISOString(), location: 'Photo Court',
      locationPoint: { longitude: -86.9, latitude: 40.4 }, maxParticipants: 4, skillLevel: 2
    }
  }, await fresh(alice));
  for (const user of [bob, third]) await ok('mutation($s:ID!){joinSession(sessionId:$s){id}}', { s: sessionId }, await fresh(user));
  let reads = 0;
  const find = Media.find.bind(Media);
  Media.find = (...args) => { reads += 1; return find(...args); };
  try {
    const roster = (await ok('query($id:ID!){getSession(id:$id){participants{profilePicture}}}', { id: sessionId })).getSession;
    assert.deepEqual(roster.participants.map((p) => p.profilePicture), [JPEG, legacyPicture, JPEG]);
  } finally {
    Media.find = find;
  }
  assert.equal(reads, 1, 'every photo in the roster comes from one query');
  console.log('✓ A list of players loads all their photos with one query');

  console.log('Profile setup tests passed');
});
