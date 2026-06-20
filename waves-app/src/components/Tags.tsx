import type { Participant } from "@/api/participants"
import type { JSX } from "react"

export function ncTag(p:Participant):JSX.Element {
    return p.isNonCompete ? <span className="py-0.75 px-1 text-red-100 bg-red-800 rounded-full text-xs">NC</span> : <span></span>
} 
export function rentTag(p:Participant):JSX.Element {
    return p.isRental ? <span className="py-0.75 px-1.5 text-amber-100 bg-amber-800 rounded-full text-xs">Rent</span> : <span></span>
}
export function groupTag(p:Participant):JSX.Element {
    return p.groupSize > 1 ? <span className="py-0.75 px-1.5 text-cyan-100 bg-cyan-700 rounded-full text-sm">Group:{p.groupSize}</span> : <span></span>
}