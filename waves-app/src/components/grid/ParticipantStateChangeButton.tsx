import { setStateNoShow, setStatePresent, setStateWaiting } from "@/actions/participantActions"
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
            return ()=>setStateWaiting(participant.id)
        }
        switch (toState) {
            case "waiting":
                return ()=>setStateWaiting(participant.id)
            case "present":
                return ()=>setStatePresent(participant.id)
            case "noShow":
                return ()=>setStateNoShow(participant.id, participant.state)
            case "validated":
                return ()=>{alert("Not Implemented")}
            case "notAttending":
                return ()=>{alert("Not Implemented")}
            case "needsAssignment":
                return ()=>{alert("Not Implemented")}
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

    return(
        <button 
            className={`border border-1 rounded-sm p-1 ${buttonStyle()}`}
            onClick={action(toState)} 
            key={`participant-state-change-${toState}-${participant.id}`}>
            <SvgIconWithText 
                icon={ParticipantStateStyles.get(toState)!.iconName}
                text={ParticipantStateStyles.get(toState)!.friendlyName}/>
        </button>
    )
}