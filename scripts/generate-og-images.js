const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..");
const WIDTH = 1200;
const HEIGHT = 630;

const images = [
  {
    filename: "og-home.png",
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;}
  body{
    background:#C8F041;
    font-family:system-ui,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
    position:relative;
    padding:80px;
    display:flex;
    flex-direction:column;
    justify-content:center;
  }
  .wordmark{position:absolute;top:80px;left:80px;font-size:28px;font-weight:700;color:#0a0a0a;letter-spacing:-0.01em;}
  .url{position:absolute;bottom:80px;right:80px;font-size:24px;font-weight:500;color:#0a0a0a;}
  .headline{font-size:72px;font-weight:800;color:#0a0a0a;line-height:1.05;letter-spacing:-0.025em;margin-bottom:24px;}
  .subtitle{font-size:36px;font-weight:500;color:rgba(10,10,10,0.75);line-height:1.3;}
</style></head>
<body>
  <div class="wordmark">Midly.ai</div>
  <div class="headline">Close deals faster.</div>
  <div class="subtitle">AI-powered contract workflows for deal teams.</div>
  <div class="url">app.midly.ai</div>
</body></html>`,
  },
  {
    filename: "og-sprint.png",
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;}
  body{
    background:#C8F041;
    font-family:system-ui,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
    position:relative;
    padding:80px;
    display:flex;
    flex-direction:column;
    justify-content:center;
    overflow:hidden;
  }
  /* subtle diagonal stripe bottom-right */
  body::after{
    content:'';
    position:absolute;
    bottom:-120px;right:-80px;
    width:520px;height:520px;
    background:white;
    opacity:0.08;
    transform:rotate(30deg);
    pointer-events:none;
  }
  .wordmark{position:absolute;top:80px;left:80px;font-size:28px;font-weight:700;color:#0a0a0a;letter-spacing:-0.01em;}
  .url{position:absolute;bottom:80px;right:80px;font-size:24px;font-weight:500;color:#0a0a0a;}
  .eyebrow{font-size:22px;font-weight:600;color:#0a0a0a;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:20px;}
  .headline{font-size:64px;font-weight:800;color:#0a0a0a;line-height:1.05;letter-spacing:-0.02em;margin-bottom:24px;max-width:900px;}
  .subtext{font-size:30px;font-weight:400;color:rgba(10,10,10,0.7);line-height:1.35;}
</style></head>
<body>
  <div class="wordmark">Midly.ai</div>
  <div class="eyebrow">Free 5-Day Sprint</div>
  <div class="headline">5 Days to a Working Contract Workflow</div>
  <div class="subtext">Get your deals moving before Q2 is half over.</div>
  <div class="url">midly.ai/sprint</div>
</body></html>`,
  },
  {
    filename: "og-default.png",
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;}
  body{
    background:#C8F041;
    font-family:system-ui,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
    position:relative;
    padding:80px;
    display:flex;
    flex-direction:column;
    justify-content:center;
  }
  .wordmark{position:absolute;top:80px;left:80px;font-size:28px;font-weight:700;color:#0a0a0a;letter-spacing:-0.01em;}
  .url{position:absolute;bottom:80px;right:80px;font-size:24px;font-weight:500;color:#0a0a0a;}
  .headline{font-size:72px;font-weight:800;color:#0a0a0a;line-height:1.05;letter-spacing:-0.025em;margin-bottom:24px;max-width:960px;}
  .subtitle{font-size:36px;font-weight:500;color:rgba(10,10,10,0.75);line-height:1.3;}
</style></head>
<body>
  <div class="wordmark">Midly.ai</div>
  <div class="headline">AI Contract Workflows. Built for Deal Teams.</div>
  <div class="subtitle">AI-powered contract workflows for deal teams.</div>
  <div class="url">app.midly.ai</div>
</body></html>`,
  },
];

(async () => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });

  for (const img of images) {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(img.html, { waitUntil: "domcontentloaded" });
    const outPath = path.join(OUT_DIR, img.filename);
    await page.screenshot({ path: outPath, type: "png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    await page.close();
    const size = fs.statSync(outPath).size;
    console.log(`✓ ${img.filename} — ${(size / 1024).toFixed(1)} KB`);
  }

  await browser.close();
  console.log("Done.");
})();
