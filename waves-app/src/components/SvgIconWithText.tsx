import { SvgIcon } from "./SvgIcon"

interface Properties {
    icon: string
    text: string
}

export function SvgIconWithText({icon, text}: Properties) {
    return (
        <span className="flex items-center gap-1.5">
            <SvgIcon icon={icon} />
            <span>{text}</span>
        </span>
    )
}
