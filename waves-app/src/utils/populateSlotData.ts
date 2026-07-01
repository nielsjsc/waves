import type { ParticipantDocType, SlotDocType } from "@/Schema";
import type { Participant } from "@/api/participants";
import {type Slot as SlotType} from '@/api/slots'

export function populateSlotData(slots:SlotDocType[], participants:ParticipantDocType[]):SlotType[] {
    let res:SlotType[] = []
    slots.forEach(s => {
        if (s.participants === undefined) {
            res.push({
                id: s.id,
                time: s.time,
                course: s.course,
                participants: [] as Participant[],
                isUsable: s.isUsable
            })
        } else {
            let filledParticipants:Participant[] = []
            s.participants.forEach(pid => {
                const p:Participant|undefined = participants.find((x) => x.id === pid) as Participant
                if (p) {
                    filledParticipants.push(p)
                }
            })
            res.push({
                id: s.id,
                time: s.time,
                course: s.course,
                participants: filledParticipants,
                isUsable: s.isUsable
            })
        }
    });
    return res
}