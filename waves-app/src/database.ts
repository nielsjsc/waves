
import { createRxDatabase, addRxPlugin } from 'rxdb/plugins/core';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';

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
const RX_REPLICATION_SERVER_HOST = typeof window !== 'undefined' && window.location.hostname !== '' && window.location.hostname !== 'app.waves.local' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.hostname : 'server.waves.local'
const RX_REPLICATION_SERVER_PORT = '5443'

export interface EventInfo {
    eventId: string
    source?: string
    createdAt?: string
    starters?: number
}

function showStartupProblem(message: string): never {
    if (typeof document !== 'undefined') {
        const container = document.querySelector('#root') ?? document.body
        container.innerHTML = `
            <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111827;color:#f3f4f6;font-family:system-ui,sans-serif;padding:1.5rem;">
                <div style="max-width:32rem;border:1px solid #b91c1c;background:#450a0a;border-radius:0.5rem;padding:1.5rem;">
                    <h1 style="font-size:1.25rem;font-weight:700;margin:0 0 0.75rem 0;color:#fecaca;">Waves cannot start yet</h1>
                    <p style="margin:0 0 1rem 0;line-height:1.5;color:#fee2e2;">${message}</p>
                    <button onclick="window.location.reload()" style="background:#dc2626;color:#ffffff;border:none;border-radius:0.375rem;padding:0.5rem 1rem;font-weight:600;cursor:pointer;">
                        Reload
                    </button>
                </div>
            </div>
        `
    }
    throw new Error(message)
}

async function fetchEventInfo(): Promise<EventInfo> {
    let response: Response
    try {
        response = await fetch('/event.json', { cache: 'no-store' })
    } catch {
        showStartupProblem(
            'Could not reach the Waves app server to read event.json. Check that Waves is running, then reload this page.'
        )
    }
    if (!response.ok) {
        showStartupProblem(
            'No start list has been prepared yet (event.json is missing). Run make-start-list.cmd on the host laptop, then reload this page.'
        )
    }
    let info: EventInfo
    try {
        info = (await response.json()) as EventInfo
    } catch {
        showStartupProblem(
            'event.json could not be read. Run make-start-list.cmd again, then reload this page.'
        )
    }
    if (!/^[a-z0-9]+$/.test(info?.eventId ?? '')) {
        showStartupProblem(
            'event.json does not contain a valid eventId. Run make-start-list.cmd again, then reload this page.'
        )
    }
    return info
}

const IS_TEST_ENV = import.meta.env.MODE === 'test'

export const EVENT_INFO: EventInfo = IS_TEST_ENV ? { eventId: 'testevent01' } : await fetchEventInfo()
export const EVENT_ID: string = EVENT_INFO.eventId

console.log(`rxdb: Creating database for event ${EVENT_ID}...`)
const db = await createRxDatabase<WavesDbCollections>({
    name: `wavesAppDb_${EVENT_ID}`,
    storage: wrappedValidateAjvStorage({ storage: IS_TEST_ENV ? getRxStorageMemory() : getRxStorageDexie() })
});
console.log(`rxdb: Created database wavesAppDb_${EVENT_ID}.`)


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
            statics: slotCollectionMethods,
            migrationStrategies: {
                1: function(oldDoc) {
                    return oldDoc;
                }
            }
        },
        participants: {
            schema: participantSchema,
            statics: participantCollectionMethods,
            migrationStrategies: {
                1: function(oldDoc) {
                    return oldDoc;
                }
            }
        },
        changes: {
            schema: changesSchema,
            statics: changesCollectionMethods
        }
    });
}

await createRxCollections()

function replicateRxCollectionsWithServer() {
    const baseUrl = `${RX_REPLICATION_SERVER_PROTOCOL}://${RX_REPLICATION_SERVER_HOST}:${RX_REPLICATION_SERVER_PORT}`
    const slots = replicateServer({
        collection: db.slots,
        replicationIdentifier: `slots-replication-app-to-rxserver-${EVENT_ID}`,
        url: `${baseUrl}/slots-${EVENT_ID}/${slotSchema.version}`,
        live: true,
        pull: { batchSize: 50 },
        push: { batchSize: 50 }
    });
    const participants = replicateServer({
        collection: db.participants,
        replicationIdentifier: `participants-replication-app-to-rxserver-${EVENT_ID}`,
        url: `${baseUrl}/participants-${EVENT_ID}/${participantSchema.version}`,
        live: true,
        pull: { batchSize: 50 },
        push: { batchSize: 50 }
    });
    const changes = replicateServer({
        collection: db.changes,
        replicationIdentifier: `changes-replication-app-to-rxserver-${EVENT_ID}`,
        url: `${baseUrl}/changes-${EVENT_ID}/${changesSchema.version}`,
        live: true,
        pull: { batchSize: 50 },
        push: { batchSize: 50 }
    });
    console.log(`rxdb: RxServer replication started to ${RX_REPLICATION_SERVER_HOST} for event ${EVENT_ID}`)
    return { slots, participants, changes }
}

export const replications = IS_TEST_ENV ? undefined : replicateRxCollectionsWithServer()

export type SyncStatus = 'connecting' | 'synced' | 'offline'

let currentSyncStatus: SyncStatus = IS_TEST_ENV ? 'synced' : 'connecting'
const syncStatusListeners = new Set<(status: SyncStatus) => void>()
const syncChannel =
    typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(`waves-sync-status-${EVENT_ID}`)
        : undefined

function setSyncStatus(next: SyncStatus, broadcast = true) {
    if (currentSyncStatus === next) {
        return
    }
    currentSyncStatus = next
    for (const listener of syncStatusListeners) {
        listener(currentSyncStatus)
    }
    if (broadcast) {
        try {
            syncChannel?.postMessage({ type: 'status', status: currentSyncStatus })
        } catch { /* ignore */ }
    }
}

if (syncChannel !== undefined) {
    syncChannel.onmessage = (ev) => {
        const data = ev.data as { type?: string, status?: SyncStatus } | undefined
        if (data?.type === 'status' && (data.status === 'synced' || data.status === 'offline')) {
            setSyncStatus(data.status, false)
        } else if (data?.type === 'request' && currentSyncStatus !== 'connecting') {
            try {
                syncChannel.postMessage({ type: 'status', status: currentSyncStatus })
            } catch { /* ignore */ }
        }
    }
    try {
        syncChannel.postMessage({ type: 'request' })
    } catch { /* ignore */ }
}

export function getSyncStatus(): SyncStatus {
    return currentSyncStatus
}

export function onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    syncStatusListeners.add(listener)
    listener(currentSyncStatus)
    return () => {
        syncStatusListeners.delete(listener)
    }
}

const IS_HOST_CLIENT =
    typeof window === 'undefined' ||
    window.location.hostname === '' ||
    window.location.hostname === 'app.waves.local' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

export const firstSyncDone: Promise<void> = replications === undefined
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
          let settled = false
          const finish = () => {
              if (!settled) {
                  settled = true
                  resolve()
              }
          }
          Promise.all([
              replications.slots.awaitInitialReplication(),
              replications.participants.awaitInitialReplication(),
              replications.changes.awaitInitialReplication(),
          ]).then(() => {
              console.log(`rxdb: Initial sync with server finished for event ${EVENT_ID}`)
              setSyncStatus('synced')
              finish()
          })
          // Only allow the host machine to fall back to local offline startup if the sync server is unreachable.
          // Remote phones/tablets should wait until initial replication succeeds so they never import a separate copy offline.
          if (IS_HOST_CLIENT) {
              const sub = replications.slots.error$.subscribe(() => {
                  sub.unsubscribe()
                  finish()
              })
          }
      })

export async function cleanupLegacyDuplicateRecords(): Promise<void> {
    const [allParticipants, allSlots] = await Promise.all([
        db.participants.find().exec(),
        db.slots.find().exec(),
    ])
    const hasPrefixedParticipants = allParticipants.some((p) => p.id.startsWith(`${EVENT_ID}-`))
    if (hasPrefixedParticipants) {
        const legacyParticipantIds = allParticipants
            .filter((p) => /^p-c\d+-/.test(p.id))
            .map((p) => p.id)
        if (legacyParticipantIds.length > 0) {
            console.log(`rxdb: Removing ${legacyParticipantIds.length} legacy duplicate participants...`)
            await db.participants.bulkRemove(legacyParticipantIds)
        }
    }

    const hasPrefixedSlots = allSlots.some((s) => s.id.startsWith(`${EVENT_ID}-`))
    if (hasPrefixedSlots) {
        const legacySlotIds = allSlots
            .filter((s) => /^s-c\d+-/.test(s.id))
            .map((s) => s.id)
        if (legacySlotIds.length > 0) {
            console.log(`rxdb: Removing ${legacySlotIds.length} legacy duplicate slots...`)
            await db.slots.bulkRemove(legacySlotIds)
        }
    }
}

export async function isEventEmpty(): Promise<boolean> {
    const [slot, participant] = await Promise.all([
        db.slots.findOne().exec(),
        db.participants.findOne().exec(),
    ])
    return slot === null && participant === null
}

// Detect when a tab has been left open from a previous event so it shows a
// reload screen instead of trying to keep working with old data.
let staleEvent = false
const staleListeners = new Set<() => void>()

export function isStaleEvent(): boolean {
    return staleEvent
}

export function onStaleEvent(listener: () => void): () => void {
    staleListeners.add(listener)
    if (staleEvent) {
        listener()
    }
    return () => {
        staleListeners.delete(listener)
    }
}

let checkingEvent = false
export async function checkIfEventChanged(): Promise<void> {
    if (staleEvent || checkingEvent) {
        return
    }
    checkingEvent = true
    try {
        const response = await fetch('/event.json', { cache: 'no-store' })
        if (!response.ok) {
            return
        }
        const info = (await response.json()) as Partial<EventInfo>
        if (typeof info.eventId === 'string' && /^[a-z0-9]+$/.test(info.eventId) && info.eventId !== EVENT_ID) {
            staleEvent = true
            console.warn(`rxdb: Event changed from ${EVENT_ID} to ${info.eventId}; stopping replication.`)
            void replications?.slots.cancel()
            void replications?.participants.cancel()
            void replications?.changes.cancel()
            for (const listener of staleListeners) {
                listener()
            }
        }
    } catch {
        // Offline or server restarting; try again later.
    } finally {
        checkingEvent = false
    }
}

for (const rep of replications ? [replications.slots, replications.participants, replications.changes] : []) {
    let wasActive = false
    let errorDuringCycle = false
    rep.error$.subscribe(() => {
        errorDuringCycle = true
        setSyncStatus('offline')
        void checkIfEventChanged()
    })
    rep.received$.subscribe(() => {
        errorDuringCycle = false
        setSyncStatus('synced')
    })
    rep.sent$.subscribe(() => {
        errorDuringCycle = false
        setSyncStatus('synced')
    })
    rep.active$.subscribe((active) => {
        if (active) {
            wasActive = true
            errorDuringCycle = false
        } else if (wasActive && !errorDuringCycle) {
            setSyncStatus('synced')
        }
    })
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('focus', () => { void checkIfEventChanged() })
    window.addEventListener('offline', () => { setSyncStatus('offline') })
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void checkIfEventChanged()
        }
    })
    setInterval(() => { void checkIfEventChanged() }, 15000)
}


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