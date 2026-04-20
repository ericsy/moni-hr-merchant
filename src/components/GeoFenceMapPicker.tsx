/**
 * GeoFenceMapPicker
 *
 * Google Maps 电子围栏选择器组件
 * - 支持地址搜索（Geocoding API）
 * - 可拖拽标记调整围栏中心
 * - 圆形围栏半径滑块（50–2000 米）
 * - 使用浏览器定位快速定位
 *
 * ⚠️  请将下方 GOOGLE_MAPS_API_KEY 替换为您自己的 API Key
 *     需开启：Maps JavaScript API + Geocoding API + Places API
 */

// Minimal Google Maps type declarations (avoids needing @types/google.maps)
/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace google {
  namespace maps {
    class Map {
      constructor(el: HTMLElement, opts?: any);
      panTo(pos: any): void;
      setZoom(zoom: number): void;
      addListener(event: string, handler: (...args: any[]) => void): void;
    }
    class Marker {
      constructor(opts?: any);
      setPosition(pos: any): void;
      getPosition(): any;
      addListener(event: string, handler: (...args: any[]) => void): void;
    }
    class Circle {
      constructor(opts?: any);
      setCenter(center: any): void;
      setRadius(radius: number): void;
      getRadius(): number;
    }
    class Geocoder {
      geocode(request: any, callback: (results: any, status: string) => void): void;
    }
    enum Animation {
      DROP,
    }
    interface MapMouseEvent {
      latLng?: any;
    }
    namespace places {
      class Autocomplete {
        constructor(el: HTMLInputElement, opts?: any);
        bindTo(key: string, map: any): void;
        getPlace(): any;
        addListener(event: string, handler: (...args: any[]) => void): void;
      }
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useCallback } from "react";
import { Button, Slider, Input, Spin } from "antd";
import { Search, Navigation, MapPin, Info } from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { toast } from "sonner";

// ─── 替换为您自己的 Google Maps API Key ───────────────────────────────────────
const GOOGLE_MAPS_API_KEY = "AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY";
// ─────────────────────────────────────────────────────────────────────────────

// 默认中心：新西兰奥克兰
const DEFAULT_LAT = -36.8485;
const DEFAULT_LNG = 174.7633;
const DEFAULT_RADIUS = 200;

interface GeoFenceValue {
  latitude: number;
  longitude: number;
  geofenceRadius: number;
}

interface GeoFenceMapPickerProps {
  value?: GeoFenceValue;
  onChange?: (val: GeoFenceValue) => void;
  storeName?: string;
}

// Declare google maps types for window
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any;
    initGoogleMapsCallback?: () => void;
  }
}

let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (mapsLoadPromise) return mapsLoadPromise;
  if (window.google?.maps) {
    mapsLoadPromise = Promise.resolve();
    return mapsLoadPromise;
  }
  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    const callbackName = `__gmaps_cb_${Date.now()}`;
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      resolve();
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

export default function GeoFenceMapPicker({
  value,
  onChange = () => {},
  storeName = "",
}: GeoFenceMapPickerProps) {
  const { t } = useLocale();
  const st = t.store;

  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [searchText, setSearchText] = useState("");

  const initialLat = value?.latitude ?? DEFAULT_LAT;
  const initialLng = value?.longitude ?? DEFAULT_LNG;
  const initialRadius = value?.geofenceRadius ?? DEFAULT_RADIUS;

  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [radius, setRadius] = useState(initialRadius);

  // Sync external value changes
  useEffect(() => {
    if (value?.latitude !== undefined) setLat(value.latitude);
    if (value?.longitude !== undefined) setLng(value.longitude);
    if (value?.geofenceRadius !== undefined) setRadius(value.geofenceRadius);
  }, [value?.latitude, value?.longitude, value?.geofenceRadius]);

  const notifyChange = useCallback(
    (newLat: number, newLng: number, newRadius: number) => {
      console.log("[GeoFenceMapPicker] onChange:", { newLat, newLng, newRadius });
      onChange({ latitude: newLat, longitude: newLng, geofenceRadius: newRadius });
    },
    [onChange]
  );

  const updateCircle = useCallback(
    (newLat: number, newLng: number, newRadius: number) => {
      const pos = { lat: newLat, lng: newLng };
      if (markerRef.current) {
        markerRef.current.setPosition(pos);
      }
      if (circleRef.current) {
        circleRef.current.setCenter(pos);
        circleRef.current.setRadius(newRadius);
      }
      googleMapRef.current?.panTo(pos);
    },
    []
  );

  // Initialize map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;

        const center = { lat: initialLat, lng: initialLng };
        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: "cooperative",
        });
        googleMapRef.current = map;

        // Draggable marker
        const marker = new window.google.maps.Marker({
          position: center,
          map,
          draggable: true,
          title: storeName || "Store",
          animation: window.google.maps.Animation.DROP,
        });
        markerRef.current = marker;

        // Circle
        const circle = new window.google.maps.Circle({
          map,
          center,
          radius: initialRadius,
          strokeColor: "var(--primary)",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "var(--primary)",
          fillOpacity: 0.15,
          editable: false,
        });
        circleRef.current = circle;

        // Drag end → update state
        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          const newLat = pos.lat();
          const newLng = pos.lng();
          circle.setCenter({ lat: newLat, lng: newLng });
          setLat(newLat);
          setLng(newLng);
          notifyChange(newLat, newLng, circle.getRadius());
          console.log("[GeoFenceMapPicker] marker dragged to:", newLat, newLng);
        });

        // Click on map → move marker
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          marker.setPosition(e.latLng);
          circle.setCenter(e.latLng);
          setLat(newLat);
          setLng(newLng);
          notifyChange(newLat, newLng, circle.getRadius());
        });

        // Places Autocomplete
        if (searchInputRef.current) {
          const autocomplete = new window.google.maps.places.Autocomplete(
            searchInputRef.current,
            { types: ["geocode", "establishment"] }
          );
          autocomplete.bindTo("bounds", map);
          autocompleteRef.current = autocomplete;

          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry?.location) return;
            const newLat = place.geometry.location.lat();
            const newLng = place.geometry.location.lng();
            marker.setPosition(place.geometry.location);
            circle.setCenter(place.geometry.location);
            map.panTo(place.geometry.location);
            map.setZoom(16);
            setLat(newLat);
            setLng(newLng);
            setSearchText(place.formatted_address || place.name || "");
            notifyChange(newLat, newLng, circle.getRadius());
            console.log("[GeoFenceMapPicker] place selected:", place.formatted_address);
          });
        }

        setMapsReady(true);
      })
      .catch((err) => {
        console.log("[GeoFenceMapPicker] Maps load error:", err);
        if (!cancelled) setMapsError(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Radius change → update circle
  const handleRadiusChange = (val: number) => {
    setRadius(val);
    if (circleRef.current) {
      circleRef.current.setRadius(val);
    }
    notifyChange(lat, lng, val);
  };

  // Manual search button (geocoding fallback)
  const handleManualSearch = () => {
    if (!searchText.trim() || !window.google?.maps) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchText }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        const newLat = loc.lat();
        const newLng = loc.lng();
        updateCircle(newLat, newLng, radius);
        setLat(newLat);
        setLng(newLng);
        notifyChange(newLat, newLng, radius);
        console.log("[GeoFenceMapPicker] geocoded:", results[0].formatted_address);
      } else {
        toast.error(`无法找到该地址 / Address not found`);
      }
    });
  };

  // Use browser geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("浏览器不支持定位");
      return;
    }
    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        updateCircle(newLat, newLng, radius);
        setLat(newLat);
        setLng(newLng);
        notifyChange(newLat, newLng, radius);
        setLoadingLocation(false);
        googleMapRef.current?.setZoom(17);
        toast.success("已定位到当前位置");
        console.log("[GeoFenceMapPicker] geolocated:", newLat, newLng);
      },
      (err) => {
        console.log("[GeoFenceMapPicker] geolocation error:", err);
        toast.error("定位失败，请手动搜索地址");
        setLoadingLocation(false);
      },
      { timeout: 10000 }
    );
  };

  return (
    <div data-cmp="GeoFenceMapPicker" className="flex flex-col gap-4">
      {/* Description banner */}
      <div
        className="flex items-start gap-2 p-3 rounded-lg text-sm"
        style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
      >
        <Info size={15} className="mt-0.5 flex-shrink-0" />
        <span>{st.geofenceDesc}</span>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
            placeholder={st.geofenceSearch}
            className="w-full h-8 pl-3 pr-3 rounded-md text-sm border outline-none transition-all"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>
        <Button
          size="small"
          icon={<Search size={13} />}
          onClick={handleManualSearch}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          {st.geofenceSearchBtn}
        </Button>
        <Button
          size="small"
          icon={loadingLocation ? <Spin size="small" /> : <Navigation size={13} />}
          onClick={handleLocateMe}
          loading={loadingLocation}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          {st.geofenceLocate}
        </Button>
      </div>

      {/* Map container */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ height: 380, border: "1px solid var(--border)" }}
      >
        {!mapsReady && !mapsError && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
            style={{ background: "var(--muted)" }}
          >
            <Spin size="large" />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              正在加载地图 / Loading map...
            </span>
          </div>
        )}
        {mapsError && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
            style={{ background: "var(--muted)" }}
          >
            <MapPin size={36} style={{ color: "var(--muted-foreground)" }} />
            <div className="text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
              <div>Google Maps 加载失败</div>
              <div className="text-xs mt-1 opacity-70">请检查 API Key 或网络连接</div>
              <div className="text-xs mt-1 opacity-50">{st.geofenceApiKeyHint}</div>
            </div>
          </div>
        )}
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        {/* Drag tip overlay */}
        {mapsReady && (
          <div
            className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs pointer-events-none"
            style={{ background: "var(--card)", color: "var(--muted-foreground)", boxShadow: "0 1px 6px var(--shadow-color)" }}
          >
            <MapPin size={11} />
            {st.geofenceDragTip}
          </div>
        )}
      </div>

      {/* Radius slider */}
      <div
        className="p-4 rounded-xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {st.geofenceRadius}
          </span>
          <span
            className="text-sm font-bold px-2 py-0.5 rounded-md"
            style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
          >
            {radius} m
          </span>
        </div>
        <Slider
          min={50}
          max={2000}
          step={25}
          value={radius}
          onChange={handleRadiusChange}
          tooltip={{ formatter: (v) => `${v} m` }}
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>50 m</span>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{st.geofenceRadiusHint}</span>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>2000 m</span>
        </div>
      </div>

      {/* Coordinates info */}
      <div
        className="flex items-center gap-4 p-3 rounded-xl"
        style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
      >
        <MapPin size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
        <div className="flex items-center gap-4 flex-1">
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{st.geofenceLat}</span>
            <span className="text-sm font-mono font-medium" style={{ color: "var(--foreground)" }}>
              {lat.toFixed(6)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{st.geofenceLng}</span>
            <span className="text-sm font-mono font-medium" style={{ color: "var(--foreground)" }}>
              {lng.toFixed(6)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Radius</span>
            <span className="text-sm font-mono font-medium" style={{ color: "var(--foreground)" }}>
              {radius} m
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
