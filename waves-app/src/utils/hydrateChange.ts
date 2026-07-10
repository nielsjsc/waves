
import type { ChangesDocType, ParticipantDocType, SlotDocType } from "@/Schema";
import type { PopulatedChange } from "./PopulatedChange";

export type AllData = {
    participants: ParticipantDocType[]
    slots: SlotDocType[]
    changes: ChangesDocType[]
}

export function hydrateChange(changeId:string, DATA:AllData):PopulatedChange|undefined {
    
    if (changeId === '') {
        return undefined
    }

    const c = DATA.changes.find(x => x.id === changeId)

    if (c === undefined) {
        return undefined
    }

    const participants = DATA.participants.filter(x => x.id === c.participantId)

    if (participants.length === 0) {
        console.log("No Participant with this Id from change object??")
        return undefined
    } else if (participants.length > 1) {
        console.log("Multiple participants with this Id from change object??")
        return undefined
    }

    const p = participants[0]!

    return({
        id: c.id,
        participant: {
            id: p.id,
            name: p.name,
            state: p.state,
            club: p.club ?? '',
            epunch: p.epunch ?? '',
            isRental: p.isRental,
            isNonCompete: p.isNonCompete,
            groupSize: p.groupSize,
            originalStartTime: p.originalStartTime ?? '',
            startChanged: p.startChanged ?? false
        },
        changedAt: new Date(c.changedAt),
        changeType: c.changeType,
        old: c.old,
        new: c.new,
        needsProcessing: c.needsProcessing,
        isProcessed: c.isProcessed
    })
}