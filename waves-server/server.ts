// adapted from https://rxdb.info/replication-mongodb.html and
//  https://rxdb.info/rx-storage-mongodb.html

// ESTABLISH MONGODB

import { MongoClient } from 'mongodb';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// EVENT: each event has its own databases, named after the start list.
// startsheet_to_csv.py writes event.json (run it from make-start-list.cmd) into
// waves-app/public. Start this server from the waves-server folder.
const EVENT_FILE = resolve(process.env.WAVES_EVENT_FILE ?? '../waves-app/public/event.json')
if (!existsSync(EVENT_FILE)) {
    console.error(`PROBLEM: ${EVENT_FILE} not found. Run make-start-list.cmd first, then start the server again.`)
    process.exit(1)
}
const EVENT_ID: string = JSON.parse(readFileSync(EVENT_FILE, 'utf8')).eventId
if (!/^[a-z0-9]+$/.test(EVENT_ID ?? '')) {
    console.error(`PROBLEM: ${EVENT_FILE} does not contain a valid eventId. Run make-start-list.cmd again.`)
    process.exit(1)
}
const MONGO_DB_NAME = `wavesmongodb_${EVENT_ID}`
console.log(`event: ${EVENT_ID}`)

const mongoClient = new MongoClient(
    'mongodb://localhost:27017/?directConnection=true'
);
const mongoDatabase = mongoClient.db(MONGO_DB_NAME);
console.log(`using Mongodb: ${MONGO_DB_NAME}`)

// Restarting the server during an event must not fail because the collections already exist.
async function ensureCollection(name: string) {
    try {
        await mongoDatabase.createCollection(name, {
            changeStreamPreAndPostImages: { enabled: true },
        });
    } catch (err: any) {
        if (err?.code !== 48) { throw err }   // 48 = NamespaceExists
    }
}
await ensureCollection('slots')
await ensureCollection('participants')
await ensureCollection('changes')
console.log(`added collections to ${MONGO_DB_NAME}`)

// ESTABLISH THE RX-SERVER INSTANCE

import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageMongoDB } from 'rxdb/plugins/storage-mongodb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';

addRxPlugin(RxDBMigrationSchemaPlugin);

const SERVER_RX_DB_NAME = `wavesServerDb_${EVENT_ID}`

function autoMigrations(version: number): Record<number, (oldDoc: any) => any> {
    const strategies: Record<number, (oldDoc: any) => any> = {}
    for (let v = 1; v <= version; v++) {
        strategies[v] = (oldDoc: any) => oldDoc
    }
    return strategies
}

async function createServerRxDb() {
    return createRxDatabase({
        name: SERVER_RX_DB_NAME,
        storage: getRxStorageMongoDB({
            connection: 'mongodb://localhost:27017'
        })
    })
}

let serverRxDb = await createServerRxDb();

console.log('created rxdb')

const serverCollectionsConfig = {
    // UPDATE IN APP>Schema.ts TO MATCH!!
    slots: {
        schema: {
            version: 1,
            primaryKey: 'id',
            type: 'object',
            required: ['id', 'time', 'course', 'participants', 'isUsable'],
            properties: {
                id: { type: 'string', maxLength: 64},
                time: { type: 'string' },
                course: { type: 'string' },
                participants: { type: 'array', ref: 'participants', items: { type: 'string' } },
                isUsable: { type: 'boolean' }
            }
        },
        migrationStrategies: autoMigrations(1)
    },
    participants: {
        schema: {
            version: 3,
            primaryKey: 'id',
            type: 'object',
            required: ['id', 'name', 'state', 'isRental', 'isNonCompete', 'groupSize', 'startChanged' ],
            properties: {
                id: { type: 'string', maxLength: 64},
                name: { type: 'string' },
                state: { type: 'string', enum: ["waiting", "present", "validated", "wrongEpunch", "noShow", "notAttending", "needsAssignment", "started"]},
                prevState: { type: 'string', enum: ["waiting", "present", "validated", "wrongEpunch", "noShow", "notAttending", "needsAssignment", "started"]},
                club: { type: 'string' },
                epunch: { type: 'string' },
                isRental: { type: 'boolean' },
                isNonCompete: { type: 'boolean' },
                groupSize: {type: 'number' },
                // race_class: { type: 'string' },
                originalStartTime: {type: 'string'},
                startChanged: {type: 'boolean'},
                needsWaiver: { type: 'boolean' },
                needsPayment: { type: 'boolean' },
                isSecondCourse: { type: 'boolean' },
                hasRentedCompass: { type: 'boolean' },
                compassId: { type: 'string' }
            }
        },
        migrationStrategies: autoMigrations(3)
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
        },
        migrationStrategies: autoMigrations(0)
    }
}

try {
    await serverRxDb.addCollections(serverCollectionsConfig);
} catch (err: any) {
    if (err?.code === 'DB6' || err?.code === 'DM4' || err?.code === 'DB1') {
        console.warn(`Schema change detected (${err.code}); resetting RxDB cache ${SERVER_RX_DB_NAME} and re-syncing from ${MONGO_DB_NAME}...`)
        try {
            await serverRxDb.remove()
        } catch {
            // ignore remove errors before dropping cache db
        }
        await mongoClient.db(SERVER_RX_DB_NAME).dropDatabase()
        serverRxDb = await createServerRxDb()
        await serverRxDb.addCollections(serverCollectionsConfig)
    } else {
        throw err
    }
}

console.log('added collections to rxdb')

import { replicateMongoDB } from 'rxdb/plugins/replication-mongodb';

// CONNECT RX-SERVER TO THE MONGODB STORAGE VIA RX REPLICATION

const replicationStateParticipants = replicateMongoDB({
  mongodb: {
    collectionName: 'participants',
    connection: 'mongodb://localhost:27017',
    databaseName: MONGO_DB_NAME
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
    databaseName: MONGO_DB_NAME
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
        databaseName: MONGO_DB_NAME
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
const RX_SERVER_ALLOW_REMOTE = true

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
    name: `slots-${EVENT_ID}`,
    collection: serverRxDb.slots,
});
console.log('Replication endpoint:', `${RX_SERVER_HOST}:${RX_SERVER_PORT}/${slotsEndpoint.urlPath}`);

const participantsEndpoint = server.addReplicationEndpoint({
    name: `participants-${EVENT_ID}`,
    collection: serverRxDb.participants,
});
console.log('Replication endpoint:', `${RX_SERVER_HOST}:${RX_SERVER_PORT}/${participantsEndpoint.urlPath}`);
 

const changesEndpoint = server.addReplicationEndpoint({
    name: `changes-${EVENT_ID}`,
    collection: serverRxDb.changes,
});
console.log('Replication endpoint:', `${RX_SERVER_HOST}:${RX_SERVER_PORT}/${changesEndpoint.urlPath}`);


// do not forget to start the server!
await server.start();

console.log('started rx-server')

// Continuously auto-archive the 4 post-meet CSVs so closing the laptop or app never loses work.
const ARCHIVE_SCRIPT = resolve('..', 'scripts', 'count_people_on_course.py')
const ROOT_DIR = resolve('..')
if (existsSync(ARCHIVE_SCRIPT)) {
    let archiveTimer: ReturnType<typeof setTimeout> | undefined
    let archiveRunning = false
    let archivePending = false
    let pendingMode: '--rotate-once' | '--live' = '--live'

    const runArchiveExport = (mode: '--rotate-once' | '--live') => {
        if (archiveRunning) {
            archivePending = true
            pendingMode = mode === '--rotate-once' ? '--rotate-once' : pendingMode
            return
        }
        archiveRunning = true
        const execPython = (cmd: string, allowFallback: boolean) => {
            const child = spawn(cmd, [ARCHIVE_SCRIPT, mode, '--quiet'], {
                cwd: ROOT_DIR,
                stdio: ['ignore', 'ignore', 'pipe'],
            })
            let stderr = ''
            let handled = false
            child.stderr?.on('data', (chunk: Buffer) => {
                stderr += chunk.toString()
            })
            child.on('error', (err: any) => {
                if (handled) return
                handled = true
                if (allowFallback && err?.code === 'ENOENT') {
                    execPython('python', false)
                    return
                }
                archiveRunning = false
                console.warn('Auto-archive skipped:', err?.message ?? err)
            })
            child.on('close', (code) => {
                if (handled) return
                handled = true
                if (allowFallback && cmd === 'py' && code !== 0) {
                    execPython('python', false)
                    return
                }
                archiveRunning = false
                if (code !== 0 && stderr.trim() !== '') {
                    console.warn('Auto-archive warning:', stderr.trim())
                }
                if (archivePending) {
                    const nextMode = pendingMode
                    archivePending = false
                    pendingMode = '--live'
                    runArchiveExport(nextMode)
                }
            })
        }
        execPython(process.platform === 'win32' ? 'py' : 'python3', true)
    }

    const scheduleLiveArchive = () => {
        if (archiveTimer !== undefined) {
            clearTimeout(archiveTimer)
        }
        archiveTimer = setTimeout(() => {
            archiveTimer = undefined
            runArchiveExport('--live')
        }, 1500)
    }

    runArchiveExport('--rotate-once')
    serverRxDb.participants.$.subscribe(scheduleLiveArchive)
    serverRxDb.slots.$.subscribe(scheduleLiveArchive)
    serverRxDb.changes.$.subscribe(scheduleLiveArchive)
    console.log('continuous CSV auto-archiving enabled')
}