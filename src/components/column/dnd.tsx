import type { PropsWithChildren } from "react"
import type { HiddenColumnID, SourceID } from "@shared/types"
import { columns } from "@shared/metadata"
import type { BaseEventPayload, ElementDragType } from "@atlaskit/pragmatic-drag-and-drop/dist/types/internal-types"
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge"
import { createPortal } from "react-dom"
import { useThrottleFn } from "ahooks"
import { useAutoAnimate } from "@formkit/auto-animate/react"
import { motion } from "framer-motion"
import { useWindowSize } from "react-use"
import { isMobile } from "react-device-detect"
import { DndContext } from "../common/dnd"
import { useSortable } from "../common/dnd/useSortable"
import { OverlayScrollbar } from "../common/overlay-scrollbar"
import type { ItemsProps } from "./card"
import { CardWrapper } from "./card"
import { currentColumnIDAtom, currentSourcesAtom } from "~/atoms"

const AnimationDuration = 200
const WIDTH = 350
const COLUMN_ORDER = Object.keys(columns).filter(id => !["focus", "hottest", "realtime", "updated"].includes(id)) as HiddenColumnID[]

function groupSourcesByColumn(items: SourceID[]) {
  const grouped = new Map<HiddenColumnID | "uncategorized", SourceID[]>()
  items.forEach((id) => {
    const column = sources[id].column ?? "uncategorized"
    grouped.set(column, [...(grouped.get(column) ?? []), id])
  })

  return [
    ...COLUMN_ORDER.map(column => ({
      id: column,
      name: columns[column].zh,
      items: grouped.get(column) ?? [],
    })),
    {
      id: "uncategorized" as const,
      name: "未分类",
      items: grouped.get("uncategorized") ?? [],
    },
  ].filter(group => group.items.length)
}

export function Dnd() {
  const [items, setItems] = useAtom(currentSourcesAtom)
  const currentColumnID = useAtomValue(currentColumnIDAtom)
  const sortable = currentColumnID === "focus"
  const [parent] = useAutoAnimate({ duration: AnimationDuration })
  useEntireQuery(items)
  const { width } = useWindowSize()
  const minWidth = useMemo(() => {
    // double padding = 32
    return Math.min(width - 32, WIDTH)
  }, [width])

  if (!items.length) return null

  const groups = groupSourcesByColumn(items)
  const renderCard = (id: SourceID, index: number, groupLength = items.length) => (
    <motion.li
      key={id}
      className={$(isMobile && "flex-shrink-0", isMobile && index === groupLength - 1 && "mr-2")}
      style={isMobile ? { width: `${width - 16 > WIDTH ? WIDTH : width - 16}px` } : undefined}
      transition={{
        type: "tween",
        duration: AnimationDuration / 1000,
      }}
      variants={{
        hidden: {
          y: 20,
          opacity: 0,
        },
        visible: {
          y: 0,
          opacity: 1,
        },
      }}
    >
      <SortableCardWrapper id={id} sortable={sortable} />
    </motion.li>
  )

  return (
    <DndWrapper items={items} setItems={setItems} isSingleColumn={isMobile} sortable={sortable}>
      <OverlayScrollbar defer className={$(sortable && "overflow-x-auto")}>
        <motion.ol
          className={sortable
            ? isMobile
              ? "flex px-2 gap-6 pb-4 scroll-smooth"
              : "grid w-full gap-6"
            : "flex flex-col gap-8"}
          ref={parent}
          style={sortable && !isMobile
            ? {
                gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
              }
            : undefined}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {
              opacity: 0,
            },
            visible: {
              opacity: 1,
              transition: {
                delayChildren: 0.1,
                staggerChildren: 0.1,
              },
            },
          }}
        >
          {sortable
            ? items.map((id, index) => renderCard(id, index))
            : groups.map(group => (
                <li key={group.id} className="flex flex-col gap-3">
                  <h2 className="px-2 text-sm font-bold op-70 tracking-normal">{group.name}</h2>
                  <ol
                    className={isMobile
                      ? "flex px-2 gap-6 pb-4 overflow-x-auto scroll-smooth"
                      : "grid w-full gap-6"}
                    style={isMobile
                      ? undefined
                      : { gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}
                  >
                    {group.items.map((id, index) => renderCard(id, index, group.items.length))}
                  </ol>
                </li>
              ))}
        </motion.ol>
      </OverlayScrollbar>
      {isMobile && (
        <div className="flex justify-center">
          <span className="text-sm text-gray-500 text-center">左右滑动查看更多</span>
        </div>
      )}
    </DndWrapper>
  )
}

function DndWrapper({ items, setItems, isSingleColumn, sortable, children }: PropsWithChildren<{
  items: SourceID[]
  setItems: (items: SourceID[]) => void
  isSingleColumn: boolean
  sortable: boolean
}>) {
  const onDropTargetChange = useCallback(({ location, source }: BaseEventPayload<ElementDragType>) => {
    const traget = location.current.dropTargets[0]
    if (!traget?.data || !source?.data) return
    const closestEdgeOfTarget = extractClosestEdge(traget.data)
    const fromIndex = items.indexOf(source.data.id as SourceID)
    const toIndex = items.indexOf(traget.data.id as SourceID)
    if (fromIndex === toIndex || fromIndex === -1 || toIndex === -1) return
    const update = reorderWithEdge({
      list: items,
      startIndex: fromIndex,
      indexOfTarget: toIndex,
      closestEdgeOfTarget,
      axis: isSingleColumn ? "horizontal" : "vertical",
    })
    setItems(update)
  }, [items, setItems, isSingleColumn])
  // 避免动画干扰
  const { run } = useThrottleFn(onDropTargetChange, {
    leading: true,
    trailing: true,
    wait: AnimationDuration,
  })
  const { el } = useAtomValue(goToTopAtom)
  if (!sortable) return children

  return (
    <DndContext onDropTargetChange={run} autoscroll={el ? { element: el } : undefined}>
      {children}
    </DndContext>
  )
}

function CardOverlay({ id }: { id: SourceID }) {
  return (
    <div className={$(
      "flex flex-col p-4 backdrop-blur-5",
      `bg-${sources[id].color}-500 dark:bg-${sources[id].color} bg-op-40!`,
      !isiOS() && "rounded-2xl",
    )}
    >
      <div className={$("flex justify-between mx-2 items-center")}>
        <div className="flex gap-2 items-center">
          <div
            className={$("w-8 h-8 rounded-full bg-cover")}
            style={{
              backgroundImage: `url(/icons/${id.split("-")[0]}.png)`,
            }}
          />
          <span className="flex flex-col">
            <span className="flex items-center gap-2">
              <span className="text-xl font-bold">
                {sources[id].name}
              </span>
              {sources[id]?.title && <span className={$("text-sm", `color-${sources[id].color} bg-base op-80 bg-op-50! px-1 rounded`)}>{sources[id].title}</span>}
            </span>
            <span className="text-xs op-70">拖拽中</span>
          </span>
        </div>
        <div className={$("flex gap-2 text-lg", `color-${sources[id].color}`)}>
          <button
            type="button"
            className={$("i-ph:dots-six-vertical-duotone", "cursor-grabbing")}
          />
        </div>
      </div>
    </div>
  )
}

function SortableCardWrapper({ id, sortable }: ItemsProps & { sortable: boolean }) {
  const {
    isDragging,
    setNodeRef,
    setHandleRef,
    OverlayContainer,
  } = useSortable({ id })

  useEffect(() => {
    if (OverlayContainer) {
      OverlayContainer!.className += $(`bg-base`, !isiOS() && "rounded-2xl")
    }
  }, [OverlayContainer])

  return (
    <>
      <CardWrapper
        ref={setNodeRef}
        id={id}
        isDragging={isDragging}
        setHandleRef={sortable ? setHandleRef : undefined}
      />
      {OverlayContainer && createPortal(<CardOverlay id={id} />, OverlayContainer)}
    </>
  )
}
