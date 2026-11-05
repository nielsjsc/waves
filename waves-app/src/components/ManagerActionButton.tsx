import type { MouseEventHandler } from "react"
import { SvgIconWithText } from "./SvgIconWithText"
import { ColorStyles } from "@/utils/styleHelpers"

interface Properties {
    text: string
    action: MouseEventHandler
    icon: string
    color: string
    buttonStyle: 'solid'|'outline'
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

export function ManagerActionButton({text, action, icon, color, buttonStyle}: Properties) {
    const styling = "rounded-sm border px-2.5 py-1 font-medium transition-colors " + buttonStyleClasses(buttonStyle, color)

    return(
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
