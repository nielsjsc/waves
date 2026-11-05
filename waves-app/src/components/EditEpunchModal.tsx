import { ManagerActionButton } from "./ManagerActionButton"
import type { PopulatedEntry } from "@/utils/PopulatedEntry"
import { setNewEpunch } from "@/actions/participantActions"
import { useState, type ChangeEventHandler, type KeyboardEventHandler } from "react"

interface Properties {
    participant: PopulatedEntry
    closeModal: Function
}

export function EditEpunchModal({ participant, closeModal }: Properties) {
    const [newEpunchVal, setNewEpunchVal] = useState('')
    const [isRental, setIsRental] = useState<"unset" | "true" | "false">(
        participant.participant.isRental ? "true" : "false"
    )
    const [errorMessage, setErrorMessage] = useState('')

    const handleNewEpunchInput: ChangeEventHandler<HTMLInputElement> = (e) => {
        setErrorMessage('')
        setNewEpunchVal(e.target.value.trim())
    }

    function handleRentClick() {
        setErrorMessage('')
        setIsRental("true")
    }

    function handleOwnClick() {
        setErrorMessage('')
        setIsRental("false")
    }

    function handleSave() {
        if (!newEpunchVal || !/^\d{5,9}$/.test(newEpunchVal)) {
            setErrorMessage("Please enter a valid e-punch number (5 to 9 digits).")
            return
        }
        if (isRental === "unset") {
            setErrorMessage("Please select whether this e-punch is Rental or Owned.")
            return
        }

        void setNewEpunch(participant.participant.id, newEpunchVal, isRental === "true")
        closeModal()
    }

    const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSave()
        }
    }

    return (
        <div className="flex flex-col gap-3 text-slate-900">
            <p className="text-lg">
                Current e-punch:{" "}
                <span className="font-bold tabular-nums text-slate-900">
                    {participant.participant.epunch || "none"}
                </span>{" "}
                <span className="text-slate-600">
                    {participant.participant.isRental ? "(Rental)" : "(Owned)"}
                </span>
            </p>

            <div className="mt-2 flex flex-col gap-1">
                <label htmlFor="new-si" className="text-base font-semibold text-slate-800">
                    New e-punch number
                </label>
                <input
                    id="new-si"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    pattern="[0-9]{5,9}"
                    minLength={5}
                    maxLength={9}
                    className="rounded-none border border-slate-400 bg-white px-3 py-2 text-xl font-bold tabular-nums text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                    placeholder="1234567"
                    onChange={handleNewEpunchInput}
                    onKeyDown={handleKeyDown}
                    value={newEpunchVal}
                />
            </div>

            <div className="flex flex-row items-center gap-2">
                <span className="text-base font-medium text-slate-800">Type:</span>
                <ManagerActionButton
                    text="Rental"
                    action={handleRentClick}
                    icon="arrow-cycle"
                    color="amber"
                    buttonStyle={isRental === "true" ? "solid" : "outline"}
                />
                <span className="text-slate-500">or</span>
                <ManagerActionButton
                    text="Owned"
                    action={handleOwnClick}
                    icon="runner"
                    color="emerald"
                    buttonStyle={isRental === "false" ? "solid" : "outline"}
                />
            </div>

            {errorMessage !== '' && (
                <div
                    role="alert"
                    className="border border-amber-600 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
                    {errorMessage}
                </div>
            )}

            <div className="mt-4 flex flex-row gap-4">
                <ManagerActionButton
                    text="Save"
                    action={handleSave}
                    icon="arrow-box-right"
                    color="sky"
                    buttonStyle="solid"
                />
                <ManagerActionButton
                    text="Cancel"
                    action={() => closeModal()}
                    icon="x"
                    color="red"
                    buttonStyle="outline"
                />
            </div>
        </div>
    )
}
