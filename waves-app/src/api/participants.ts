import type { ParticipantDocType } from '@/Schema'
import type { WithVirtualProps } from '@tanstack/react-db'
import type { RxDocument } from 'rxdb'
import * as v from 'valibot'

export const Participant = v.object({
    id:v.string(),
    name:v.string(),
    club:v.optional(v.string(), 'None'),
    // epunch:v.optional(v.string()),
    state:v.picklist(["waiting", "present", "validated", "noShow", "notAttending", "needsAssignment", "started"]),
    
})
export type Participant = v.InferOutput<typeof Participant>

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
        state: doc.state as ParticipantState,
        club: doc.club ?? 'None',
    }
}

export function fromParticipantRecord(item:WithVirtualProps<ParticipantDocType>):Participant {
    return {
        id: item.id,
        name: item.name,
        state: item.state as ParticipantState,
        club: item.club ?? 'None',
    }
}