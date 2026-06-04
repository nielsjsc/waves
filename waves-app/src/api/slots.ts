import * as v from 'valibot'
import { fromParticipantRecord, Participant } from '@/api/participants'

import { participantsCollection, slotsCollection } from '@/database'

const Slot = v.object({
    time: v.string(),
    course: v.string(),
    participants: v.array(Participant),
    isUsable: v.optional(v.boolean(),true)
})
export type Slot = v.InferOutput<typeof Slot>

const Slots = v.array(Slot)

export async function getSlots3() {
    let results:Slot[] = []
    for (const doc of slotsCollection.values()) {
        if (doc.participants === undefined) {
            doc.participants = []
        }
        results.push({
            time: doc.time,
            course: doc.course,
            participants: doc.participants.map((pid) => {
                return fromParticipantRecord(participantsCollection.get(pid)!)}),
            isUsable: true
        })
    }
    return v.parse(Slots, results)
}
