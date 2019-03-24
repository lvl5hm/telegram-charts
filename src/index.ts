import * as data from './data.json';

const DAY_MODE_TEXT = 'Switch to Night Mode';
const NIGHT_MODE_TEXT = 'Switch to Day Mode';

const themeChangeButton = document.createElement('button');
themeChangeButton.innerHTML = DAY_MODE_TEXT;
themeChangeButton.className = 'themeButton';

themeChangeButton.onclick = () => {
  if (targetTheme === Theme.LIGHT) {
    targetTheme = Theme.DARK;
    themeChangeButton.innerHTML = NIGHT_MODE_TEXT;
  } else {
    targetTheme = Theme.LIGHT;
    themeChangeButton.innerHTML = DAY_MODE_TEXT;
  }
}

document.body.appendChild(themeChangeButton);


let canvas: HTMLCanvasElement = null;

type Color = {
  r: number;
  g: number;
  b: number;
  a: number;
}

enum ColorId {
  LEGEND_TEXT,
}

enum Theme {
  LIGHT,
  DARK,
}

type ThemedColor = {
  light: Color;
  dark: Color;
}

let targetTheme: Theme = Theme.LIGHT;
let currentTheme: number = Theme.LIGHT;
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

function setStroke(col: ColorId) {
  ctx.strokeStyle = getLerpedColor(col);
}

function setFill(col: ColorId) {
  ctx.fillStyle = getLerpedColor(col);
}

function roundedRect(x: number, y: number, width: number, height: number, radius: number) {
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

function createCanvas(ch: ChartData) {
  if (canvas) {
    canvas.parentElement.removeChild(canvas);
  }

  canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  canvas.style.width = '100%';
  canvas.style.height = '1500px';
  handleResize();

  canvas.ontouchmove = e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.touches[0].clientX - rect.left;
    mouse.y = e.touches[0].clientY - rect.top;
  }
  canvas.ontouchstart = e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.touches[0].clientX - rect.left;
    mouse.y = e.touches[0].clientY - rect.top;
    if (!mouse.left.isDown) {
      mouse.left.wentDown = true;
    }
    mouse.left.isDown = true;
  }
  canvas.ontouchend = e => {
    if (mouse.left.isDown) {
      mouse.left.wentUp = true;
    }
    mouse.left.isDown = false;
  }
  canvas.onmousedown = e => {
    if (e.button === 0) {
      if (!mouse.left.isDown) {
        mouse.left.wentUp = true;
      }
      mouse.left.isDown = true;
    }
  }
  canvas.onmouseup = e => {
    if (e.button === 0) {
      if (mouse.left.isDown) {
        mouse.left.wentUp = true;
      }
      mouse.left.isDown = false;
    }
  }
  canvas.onmousemove = e => {
    mouse.x = e.clientX - canvas.clientLeft;
    mouse.y = e.clientY - canvas.clientTop;
  }

  ctx = canvas.getContext('2d');

  handleResize();
}


function handleResize() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

window.onresize = handleResize;


let ctx: CanvasRenderingContext2D;

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

function drawChartLines(targetMaxY: number, currentMaxY: number, height: number, alpha: number = 1) {
  const step = getStep(targetMaxY);
  ctx.save();
  ctx.beginPath();
  setStroke(HORIZONTAL_LINE_COLOR);
  ctx.lineWidth = 2;
  ctx.globalAlpha = alpha;
  for (let lineIndex = 0; lineIndex < LINE_COUNT; lineIndex++) {
    const lineValue = lineIndex * step;

    const lineY = height - lineValue / currentMaxY * height;
    ctx.moveTo(PREVIEW_PADDING_X, lineY);
    ctx.lineTo(canvas.width - PREVIEW_PADDING_X, lineY);

    setFill(TEXT_COLOR);

    const lineText = getTextFromY(lineValue);
    ctx.fillText(lineText, PREVIEW_PADDING_X, lineY - 20);
  }
  ctx.stroke();
  ctx.restore();
}

function peek<T>(arr: T[]) {
  return arr[arr.length - 1];
}

let globalFramesWithSameTargetCounter = 0;

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function constrain(a: number, min: number, max: number) {
  const result = Math.max(Math.min(a, max), min);
  return result;
}


function drawChart(
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
    beginTimer('vert_lines')
    firstLine.alpha = Math.min(firstLine.alpha + ALPHA_CHANGE_RATE, 1);
    drawChartLines(firstLine.target * ch.maxY, anim.current * ch.maxY, chartHeight, firstLine.alpha);

    for (let animIndex = 1; animIndex < anim.vertLines.length; animIndex++) {
      const line = anim.vertLines[animIndex];
      line.alpha -= ALPHA_CHANGE_RATE;
      if (line.alpha <= ALPHA_CHANGE_RATE) {
        anim.vertLines.splice(animIndex, 1);
      }
      drawChartLines(line.target * ch.maxY, anim.current * ch.maxY, chartHeight, line.alpha);
    }
    endTimer('vert_lines')


    {
      beginTimer('hor_lines')

      const xsOnScreen = endIndex - startIndex;
      const desiredInterval = xsOnScreen / 7;
      const pow2 = Math.max(Math.ceil(Math.log2(desiredInterval)), 0);
      const incr = 2 ** pow2;


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
          setFill(TEXT_COLOR);
          const date = new Date(ch.x[xIndex] / DIVIDE_X_BY);
          const text = `${MONTHS[date.getMonth()]} ${date.getUTCDate()}`;

          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(text, getCx(ch.x[xIndex], startX, endX, chartWidth), MAIN_CHART_HEIGHT + 10);
        }
        ctx.restore();
      }

      anim.oldPow2 = pow2;

      endTimer('hor_lines')
    }
  }

  if (drawLines) {
    beginTimer('graph')
  } else {
    beginTimer('preview_graph')
  }
  for (let lineIndex = 0; lineIndex < ch.y.length; lineIndex++) {
    const enabled = ch.enabled[lineIndex];
    if (enabled) {
      ch.alpha[lineIndex] = constrain(ch.alpha[lineIndex] + 0.03, 0, 1);
    } else {
      ch.alpha[lineIndex] = constrain(ch.alpha[lineIndex] - 0.03, 0, 1);
    }
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
  if (drawLines) {
    endTimer('graph')
  } else {
    endTimer('preview_graph')
  }

  if (drawLines) {
    beginTimer('mark')

    if (markAlpha > 0) {
      const markScreenX = getCx(ch.x[markIndex], startX, endX, chartWidth) + pX;

      ctx.save();
      ctx.globalAlpha = markAlpha;
      ctx.beginPath();
      ctx.lineWidth = 3;
      setStroke(VERTICAL_LINE_COLOR);
      ctx.moveTo(markScreenX, pY);
      ctx.lineTo(markScreenX, chartHeight);
      ctx.stroke();


      for (let lineIndex = 0; lineIndex < ch.y.length; lineIndex++) {
        const y = ch.y[lineIndex];

        const markScreenY = getCy(y[markIndex], maxY, chartHeight) + pY;
        ctx.beginPath();

        setFill(BACKGROUND_COLOR);
        ctx.strokeStyle = ch.color[lineIndex];
        ctx.lineWidth = 3;
        ctx.arc(markScreenX, markScreenY, 10, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

      const TEXT_WIDTH = 130;
      const RECT_PADDING = 15;

      ctx.beginPath();
      setStroke(VERTICAL_LINE_COLOR);
      const rectWidth = TEXT_WIDTH * ch.y.length + RECT_PADDING * 2;
      const rectX = Math.min(Math.max(markScreenX - 70, 0), chartWidth - rectWidth);
      const rectY = pY;

      // {
      //   ctx.save()
      //   const shadow = ctx.createLinearGradient(0, 0, 0, 50);
      //   shadow.addColorStop(0, 'black');
      //   shadow.addColorStop(1, 'white');

      //   ctx.fillStyle = shadow;
      //   ctx.fillRect(rectX, rectY + 140, rectWidth, 50);
      //   ctx.restore();
      // }

      roundedRect(rectX, rectY, rectWidth, 130, 10);
      ctx.stroke();
      setFill(BACKGROUND_COLOR);
      ctx.fill();
      ctx.textBaseline = 'top';

      setFill(BUTTON_TEXT_COLOR)
      const date = new Date(ch.x[markIndex] / DIVIDE_X_BY);
      const text = `${WEEK_DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getUTCDate()}`
      ctx.fillText(text, rectX + RECT_PADDING, rectY + RECT_PADDING);

      for (let lineIndex = 0; lineIndex < ch.y.length; lineIndex++) {
        ctx.font = 'bold 30px Verdana, sans-serif';
        ctx.fillStyle = ch.color[lineIndex];
        const text = getTextFromY(ch.y[lineIndex][markIndex]);
        const lineX = rectX + RECT_PADDING + TEXT_WIDTH * lineIndex;
        const lineY = rectY + 60;
        ctx.fillText(text, lineX, lineY);

        ctx.font = '23px Verdana, sans-serif';
        ctx.fillText(ch.labels[lineIndex], lineX, lineY + 40);
      }
      ctx.restore();
    }
    endTimer('mark')
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
    globalFramesWithSameTargetCounter++;
  } else {
    anim.target = newTarget;
    anim.changeRate = (newTarget - anim.current) / 10;
    globalFramesWithSameTargetCounter = 0;
  }


  if (anim.target !== firstLine.target) {
    const shouldAddLine = (globalFrameIndex % 10 === 0 ||
      mouse.left.wentUp ||
      globalFramesWithSameTargetCounter > 5);

    if (shouldAddLine && getStep(ch.maxY * newTarget) !== getStep(ch.maxY * firstLine.target)) {
      anim.vertLines.unshift({
        target: anim.target,
        alpha: 0,
      });
    }
  }
}

const DIVIDE_X_BY = 0.00001;

function loadChart(data: any, index: number) {
  const chart = data[index];
  const pointCount = chart.columns[0].length - 1;

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
  };

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


const PREVIEW_PADDING_Y = 30;
const PREVIEW_PADDING_X = 20;
const PREVIEW_VIGNETTE_WIDTH = 10;
const PREVIEW_VIGNETTE_HEIGHT = 2;
const MAIN_CHART_HEIGHT = 800;
const PREVIEW_Y = 880;
const PREVIEW_HEIGHT = 100;

function getPreviewWidth() {
  const result = canvas.width - PREVIEW_PADDING_X * 2;
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

const mouse: Mouse = {
  left: {
    isDown: false,
    wentDown: false,
    wentUp: false,
  },
  x: 0,
  y: 0,
};

function pointInsideRect(x: number, y: number, rX: number, rY: number, rWidth: number, rHeight: number) {
  const result = x > rX &&
    x < rX + rWidth &&
    y > rY &&
    y < rY + rHeight;
  return result;
}

enum DragState {
  NONE,
  LEFT,
  RIGHT,
  CENTER,
}

let dragState = DragState.NONE;
let dragOffsetPercent = 0;

const PREVIEW_MIN_DISTANCE = 0.1;
let previewStart = 0;
let previewEnd = 0;

let targetPreviewStart = 0;
let targetPreviewEnd = targetPreviewStart + PREVIEW_MIN_DISTANCE;



const ch0 = loadChart(data, 0);

createCanvas(ch0);


const mainChartAnim: AnimationState = {
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
};


const previewChangeRate: AnimationState = {
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
};


const LINE_COUNT = 6;

type Timer = {
  totalTime: number;
  count: number;
  lastTime: number;
}

const timers: { [s: string]: Timer } = {};


const enabledTimers: { [s: string]: boolean } = {
  loop: true,
  // preview: true,
  // preview_graph: true,
};


function beginTimer(name: string) {
  if (!timers[name]) {
    timers[name] = {
      totalTime: 0,
      count: 0,
      lastTime: 0,
    }
  }
  const t = timers[name];
  t.lastTime = performance.now();
}

const LOGGING_ENABLED = true;
function endTimer(name: string) {
  const t = timers[name];
  t.count++;
  t.totalTime += performance.now() - t.lastTime;

  if (t.count === 60) {
    if (LOGGING_ENABLED && enabledTimers[name]) {
      console.log(name, '-', (t.totalTime / t.count).toFixed(3));
    }
    t.count = 0;
    t.totalTime = 0;
  }
}

let globalFrameIndex = 0;

let markIndex = 0;
let markAlpha = 0;


function loop() {
  beginTimer('loop');

  currentTheme = constrain(currentTheme + Math.sign(targetTheme - currentTheme) * 0.1, 0, 1);

  ctx.font = '30px Verdana, sans-serif';

  previewStart += (targetPreviewStart - previewStart) / 4;
  previewEnd += (targetPreviewEnd - previewEnd) / 4;

  setFill(BACKGROUND_COLOR);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  beginTimer('main_chart');
  drawChart(ch0, 0, 20, canvas.width, MAIN_CHART_HEIGHT, previewStart, previewEnd, mainChartAnim, true);
  endTimer('main_chart');


  beginTimer('preview');
  const previewWidth = getPreviewWidth();
  const vignettePreviewWidth = previewWidth - PREVIEW_VIGNETTE_WIDTH;
  const vignetteStartX = PREVIEW_PADDING_X + targetPreviewStart * vignettePreviewWidth;
  const vignetteEndX = PREVIEW_PADDING_X + targetPreviewEnd * vignettePreviewWidth;

  drawChart(ch0, PREVIEW_PADDING_X, PREVIEW_Y, previewWidth, PREVIEW_HEIGHT, 0, 1, previewChangeRate, false);
  setFill(PREVIEW_BACKGROUND_COLOR);

  ctx.fillRect(PREVIEW_PADDING_X, PREVIEW_Y, vignetteStartX - PREVIEW_PADDING_X, PREVIEW_HEIGHT);
  ctx.fillRect(vignetteEndX + PREVIEW_VIGNETTE_WIDTH, PREVIEW_Y, PREVIEW_PADDING_X + previewWidth - vignetteEndX - PREVIEW_VIGNETTE_WIDTH, PREVIEW_HEIGHT);





  if (mouse.left.wentDown) {
    if (pointInsideRect(
      mouse.x, mouse.y,
      vignetteStartX,
      PREVIEW_Y,
      PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_HEIGHT,
    )) {
      dragState = DragState.LEFT;
      dragOffsetPercent = (mouse.x - PREVIEW_PADDING_X) / previewWidth - targetPreviewStart;
    } else if (pointInsideRect(
      mouse.x, mouse.y,
      vignetteEndX,
      PREVIEW_Y,
      PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_HEIGHT,
    )) {
      dragState = DragState.RIGHT;
      dragOffsetPercent = (mouse.x - PREVIEW_PADDING_X) / previewWidth - targetPreviewEnd;
    } else if (pointInsideRect(
      mouse.x, mouse.y,
      vignetteStartX + PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_Y,
      vignetteEndX - vignetteStartX - PREVIEW_VIGNETTE_WIDTH,
      PREVIEW_HEIGHT,
    )) {
      dragState = DragState.CENTER;
      dragOffsetPercent = (mouse.x - PREVIEW_PADDING_X) / previewWidth - ((targetPreviewEnd - targetPreviewStart) / 2 + targetPreviewStart);
    }
  }


  const MARK_ALPHA_SPEED = 0.1;

  if (dragState === DragState.NONE && mouse.left.isDown) {
    if (pointInsideRect(
      mouse.x, mouse.y,
      0, 0, canvas.width, PREVIEW_Y,
    )) {
      const startIndexFloat = (ch0.count - 1) * targetPreviewStart;
      const endIndexFloat = (ch0.count - 1) * targetPreviewEnd;

      const mouseChartX = mouse.x;
      const chartWidth = canvas.width;
      const mouseChartRatioX = mouseChartX / chartWidth;
      const lerped = Math.round(lerp(startIndexFloat, endIndexFloat, mouseChartRatioX));
      markIndex = Math.round(lerped);

      if (markAlpha < 1)
        markAlpha += MARK_ALPHA_SPEED;
    }
  } else {
    if (markAlpha >= MARK_ALPHA_SPEED)
      markAlpha -= MARK_ALPHA_SPEED;
    else
      markAlpha = 0;
  }

  if (mouse.left.wentUp) {
    dragState = DragState.NONE;
  }


  if (dragState === DragState.LEFT) {
    targetPreviewStart = (mouse.x - PREVIEW_PADDING_X) / previewWidth - dragOffsetPercent;
    targetPreviewStart = Math.min(targetPreviewEnd - PREVIEW_MIN_DISTANCE, Math.max(0, targetPreviewStart));
  } else if (dragState === DragState.RIGHT) {
    targetPreviewEnd = (mouse.x - PREVIEW_PADDING_X) / previewWidth - dragOffsetPercent;
    targetPreviewEnd = Math.min(1, Math.max(targetPreviewStart + PREVIEW_MIN_DISTANCE, targetPreviewEnd));
  } else if (dragState === DragState.CENTER) {
    const previewDist = targetPreviewEnd - targetPreviewStart;
    let newP = (mouse.x - PREVIEW_PADDING_X) / previewWidth - dragOffsetPercent;
    newP = Math.min(Math.max(previewDist * 0.5, newP), 1 - previewDist * 0.5);

    targetPreviewStart = newP - previewDist * 0.5;
    targetPreviewEnd = targetPreviewStart + previewDist;
  }


  setFill(VIGNETTE_COLOR);

  ctx.fillRect(
    vignetteStartX,
    PREVIEW_Y,
    PREVIEW_VIGNETTE_WIDTH,
    PREVIEW_HEIGHT,
  );

  ctx.fillRect(
    vignetteEndX,
    PREVIEW_Y,
    PREVIEW_VIGNETTE_WIDTH,
    PREVIEW_HEIGHT,
  );

  ctx.fillRect(
    vignetteStartX + PREVIEW_VIGNETTE_WIDTH, PREVIEW_Y,
    vignetteEndX - vignetteStartX - PREVIEW_VIGNETTE_WIDTH,
    PREVIEW_VIGNETTE_HEIGHT,
  );

  ctx.fillRect(
    vignetteStartX + PREVIEW_VIGNETTE_WIDTH, PREVIEW_Y + PREVIEW_HEIGHT - PREVIEW_VIGNETTE_HEIGHT,
    vignetteEndX - vignetteStartX - PREVIEW_VIGNETTE_WIDTH,
    PREVIEW_VIGNETTE_HEIGHT,
  );

  endTimer('preview');



  for (let lineIndex = 0; lineIndex < ch0.y.length; lineIndex++) {
    setStroke(BUTTON_BORDER_COLOR);
    const BUTTON_WIDTH = 175;
    const BUTTON_X = PREVIEW_PADDING_X + lineIndex * (BUTTON_WIDTH + 30);
    const BUTTON_Y = PREVIEW_Y + PREVIEW_HEIGHT + 30;
    const BUTTON_HEIGHT = 100;
    const BUTTON_PADDING = 20;
    const CIRCLE_RADIUS = (BUTTON_HEIGHT - BUTTON_PADDING * 2) / 2;
    const CIRCLE_CENTER_X = BUTTON_X + CIRCLE_RADIUS + BUTTON_PADDING;
    const CIRCLE_CENTER_Y = BUTTON_Y + CIRCLE_RADIUS + BUTTON_PADDING;

    ctx.beginPath();
    ctx.lineWidth = 2;
    roundedRect(BUTTON_X, BUTTON_Y, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_HEIGHT / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CIRCLE_CENTER_X, CIRCLE_CENTER_Y, CIRCLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = ch0.color[lineIndex];
    ctx.fill();

    ctx.save();

    const CHECK_SHORT_WIDTH = 20;
    const CHECK_LONG_WIDTH = 35;
    const CHECK_HEIGHT = 8;
    const CHECK_CENTER_X = CIRCLE_CENTER_X - 5;
    const CHECK_CENTER_Y = CIRCLE_CENTER_Y + 10;

    const WHITE_CIRCLE_DIFF = 4;

    const buttonProgress = ch0.buttonProgress[lineIndex];
    ctx.beginPath();
    ctx.arc(CIRCLE_CENTER_X, CIRCLE_CENTER_Y, (CIRCLE_RADIUS - WHITE_CIRCLE_DIFF) * buttonProgress, 0, Math.PI * 2);
    setFill(BACKGROUND_COLOR);
    ctx.fill();

    ctx.beginPath();
    if (buttonProgress !== 1) {
      ctx.translate(CHECK_CENTER_X, CHECK_CENTER_Y);
      ctx.rotate(-Math.PI * 0.25);
      roundedRect(-CHECK_HEIGHT * 0.5, -CHECK_HEIGHT * 0.5, CHECK_LONG_WIDTH * (1 - buttonProgress), CHECK_HEIGHT, CHECK_HEIGHT / 2);

      ctx.rotate(-Math.PI * 0.5);
      roundedRect(-CHECK_HEIGHT * 0.5, -CHECK_HEIGHT * 0.5, CHECK_SHORT_WIDTH * (1 - buttonProgress), CHECK_HEIGHT, CHECK_HEIGHT / 2);
    }
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();

    const TEXT_PADDING_LEFT = 15;
    setFill(BUTTON_TEXT_COLOR);
    ctx.textBaseline = 'middle';
    ctx.font = '35px Verdana, sans-serif'
    ctx.fillText(ch0.labels[lineIndex], CIRCLE_CENTER_X + CIRCLE_RADIUS + TEXT_PADDING_LEFT, BUTTON_Y + BUTTON_HEIGHT * 0.5);

    if (mouse.left.wentDown && pointInsideRect(
      mouse.x, mouse.y,
      BUTTON_X, BUTTON_Y, BUTTON_WIDTH, BUTTON_HEIGHT,
    )) {
      ch0.enabled[lineIndex] = !ch0.enabled[lineIndex];
    }

    let change = -0.1;
    if (!ch0.enabled[lineIndex]) {
      change *= -1;
    }
    ch0.buttonProgress[lineIndex] = constrain(ch0.buttonProgress[lineIndex] + change, 0, 1);
  }


  mouse.left.wentDown = false;
  mouse.left.wentUp = false;


  globalFrameIndex++;
  endTimer('loop');

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);