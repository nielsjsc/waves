import type { Participant } from "@/api/participants";

export type PopulatedChange = {
        id: string
        participant: Participant
        changedAt: Date
        changeType: string
        old: string
        new: string
        needsProcessing: boolean
        isProcessed: boolean
};
