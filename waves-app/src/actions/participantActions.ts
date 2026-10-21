import { slotsTanCollection, participantsTanCollection, changesTanCollection } from "@/database";
import type { SlotDocType } from "@/Schema";
import { eq, inArray, queryOnce } from "@tanstack/react-db";

//// Helpers ////

let lastChangeTimestamp = 0
function nextChangeTimestamp(): number {
    const now = Date.now()
    lastChangeTimestamp = now > lastChangeTimestamp ? now : lastChangeTimestamp + 1
    return lastChangeTimestamp
}

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

export async function setStateWrongEpunch(participantId:string) {
    // must have a valid start time; keeps the participant in their current slot
    // (any?) -> WrongEpunch

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    const slot = await getSlotForParticipantId(participantId)
    if (slot === undefined) {return;}
    if (!isRealStartTime(slot)) {return;}

    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.state = "wrongEpunch"
        p.prevState = oldParticipant.state
    })
    await t1.isPersisted.promise

    const t2 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: nextChangeTimestamp(),
        changeType: 'wrongEpunch',
        old: oldParticipant.state,
        new: 'wrongEpunch',
        needsProcessing: false,
        isProcessed: false
    }]);
    await t2.isPersisted.promise
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
        changedAt: nextChangeTimestamp(),
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
    const preserveOriginalTime = isRealStartTime(oldSlot) && !oldParticipant.startChanged
    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.state = "notAttending"
        p.prevState = oldParticipant.state
        p.startChanged = true
        if (preserveOriginalTime) {
            p.originalStartTime = oldSlot.time
        }
    })
    await t1.isPersisted.promise
    
    // Record the change for stats
    const t4 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: nextChangeTimestamp(),
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
        changedAt: nextChangeTimestamp(),
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

    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.epunch = newEpunch
        p.isRental = newEpunchIsRental
        if (oldParticipant.state === "wrongEpunch") {
            p.prevState = oldParticipant.state
            p.state = "validated"
        }
    });
    await t1.isPersisted.promise

        // Record the change for stats
    const t4 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: nextChangeTimestamp(),
        changeType: 'epunch',
        // Same "<epunch>, Rental:<true|false>" format as `new`, so "Restore original" can bring back the rental flag too
        old: `${oldParticipant.epunch ?? ''}, Rental:${oldParticipant.isRental}`,
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
    if (oldSlotId === newSlotId) {
        // already in this slot, nothing to move
        return
    }

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    // Look up BOTH slots before changing anything. If the new slot turned out to be
    // missing after we had already removed the participant from the old one, they
    // would be left in no slot at all.
    const oldSlot = slotsTanCollection.get(oldSlotId)
    if (oldSlot === undefined) {
        alert("Didn't find old Slot")
        console.log("Didn't find old slot")
        return
    }
    const newSlot = slotsTanCollection.get(newSlotId)
    if (newSlot === undefined) {
        alert("Didn't find new Slot")
        console.log("Didn't find new slot")
        return
    }
    if (!oldSlot.participants.includes(participantId)) {
        // Stale information (for example another device moved them first): do nothing rather than
        // risk listing them in two slots.
        alert("That participant is no longer in the slot they were being moved from. Please check their record and try again.")
        console.log("Participant not in the old slot, no action taken")
        return
    }

    // Remove from current Slot
    const remainingOldSlotParticipants = oldSlot.participants.filter(x => x !== participantId)
    const t1 = slotsTanCollection.update(oldSlotId, (s) => {s.participants = remainingOldSlotParticipants})
    await t1.isPersisted.promise

    // Add to new Slot
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

    // Record the change for stats. A move to another course is logged as "<course> <time>"
    // on both sides so "Restore original" can find the starting course.
    const courseChanged = oldSlot.course !== newSlot.course
    const t4 = changesTanCollection.insert([{
        id: crypto.randomUUID(),
        participantId: participantId,
        changedAt: nextChangeTimestamp(),
        changeType: courseChanged ? 'newCourse' : 'newTime',
        old: courseChanged ? `${oldSlot.course} ${oldSlot.time}` : oldSlot.time,
        new: courseChanged ? `${newSlot.course} ${newSlot.time}` : newSlot.time,
        needsProcessing: courseChanged,
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
        changedAt: nextChangeTimestamp(),
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
        changedAt: nextChangeTimestamp(),
        changeType: 'competitiveStatus',
        old: 'non-competitive',
        new: 'competitive',
        needsProcessing: true,
        isProcessed: false
    }]);
    await t2.isPersisted.promise
}