
import type { ParticipantDocType, SlotDocType } from "@/Schema";
import type { PopulatedEntry } from "./PopulatedEntry";

import type { ParticipantState } from "@/api/participants";



export function populateEntryForParticipantId(id:string, allParticipants:ParticipantDocType[], allSlots:SlotDocType[]):PopulatedEntry|undefined {
    const p = allParticipants.find(x=> x.id === id);
    if (p === undefined) {
        return undefined
    }
    const s = allSlots.find(x => x.participants.some(y => y === id))
    if (s === undefined) {
        return undefined
    }

    return({
        slotId: s.id,
        participant: {
            id: p.id,
            name: p.name,
            state: p.state as ParticipantState,
            club: p.club ?? '',
            epunch: p.epunch ?? '',
            isRental: p.isRental,
            isNonCompete: p.isNonCompete,
            groupSize: p.groupSize
        },
        time: s.time,
        course: s.course
    })
}