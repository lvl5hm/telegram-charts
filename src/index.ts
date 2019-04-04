import * as data from './data.json';

const DAY_MODE_TEXT = 'Switch to Night Mode';
const NIGHT_MODE_TEXT = 'Switch to Day Mode';

const themeChangeButton = document.createElement('button');
themeChangeButton.innerHTML = DAY_MODE_TEXT;
themeChangeButton.className = 'themeButton';

enum Theme {
  LIGHT,
  DARK,
}

let targetTheme: Theme = Theme.LIGHT;
let currentTheme: Theme = Theme.LIGHT;

themeChangeButton.onclick = () => {
  if (targetTheme === Theme.LIGHT) {
    targetTheme = Theme.DARK;
    themeChangeButton.innerHTML = NIGHT_MODE_TEXT;
  } else {
    targetTheme = Theme.LIGHT;
    themeChangeButton.innerHTML = DAY_MODE_TEXT;
  }

  for (let i = 0; i < globalCharts.length; i++) {
    const ch = globalCharts[i];
    setAnimationTimer(ch, RedrawablePart.PREVIEW);
    setAnimationTimer(ch, RedrawablePart.MAIN_CHART);
    setAnimationTimer(ch, RedrawablePart.BUTTONS);
    setAnimationTimer(ch, RedrawablePart.MARK);
  }
}

document.body.appendChild(themeChangeButton);




type Color = {
  r: number;
  g: number;
  b: number;
  a: number;
}

enum ColorId {
  LEGEND_TEXT,
}



type ThemedColor = {
  light: Color;
  dark: Color;
}

const DIVIDE_X_BY = 0.00001;
const PREVIEW_MIN_DISTANCE = 0.1;
enum DragState {
  NONE,
  LEFT,
  RIGHT,
  CENTER,
}




const themeColors: ThemedColor[] = [];

function parseHex(hexColor: string) {
  const result: Color = {
    r: parseInt(hexColor.substring(0, 2), 16),
    g: parseInt(hexColor.substring(2, 4), 16),
    b: parseInt(hexColor.substring(4, 6), 16),
    a: hexColor.length === 6 ? 1 : parseInt(hexColor.substring(6, 8), 16) / 255,
  };
  return result;
}

function addColor(light: string, dark: string) {
  const result = themeColors.length;
  themeColors.push({ light: parseHex(light), dark: parseHex(dark) });
  return result;
}

const BACKGROUND_COLOR = addColor('FFFFFF', '242F3E');
const TEXT_COLOR = addColor('94A0A9', '56697A');
const VERTICAL_LINE_COLOR = addColor('DFE6EB', '3B4B5B');
const PREVIEW_BACKGROUND_COLOR = addColor('11002207', '11002244');
const BUTTON_BORDER_COLOR = addColor('E5EBF0', '35485A');
const HORIZONTAL_LINE_COLOR = addColor('ECF0F3', '313D4D');
const VIGNETTE_COLOR = addColor('DDEAF399', '40566B99');
const BUTTON_TEXT_COLOR = addColor('000000', 'FFFFFF');

function getLerpedColor(col: ColorId) {
  const tc = themeColors[col];
  let c: Color;
  if (currentTheme === Theme.LIGHT)
    c = tc.light;
  else if (currentTheme === Theme.DARK)
    c = tc.dark;
  else
    c = {
      r: lerp(tc.light.r, tc.dark.r, currentTheme),
      g: lerp(tc.light.g, tc.dark.g, currentTheme),
      b: lerp(tc.light.b, tc.dark.b, currentTheme),
      a: lerp(tc.light.a, tc.dark.a, currentTheme),
    };
  const textColor = `rgba(${c.r},${c.g},${c.b},${c.a})`;
  return textColor;
}

function setStroke(ctx: CanvasRenderingContext2D, col: ColorId) {
  ctx.strokeStyle = getLerpedColor(col);
}

function setFill(ctx: CanvasRenderingContext2D, col: ColorId) {
  ctx.fillStyle = getLerpedColor(col);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arc(x + width - radius, y + radius, radius, 1.5 * Math.PI, 2 * Math.PI);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arc(x + width - radius, y + height - radius, radius, 0, 0.5 * Math.PI);
  ctx.lineTo(x + radius, y + height);
  ctx.arc(x + radius, y + height - radius, radius, 0.5 * Math.PI, Math.PI);
  ctx.lineTo(x, y + radius);
  ctx.arc(x + radius, y + radius, radius, Math.PI, 1.5 * Math.PI);
}

const dpr = window.devicePixelRatio;

function handleResize(ch: ChartData) {
  const rect = ch.middleCanvas.getBoundingClientRect();
  ch.middleCanvas.width = rect.width * dpr;
  ch.middleCanvas.height = rect.height * dpr;
  ch.backgroundCanvas.width = rect.width * dpr;
  ch.backgroundCanvas.height = rect.height * dpr;
  ch.foregroundCanvas.width = rect.width * dpr;
  ch.foregroundCanvas.height = rect.height * dpr;

  ch._maxAnimationTimer = [15, 15, 15, 15];
}

window.onresize = () => {
  for (let ch of globalCharts) {
    handleResize(ch);
  }
}




type ChartData = {
  x: Uint32Array;
  y: Uint32Array[];
  color: string[];
  count: number;
  labels: string[];
  maxY: number;
  enabled: boolean[];
  alpha: number[];

  buttonProgress: number[];

  middleCanvas: HTMLCanvasElement;
  backgroundCanvas: HTMLCanvasElement;
  foregroundCanvas: HTMLCanvasElement;
  bg: CanvasRenderingContext2D;
  md: CanvasRenderingContext2D;
  fg: CanvasRenderingContext2D;
  globalFramesWithSameTargetCounter: number;
  dragState: DragState;
  dragOffsetPercent: number;
  previewStart: number;
  previewEnd: number;
  targetPreviewStart: number;
  targetPreviewEnd: number;
  mainChartAnim: AnimationState;
  previewAnim: AnimationState;
  markIndex: number;
  markAlpha: number;
  _maxAnimationTimer: number[];
  mouse: Mouse;
}

function getCx(x: number, minX: number, maxX: number, chartWidth: number) {
  const cX = (x - minX) / (maxX - minX) * chartWidth;
  return cX;
}

function getCy(y: number, maxY: number, chartHeight: number) {
  const cY = chartHeight - y / maxY * chartHeight;
  return cY;
}

function lerp(a: number, b: number, coeff: number) {
  const result = a * (1 - coeff) + b * coeff;
  return result;
}

function getMiddleY(x0: number, x1: number, y0: number, y1: number, x: number) {
  const xDist = x1 - x0;
  const coeff = (x - x0) / xDist;
  const result = lerp(y0, y1, coeff);
  return result;
}

type VerticalLine = {
  target: number;
  alpha: number;
}

type AnimationState = {
  current: number;
  target: number;
  vertLines: VerticalLine[];
  changeRate: number;

  oldPow2: number;
  horLines: number[];
}

function getStep(targetMaxY: number) {
  const power = Math.floor(Math.log10(targetMaxY)) - 1;
  const roundBy = 10 ** (power);
  const roundedMaxY = Math.floor(targetMaxY * 0.93 / roundBy) * roundBy;
  const step = Math.floor(roundedMaxY / (LINE_COUNT - 1));
  return step;
}


function getTextFromY(lineValue: number) {
  let lineText = lineValue.toString();
  if (lineValue >= 1000000) {
    lineText = (lineValue / 1000000).toFixed(1) + 'm';
  } else if (lineValue >= 1000) {
    lineText = (lineValue / 1000).toFixed(1) + 'k';
  }
  return lineText;
}

function drawChartLines(ch: ChartData, ctx: CanvasRenderingContext2D, targetMaxY: number, currentMaxY: number, height: number, alpha: number = 1) {
  const step = getStep(targetMaxY);
  ctx.save();
  ctx.beginPath();
  setStroke(ctx, HORIZONTAL_LINE_COLOR);
  ctx.lineWidth = 2;
  ctx.globalAlpha = alpha;
  for (let lineIndex = 0; lineIndex < LINE_COUNT; lineIndex++) {
    const lineValue = lineIndex * step;

    const lineY = height - lineValue / currentMaxY * height;
    ctx.moveTo(PREVIEW_PADDING_X, lineY);
    ctx.lineTo(ch.middleCanvas.width - PREVIEW_PADDING_X, lineY);

    setFill(ch.md, TEXT_COLOR);

    const lineText = getTextFromY(lineValue);
    ctx.fillText(lineText, PREVIEW_PADDING_X, lineY - 20);
  }
  ctx.stroke();
  ctx.restore();
}

function peek<T>(arr: T[]) {
  return arr[arr.length - 1];
}


const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function constrain(a: number, min: number, max: number) {
  const result = Math.max(Math.min(a, max), min);
  return result;
}

let globalFrameIndex = 0;

function drawChart(
  ctx: CanvasRenderingContext2D,
  ch: ChartData, pX: number, pY: number,
  chartWidth: number, chartHeight: number, startPercent: number, endPercent: number,
  anim: AnimationState, drawLines: boolean
) {
  const startIndex = Math.ceil((ch.count - 1) * startPercent);
  const endIndex = Math.floor((ch.count - 1) * endPercent);
  let targetMaxY = -Infinity;

  const distX = ch.x[ch.count - 1] - ch.x[0];
  const minX = ch.x[0] + distX * startPercent;
  const maxX = ch.x[0] + distX * endPercent;
  const maxY = anim.current * ch.maxY;

  const ALPHA_CHANGE_RATE = 0.08;

  const firstLine = anim.vertLines[0];

  let startX = startPercent * distX + ch.x[0];
  let endX = endPercent * distX + ch.x[0];


  if (drawLines) {
    ctx.clearRect(pX, drawLines ? 0 : pY, chartWidth, chartHeight + (drawLines ? 50 : 0));
    ctx.font = '20px Verdana, sans-serif';
    firstLine.alpha = Math.min(firstLine.alpha + ALPHA_CHANGE_RATE, 1);
    drawChartLines(ch, ctx, firstLine.target * ch.maxY, anim.current * ch.maxY, chartHeight, firstLine.alpha);

    for (let animIndex = 1; animIndex < anim.vertLines.length; animIndex++) {
      const line = anim.vertLines[animIndex];
      line.alpha -= ALPHA_CHANGE_RATE;
      if (line.alpha <= ALPHA_CHANGE_RATE) {
        anim.vertLines.splice(animIndex, 1);
      }
      drawChartLines(ch, ctx, line.target * ch.maxY, anim.current * ch.maxY, chartHeight, line.alpha);
    }

    const xsOnScreen = endIndex - startIndex;
    const desiredInterval = xsOnScreen / 7;
    const pow2 = Math.max(Math.ceil(Math.log2(desiredInterval)), 0);

    let startXIndex = startIndex - 1;
    let endXIndex = endIndex + 1;
    startXIndex = startXIndex;

    for (let p = 0; p <= 10; p++) {
      const alpha = anim.horLines[p];

      const alphaChange = p < pow2 ? -0.1 : 0.1
      anim.horLines[p] = constrain(alpha + alphaChange, 0, 1);

      ctx.save();
      ctx.globalAlpha = alpha;
      for (let xIndex = 2 ** p; xIndex <= endXIndex; xIndex += 2 ** (p + 1)) {
        setFill(ch.md, TEXT_COLOR);
        const date = new Date(ch.x[xIndex] / DIVIDE_X_BY);
        const text = `${MONTHS[date.getMonth()]} ${date.getUTCDate()}`;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(text, getCx(ch.x[xIndex], startX, endX, chartWidth), MAIN_CHART_HEIGHT + 10);
      }
      ctx.restore();
    }

    anim.oldPow2 = pow2;
  }

  for (let lineIndex = 0; lineIndex < ch.y.length; lineIndex++) {
    const enabled = ch.enabled[lineIndex];
    const alphaChange = enabled ? 0.05 : -0.05;
    ch.alpha[lineIndex] = constrain(ch.alpha[lineIndex] + alphaChange, 0, 1);
    const alpha = ch.alpha[lineIndex];

    ctx.save();

    if (alpha === 0) {
      continue;
    }
    ctx.globalAlpha = alpha;


    const y = ch.y[lineIndex];

    const startY = getMiddleY(ch.x[startIndex - 1], ch.x[startIndex], y[startIndex - 1], y[startIndex], startX);
    const endY = getMiddleY(ch.x[endIndex], ch.x[endIndex + 1], y[endIndex], y[endIndex + 1], endX);

    if (enabled) {
      if (startY > targetMaxY) {
        targetMaxY = startY;
      }
      if (endY > targetMaxY) {
        targetMaxY = endY;
      }
    }

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ch.color[lineIndex];
    ctx.translate(pX, pY);
    ctx.moveTo(getCx(startX, minX, maxX, chartWidth), getCy(startY, maxY, chartHeight));
    for (let i = startIndex; i <= endIndex; i++) {
      if (enabled && y[i] > targetMaxY) {
        targetMaxY = y[i];
      }
      ctx.lineTo(getCx(ch.x[i], minX, maxX, chartWidth), getCy(y[i], maxY, chartHeight));
    }
    ctx.lineTo(getCx(endX, minX, maxX, chartWidth), getCy(endY, maxY, chartHeight));
    ctx.stroke();
    ctx.restore();
  }

  const newTarget = targetMaxY / ch.maxY;
  const speed = anim.changeRate;
  if (
    (speed > 0 && anim.current + speed > anim.target) ||
    (speed < 0 && anim.current + speed < anim.target)
  ) {
    anim.current = anim.target;
  } else {
    anim.current += speed;
  }

  if (anim.target === newTarget) {
    ch.globalFramesWithSameTargetCounter++;
  } else {
    anim.target = newTarget;
    anim.changeRate = (newTarget - anim.current) / 10;
    ch.globalFramesWithSameTargetCounter = 0;
  }


  if (anim.target !== firstLine.target) {
    const shouldAddLine = (globalFrameIndex % 10 === 0 ||
      ch.mouse.left.wentUp ||
      ch.globalFramesWithSameTargetCounter > 5);

    if (shouldAddLine && getStep(ch.maxY * newTarget) !== getStep(ch.maxY * firstLine.target)) {
      anim.vertLines.unshift({
        target: anim.target,
        alpha: 0,
      });
      setAnimationTimer(ch, RedrawablePart.MAIN_CHART);
    }
  }
}


function loadChart(data: any, index: number) {
  const chart = data[index];
  const pointCount = chart.columns[0].length - 1;

  const backgroundCanvas = document.createElement('canvas');
  const bg = backgroundCanvas.getContext('2d');

  const middleCanvas = document.createElement('canvas');
  const md = middleCanvas.getContext('2d');

  const foregroundCanvas = document.createElement('canvas');
  const fg = foregroundCanvas.getContext('2d');
  foregroundCanvas.style.pointerEvents = 'none';

  const wrapper = document.createElement('div');
  wrapper.className = 'wrapper';
  wrapper.style.position = 'relative';
  wrapper.appendChild(backgroundCanvas)
  wrapper.appendChild(middleCanvas);
  wrapper.appendChild(foregroundCanvas);

  document.body.appendChild(wrapper);


  const mouse = {
    left: {
      isDown: false,
      wentDown: false,
      wentUp: false,
    },
    x: 0,
    y: 0,
  };

  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    middleCanvas.ontouchmove = e => {
      const rect = middleCanvas.getBoundingClientRect();
      mouse.x = (e.touches[0].clientX - rect.left) * dpr;
      mouse.y = (e.touches[0].clientY - rect.top) * dpr;
    }
    middleCanvas.ontouchstart = e => {
      const rect = middleCanvas.getBoundingClientRect();
      mouse.x = (e.touches[0].clientX - rect.left) * dpr;
      mouse.y = (e.touches[0].clientY - rect.top) * dpr;
      if (!mouse.left.isDown) {
        mouse.left.wentDown = true;
      }
      mouse.left.isDown = true;
    }
    middleCanvas.ontouchend = e => {
      mouse.left.wentUp = true;
      mouse.left.isDown = false;
    }
  } else {
    middleCanvas.onmousedown = e => {
      const rect = middleCanvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) * dpr;
      mouse.y = (e.clientY - rect.top) * dpr;
      if (e.button === 0) {
        mouse.left.wentDown = true;
        mouse.left.isDown = true;
      }
    }
    middleCanvas.onmouseup = e => {
      if (e.button === 0) {
        mouse.left.wentUp = true;
        mouse.left.isDown = false;
      }
    }
    middleCanvas.onmousemove = e => {
      const rect = middleCanvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) * dpr;
      mouse.y = (e.clientY - rect.top) * dpr;
    }
  }

  const ch: ChartData = {
    x: new Uint32Array(pointCount),
    y: [],
    count: pointCount,
    color: [],
    maxY: -Infinity,
    labels: [],
    enabled: [],
    alpha: [],
    buttonProgress: [],
    middleCanvas,
    backgroundCanvas,
    foregroundCanvas,

    bg,
    md,
    fg,
    globalFramesWithSameTargetCounter: 0,
    dragState: DragState.NONE,
    dragOffsetPercent: 0,
    previewStart: 0,
    previewEnd: 0,
    targetPreviewStart: 0,
    targetPreviewEnd: 0 + PREVIEW_MIN_DISTANCE,
    mainChartAnim: {
      current: 1,
      target: 1,
      vertLines: [
        {
          target: 1,
          alpha: 1,
        }
      ],
      horLines: new Array(20).fill(0),
      changeRate: 0,
      oldPow2: 0,
    },
    previewAnim: {
      current: 1,
      target: 1,
      vertLines: [
        {
          target: 1,
          alpha: 1,
        }
      ],
      horLines: [],
      changeRate: 0,
      oldPow2: 0,
    },
    markIndex: 0,
    markAlpha: 0,
    _maxAnimationTimer: [10, 10, 10, 10],
    mouse,
  };

  handleResize(ch);


  ch.x.set(chart.columns[0].slice(1).map((n: number) => (n as number) * DIVIDE_X_BY) as ArrayLike<number>);

  for (let columnIndex = 1; columnIndex < chart.columns.length; columnIndex++) {
    const color = chart.colors[`y${columnIndex - 1}`];
    const label = chart.names[`y${columnIndex - 1}`];
    const yi = new Uint32Array(pointCount);
    yi.set(chart.columns[columnIndex].slice(1) as ArrayLike<number>);
    ch.y.push(yi);
    ch.color.push(color);
    ch.labels.push(label);
    ch.enabled.push(true);
    ch.alpha.push(0);
    ch.buttonProgress.push(0);

    for (let i = 0; i < yi.length; i++) {
      if (yi[i] > ch.maxY) {
        ch.maxY = yi[i];
      }
    }
  }

  return ch;
}


const PREVIEW_PADDING_X = 20;
const PREVIEW_VIGNETTE_WIDTH = 10;
const PREVIEW_VIGNETTE_HEIGHT = 2;
const MAIN_CHART_HEIGHT = 600;
const PREVIEW_Y = MAIN_CHART_HEIGHT + 70;
const PREVIEW_HEIGHT = 70;

function getPreviewWidth(ch: ChartData) {
  const result = ch.middleCanvas.width - PREVIEW_PADDING_X * 2;
  return result;
}

type Button = {
  isDown: boolean;
  wentDown: boolean;
  wentUp: boolean;
}

type Mouse = {
  left: Button;
  x: number;
  y: number;
}

function pointInsideRect(x: number, y: number, rX: number, rY: number, rWidth: number, rHeight: number) {
  const result = x > rX &&
    x < rX + rWidth &&
    y > rY &&
    y < rY + rHeight;
  return result;
}



const LINE_COUNT = 6;


enum RedrawablePart {
  MAIN_CHART,
  PREVIEW,
  BUTTONS,
  MARK,
}

function setAnimationTimer(ch: ChartData, part: RedrawablePart) {
  ch._maxAnimationTimer[part] = 15;
}

function shouldRedraw(ch: ChartData, part: RedrawablePart) {
  return ch._maxAnimationTimer[part] >= 0;
}

function loop(ch: ChartData) {
  const { bg, fg, md, middleCanvas } = ch;


  currentTheme = constrain(currentTheme + Math.sign(targetTheme - currentTheme) * 0.02, 0, 1);


  ch.previewStart += (ch.targetPreviewStart - ch.previewStart) / 4;
  ch.previewEnd += (ch.targetPreviewEnd - ch.previewEnd) / 4;

  const previewWidth = getPreviewWidth(ch);
  const vignettePreviewWidth = previewWidth - PREVIEW_VIGNETTE_WIDTH;
  const vignetteStartX = PREVIEW_PADDING_X + ch.targetPreviewStart * vignettePreviewWidth;
  const vignetteEndX = PREVIEW_PADDING_X + ch.targetPreviewEnd * vignettePreviewWidth;


  for (let i = 0; i < ch._maxAnimationTimer.length; i++) {
    ch._maxAnimationTimer[i]--;
  }

  if (shouldRedraw(ch, RedrawablePart.MAIN_CHART)) {
    drawChart(md, ch, 0, 20, middleCanvas.width, MAIN_CHART_HEIGHT, ch.previewStart, ch.previewEnd, ch.mainChartAnim, true);
  }

  if (shouldRedraw(ch, RedrawablePart.MARK)) {
    fg.clearRect(0, 0, middleCanvas.width, MAIN_CHART_HEIGHT);
    if (ch.markAlpha > 0) {
      const distX = ch.x[ch.count - 1] - ch.x[0];
      const minX = ch.x[0] + distX * ch.previewStart;
      const maxX = ch.x[0] + distX * ch.previewEnd;
      const markScreenX = getCx(ch.x[ch.markIndex], minX, maxX, middleCanvas.width);

      fg.save();
      fg.globalAlpha = ch.markAlpha;
      fg.beginPath();
      fg.lineWidth = 3;
      setStroke(fg, VERTICAL_LINE_COLOR);
      fg.moveTo(markScreenX, 0);
      fg.lineTo(markScreenX, MAIN_CHART_HEIGHT);
      fg.stroke();

      for (let lineIndex = 0; lineIndex < ch.y.length; lineIndex++) {
        const y = ch.y[lineIndex];

        const maxY = ch.maxY * ch.mainChartAnim.current;
        const markScreenY = getCy(y[ch.markIndex], maxY, MAIN_CHART_HEIGHT) + 20;
        fg.beginPath();

        setFill(fg, BACKGROUND_COLOR);
        fg.strokeStyle = ch.color[lineIndex];
        fg.lineWidth = 3;
        fg.arc(markScreenX, markScreenY, 10, 0, 2 * Math.PI);
        fg.fill();
        fg.stroke();
      }

      const TEXT_WIDTH = 130;
      const RECT_PADDING = 15;

      fg.beginPath();
      setStroke(fg, VERTICAL_LINE_COLOR);
      const rectWidth = TEXT_WIDTH * ch.y.length + RECT_PADDING * 2;
      const rectX = Math.min(Math.max(markScreenX - 70, 0), middleCanvas.width - rectWidth);
      const rectY = 0;

      roundedRect(fg, rectX, rectY, rectWidth, 130, 10);
      fg.stroke();
      setFill(fg, BACKGROUND_COLOR);
      fg.fill();
      fg.textBaseline = 'top';

      setFill(fg, BUTTON_TEXT_COLOR)
      const date = new Date(ch.x[ch.markIndex] / DIVIDE_X_BY);
      const text = `${WEEK_DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getUTCDate()}`
      fg.font = '20px Verdana, sans-serif';
      fg.fillText(text, rectX + RECT_PADDING, rectY + RECT_PADDING);

      for (let lineIndex = 0; lineIndex < ch.y.length; lineIndex++) {
        fg.font = 'bold 20px Verdana, sans-serif';
        fg.fillStyle = ch.color[lineIndex];
        const text = getTextFromY(ch.y[lineIndex][ch.markIndex]);
        const lineX = rectX + RECT_PADDING + TEXT_WIDTH * lineIndex;
        const lineY = rectY + 60;
        fg.fillText(text, lineX, lineY);

        fg.font = '15px Verdana, sans-serif';
        fg.fillText(ch.labels[lineIndex], lineX, lineY + 40);
      }
      fg.restore();
    }
  }

  if (shouldRedraw(ch, RedrawablePart.PREVIEW)) {
    setFill(bg, BACKGROUND_COLOR);
    bg.fillRect(0, 0, middleCanvas.width, middleCanvas.height);
    drawChart(bg, ch, PREVIEW_PADDING_X, PREVIEW_Y, previewWidth, PREVIEW_HEIGHT, 0, 1, ch.previewAnim, false);
  }


  if (shouldRedraw(ch, RedrawablePart.MAIN_CHART)) {
    md.clearRect(0, PREVIEW_Y, middleCanvas.width, PREVIEW_HEIGHT);
    setFill(md, PREVIEW_BACKGROUND_COLOR);

    md.fillRect(PREVIEW_PADDING_X, PREVIEW_Y, vignetteStartX - PREVIEW_PADDING_X, PREVIEW_HEIGHT);
    md.fillRect(vignetteEndX + PREVIEW_VIGNETTE_WIDTH, PREVIEW_Y, PREVIEW_PADDING_X + previewWidth - vignetteEndX - PREVIEW_VIGNETTE_WIDTH, PREVIEW_HEIGHT);

    setFill(md, VIGNETTE_COLOR);

    md.fillRect(
      vignetteStartX,
      PREVIEW_Y,
      PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_HEIGHT,
    );

    md.fillRect(
      vignetteEndX,
      PREVIEW_Y,
      PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_HEIGHT,
    );

    md.fillRect(
      vignetteStartX + PREVIEW_VIGNETTE_WIDTH, PREVIEW_Y,
      vignetteEndX - vignetteStartX - PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_VIGNETTE_HEIGHT,
    );

    md.fillRect(
      vignetteStartX + PREVIEW_VIGNETTE_WIDTH, PREVIEW_Y + PREVIEW_HEIGHT - PREVIEW_VIGNETTE_HEIGHT,
      vignetteEndX - vignetteStartX - PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_VIGNETTE_HEIGHT,
    );
  }

  const mouse = ch.mouse;

  if (mouse.left.wentUp) {
    ch.dragState = DragState.NONE;
  }

  if (mouse.left.wentDown) {
    if (pointInsideRect(
      mouse.x, mouse.y,
      vignetteStartX - 10,
      PREVIEW_Y,
      PREVIEW_VIGNETTE_WIDTH + 30,
      PREVIEW_HEIGHT,
    )) {
      ch.dragState = DragState.LEFT;
      ch.dragOffsetPercent = (mouse.x - PREVIEW_PADDING_X) / previewWidth - ch.targetPreviewStart;
    }
    if (pointInsideRect(
      mouse.x, mouse.y,
      vignetteEndX - 10,
      PREVIEW_Y,
      PREVIEW_VIGNETTE_WIDTH + 30,
      PREVIEW_HEIGHT,
    )) {
      ch.dragState = DragState.RIGHT;
      ch.dragOffsetPercent = (mouse.x - PREVIEW_PADDING_X) / previewWidth - ch.targetPreviewEnd;
    }
    if (pointInsideRect(
      mouse.x, mouse.y,
      vignetteStartX + PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_Y,
      vignetteEndX - vignetteStartX - PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_HEIGHT,
    )) {
      ch.dragState = DragState.CENTER;
      ch.dragOffsetPercent = (mouse.x - PREVIEW_PADDING_X) / previewWidth - ((ch.targetPreviewEnd - ch.targetPreviewStart) / 2 + ch.targetPreviewStart);
    }
  }

  const MARK_ALPHA_SPEED = 0.1;

  if (ch.dragState === DragState.NONE && mouse.left.isDown) {
    if (pointInsideRect(
      mouse.x, mouse.y,
      0, 0, middleCanvas.width, PREVIEW_Y,
    )) {
      const startIndexFloat = (ch.count - 1) * ch.targetPreviewStart;
      const endIndexFloat = (ch.count - 1) * ch.targetPreviewEnd;

      const mouseChartX = mouse.x;
      const chartWidth = middleCanvas.width;
      const mouseChartRatioX = mouseChartX / chartWidth;
      const lerped = Math.round(lerp(startIndexFloat, endIndexFloat, mouseChartRatioX));
      ch.markIndex = Math.round(lerped);

      setAnimationTimer(ch, RedrawablePart.MARK);
      if (ch.markAlpha < 1) ch.markAlpha += MARK_ALPHA_SPEED;
    }
  } else {
    if (ch.markAlpha >= MARK_ALPHA_SPEED) ch.markAlpha -= MARK_ALPHA_SPEED;
    else ch.markAlpha = 0;
  }

  if (ch.dragState === DragState.LEFT) {
    ch.targetPreviewStart = (mouse.x - PREVIEW_PADDING_X) / previewWidth - ch.dragOffsetPercent;
    ch.targetPreviewStart = Math.min(ch.targetPreviewEnd - PREVIEW_MIN_DISTANCE, Math.max(0, ch.targetPreviewStart));
    setAnimationTimer(ch, RedrawablePart.MAIN_CHART);
  } else if (ch.dragState === DragState.RIGHT) {
    ch.targetPreviewEnd = (mouse.x - PREVIEW_PADDING_X) / previewWidth - ch.dragOffsetPercent;
    ch.targetPreviewEnd = Math.min(1, Math.max(ch.targetPreviewStart + PREVIEW_MIN_DISTANCE, ch.targetPreviewEnd));
    setAnimationTimer(ch, RedrawablePart.MAIN_CHART);
  } else if (ch.dragState === DragState.CENTER) {
    const previewDist = ch.targetPreviewEnd - ch.targetPreviewStart;
    let newP = (mouse.x - PREVIEW_PADDING_X) / previewWidth - ch.dragOffsetPercent;
    newP = Math.min(Math.max(previewDist * 0.5, newP), 1 - previewDist * 0.5);

    ch.targetPreviewStart = newP - previewDist * 0.5;
    ch.targetPreviewEnd = ch.targetPreviewStart + previewDist;
    setAnimationTimer(ch, RedrawablePart.MAIN_CHART);
  }


  const BUTTON_Y = PREVIEW_Y + PREVIEW_HEIGHT + 30;

  if (shouldRedraw(ch, RedrawablePart.BUTTONS)) {
    md.clearRect(0, BUTTON_Y, middleCanvas.width, middleCanvas.height - BUTTON_Y);
  }
  for (let lineIndex = 0; lineIndex < ch.y.length; lineIndex++) {
    const BUTTON_WIDTH = 125;
    const BUTTON_X = PREVIEW_PADDING_X + lineIndex * (BUTTON_WIDTH + 30);
    const BUTTON_HEIGHT = 70;
    const BUTTON_PADDING = 10;
    const CIRCLE_RADIUS = (BUTTON_HEIGHT - BUTTON_PADDING * 2) / 2;
    const CIRCLE_CENTER_X = BUTTON_X + CIRCLE_RADIUS + BUTTON_PADDING;
    const CIRCLE_CENTER_Y = BUTTON_Y + CIRCLE_RADIUS + BUTTON_PADDING;

    if (shouldRedraw(ch, RedrawablePart.BUTTONS)) {
      setStroke(md, BUTTON_BORDER_COLOR);

      md.beginPath();
      md.lineWidth = 2;
      roundedRect(md, BUTTON_X, BUTTON_Y, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_HEIGHT / 2);
      md.stroke();

      md.beginPath();
      md.arc(CIRCLE_CENTER_X, CIRCLE_CENTER_Y, CIRCLE_RADIUS, 0, Math.PI * 2);
      md.fillStyle = ch.color[lineIndex];
      md.fill();

      md.save();

      const CHECK_SHORT_WIDTH = 18;
      const CHECK_LONG_WIDTH = 30;
      const CHECK_HEIGHT = 8;
      const CHECK_CENTER_X = CIRCLE_CENTER_X - 5;
      const CHECK_CENTER_Y = CIRCLE_CENTER_Y + 10;

      const WHITE_CIRCLE_DIFF = 4;

      const buttonProgress = ch.buttonProgress[lineIndex];
      md.beginPath();
      md.arc(CIRCLE_CENTER_X, CIRCLE_CENTER_Y, (CIRCLE_RADIUS - WHITE_CIRCLE_DIFF) * buttonProgress, 0, Math.PI * 2);
      setFill(md, BACKGROUND_COLOR);
      md.fill();

      md.beginPath();
      if (buttonProgress !== 1) {
        md.translate(CHECK_CENTER_X, CHECK_CENTER_Y);
        md.rotate(-Math.PI * 0.25);
        roundedRect(md, -CHECK_HEIGHT * 0.5, -CHECK_HEIGHT * 0.5, CHECK_LONG_WIDTH * (1 - buttonProgress), CHECK_HEIGHT, CHECK_HEIGHT / 2);

        md.rotate(-Math.PI * 0.5);
        roundedRect(md, -CHECK_HEIGHT * 0.5, -CHECK_HEIGHT * 0.5, CHECK_SHORT_WIDTH * (1 - buttonProgress), CHECK_HEIGHT, CHECK_HEIGHT / 2);
      }
      md.fillStyle = '#fff';
      md.fill();
      md.restore();

      const TEXT_PADDING_LEFT = 10;
      setFill(md, BUTTON_TEXT_COLOR);
      md.textBaseline = 'middle';
      md.font = '27px Verdana, sans-serif'
      md.fillText(ch.labels[lineIndex], CIRCLE_CENTER_X + CIRCLE_RADIUS + TEXT_PADDING_LEFT, BUTTON_Y + BUTTON_HEIGHT * 0.5);

      let change = -0.1;
      if (!ch.enabled[lineIndex]) {
        change *= -1;
      }
      ch.buttonProgress[lineIndex] = constrain(ch.buttonProgress[lineIndex] + change, 0, 1);
    }

    if (mouse.left.wentDown && pointInsideRect(
      mouse.x, mouse.y,
      BUTTON_X, BUTTON_Y, BUTTON_WIDTH, BUTTON_HEIGHT,
    )) {
      let enabledCount = 0;
      for (let i = 0; i < ch.enabled.length; i++) {
        if (ch.enabled[i]) {
          enabledCount++;
        }
      }

      if (enabledCount > 1 || !ch.enabled[lineIndex]) {
        setAnimationTimer(ch, RedrawablePart.PREVIEW);
        setAnimationTimer(ch, RedrawablePart.MAIN_CHART);
        setAnimationTimer(ch, RedrawablePart.BUTTONS);
        ch.enabled[lineIndex] = !ch.enabled[lineIndex];
      }
    }
  }

  globalFrameIndex++;
  mouse.left.wentDown = false;
  mouse.left.wentUp = false;

  requestAnimationFrame(() => loop(ch));
}


let globalCharts: ChartData[] = [];

for (let i = 0; i < 5; i++) {
  const ch = loadChart(data, i);
  globalCharts.push(ch);
  requestAnimationFrame(() => loop(ch));
}
