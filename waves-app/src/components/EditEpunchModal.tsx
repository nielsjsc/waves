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
        <div className="flex flex-col gap-3">
            <p className="text-lg">
                Current e-punch:{" "}
                <span className="font-bold tabular-nums text-white">
                    {participant.participant.epunch || "none"}
                </span>{" "}
                <span className="text-gray-400">
                    {participant.participant.isRental ? "(Rental)" : "(Owned)"}
                </span>
            </p>

            <div className="mt-2 flex flex-col gap-1">
                <label htmlFor="new-si" className="text-base font-medium text-gray-200">
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
                    className="rounded-md border-2 border-gray-600 bg-gray-900 px-3 py-2 text-xl font-bold tabular-nums text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none"
                    placeholder="1234567"
                    onChange={handleNewEpunchInput}
                    onKeyDown={handleKeyDown}
                    value={newEpunchVal}
                />
            </div>

            <div className="flex flex-row items-center gap-2">
                <span className="text-base text-gray-200">Type:</span>
                <ManagerActionButton
                    text="Rental"
                    action={handleRentClick}
                    icon="arrow-cycle"
                    color="amber"
                    buttonStyle={isRental === "true" ? "solid" : "outline"}
                />
                <span className="text-gray-400">or</span>
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
                    className="rounded-md border border-amber-600/80 bg-amber-950 px-3 py-2 text-sm font-medium text-amber-100">
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
