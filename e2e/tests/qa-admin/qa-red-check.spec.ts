import { test } from '@playwright/test';
test('resolve red-600/700/800 rgb', async ({ page }) => {
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
      red600: toRgb('oklch(57.7% 0.245 27.325)'),
      red700: toRgb('oklch(50.5% 0.213 27.518)'),
      red800: toRgb('oklch(44.4% 0.177 26.899)'),
    };
  });
  console.log('COLORS=' + JSON.stringify(colors));
});
