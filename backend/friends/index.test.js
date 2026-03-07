const test = require('node:test');
const assert = require('node:assert/strict');
const { Mongoose } = require('mongoose');

const { __testables } = require('./index');

test('findExistingByClientTempId trims temp id and queries by sender/recipient', async () => {
  const seenQueries = [];
  const FriendMessage = {
    async findOne(query) {
      seenQueries.push(query);
      return { _id: 'msg_1' };
    }
  };

  const result = await __testables.findExistingByClientTempId(FriendMessage, {
    fromUid: 'sender-uid',
    toUid: 'recipient-uid',
    clientTempId: '  temp-123  '
  });

  assert.deepEqual(result, { _id: 'msg_1' });
  assert.equal(seenQueries.length, 1);
  assert.deepEqual(seenQueries[0], {
    fromUid: 'sender-uid',
    toUid: 'recipient-uid',
    clientTempId: 'temp-123'
  });
});

test('findExistingByClientTempId returns null for missing/blank temp id', async () => {
  let findOneCalled = false;
  const FriendMessage = {
    async findOne() {
      findOneCalled = true;
      return { _id: 'should-not-happen' };
    }
  };

  const resultMissing = await __testables.findExistingByClientTempId(FriendMessage, {
    fromUid: 'sender-uid',
    toUid: 'recipient-uid',
    clientTempId: null
  });
  const resultBlank = await __testables.findExistingByClientTempId(FriendMessage, {
    fromUid: 'sender-uid',
    toUid: 'recipient-uid',
    clientTempId: '   '
  });

  assert.equal(resultMissing, null);
  assert.equal(resultBlank, null);
  assert.equal(findOneCalled, false);
});

test('FriendMessage schema defines unique sparse idempotency index', () => {
  const isolatedMongoose = new Mongoose();
  const { FriendMessage } = __testables.getModels(isolatedMongoose);
  const indexes = FriendMessage.schema.indexes();

  const idempotencyIndex = indexes.find(([fields, options]) => {
    return (
      fields.fromUid === 1
      && fields.toUid === 1
      && fields.clientTempId === 1
      && options?.unique === true
      && options?.sparse === true
      && options?.name === 'friends_unique_temp_send'
    );
  });

  assert.ok(idempotencyIndex, 'Expected friends_unique_temp_send unique sparse index to exist');
});
