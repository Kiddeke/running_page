import React, { useLayoutEffect, useRef, useState } from 'react';
import { pathForRun } from '@/utils/geoUtils';
import type { Activity } from '@/utils/utils';
import { NO_ROUTE_DATA, INVALID_ROUTE_DATA, INDOOR_COLOR } from '@/utils/const';
import styles from './style.module.css';

interface RoutePreviewProps {
  activities: Activity[];
  className?: string;
  // Height of the preview in pixels; width always fills the parent container.
  height?: number;
}

const FALLBACK_WIDTH = 250;
const DEFAULT_HEIGHT = 150;
const CANVAS_PADDING = 16;
const TILE_SIZE = 256;
const MIN_ZOOM = 10;
const MAX_ZOOM = 17;
const BASE_DRAW_DURATION_MS = 2800;
// 50% slower overall, per user request.
const DRAW_DURATION_MS = Math.round(BASE_DRAW_DURATION_MS * 1.5);
// Slow, explicit ease-in/ease-out: the first/last 500ms of the draw ramp
// smoothly up to/down from full speed, instead of the whole thing easing.
const RAMP_MS = 500;

const smoothstepIntegral = (x: number) => x ** 3 - x ** 4 / 2;

// Trapezoidal velocity profile: smoothstep ease-in over the first RAMP_MS,
// constant speed through the middle, smoothstep ease-out over the final
// RAMP_MS. The line and dot both read their position off this single
// progress value every frame, so they can't drift apart the way two
// independently-timed CSS/SMIL animations used to.
const trapezoidProgress = (
  elapsedMs: number,
  totalMs: number,
  rampMs: number
): number => {
  const t = Math.min(Math.max(elapsedMs, 0), totalMs);
  const v = 1 / (totalMs - rampMs); // plateau speed, in progress/ms
  if (t <= rampMs) {
    return v * rampMs * smoothstepIntegral(t / rampMs);
  }
  if (t >= totalMs - rampMs) {
    return 1 - v * rampMs * smoothstepIntegral((totalMs - t) / rampMs);
  }
  return v * rampMs * 0.5 + v * (t - rampMs);
};

// Web Mercator projection: lng/lat -> pixel coordinates at a given zoom level.
// Using the same real-world projection for both the tile mosaic and the route
// overlay keeps distances proportional in both axes, so the route never
// looks stretched relative to the map underneath it.
const lngLatToPixel = (
  lng: number,
  lat: number,
  zoom: number
): [number, number] => {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return [x, y];
};

// Pick the highest zoom level at which the route's bounding box still fits
// inside the available drawing area.
const chooseZoom = (
  minLng: number,
  maxLng: number,
  minLat: number,
  maxLat: number,
  viewWidth: number,
  viewHeight: number
): number => {
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const [minX, minY] = lngLatToPixel(minLng, maxLat, z);
    const [maxX, maxY] = lngLatToPixel(maxLng, minLat, z);
    if (maxX - minX <= viewWidth && maxY - minY <= viewHeight) {
      return z;
    }
  }
  return MIN_ZOOM;
};

const TILE_SUBDOMAINS = 'abcd';
const tileSubdomain = (x: number, y: number) => TILE_SUBDOMAINS[(x + y) % 4];

type Point = [number, number];

const pointDistance = (a: Point, b: Point) =>
  Math.hypot(b[0] - a[0], b[1] - a[1]);

const buildPathD = (points: readonly Point[]): string =>
  points
    .map(
      ([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    )
    .join(' ');

// Truncates `points` to the given fraction (0-1) of the polyline's total
// arc length, interpolating one extra point for the partial final segment
// so the cut end doesn't jump between vertices.
const sliceAtProgress = (
  points: readonly Point[],
  progress: number
): Point[] => {
  if (points.length < 2 || progress >= 1) return points.slice();

  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] + pointDistance(points[i - 1], points[i])
    );
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return points.slice();

  const target = progress * total;
  let idx = 1;
  while (idx < cumulative.length && cumulative[idx] < target) idx++;
  if (idx >= cumulative.length) return points.slice();

  const segStart = cumulative[idx - 1];
  const segEnd = cumulative[idx];
  const segFrac =
    segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
  const [x1, y1] = points[idx - 1];
  const [x2, y2] = points[idx];
  const interpolated: Point = [
    x1 + (x2 - x1) * segFrac,
    y1 + (y2 - y1) * segFrac,
  ];

  return [...points.slice(0, idx), interpolated];
};

// Draws a route by growing a plain `d` string (M/L commands built from the
// raw point list) each frame, instead of stroke-dasharray/stroke-dashoffset
// over a fixed path. Safari/WebKit (which is what "Chrome" on iOS also runs
// on under the hood — Apple requires it) was rendering the dasharray
// version as several disconnected pieces of the route appearing at once
// instead of one continuously growing line; a plain, ever-growing path has
// no dash pattern for any engine to misinterpret. It also sidesteps the
// need to depend on the container's measured width at all: `pointsRef`
// always holds the latest projected points, so if the container's width
// settles a frame or two after mount (useContainerWidth starts from a
// fallback), the in-progress reveal just keeps growing against the
// corrected geometry next frame instead of restarting.
const AnimatedRoute: React.FC<{
  points: Point[];
  color: string;
  indoor: boolean;
}> = ({ points, color, indoor }) => {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useLayoutEffect(() => {
    const pathEl = pathRef.current;
    const dotEl = dotRef.current;
    if (!pathEl || indoor) return;

    const applyProgress = (progress: number) => {
      const sliced = sliceAtProgress(pointsRef.current, progress);
      pathEl.setAttribute('d', buildPathD(sliced));
      if (dotEl && sliced.length > 0) {
        const [x, y] = sliced[sliced.length - 1];
        dotEl.setAttribute('cx', `${x}`);
        dotEl.setAttribute('cy', `${y}`);
      }
    };

    applyProgress(0); // synchronous initial state, before the browser paints

    let startTime: number | null = null;
    let rafId = requestAnimationFrame(function tick(now) {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      applyProgress(trapezoidProgress(elapsed, DRAW_DURATION_MS, RAMP_MS));

      if (elapsed < DRAW_DURATION_MS) {
        rafId = requestAnimationFrame(tick);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [indoor]);

  return (
    <>
      <path
        ref={pathRef}
        d={indoor ? buildPathD(points) : undefined}
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={indoor ? 0.6 : 0.95}
        strokeDasharray={indoor ? '4,3' : undefined}
      />
      {!indoor && (
        <circle
          r="5"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
          ref={dotRef}
        />
      )}
    </>
  );
};

const useContainerWidth = (fallback: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
};

const RoutePreview: React.FC<RoutePreviewProps> = ({
  activities,
  className,
  height = DEFAULT_HEIGHT,
}) => {
  const [containerRef, width] = useContainerWidth(FALLBACK_WIDTH);
  const activitiesWithRoutes = activities.filter(
    (activity) => activity.summary_polyline
  );

  if (activitiesWithRoutes.length === 0) {
    return (
      <div className={`${styles.routePreview} ${className || ''}`}>
        <div
          ref={containerRef}
          className={styles.noRoute}
          style={{ width: '100%', height }}
        >
          {NO_ROUTE_DATA}
        </div>
      </div>
    );
  }

  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
  const routes = activitiesWithRoutes.map((activity, index) => {
    const path = pathForRun(activity);
    const indoor =
      activity.subtype === 'indoor' || activity.subtype === 'treadmill';
    const color = indoor ? INDOOR_COLOR : colors[index % colors.length];
    return { path, color, indoor };
  });

  const allPoints = routes.flatMap((route) => route.path);
  if (allPoints.length === 0) {
    return (
      <div className={`${styles.routePreview} ${className || ''}`}>
        <div
          ref={containerRef}
          className={styles.noRoute}
          style={{ width: '100%', height }}
        >
          {INVALID_ROUTE_DATA}
        </div>
      </div>
    );
  }

  const lats = allPoints.map((point) => point[1]);
  const lngs = allPoints.map((point) => point[0]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const drawWidth = width - CANVAS_PADDING * 2;
  const drawHeight = height - CANVAS_PADDING * 2;
  const zoom = chooseZoom(
    minLng,
    maxLng,
    minLat,
    maxLat,
    drawWidth,
    drawHeight
  );

  // Bounding box of the route(s) in real map pixels at the chosen zoom.
  const [bboxMinX, bboxMinY] = lngLatToPixel(minLng, maxLat, zoom);
  const [bboxMaxX, bboxMaxY] = lngLatToPixel(maxLng, minLat, zoom);

  // Offset that centers the bounding box inside the canvas. Both the tile
  // mosaic and the route overlay use this same offset, so they line up.
  const offsetX = (width - (bboxMaxX - bboxMinX)) / 2 - bboxMinX;
  const offsetY = (height - (bboxMaxY - bboxMinY)) / 2 - bboxMinY;

  const project = (lng: number, lat: number): [number, number] => {
    const [x, y] = lngLatToPixel(lng, lat, zoom);
    return [x + offsetX, y + offsetY];
  };

  const maxTileIndex = 2 ** zoom - 1;
  const containerMinX = -offsetX;
  const containerMinY = -offsetY;
  const tileXStart = Math.max(0, Math.floor(containerMinX / TILE_SIZE));
  const tileXEnd = Math.min(
    maxTileIndex,
    Math.floor((containerMinX + width - 1) / TILE_SIZE)
  );
  const tileYStart = Math.max(0, Math.floor(containerMinY / TILE_SIZE));
  const tileYEnd = Math.min(
    maxTileIndex,
    Math.floor((containerMinY + height - 1) / TILE_SIZE)
  );

  const tiles: {
    key: string;
    x: number;
    y: number;
    left: number;
    top: number;
  }[] = [];
  for (let tx = tileXStart; tx <= tileXEnd; tx++) {
    for (let ty = tileYStart; ty <= tileYEnd; ty++) {
      tiles.push({
        key: `${tx}-${ty}`,
        x: tx,
        y: ty,
        left: tx * TILE_SIZE + offsetX,
        top: ty * TILE_SIZE + offsetY,
      });
    }
  }

  // Always use Carto's colorful Voyager style for the preview background,
  // regardless of app theme — the muted light_all/dark_all styles read as
  // plain gray in a card this small.
  const tileStyle = 'rastertiles/voyager';

  return (
    <div className={`${styles.routePreview} ${className || ''}`}>
      <div
        ref={containerRef}
        className={styles.mapContainer}
        style={{ width: '100%', height }}
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={`https://${tileSubdomain(tile.x, tile.y)}.basemaps.cartocdn.com/${tileStyle}/${zoom}/${tile.x}/${tile.y}.png`}
            width={TILE_SIZE}
            height={TILE_SIZE}
            className={styles.mapTile}
            style={{ left: tile.left, top: tile.top }}
            alt=""
            loading="lazy"
          />
        ))}
        <svg width={width} height={height} className={styles.routeSvg}>
          {routes.map((route, idx) => {
            if (route.path.length < 2) return null;
            const routeKey = `${idx}-${route.path.length}`;
            const projectedPoints: Point[] = route.path.map((coord) =>
              project(coord[0], coord[1])
            );
            const [startX, startY] = projectedPoints[0];
            const [endX, endY] = projectedPoints[projectedPoints.length - 1];

            return (
              <g key={routeKey}>
                <AnimatedRoute
                  points={projectedPoints}
                  color={route.color}
                  indoor={route.indoor}
                />
                <circle
                  cx={startX}
                  cy={startY}
                  r="3.5"
                  fill="#2ecc71"
                  stroke="white"
                  strokeWidth="1.2"
                />
                {/* Indoor routes render statically with no traveling dot,
                    so they still need a fixed end marker. Routes that
                    animate don't: the traveling dot already settles at
                    this exact point once the draw finishes, and it's the
                    same color as this marker would be, so showing both
                    just looked like two disconnected dots on the map
                    before the line ever reached the real one. */}
                {route.indoor && (
                  <circle
                    cx={endX}
                    cy={endY}
                    r="3.5"
                    fill="#e74c3c"
                    stroke="white"
                    strokeWidth="1.2"
                  />
                )}
              </g>
            );
          })}
        </svg>
        <div className={styles.attribution}>© CARTO © OSM</div>
      </div>
    </div>
  );
};

export default RoutePreview;
