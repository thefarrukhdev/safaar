import re

path = '/home/farrukh/Projects/Frontend/safaar/apps/web-user/components/ui/FilterGroup.tsx'
with open(path, 'r') as f:
    content = f.read()

content = content.replace(
    'border-b border-slate-100 py-3 dark:border-slate-800',
    'border-b border-slate-900/[0.08] py-3 dark:border-white/[0.10]'
)
content = content.replace(
    'className="flex w-full items-center justify-between py-1 text-left"',
    'className="flex w-full items-center justify-between py-1 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"'
)
content = content.replace(
    'text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300',
    'text-sm font-semibold text-slate-900 dark:text-white'
)
content = content.replace(
    'text-slate-400 transition-transform duration-200',
    'text-slate-900/60 dark:text-white/60 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]'
)
content = content.replace(
    'mt-2.5 flex flex-col gap-2 transition-all',
    'mt-2.5 flex flex-col gap-2'
)

with open(path, 'w') as f:
    f.write(content)
