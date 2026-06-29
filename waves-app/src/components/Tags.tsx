import type { Participant } from "@/api/participants"
import type { JSX } from "react"

export function ncTag(p:Participant):JSX.Element {
    return p.isNonCompete ? <span className="py-0.75 px-1 text-indigo-100 bg-indigo-800 rounded-full text-xs">NC</span> : <span></span>
} 
export function rentTag(p:Participant):JSX.Element {
    return p.isRental ? <span className="py-0.75 px-1.5 text-amber-100 bg-amber-800 rounded-full text-xs">Rental SI</span> : <span></span>
}
export function groupTag(p:Participant):JSX.Element {
    return p.groupSize > 1 ? <span className="py-0.75 px-1.5 text-emerald-100 bg-emerald-700 rounded-full text-xs">Group:{p.groupSize}</span> : <span></span>
}