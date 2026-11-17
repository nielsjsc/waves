import { EVENT_ID, slotsTanCollection, participantsTanCollection, changesTanCollection } from "@/database";
import type { SlotDocType } from "@/Schema";
import { slotIdFor } from "@/dataImport";
import { randomUUID } from "@/utils/cryptoHelpers";
import { normalizeCustomStartTime } from "@/utils/slotLabels";
import { hasNoShow, hasWrongEpunch } from "@/utils/styleHelpers";
import { eq, inArray, queryOnce } from "@tanstack/react-db";

//// Helpers ////

let lastChangeTimestamp = 0
function nextChangeTimestamp(): number {
    const now = Date.now()
    lastChangeTimestamp = now > lastChangeTimestamp ? now : lastChangeTimestamp + 1
    return lastChangeTimestamp
}

async function clearSupersededStateChanges(participantId: string, typesToClear: string[]) {
    const existing = await queryOnce((q) =>
        q
            .from({ c: changesTanCollection })
            .where(({ c }) => eq(c.participantId, participantId))
    )
    const ids = existing.filter((c) => typesToClear.includes(c.changeType)).map((c) => c.id)
    for (const id of ids) {
        const tx = changesTanCollection.delete(id)
        await tx.isPersisted.promise
    }
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
    await clearSupersededStateChanges(participantId, ['noShow', 'wrongEpunch'])
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
    await clearSupersededStateChanges(participantId, ['noShow', 'wrongEpunch'])
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
    await clearSupersededStateChanges(participantId, ['noShow', 'wrongEpunch'])
}

export async function setStateWrongEpunch(participantId:string) {
    // must have a valid start time; keeps the participant in their current slot
    // A participant can be in BOTH wrongEpunch and noShow simultaneously.

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    const slot = await getSlotForParticipantId(participantId)
    if (slot === undefined) {return;}
    if (!isRealStartTime(slot)) {return;}

    const preserveNoShow = hasNoShow(oldParticipant)
    await clearSupersededStateChanges(participantId, preserveNoShow ? ['wrongEpunch'] : ['noShow', 'wrongEpunch'])

    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.state = "wrongEpunch"
        p.prevState = preserveNoShow ? "noShow" : oldParticipant.state
    })
    await t1.isPersisted.promise

    const t2 = changesTanCollection.insert([{
        id: randomUUID(),
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
    // A participant can be in BOTH noShow and wrongEpunch simultaneously.

    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {return;}

    const slot = await getSlotForParticipantId(participantId)
    if (slot === undefined) {return;}
    if (!isRealStartTime(slot)) {return;}

    const preserveWrongEpunch = hasWrongEpunch(oldParticipant)
    await clearSupersededStateChanges(participantId, preserveWrongEpunch ? ['noShow'] : ['noShow', 'wrongEpunch'])

    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.state = "noShow"
        p.prevState = preserveWrongEpunch ? "wrongEpunch" : oldParticipant.state
    })
    await t1.isPersisted.promise

    // Record the change for stats
    const t2 = changesTanCollection.insert([{
        id: randomUUID(),
        participantId: participantId,
        changedAt: nextChangeTimestamp(),
        changeType: 'noShow',
        old: oldParticipant.state,
        new: 'noShow',
        needsProcessing: false,
        isProcessed: false
    }]);
    await t2.isPersisted.promise
}

export async function clearStateWrongEpunch(participantId: string) {
    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) { return }

    if (hasNoShow(oldParticipant)) {
        const t1 = participantsTanCollection.update(participantId, (p) => {
            p.state = "noShow"
            p.prevState = "waiting"
        })
        await t1.isPersisted.promise
        await clearSupersededStateChanges(participantId, ['wrongEpunch'])
        return
    }
    await setStateWaiting(participantId)
}

export async function clearStateNoShow(participantId: string) {
    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) { return }

    if (hasWrongEpunch(oldParticipant)) {
        const t1 = participantsTanCollection.update(participantId, (p) => {
            p.state = "wrongEpunch"
            p.prevState = "waiting"
        })
        await t1.isPersisted.promise
        await clearSupersededStateChanges(participantId, ['noShow'])
        return
    }
    await setStateWaiting(participantId)
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

    await clearSupersededStateChanges(participantId, ['noShow', 'wrongEpunch'])

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
        id: randomUUID(),
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

    await clearSupersededStateChanges(participantId, ['noShow', 'wrongEpunch'])

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
        id: randomUUID(),
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

    const wasWrongEpunch = hasWrongEpunch(oldParticipant)
    const wasAlsoNoShow = hasNoShow(oldParticipant)

    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.epunch = newEpunch
        p.isRental = newEpunchIsRental
        if (wasWrongEpunch) {
            if (wasAlsoNoShow) {
                p.state = "noShow"
                p.prevState = "validated"
            } else {
                p.prevState = oldParticipant.state
                p.state = "validated"
            }
        }
    });
    await t1.isPersisted.promise

    if (wasWrongEpunch) {
        await clearSupersededStateChanges(participantId, ['wrongEpunch'])
    }

    // Record the change for stats
    const t4 = changesTanCollection.insert([{
        id: randomUUID(),
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
        id: randomUUID(),
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
        id: randomUUID(),
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
        id: randomUUID(),
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

export async function setGroupSize(participantId: string, newGroupSize: number): Promise<void> {
    const normalizedSize = Math.max(1, Math.round(newGroupSize || 1))
    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {
        return
    }
    const oldSize = Math.max(1, Math.round(oldParticipant.groupSize || 1))
    if (oldSize === normalizedSize) {
        return
    }

    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.groupSize = normalizedSize
    })
    await t1.isPersisted.promise

    const t2 = changesTanCollection.insert([
        {
            id: randomUUID(),
            participantId,
            changedAt: nextChangeTimestamp(),
            changeType: 'groupSize',
            old: String(oldSize),
            new: String(normalizedSize),
            needsProcessing: false,
            isProcessed: false,
        },
    ])
    await t2.isPersisted.promise
}

export async function setNeedsWaiver(participantId: string, needsWaiver: boolean): Promise<void> {
    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined || Boolean(oldParticipant.needsWaiver) === needsWaiver) {
        return
    }
    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.needsWaiver = needsWaiver
    })
    await t1.isPersisted.promise
}

export async function setNeedsPayment(participantId: string, needsPayment: boolean): Promise<void> {
    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined || Boolean(oldParticipant.needsPayment) === needsPayment) {
        return
    }
    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.needsPayment = needsPayment
    })
    await t1.isPersisted.promise
}

export async function setParticipantEligible(participantId: string): Promise<void> {
    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined) {
        return
    }
    if (!oldParticipant.needsWaiver && !oldParticipant.needsPayment) {
        return
    }
    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.needsWaiver = false
        p.needsPayment = false
    })
    await t1.isPersisted.promise
}

export async function setHasRentedCompass(participantId: string, rented: boolean): Promise<void> {
    const oldParticipant = await participantsTanCollection.get(participantId)
    if (oldParticipant === undefined || Boolean(oldParticipant.hasRentedCompass) === rented) {
        return
    }
    const t1 = participantsTanCollection.update(participantId, (p) => {
        p.hasRentedCompass = rented
    })
    await t1.isPersisted.promise

    const t2 = changesTanCollection.insert([
        {
            id: randomUUID(),
            participantId,
            changedAt: nextChangeTimestamp(),
            changeType: 'compassRental',
            old: rented ? 'none' : 'rented',
            new: rented ? 'rented' : 'returned',
            needsProcessing: false,
            isProcessed: true,
        },
    ])
    await t2.isPersisted.promise
}

export interface NewParticipantInput {
    name: string
    course: string
    club: string
    epunch: string
    isRental: boolean
    isNonCompete: boolean
    groupSize: number
    targetSlotId?: string
    isSecondCourse?: boolean
}

export async function addNewParticipant(input: NewParticipantInput): Promise<string | undefined> {
    const trimmedName = input.name.trim()
    const trimmedCourse = input.course.trim()
    if (trimmedName === '' || trimmedCourse === '') {
        return undefined
    }

    let targetSlot: SlotDocType | undefined
    if (input.targetSlotId !== undefined && input.targetSlotId !== '') {
        targetSlot = slotsTanCollection.get(input.targetSlotId)
    } else {
        targetSlot = await queryOnce((q) =>
            q
                .from({ slot: slotsTanCollection })
                .where(({ slot }) => eq(slot.course, trimmedCourse))
                .where(({ slot }) => eq(slot.time, '_needsAssignment'))
                .findOne()
        )
    }

    if (targetSlot === undefined) {
        console.log('Target slot not found for new participant')
        return undefined
    }

    const participantId = `${EVENT_ID}-added-${randomUUID().slice(0, 8)}`
    const inRealSlot = isRealStartTime(targetSlot)
    const trimmedClub = input.club.trim()
    const trimmedEpunch = input.epunch.trim()

    const t1 = participantsTanCollection.insert([{
        id: participantId,
        name: trimmedName,
        club: trimmedClub === '' ? 'unknown' : trimmedClub,
        epunch: trimmedEpunch,
        isRental: input.isRental,
        isNonCompete: input.isNonCompete,
        groupSize: Math.max(1, input.groupSize || 1),
        state: inRealSlot ? 'waiting' : 'needsAssignment',
        originalStartTime: inRealSlot ? targetSlot.time : '',
        startChanged: false,
        isSecondCourse: Boolean(input.isSecondCourse),
    }])
    await t1.isPersisted.promise

    await addToSlot(participantId, targetSlot.id)

    const t3 = changesTanCollection.insert([{
        id: randomUUID(),
        participantId,
        changedAt: nextChangeTimestamp(),
        changeType: 'addedParticipant',
        old: '',
        new: inRealSlot ? `${targetSlot.course} ${targetSlot.time}` : `${targetSlot.course} (Standby)`,
        needsProcessing: true,
        isProcessed: false,
    }])
    await t3.isPersisted.promise

    return participantId
}

export async function assignStandbyToNoShowSlot(
    standbyParticipantId: string,
    noShowParticipantId: string,
    targetSlotId: string
): Promise<boolean> {
    if (!standbyParticipantId || !noShowParticipantId || !targetSlotId) {
        return false
    }

    const standbyParticipant = participantsTanCollection.get(standbyParticipantId)
    const noShowParticipant = participantsTanCollection.get(noShowParticipantId)
    if (standbyParticipant === undefined || noShowParticipant === undefined) {
        return false
    }

    const standbySlot = await getSlotForParticipantId(standbyParticipantId)
    const targetSlot = slotsTanCollection.get(targetSlotId)
    if (standbySlot === undefined || targetSlot === undefined || !isRealStartTime(targetSlot)) {
        return false
    }

    if (!targetSlot.participants.includes(noShowParticipantId)) {
        return false
    }

    const holdingSlot = await queryOnce((q) =>
        q
            .from({ slot: slotsTanCollection })
            .where(({ slot }) => eq(slot.course, targetSlot.course))
            .where(({ slot }) => eq(slot.time, '_notAttending'))
            .findOne()
    )
    if (holdingSlot === undefined) {
        return false
    }

    // 1. Remove standby runner from standby slot
    if (standbySlot.id !== targetSlot.id) {
        const remainingStandby = standbySlot.participants.filter((id) => id !== standbyParticipantId)
        const txStandbySlot = slotsTanCollection.update(standbySlot.id, (s) => {
            s.participants = remainingStandby
        })
        await txStandbySlot.isPersisted.promise
    }

    // 2. Replace no-show runner in targetSlot with standby runner
    const updatedTargetParticipants = targetSlot.participants
        .filter((id) => id !== noShowParticipantId && id !== standbyParticipantId)
        .concat(standbyParticipantId)
    const txTargetSlot = slotsTanCollection.update(targetSlot.id, (s) => {
        s.participants = updatedTargetParticipants
    })
    await txTargetSlot.isPersisted.promise

    // 3. Place no-show runner in holding slot so they remain in the No-shows list and 1-slot invariant holds
    if (!holdingSlot.participants.includes(noShowParticipantId)) {
        const txHoldingSlot = slotsTanCollection.update(holdingSlot.id, (s) => {
            s.participants = holdingSlot.participants.concat(noShowParticipantId)
        })
        await txHoldingSlot.isPersisted.promise
    }

    // Preserve the no-show runner's originalStartTime and noShow state
    if (!noShowParticipant.startChanged) {
        const txNoShowP = participantsTanCollection.update(noShowParticipantId, (p) => {
            p.startChanged = true
            p.originalStartTime = targetSlot.time
        })
        await txNoShowP.isPersisted.promise
    }

    // 4. Mark the standby runner directly as Present so they go straight to E-punch Check
    const preserveStandbyOrig = isRealStartTime(standbySlot) && !standbyParticipant.startChanged
    const txStandbyP = participantsTanCollection.update(standbyParticipantId, (p) => {
        p.state = 'present'
        p.prevState = standbyParticipant.state
        if (preserveStandbyOrig) {
            p.startChanged = true
            p.originalStartTime = standbySlot.time
        }
    })
    await txStandbyP.isPersisted.promise

    await clearSupersededStateChanges(standbyParticipantId, ['noShow', 'wrongEpunch'])

    // 5. Record the start time change in the Change Log
    const courseChanged = standbySlot.course !== targetSlot.course
    const txChange = changesTanCollection.insert([
        {
            id: randomUUID(),
            participantId: standbyParticipantId,
            changedAt: nextChangeTimestamp(),
            changeType: courseChanged ? 'newCourse' : 'newTime',
            old: courseChanged ? `${standbySlot.course} ${standbySlot.time}` : standbySlot.time,
            new: courseChanged ? `${targetSlot.course} ${targetSlot.time}` : targetSlot.time,
            needsProcessing: courseChanged,
            isProcessed: false,
        },
    ])
    await txChange.isPersisted.promise

    return true
}

export async function undoAssignStandbyToNoShowSlot(
    standbyParticipantId: string,
    noShowParticipantId: string,
    targetSlotId: string
): Promise<void> {
    const targetSlot = slotsTanCollection.get(targetSlotId)
    if (targetSlot === undefined) return

    // Put standby runner back in Standby on their course
    await setStateNeedsAssignment(standbyParticipantId)

    // Move no-show runner from holding slot back into targetSlot, keeping their noShow state
    const noShowCurrentSlot = await getSlotForParticipantId(noShowParticipantId)
    if (noShowCurrentSlot !== undefined && noShowCurrentSlot.id !== targetSlot.id) {
        const txRemove = slotsTanCollection.update(noShowCurrentSlot.id, (s) => {
            s.participants = s.participants.filter((id) => id !== noShowParticipantId)
        })
        await txRemove.isPersisted.promise

        const latestTarget = slotsTanCollection.get(targetSlot.id)
        if (latestTarget !== undefined && !latestTarget.participants.includes(noShowParticipantId)) {
            const txAdd = slotsTanCollection.update(targetSlot.id, (s) => {
                s.participants = latestTarget.participants.concat(noShowParticipantId)
            })
            await txAdd.isPersisted.promise
        }
    }
}

export async function setChangeProcessed(changeId: string, isProcessed: boolean): Promise<void> {
    if (!changeId) return
    const existing = changesTanCollection.get(changeId)
    if (existing === undefined || existing.isProcessed === isProcessed) return
    const tx = changesTanCollection.update(changeId, (c) => {
        c.isProcessed = isProcessed
    })
    await tx.isPersisted.promise
}

export async function setAllChangesProcessed(changeIds: string[], isProcessed: boolean): Promise<void> {
    for (const id of changeIds) {
        const existing = changesTanCollection.get(id)
        if (existing === undefined || existing.isProcessed === isProcessed) continue
        const tx = changesTanCollection.update(id, (c) => {
            c.isProcessed = isProcessed
        })
        await tx.isPersisted.promise
    }
}

export type AddCustomStartTimeResult =
    | { ok: true; time: string; slot: SlotDocType }
    | { ok: false; error: string }

/**
 * Ensures a new start time slot exists across all courses and returns the usable slot for `preferredCourse`.
 */
export async function addCustomStartTime(
    timeInput: string,
    preferredCourse: string
): Promise<AddCustomStartTimeResult> {
    const normalizedTime = normalizeCustomStartTime(timeInput)
    if (normalizedTime === undefined) {
        return { ok: false, error: 'Enter a valid time like 9:38 or 10:15.' }
    }
    if (!preferredCourse) {
        return { ok: false, error: 'Select a course first.' }
    }

    const allSlots = [...slotsTanCollection.values()]
    const existingPreferred = allSlots.find(
        (s) => s.course === preferredCourse && s.time === normalizedTime
    )
    if (existingPreferred !== undefined && existingPreferred.participants.length > 0) {
        return {
            ok: false,
            error: `${normalizedTime} on ${preferredCourse} already has a runner.`,
        }
    }

    const courses = [...new Set([...allSlots.map((s) => s.course), preferredCourse])].sort()
    const toInsert: SlotDocType[] = []
    for (const course of courses) {
        const existing = allSlots.find((s) => s.course === course && s.time === normalizedTime)
        if (existing === undefined) {
            toInsert.push({
                id: slotIdFor(course, normalizedTime),
                course,
                time: normalizedTime,
                participants: [],
                isUsable: true,
            })
        } else if (existing.participants.length === 0 && !existing.isUsable) {
            const txEnable = slotsTanCollection.update(existing.id, (s) => {
                s.isUsable = true
            })
            await txEnable.isPersisted.promise
        }
    }

    if (toInsert.length > 0) {
        const txInsert = slotsTanCollection.insert(toInsert)
        await txInsert.isPersisted.promise
    }

    const targetSlot = [...slotsTanCollection.values()].find(
        (s) => s.course === preferredCourse && s.time === normalizedTime
    )
    if (targetSlot === undefined) {
        return { ok: false, error: `Could not create start time ${normalizedTime}.` }
    }
    return { ok: true, time: normalizedTime, slot: targetSlot }
}
