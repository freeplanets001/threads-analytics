'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
  onClose: () => void;
}

// ====== 定数定義 ======

// フィルター（拡張版）
const FILTERS = [
  { id: 'none', name: 'オリジナル', filter: '', icon: '🔄' },
  { id: 'vivid', name: 'ビビッド', filter: 'saturate(140%) contrast(110%)', icon: '🌈' },
  { id: 'warm', name: '暖色', filter: 'sepia(20%) saturate(140%) hue-rotate(-10deg)', icon: '🔥' },
  { id: 'cool', name: '寒色', filter: 'saturate(90%) hue-rotate(20deg) brightness(105%)', icon: '❄️' },
  { id: 'vintage', name: 'ヴィンテージ', filter: 'sepia(40%) contrast(90%) brightness(95%)', icon: '📻' },
  { id: 'dramatic', name: 'ドラマティック', filter: 'contrast(130%) saturate(120%) brightness(90%)', icon: '🎭' },
  { id: 'fade', name: 'フェード', filter: 'saturate(80%) contrast(90%) brightness(110%)', icon: '🌫️' },
  { id: 'bw', name: 'モノクロ', filter: 'grayscale(100%)', icon: '⬛' },
  { id: 'bw-contrast', name: 'ハイコントラストBW', filter: 'grayscale(100%) contrast(140%)', icon: '🔲' },
  { id: 'sepia', name: 'セピア', filter: 'sepia(100%)', icon: '🟤' },
  { id: 'cyberpunk', name: 'サイバーパンク', filter: 'saturate(180%) hue-rotate(300deg) contrast(110%)', icon: '💜' },
  { id: 'sunset', name: 'サンセット', filter: 'sepia(30%) saturate(150%) hue-rotate(-20deg)', icon: '🌅' },
];

// フォント
const FONTS = [
  { id: 'noto', name: 'Noto Sans JP', value: '"Noto Sans JP", sans-serif' },
  { id: 'gothic', name: 'ゴシック', value: '"Hiragino Kaku Gothic Pro", "Yu Gothic", sans-serif' },
  { id: 'mincho', name: '明朝', value: '"Hiragino Mincho Pro", "Yu Mincho", serif' },
  { id: 'rounded', name: '丸ゴシック', value: '"Hiragino Maru Gothic Pro", sans-serif' },
  { id: 'impact', name: 'Impact', value: 'Impact, sans-serif' },
  { id: 'comic', name: 'Comic', value: '"Comic Sans MS", cursive' },
];

// テキストスタイル
const TEXT_PRESETS = [
  { id: 'simple', name: 'シンプル', shadow: false, outline: false, gradient: false },
  { id: 'shadow', name: '影付き', shadow: true, outline: false, gradient: false },
  { id: 'outline', name: '縁取り', shadow: false, outline: true, gradient: false },
  { id: 'both', name: '影+縁', shadow: true, outline: true, gradient: false },
  { id: 'neon', name: 'ネオン', shadow: true, outline: true, gradient: false, neon: true },
];

// ステッカー（カテゴリ別）
const STICKER_CATEGORIES = [
  { name: '人気', emojis: ['✨', '🔥', '💯', '❤️', '👍', '🎉', '⭐', '💪', '🚀', '💡'] },
  { name: '顔', emojis: ['😀', '😍', '🥺', '😎', '🤔', '😱', '🥳', '😤', '🤯', '🫡'] },
  { name: 'ハート', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💝'] },
  { name: '記号', emojis: ['✅', '❌', '⭕', '❗', '❓', '💬', '📌', '🎯', '⚡', '🏆'] },
  { name: '矢印', emojis: ['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '🔄', '↩️'] },
  { name: '自然', emojis: ['🌸', '🌺', '🍀', '🌈', '☀️', '🌙', '⭐', '🌊', '🔥', '❄️'] },
];

// アニメーションキーフレーム型
interface AnimKeyframe {
  x?: number;
  y?: number;
  s?: number;
  r?: number;
  o?: number;
  sx?: number;
  sy?: number;
}

interface Animation {
  id: string;
  name: string;
  icon: string;
  keyframes?: AnimKeyframe[];
  dur?: number;
}

// アニメーション（拡張版）
const ANIMATIONS: Animation[] = [
  { id: 'none', name: 'なし', icon: '⏹️' },
  { id: 'pulse', name: 'パルス', icon: '💓', keyframes: [{ s: 1 }, { s: 1.1 }, { s: 1 }], dur: 800 },
  { id: 'bounce', name: 'バウンス', icon: '⬆️', keyframes: [{ y: 0 }, { y: -25 }, { y: 0 }], dur: 600 },
  { id: 'shake', name: 'シェイク', icon: '📳', keyframes: [{ x: 0 }, { x: -8 }, { x: 8 }, { x: -8 }, { x: 0 }], dur: 400 },
  { id: 'spin', name: '回転', icon: '🔄', keyframes: [{ r: 0 }, { r: 360 }], dur: 1500 },
  { id: 'fadeIn', name: 'フェードイン', icon: '👁️', keyframes: [{ o: 0 }, { o: 1 }], dur: 1000 },
  { id: 'slideLeft', name: 'スライド左', icon: '⬅️', keyframes: [{ x: -80, o: 0 }, { x: 0, o: 1 }], dur: 600 },
  { id: 'slideRight', name: 'スライド右', icon: '➡️', keyframes: [{ x: 80, o: 0 }, { x: 0, o: 1 }], dur: 600 },
  { id: 'slideUp', name: 'スライド上', icon: '⬆️', keyframes: [{ y: 60, o: 0 }, { y: 0, o: 1 }], dur: 600 },
  { id: 'zoom', name: 'ズームイン', icon: '🔍', keyframes: [{ s: 0.3, o: 0 }, { s: 1, o: 1 }], dur: 700 },
  { id: 'flip', name: 'フリップ', icon: '🔃', keyframes: [{ sx: 0 }, { sx: 1 }], dur: 600 },
  { id: 'swing', name: 'スイング', icon: '🎵', keyframes: [{ r: 0 }, { r: 15 }, { r: -15 }, { r: 10 }, { r: 0 }], dur: 1000 },
  { id: 'rubberBand', name: 'ラバーバンド', icon: '🎈', keyframes: [{ sx: 1, sy: 1 }, { sx: 1.25, sy: 0.75 }, { sx: 0.75, sy: 1.25 }, { sx: 1.15, sy: 0.85 }, { sx: 1, sy: 1 }], dur: 800 },
  { id: 'tada', name: 'タダ', icon: '🎉', keyframes: [{ s: 1, r: 0 }, { s: 0.9, r: -3 }, { s: 1.1, r: 3 }, { s: 1.1, r: -3 }, { s: 1, r: 0 }], dur: 1000 },
  { id: 'heartbeat', name: 'ハートビート', icon: '💗', keyframes: [{ s: 1 }, { s: 1.3 }, { s: 1 }, { s: 1.3 }, { s: 1 }], dur: 1200 },
  { id: 'float', name: 'フロート', icon: '🎈', keyframes: [{ y: 0 }, { y: -15 }, { y: 0 }, { y: -10 }, { y: 0 }], dur: 2000 },
];

// イージング関数
const EASINGS = {
  linear: (t: number) => t,
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  bounce: (t: number) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// ====== 型定義 ======
interface Layer {
  id: string;
  type: 'text' | 'sticker' | 'shape' | 'image';
  x: number;
  y: number;
  rotation: number;
  scale: number;
  opacity: number;
  animation: string;
  locked: boolean;
  visible: boolean;
}

interface TextLayer extends Layer {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight: string;
  shadow: boolean;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  neon: boolean;
}

interface StickerLayer extends Layer {
  type: 'sticker';
  emoji: string;
  size: number;
}

interface ShapeLayer extends Layer {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'triangle' | 'star' | 'arrow' | 'line' | 'speech';
  width: number;
  height: number;
  color: string;
  fill: boolean;
  strokeWidth: number;
}

type AnyLayer = TextLayer | StickerLayer | ShapeLayer;

interface HistoryState {
  layers: AnyLayer[];
  filter: string;
  adjustments: typeof DEFAULT_ADJUSTMENTS;
  drawPaths: DrawPath[];
}

interface DrawPath {
  points: { x: number; y: number }[];
  color: string;
  size: number;
  tool: 'pen' | 'highlighter' | 'eraser';
}

const DEFAULT_ADJUSTMENTS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  vignette: 0,
  grain: 0,
};

// ====== メインコンポーネント ======
export function ImageEditor({ imageUrl, onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // タブ
  const [activeTab, setActiveTab] = useState<'filter' | 'adjust' | 'text' | 'sticker' | 'shape' | 'draw' | 'animate' | 'crop'>('filter');

  // フィルター・調整
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [adjustments, setAdjustments] = useState(DEFAULT_ADJUSTMENTS);

  // レイヤー
  const [layers, setLayers] = useState<AnyLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // 描画
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [drawTool, setDrawTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [drawSize, setDrawSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);

  // テキスト入力
  const [textInput, setTextInput] = useState('');
  const [textSettings, setTextSettings] = useState({
    fontSize: 48,
    fontFamily: FONTS[0].value,
    color: '#ffffff',
    fontWeight: 'bold',
    shadow: true,
    outline: true,
    outlineColor: '#000000',
    outlineWidth: 3,
    align: 'center' as const,
    letterSpacing: 0,
    neon: false,
  });

  // 図形設定
  const [shapeSettings, setShapeSettings] = useState({
    type: 'rect' as const,
    color: '#ff0000',
    fill: false,
    strokeWidth: 4,
  });

  // ドラッグ・リサイズ
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // アニメーション
  const [isAnimating, setIsAnimating] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const animRef = useRef<number | null>(null);

  // 履歴（Undo/Redo）
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 保存
  const [saving, setSaving] = useState(false);

  // クロップ
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // 画像読み込み
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      setCanvasSize({ width: img.width, height: img.height });
      setCropRect({ x: 0, y: 0, width: img.width, height: img.height });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // 履歴保存
  const saveHistory = useCallback(() => {
    const state: HistoryState = {
      layers: JSON.parse(JSON.stringify(layers)),
      filter: selectedFilter,
      adjustments: { ...adjustments },
      drawPaths: JSON.parse(JSON.stringify(drawPaths)),
    };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), state]);
    setHistoryIndex(prev => prev + 1);
  }, [layers, selectedFilter, adjustments, drawPaths, historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const state = history[historyIndex - 1];
      setLayers(state.layers);
      setSelectedFilter(state.filter);
      setAdjustments(state.adjustments);
      setDrawPaths(state.drawPaths);
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const state = history[historyIndex + 1];
      setLayers(state.layers);
      setSelectedFilter(state.filter);
      setAdjustments(state.adjustments);
      setDrawPaths(state.drawPaths);
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        }
        if (e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId && document.activeElement?.tagName !== 'INPUT') {
          deleteLayer(selectedLayerId);
        }
      }
      if (e.key === 'Escape') {
        setSelectedLayerId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedLayerId]);

  // アニメーション計算
  const getAnimTransform = useCallback((animId: string, frame: number) => {
    const anim = ANIMATIONS.find(a => a.id === animId);
    if (!anim || !anim.keyframes) return { x: 0, y: 0, s: 1, r: 0, o: 1, sx: 1, sy: 1 };

    const dur = anim.dur || 1000;
    const progress = ((frame * 16.67) % dur) / dur;
    const eased = EASINGS.easeInOut(progress);

    const kf = anim.keyframes;
    const idx = Math.floor(eased * (kf.length - 1));
    const next = Math.min(idx + 1, kf.length - 1);
    const local = (eased * (kf.length - 1)) - idx;

    const lerp = (a: number | undefined, b: number | undefined, def: number) => {
      const av = a ?? def, bv = b ?? def;
      return av + (bv - av) * local;
    };

    return {
      x: lerp(kf[idx].x, kf[next].x, 0),
      y: lerp(kf[idx].y, kf[next].y, 0),
      s: lerp(kf[idx].s, kf[next].s, 1),
      r: lerp(kf[idx].r, kf[next].r, 0),
      o: lerp(kf[idx].o, kf[next].o, 1),
      sx: lerp(kf[idx].sx, kf[next].sx, 1),
      sy: lerp(kf[idx].sy, kf[next].sy, 1),
    };
  }, []);

  // Canvas描画
  const render = useCallback((frame = 0) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // フィルター適用
    const filterVal = FILTERS.find(f => f.id === selectedFilter)?.filter || '';
    const adjFilter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) hue-rotate(${adjustments.hue}deg) blur(${adjustments.blur}px)`;
    ctx.filter = [filterVal, adjFilter].filter(Boolean).join(' ') || 'none';
    ctx.drawImage(image, 0, 0, canvasSize.width, canvasSize.height);
    ctx.filter = 'none';

    // ビネット効果
    if (adjustments.vignette > 0) {
      const gradient = ctx.createRadialGradient(
        canvasSize.width / 2, canvasSize.height / 2, canvasSize.width * 0.2,
        canvasSize.width / 2, canvasSize.height / 2, canvasSize.width * 0.7
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, `rgba(0,0,0,${adjustments.vignette / 100})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    }

    // グレイン効果
    if (adjustments.grain > 0) {
      const imageData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
      const data = imageData.data;
      const intensity = adjustments.grain * 2;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * intensity;
        data[i] += noise;
        data[i + 1] += noise;
        data[i + 2] += noise;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // 描画パス
    [...drawPaths, ...(currentPath.length > 1 ? [{ points: currentPath, color: drawColor, size: drawSize, tool: drawTool }] : [])].forEach(path => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (path.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else if (path.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = path.color + '80';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = path.color;
      }

      ctx.lineWidth = path.size;
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.forEach((p, i) => { if (i > 0) ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    });

    // レイヤー描画
    layers.filter(l => l.visible).forEach(layer => {
      const anim = getAnimTransform(layer.animation, frame);
      ctx.save();
      ctx.translate(layer.x, layer.y);
      ctx.rotate((layer.rotation + anim.r) * Math.PI / 180);
      ctx.scale(layer.scale * anim.s * anim.sx, layer.scale * anim.s * anim.sy);
      ctx.translate(anim.x, anim.y);
      ctx.globalAlpha = layer.opacity * anim.o;

      if (layer.type === 'text') {
        const t = layer as TextLayer;
        ctx.font = `${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
        ctx.textAlign = t.align;
        ctx.textBaseline = 'middle';

        // ネオン効果
        if (t.neon) {
          ctx.shadowColor = t.color;
          ctx.shadowBlur = 20;
          ctx.strokeStyle = t.color;
          ctx.lineWidth = 2;
          ctx.strokeText(t.text, 0, 0);
          ctx.shadowBlur = 40;
          ctx.strokeText(t.text, 0, 0);
        }

        // アウトライン
        if (t.outline) {
          ctx.strokeStyle = t.outlineColor;
          ctx.lineWidth = t.outlineWidth * 2;
          ctx.strokeText(t.text, 0, 0);
        }

        // シャドウ
        if (t.shadow && !t.neon) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
        }

        ctx.fillStyle = t.color;
        ctx.fillText(t.text, 0, 0);
        ctx.shadowColor = 'transparent';
      }

      if (layer.type === 'sticker') {
        const s = layer as StickerLayer;
        ctx.font = `${s.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.emoji, 0, 0);
      }

      if (layer.type === 'shape') {
        const sh = layer as ShapeLayer;
        ctx.strokeStyle = sh.color;
        ctx.fillStyle = sh.color;
        ctx.lineWidth = sh.strokeWidth;

        const w = sh.width / 2, h = sh.height / 2;
        ctx.beginPath();

        switch (sh.shapeType) {
          case 'rect':
            if (sh.fill) ctx.fillRect(-w, -h, sh.width, sh.height);
            else ctx.strokeRect(-w, -h, sh.width, sh.height);
            break;
          case 'circle':
            ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
            sh.fill ? ctx.fill() : ctx.stroke();
            break;
          case 'triangle':
            ctx.moveTo(0, -h);
            ctx.lineTo(w, h);
            ctx.lineTo(-w, h);
            ctx.closePath();
            sh.fill ? ctx.fill() : ctx.stroke();
            break;
          case 'star':
            for (let i = 0; i < 10; i++) {
              const r = i % 2 === 0 ? w : w * 0.5;
              const angle = (i * Math.PI) / 5 - Math.PI / 2;
              if (i === 0) ctx.moveTo(r * Math.cos(angle), r * Math.sin(angle));
              else ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
            }
            ctx.closePath();
            sh.fill ? ctx.fill() : ctx.stroke();
            break;
          case 'arrow':
            ctx.moveTo(-w, 0);
            ctx.lineTo(w * 0.3, 0);
            ctx.lineTo(w * 0.3, -h * 0.5);
            ctx.lineTo(w, 0);
            ctx.lineTo(w * 0.3, h * 0.5);
            ctx.lineTo(w * 0.3, 0);
            ctx.stroke();
            break;
          case 'line':
            ctx.moveTo(-w, 0);
            ctx.lineTo(w, 0);
            ctx.stroke();
            break;
          case 'speech':
            ctx.moveTo(-w * 0.8, -h);
            ctx.quadraticCurveTo(w, -h, w, 0);
            ctx.quadraticCurveTo(w, h * 0.6, 0, h * 0.6);
            ctx.lineTo(-w * 0.3, h);
            ctx.lineTo(-w * 0.1, h * 0.6);
            ctx.quadraticCurveTo(-w, h * 0.6, -w, 0);
            ctx.quadraticCurveTo(-w, -h, -w * 0.8, -h);
            ctx.closePath();
            sh.fill ? ctx.fill() : ctx.stroke();
            break;
        }
      }

      ctx.restore();
    });

    // 選択枠
    if (selectedLayerId && !isAnimating) {
      const layer = layers.find(l => l.id === selectedLayerId);
      if (layer) {
        ctx.save();
        ctx.translate(layer.x, layer.y);
        ctx.rotate(layer.rotation * Math.PI / 180);

        let w = 50, h = 50;
        if (layer.type === 'text') {
          const t = layer as TextLayer;
          ctx.font = `${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
          w = ctx.measureText(t.text).width / 2 + 15;
          h = t.fontSize / 2 + 10;
        } else if (layer.type === 'sticker') {
          w = h = (layer as StickerLayer).size / 2 + 10;
        } else if (layer.type === 'shape') {
          const sh = layer as ShapeLayer;
          w = sh.width / 2 + 10;
          h = sh.height / 2 + 10;
        }

        ctx.strokeStyle = '#8B5CF6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(-w * layer.scale, -h * layer.scale, w * 2 * layer.scale, h * 2 * layer.scale);

        // リサイズハンドル
        ctx.setLineDash([]);
        ctx.fillStyle = '#8B5CF6';
        const hs = 8;
        [[-w, -h], [w, -h], [-w, h], [w, h]].forEach(([x, y]) => {
          ctx.fillRect(x * layer.scale - hs / 2, y * layer.scale - hs / 2, hs, hs);
        });

        // 回転ハンドル
        ctx.beginPath();
        ctx.arc(0, -h * layer.scale - 25, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.moveTo(0, -h * layer.scale - 19);
        ctx.lineTo(0, -h * layer.scale);
        ctx.stroke();

        ctx.restore();
      }
    }
  }, [image, canvasSize, selectedFilter, adjustments, drawPaths, currentPath, drawColor, drawSize, drawTool, layers, selectedLayerId, isAnimating, getAnimTransform]);

  useEffect(() => {
    render(animFrame);
  }, [render, animFrame]);

  // アニメーション再生
  const toggleAnimation = useCallback(() => {
    if (isAnimating) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setIsAnimating(false);
    } else {
      setIsAnimating(true);
      let f = 0;
      const loop = () => {
        f++;
        setAnimFrame(f);
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);
    }
  }, [isAnimating]);

  // マウス座標取得
  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  // マウスイベント
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCoords(e);

    // 描画モード
    if (activeTab === 'draw') {
      setIsDrawing(true);
      setCurrentPath([coords]);
      return;
    }

    // レイヤー選択
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible || layer.locked) continue;

      let hitSize = 50;
      if (layer.type === 'sticker') hitSize = (layer as StickerLayer).size / 2;
      if (layer.type === 'shape') hitSize = Math.max((layer as ShapeLayer).width, (layer as ShapeLayer).height) / 2;
      if (layer.type === 'text') hitSize = (layer as TextLayer).fontSize;

      const dist = Math.sqrt(Math.pow(coords.x - layer.x, 2) + Math.pow(coords.y - layer.y, 2));
      if (dist < hitSize * layer.scale) {
        setSelectedLayerId(layer.id);
        setDragOffset({ x: coords.x - layer.x, y: coords.y - layer.y });
        setIsDragging(true);
        return;
      }
    }

    setSelectedLayerId(null);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCoords(e);

    if (isDrawing && activeTab === 'draw') {
      setCurrentPath(p => [...p, coords]);
      return;
    }

    if (isDragging && selectedLayerId) {
      setLayers(ls => ls.map(l =>
        l.id === selectedLayerId ? { ...l, x: coords.x - dragOffset.x, y: coords.y - dragOffset.y } : l
      ));
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentPath.length > 1) {
      setDrawPaths(p => [...p, { points: currentPath, color: drawColor, size: drawSize, tool: drawTool }]);
      setCurrentPath([]);
      saveHistory();
    }
    setIsDrawing(false);
    if (isDragging) saveHistory();
    setIsDragging(false);
    setIsResizing(false);
  };

  // レイヤー操作
  const addTextLayer = () => {
    if (!textInput.trim()) return;
    const layer: TextLayer = {
      id: Date.now().toString(),
      type: 'text',
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      rotation: 0,
      scale: 1,
      opacity: 1,
      animation: 'none',
      locked: false,
      visible: true,
      text: textInput,
      ...textSettings,
    };
    setLayers(l => [...l, layer]);
    setSelectedLayerId(layer.id);
    setTextInput('');
    saveHistory();
  };

  const addStickerLayer = (emoji: string) => {
    const layer: StickerLayer = {
      id: Date.now().toString(),
      type: 'sticker',
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      rotation: 0,
      scale: 1,
      opacity: 1,
      animation: 'none',
      locked: false,
      visible: true,
      emoji,
      size: 64,
    };
    setLayers(l => [...l, layer]);
    setSelectedLayerId(layer.id);
    saveHistory();
  };

  const addShapeLayer = () => {
    const layer: ShapeLayer = {
      id: Date.now().toString(),
      type: 'shape',
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      rotation: 0,
      scale: 1,
      opacity: 1,
      animation: 'none',
      locked: false,
      visible: true,
      shapeType: shapeSettings.type,
      width: 120,
      height: 120,
      color: shapeSettings.color,
      fill: shapeSettings.fill,
      strokeWidth: shapeSettings.strokeWidth,
    };
    setLayers(l => [...l, layer]);
    setSelectedLayerId(layer.id);
    saveHistory();
  };

  const deleteLayer = (id: string) => {
    setLayers(l => l.filter(layer => layer.id !== id));
    setSelectedLayerId(null);
    saveHistory();
  };

  const updateLayer = (id: string, updates: Partial<AnyLayer>) => {
    setLayers(ls => ls.map(l => l.id === id ? { ...l, ...updates } as AnyLayer : l));
  };

  const duplicateLayer = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    const newLayer = { ...layer, id: Date.now().toString(), x: layer.x + 20, y: layer.y + 20 };
    setLayers(l => [...l, newLayer as AnyLayer]);
    setSelectedLayerId(newLayer.id);
    saveHistory();
  };

  const moveLayerOrder = (id: string, direction: 'up' | 'down') => {
    setLayers(ls => {
      const idx = ls.findIndex(l => l.id === id);
      if (idx === -1) return ls;
      const newIdx = direction === 'up' ? Math.min(idx + 1, ls.length - 1) : Math.max(idx - 1, 0);
      const newLayers = [...ls];
      [newLayers[idx], newLayers[newIdx]] = [newLayers[newIdx], newLayers[idx]];
      return newLayers;
    });
  };

  // 動画録画状態
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [exportMode, setExportMode] = useState<'image' | 'video'>('image');

  // 動画としてエクスポート（WebM）
  const exportAsVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsRecording(true);
    setRecordingProgress(0);
    setSelectedLayerId(null);

    try {
      // MediaRecorderを使用してWebM動画を作成
      const stream = canvas.captureStream(30); // 30fps
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000, // 5Mbps
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.start();

      // 3秒間のアニメーションを録画（180フレーム @ 60fps描画）
      const totalFrames = 180;
      for (let f = 0; f < totalFrames; f++) {
        render(f);
        setRecordingProgress(Math.round((f / totalFrames) * 100));
        await new Promise(r => setTimeout(r, 16.67)); // ~60fps描画
      }

      mediaRecorder.stop();

      await new Promise<void>(resolve => {
        mediaRecorder.onstop = () => resolve();
      });

      const blob = new Blob(chunks, { type: 'video/webm' });

      // アップロード
      const file = new File([blob], `animation-${Date.now()}.webm`, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      onSave(data.url);
    } catch (err) {
      console.error('Video export error:', err);
      alert(err instanceof Error ? err.message : '動画エクスポートに失敗しました');
    } finally {
      setIsRecording(false);
      setRecordingProgress(0);
    }
  };

  // ダウンロード（ローカル保存）
  const downloadVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsRecording(true);
    setRecordingProgress(0);
    setSelectedLayerId(null);

    try {
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.start();

      const totalFrames = 180;
      for (let f = 0; f < totalFrames; f++) {
        render(f);
        setRecordingProgress(Math.round((f / totalFrames) * 100));
        await new Promise(r => setTimeout(r, 16.67));
      }

      mediaRecorder.stop();

      await new Promise<void>(resolve => {
        mediaRecorder.onstop = () => resolve();
      });

      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `animation-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('動画ダウンロードに失敗しました');
    } finally {
      setIsRecording(false);
      setRecordingProgress(0);
    }
  };

  // 保存（画像）
  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setIsAnimating(false);
      setSelectedLayerId(null);
      await new Promise(r => setTimeout(r, 100));
      render(0);

      const blob = await new Promise<Blob>((res, rej) => {
        canvas.toBlob(b => b ? res(b) : rej(new Error('Failed')), 'image/png');
      });
      const file = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onSave(data.url);
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // リセット
  const handleReset = () => {
    setLayers([]);
    setDrawPaths([]);
    setSelectedFilter('none');
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setSelectedLayerId(null);
    saveHistory();
  };

  // 選択レイヤー取得
  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  if (!image) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
        <div className="bg-white rounded-xl p-8 flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span>画像を読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-[60]">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-violet-900 via-purple-900 to-pink-900 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm">← 戻る</button>
          <div>
            <h2 className="font-bold">画像エディター Pro</h2>
            <p className="text-[10px] text-white/60">フィルター・テキスト・アニメーション・描画</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button onClick={undo} disabled={historyIndex <= 0} className="p-2 hover:bg-white/20 rounded disabled:opacity-30" title="元に戻す (Ctrl+Z)">↶</button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-white/20 rounded disabled:opacity-30" title="やり直し (Ctrl+Shift+Z)">↷</button>

          <div className="w-px h-6 bg-white/20 mx-2" />

          <button onClick={handleReset} className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg">リセット</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-sm bg-violet-500 hover:bg-violet-400 rounded-lg disabled:opacity-50">
            {saving ? '保存中...' : '保存して使用'}
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* キャンバスエリア */}
        <div className="flex-1 flex items-center justify-center p-4 bg-slate-900 overflow-auto">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg cursor-crosshair"
            style={{ maxHeight: 'calc(100vh - 120px)' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          />
        </div>

        {/* サイドバー */}
        <div className="w-80 bg-slate-800 text-white flex flex-col">
          {/* タブ */}
          <div className="grid grid-cols-4 border-b border-slate-700">
            {[
              { id: 'filter', icon: '🎨', label: 'フィルター' },
              { id: 'adjust', icon: '⚙️', label: '調整' },
              { id: 'text', icon: 'T', label: 'テキスト' },
              { id: 'sticker', icon: '✨', label: 'ステッカー' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`py-2 text-center text-xs transition-colors ${activeTab === t.id ? 'bg-violet-600' : 'hover:bg-slate-700'}`}
              >
                <div className="text-base">{t.icon}</div>
                <div className="text-[10px]">{t.label}</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 border-b border-slate-700">
            {[
              { id: 'shape', icon: '◼️', label: '図形' },
              { id: 'draw', icon: '✏️', label: '描画' },
              { id: 'animate', icon: '🎬', label: 'アニメ' },
              { id: 'crop', icon: '✂️', label: 'レイヤー' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`py-2 text-center text-xs transition-colors ${activeTab === t.id ? 'bg-violet-600' : 'hover:bg-slate-700'}`}
              >
                <div className="text-base">{t.icon}</div>
                <div className="text-[10px]">{t.label}</div>
              </button>
            ))}
          </div>

          {/* タブコンテンツ */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* フィルター */}
            {activeTab === 'filter' && (
              <div className="grid grid-cols-3 gap-2">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setSelectedFilter(f.id); saveHistory(); }}
                    className={`p-2 rounded-lg text-xs transition-all ${selectedFilter === f.id ? 'bg-violet-600 ring-2 ring-violet-400' : 'bg-slate-700 hover:bg-slate-600'}`}
                  >
                    <div className="text-lg mb-1">{f.icon}</div>
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            {/* 調整 */}
            {activeTab === 'adjust' && (
              <div className="space-y-4">
                {[
                  { key: 'brightness', label: '明るさ', min: 50, max: 150, unit: '%' },
                  { key: 'contrast', label: 'コントラスト', min: 50, max: 150, unit: '%' },
                  { key: 'saturation', label: '彩度', min: 0, max: 200, unit: '%' },
                  { key: 'hue', label: '色相', min: -180, max: 180, unit: '°' },
                  { key: 'blur', label: 'ぼかし', min: 0, max: 10, unit: 'px' },
                  { key: 'vignette', label: 'ビネット', min: 0, max: 100, unit: '%' },
                  { key: 'grain', label: 'グレイン', min: 0, max: 50, unit: '' },
                ].map(s => (
                  <div key={s.key}>
                    <label className="flex justify-between text-xs mb-1">
                      <span>{s.label}</span>
                      <span>{adjustments[s.key as keyof typeof adjustments]}{s.unit}</span>
                    </label>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      value={adjustments[s.key as keyof typeof adjustments]}
                      onChange={(e) => setAdjustments(a => ({ ...a, [s.key]: Number(e.target.value) }))}
                      onMouseUp={saveHistory}
                      className="w-full accent-violet-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* テキスト */}
            {activeTab === 'text' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="テキストを入力..."
                  className="w-full px-3 py-2 bg-slate-700 rounded-lg text-sm"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">サイズ</label>
                    <input
                      type="range"
                      min="16"
                      max="150"
                      value={textSettings.fontSize}
                      onChange={(e) => setTextSettings(s => ({ ...s, fontSize: Number(e.target.value) }))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">色</label>
                    <input
                      type="color"
                      value={textSettings.color}
                      onChange={(e) => setTextSettings(s => ({ ...s, color: e.target.value }))}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400">フォント</label>
                  <select
                    value={textSettings.fontFamily}
                    onChange={(e) => setTextSettings(s => ({ ...s, fontFamily: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-slate-700 rounded text-sm"
                  >
                    {FONTS.map(f => <option key={f.id} value={f.value}>{f.name}</option>)}
                  </select>
                </div>

                <div className="flex flex-wrap gap-1">
                  {TEXT_PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setTextSettings(s => ({ ...s, shadow: p.shadow, outline: p.outline, neon: p.neon || false }))}
                      className={`px-2 py-1 text-xs rounded ${textSettings.shadow === p.shadow && textSettings.outline === p.outline ? 'bg-violet-600' : 'bg-slate-700'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <button
                  onClick={addTextLayer}
                  disabled={!textInput.trim()}
                  className="w-full py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm disabled:opacity-50"
                >
                  テキストを追加
                </button>
              </div>
            )}

            {/* ステッカー */}
            {activeTab === 'sticker' && (
              <div className="space-y-3">
                {STICKER_CATEGORIES.map(cat => (
                  <div key={cat.name}>
                    <label className="text-[10px] text-slate-400 mb-1 block">{cat.name}</label>
                    <div className="grid grid-cols-5 gap-1">
                      {cat.emojis.map(e => (
                        <button
                          key={e}
                          onClick={() => addStickerLayer(e)}
                          className="p-2 text-xl bg-slate-700 hover:bg-slate-600 rounded-lg hover:scale-110 transition-transform"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 図形 */}
            {activeTab === 'shape' && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { type: 'rect', icon: '◻️' },
                    { type: 'circle', icon: '⭕' },
                    { type: 'triangle', icon: '△' },
                    { type: 'star', icon: '⭐' },
                    { type: 'arrow', icon: '➡️' },
                    { type: 'line', icon: '➖' },
                    { type: 'speech', icon: '💬' },
                  ].map(s => (
                    <button
                      key={s.type}
                      onClick={() => setShapeSettings(ss => ({ ...ss, type: s.type as typeof ss.type }))}
                      className={`p-2 rounded text-xl ${shapeSettings.type === s.type ? 'bg-violet-600' : 'bg-slate-700'}`}
                    >
                      {s.icon}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={shapeSettings.color}
                    onChange={(e) => setShapeSettings(s => ({ ...s, color: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={shapeSettings.fill}
                      onChange={(e) => setShapeSettings(s => ({ ...s, fill: e.target.checked }))}
                    />
                    塗りつぶし
                  </label>
                </div>
                <button onClick={addShapeLayer} className="w-full py-2 bg-violet-600 rounded-lg text-sm">
                  図形を追加
                </button>
              </div>
            )}

            {/* 描画 */}
            {activeTab === 'draw' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">画像上をドラッグして描画</p>
                <div className="flex gap-1">
                  {[
                    { id: 'pen', name: 'ペン', icon: '✏️' },
                    { id: 'highlighter', name: 'マーカー', icon: '🖍️' },
                    { id: 'eraser', name: '消しゴム', icon: '🧽' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setDrawTool(t.id as typeof drawTool)}
                      className={`flex-1 py-2 rounded text-xs ${drawTool === t.id ? 'bg-violet-600' : 'bg-slate-700'}`}
                    >
                      {t.icon} {t.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-10 h-10 rounded" />
                  <input type="range" min="2" max="40" value={drawSize} onChange={(e) => setDrawSize(Number(e.target.value))} className="flex-1 accent-violet-500" />
                  <span className="text-xs w-8">{drawSize}px</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffffff', '#000000'].map(c => (
                    <button key={c} onClick={() => setDrawColor(c)} className={`w-7 h-7 rounded border-2 ${drawColor === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDrawPaths(p => p.slice(0, -1))} disabled={!drawPaths.length} className="flex-1 py-2 bg-slate-700 rounded text-sm disabled:opacity-50">元に戻す</button>
                  <button onClick={() => { setDrawPaths([]); saveHistory(); }} disabled={!drawPaths.length} className="flex-1 py-2 bg-red-600 rounded text-sm disabled:opacity-50">全消去</button>
                </div>
              </div>
            )}

            {/* アニメーション */}
            {activeTab === 'animate' && (
              <div className="space-y-3">
                <button onClick={toggleAnimation} className={`w-full py-2.5 rounded-lg text-sm font-medium ${isAnimating ? 'bg-red-600' : 'bg-violet-600'}`}>
                  {isAnimating ? '⏹ 停止' : '▶️ プレビュー再生'}
                </button>

                {selectedLayer && (
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">選択中のレイヤーにアニメーション適用</label>
                    <div className="grid grid-cols-3 gap-1">
                      {ANIMATIONS.map(a => (
                        <button
                          key={a.id}
                          onClick={() => { updateLayer(selectedLayer.id, { animation: a.id }); saveHistory(); }}
                          className={`p-1.5 rounded text-[10px] ${selectedLayer.animation === a.id ? 'bg-violet-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                          {a.icon} {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-slate-500">テキストやステッカーを選択してからアニメーションを適用してください</p>

                {/* 動画エクスポート */}
                <div className="pt-3 border-t border-slate-700 space-y-2">
                  <label className="text-xs text-slate-400 block">🎬 動画エクスポート（3秒WebM）</label>

                  {isRecording ? (
                    <div className="space-y-2">
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-pink-500 to-orange-500 h-2 rounded-full transition-all"
                          style={{ width: `${recordingProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-center text-slate-300">録画中... {recordingProgress}%</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={exportAsVideo}
                        disabled={layers.filter(l => l.animation !== 'none').length === 0}
                        className="py-2 bg-gradient-to-r from-pink-600 to-orange-600 rounded-lg text-xs font-medium disabled:opacity-50"
                      >
                        📤 投稿に使用
                      </button>
                      <button
                        onClick={downloadVideo}
                        disabled={layers.filter(l => l.animation !== 'none').length === 0}
                        className="py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs"
                      >
                        ⬇️ ダウンロード
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500">※ アニメーション付きレイヤーが必要です</p>
                </div>
              </div>
            )}

            {/* レイヤー管理 */}
            {activeTab === 'crop' && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">レイヤー一覧（上が前面）</p>
                {layers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">レイヤーがありません</p>
                ) : (
                  [...layers].reverse().map(layer => (
                    <div
                      key={layer.id}
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`p-2 rounded-lg cursor-pointer flex items-center gap-2 ${selectedLayerId === layer.id ? 'bg-violet-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                      <span className="text-lg">
                        {layer.type === 'text' ? 'T' : layer.type === 'sticker' ? (layer as StickerLayer).emoji : '◼️'}
                      </span>
                      <span className="flex-1 text-xs truncate">
                        {layer.type === 'text' ? (layer as TextLayer).text : layer.type === 'sticker' ? 'ステッカー' : '図形'}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }} className="text-xs opacity-60 hover:opacity-100">
                        {layer.visible ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="text-xs text-red-400 hover:text-red-300">×</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* 選択レイヤーの詳細コントロール */}
          {selectedLayer && (
            <div className="border-t border-slate-700 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">選択中のレイヤー</span>
                <div className="flex gap-1">
                  <button onClick={() => duplicateLayer(selectedLayer.id)} className="px-2 py-1 text-[10px] bg-slate-700 rounded hover:bg-slate-600">複製</button>
                  <button onClick={() => moveLayerOrder(selectedLayer.id, 'up')} className="px-2 py-1 text-[10px] bg-slate-700 rounded hover:bg-slate-600">↑</button>
                  <button onClick={() => moveLayerOrder(selectedLayer.id, 'down')} className="px-2 py-1 text-[10px] bg-slate-700 rounded hover:bg-slate-600">↓</button>
                  <button onClick={() => deleteLayer(selectedLayer.id)} className="px-2 py-1 text-[10px] bg-red-600 rounded hover:bg-red-500">削除</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">回転</label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={selectedLayer.rotation}
                    onChange={(e) => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
                    onMouseUp={saveHistory}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">サイズ</label>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={selectedLayer.scale}
                    onChange={(e) => updateLayer(selectedLayer.id, { scale: Number(e.target.value) })}
                    onMouseUp={saveHistory}
                    className="w-full accent-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400">透明度</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={selectedLayer.opacity}
                  onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
                  onMouseUp={saveHistory}
                  className="w-full accent-violet-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
