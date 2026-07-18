import { slotsTanCollection, participantsTanCollection, changesTanCollection } from "@/database";
import type { SlotDocType } from "@/Schema";
import { eq, inArray, queryOnce } from "@tanstack/react-db";

//// Helpers ////

async function getSlotForParticipantId(participantId:string):Promise<SlotDocType|undefined> {
    const slots = await queryOnce((q) =>
        q
        .from({slot: slotsTanCollection})
        .where(({slot}) => inArray(participantId, slot.participants))
    )
    if (slots.length === 0 || slots[0] === undefined) {
        alert("No Slot for Participant")
        return undefined
    }
    if (slots.length > 1) {
        alert("Multiple Slots for Participant")
        return undefined
    }
    return slots[0]
}

function isRealStartTime(slot:SlotDocType):boolean {
    return !slot.time.startsWith("_")
}

async function removeFromCurrentSlot(participantId:string): Promise<SlotDocType|undefined> {
    const oldSlot = await getSlotForParticipantId(participantId)
    if (oldSlot === undefined) {
        alert("Didn't find old Slot")
        console.log("Didn't find old slot")
        return undefined
    }
    const remainingOldSlotParticipants = oldSlot.participants.filter(x => x !== participantId)
    const t2 = slotsTanCollection.update(oldSlot.id, (s) => {s.participants = remainingOldSlotParticipants})
    await t2.isPersisted.promise
    return slotsTanCollection.get(oldSlot.id)
}

async function addToSlot(participantId:string, slotId:string) {
    const newSlot = slotsTanCollection.get(slotId)
    if (newSlot === undefined) {
        alert("slot not found")
        console.log("slot not found")
        return
    }
    const updatedSlotParticipants = newSlot.participants.concat(participantId)
    const t1 = slotsTanCollection.update(newSlot.id, (s) => {s.participants = updatedSlotParticipants})
    await t1.isPersisted.promise
    return slotsTanCollection.get(newSlot.id)
}

async function addToMagicSlot(participantId:string, slotName:"_needsAssignment"|"_notAttending", course:string) {
    const magicSlot = await queryOnce((q) =>
        q
        .from({slot: slotsTanCollection})
        .where(({slot}) => eq(slot.course, course))
        .where(({slot}) => eq(slot.time, slotName))
        .findOne()
    )
    if (magicSlot === undefined) {
        alert("Didn't find magic slot for course")
        console.log("Didn't find magic slot for course")
        return
    }
    await addToSlot(participantId, magicSlot.id)
    return slotsTanCollection.get(magicSlot.id)
}

//// Set Participant State ////

export async function setStateWaiting(participantId:string) {
    // must have a valid start time
    // (any?) -> Waiting

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    const slot = await getSlotForParticipantId(participantId)
    if (slot === undefined) {return;}
    if (!isRealStartTime(slot)) {return;}
    
    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.state = "waiting"
        p.prevState = oldParticipant.state
    })
    await t1.isPersisted.promise
}

export async function setStatePresent(participantId:string) {
    // must have a valid start time
    // (any?) -> Present

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}
     
    const slot = await getSlotForParticipantId(participantId)
    if (slot === undefined) {return;}
    if (!isRealStartTime(slot)) {return;}

    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.state = "present"
        p.prevState = oldParticipant.state
    })
    await t1.isPersisted.promise
}

export async function setStateValidated(participantId:string) {
    // must have a valid start time
    // (any?) -> Validated

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}
     
    const slot = await getSlotForParticipantId(participantId)
    if (slot === undefined) {return;}
    if (!isRealStartTime(slot)) {return;}

    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.state = "validated"
        p.prevState = oldParticipant.state
    })
    await t1.isPersisted.promise
}

export async function setStateNoShow(participantId:string) {
    // must have a valid start time
    // (any?) -> NoShow

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    const slot = await getSlotForParticipantId(participantId)
    if (slot === undefined) {return;}
    if (!isRealStartTime(slot)) {return;}

    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.state = "noShow"
        p.prevState = oldParticipant.state
    })
    await t1.isPersisted.promise

    // Record the change for stats
    const t2 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'noShow',
        old: oldParticipant.state, //TODO CHECK THAT THIS WORKS, IT MIGHT LIVE UPDATE!
        new: 'noShow',
        needsProcessing: false,
        isProcessed: false
    }]);
    await t2.isPersisted.promise
}

export async function setStateNotAttending(participantId:string) {
    // may or may not have a start time
    // (any?) -> NotAttending
    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    // Remove from current Slot
    const oldSlot = await removeFromCurrentSlot(participantId)
    if (oldSlot === undefined) {
        throw("Old slot not found. Something wrong")
    }
    
    // Add to NotAttending Slot
    const newSlot = await addToMagicSlot(participantId, "_notAttending", oldSlot.course)
    if (newSlot === undefined) {
        throw("New Slot not found. Something wrong")
    }

    // Update Participant State
    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.state = "notAttending"
        p.prevState = oldParticipant.state 
        p.startChanged=true
    })
    await t1.isPersisted.promise
    
    // Record the change for stats
    const t4 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'notAttending',
        old: oldParticipant.state,
        new: 'notAttending',
        needsProcessing: false,
        isProcessed: false
    }]);
    await t4.isPersisted.promise
}

export async function setStateNeedsAssignment(participantId:string) {
    // may or may not have a start time
    // (any?) -> NeedsAssignment

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    // Move from current slot
    const oldSlot = await removeFromCurrentSlot(participantId)
    if (oldSlot === undefined) {
        throw("Old slot not found. Something wrong")
    }

    // Update Participant State
    if (isRealStartTime(oldSlot) && !oldParticipant.startChanged) {
        const t1 = participantsTanCollection.update(participantId, (p) => {
            p.state = "needsAssignment"
            p.prevState = oldParticipant.state
            p.startChanged = true
            p.originalStartTime = oldSlot.time
        })
        await t1.isPersisted.promise
    } else {
        const t1 = participantsTanCollection.update(participantId, (p) => {
            p.state = "needsAssignment"
            p.prevState = oldParticipant.state
        })
        await t1.isPersisted.promise
    }

    // Move to NeedsAssignment slot
    await addToMagicSlot(participantId, "_needsAssignment", oldSlot.course)

    // record change
    const t4 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'needsAssignment',
        old: oldParticipant.state,
        new: 'needsAssignment',
        needsProcessing: false,
        isProcessed: false
    }]);
    await t4.isPersisted.promise

}

//// Update Participant Properties ////

export async function setNewEpunch(participantId:string, newEpunch:string, newEpunchIsRental:boolean) {

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    const t1 = participantsTanCollection.update(participantId, (p) => {p.epunch = newEpunch, p.isRental = newEpunchIsRental});
    await t1.isPersisted.promise

        // Record the change for stats
    const t4 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'epunch',
        old: oldParticipant?.epunch ?? '',
        new: `${newEpunch}, Rental:${newEpunchIsRental}`,
        needsProcessing: true,
        isProcessed: false
    }]);
    await t4.isPersisted.promise

}

export async function setNewStartTime(participantId:string, oldSlotId:string, newSlotId:string) {

    if (participantId === '' || oldSlotId === '' || newSlotId === '' || 
        participantId === undefined || oldSlotId === undefined || newSlotId === undefined) {
        console.log("Missing some information, no action taken")
        return
    }

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    // Remove from current Slot
    const oldSlot = slotsTanCollection.get(oldSlotId)
    if (oldSlot === undefined) {
        alert("Didn't find old Slot")
        console.log("Didn't find old slot")
        return
    }
    const remainingOldSlotParticipants = oldSlot.participants.filter(x => x !== participantId)
    const t1 = slotsTanCollection.update(oldSlotId, (s) => {s.participants = remainingOldSlotParticipants})
    await t1.isPersisted.promise

    // Add to new Slot
    const newSlot = slotsTanCollection.get(newSlotId)
    if (newSlot === undefined) {
        alert("Didn't find new Slot")
        console.log("Didn't find new slot")
        return
    }
    const updatedNewSlotParticipants = newSlot.participants.concat(participantId)
    const t2 = slotsTanCollection.update(newSlotId, (s) => {s.participants = updatedNewSlotParticipants})
    await t2.isPersisted.promise

    // Reset the state to waiting
    await setStateWaiting(participantId)

    // set the "start changed" flag if not already set
    if (!oldParticipant.startChanged) {
        console.log("setting start Changed to true")
        const t3 = participantsTanCollection.update(participantId, (p) => {
            p.startChanged = true,
            p.originalStartTime = oldSlot.time
        })
        await t3.isPersisted.promise
    }

    // Record the change for stats
    const t4 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'newTime',
        old: oldSlot?.time ?? '',
        new: newSlot?.time ?? '',
        needsProcessing: false,
        isProcessed: false
    }]);
    await t4.isPersisted.promise
}

export async function setNonCompetitive(participantId:string) {
    const t1 = participantsTanCollection.update(participantId, (p) => {p.isNonCompete = true});
    await t1.isPersisted.promise
    
    // Record the change for Epunch
    const t2 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'competitiveStatus',
        old: 'competitive',
        new: 'non-competitive',
        needsProcessing: true,
        isProcessed: false
    }]);
    await t2.isPersisted.promise
}

export async function setCompetitive(participantId:string) {
    const t1 = participantsTanCollection.update(participantId, (p) => {p.isNonCompete = false})
    await t1.isPersisted.promise
    
    // Record the change for Epunch
    const t2 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: Date.now(),
        changeType: 'competitiveStatus',
        old: 'non-competitive',
        new: 'competitive',
        needsProcessing: true,
        isProcessed: false
    }]);
    await t2.isPersisted.promise
}