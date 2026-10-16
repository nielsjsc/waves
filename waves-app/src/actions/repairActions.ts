import { changesTanCollection, participantsTanCollection, slotsTanCollection } from "@/database"
import type { SlotDocType } from "@/Schema"

// Repairs for participants whose records break the "exactly one slot" rule.
// These are deliberately separate from participantActions.ts: they work from
// the slot documents the caller already has instead of searching for them.

async function logRepair(participantId: string, description: string) {
    const tx = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'repair',
        old: '',
        new: description,
        needsProcessing: false,
        isProcessed: false
    }])
    await tx.isPersisted.promise
}

// Make the participant's state agree with the slot they ended up in.
async function alignStateWithSlot(participantId: string, slot: SlotDocType) {
    const participant = participantsTanCollection.get(participantId)
    if (participant === undefined) {return}

    let wanted: 'needsAssignment' | 'notAttending' | 'waiting' | undefined
    if (slot.time === '_needsAssignment') {
        wanted = participant.state === 'needsAssignment' ? undefined : 'needsAssignment'
    } else if (slot.time === '_notAttending') {
        wanted = participant.state === 'notAttending' ? undefined : 'notAttending'
    } else if (participant.state === 'needsAssignment' || participant.state === 'notAttending') {
        wanted = 'waiting'
    }
    if (wanted === undefined) {return}

    const target = wanted
    const tx = participantsTanCollection.update(participantId, (p) => {
        p.prevState = p.state
        p.state = target
    })
    await tx.isPersisted.promise
}

// For a participant listed in several slots: keep them in one, remove them from the rest.
export async function keepOnlyInSlot(participantId: string, keepSlot: SlotDocType, allSlots: SlotDocType[]) {
    for (const slot of allSlots) {
        if (slot.id === keepSlot.id || !slot.participants.includes(participantId)) {continue}
        const remaining = slot.participants.filter((id) => id !== participantId)
        const tx = slotsTanCollection.update(slot.id, (s) => {s.participants = remaining})
        await tx.isPersisted.promise
    }
    await alignStateWithSlot(participantId, keepSlot)
    await logRepair(participantId, `kept only in ${keepSlot.course} ${keepSlot.time}`)
}

// For a participant listed in no slot: park them in a course's "needs a new time" queue.
export async function putInNeedsAssignment(participantId: string, magicSlot: SlotDocType) {
    const updated = magicSlot.participants.concat(participantId)
    const tx = slotsTanCollection.update(magicSlot.id, (s) => {s.participants = updated})
    await tx.isPersisted.promise
    await alignStateWithSlot(participantId, magicSlot)
    await logRepair(participantId, `placed in the ${magicSlot.course} needs-new-time queue`)
}
