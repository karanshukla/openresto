import { Linking, Text, type TextStyle } from "react-native";
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
 *
 * Plain runs and link runs are emitted as children of a single parent `<Text>`
 * so the whole string flows as one inline paragraph (links do NOT break onto
 * their own line). Links are nested `<Text onPress>` — the only RN construct
 * that is both inline-flowing and tappable. No external markdown dependency.
 *
 * Each link's url is exposed via `accessibilityHint` (and the parent is
 * `accessibilityRole="link"`) so assistive tech announces the destination.
 */
export function LinkedText({ text, style }: { text: string; style?: TextStyle }) {
  const { primaryColor } = useAppTheme();
  const segments = parseLinkedText(text);

  return (
    <ThemedText style={style}>
      {segments.map((seg, i) =>
        seg.url ? (
          <Text
            key={`link-${i}`}
            accessibilityRole="link"
            accessibilityHint={seg.url}
            onPress={() => Linking.openURL(seg.url!)}
            style={{ color: primaryColor, textDecorationLine: "underline" }}
          >
            {seg.text}
          </Text>
        ) : (
          // Plain run: bare <Text> inherits the parent <ThemedText>'s styling
          // (font, size, line-height, color) so the paragraph flows uniformly.
          <Text key={`text-${i}`}>{seg.text}</Text>
        )
      )}
    </ThemedText>
  );
}
