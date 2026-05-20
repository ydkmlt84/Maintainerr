import React, { ForwardedRef, type JSX } from 'react'

export type ButtonType =
  | 'default'
  | 'primary'
  | 'danger'
  | 'warning'
  | 'success'
  | 'ghost'
  | 'twin-primary-l'
  | 'twin-primary-r'
  | 'twin-secondary-l'
  | 'twin-secondary-r'

// Helper type to override types (overrides onClick)
type MergeElementProps<
  T extends React.ElementType,
  P extends Record<string, unknown>,
> = Omit<React.ComponentProps<T>, keyof P> & P

type ElementTypes = 'button' | 'a'

type Element<P extends ElementTypes = 'button'> = P extends 'a'
  ? HTMLAnchorElement
  : HTMLButtonElement

type BaseProps<P> = {
  buttonType?: ButtonType
  buttonSize?: 'default' | 'lg' | 'md' | 'sm'
  // Had to do declare this manually as typescript would assume e was of type any otherwise
  onClick?: (
    e: React.MouseEvent<P extends 'a' ? HTMLAnchorElement : HTMLButtonElement>,
  ) => void
}

type ButtonProps<P extends React.ElementType> = {
  as?: P
} & MergeElementProps<P, BaseProps<P>>

function Button<P extends ElementTypes = 'button'>(
  {
    buttonType = 'default',
    buttonSize = 'default',
    as,
    children,
    className,
    ...props
  }: ButtonProps<P>,
  ref?: React.Ref<Element<P>>,
): JSX.Element {
  const buttonStyle = [
    'inline-flex items-center justify-center border border-transparent leading-5 font-medium focus:outline-none transition ease-in-out duration-150 cursor-pointer disabled:opacity-50 whitespace-nowrap',
  ]
  switch (buttonType) {
    case 'primary':
      buttonStyle.push(
        'text-white bg-sky-600 border-sky-500 hover:bg-sky-500 hover:border-sky-400 rounded-md shadow-lg shadow-sky-950/30 focus:border-sky-300 focus:ring-sky-500 active:bg-sky-700 active:border-sky-700',
      )
      break
    case 'danger':
      buttonStyle.push(
        'text-white bg-red-600 border-red-600 hover:bg-red-500 hover:border-red-500 focus:border-red-700 rounded-md focus:ring-red active:bg-red-700 active:border-red-700',
      )
      break
    case 'warning':
      buttonStyle.push(
        'text-white bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-sky-500 focus:border-sky-500 rounded-md focus:ring-sky-500 active:bg-slate-700 active:border-sky-600',
      )
      break
    case 'success':
      buttonStyle.push(
        'text-white bg-cyan-800 border-cyan-700 hover:bg-cyan-700 hover:border-cyan-500 focus:border-cyan-500 rounded-md focus:ring-cyan-500 active:bg-cyan-700 active:border-cyan-600',
      )
      break
    case 'ghost':
      buttonStyle.push(
        'text-white bg-transparent border-sky-500/30 hover:border-sky-300 hover:bg-sky-500/10 focus:border-sky-200 rounded-md active:border-sky-100',
      )
      break
    case 'twin-primary-l':
      buttonStyle.push(
        'text-white bg-sky-600 border-sky-500 hover:bg-sky-500 hover:border-sky-400 focus:border-sky-300 focus:ring-sky-500 active:bg-sky-700 active:border-sky-700 rounded-l',
      )
      break
    case 'twin-primary-r':
      buttonStyle.push(
        'text-white bg-sky-600 border-sky-500 hover:bg-sky-500 hover:border-sky-400 focus:border-sky-300 focus:ring-sky-500 active:bg-sky-700 active:border-sky-700 rounded-r',
      )
      break
    case 'twin-secondary-l':
      buttonStyle.push(
        'text-white bg-cyan-900 border-cyan-800 hover:bg-cyan-800 hover:border-cyan-600 focus:border-cyan-500 focus:ring-cyan-500 active:bg-cyan-700 active:border-cyan-700 rounded-l',
      )
      break
    case 'twin-secondary-r':
      buttonStyle.push(
        'text-white bg-cyan-900 border-cyan-800 hover:bg-cyan-800 hover:border-cyan-600 focus:border-cyan-500 focus:ring-cyan-500 active:bg-cyan-700 active:border-cyan-700 rounded-r',
      )
      break
    default:
      buttonStyle.push(
        'text-slate-200 bg-slate-800 border-slate-700 hover:text-white hover:bg-slate-700 hover:border-sky-500 group-hover:text-white rounded-md group-hover:bg-slate-700 group-hover:border-sky-500 focus:border-sky-500 focus:ring-sky-500 active:text-slate-100 active:bg-slate-700 active:border-sky-500',
      )
  }

  switch (buttonSize) {
    case 'sm':
      buttonStyle.push('px-2.5 py-1.5 text-xs button-sm')
      break
    case 'lg':
      buttonStyle.push('px-6 py-3 text-base button-lg')
      break
    case 'md':
    default:
      buttonStyle.push('px-4 py-2 text-sm button-md')
  }

  buttonStyle.push(className ?? '')

  if (as === 'a') {
    return (
      <a
        className={buttonStyle.join(' ')}
        {...(props as React.ComponentProps<'a'>)}
        ref={ref as ForwardedRef<HTMLAnchorElement>}
      >
        <span className="flex items-center">{children}</span>
      </a>
    )
  } else {
    return (
      <button
        className={buttonStyle.join(' ')}
        {...(props as React.ComponentProps<'button'>)}
        ref={ref as ForwardedRef<HTMLButtonElement>}
      >
        <span className="flex items-center">{children}</span>
      </button>
    )
  }
}

export default React.forwardRef(Button) as typeof Button
