import { type ReactNode } from "react";
import { Pressable, Linking, type TextStyle, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * A single parsed segment: either a run of plain text or a matched inline link
 * `[label](url)`. Unmatched brackets are emitted as plain text (never silently dropped).
 */
export interface TextSegment {
  text: string;
  url?: string;
}

// Matches inline markdown-style links: [label](url). The label forbids ']' so a stray
// '[' without a matching '](...' falls through as plain text. The URL forbids whitespace.
const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Parse a string into an ordered list of plain-text and link segments.
 *
 * Exported for unit testing. Examples:
 *   "hello"                          → [{ text: "hello" }]
 *   "see [menu](https://e.com)"      → [{ text: "see " }, { text: "menu", url: "https://e.com" }]
 *   "a [broken]( link"               → [{ text: "a [broken]( link" }]  (unmatched → plain)
 *   "[x](u1) and [y](u2)"            → [{ text: "x", url: "u1" }, { text: " and " }, { text: "y", url: "u2" }]
 */
export function parseLinkedText(input: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  // LINK_PATTERN is stateful with the `g` flag, so create a fresh copy per call to avoid
  // shared lastIndex across invocations.
  const pattern = new RegExp(LINK_PATTERN);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, match.index) });
    }
    segments.push({ text: match[1], url: match[2] });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex) });
  }

  // An input with no matches still yields a single plain-text segment.
  return segments.length > 0 ? segments : [{ text: input }];
}

/**
 * Renders text that may contain markdown-style inline links (`[label](url)`).
 * Plain-text runs use `ThemedText`; each link becomes an accessible `Pressable` that
 * opens the URL via `Linking.openURL`. No external markdown dependency.
 */
export function LinkedText({
  text,
  style,
  linkStyle,
}: {
  text: string;
  style?: TextStyle;
  linkStyle?: ViewStyle;
}) {
  const { primaryColor } = useAppTheme();
  const segments = parseLinkedText(text);

  const nodes: ReactNode[] = segments.map((seg, i) => {
    if (seg.url) {
      return (
        <Pressable
          key={`link-${i}`}
          accessibilityRole="link"
          accessibilityHint={seg.url}
          onPress={() => Linking.openURL(seg.url!)}
          style={linkStyle}
        >
          <ThemedText style={[style, { color: primaryColor, textDecorationLine: "underline" }]}>
            {seg.text}
          </ThemedText>
        </Pressable>
      );
    }
    return (
      <ThemedText key={`text-${i}`} style={style}>
        {seg.text}
      </ThemedText>
    );
  });

  return <>{nodes}</>;
}
