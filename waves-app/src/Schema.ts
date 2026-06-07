import {
    toTypedRxJsonSchema,
    type ExtractDocumentTypeFromTypedRxJsonSchema,
    type RxCollection,
    type RxJsonSchema
} from 'rxdb';

export const slotSchemaLiteral = {
    title: 'slot schema',
    description: 'a slot is a possible start time on a course',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    required: ['id', 'time', 'course'],
    properties: {
        id: { type: 'string', maxLength: 64},
        time: { type: 'string' },
        course: { type: 'string' },
        // participant_ids: { type: 'array', items: { type: 'string' } }
        participants: { type: 'array', ref: 'participants', items: { type: 'string' } }
    },
    // indexes: ['participant_ids']
} as const;
const slotSchemaTyped = toTypedRxJsonSchema(slotSchemaLiteral);
export type SlotDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof slotSchemaTyped>;
export const slotSchema:RxJsonSchema<SlotDocType> = slotSchemaLiteral

export type ParticipantCollectionMethods = {
    dropAllDocs: (this:ParticipantCollection) => void
}


export const participantSchemaLiteral = {
    title: 'participant schema',
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
} as const;
const participantSchemaTyped = toTypedRxJsonSchema(participantSchemaLiteral);
export type ParticipantDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof participantSchemaTyped>;
export const participantSchema:RxJsonSchema<ParticipantDocType> = participantSchemaLiteral

export type SlotCollectionMethods = {
    dropAllDocs: (this:SlotCollection) => void
}


export type SlotCollection = RxCollection<SlotDocType,{},SlotCollectionMethods>
export type ParticipantCollection = RxCollection<ParticipantDocType,{},ParticipantCollectionMethods>

export type WavesDbCollections = {
    slots: SlotCollection
    participants: ParticipantCollection
}