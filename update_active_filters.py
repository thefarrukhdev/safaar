import re

path = '/home/farrukh/Projects/Frontend/safaar/apps/web-user/components/ui/ActiveFilters.tsx'
with open(path, 'r') as f:
    content = f.read()

# Replace the map button
new_chip_button = '''<button
          key={`${chip.key}-${chip.label}`}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium bg-slate-900/[0.05] text-slate-900/70 hover:bg-slate-900/[0.08] hover:text-slate-900 active:scale-[0.97] dark:bg-white/[0.08] dark:text-white/70 dark:hover:bg-white/[0.12] dark:hover:text-white transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 motion-reduce:transition-none"
        >
          <span>{chip.label}</span>
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>'''

content = re.sub(
    r'<button[^>]*key=\{`\$\{chip\.key\}-\$\{chip\.label\}`\}[^>]*>.*?<\/button>',
    new_chip_button,
    content,
    flags=re.DOTALL
)

# Replace the Clear All button
new_clear_all = '''<button
        type="button"
        onClick={onClearAll}
        className="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium text-slate-900/60 hover:text-slate-900 hover:bg-slate-900/[0.05] dark:text-white/60 dark:hover:text-white dark:hover:bg-white/[0.08] active:scale-[0.97] transition-[transform,background-color,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 motion-reduce:transition-none"
      >
        {clearAllLabel}
      </button>'''

content = re.sub(
    r'<button[^>]*onClick=\{onClearAll\}[^>]*>.*?<\/button>',
    new_clear_all,
    content,
    flags=re.DOTALL
)

with open(path, 'w') as f:
    f.write(content)
