import { useEffect, useMemo, useState } from 'react'

type CalendarViewMode = 'month' | 'week'

type CalendarItem = {
  id: string
  title: string
  // later: deleteDate, ruleGroupId, tmdbId, etc.
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad2 = (n: number) => String(n).padStart(2, '0')

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const startOfWeekSunday = (d: Date) => {
  const x = startOfDay(d)
  const day = x.getDay() // 0..6 (Sun..Sat)
  x.setDate(x.getDate() - day)
  return x
}

const addDays = (d: Date, days: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

const addMonths = (d: Date, months: number) => {
  const x = new Date(d)
  x.setMonth(x.getMonth() + months)
  return x
}

const formatMonthTitle = (d: Date) =>
  d.toLocaleString(undefined, { month: 'long', year: 'numeric' })

/**
 * UI-only mock data:
 * Deterministic-ish "items" per date so the calendar looks alive.
 */
const buildMockItemsByDayKey = (anchor: Date) => {
  const itemsByKey = new Map<string, CalendarItem[]>()

  // populate around the anchor month/week so it renders with some content
  const start = startOfWeekSunday(
    new Date(anchor.getFullYear(), anchor.getMonth(), 1),
  )
  const end = addDays(start, 42) // 6 weeks

  let cursor = new Date(start)
  while (cursor < end) {
    const key = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`

    const seed = (cursor.getDate() + (cursor.getMonth() + 1) * 3) % 10
    const count = seed === 0 ? 3 : seed <= 2 ? 2 : seed <= 4 ? 1 : 0

    const items: CalendarItem[] = []
    for (let i = 0; i < count; i++) {
      items.push({
        id: `${key}-${i}`,
        title: 'Pending Deletion',
      })
    }

    if (items.length > 0) itemsByKey.set(key, items)
    cursor = addDays(cursor, 1)
  }

  return itemsByKey
}

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Tailwind "sm" breakpoint is 640px, so < 640 = mobile
    const mql = window.matchMedia('(max-width: 639px)')
    const onChange = () => setIsMobile(mql.matches)
    onChange()

    mql.addEventListener?.('change', onChange)
    return () => mql.removeEventListener?.('change', onChange)
  }, [])

  return isMobile
}

const CalendarPage = () => {
  const isMobile = useIsMobile()

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const [desktopViewMode, setDesktopViewMode] =
    useState<CalendarViewMode>('month')
  const [cursorDate, setCursorDate] = useState<Date>(() =>
    startOfDay(new Date()),
  )

  const today = useMemo(() => startOfDay(new Date()), [])
  const itemsByKey = useMemo(
    () => buildMockItemsByDayKey(cursorDate),
    [cursorDate],
  )

  useEffect(() => {
    if (isMobile) {
      // entering mobile: remember what desktop was using, then force week
      if (viewMode !== 'week') setDesktopViewMode(viewMode)
      if (viewMode !== 'week') setViewMode('week')
      return
    }

    // leaving mobile: restore what desktop was set to
    if (viewMode === 'week' && desktopViewMode === 'month') {
      setViewMode('month')
    }
  }, [isMobile])

  const headerTitle = useMemo(() => {
    // Mobile is week-only
    if (!isMobile && viewMode === 'month') return formatMonthTitle(cursorDate)

    const weekStart = startOfWeekSunday(cursorDate)
    const weekEnd = addDays(weekStart, 6)

    const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
    const startLabel = weekStart.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
    })
    const endLabel = weekEnd.toLocaleString(undefined, {
      month: sameMonth ? undefined : 'short',
      day: 'numeric',
      year: 'numeric',
    })

    return `${startLabel} – ${endLabel}`
  }, [cursorDate, viewMode, isMobile])

  const gridDates = useMemo(() => {
    // Mobile is week-only
    if (isMobile || viewMode === 'week') {
      const weekStart = startOfWeekSunday(cursorDate)
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    }

    // month view: 6-week grid starting at the Sunday before the 1st
    const firstOfMonth = new Date(
      cursorDate.getFullYear(),
      cursorDate.getMonth(),
      1,
    )
    const gridStart = startOfWeekSunday(firstOfMonth)
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [cursorDate, viewMode, isMobile])

  const onPrev = () => {
    setCursorDate((d) =>
      !isMobile && viewMode === 'month' ? addMonths(d, -1) : addDays(d, -7),
    )
  }

  const onNext = () => {
    setCursorDate((d) =>
      !isMobile && viewMode === 'month' ? addMonths(d, 1) : addDays(d, 7),
    )
  }

  const onToday = () => setCursorDate(today)

  const isOutsideMonth = (d: Date) =>
    !isMobile && viewMode === 'month' && d.getMonth() !== cursorDate.getMonth()

  const getItemsForDay = (d: Date) => {
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    return itemsByKey.get(key) ?? []
  }

  return (
    <div className="w-full px-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-white">{headerTitle}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View mode (hidden on mobile; mobile is week-only) */}
          <div className="hidden items-center gap-2 sm:flex">
            <label className="text-sm text-zinc-300">View</label>
            <select
              className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white shadow-sm outline-none focus:border-amber-500"
              value={viewMode}
              onChange={(e) => {
                const next = e.target.value as CalendarViewMode
                setViewMode(next)
                setDesktopViewMode(next)
              }}
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
          </div>

          {/* Nav controls */}
          <button
            className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800"
            type="button"
            onClick={onPrev}
          >
            Prev
          </button>
          <button
            className="h-10 rounded-md bg-amber-600 px-3 text-sm font-medium text-zinc-900 shadow-md hover:bg-amber-500"
            type="button"
            onClick={onToday}
          >
            Today
          </button>
          <button
            className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800"
            type="button"
            onClick={onNext}
          >
            Next
          </button>
        </div>
      </div>

      {/* Calendar container */}
      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-700/40 shadow-lg backdrop-blur">
        {/* Weekday header row (desktop only) */}
        <div className="hidden grid-cols-7 border-b border-zinc-700/60 bg-zinc-700/70 sm:grid">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-200"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Body */}
        <div
          className={[
            // Mobile: one column. Desktop: 7 columns (table-like).
            'grid gap-px bg-zinc-700/60',
            isMobile ? 'grid-cols-1' : 'grid-cols-7',
          ].join(' ')}
        >
          {(isMobile || viewMode === 'week' ? gridDates : gridDates).map(
            (date) => {
              const items = getItemsForDay(date)
              const outside = isOutsideMonth(date)
              const isToday = isSameDay(date, today)
              const dayName = DAY_NAMES[date.getDay()]
              const dateLabel = date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })

              return (
                <div
                  key={date.toISOString()}
                  className={[
                    isMobile ? 'min-h-[4.5rem]' : 'min-h-[7rem]',
                    'bg-zinc-800/60 p-2 transition-colors hover:bg-zinc-800/80',
                    outside ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  {/* Day header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={[
                          'flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-2 text-xs font-semibold',
                          isToday
                            ? 'bg-amber-500 text-zinc-900'
                            : 'border border-zinc-700/60 bg-zinc-800 text-zinc-100',
                        ].join(' ')}
                        title={date.toDateString()}
                      >
                        {date.getDate()}
                      </div>

                      {/* Mobile: show weekday + full date label */}
                      <div className="sm:hidden">
                        <div className="text-sm font-semibold text-zinc-100">
                          {dayName}
                        </div>
                        <div className="text-xs text-zinc-300/80">
                          {dateLabel}
                        </div>
                      </div>
                    </div>

                    {items.length > 0 && (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
                        {items.length} pending
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="mt-2 flex flex-col gap-1">
                    {items.length === 0 ? (
                      <div className="select-none text-xs text-zinc-400/70">
                        No deletions
                      </div>
                    ) : (
                      items.slice(0, isMobile ? 5 : 3).map((it) => (
                        <div
                          key={it.id}
                          className="truncate rounded-md border border-zinc-600/60 bg-zinc-700/40 px-2 py-1 text-xs text-zinc-100 hover:border-amber-500/40"
                          title={it.title}
                        >
                          {it.title}
                        </div>
                      ))
                    )}

                    {!isMobile && items.length > 3 && (
                      <div className="text-xs text-zinc-300/80">
                        +{items.length - 3} more…
                      </div>
                    )}

                    {isMobile && items.length > 5 && (
                      <div className="text-xs text-zinc-300/80">
                        +{items.length - 5} more…
                      </div>
                    )}
                  </div>
                </div>
              )
            },
          )}
        </div>
      </div>
    </div>
  )
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default CalendarPage
