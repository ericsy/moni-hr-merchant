/* eslint-disable @typescript-eslint/no-explicit-any */

const FALLBACK_GOOGLE_MAPS_API_KEY =
  "AIzaSyBGGyk3gO2e0sAZhmsU2UqOtO6QOOfhoO8";

export const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  FALLBACK_GOOGLE_MAPS_API_KEY;

export type GoogleMapsWindow = Window & { google?: any };

export function getGoogleMapsWindow(): GoogleMapsWindow {
  return window as GoogleMapsWindow;
}

let mapsLoadPromise: Promise<void> | null = null;

export function loadGoogleMaps(
  libraries: string[] = ["places", "geometry"],
): Promise<void> {
  const googleWindow = getGoogleMapsWindow();
  if (googleWindow.google?.maps) {
    mapsLoadPromise = mapsLoadPromise || Promise.resolve();
    return mapsLoadPromise;
  }
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    const callbackName = `__gmaps_cb_${Date.now()}`;
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      resolve();
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=${libraries.join(",")}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

export interface GooglePlaceSummary {
  formattedAddress: string;
  placeId: string;
  city: string;
  postalCode: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
}

function getAddressComponent(
  place: any,
  types: string[],
  useShortName = false,
): string {
  const components = place?.address_components || [];
  const match = components.find((component: any) =>
    types.some((type) => component.types?.includes(type)),
  );
  if (!match) return "";
  return String(
    useShortName ? match.short_name || match.long_name : match.long_name || "",
  );
}

export function extractGooglePlaceSummary(place: any): GooglePlaceSummary {
  const latitude =
    typeof place?.geometry?.location?.lat === "function"
      ? place.geometry.location.lat()
      : undefined;
  const longitude =
    typeof place?.geometry?.location?.lng === "function"
      ? place.geometry.location.lng()
      : undefined;

  return {
    formattedAddress: String(
      place?.formatted_address || place?.name || "",
    ).trim(),
    placeId: String(place?.place_id || "").trim(),
    city: getAddressComponent(place, [
      "locality",
      "postal_town",
      "sublocality_level_1",
      "administrative_area_level_2",
    ]),
    postalCode: getAddressComponent(place, ["postal_code"]),
    countryCode: getAddressComponent(place, ["country"], true).toLowerCase(),
    latitude,
    longitude,
  };
}
