import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  jest.useRealTimers();
  delete globalThis.inkdrop;
  document.body.innerHTML = "";
});
