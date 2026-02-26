/**
 * Shape-matched skeleton loaders — use these in place of content while API calls resolve.
 * All skeletons use the .animate-shimmer class defined in index.css.
 */

/** Generic block skeleton */
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-shimmer rounded-lg ${className}`}
      {...props}
    />
  );
}

/** Matches the shape of a Card with a title + body text */
export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`bg-gray-100 rounded-2xl border border-gray-200 p-4 space-y-3 ${className}`}>
      <Skeleton className="h-5 w-2/5 rounded-md" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 rounded-md ${i === lines - 1 ? 'w-3/5' : 'w-full'}`} />
      ))}
    </div>
  );
}

/** Matches a receipt item row: icon + text + price */
export function SkeletonReceiptItem() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/3 rounded-md" />
      </div>
      <Skeleton className="h-4 w-12 rounded-md flex-shrink-0" />
    </div>
  );
}

/** Full scan-result skeleton — mirrors the ScanPage layout */
export function SkeletonScanResult() {
  return (
    <div className="space-y-4">
      {/* Score card */}
      <div className="bg-gray-100 rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2 rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
          </div>
        </div>
      </div>
      {/* Item rows */}
      <div className="bg-gray-100 rounded-2xl border border-gray-200 p-4 space-y-1">
        <Skeleton className="h-5 w-1/3 rounded-md mb-3" />
        {[1, 2, 3, 4, 5].map(i => (
          <SkeletonReceiptItem key={i} />
        ))}
      </div>
    </div>
  );
}

/** Shopping-list skeleton — aisle header + item rows */
export function SkeletonShoppingList() {
  const aisles = [3, 4, 2];
  return (
    <div className="space-y-4">
      {aisles.map((count, ai) => (
        <div key={ai} className="bg-gray-100 rounded-2xl border border-gray-200 p-4 space-y-2">
          <Skeleton className="h-5 w-1/3 rounded-md mb-3" />
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="w-5 h-5 rounded flex-shrink-0" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md flex-shrink-0" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Meal card skeleton */
export function SkeletonMealCard() {
  return (
    <div className="bg-gray-100 rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-1/2 rounded-md" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-4/5 rounded-md" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export default Skeleton;
