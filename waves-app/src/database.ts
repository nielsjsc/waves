
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb/plugins/core';

import { getRxStorageLocalstorage } from 'rxdb/plugins/storage-localstorage';

import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

import { participantSchema, slotSchema, type ParticipantCollection, type ParticipantCollectionMethods, type SlotCollection, type SlotCollectionMethods, type WavesDbCollections } from './Schema';

import { createCollection } from '@tanstack/react-db'
import { rxdbCollectionOptions } from '@tanstack/rxdb-db-collection';

import { replicateServer } from 'rxdb-server/plugins/replication-server';


addRxPlugin(RxDBDevModePlugin);

console.log('rxdb: Creating database...')
const db = await createRxDatabase<WavesDbCollections>({
    name: 'wavesdb',
    storage: wrappedValidateAjvStorage({ storage: getRxStorageLocalstorage() })
});
console.log('rxdb: Created database.')


const slotCollectionMethods: SlotCollectionMethods = {
    dropAllDocs: async function(this: SlotCollection) {
        return await this.find().remove()
    }
}

const participantCollectionMethods: ParticipantCollectionMethods  = {
    dropAllDocs: async function(this: ParticipantCollection) {
        return await this.find().remove()
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
            statics: participantCollectionMethods
        }
    });
}

await createRxCollections()

function replicateRxCollectionsWithServer() {
    // start replication with server
    replicateServer({
        collection: db.slots,
        replicationIdentifier: 'slots-replication-client-to-local-server',
        url: 'http://localhost:8080/slots/0', //server url
        live: true,
        pull: { batchSize: 50 },
        push: { batchSize: 50 }
    });
    replicateServer({
        collection: db.participants,
        replicationIdentifier: 'participants-replication-client-to-local-server',
        url: 'http://localhost:8080/participants/0', //server url
        live: true,
        pull: { batchSize: 50 },
        push: { batchSize: 50 }
    });
    console.log('Server replication started')
}

replicateRxCollectionsWithServer()

function createTanSlotsCollection() {
    console.log('db: create tanstack Slots collection')
    return createCollection(
        rxdbCollectionOptions({
            rxCollection: db.slots,
            startSync: true,
        })
    )
}

function createTanParticipantsCollection() {
    console.log('db: create tanstack Participants collection')
    return createCollection(
        rxdbCollectionOptions({
            rxCollection: db.participants,
            startSync: true,
        })
    )
}

export async function dropAllSlots() {
    return db.slots.dropAllDocs()
}
export async function dropAllParticipants() {
    return db.participants.dropAllDocs()
}

export const slotsCollection = createTanSlotsCollection()
export const participantsCollection  = createTanParticipantsCollection()
