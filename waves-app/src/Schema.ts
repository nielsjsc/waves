import {
    toTypedRxJsonSchema,
    type ExtractDocumentTypeFromTypedRxJsonSchema,
    type RxCollection,
    type RxJsonSchema
} from 'rxdb';

export const slotSchemaLiteral = {
    // UPDATE IN SERVER.TS TO MATCH!!
    title: 'slot schema',
    description: 'a slot is a possible start time on a course',
    version: 1,
    primaryKey: 'id',
    type: 'object',
    required: ['id', 'time', 'course', 'participants', 'isUsable'],
    properties: {
        id: { type: 'string', maxLength: 64},
        time: { type: 'string' },
        course: { type: 'string' },
        participants: { type: 'array', ref: 'participants', items: { type: 'string' } },
        isUsable: { type: 'boolean'}
    },
} as const;
const slotSchemaTyped = toTypedRxJsonSchema(slotSchemaLiteral);
export type SlotDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof slotSchemaTyped>;
export const slotSchema:RxJsonSchema<SlotDocType> = slotSchemaLiteral

export type SlotCollectionMethods = {
    dropAllDocs: (this:SlotCollection) => void
}

export const participantSchemaLiteral = {
    // UPDATE IN SERVER.TS TO MATCH!!
    title: 'participant schema',
    version: 1,
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
        startChanged: {type: 'boolean'}
    }
} as const;
const participantSchemaTyped = toTypedRxJsonSchema(participantSchemaLiteral);
export type ParticipantDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof participantSchemaTyped>;
export const participantSchema:RxJsonSchema<ParticipantDocType> = participantSchemaLiteral

export type ParticipantCollectionMethods = {
    dropAllDocs: (this:ParticipantCollection) => void
}

export const changesSchemaLiteral = {
    // UPDATE IN SERVER.TS TO MATCH!!
    title: 'changes schema',
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
} as const;
const changesSchemaTyped = toTypedRxJsonSchema(changesSchemaLiteral);
export type ChangesDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof changesSchemaTyped>;
export const changesSchema:RxJsonSchema<ChangesDocType> = changesSchemaLiteral;

export type ChangesCollectionMethods = {
    dropAllDocs: (this:ChangesCollection) => void
}



export type SlotCollection = RxCollection<SlotDocType,{},SlotCollectionMethods>
export type ParticipantCollection = RxCollection<ParticipantDocType,{},ParticipantCollectionMethods>
export type ChangesCollection = RxCollection<ChangesDocType,{},ChangesCollectionMethods>

export type WavesDbCollections = {
    slots: SlotCollection
    participants: ParticipantCollection
    changes: ChangesCollection
}