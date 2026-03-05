"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MousePointer2,
  Pen,
  Square,
  Circle,
  ArrowUpRight,
  Eraser,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Microscope,
  RotateCcw,
  Save,
  Camera,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import type { InvestigationFrame } from "@/types/investigations";

type DrawingTool = "select" | "pen" | "rect" | "circle" | "arrow" | "eraser";

interface ForensicParam {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

interface ForensicPreset {
  id: string;
  label: string;
  description: string;
  params: ForensicParam[];
}

const FORENSIC_PRESETS: ForensicPreset[] = [
  {
    id: "sharpen",
    label: "Sharpen",
    description: "Unsharp mask to reveal hidden detail",
    params: [
      { key: "strength", label: "Strength", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
    ],
  },
  {
    id: "edge_detect",
    label: "Edge Detect",
    description: "Highlight manipulation boundaries",
    params: [
      { key: "low", label: "Low Threshold", min: 0.01, max: 0.5, step: 0.01, default: 0.1 },
      { key: "high", label: "High Threshold", min: 0.1, max: 0.8, step: 0.01, default: 0.3 },
    ],
  },
  {
    id: "denoise",
    label: "Denoise",
    description: "Remove noise to reveal structure",
    params: [
      { key: "luma", label: "Luma", min: 1, max: 20, step: 1, default: 6 },
      { key: "chroma", label: "Chroma", min: 1, max: 20, step: 1, default: 4 },
    ],
  },
  {
    id: "histogram_eq",
    label: "Histogram EQ",
    description: "Global histogram equalization",
    params: [
      { key: "strength", label: "Strength", min: 0.1, max: 1.0, step: 0.05, default: 0.5 },
      { key: "intensity", label: "Intensity", min: 0.1, max: 1.0, step: 0.05, default: 0.5 },
    ],
  },
  {
    id: "color_amplify",
    label: "Color Amplify",
    description: "Boost color to reveal inconsistencies",
    params: [
      { key: "saturation", label: "Saturation", min: 1, max: 5, step: 0.1, default: 3 },
      { key: "contrast", label: "Contrast", min: 0.5, max: 3, step: 0.1, default: 1.5 },
      { key: "brightness", label: "Brightness", min: -0.3, max: 0.3, step: 0.01, default: 0 },
    ],
  },
  {
    id: "ela",
    label: "ELA",
    description: "Error Level Analysis — detect edits",
    params: [
      { key: "quality", label: "Quality", min: 5, max: 30, step: 1, default: 15 },
      { key: "amplify", label: "Amplification", min: 5, max: 30, step: 1, default: 15 },
    ],
  },
];

interface FrameAnnotationCanvasProps {
  frame: InvestigationFrame;
  investigationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function FrameAnnotationCanvas({
  frame,
  investigationId,
  open,
  onOpenChange,
  onSaved,
}: FrameAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  // Callback ref to detect when canvas element mounts in the Dialog portal
  const canvasCallbackRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    setCanvasReady(!!node);
  }, []);
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
  }, []);
  const fabricRef = useRef<any>(null);
  const fabricModuleRef = useRef<any>(null);
  const bgImageRef = useRef<any>(null);
  const blobUrlRef = useRef<string | null>(null);
  const storageUrlRef = useRef(frame.storage_url);
  const enhancedBlobUrlRef = useRef<string | null>(null);
  const originalBlobUrlRef = useRef<string | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [strokeColor, setStrokeColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [enhanced, setEnhanced] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [fabricLoaded, setFabricLoaded] = useState(false);

  // Forensic filter state
  const [forensicFilter, setForensicFilter] = useState<string | null>(null);
  const [forensicParams, setForensicParams] = useState<Record<string, number>>({});
  const [forensicLoading, setForensicLoading] = useState(false);
  const [forensicError, setForensicError] = useState<string | null>(null);
  const [forensicActive, setForensicActive] = useState<string | null>(null);

  // Undo/Redo stacks
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isRestoring = useRef(false);

  // Shape drawing state
  const isDrawingShape = useRef(false);
  const shapeStartPoint = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<any>(null);
  const shapeCleanupRef = useRef<(() => void) | null>(null);
  const suppressUndo = useRef(false);

  // Tracks desired selection state for the current tool (used by pan handler)
  const selectionEnabledRef = useRef(true);

  // Spacebar pan state
  const spacebarDown = useRef(false);
  const keyHandlersRef = useRef<{ down: (e: KeyboardEvent) => void; up: (e: KeyboardEvent) => void } | null>(null);

  function fitImageToCanvas(img: any, width: number, height: number) {
    const scaleX = width / (img.width || 1);
    const scaleY = height / (img.height || 1);
    const scale = Math.min(scaleX, scaleY);
    img.set({
      scaleX: scale,
      scaleY: scale,
      originX: "left",
      originY: "top",
      left: (width - (img.width || 0) * scale) / 2,
      top: (height - (img.height || 0) * scale) / 2,
      selectable: false,
      evented: false,
      hasControls: false,
    });
    if (img.setCoords) img.setCoords();
  }

  /** Serialize only drawing objects (skip bg image at index 0). */
  function serializeDrawings(canvas: any): string {
    const objects = canvas.getObjects();
    const drawingObjects = objects.slice(1);
    return JSON.stringify(drawingObjects.map((o: any) => o.toObject()));
  }

  /** Restore drawing objects from serialized state, preserving bg image. */
  async function restoreDrawingState(stateJson: string) {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;
    isRestoring.current = true;
    // Remove all non-bg objects
    const objects = canvas.getObjects();
    for (let i = objects.length - 1; i > 0; i--) {
      canvas.remove(objects[i]);
    }
    // Enliven and add saved drawing objects
    const savedObjects = JSON.parse(stateJson);
    if (savedObjects.length > 0) {
      const enlivened = await fabric.util.enlivenObjects(savedObjects);
      for (const obj of enlivened) {
        canvas.add(obj as any);
      }
    }
    canvas.renderAll();
    isRestoring.current = false;
  }

  const pushUndoState = useCallback(() => {
    if (isRestoring.current || !fabricRef.current) return;
    const json = serializeDrawings(fabricRef.current);
    undoStack.current.push(json);
    redoStack.current = [];
    if (undoStack.current.length > 50) undoStack.current.shift();
  }, []);

  // Keep storage URL ref in sync (avoids re-init when signed URL rotates)
  storageUrlRef.current = frame.storage_url;

  // Initialize fabric canvas — depends on canvasReady (callback ref) not just open
  useEffect(() => {
    if (!open || !canvasReady || !canvasRef.current) return;

    let disposed = false;

    async function initCanvas() {
      const fabric = await import("fabric");
      if (disposed) return;
      fabricModuleRef.current = fabric;

      const container = containerRef.current;
      if (!container || !canvasRef.current) return;

      const rect = container.getBoundingClientRect();
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: rect.width,
        height: rect.height,
        backgroundColor: "#09090B",
        selection: true,
      });

      fabricRef.current = canvas;

      // Load frame image as background (fetch as blob to avoid CORS canvas tainting)
      const imageUrl = storageUrlRef.current;
      if (imageUrl) {
        try {
          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) throw new Error(`Fetch failed: ${imgRes.status}`);
          const imgBlob = await imgRes.blob();
          const blobUrl = URL.createObjectURL(imgBlob);
          blobUrlRef.current = blobUrl;

          // Load via HTMLImageElement explicitly then wrap in FabricImage
          const imgEl = new Image();
          await new Promise<void>((resolve, reject) => {
            imgEl.onload = () => resolve();
            imgEl.onerror = (e) => reject(e);
            imgEl.src = blobUrl;
          });
          if (disposed) return;
          const img = new fabric.FabricImage(imgEl);

          // Re-query container dimensions (dialog animation may have completed since initCanvas started)
          const currentW = canvas.getWidth();
          const currentH = canvas.getHeight();
          fitImageToCanvas(img, currentW, currentH);

          canvas.add(img);
          canvas.sendObjectToBack(img);
          bgImageRef.current = img;

          // Restore existing drawings if any
          if (frame.drawing_data) {
            isRestoring.current = true;
            const savedData = frame.drawing_data as { objects?: any[] };
            const objects = savedData.objects || [];
            // Skip the first object (background image)
            const drawingObjects = objects.slice(1);
            if (drawingObjects.length > 0) {
              const enlivened = await fabric.util.enlivenObjects(drawingObjects);
              for (const obj of enlivened) {
                canvas.add(obj as any);
              }
            }
            isRestoring.current = false;
          }

          undoStack.current = [serializeDrawings(canvas)];
          redoStack.current = [];
        } catch (err) {
          console.error("Failed to load frame image:", err);
        }
      }

      // Event listeners for undo tracking
      canvas.on("object:added", () => {
        if (!isRestoring.current && !suppressUndo.current) pushUndoState();
      });
      canvas.on("object:modified", () => {
        if (!isRestoring.current) pushUndoState();
      });

      // Zoom on scroll wheel
      canvas.on("mouse:wheel", (opt: any) => {
        const delta = opt.e.deltaY;
        let newZoom = canvas.getZoom();
        newZoom *= 0.999 ** delta;
        newZoom = Math.min(Math.max(0.5, newZoom), 10);
        canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), newZoom);
        setZoom(newZoom);
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // Pan on spacebar+drag or middle-mouse drag
      let isPanning = false;
      let lastPanPoint = { x: 0, y: 0 };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === "Space" && !spacebarDown.current) {
          spacebarDown.current = true;
          canvas.defaultCursor = "grab";
          canvas.setCursor("grab");
          e.preventDefault();
        }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space") {
          spacebarDown.current = false;
          if (!isPanning) {
            canvas.defaultCursor = activeTool === "select" ? "default" : "crosshair";
            canvas.setCursor(canvas.defaultCursor);
          }
        }
      };
      keyHandlersRef.current = { down: handleKeyDown, up: handleKeyUp };
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      canvas.on("mouse:down", (opt: any) => {
        const e = opt.e as MouseEvent;
        if (spacebarDown.current || e.button === 1) {
          isPanning = true;
          lastPanPoint = { x: e.clientX, y: e.clientY };
          canvas.selection = false;
          canvas.setCursor("grabbing");
        }
      });

      canvas.on("mouse:move", (opt: any) => {
        if (isPanning) {
          const e = opt.e as MouseEvent;
          const dx = e.clientX - lastPanPoint.x;
          const dy = e.clientY - lastPanPoint.y;
          canvas.relativePan(new fabric.Point(dx, dy));
          lastPanPoint = { x: e.clientX, y: e.clientY };
          canvas.setCursor("grabbing");
        }
      });

      canvas.on("mouse:up", () => {
        if (isPanning) {
          isPanning = false;
          canvas.selection = selectionEnabledRef.current;
          if (spacebarDown.current) {
            canvas.setCursor("grab");
          } else {
            canvas.setCursor("default");
          }
        }
      });

      setFabricLoaded(true);
    }

    requestAnimationFrame(() => initCanvas());

    return () => {
      disposed = true;
      if (keyHandlersRef.current) {
        window.removeEventListener("keydown", keyHandlersRef.current.down);
        window.removeEventListener("keyup", keyHandlersRef.current.up);
        keyHandlersRef.current = null;
      }
      spacebarDown.current = false;
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setFabricLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, canvasReady, frame.id]);

  // Handle resize
  useEffect(() => {
    if (!open || !containerRef.current || !fabricRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !fabricRef.current) return;
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      fabricRef.current.setDimensions({ width, height });
      // Re-center background image when container resizes (e.g. dialog animation)
      if (bgImageRef.current) {
        fitImageToCanvas(bgImageRef.current, width, height);
      }
      fabricRef.current.renderAll();
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [open, fabricLoaded]);

  // Update tool mode when activeTool changes
  useEffect(() => {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;

    // Clean up previous shape drawing handlers
    if (shapeCleanupRef.current) {
      shapeCleanupRef.current();
      shapeCleanupRef.current = null;
    }

    // Restore selectability on all non-bg objects (from previous tool mode)
    canvas.forEachObject((obj: any) => {
      if (obj === bgImageRef.current) return;
      obj.set({ selectable: true, evented: true });
    });

    // Reset all modes
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = "default";
    selectionEnabledRef.current = true;

    if (activeTool === "pen") {
      canvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(canvas);
      brush.color = strokeColor;
      brush.width = strokeWidth;
      canvas.freeDrawingBrush = brush;
    } else if (activeTool === "eraser") {
      canvas.selection = false;
      selectionEnabledRef.current = false;
      canvas.defaultCursor = "crosshair";
      canvas.forEachObject((obj: any) => {
        if (obj === bgImageRef.current) return;
        obj.set({ selectable: false, evented: true, hoverCursor: "pointer" });
      });
      // Click-to-delete mode
      const eraserHandler = (opt: any) => {
        if (opt.target && opt.target !== bgImageRef.current) {
          canvas.remove(opt.target);
          canvas.renderAll();
        }
      };
      canvas.on("mouse:down", eraserHandler);
      return () => {
        canvas.off("mouse:down", eraserHandler);
      };
    } else if (activeTool === "rect" || activeTool === "circle" || activeTool === "arrow") {
      canvas.selection = false;
      selectionEnabledRef.current = false;
      canvas.defaultCursor = "crosshair";
      // Disable per-object selectability so existing objects can't be selected during drawing
      canvas.forEachObject((obj: any) => {
        if (obj === bgImageRef.current) return;
        obj.set({ selectable: false, evented: false });
      });
      shapeCleanupRef.current = setupShapeDrawing(canvas, fabric, activeTool);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, strokeColor, strokeWidth, fabricLoaded]);

  // Update pen brush when color/width changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || activeTool !== "pen") return;
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = strokeWidth;
    }
  }, [strokeColor, strokeWidth, activeTool]);

  function setupShapeDrawing(canvas: any, fabric: any, tool: "rect" | "circle" | "arrow") {
    const downHandler = (opt: any) => {
      const e = opt.e as MouseEvent;
      if (spacebarDown.current) return;
      e.preventDefault();
      const pointer = canvas.getScenePoint(e);
      isDrawingShape.current = true;
      shapeStartPoint.current = { x: pointer.x, y: pointer.y };

      let shape: any;
      if (tool === "rect") {
        shape = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeUniform: true,
        });
      } else if (tool === "circle") {
        shape = new fabric.Ellipse({
          left: pointer.x,
          top: pointer.y,
          rx: 0,
          ry: 0,
          fill: "transparent",
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeUniform: true,
        });
      } else {
        shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeUniform: true,
        });
      }

      activeShapeRef.current = shape;
      suppressUndo.current = true;
      canvas.add(shape);
      suppressUndo.current = false;
      canvas.renderAll();
    };

    const moveHandler = (opt: any) => {
      if (!isDrawingShape.current || !shapeStartPoint.current || !activeShapeRef.current) return;
      const e = opt.e as MouseEvent;
      e.preventDefault();
      const pointer = canvas.getScenePoint(e);
      const startX = shapeStartPoint.current.x;
      const startY = shapeStartPoint.current.y;
      const shape = activeShapeRef.current;

      if (tool === "rect") {
        const width = Math.abs(pointer.x - startX);
        const height = Math.abs(pointer.y - startY);
        shape.set({
          left: Math.min(pointer.x, startX),
          top: Math.min(pointer.y, startY),
          width,
          height,
        });
      } else if (tool === "circle") {
        const rx = Math.abs(pointer.x - startX) / 2;
        const ry = Math.abs(pointer.y - startY) / 2;
        shape.set({
          left: Math.min(pointer.x, startX),
          top: Math.min(pointer.y, startY),
          rx,
          ry,
        });
      } else {
        shape.set({ x2: pointer.x, y2: pointer.y });
      }

      canvas.renderAll();
    };

    const upHandler = () => {
      if (!isDrawingShape.current) return;
      isDrawingShape.current = false;

      if (tool === "arrow" && activeShapeRef.current && shapeStartPoint.current) {
        const line = activeShapeRef.current;
        const x1 = line.x1 ?? 0;
        const y1 = line.y1 ?? 0;
        const x2 = line.x2 ?? 0;
        const y2 = line.y2 ?? 0;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = strokeWidth * 4;

        suppressUndo.current = true;
        const triangle = new fabric.Triangle({
          left: x2,
          top: y2,
          width: headLen,
          height: headLen,
          fill: strokeColor,
          angle: (angle * 180) / Math.PI + 90,
          originX: "center",
          originY: "center",
        });
        canvas.add(triangle);
        suppressUndo.current = false;
      }

      activeShapeRef.current = null;
      shapeStartPoint.current = null;
      canvas.renderAll();
      pushUndoState();
    };

    canvas.on("mouse:down", downHandler);
    canvas.on("mouse:move", moveHandler);
    canvas.on("mouse:up", upHandler);

    return () => {
      canvas.off("mouse:down", downHandler);
      canvas.off("mouse:move", moveHandler);
      canvas.off("mouse:up", upHandler);
      // Clean up any in-progress shape drawing
      if (isDrawingShape.current && activeShapeRef.current) {
        canvas.remove(activeShapeRef.current);
        canvas.renderAll();
      }
      isDrawingShape.current = false;
      activeShapeRef.current = null;
      shapeStartPoint.current = null;
    };
  }

  async function handleUndo() {
    if (undoStack.current.length <= 1) return;
    const currentState = undoStack.current.pop()!;
    redoStack.current.push(currentState);
    const prevState = undoStack.current[undoStack.current.length - 1];
    await restoreDrawingState(prevState);
  }

  async function handleRedo() {
    if (redoStack.current.length === 0) return;
    const nextState = redoStack.current.pop()!;
    undoStack.current.push(nextState);
    await restoreDrawingState(nextState);
  }

  function handleZoom(newZoom: number) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const clamped = Math.min(Math.max(0.5, newZoom), 10);
    const center = canvas.getCenterPoint();
    canvas.zoomToPoint(center, clamped);
    setZoom(clamped);
  }

  function handleFitToView() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
    // Re-center background image to current canvas size
    if (bgImageRef.current) {
      fitImageToCanvas(bgImageRef.current, canvas.getWidth(), canvas.getHeight());
    }
    canvas.renderAll();
  }

  async function handleEnhance() {
    if (!frame.storage_path || enhancing) return;
    setEnhancing(true);
    setEnhanceError(null);
    try {
      const res = await fetch(
        `/api/admin/investigations/${investigationId}/frames/${frame.id}/upscale`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storage_path: frame.storage_path }),
        }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Upscale failed (${res.status})`);
      }
      const data = await res.json();

      if (data.upscaled_url && fabricRef.current && fabricModuleRef.current) {
        const fabric = fabricModuleRef.current;
        const canvas = fabricRef.current;

        // Save original blob URL before replacing
        originalBlobUrlRef.current = blobUrlRef.current;

        const upRes = await fetch(data.upscaled_url);
        const upBlob = await upRes.blob();
        const upBlobUrl = URL.createObjectURL(upBlob);
        blobUrlRef.current = upBlobUrl;
        enhancedBlobUrlRef.current = upBlobUrl;
        const upImgEl = new Image();
        await new Promise<void>((resolve, reject) => {
          upImgEl.onload = () => resolve();
          upImgEl.onerror = (e) => reject(e);
          upImgEl.src = upBlobUrl;
        });
        const img = new fabric.FabricImage(upImgEl);

        fitImageToCanvas(img, canvas.getWidth(), canvas.getHeight());

        if (bgImageRef.current) {
          canvas.remove(bgImageRef.current);
        }
        canvas.add(img);
        canvas.sendObjectToBack(img);
        bgImageRef.current = img;
        canvas.renderAll();
        setEnhanced(true);
        setShowingOriginal(false);
      }
    } catch (err) {
      console.error("Enhance failed:", err);
      setEnhanceError((err as Error).message || "Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  }

  async function handleToggleOriginal() {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;

    const targetUrl = showingOriginal
      ? enhancedBlobUrlRef.current
      : originalBlobUrlRef.current || storageUrlRef.current;
    if (!targetUrl) return;

    try {
      // If switching to original and we don't have a cached blob, fetch it
      let imgSrc = targetUrl;
      if (!showingOriginal && !originalBlobUrlRef.current && storageUrlRef.current) {
        const res = await fetch(storageUrlRef.current);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        originalBlobUrlRef.current = url;
        imgSrc = url;
      }

      const imgEl = new Image();
      await new Promise<void>((resolve, reject) => {
        imgEl.onload = () => resolve();
        imgEl.onerror = (e) => reject(e);
        imgEl.src = imgSrc;
      });
      const img = new fabric.FabricImage(imgEl);
      fitImageToCanvas(img, canvas.getWidth(), canvas.getHeight());

      if (bgImageRef.current) canvas.remove(bgImageRef.current);
      canvas.add(img);
      canvas.sendObjectToBack(img);
      bgImageRef.current = img;
      canvas.renderAll();
      setShowingOriginal(!showingOriginal);
    } catch (err) {
      console.error("Toggle original/enhanced failed:", err);
    }
  }

  function selectForensicFilter(filterId: string) {
    const preset = FORENSIC_PRESETS.find((f) => f.id === filterId);
    if (!preset) return;
    setForensicFilter(filterId);
    const defaults: Record<string, number> = {};
    for (const p of preset.params) {
      defaults[p.key] = p.default;
    }
    setForensicParams(defaults);
    setForensicError(null);
  }

  async function handleApplyForensic() {
    if (!forensicFilter || forensicLoading) return;
    setForensicLoading(true);
    setForensicError(null);
    try {
      const res = await fetch(
        `/api/admin/investigations/${investigationId}/frames/${frame.id}/enhance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: forensicFilter, params: forensicParams }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      if (data.url && fabricRef.current && fabricModuleRef.current) {
        const fabric = fabricModuleRef.current;
        const canvas = fabricRef.current;

        const imgRes = await fetch(data.url);
        const imgBlob = await imgRes.blob();
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const newBlobUrl = URL.createObjectURL(imgBlob);
        blobUrlRef.current = newBlobUrl;

        const imgEl = new Image();
        await new Promise<void>((resolve, reject) => {
          imgEl.onload = () => resolve();
          imgEl.onerror = (e) => reject(e);
          imgEl.src = newBlobUrl;
        });
        const img = new fabric.FabricImage(imgEl);
        fitImageToCanvas(img, canvas.getWidth(), canvas.getHeight());

        if (bgImageRef.current) canvas.remove(bgImageRef.current);
        canvas.add(img);
        canvas.sendObjectToBack(img);
        bgImageRef.current = img;
        canvas.renderAll();

        const preset = FORENSIC_PRESETS.find((f) => f.id === forensicFilter);
        setForensicActive(preset?.label || forensicFilter);
      }
    } catch (err) {
      setForensicError(err instanceof Error ? err.message : "Enhancement failed");
    } finally {
      setForensicLoading(false);
    }
  }

  async function handleResetForensic() {
    const canvas = fabricRef.current;
    const fabric = fabricModuleRef.current;
    if (!canvas || !fabric) return;

    try {
      const imageUrl = storageUrlRef.current;
      if (!imageUrl) return;

      const imgRes = await fetch(imageUrl);
      const imgBlob = await imgRes.blob();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const newBlobUrl = URL.createObjectURL(imgBlob);
      blobUrlRef.current = newBlobUrl;

      const imgEl = new Image();
      await new Promise<void>((resolve, reject) => {
        imgEl.onload = () => resolve();
        imgEl.onerror = (e) => reject(e);
        imgEl.src = newBlobUrl;
      });
      const img = new fabric.FabricImage(imgEl);
      fitImageToCanvas(img, canvas.getWidth(), canvas.getHeight());

      if (bgImageRef.current) canvas.remove(bgImageRef.current);
      canvas.add(img);
      canvas.sendObjectToBack(img);
      bgImageRef.current = img;
      canvas.renderAll();

      setForensicActive(null);
      setForensicFilter(null);
      setForensicParams({});
      setForensicError(null);
    } catch (err) {
      console.error("Reset forensic failed:", err);
    }
  }

  async function handleSaveAnnotations() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/investigations/${investigationId}/frames/${frame.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawing_data: canvas.toJSON() }),
      });
      onSaved();
    } catch (err) {
      console.error("Save annotations failed:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsEvidence() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setSavingEvidence(true);
    try {
      // Reset zoom to capture full canvas
      const prevTransform = canvas.viewportTransform
        ? [...canvas.viewportTransform]
        : [1, 0, 0, 1, 0, 0];
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.renderAll();

      // Crop to background image bounds (exclude letterbox bars)
      const bgImage = canvas.getObjects()[0];
      const cropLeft = bgImage?.left ?? 0;
      const cropTop = bgImage?.top ?? 0;
      const cropWidth = (bgImage?.width ?? canvas.getWidth()) * (bgImage?.scaleX ?? 1);
      const cropHeight = (bgImage?.height ?? canvas.getHeight()) * (bgImage?.scaleY ?? 1);

      // Skip 2x multiplier when already enhanced (4x image would be enormous)
      const dataUrl = canvas.toDataURL({
        format: "png",
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight,
        ...(enhanced ? {} : { multiplier: 2 }),
      });

      // Restore zoom
      canvas.setViewportTransform(prevTransform);
      canvas.renderAll();

      // Convert data URL to blob
      const blobRes = await fetch(dataUrl);
      const blob = await blobRes.blob();

      // Upload annotated image as evidence
      const formData = new FormData();
      formData.append("image", blob, "annotation.png");
      formData.append("create_evidence", "true");
      formData.append("evidence_title", `Annotated Frame #${frame.frame_number}`);

      // Save drawing data + upload image in parallel
      const [, uploadRes] = await Promise.all([
        fetch(`/api/admin/investigations/${investigationId}/frames/${frame.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drawing_data: canvas.toJSON() }),
        }),
        fetch(
          `/api/admin/investigations/${investigationId}/frames/${frame.id}/annotation-image`,
          { method: "POST", body: formData }
        ),
      ]);

      if (!uploadRes.ok) throw new Error("Upload failed");

      onSaved();
    } catch (err) {
      console.error("Save as evidence failed:", err);
    } finally {
      setSavingEvidence(false);
    }
  }

  const tools: { id: DrawingTool; icon: React.ReactNode; label: string }[] = [
    { id: "select", icon: <MousePointer2 className="h-4 w-4" />, label: "Select" },
    { id: "pen", icon: <Pen className="h-4 w-4" />, label: "Pen" },
    { id: "rect", icon: <Square className="h-4 w-4" />, label: "Rectangle" },
    { id: "circle", icon: <Circle className="h-4 w-4" />, label: "Circle" },
    { id: "arrow", icon: <ArrowUpRight className="h-4 w-4" />, label: "Arrow" },
    { id: "eraser", icon: <Eraser className="h-4 w-4" />, label: "Eraser" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[98vw] sm:max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-0 gap-0"
        showCloseButton={true}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 py-3 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base">
              Annotate Frame #{frame.frame_number}
            </DialogTitle>
            {enhanced && (
              <Badge className={`text-[10px] ${showingOriginal ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"}`}>
                {showingOriginal ? "Original" : "Enhanced 4x"}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <TooltipProvider delayDuration={200}>
          <div className="px-4 py-2 border-b border-border/30 flex items-center gap-2 flex-wrap shrink-0">
            {/* Drawing tools */}
            <div className="flex items-center gap-1 border-r border-border/30 pr-2">
              {tools.map((tool) => (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant={activeTool === tool.id ? "default" : "ghost"}
                      className="h-8 w-8"
                      onClick={() => setActiveTool(tool.id)}
                    >
                      {tool.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{tool.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Color & width */}
            <div className="flex items-center gap-2 border-r border-border/30 pr-2">
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-border/50 bg-transparent"
              />
              <div className="w-20">
                <Slider
                  value={[strokeWidth]}
                  onValueChange={([v]) => setStrokeWidth(v)}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>
            </div>

            {/* Undo/Redo */}
            <div className="flex items-center gap-1 border-r border-border/30 pr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleUndo}
                    disabled={undoStack.current.length <= 1}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Undo</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleRedo}
                    disabled={redoStack.current.length === 0}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Redo</p></TooltipContent>
              </Tooltip>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 border-r border-border/30 pr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleZoom(zoom / 1.25)}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Zoom Out</p></TooltipContent>
              </Tooltip>
              <span className="text-xs text-muted-foreground w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleZoom(zoom * 1.25)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Zoom In</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleFitToView}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Fit to View</p></TooltipContent>
              </Tooltip>
            </div>

            {/* Enhance button */}
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={handleEnhance}
                    disabled={enhancing || enhanced}
                  >
                    {enhancing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {enhancing ? "Enhancing..." : enhanced ? "Enhanced" : "Enhance"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>AI Upscale 4x via Real-ESRGAN</p>
                </TooltipContent>
              </Tooltip>
              {enhanced && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={showingOriginal ? "default" : "outline"}
                      className="gap-1.5 text-xs"
                      onClick={handleToggleOriginal}
                    >
                      {showingOriginal ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      {showingOriginal ? "Show Enhanced" : "Show Original"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Compare original vs enhanced</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {enhanceError && (
                <span className="text-xs text-red-400 max-w-48 truncate" title={enhanceError}>
                  {enhanceError}
                </span>
              )}
            </div>

            {/* Forensic filters */}
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                    <Microscope className="h-3.5 w-3.5" />
                    Forensic
                    {forensicActive && (
                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] ml-1">
                        {forensicActive}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" side="bottom" align="start">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Apply forensic filters to reveal manipulation artifacts.
                    </p>

                    {/* Filter buttons grid */}
                    <div className="flex flex-wrap gap-1.5">
                      {FORENSIC_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => selectForensicFilter(preset.id)}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                            forensicFilter === preset.id
                              ? "bg-primary/20 border-primary/40 text-primary"
                              : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                          }`}
                          title={preset.description}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Parameter sliders when a filter is selected */}
                    {forensicFilter && (() => {
                      const preset = FORENSIC_PRESETS.find((f) => f.id === forensicFilter);
                      if (!preset) return null;
                      return (
                        <div className="space-y-3 pt-1">
                          {preset.params.map((paramDef) => (
                            <div key={paramDef.key}>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs text-muted-foreground">{paramDef.label}</label>
                                <span className="text-xs font-mono text-foreground">
                                  {(forensicParams[paramDef.key] ?? paramDef.default).toFixed(
                                    paramDef.step < 1 ? (paramDef.step < 0.1 ? 2 : 1) : 0
                                  )}
                                </span>
                              </div>
                              <Slider
                                value={[forensicParams[paramDef.key] ?? paramDef.default]}
                                onValueChange={([v]) =>
                                  setForensicParams((prev) => ({ ...prev, [paramDef.key]: v }))
                                }
                                min={paramDef.min}
                                max={paramDef.max}
                                step={paramDef.step}
                              />
                            </div>
                          ))}
                          <Button
                            size="sm"
                            className="w-full gap-2"
                            onClick={handleApplyForensic}
                            disabled={forensicLoading}
                          >
                            {forensicLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Microscope className="h-3.5 w-3.5" />
                            )}
                            {forensicLoading ? "Applying..." : "Apply Filter"}
                          </Button>
                        </div>
                      );
                    })()}

                    {/* Error */}
                    {forensicError && (
                      <p className="text-xs text-red-400">{forensicError}</p>
                    )}

                    {/* Reset button when a filter is active */}
                    {forensicActive && (
                      <div className="pt-1 border-t border-border/30">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5 text-xs"
                          onClick={handleResetForensic}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reset to Original
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </TooltipProvider>

        {/* Canvas area */}
        <div
          ref={containerCallbackRef}
          className="flex-1 overflow-hidden relative"
        >
          <canvas ref={canvasCallbackRef} />
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">
            Space+drag to pan &middot; Scroll to zoom
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleSaveAnnotations}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? "Saving..." : "Save Annotations"}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSaveAsEvidence}
              disabled={savingEvidence}
            >
              {savingEvidence ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {savingEvidence ? "Saving..." : "Save as Evidence"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
