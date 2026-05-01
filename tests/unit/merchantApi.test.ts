import { describe, expect, it } from "vitest";
import {
  areaToApiPayload,
  globalShiftPayloadFromScheduleShift,
  mapApiArea,
  mapApiStore,
} from "../../src/lib/merchantApi";

describe("merchantApi mappers", () => {
  it("maps a general API area into the app area shape", () => {
    expect(mapApiArea({ id: 1, name: "前台", color: "purple", order: 2, storeId: "all" })).toEqual({
      id: "1",
      name: "前台",
      color: "purple",
      storeId: "",
      areaType: "general",
      order: 2,
    });
  });

  it("serializes general and store areas for backend writes", () => {
    expect(areaToApiPayload({ id: "1", name: "客服", color: "blue", order: 0, storeId: "", areaType: "general" }))
      .toEqual({ name: "客服", color: "blue", order: 0, storeId: "all" });

    expect(areaToApiPayload({ id: "2", name: "收银", color: "orange", order: 1, storeId: "8", areaType: "store" }))
      .toEqual({ name: "收银", color: "orange", order: 1, storeId: "8" });
  });

  it("normalizes store status and defaults", () => {
    expect(mapApiStore({ id: 7, name: "Queen", status: 0 })).toMatchObject({
      id: "7",
      name: "Queen",
      country: "nz",
      openTime: "09:00",
      closeTime: "22:00",
      status: "disabled",
    });
  });

  it("serializes a general global shift with all-store scope", () => {
    expect(globalShiftPayloadFromScheduleShift({
      shiftName: "Morning",
      startTime: "09:00",
      endTime: "13:00",
      breakMinutes: 15,
      color: "blue",
      storeId: "1",
      shiftType: "general",
    })).toEqual({
      name: "Morning",
      startTime: "09:00",
      endTime: "13:00",
      breakMinutes: 15,
      color: "blue",
      storeId: "all",
    });
  });
});
