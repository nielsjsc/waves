
import type { PopulatedEntry } from "./PopulatedEntry";

import type { ParticipantState } from "@/api/participants";
import type { ChangesDocType, ParticipantDocType, SlotDocType } from "@/Schema";

export type AllData = {
    participants: ParticipantDocType[]
    slots: SlotDocType[]
    changes: ChangesDocType[]
}

export function hydrateParticipant(participantId:string, DATA:AllData):PopulatedEntry|undefined {
    
    if (participantId === '') {
        return undefined
    }

    const p = DATA.participants.find(x => x.id === participantId)

    if (p === undefined) {
        return undefined
    }

    const slotDocs = DATA.slots.filter(x => x.participants.includes(participantId))

    if (slotDocs.length === 0) {
        // this happens temporarily while the live data catches up as slot changes are made where we remove then add??
        console.log("BAD! Participant is not in any slot!")
        return undefined
    } else if (slotDocs.length > 1) {
        console.log("BAD! Participant exists in multiple slots!")
        return undefined
    }

    const s = slotDocs[0]!

    return({
        slotId: s.id,
        time: s.time,
        course: s.course,
        slotParticipantIds: s.participants,
        participant: {
            id: p.id,
            name: p.name,
            state: p.state as ParticipantState,
            prevState: p.prevState as ParticipantState | undefined,
            club: p.club ?? '',
            epunch: p.epunch ?? '',
            isRental: p.isRental,
            isNonCompete: p.isNonCompete,
            groupSize: p.groupSize,
            originalStartTime: p.originalStartTime ?? '',
            startChanged: p.startChanged ?? false,
            needsWaiver: Boolean(p.needsWaiver),
            needsPayment: Boolean(p.needsPayment),
            isSecondCourse: Boolean(p.isSecondCourse),
            hasRentedCompass: Boolean(p.hasRentedCompass),
            compassId: p.compassId ?? '',
        }
    })
}