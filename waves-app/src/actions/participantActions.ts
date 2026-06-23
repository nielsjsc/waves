import { changesTanCollection, participantsTanCollection } from "@/database";
import { slotsTanCollection } from "@/database";
import { eq, queryOnce } from "@tanstack/react-db";

// TODO: EACH OF THESE NEEDS TO BE A SET OF TRANSACTIONS that wait for isPersisted

export function setStatePresent(participantId:string) {
    // make sure they're coming from waiting state or have a valid start time?
    participantsTanCollection.update(participantId, (p) => {p.state = "present"})
}

export function setStateWaiting(participantId:string) {
    // make sure they have a valid start time
    participantsTanCollection.update(participantId, (p) => {p.state = "waiting"})
}

export async function setStateNotAttending(participantId:string, slotId:string, course:string) {
    // Update Participant State
    participantsTanCollection.update(participantId, (p) => {p.state = "notAttending"})

    // Remove from current Slot
    const oldSlot = slotsTanCollection.get(slotId)
    if (oldSlot !== undefined) {
        const updatedParticipants = oldSlot.participants.filter(x => x !== participantId)
        slotsTanCollection.update(slotId, (s) => {s.participants = updatedParticipants})
    }
    
    // Add to NotAttending Slot
    const notAttendingSlot = await queryOnce((q) =>
        q
        .from({slot: slotsTanCollection})
        .where(({slot}) => eq(slot.course, course))
        .where(({slot}) => eq(slot.time, "_notAttending"))
        .findOne()
    )
    if (notAttendingSlot !== undefined) {
        slotsTanCollection.update(notAttendingSlot.id, (s) => {s.participants = s.participants.concat(participantId)})
    }
    
    // Record the change for stats
    changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'notAttending',
        old: '',
        new: 'notAttending',
        needsProcessing: false,
        isProcessed: false
    }]);
}

export function setNonCompetitive(participantId:string) {
    // Make the change
    participantsTanCollection.update(participantId, (p) => {p.isNonCompete = true});
    
    // Record the change for Epunch
    changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'competitiveStatus',
        old: 'competitive',
        new: 'non-competitive',
        needsProcessing: true,
        isProcessed: false
    }]);
}

export function setCompetitive(participantId:string) {
    participantsTanCollection.update(participantId, (p) => {p.isNonCompete = false})
    
    // Record the change for Epunch
    changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'competitiveStatus',
        old: 'non-competitive',
        new: 'competitive',
        needsProcessing: true,
        isProcessed: false
    }]);
}