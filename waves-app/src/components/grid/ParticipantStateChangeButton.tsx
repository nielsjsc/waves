import { useRef } from "react"
import { clearStateNoShow, clearStateWrongEpunch, setStateNeedsAssignment, setStateNoShow, setStateNotAttending, setStatePresent, setStateValidated, setStateWaiting, setStateWrongEpunch } from "@/actions/participantActions"
import { type Participant as ParticipantType, type ParticipantState } from "@/api/participants"
import { SvgIconWithText } from "../SvgIconWithText"
import { isStateButtonSelected, ParticipantStateStyles } from "@/utils/styleHelpers"

interface Properties {
    participant: ParticipantType
    toState: ParticipantState
}

export function ParticipantStateChangeButton({ participant, toState }: Properties) {
    const selected = isStateButtonSelected(participant, toState)
    const lastSelectTimeRef = useRef<number>(0)

    function handleClick(e: React.MouseEvent) {
        e.stopPropagation()
        const now = Date.now()

        if (selected) {
            // Guard against ghost clicks from touch-to-mouse synthesis and rapid double-taps:
            // If the state was selected less than 250ms ago, ignore the deselect.
            if (now - lastSelectTimeRef.current < 250) {
                return
            }
            if (toState === "noShow") {
                void clearStateNoShow(participant.id)
                return
            }
            if (toState === "wrongEpunch") {
                void clearStateWrongEpunch(participant.id)
                return
            }
            // Clicking the currently selected state clears it back to no state ("waiting")
            void setStateWaiting(participant.id)
            return
        }

        lastSelectTimeRef.current = now
        switch (toState) {
            case "waiting":
                void setStateWaiting(participant.id)
                break
            case "present":
                void setStatePresent(participant.id)
                break
            case "noShow":
                void setStateNoShow(participant.id)
                break
            case "validated":
                void setStateValidated(participant.id)
                break
            case "wrongEpunch":
                void setStateWrongEpunch(participant.id)
                break
            case "notAttending":
                void setStateNotAttending(participant.id)
                break
            case "needsAssignment":
                void setStateNeedsAssignment(participant.id)
                break
            case "started":
                alert("Not Implemented")
                break
            default:
                alert("Not Implemented")
                break
        }
    }

    function buttonStyle() {
        if (selected) {
            const styles = []
            styles.push(ParticipantStateStyles.get(toState)!.bg)
            styles.push(ParticipantStateStyles.get(toState)!.borderDark)
            styles.push("text-white")
            return styles.join(" ")
        } else {
            return "border-slate-300 text-slate-800 hover:border-slate-600"
        }
    }

    function buttonLabel() {
        if (toState === "validated") {
            return selected ? "Validated" : "Validate"
        }
        return ParticipantStateStyles.get(toState)!.friendlyName
    }

    return (
        <button
            type="button"
            className={`touch-manipulation border rounded-none px-2 py-1 font-medium transition-colors ${buttonStyle()}`}
            onClick={handleClick}
            key={`participant-state-change-${toState}-${participant.id}`}>
            <SvgIconWithText
                icon={ParticipantStateStyles.get(toState)!.iconName}
                text={buttonLabel()} />
        </button>
    )
}
