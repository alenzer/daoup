import classnames from "classnames"
import { ButtonHTMLAttributes, DetailedHTMLProps, FC } from "react"

import { Color, ColorType } from "../types"

type BoolString = "true" | "false"

const buttonBorderClasses: Record<ColorType, Record<BoolString, string>> = {
  [Color.Green]: {
    true: "text-green hover:bg-green",
    false: "bg-green hover:text-green",
  },
  [Color.Orange]: {
    true: "text-orange hover:bg-orange",
    false: "bg-orange hover:text-orange",
  },
  [Color.Light]: {
    true: "text-light hover:bg-light",
    false: "bg-light hover:text-light",
  },
  [Color.Placeholder]: {
    true: "text-placeholder hover:bg-placeholder",
    false: "bg-placeholder hover:text-placeholder",
  },
}

interface ButtonProps
  extends DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  color?: ColorType
  outline?: boolean
  submitLabel?: string
}
export const Button: FC<ButtonProps> = ({
  children,
  color = Color.Green,
  outline,
  className,
  submitLabel,
  ...props
}) => {
  const classNames = classnames(
    "block text-center cursor-pointer",
    "py-2 px-4",
    "rounded-full",
    "transition",
    "border",
    buttonBorderClasses[color][(outline ?? false).toString() as BoolString],
    {
      "bg-dark hover:text-dark": outline,
      "text-dark hover:bg-[transparent]": !outline,
    },
    className
  )

  return submitLabel ? (
    <input type="submit" className={classNames} value={submitLabel} />
  ) : (
    <button type="button" className={classNames} {...props}>
      {children}
    </button>
  )
}
