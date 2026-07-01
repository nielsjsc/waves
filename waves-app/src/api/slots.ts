import * as v from 'valibot'
import { Participant } from '@/api/participants'

export const Slot = v.object({
    id: v.string(),
    time: v.string(),
    course: v.string(),
    participants: v.array(Participant),
    isUsable: v.optional(v.boolean(),true)
})
export type Slot = v.InferOutput<typeof Slot>
