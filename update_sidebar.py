import re

path = '/home/farrukh/Projects/Frontend/safaar/apps/web-user/components/ui/FilterSidebar.tsx'
with open(path, 'r') as f:
    content = f.read()

content = content.replace('title = "FILTRLAR"', 'title = "Filtrlar"')
content = content.replace(
    '<aside className="hidden w-full flex-col gap-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900/90 lg:flex lg:sticky lg:top-24 lg:h-fit">',
    '<aside className="hidden w-full flex-col gap-5 rounded-xl border border-slate-900/[0.08] bg-white p-5 dark:border-white/[0.10] dark:bg-slate-900 lg:flex lg:sticky lg:top-24 lg:h-fit">'
)
content = content.replace(
    'border-slate-100 pb-3.5 dark:border-slate-800',
    'border-slate-900/[0.08] pb-3.5 dark:border-white/[0.10]'
)
content = content.replace(
    'border-slate-100 px-5 py-4 dark:border-slate-800',
    'border-slate-900/[0.08] px-5 py-4 dark:border-white/[0.10]'
)
content = content.replace(
    'text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white',
    'text-base font-semibold text-slate-900 dark:text-white'
)
content = content.replace(
    'text-xs font-extrabold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 cursor-pointer transition-colors',
    'text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full px-2 py-1'
)
content = content.replace(
    'text-xs font-bold text-blue-600 dark:text-blue-400',
    'text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-full px-2 py-1'
)
content = content.replace(
    'w-full rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 active:scale-[0.99] cursor-pointer',
    'w-full rounded-full bg-blue-600 h-12 px-6 flex items-center justify-center text-base font-medium text-white shadow-emboss-alpha transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none cursor-pointer'
)
content = content.replace(
    'w-full rounded-xl bg-blue-600 py-3.5 px-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 cursor-pointer',
    'w-full rounded-full bg-blue-600 h-12 px-6 flex items-center justify-center text-base font-medium text-white shadow-emboss-alpha transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none cursor-pointer'
)
content = content.replace(
    'fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity',
    'fixed inset-0 bg-slate-900/50 dark:bg-black/60 transition-opacity'
)
content = content.replace(
    'relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in slide-in-from-bottom duration-300',
    'relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-xl border-t border-slate-900/[0.08] dark:border-white/[0.10] bg-white dark:bg-slate-900 shadow-float animate-in slide-in-from-bottom duration-300 ease-[cubic-bezier(0.2,0,0,1)]'
)
content = content.replace(
    'bg-slate-300 dark:bg-slate-700',
    'bg-slate-900/[0.12] dark:bg-white/[0.16]'
)
content = content.replace(
    'flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:border-slate-800',
    'flex h-8 w-8 items-center justify-center rounded-full border border-slate-900/[0.08] text-slate-900/60 hover:bg-slate-900/[0.05] hover:text-slate-900 dark:border-white/[0.10] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)]'
)
content = content.replace(
    'border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40',
    'border-t border-slate-900/[0.08] bg-white px-5 py-4 dark:border-white/[0.10] dark:bg-slate-900'
)

with open(path, 'w') as f:
    f.write(content)
