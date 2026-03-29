import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import PageContainer from "@/components/layout/PageContainer";

describe("PageContainer", () => {
  it("renders children", () => {
    render(
      <PageContainer>
        <Text>Page content</Text>
      </PageContainer>
    );
    expect(screen.getByText("Page content")).toBeTruthy();
  });

  it("applies testID prop", () => {
    render(
      <PageContainer testID="page-container">
        <Text>Content</Text>
      </PageContainer>
    );
    expect(screen.getByTestId("page-container")).toBeTruthy();
  });

  it("renders multiple children", () => {
    render(
      <PageContainer>
        <Text>First</Text>
        <Text>Second</Text>
      </PageContainer>
    );
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
  });
});
