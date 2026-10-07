"use client";

import * as React from"react";
import { cn } from"@/lib/cn";

const TabsContext = React.createContext<{
 value: string;
 onValueChange: (value: string) => void;
} | null>(null);

export function Tabs({
 value,
 onValueChange,
 children,
 className,
}: {
 value: string;
 onValueChange: (value: string) => void;
 children: React.ReactNode;
 className?: string;
}) {
 return (
 <TabsContext.Provider value={{ value, onValueChange }}>
 <div className={cn("flex flex-col", className)}>{children}</div>
 </TabsContext.Provider>
 );
}

export function TabsList({
 children,
 className,
}: {
 children: React.ReactNode;
 className?: string;
}) {
 return (
 <div
 className={cn(
"inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500",
 className
 )}
 >
 {children}
 </div>
 );
}

export function TabsTrigger({
 value,
 children,
 className,
}: {
 value: string;
 children: React.ReactNode;
 className?: string;
}) {
 const context = React.useContext(TabsContext);
 if (!context) throw new Error("TabsTrigger must be used within Tabs");

 const isActive = context.value === value;

 return (
 <button
 type="button"
 role="tab"
 aria-selected={isActive}
 onClick={() => context.onValueChange(value)}
 className={cn(
"inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold ring-offset-white transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
 isActive
 ?"bg-card text-slate-950"
 :"hover:bg-slate-200/50 hover:text-slate-900 :bg-slate-700/50 :text-slate-300",
 className
 )}
 >
 {children}
 </button>
 );
}

export function TabsContent({
 value,
 children,
 className,
}: {
 value: string;
 children: React.ReactNode;
 className?: string;
}) {
 const context = React.useContext(TabsContext);
 if (!context) throw new Error("TabsContent must be used within Tabs");

 if (context.value !== value) return null;

 return (
 <div
 role="tabpanel"
 className={cn(
"mt-2 ring-offset-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
 className
 )}
 >
 {children}
 </div>
 );
}
