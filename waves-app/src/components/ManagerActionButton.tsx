import type { MouseEventHandler } from "react"
import { SvgIconWithText } from "./SvgIconWithText"
import { ColorStyles } from "@/utils/styleHelpers"

interface Properties {
    text: string
    action: MouseEventHandler
    icon: string
    color: string
    buttonStyle: 'solid'|'outline'
    className?: string
}

function buttonStyleClasses(buttonStyle:string, color:string):string {
    if (buttonStyle === 'outline') {
        const style = []
        style.push("bg-white")
        style.push(ColorStyles.get(color)?.border)
        style.push(ColorStyles.get(color)?.text)
        style.push(ColorStyles.get(color)?.bgHover)
        style.push("hover:text-white")
        return style.join(" ")
    } else { // solid
        const style = []
        style.push(ColorStyles.get(color)?.borderDark)
        style.push(ColorStyles.get(color)?.bg)
        style.push("text-white")
        style.push(ColorStyles.get(color)?.bgDarkHover)
        return style.join(" ")
    }
}

export function ManagerActionButton({text, action, icon, color, buttonStyle, className}: Properties) {
    const styling = `rounded-sm border px-2.5 py-1.5 min-h-10 sm:min-h-9 font-medium transition-colors inline-flex items-center justify-center ${buttonStyleClasses(buttonStyle, color)} ${className ?? ''}`

    return (
        <button 
            type="button"
            className={styling}
            onClick={action}
        >
            <SvgIconWithText
                icon={icon}
                text={text} />
        </button>
    )
}
