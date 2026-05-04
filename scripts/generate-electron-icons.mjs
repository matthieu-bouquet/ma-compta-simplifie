import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { Resvg } from '@resvg/resvg-js'
import toIco from 'to-ico'

const root = process.cwd()

const svgPath = path.join(root, 'public', 'app-icon.svg')
const assetsDir = path.join(root, 'desktop', 'assets')
const iconsetDir = path.join(assetsDir, 'icon.iconset')

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true })
}

function renderSvgToPng(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'transparent',
  })
  const pngData = resvg.render()
  return Buffer.from(pngData.asPng())
}

async function main() {
  const svg = await fs.readFile(svgPath, 'utf8')

  await ensureDir(assetsDir)
  await ensureDir(iconsetDir)

  // 1) Linux icon (PNG)
  const png512 = renderSvgToPng(svg, 512)
  await fs.writeFile(path.join(assetsDir, 'icon.png'), png512)

  // 2) macOS iconset → .icns
  const iconsetSizes = [16, 32, 128, 256, 512]
  for (const size of iconsetSizes) {
    const png = renderSvgToPng(svg, size)
    await fs.writeFile(path.join(iconsetDir, `icon_${size}x${size}.png`), png)
    const png2x = renderSvgToPng(svg, size * 2)
    await fs.writeFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`), png2x)
  }

  const icnsOut = path.join(assetsDir, 'icon.icns')
  const iconutil = spawnSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsOut], {
    cwd: root,
    stdio: 'inherit',
  })
  if (iconutil.status !== 0) {
    throw new Error('iconutil failed to create icon.icns')
  }

  // 3) Windows icon (.ico)
  const icoPngs = [
    renderSvgToPng(svg, 16),
    renderSvgToPng(svg, 24),
    renderSvgToPng(svg, 32),
    renderSvgToPng(svg, 48),
    renderSvgToPng(svg, 64),
    renderSvgToPng(svg, 128),
    renderSvgToPng(svg, 256),
  ]
  const icoBuf = await toIco(icoPngs)
  await fs.writeFile(path.join(assetsDir, 'icon.ico'), icoBuf)

  console.log('[icons] Electron icons generated from public/app-icon.svg')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

