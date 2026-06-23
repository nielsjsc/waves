import { type Slot  as SlotType } from "@/api/slots";
import type { PopulatedEntry } from "./PopulatedEntry";

export function pivotSlotsToEntries(slots:SlotType[]):PopulatedEntry[] {
    let res:PopulatedEntry[] = []
    slots.forEach(s => {
        s.participants.forEach(p => {
            res.push({
                slotId: s.id,
                participant: p,
                time: s.time,
                course: s.course,
            })
        })
    })
    return(res)
}