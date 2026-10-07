import { cn } from"@/lib/cn";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
 return (
 <div
 className={cn("animate-pulse rounded-md bg-slate-200/80", className)}
 {...props}
 />
 );
}
