import type { Participant } from "@/api/participants";
import { type Slot  as SlotType } from "@/api/slots";

export type Entry = {
    participant: Participant
    time: string
    course: string
}

export function pivotSlotsToEntries(slots:SlotType[]):Entry[] {
    let res:Entry[] = []
    slots.forEach(s => {
        s.participants.forEach(p => {
            res.push({
                participant: p,
                time: s.time,
                course: s.course,
            })
        })
    })
    return(res)
}