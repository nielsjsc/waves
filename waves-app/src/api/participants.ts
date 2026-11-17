import * as v from 'valibot'

export const Participant = v.object({
    id:v.string(),
    name:v.string(),
    state:v.picklist(["waiting", "present", "validated", "wrongEpunch", "noShow", "notAttending", "needsAssignment", "started"]),
    prevState:v.optional(v.picklist(["waiting", "present", "validated", "wrongEpunch", "noShow", "notAttending", "needsAssignment", "started"])),
    club:v.optional(v.string(), 'None'),
    epunch:v.optional(v.string(), ''),
    isRental:v.boolean(),
    isNonCompete:v.boolean(),
    groupSize:v.number(),
    originalStartTime:v.optional(v.string()),
    startChanged:v.boolean(),
    needsWaiver:v.optional(v.boolean()),
    needsPayment:v.optional(v.boolean()),
    isSecondCourse:v.optional(v.boolean()),
    hasRentedCompass:v.optional(v.boolean()),
})
export type Participant = v.InferOutput<typeof Participant>

// Update participant State Styles if adding states here!
export type ParticipantState = 
    | "waiting"
    | "present"
    | "validated"
    | "wrongEpunch"
    | "noShow"
    | "notAttending"
    | "needsAssignment"
    | "started"