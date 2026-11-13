import { useEffect, useRef, useState } from 'react'
import type { SlotDocType } from '@/Schema'
import { addCustomStartTime } from '@/actions/participantActions'

interface Properties {
    course: string
    submitLabel?: string
    onCreated: (slot: SlotDocType, normalizedTime: string) => void
}

/**
 * Shared inline control for adding a brand-new start time (e.g., "9:38" -> "09:38")
 * directly from start-time pickers without using nested `<form>` elements.
 */
export function CustomStartTimeForm({
    course,
    submitLabel = 'Add time',
    onCreated,
}: Properties) {
    const [open, setOpen] = useState(false)
    const [timeInput, setTimeInput] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) {
            inputRef.current?.focus()
        }
    }, [open])

    async function handleSubmit() {
        setSubmitting(true)
        setErrorMsg('')
        const result = await addCustomStartTime(timeInput, course)
        setSubmitting(false)

        if (!result.ok) {
            setErrorMsg(result.error)
            return
        }

        setTimeInput('')
        setOpen(false)
        onCreated(result.slot, result.time)
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => {
                    setErrorMsg('')
                    setOpen(true)
                }}
                className="min-h-10 border border-dashed border-sky-700 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900 hover:bg-sky-100">
                + Add new start time
            </button>
        )
    }

    return (
        <div className="flex flex-col gap-2 border border-sky-700 bg-sky-50 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
                <label
                    htmlFor={`custom-start-time-${course}`}
                    className="text-xs font-bold uppercase tracking-wider text-sky-950">
                    New start time
                </label>
                <input
                    ref={inputRef}
                    id={`custom-start-time-${course}`}
                    type="text"
                    inputMode="numeric"
                    value={timeInput}
                    onChange={(e) => {
                        setTimeInput(e.target.value)
                        if (errorMsg) setErrorMsg('')
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            e.stopPropagation()
                            void handleSubmit()
                        } else if (e.key === 'Escape') {
                            e.preventDefault()
                            setOpen(false)
                            setErrorMsg('')
                        }
                    }}
                    placeholder="e.g. 9:38"
                    className="w-28 rounded-none border border-slate-400 bg-white px-2.5 py-1.5 text-sm font-semibold tabular-nums text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                />
                <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                    className="min-h-9 border border-sky-800 bg-sky-700 px-3 py-1 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50">
                    {submitting ? 'Adding…' : submitLabel}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setOpen(false)
                        setTimeInput('')
                        setErrorMsg('')
                    }}
                    className="min-h-9 border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100">
                    Cancel
                </button>
            </div>
            {errorMsg !== '' && (
                <p role="alert" className="text-xs font-medium text-red-700">
                    {errorMsg}
                </p>
            )}
        </div>
    )
}
