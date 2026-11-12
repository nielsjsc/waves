import { SvgIcon } from "./SvgIcon"

interface Properties {
    icon: string
    text: string
}

export function SvgIconWithText({icon, text}: Properties) {
    if (icon === "waves-logo" || text === "") {
        return (
            <span className="flex items-center gap-1.5">
                <SvgIcon icon={icon} />
                {text !== "" && <span>{text}</span>}
            </span>
        )
    }
    return <span>{text}</span>
}
