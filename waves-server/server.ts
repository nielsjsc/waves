// adapted from https://rxdb.info/replication-mongodb.html and
//  https://rxdb.info/rx-storage-mongodb.html

// ESTABLISH MONGODB

import { MongoClient } from 'mongodb';
const mongoClient = new MongoClient(
    'mongodb://localhost:27017/?directConnection=true'
);
const mongoDatabase = mongoClient.db('wavesmongodb');
console.log('using Mongodb: wavesmongodb')
await mongoDatabase.createCollection('slots', {
  changeStreamPreAndPostImages: { enabled: true },
});
await mongoDatabase.createCollection('participants', {
  changeStreamPreAndPostImages: { enabled: true }
});
await mongoDatabase.createCollection('changes', {
    changeStreamPreAndPostImages: {enabled: true }
})
console.log('added collections to wavesmongodb')

// ESTABLISH THE RX-SERVER INSTANCE

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

console.log('created rxdb')

// Add your collection schema
await serverRxDb.addCollections({
    // UPDATE IN APP>Schema.ts TO MATCH!!
    slots: {
        schema: {
            version: 0,
            primaryKey: 'id',
            type: 'object',
            required: ['id', 'time', 'course', 'participants'],
            properties: {
                id: { type: 'string', maxLength: 64},
                time: { type: 'string' },
                course: { type: 'string' },
                participants: { type: 'array', ref: 'participants', items: { type: 'string' } },
                isUsable: { type: 'boolean' }
            }
        }
    },
    participants: {
        schema: {
            version: 0,
            primaryKey: 'id',
            type: 'object',
            required: ['id', 'name', 'state', 'isRental', 'isNonCompete', 'groupSize', 'startChanged' ],
            properties: {
                id: { type: 'string', maxLength: 64},
                name: { type: 'string' },
                state: { type: 'string', enum: ["waiting", "present", "validated", "noShow", "notAttending", "needsAssignment", "started"]},
                prevState: { type: 'string', enum: ["waiting", "present", "validated", "noShow", "notAttending", "needsAssignment", "started"]},
                club: { type: 'string' },
                epunch: { type: 'string' },
                isRental: { type: 'boolean' },
                isNonCompete: { type: 'boolean' },
                groupSize: {type: 'number' },
                // race_class: { type: 'string' },
                originalStartTime: {type: 'string'},
                startChanged: {type: 'boolean'}
            }
        }
    },
    changes: {
        schema: {
            version: 0,
            primaryKey: 'id',
            type: 'object',
            required: ['id', 'participantId', 'changedAt', 'changeType', 'old', 'new', 'needsProcessing', 'isProcessed'],
            properties: {
                id: { type: 'string', maxLength: 64},
                participantId: { type: 'string', maxLength: 64},
                changedAt: { type: 'number'}, //ms since unix epoch UTC
                changeType: { type: 'string' },
                old: { type: 'string' },
                new: { type: 'string' },
                needsProcessing: { type: 'boolean' },
                isProcessed: { type: 'boolean' },
            }
        }   
    }
});

console.log('added collections to rxdb')

import { replicateMongoDB } from 'rxdb/plugins/replication-mongodb';

// CONNECT RX-SERVER TO THE MONGODB STORAGE VIA RX REPLICATION

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

replicationStateParticipants.error$.subscribe(err => {
    console.log('replication error:')
    console.dir(err);
    console.error(err);
})
await replicationStateParticipants.awaitInSync();

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

replicationStateSlots.error$.subscribe(err => {
    console.log('replication error:')
    console.dir(err);
    console.error(err);
})
await replicationStateSlots.awaitInSync();

const replicationStateChanges = replicateMongoDB({
    mongodb: {
        collectionName: 'changes',
        connection: 'mongodb://localhost:27017',
        databaseName: 'wavesmongodb'
    },
    collection: serverRxDb.changes,
    replicationIdentifier: 'changes-mongodb-replication-localhost',
    pull: { batchSize: 50 },
    push: { batchSize: 50 },
    live: true
});

replicationStateChanges.error$.subscribe(err => {
    console.log('replication error:')
    console.dir(err);
    console.error(err);
})
await replicationStateChanges.awaitInSync();


console.log('server rxdb synced with mongodb')

// SET UP RX SERVER AS A REPLICATION ENDPOINT FOR REMOTE CLIENTS

const RX_SERVER_HOST = 'localhost'
const RX_SERVER_PORT = 3000
const RX_SERVER_ALLOW_REMOTE = 'https://app.waves.local'

import { createRxServer } from 'rxdb-server/plugins/server';
import { RxServerAdapterExpress } from 'rxdb-server/plugins/adapter-express';
 
const server = await createRxServer({
  database: serverRxDb,
  adapter: RxServerAdapterExpress,
  hostname: RX_SERVER_HOST,
  port: RX_SERVER_PORT,
  cors: RX_SERVER_ALLOW_REMOTE
});

console.log('created rx-server')
 
const slotsEndpoint = server.addReplicationEndpoint({
    name: 'slots',
    collection: serverRxDb.slots,
});
console.log('Replication endpoint:', `${RX_SERVER_HOST}:${RX_SERVER_PORT}/${slotsEndpoint.urlPath}`);

const participantsEndpoint = server.addReplicationEndpoint({
    name: 'participants',
    collection: serverRxDb.participants,
});
console.log('Replication endpoint:', `${RX_SERVER_HOST}:${RX_SERVER_PORT}/${participantsEndpoint.urlPath}`);
 

const changesEndpoint = server.addReplicationEndpoint({
    name: 'changes',
    collection: serverRxDb.changes,
});
console.log('Replication endpoint:', `${RX_SERVER_HOST}:${RX_SERVER_PORT}/${changesEndpoint.urlPath}`);


// do not forget to start the server!
await server.start();

console.log('started rx-server')