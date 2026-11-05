/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { EmbedOriginsCard } from "@/components/admin/settings/EmbedOriginsCard";
import { getEmbedOrigins, saveEmbedOrigins } from "@/api/embedSettings";

jest.mock("@/api/embedSettings", () => ({
  getEmbedOrigins: jest.fn(),
  saveEmbedOrigins: jest.fn(),
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = { borderColor: "#ddd", mutedColor: "#888", cardBg: "#fff" };

const addSite = async (value: string) => {
  fireEvent.press(screen.getByLabelText("Add site"));
  fireEvent.changeText(screen.getByPlaceholderText("https://your-restaurant.com"), value);
  fireEvent.press(screen.getByText("Add"));
};

describe("EmbedOriginsCard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("says the widget is shown nowhere while no site is allowed", async () => {
    (getEmbedOrigins as jest.Mock).mockResolvedValue([]);
    render(<EmbedOriginsCard {...baseProps} />);
    expect(await screen.findByText(/can't be shown anywhere/)).toBeTruthy();
  });

  it("adds a site and lists it as the server stored it", async () => {
    (getEmbedOrigins as jest.Mock).mockResolvedValue(["https://a.example"]);
    (saveEmbedOrigins as jest.Mock).mockResolvedValue({
      ok: true,
      origins: ["https://a.example", "https://bistro.example"],
    });
    render(<EmbedOriginsCard {...baseProps} />);
    await screen.findByText("https://a.example");

    await addSite("https://Bistro.example/");

    await waitFor(() => expect(screen.getByText("https://bistro.example")).toBeTruthy());
    expect(saveEmbedOrigins).toHaveBeenCalledWith(["https://a.example", "https://Bistro.example/"]);
  });

  it("removes a site", async () => {
    (getEmbedOrigins as jest.Mock).mockResolvedValue(["https://a.example", "https://b.example"]);
    (saveEmbedOrigins as jest.Mock).mockResolvedValue({ ok: true, origins: ["https://b.example"] });
    render(<EmbedOriginsCard {...baseProps} />);

    fireEvent.press(await screen.findByLabelText("Remove https://a.example"));

    await waitFor(() => expect(screen.queryByText("https://a.example")).toBeNull());
    expect(saveEmbedOrigins).toHaveBeenCalledWith(["https://b.example"]);
  });

  it("keeps the list and shows why when a site is refused", async () => {
    (getEmbedOrigins as jest.Mock).mockResolvedValue(["https://a.example"]);
    (saveEmbedOrigins as jest.Mock).mockResolvedValue({
      ok: false,
      message: "Not a site address.",
    });
    render(<EmbedOriginsCard {...baseProps} />);
    await screen.findByText("https://a.example");

    await addSite("bistro");

    expect(await screen.findByText("Not a site address.")).toBeTruthy();
    expect(screen.getByText("https://a.example")).toBeTruthy();
  });

  it("says so when the list can't be loaded", async () => {
    (getEmbedOrigins as jest.Mock).mockResolvedValue(null);
    render(<EmbedOriginsCard {...baseProps} />);
    expect(await screen.findByText("Couldn't load the allowed sites.")).toBeTruthy();
  });

  it("collapses", async () => {
    (getEmbedOrigins as jest.Mock).mockResolvedValue([]);
    render(<EmbedOriginsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Allowed sites"));
    await waitFor(() => expect(getEmbedOrigins).toHaveBeenCalled());
  });
});
