import type { MouseEventHandler, ReactNode } from "react"
import { ManagerActionButton } from "./ManagerActionButton"

interface Properties {
    close: MouseEventHandler
    title: string
    content: ReactNode
}

export function Modal({ close, title, content }: Properties) {
    return (
        <div
            className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4"
            onClick={close}>
            <div
                className="z-50 max-h-[92vh] sm:max-h-[90vh] w-full max-w-2xl overflow-y-auto border-t-2 sm:border-2 border-slate-900 bg-white p-4 sm:p-5 text-slate-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-row items-center justify-between gap-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{title}</h2>
                    <ManagerActionButton
                        text={"Close"}
                        action={close}
                        icon={"x"}
                        color={"red"}
                        buttonStyle={"outline"}
                        className="shrink-0" />
                </div>
                <hr className="my-3 border-slate-200" />
                {content}
            </div>
        </div>
    )
}
