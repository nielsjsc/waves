// adapted from https://rxdb.info/replication-mongodb.html and
//  https://rxdb.info/rx-storage-mongodb.html

import { MongoClient } from 'mongodb';
const mongoClient = new MongoClient(
    'mongodb://localhost:27017/?directConnection=true'
);
const mongoDatabase = mongoClient.db('wavesmongodb');
console.log('created Mongodb: wavesmongodb')
await mongoDatabase.createCollection('slots', {
  changeStreamPreAndPostImages: { enabled: true },
});
await mongoDatabase.createCollection('participants', {
  changeStreamPreAndPostImages: { enabled: true }
});
console.log('added collections to wavesmongodb')


import { createRxDatabase } from 'rxdb';
import { getRxStorageMongoDB } from 'rxdb/plugins/storage-mongodb';
 
const serverRxDb = await createRxDatabase({
    name: 'wavesServerDb',
    storage: getRxStorageMongoDB({
        /**
         * MongoDB connection string
         * @link https://www.mongodb.com/docs/manual/reference/connection-string/
         */
        // connection: 'mongodb://localhost:27017,localhost:27018,localhost:27019'
        connection: 'mongodb://localhost:27017'
    })
});

console.log('created rxdb with connection to mongo storage')

// Add your collection schema
await serverRxDb.addCollections({
    slots: {
        schema: {
            version: 0,
            primaryKey: 'id',
            type: 'object',
            required: ['id', 'time', 'course'],
            properties: {
                id: { type: 'string', maxLength: 64},
                time: { type: 'string' },
                course: { type: 'string' },
                participants: { type: 'array', ref: 'participants', items: { type: 'string' } }
            }
        }
    },
    participants: {
        schema: {
            version: 0,
            primaryKey: 'id',
            type: 'object',
            required: ['id', 'name', 'state' ],
            properties: {
                id: { type: 'string', maxLength: 64},
                name: { type: 'string' },
                state: { type: 'string' },
                club: { type: 'string' },
                // epunch: { type: 'string' },
                // race_class: { type: 'string' },
            }
        }
    }
});

console.log('added collections to rxdb')

import { replicateMongoDB } from 'rxdb/plugins/replication-mongodb';
 
const replicationStateParticipants = replicateMongoDB({
  mongodb: {
    collectionName: 'participants',
    connection: 'mongodb://localhost:27017',
    databaseName: 'wavesmongodb'
  },
  collection: serverRxDb.participants,
  replicationIdentifier: 'participants-mongodb-replication-localhost',
  pull: { batchSize: 50 },
  push: { batchSize: 50 },
  live: true
});

const replicationStateSlots = replicateMongoDB({
  mongodb: {
    collectionName: 'slots',
    connection: 'mongodb://localhost:27017',
    databaseName: 'wavesmongodb'
  },
  collection: serverRxDb.slots,
  replicationIdentifier: 'slots-mongodb-replication-localhost',
  pull: { batchSize: 50 },
  push: { batchSize: 50 },
  live: true
});

replicationStateParticipants.error$.subscribe(err => {
    console.log('replication error:')
    console.dir(err);
    console.error(err);
})
await replicationStateParticipants.awaitInSync();

console.log('established replication from rxdb to mongodb')

import { createRxServer } from 'rxdb-server/plugins/server';
import { RxServerAdapterExpress } from 'rxdb-server/plugins/adapter-express';
 
const server = await createRxServer({
  database: serverRxDb,
  adapter: RxServerAdapterExpress,
  port: 8080,
  cors: '*'
});

console.log('created rx-server')
 
const slotsEndpoint = server.addReplicationEndpoint({
    name: 'slots',
    collection: serverRxDb.slots
});
console.log('Replication endpoint:', `http://localhost:8080/${slotsEndpoint.urlPath}`);

const participantsEndpoint = server.addReplicationEndpoint({
    name: 'participants',
    collection: serverRxDb.participants
});
console.log('Replication endpoint:', `http://localhost:8080/${participantsEndpoint.urlPath}`);

console.log('added replication endpoints to rx-server')
 
// do not forget to start the server!
await server.start();

console.log('started rx-server')