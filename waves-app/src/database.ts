
import { createRxDatabase, addRxPlugin } from 'rxdb/plugins/core';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

// import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

import { RxDBCleanupPlugin } from 'rxdb/plugins/cleanup';

import { changesSchema, participantSchema, slotSchema, type ChangesCollection, type ChangesCollectionMethods, type ParticipantCollection, type ParticipantCollectionMethods, type SlotCollection, type SlotCollectionMethods, type WavesDbCollections } from './Schema';

import { createCollection as createTanDbCollection } from '@tanstack/react-db'
import { rxdbCollectionOptions } from '@tanstack/rxdb-db-collection';

import { replicateServer } from 'rxdb-server/plugins/replication-server';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';


// addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBCleanupPlugin)
addRxPlugin(RxDBMigrationSchemaPlugin)

// Replication location is actually nginx which terminates SSL and forwards to the server.
const RX_REPLICATION_SERVER_PROTOCOL = 'https'
const RX_REPLICATION_SERVER_HOST = 'server.waves.local'
const RX_REPLICATION_SERVER_PORT = '5443'

console.log('rxdb: Creating database...')
const db = await createRxDatabase<WavesDbCollections>({
    name: 'wavesAppDb',
    storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() })
});
console.log('rxdb: Created database.')


const slotCollectionMethods: SlotCollectionMethods = {
    dropAllDocs: async function(this: SlotCollection) {
        await this.find().remove()
        await this.cleanup(0)
        return
    }
}

const participantCollectionMethods: ParticipantCollectionMethods  = {
    dropAllDocs: async function(this: ParticipantCollection) {
        await this.find().remove()
        await this.cleanup(0)
        return
    }
}

const changesCollectionMethods: ChangesCollectionMethods  = {
    dropAllDocs: async function(this: ChangesCollection) {
        await this.find().remove()
        await this.cleanup(0)
        return
    }
}

async function createRxCollections() {
    // create collections
    console.log('rxdb: create collections');
    await db.addCollections({
        slots: {
            schema: slotSchema,
            statics: slotCollectionMethods
        },
        participants: {
            schema: participantSchema,
            statics: participantCollectionMethods,
        },
        changes: {
            schema: changesSchema,
            statics: changesCollectionMethods
        }
    });
}

await createRxCollections()

function replicateRxCollectionsWithServer() {
    // start replication with server
    replicateServer({
        collection: db.slots,
        replicationIdentifier: 'slots-replication-app-to-rxserver',
        url: `${RX_REPLICATION_SERVER_PROTOCOL}://${RX_REPLICATION_SERVER_HOST}:${RX_REPLICATION_SERVER_PORT}/slots/0`, //server url
        live: true,
        pull: { batchSize: 50 },
        push: { batchSize: 50 }
    });
    replicateServer({
        collection: db.participants,
        replicationIdentifier: 'participants-replication-app-to-rxserver',
        url: `${RX_REPLICATION_SERVER_PROTOCOL}://${RX_REPLICATION_SERVER_HOST}:${RX_REPLICATION_SERVER_PORT}/participants/0`, //server url
        live: true,
        pull: { batchSize: 50 },
        push: { batchSize: 50 }
    });
    replicateServer({
        collection: db.changes,
        replicationIdentifier: 'changes-replication-app-to-rxserver',
        url: `${RX_REPLICATION_SERVER_PROTOCOL}://${RX_REPLICATION_SERVER_HOST}:${RX_REPLICATION_SERVER_PORT}/changes/0`, //server url
        live: true,
        pull: { batchSize: 50 },
        push: { batchSize: 50 }
    });
    console.log(`rxdb: RxServer replication started to ${RX_REPLICATION_SERVER_HOST}`)
}

// replicateRxCollectionsWithServer() // TODO: re-enable when nginx is running



export const slotsTanCollection = createTanDbCollection(rxdbCollectionOptions({
            rxCollection: db.slots,
            startSync: true,
        })
    )

export const participantsTanCollection = createTanDbCollection(rxdbCollectionOptions({
            rxCollection: db.participants,
            startSync: true,
        })
    )

export const changesTanCollection = createTanDbCollection(rxdbCollectionOptions({
            rxCollection: db.changes,
            startSync: true,
        })
    )

export async function dropAllSlots() {
    return db.slots.dropAllDocs()
}
export async function dropAllParticipants() {
    return db.participants.dropAllDocs()
}

export async function dropAllChanges() {
    return db.changes.dropAllDocs()
}

// export async function insertMockData() {
//     const MRid = crypto.randomUUID()
//     const NJid = crypto.randomUUID()
//     const TWid = crypto.randomUUID()
//     const TKid = crypto.randomUUID()
//     const VMid = crypto.randomUUID()
//     const GWid = crypto.randomUUID()
//     const DBid = crypto.randomUUID()
//     const EJid = crypto.randomUUID()
//     const WEid = crypto.randomUUID()
//     const BFid = crypto.randomUUID()
//     const IUid = crypto.randomUUID()
//     const GNid = crypto.randomUUID()
//     const MBid = crypto.randomUUID()
//     const LBid = crypto.randomUUID()
//     const MFid = crypto.randomUUID()
//     const LTid = crypto.randomUUID()

//     const tx1 = participantsTanCollection.insert([
//         // {id: MRid, name: 'Marissa Roecks Group(4)', club: 'Cascade OC', state: 'waiting'},
//         // {id: NJid, name: 'Nate Jergensen', club: 'Summit Trails Middle', state: 'waiting'},
//         // {id: TWid, name: 'Traci Weygandt', club: 'Cascade OC', state: 'waiting'},
//         // {id: TKid, name: 'Thomas Kornelis', club: 'Bremerton', state: 'waiting'},
//         // {id: VMid, name: 'Venna Menzie', club: 'Tahoma', state: 'waiting'},
//         // {id: GWid, name: 'Graham Winters', club: 'Tahoma', state: 'waiting'},
//         // {id: DBid, name: 'Danny Buchholz', club: 'Shorewood', state: 'waiting'},
//         // {id: IUid, name: 'Ing Uhlin', club: "Cascade OC", state: 'waiting'},
//         // {id: EJid, name: 'Eric Jones', club: "Cascade OC", state: 'waiting'},

//         // {id: MBid, name: 'Millie Rebbeck', club: 'Seattle Country Day', state: 'waiting'},
//         // {id: LBid, name: 'Logan Burdette', club: 'Northwood Middle', state: 'present'},
//         // {id: MFid, name: 'Maria Franzie Ventolero', club: 'Oak Harbor', state: 'validated'},
//         // {id: LTid, name: 'Logan Taylor', club: 'Arlington', state: 'noShow'},
        
//         // {id: BFid, name: 'Bob Forgrave', club: "Cascade OC", state: 'notAttending'},
//         // {id: GNid, name: 'Gina Nuss', club: "Orienteer Kansas", state: 'needsAssignment'},
//         // {id: WEid, name: 'Will Enger', club: "Sammamish River", state: 'waiting'},
//     ])
//     await tx1.isPersisted.promise

//     const tx2 = slotsTanCollection.insert([
//         {id: crypto.randomUUID(), time: '10:02', course: 'c1', participants: [MRid]},
//         {id: crypto.randomUUID(), time: '10:02', course: 'c2', participants: [NJid]},
//         {id: crypto.randomUUID(), time: '10:02', course: 'c3', participants: [TWid]},
//         {id: crypto.randomUUID(), time: '10:02', course: 'c4', participants: [TKid]},
//         {id: crypto.randomUUID(), time: '10:02', course: 'c5', participants: [VMid]},
//         {id: crypto.randomUUID(), time: '10:02', course: 'c6', participants: [GWid]},
//         {id: crypto.randomUUID(), time: '10:02', course: 'c7', participants: [DBid]},
//         {id: crypto.randomUUID(), time: '10:02', course: 'c8', participants: [IUid]},
//         {id: crypto.randomUUID(), time: '10:02', course: 'c9', participants: [EJid]},

//         {id: crypto.randomUUID(), time: '10:04', course: 'c1', participants: [MBid]},
//         {id: crypto.randomUUID(), time: '10:06', course: 'c2', participants: [LBid]},
//         {id: crypto.randomUUID(), time: '10:08', course: 'c3', participants: [MFid]},
//         {id: crypto.randomUUID(), time: '10:10', course: 'c4', participants: [LTid]},
//         {id: crypto.randomUUID(), time: '10:12', course: 'c5', participants: [BFid]},
//         // {id: crypto.randomUUID(), time: '10:04', course: 'c6', participants: []},
//         {id: crypto.randomUUID(), time: '10:14', course: 'c7', participants: []},
//         {id: crypto.randomUUID(), time: '10:16', course: 'c8', participants: [GNid]},
//         {id: crypto.randomUUID(), time: '10:18', course: 'c9', participants: [WEid]},

//         // {id: crypto.randomUUID(), time: '10:06', course: 'c8', participants: [GNid]},
//         // {id: crypto.randomUUID(), time: '10:06', course: 'c9', participants: [WEid]},
//     ])
//     await tx2.isPersisted.promise

//     Promise.all([tx1, tx2]).then(() => {
//         console.log("Mock Data Loaded")
//     })
// }