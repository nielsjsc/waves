import type { ParticipantDocType } from '@/Schema'
import type { WithVirtualProps } from '@tanstack/react-db'
import type { RxDocument } from 'rxdb'
import * as v from 'valibot'

export const Participant = v.object({
    id:v.string(),
    name:v.string(),
    state:v.picklist(["waiting", "present", "validated", "noShow", "notAttending", "needsAssignment", "started"]),
    club:v.optional(v.string(), 'None'),
    epunch:v.optional(v.string(), ''),
    isRental:v.boolean(),
    isNonCompete:v.boolean(),
    groupSize:v.number(),
    originalStartTime:v.string(),
    startChanged:v.boolean()
})
export type Participant = v.InferOutput<typeof Participant>

// Update participant State Styles if adding states here!
export type ParticipantState = 
    | "waiting"
    | "present"
    | "validated"
    | "noShow"
    | "notAttending"
    | "needsAssignment"
    | "started"

export function fromParticipantDoc(doc:RxDocument<ParticipantDocType>):Participant {
    return {
        id: doc.id,
        name: doc.name,
        club: doc.club ?? 'None',
        epunch: doc.epunch ?? '',
        isRental: doc.isRental,
        isNonCompete: doc.isNonCompete,
        state: doc.state as ParticipantState,
        groupSize: doc.groupSize,
        originalStartTime: doc.originalStartTime ?? '',
        startChanged: doc.startChanged ?? false
    }
}

export function fromParticipantRecord(item:WithVirtualProps<ParticipantDocType>):Participant {
    return {
        id: item.id,
        name: item.name,
        club: item.club ?? 'None',
        epunch: item.epunch ?? '',
        isRental: item.isRental,
        isNonCompete: item.isNonCompete,
        state: item.state as ParticipantState,
        groupSize: item.groupSize,
        originalStartTime: item.originalStartTime ?? '',
        startChanged: item.startChanged ?? false
        
    }
}