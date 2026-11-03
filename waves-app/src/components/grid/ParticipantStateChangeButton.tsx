import { setStateNeedsAssignment, setStateNoShow, setStateNotAttending, setStatePresent, setStateValidated, setStateWaiting, setStateWrongEpunch } from "@/actions/participantActions"
import {type Participant as ParticipantType,  type ParticipantState } from "@/api/participants"
import { SvgIconWithText } from "../SvgIconWithText"
import { ParticipantStateStyles } from "@/utils/styleHelpers"


interface Properties {
    participant: ParticipantType
    toState: ParticipantState
}


export function ParticipantStateChangeButton({participant, toState}:Properties) {

    function action(toState:ParticipantState) {
        if (participant.state === toState) {
            // Clicking the currently selected state clears it back to no state ("waiting")
            toState = "waiting"
        }
        switch (toState) {
            case "waiting":
                return ()=>setStateWaiting(participant.id)
            case "present":
                return ()=>setStatePresent(participant.id)
            case "noShow":
                return ()=>setStateNoShow(participant.id)
            case "validated":
                return ()=>setStateValidated(participant.id)
            case "wrongEpunch":
                return ()=>setStateWrongEpunch(participant.id)
            case "notAttending":
                return ()=>setStateNotAttending(participant.id)
            case "needsAssignment":
                return ()=>setStateNeedsAssignment(participant.id)
            case "started":
                return ()=>{alert("Not Implemented")}
            default:
                return ()=>{alert("Not Implemented")}
        }
    }

    function buttonStyle() {
        if (participant.state === toState) {
            let styles = []
            styles.push(ParticipantStateStyles.get(toState)!.bg)
            styles.push(ParticipantStateStyles.get(toState)!.borderDark)
            styles.push("text-white")
            return styles.join(" ")
        } else {
            return ""
        }
    }

    function buttonLabel() {
        if (toState === "validated") {
            return participant.state === "validated" ? "Validated" : "Validate"
        }
        return ParticipantStateStyles.get(toState)!.friendlyName
    }

    return(
        <button 
            className={`border border-1 rounded-sm p-1 ${buttonStyle()}`}
            onClick={action(toState)} 
            key={`participant-state-change-${toState}-${participant.id}`}>
            <SvgIconWithText 
                icon={ParticipantStateStyles.get(toState)!.iconName}
                text={buttonLabel()}/>
        </button>
    )
}