/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react-native";
import PageLoader from "@/components/common/PageLoader";
import { BrandProvider } from "@/context/BrandContext";

// Polyfill fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

describe("PageLoader", () => {
  it("renders correctly", () => {
    const { getByTestId } = render(
      <BrandProvider>
        <PageLoader />
      </BrandProvider>
    );
    expect(getByTestId("loading-screen")).toBeTruthy();
  });
});
