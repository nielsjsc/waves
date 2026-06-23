import type { Participant } from "@/api/participants";

export type PopulatedEntry = {
    slotId: string;
    participant: Participant;
    time: string;
    course: string;
};
