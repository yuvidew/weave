"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TablePaginationProps {
  // Current page, 1-indexed.
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * @component TablePagination
 * @description Generic pagination bar for any paginated table — a "Page X of Y"
 * indicator on the left, Prev/Next buttons on the right. Deliberately simpler
 * than `components/ui/pagination.tsx` (which is anchor/href-based and renders
 * numbered page links) since callers here just want plain click-driven paging
 * over in-memory or API-fetched pages.
 * @param page Current page, 1-indexed.
 * @param totalPages Total number of pages available.
 * @param onPageChange Called with the next page number when Prev/Next is clicked.
 */
export const TablePagination = ({ page, totalPages, onPageChange }: TablePaginationProps) => {
  // Nothing to page through — render nothing rather than a disabled no-op bar.
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
