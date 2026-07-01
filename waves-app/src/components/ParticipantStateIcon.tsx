import type { ParticipantState } from "@/api/participants"
import { SvgIcon } from "./SvgIcon"
import { ParticipantStateStyles } from "@/utils/styleHelpers"

interface Properties {
    state: ParticipantState|"available",
}

export function getColorByState(state:string):string {
    switch ( state ) {
        case "waiting":
            return "purple"
        case "present":
            return "sky"
        case "validated":
            return "emerald"
        case "noShow":
            return "red"
        case "notAttending":
            return "mauve"
        case "needsAssignment":
            return "orange"
        case "available":
            return "orange"
        default:
            return "black"
    }
}

export function getIconNameByState(state:string):string {
    switch ( state ) {
        case "waiting":
            return "clock"
        case "present":
            return "pin"
        case "validated":
            return "check-badge"
        case "noShow":
            return "question-circle"
        case "notAttending":
            return "x"
        case "needsAssignment":
            return "hourglass"
        case "available":
            return "tag"
        default:
            return ""
    }
}



export function ParticipantStateIcon({state}: Properties) {
    return <div className={ParticipantStateStyles.get(state)!.text}>
        <SvgIcon icon={ParticipantStateStyles.get(state)!.iconName}/>
        </div>
}