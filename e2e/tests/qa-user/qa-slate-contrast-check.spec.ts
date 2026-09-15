import { test } from '@playwright/test';

test('compute slate-400/500/600 rendered RGB via canvas', async ({ page }) => {
  await page.setContent('<div></div>');
  const colors = await page.evaluate(() => {
    function toRgb(oklch: string) {
      const canvas = document.createElement('canvas');
      canvas.width = 1; canvas.height = 1;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = oklch;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }
    return {
      slate400: toRgb('oklch(70.4% 0.04 256.788)'),
      slate500: toRgb('oklch(55.4% 0.046 257.417)'),
      slate600: toRgb('oklch(44.6% 0.043 257.281)'),
      slate700: toRgb('oklch(37.2% 0.044 257.287)'),
    };
  });
  console.log('COLORS=' + JSON.stringify(colors));
});
