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
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
            onClick={close}>
            <div
                className="z-50 max-h-[90vh] w-full max-w-2xl overflow-y-auto border-2 border-slate-800 bg-white p-5 text-slate-900 shadow-xl"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-row items-center justify-between gap-3">
                    <span className="text-xl font-bold text-slate-900">{title}</span>
                    <ManagerActionButton
                        text={"Close"}
                        action={close}
                        icon={"x"}
                        color={"red"}
                        buttonStyle={"outline"} />
                </div>
                <hr className="my-3 border-slate-200" />
                {content}
            </div>
        </div>
    )
}
