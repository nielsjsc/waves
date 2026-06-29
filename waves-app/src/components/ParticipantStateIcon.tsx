import type { ParticipantState } from "@/api/participants"
import { SvgIcon } from "./SvgIcon"

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

export function getColorByIconName(icon:string):string {
    switch ( icon ) {
        // Participant states
        case "clock":
            return "purple"
        case "pin":
            return "sky"
        case "check-badge":
            return "emerald"
        case "question-circle":
        case "triangle-bang":
            return "red"
        case "x":
            return "mauve"
        case "hourglass":
        case "arrow-box":
            return "orange"
        
        // others
        case "tag":
            return "orange"
        case "group":
            return "emerald"
        case "medal":
            return "purple"
        case "pencil":
            return "sky"
        case "search":
            return "pink"
        
        default:
            return "black"
    }
}

export function ParticipantStateIcon({state}: Properties) {
    // return <div className={`text-${getColorByState(state)}-600`}><SvgIcon icon={`${getIconNameByState(state)}`}/></div>
    switch ( state ) {
        case "waiting":
            return <div className="text-purple-600"><SvgIcon icon="clock"/></div>
        case "present":
            return <div className="text-sky-600"><SvgIcon icon="pin"/></div>
        case "validated":
            return <div className="text-green-600"><SvgIcon icon="check-badge"/></div>
        case "noShow":
            return <div className="text-red-600"><SvgIcon icon="question-circle"/></div>
        case "notAttending":
            return <div className="text-mauve-500"><SvgIcon icon="x"/></div>
        case "needsAssignment":
            return <div className="text-orange-600"><SvgIcon icon="hourglass"/></div>
        case "available":
            return <div className="text-orange-600"><SvgIcon icon="tag"/></div>
        default:
            return <></>
    }
}