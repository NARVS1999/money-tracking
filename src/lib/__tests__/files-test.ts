// files-test.ts — unit tests for file utility functions.
import { getMimeType } from "../files";

describe("getMimeType", () => {
  it("returns application/pdf for pdf", () => {
    expect(getMimeType("pdf")).toBe("application/pdf");
  });

  it("returns xlsx MIME type", () => {
    expect(getMimeType("xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("returns text/csv for csv", () => {
    expect(getMimeType("csv")).toBe("text/csv");
  });

  it("returns octet-stream for unknown extension", () => {
    expect(getMimeType("xyz")).toBe("application/octet-stream");
  });
});
