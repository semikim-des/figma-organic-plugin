const VARIANT_SPACING = 96

const FONT_REGULAR: FontName = { family: 'Spoqa Han Sans Neo', style: 'Regular' }
const FONT_BOLD: FontName = { family: 'Spoqa Han Sans Neo', style: 'Bold' }

type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

type TemplatePayload = {
  name: string
  width: number
  height: number
  previewImageData: string
  jobTitleBounds: Bounds | null
  speakerNameBounds: Bounds | null
  dDayBounds: Bounds | null
  imgBounds: Bounds | null
}

type GenerateMessage = {
  type: 'generate'
  payload: {
    jobTitle: string
    speakerName: string
    dDay: string
    imageLink: string
    templates: TemplatePayload[]
  }
}

type ErrorResponse = {
  type: 'error'
  message: string
}

figma.showUI(__html__, { width: 360, height: 440 })

figma.ui.onmessage = async (msg: GenerateMessage) => {
  if (msg.type !== 'generate') {
    return
  }

  try {
    const { jobTitle, speakerName, dDay, imageLink, templates } = msg.payload
    validateDday(dDay)

    if (!Array.isArray(templates) || templates.length !== 4) {
      throw new Error('템플릿 데이터가 올바르지 않습니다.')
    }

    await loadRequiredFonts()

    const driveFileId = parseGoogleDriveFileId(imageLink)
    const userImageBytes = await fetchImageBytes(driveFileId)
    const userImageHash = figma.createImage(userImageBytes).hash

    const previewHashes = new Map<string, string>()
    for (const template of templates) {
      previewHashes.set(template.name, figma.createImage(dataUrlToBytes(template.previewImageData)).hash)
    }

    const origin = resolvePlacementOrigin()
    const createdFrames: FrameNode[] = []
    let currentX = origin.x

    for (const template of templates) {
      const frame = buildVariantFrame(
        template,
        previewHashes.get(template.name) ?? '',
        userImageHash,
        truncateText(jobTitle),
        truncateText(speakerName),
        `D-${dDay}`,
      )

      frame.x = currentX
      frame.y = origin.y
      figma.currentPage.appendChild(frame)
      createdFrames.push(frame)
      currentX += template.width + VARIANT_SPACING
    }

    figma.currentPage.selection = createdFrames
    figma.viewport.scrollAndZoomIntoView(createdFrames)
    figma.notify('4개의 시안을 생성했습니다.')
    figma.closePlugin()
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    figma.ui.postMessage({ type: 'error', message } satisfies ErrorResponse)
    figma.notify(message, { error: true })
  }
}

async function loadRequiredFonts(): Promise<void> {
  try {
    await figma.loadFontAsync(FONT_REGULAR)
    await figma.loadFontAsync(FONT_BOLD)
  } catch {
    throw new Error('Spoqa Han Sans Neo 폰트를 불러오지 못했습니다.')
  }
}

function buildVariantFrame(
  template: TemplatePayload,
  previewImageHash: string,
  userImageHash: string,
  jobTitle: string,
  speakerName: string,
  dDay: string,
): FrameNode {
  const frame = figma.createFrame()
  frame.name = template.name
  frame.resizeWithoutConstraints(template.width, template.height)
  frame.clipsContent = true
  frame.fills = [solidPaint(hexToRgb(getTemplateStyle(template.name).background))]

  const imageBounds = template.imgBounds ?? { x: 0, y: 0, width: template.width, height: template.height }
  const imageLayer = figma.createFrame()
  imageLayer.name = 'img'
  imageLayer.x = imageBounds.x
  imageLayer.y = imageBounds.y
  imageLayer.resizeWithoutConstraints(imageBounds.width, imageBounds.height)
  imageLayer.clipsContent = true
  imageLayer.fills = [imagePaint(userImageHash)]
  imageLayer.visible = Boolean(template.imgBounds)
  frame.appendChild(imageLayer)

  const previewLayer = figma.createRectangle()
  previewLayer.name = '__preview__'
  previewLayer.resizeWithoutConstraints(template.width, template.height)
  previewLayer.fills = [imagePaint(previewImageHash)]
  previewLayer.opacity = template.imgBounds ? 0.22 : 1
  previewLayer.locked = true
  frame.appendChild(previewLayer)

  const jobLayer = createTextLayer('job_title', template.jobTitleBounds ?? fallbackBounds(template, 'job_title'))
  const speakerLayer = createTextLayer(
    'speaker_name',
    template.speakerNameBounds ?? fallbackBounds(template, 'speaker_name'),
  )
  const dDayLayer = createTextLayer('d_day', template.dDayBounds ?? fallbackBounds(template, 'd_day'))

  frame.appendChild(jobLayer)
  frame.appendChild(speakerLayer)
  frame.appendChild(dDayLayer)

  applyTemplateValues(frame, template, jobTitle, speakerName, dDay, userImageHash)
  return frame
}

function applyTemplateValues(
  frame: FrameNode,
  template: TemplatePayload,
  jobTitle: string,
  speakerName: string,
  dDay: string,
  userImageHash: string,
): void {
  const jobLayer = findNodeByName(frame, 'job_title')
  const speakerLayer = findNodeByName(frame, 'speaker_name')
  const dDayLayer = findNodeByName(frame, 'd_day')
  const imageLayer = findNodeByName(frame, 'img')
  const style = getTemplateStyle(template.name)

  if (jobLayer?.type === 'TEXT') {
    styleTextNode(jobLayer, jobTitle, style.jobColor, style.jobSize, style.jobAlign, FONT_BOLD)
  }

  if (speakerLayer?.type === 'TEXT') {
    styleTextNode(speakerLayer, speakerName, style.speakerColor, style.speakerSize, style.speakerAlign, FONT_REGULAR)
  }

  if (dDayLayer?.type === 'TEXT') {
    styleTextNode(dDayLayer, dDay, style.ddayColor, style.ddaySize, style.ddayAlign, FONT_BOLD)
  }

  if (imageLayer && 'fills' in imageLayer) {
    imageLayer.fills = [imagePaint(userImageHash)]
    imageLayer.visible = Boolean(template.imgBounds)
  }
}

function createTextLayer(name: string, bounds: Bounds): TextNode {
  const node = figma.createText()
  node.name = name
  node.x = bounds.x
  node.y = bounds.y
  node.resize(bounds.width, Math.max(bounds.height, 24))
  node.textAutoResize = 'HEIGHT'
  node.characters = name
  return node
}

function styleTextNode(
  node: TextNode,
  value: string,
  color: string,
  size: number,
  align: TextAlignHorizontal,
  fontName: FontName,
): void {
  node.fontName = fontName
  node.characters = value
  node.fontSize = size
  node.lineHeight = { unit: 'PIXELS', value: Math.round(size * 1.15) }
  node.fills = [solidPaint(hexToRgb(color))]
  node.textAlignHorizontal = align
  node.textAutoResize = 'HEIGHT'
}

function findNodeByName(root: ChildrenMixin, name: string): SceneNode | null {
  for (const child of root.children) {
    if (child.name === name) {
      return child
    }
    if ('children' in child) {
      const found = findNodeByName(child, name)
      if (found) {
        return found
      }
    }
  }
  return null
}

function fallbackBounds(template: TemplatePayload, layerName: 'job_title' | 'speaker_name' | 'd_day'): Bounds {
  if (layerName === 'job_title') {
    return {
      x: 48,
      y: template.height - 172,
      width: Math.max(template.width - 96, 240),
      height: 48,
    }
  }

  if (layerName === 'speaker_name') {
    return {
      x: 48,
      y: template.height - 108,
      width: Math.max(template.width - 96, 220),
      height: 44,
    }
  }

  return {
    x: Math.min(64, template.width * 0.08),
    y: Math.min(72, template.height * 0.08),
    width: Math.min(180, template.width * 0.28),
    height: 44,
  }
}

function getTemplateStyle(templateName: string): {
  background: string
  jobColor: string
  speakerColor: string
  ddayColor: string
  jobSize: number
  speakerSize: number
  ddaySize: number
  jobAlign: TextAlignHorizontal
  speakerAlign: TextAlignHorizontal
  ddayAlign: TextAlignHorizontal
} {
  if (templateName === 'kakao') {
    return {
      background: '#F5E84B',
      jobColor: '#111111',
      speakerColor: '#111111',
      ddayColor: '#111111',
      jobSize: 32,
      speakerSize: 40,
      ddaySize: 26,
      jobAlign: 'LEFT',
      speakerAlign: 'LEFT',
      ddayAlign: 'CENTER',
    }
  }

  if (templateName === 'earlybird_organic/ig-story') {
    return {
      background: '#111111',
      jobColor: '#FFFFFF',
      speakerColor: '#FFFFFF',
      ddayColor: '#FFFFFF',
      jobSize: 34,
      speakerSize: 34,
      ddaySize: 28,
      jobAlign: 'CENTER',
      speakerAlign: 'CENTER',
      ddayAlign: 'CENTER',
    }
  }

  return {
    background: '#111111',
    jobColor: '#FFFFFF',
    speakerColor: '#FFFFFF',
    ddayColor: '#FFFFFF',
    jobSize: 34,
    speakerSize: 34,
    ddaySize: 28,
    jobAlign: 'LEFT',
    speakerAlign: 'LEFT',
    ddayAlign: 'CENTER',
  }
}

function resolvePlacementOrigin(): { x: number; y: number } {
  if (figma.currentPage.selection.length > 0) {
    const selectedNode = figma.currentPage.selection[0]
    return { x: selectedNode.x, y: selectedNode.y }
  }

  return {
    x: figma.viewport.center.x,
    y: figma.viewport.center.y,
  }
}

function validateDday(value: string): void {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error('디데이는 숫자만 입력할 수 있습니다.')
  }
}

function parseGoogleDriveFileId(link: string): string {
  const trimmed = link.trim()
  const matchers = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ]

  for (const matcher of matchers) {
    const matched = trimmed.match(matcher)
    if (matched?.[1]) {
      return matched[1]
    }
  }

  throw new Error('공개 구글 드라이브 링크에서 file id를 찾지 못했습니다.')
}

async function fetchImageBytes(fileId: string): Promise<Uint8Array> {
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`
  let response: Response

  try {
    response = await fetch(url)
  } catch {
    throw new Error('이미지 다운로드 요청에 실패했습니다.')
  }

  if (!response.ok) {
    throw new Error('이미지 fetch에 실패했습니다.')
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('이미지 데이터가 비어 있습니다.')
  }
  return bytes
}

function truncateText(value: string): string {
  const trimmed = value.trim()
  return trimmed.length >= 10 ? `${trimmed.slice(0, 9)}...` : trimmed
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index)
  }

  return bytes
}

function imagePaint(imageHash: string): ImagePaint {
  return {
    type: 'IMAGE',
    imageHash,
    scaleMode: 'FILL',
  }
}

function solidPaint(color: RGB): SolidPaint {
  return {
    type: 'SOLID',
    color,
  }
}

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)

  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  }
}
