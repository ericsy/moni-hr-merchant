import { Input } from "antd";
import type { InputRef } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  extractGooglePlaceSummary,
  getGoogleMapsWindow,
  loadGoogleMaps,
  type GooglePlaceSummary,
} from "../lib/googleMaps";

interface GoogleAddressAutocompleteInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onPlaceSelected?: (place: GooglePlaceSummary) => void;
  placeholder?: string;
  country?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

export default function GoogleAddressAutocompleteInput({
  value = "",
  onChange = () => {},
  onPlaceSelected = () => {},
  placeholder = "",
  country = "",
  disabled = false,
  allowClear = true,
}: GoogleAddressAutocompleteInputProps) {
  const inputRef = useRef<InputRef>(null);
  const autocompleteRef = useRef<any>(null);
  const latestValueRef = useRef(value);
  const latestOnChangeRef = useRef(onChange);
  const latestOnPlaceSelectedRef = useRef(onPlaceSelected);
  const [mapsReady, setMapsReady] = useState<boolean>(
    Boolean(getGoogleMapsWindow().google?.maps?.places),
  );

  const normalizedCountry = useMemo(
    () => country.trim().toLowerCase(),
    [country],
  );

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    latestOnChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    latestOnPlaceSelectedRef.current = onPlaceSelected;
  }, [onPlaceSelected]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (!cancelled) setMapsReady(true);
      })
      .catch((error) => {
        console.warn(
          "[GoogleAddressAutocompleteInput] failed to load Google Maps:",
          error,
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !mapsReady ||
      autocompleteRef.current ||
      !inputRef.current?.input ||
      !getGoogleMapsWindow().google?.maps?.places?.Autocomplete
    ) {
      return;
    }
    const googleWindow = getGoogleMapsWindow();

    const options: Record<string, unknown> = {
      types: ["address"],
      fields: [
        "formatted_address",
        "address_components",
        "geometry",
        "name",
        "place_id",
      ],
    };
    if (normalizedCountry) {
      options.componentRestrictions = { country: normalizedCountry };
    }

    const autocomplete = new googleWindow.google.maps.places.Autocomplete(
      inputRef.current.input,
      options,
    );
    autocompleteRef.current = autocomplete;

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const summary = extractGooglePlaceSummary(place);
      const nextValue =
        summary.formattedAddress ||
        inputRef.current?.input?.value ||
        latestValueRef.current ||
        "";

      latestOnChangeRef.current(nextValue);
      latestOnPlaceSelectedRef.current({
        ...summary,
        formattedAddress: nextValue,
      });
    });
  }, [mapsReady, normalizedCountry]);

  useEffect(() => {
    const autocomplete = autocompleteRef.current;
    if (!autocomplete?.setComponentRestrictions) return;

    autocomplete.setComponentRestrictions(
      normalizedCountry ? { country: normalizedCountry } : {},
    );
  }, [normalizedCountry]);

  return (
    <Input
      ref={inputRef}
      value={value}
      disabled={disabled}
      allowClear={allowClear}
      autoComplete="new-password"
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
